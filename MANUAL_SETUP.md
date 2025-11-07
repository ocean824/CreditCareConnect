# Manual Setup Steps

## Package.json Scripts Update

The following scripts need to be added manually to `package.json`:

```json
{
  "scripts": {
    "dev": "NODE_ENV=development tsx server/index.ts",
    "build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
    "start": "NODE_ENV=production node dist/index.js",
    "check": "tsc --noEmit",
    "db:migrate": "drizzle-kit push",
    "db:generate": "drizzle-kit generate",
    "db:push": "drizzle-kit push",
    "seed": "tsx scripts/seed.ts",
    "smoke": "tsx scripts/smoke-test.ts",
    "env:check": "tsx scripts/envDoctor.ts",
    "test": "vitest run",
    "test:e2e": "cross-env TEST_AUTH=1 vitest run tests/e2e --reporter=verbose --passWithNoTests",
    "coverage": "vitest run --coverage"
  }
}
```

## New Scripts Explained

- `seed`: Promotes users in ADMIN_EMAILS environment variable to admin role
- `smoke`: Runs health checks on /healthz, /readyz, /api/docs, and /api/json
- `env:check`: Validates all required environment variables are set
- `test`: Runs all unit tests with Vitest
- `test:e2e`: Runs end-to-end tests with TEST_AUTH=1 mode enabled
- `coverage`: Generates test coverage report

## Usage

1. Open `package.json`
2. Replace the entire `scripts` section with the one above
3. Save the file
4. Run `npm run env:check` to verify your environment
5. Run `npm run seed` to promote admin users
6. Run `npm run smoke` to verify everything is working
