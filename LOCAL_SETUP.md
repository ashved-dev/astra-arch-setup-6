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

For CI, use the same `DATABASE_URL` format as `postgres://postgres:${POSTGRES_PASSWORD}@127.0.0.1:5432/astra_arch_setup_6` with your environment-specific database credentials.

## Docker runtime

1. Build the production image:
   - `docker build -t astra-arch-setup-6-todo .`
2. Start Postgres:
   - `POSTGRES_PASSWORD=postgres docker run -d --name astra-arch-setup-6-postgres -e POSTGRES_DB=astra_arch_setup_6 -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=$POSTGRES_PASSWORD -p 5432:5432 postgres:16-alpine`
3. Apply schema for the containerized app:
   - `DATABASE_URL=postgres://postgres:${POSTGRES_PASSWORD}@host.docker.internal:5432/astra_arch_setup_6 npm run db:migrate`
4. Run the app container:
   - `docker run --rm -p 4173:4173 -e DATABASE_URL=postgres://postgres:${POSTGRES_PASSWORD}@host.docker.internal:5432/astra_arch_setup_6 -e PORT=4173 astra-arch-setup-6-todo`
5. Verify:
   - `curl http://127.0.0.1:4173/`
   - `curl http://127.0.0.1:4173/api/health`
   - `curl http://127.0.0.1:4173/api/todos`

## QA/Coolify compose deployment

Use `docker-compose.qa.yml` for the Coolify QA deployment contract.

Required:
- Provide a generated password in `POSTGRES_PASSWORD` from provider/runtime secrets.
- Do not commit real QA secrets into Git.

Validate the contract with a throwaway non-default value:

- `POSTGRES_PASSWORD=ci_qa_db_password_non_default docker compose -f docker-compose.qa.yml config`

Start both services together with:

- `docker compose -f docker-compose.qa.yml up --build`

Compose exposes the app on `http://127.0.0.1:4173`.
