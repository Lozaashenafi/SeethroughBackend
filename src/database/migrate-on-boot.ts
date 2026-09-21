/**
 * Boot-time migration runner shared by the long-running server and the Vercel
 * serverless handler.
 *
 * Why this exists: production databases are sometimes created or altered
 * outside Drizzle's migration journal (e.g. `drizzle-kit push`, manual SQL).
 * The journal (`drizzle.__drizzle_migrations`) then lags reality: on the next
 * boot, `migrate()` replays old `CREATE TABLE` statements, crashes with
 * `42P07 relation ... already exists`, rolls the whole transaction back — and
 * every *pending* migration after it (e.g. new columns) silently never runs.
 * The result is a half-migrated schema and 500s across the API.
 *
 * Strategy:
 *  1. Try the standard, atomic `migrate()` first (fast path).
 *  2. If it fails with "already exists"-class errors, fall back to applying
 *     each migration statement-by-statement, skipping statements whose target
 *     objects already exist, then record all migrations in the journal so
 *     future boots use the fast path again.
 *  3. Anything else still fails loudly.
 */

import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { db } from './db.js';
import { logger } from '../config/logger.js';

// Postgres error codes meaning "object already exists" — safe to skip when the
// journal is out of sync with the actual schema.
const ALREADY_EXISTS_CODES = new Set([
  '42P07', // duplicate_table (also duplicate index/constraint names)
  '42710', // duplicate_object (constraints, types)
  '42701', // duplicate_column
  '42P06', // duplicate_schema
  '42P04', // duplicate_database
]);

