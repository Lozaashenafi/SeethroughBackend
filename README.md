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
│   ├── company/          # (future)
│   ├── review/           # (future)
│   ├── reaction/         # (future)
│   ├── comment/          # (future)
│   ├── report/           # (future)
│   ├── moderation/       # (future)
│   └── admin/            # (future)
├── shared/               # Shared utilities
│   ├── constants/
│   ├── errors/
│   ├── responses/
│   ├── utils/
│   ├── validators/
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
- CORS with whitelisted origins
- Rate limiting per anonymous identity
- HTTP-only cookies (inaccessible to JavaScript)
- Input validation at the middleware layer
- Parameterized queries via Drizzle ORM (SQL injection protection)
- No sensitive data stored
- Request body size limited to 10kb
