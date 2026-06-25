# Local setup for Postgres-backed todo app

1. Copy `.env.example` to `.env` and configure `DATABASE_URL`.
2. Install dependencies: `npm ci`.
3. Apply migration: `npm run db:migrate`.
4. Start the full API + frontend stack:
   - `npm run dev:stack`
   - Frontend: `http://127.0.0.1:4173`
   - API: `http://127.0.0.1:4174`
5. Run checks:
   - `npm run lint`
   - `npm run build`
   - `npm run test`
   - `npm run e2e`

For CI, use the same `DATABASE_URL` format as `postgres://postgres:postgres@127.0.0.1:5432/astra_arch_setup_6` with your environment-specific database credentials.
