# See Through

Anonymous workplace review platform where employees can safely share their experiences without creating accounts or revealing their identities.

## Architecture

**Anonymous-First Architecture** — every visitor automatically receives a persistent anonymous identity via a secure HTTP-only cookie. No registration, no login, no email, no passwords.

### Core Philosophy

- No user accounts
- No authentication screens  
- Privacy as the foundation
- Every visitor gets an anonymous identity automatically
- Controllers never worry about identity creation

Administrators are the only exception: they sign in through the `auth` module, and the admin JWT is delivered via an httpOnly cookie (never exposed to JavaScript).

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Language:** TypeScript (strict)
- **Database:** PostgreSQL
- **ORM:** Drizzle ORM
- **Validation:** Zod
- **Logging:** Pino
- **Security:** Helmet, CORS, Rate Limiting
- **Package Manager:** pnpm

## Project Structure

```
src/
├── app/                    # Express app setup
│   └── app.ts
├── config/                 # Configuration
│   ├── env.ts             # Environment variables (Zod validated)
│   ├── logger.ts          # Pino logger setup
│   ├── cors.ts            # CORS configuration
│   └── cookies.ts         # Cookie configuration
├── database/              # Database layer
│   ├── db.ts             # Database connection & pool
│   ├── schema/           # Drizzle schema definitions
│   └── migrations/       # Auto-generated migrations
├── middlewares/           # Express middlewares
│   ├── anonymousIdentity.middleware.ts
│   ├── validate.middleware.ts
│   ├── error.middleware.ts
│   ├── notFound.middleware.ts
│   └── rateLimiter.middleware.ts
├── modules/              # Feature modules
│   ├── anonymous/        # Anonymous identity module
│   │   ├── controller/
│   │   ├── service/
│   │   ├── repository/
│   │   ├── routes/
│   │   ├── validation/
│   │   └── types/
│   ├── health/           # Health check module
│   │   ├── controller/
│   │   └── routes/
│   ├── auth/             # Admin authentication (JWT via httpOnly cookie)
│   ├── industries/       # Company industries
│   ├── companies/        # Companies (incl. SSRF-safe website scraper)
│   ├── reviews/          # Reviews
│   ├── tags/             # Review tags
│   ├── comments/         # Review comments
│   ├── votes/            # Helpful/unhelpful votes
│   └── reports/          # Content reports
├── shared/               # Shared utilities
│   ├── constants/
│   ├── errors/
│   ├── responses/
│   ├── utils/
│   └── types/
├── routes/               # Route aggregation
└── server.ts             # Entry point
```

## Anonymous Identity System

Every visitor automatically gets an anonymous identity:

1. Visitor makes first request
2. Middleware checks for `anonymous_id` cookie
3. If no cookie: generates a secure random ID, creates a database record, sets HTTP-only cookie
4. If cookie exists: loads the identity from DB, attaches to `req.anonymous`, refreshes `lastSeenAt`
5. Cookie auto-renews on every request

### Cookie Configuration

| Property | Value |
|----------|-------|
| Name | `anonymous_id` |
| HTTP Only | Yes |
| Secure | Yes (production) |
| SameSite | Lax |
| Expiration | 365 days |

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm >= 8
- PostgreSQL running

### Setup

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Edit .env with your database credentials
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/seethroght

# Generate and run migrations
pnpm db:generate
pnpm db:push

# Start development server
pnpm dev
```

### Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start development server with hot reload |
| `pnpm build` | Compile TypeScript to JavaScript |
| `pnpm start` | Start production server |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm lint` | Run ESLint |
| `pnpm format` | Format code with Prettier |
| `pnpm db:generate` | Generate Drizzle migrations |
| `pnpm db:migrate` | Run pending migrations |
| `pnpm db:push` | Push schema to database |
| `pnpm db:studio` | Open Drizzle Studio |
| `pnpm db:reset` | Drop both schemas, replay all migrations, reseed (local only) |

### Resetting the database (dev)

The migration history was squashed into a single baseline (`0000_mean_loa.sql`)
that matches `src/database/schema`, so a fresh database can be rebuilt in one
step:

```bash
pnpm db:reset   # drops schemas "public" and "drizzle", migrates, seeds
```

`public` (application tables) and `drizzle` (the applied-migration ledger) are
dropped together — dropping only `public` leaves ledger rows from the previous
chain behind, which makes the next `pnpm db:migrate` try to re-run migrations
whose tables already exist. The script refuses to run when `NODE_ENV` is
`production`.