/** Extract the raw PG error code from a Drizzle error's `cause` chain. */
function getPgErrorCode(error: unknown): string | undefined {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string') return code;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

function isAlreadyExistsError(error: unknown): boolean {
  const code = getPgErrorCode(error);
  return code !== undefined && ALREADY_EXISTS_CODES.has(code);
}

/** Split a migration file's SQL text into individual statements. */
function splitStatements(sqlText: string): string[] {
  return sqlText
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

interface SchemaSnapshot {
  tables: Set<string>;
  columns: Set<string>;
  indexes: Set<string>;
  constraints: Set<string>;
  enums: Set<string>;
}

/**
 * Snapshot the current schema objects (tables, columns, indexes, constraints,
 * enums) for "already exists" checks in the recovery path.
 */
async function snapshotSchemaObjects(): Promise<SchemaSnapshot> {
  const snapshot: SchemaSnapshot = {
    tables: new Set(),
    columns: new Set(),
    indexes: new Set(),
    constraints: new Set(),
    enums: new Set(),
  };

  const tables = await db.execute<{ table_name: string }>(
    sql`select table_name from information_schema.tables where table_schema = 'public'`,
  );
  for (const row of tables.rows) snapshot.tables.add(row.table_name);

  const columns = await db.execute<{ table_name: string; column_name: string }>(
    sql`select table_name, column_name from information_schema.columns where table_schema = 'public'`,
  );
  for (const row of columns.rows) {
    snapshot.columns.add(`${row.table_name}.${row.column_name}`);
  }

  const indexes = await db.execute<{ indexname: string }>(
    sql`select indexname from pg_indexes where schemaname = 'public'`,
  );
  for (const row of indexes.rows) snapshot.indexes.add(row.indexname);

  const constraints = await db.execute<{ conname: string }>(
    sql`select conname from pg_constraint where connamespace = 'public'::regnamespace`,
  );
  for (const row of constraints.rows) snapshot.constraints.add(row.conname);

  const enums = await db.execute<{ typname: string }>(
    sql`select t.typname from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typtype = 'e'`,
  );
  for (const row of enums.rows) snapshot.enums.add(row.typname);

  return snapshot;
}

type StatementKind = 'table' | 'index' | 'column' | 'constraint' | 'enum' | 'other';

/** Classify a DDL statement so we can check whether its object already exists. */
function classifyStatement(stmt: string): { kind: StatementKind; name?: string } {
  const lower = stmt.toLowerCase();

  if (lower.startsWith('create table')) {
    const m = stmt.match(/create\s+table\s+(?:if\s+not\s+exists\s+)?"?([A-Za-z0-9_]+)"?/i);
    return { kind: 'table', name: m?.[1] };
  }
  if (lower.startsWith('create unique index') || lower.startsWith('create index')) {
    const m = stmt.match(
      /create\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?"?([A-Za-z0-9_]+)"?/i,
    );
    return { kind: 'index', name: m?.[1] };
  }
  if (lower.startsWith('create type')) {
    const m = stmt.match(/create\s+type\s+(?:if\s+not\s+exists\s+)?"?([A-Za-z0-9_]+)"?/i);
    return { kind: 'enum', name: m?.[1] };
  }
  if (lower.startsWith('alter table') && lower.includes('add constraint')) {
    const m = stmt.match(/add\s+constraint\s+"?([A-Za-z0-9_]+)"?/i);
    return { kind: 'constraint', name: m?.[1] };
  }
  if (lower.startsWith('alter table') && lower.includes('add column')) {
    const table = stmt.match(/alter\s+table\s+"?([A-Za-z0-9_]+)"?/i)?.[1];
    const column = stmt.match(
      /add\s+column\s+(?:if\s+not\s+exists\s+)?"?([A-Za-z0-9_]+)"?/i,
    )?.[1];
    if (table && column) return { kind: 'column', name: `${table}.${column}` };
    return { kind: 'column' };
  }
  return { kind: 'other' };
}

function statementTargetExists(
  stmt: string,
  schema: SchemaSnapshot,
): boolean {
  const { kind, name } = classifyStatement(stmt);
  switch (kind) {
    case 'table':
      return name !== undefined && schema.tables.has(name);
    case 'index':
      return name !== undefined && schema.indexes.has(name);
    case 'column':
      return name !== undefined && schema.columns.has(name);
    case 'constraint':
      return name !== undefined && schema.constraints.has(name);
    case 'enum':
      return name !== undefined && schema.enums.has(name);
    default:
      return false;
  }
}

interface JournalEntry {
  idx: number;
  version: number;
  when: number;
  tag: string;
  breakpoints: boolean;
}

/**
 * Recovery path: apply each migration statement-by-statement, skipping
 * statements whose target objects already exist, then record every migration
 * in the Drizzle journal so subsequent boots take the normal fast path.
 */
async function migrateWithRecovery(migrationsFolder: string): Promise<void> {
  const journalPath = path.join(migrationsFolder, 'meta', '_journal.json');
  const journal = JSON.parse(
    fs.readFileSync(journalPath, 'utf8'),
  ) as { entries: JournalEntry[] };

  const schema = await snapshotSchemaObjects();

  for (const entry of journal.entries) {
    const sqlText = fs.readFileSync(
      path.join(migrationsFolder, `${entry.tag}.sql`),
      'utf8',
    );

    for (const stmt of splitStatements(sqlText)) {
      if (statementTargetExists(stmt, schema)) {
        logger.debug(
          { tag: entry.tag, statement: stmt.slice(0, 100) },
          'Recovery: skipping already-applied statement',
        );
        continue;
      }

      try {
        await db.execute(sql.raw(stmt));
      } catch (error) {
        if (isAlreadyExistsError(error)) {
          // Misclassified or lost a race — treat as applied.
          logger.debug(
            { tag: entry.tag, statement: stmt.slice(0, 100) },
            'Recovery: statement reported already exists, skipping',
          );
          continue;
        }
        throw error;
      }
    }
  }

  // Record every migration in the journal so future boots use the fast path.
  await db.execute(
    sql`create schema if not exists "drizzle"`,
  );
  await db.execute(sql`
    create table if not exists "drizzle"."__drizzle_migrations" (
      id serial primary key,
      hash text not null,
      created_at bigint
    )
  `);
  for (const entry of journal.entries) {
    const fileContent = fs.readFileSync(
      path.join(migrationsFolder, `${entry.tag}.sql`),
      'utf8',
    );
    const hash = crypto.createHash('sha256').update(fileContent).digest('hex');
    await db.execute(sql`
      insert into "drizzle"."__drizzle_migrations" ("hash", "created_at")
      values (${hash}, ${entry.when})
      on conflict do nothing
    `);
  }
}

/** Run pending migrations, recovering automatically from a desynced journal. */
export async function runBootMigrations(migrationsFolder: string): Promise<void> {
  // Fast path: the standard, atomic Drizzle migration.
  try {
    await migrate(db, { migrationsFolder });
    logger.info('Database migrations applied');
    return;
  } catch (error) {
    if (!isAlreadyExistsError(error)) {
      throw error;
    }
    logger.warn(
      { err: error },
      'Migration journal is out of sync with the database (objects already exist). Falling back to per-statement migration.',
    );
  }

  await migrateWithRecovery(migrationsFolder);
  logger.info('Database migrations applied (journal recovery mode)');
}
