# OPERATIONS

## Bootstrapping (Dev)
1. Copy `.env.example` → `.env` and fill minimally: `DATABASE_URL`, `REPLIT_DOMAINS`, `REPL_ID`, `SESSION_SECRET`, `ADMIN_EMAILS`.
2. `npm install`
3. `npm run env:check`
4. `npm run db:migrate`
5. `npm run seed`
6. Click **Run** (equivalent to `npm run dev`).

## Observability
- Liveness: `GET /healthz` → `200 ok`
- Readiness: `GET /readyz` → DB check (`200` or `503`)
- Docs: `GET /api/docs` (ReDoc), JSON at `GET /api/json`.

## Errors
Standard JSON:
```json
{ "code": "string", "message": "string", "details": {}, "requestId": "uuid" }
```

## Auth
- **Real**: Replit OIDC session (server/replitAuth.ts).
- **Tests**: header auth enabled when TEST_AUTH=1, using X-Test-User + X-Test-Role.

## DB Admin
- `npm run db:migrate` – push migrations
- `npm run seed` – promotes ADMIN_EMAILS to admin
- `npm run smoke` – health/doc/db quick check
- `npm run coverage` – test coverage

## Safety
- Do not run scripts/dbReset.ts in production.
- Do not modify server/paypal.ts.