Equivalent manual commands, if you prefer to drive it yourself:

```bash
DB="$(grep -E '^DATABASE_URL=' .env | cut -d= -f2-)"
psql "$DB" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
psql "$DB" -c 'DROP SCHEMA drizzle CASCADE;'
pnpm db:migrate && pnpm db:seed
```

`pnpm db:generate` now writes the next incremental migration from the baseline,
so schema changes go back to the normal flow: edit `src/database/schema`, then
`pnpm db:generate` + `pnpm db:migrate`.

### Deploying to production (Render / Vercel)

The server **auto-applies pending migrations at boot**, so the schema always
matches the deployed code — no manual step needed after a deploy.

If a deploy was previously pushed while migrations were pending, the quickest
fix is to run them once against the production database:

```bash
# From the backend directory, with your production DATABASE_URL (Render →
# your Postgres instance → connection string):
DATABASE_URL="postgres://..." pnpm db:migrate
```

Then redeploy (or just restart the service) — the app will migrate on boot
anyway. If the companies list is empty after migrating, re-run the seed:
`DATABASE_URL="postgres://..." pnpm db:seed`.

> **Note on the squashed migration chain.** A database that already ran the old
> migrations 0000–0007 still has its ledger rows in `drizzle.__drizzle_migrations`,
> but those files no longer exist. On boot, `migrate()` finds no applied entry
> for the new baseline and replays it, which fails on the first `CREATE TABLE`
> (the tables are already there). The failure is caught and logged, so the app
> keeps serving, but no further migration will apply.
>
> The baseline is not idempotent, so a production database that must keep its
> data cannot simply be re-migrated. Migrate it into a fresh database instead:
>
> ```bash
> pg_dump --schema=public "$OLD_DATABASE_URL" > data.sql
> psql "$NEW_DATABASE_URL" < data.sql
> DATABASE_URL="$NEW_DATABASE_URL" pnpm db:migrate
> ```
>
> `--schema=public` keeps the old `drizzle` ledger out of the dump, so the new
> one starts clean. For a production database whose data is disposable, run the
> same steps as local: drop both schemas, `pnpm db:migrate`, `pnpm db:seed`.

## API Endpoints

### Health Check

```
GET /api/v1/health
```

Response:
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "status": "healthy",
    "environment": "development",
    "database": { "connected": true },
    "uptime": 123.45,
    "version": "0.1.0",
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Anonymous Identity

```
GET /api/v1/anonymous/me
```

Returns the current anonymous identity (requires cookie).

### Admin Auth

```
POST /api/v1/auth/login
GET  /api/v1/auth/me
POST /api/v1/auth/logout
```

Login sets an httpOnly `admin_token` cookie (24h, SameSite=Lax); `/me` returns the current admin profile; logout clears the cookie. Admin-only routes accept the cookie or a `Authorization: Bearer <jwt>` header.

## API Versioning

All endpoints are under `/api/v1/`. The architecture supports adding v2 routes without restructuring by adding a new route prefix.

## Error Handling

All errors return consistent JSON responses:

```json
{
  "success": false,
  "message": "Error message",
  "errors": { "field": ["validation error"] }
}
```

Stack traces are never exposed in production.

## Rate Limiting

Rate limiter middleware with anonymous identity awareness:

| Endpoint | Limit |
|----------|-------|
| Default | 100 per 15 minutes |
| Review Creation | 3 per day |
| Comments | 20 per day |
| Reactions | 1 per review per day |
| Reports | 10 per day |

Rate limits use `req.anonymous.publicId` as the key when available, falling back to IP.

## Extending

### Adding a new module

```bash
mkdir -p src/modules/your-feature/{controller,service,repository,routes,validation,types}
```

1. Define your Drizzle schema in `src/database/schema/`
2. Create types in `your-feature/types/`
3. Create repository for database operations
4. Create service for business logic
5. Create controller for request handling
6. Create routes with middleware composition
7. Register routes in `src/routes/index.ts`

## Security

- Helmet for HTTP headers
- CORS with whitelisted origins and credentials
- Rate limiting per anonymous identity
- HTTP-only cookies (inaccessible to JavaScript) for anonymous identity and admin auth
- SSRF protection on the company website scraper (DNS pinning + private-range blocking)
- Input validation at the middleware layer
- Parameterized queries via Drizzle ORM (SQL injection protection)
- No sensitive data stored
- Request body size limited to 10kb
