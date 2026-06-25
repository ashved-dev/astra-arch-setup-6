import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { test, expect } from '@playwright/test';

test.describe.configure({ timeout: 240000 });

const PORT = 4177;
const APP_URL = `http://127.0.0.1:${PORT}`;
const APP_CONTAINER_PORT = 4173;
const IMAGE_TAG = `astra-arch-setup-6-runtime-${Date.now()}`;
const SUFFIX = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
const NETWORK = `astra-arch-setup-6-net-${SUFFIX}`;
const POSTGRES_CONTAINER = `astra-arch-setup-6-postgres-${SUFFIX}`;
const APP_CONTAINER = `astra-arch-setup-6-app-${SUFFIX}`;
const DB_NAME = 'astra_arch_setup_6';
const DATABASE_URL = `postgres://postgres:postgres@${POSTGRES_CONTAINER}:5432/${DB_NAME}`;

let dockerAvailable = false;

function runCommand(args, options = {}) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    stdio: options.stdio ?? 'pipe',
  });

  if (options.allowFailure) {
    return result;
  }

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
    throw new Error(`docker ${args.join(' ')} failed${output ? `: ${output}` : ''}`);
  }

  return result;
}

function waitForMs(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForPostgresReadiness() {
  const startedAt = Date.now();
  const timeoutMs = 60_000;
  let lastError = 'Postgres readiness not observed.';

  while (Date.now() - startedAt < timeoutMs) {
    const ready = runCommand([
      'exec',
      POSTGRES_CONTAINER,
      'pg_isready',
      '-U',
      'postgres',
      '-d',
      DB_NAME,
    ], {
      allowFailure: true,
    });

    if (ready.status === 0) {
      return;
    }

    lastError = `${ready.stdout || ''}${ready.stderr || ''}`.trim() || `exit code ${ready.status}`;
    await waitForMs(500);
  }

  throw new Error(`PostgreSQL container did not become ready at ${POSTGRES_CONTAINER}: ${lastError}`);
}

async function runMigrationWithRetry(databaseUrl) {
  const attempts = 12;
  const delayMs = 750;
  let lastResult;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    lastResult = runCommand([
      'run',
      '--rm',
      '--network',
      NETWORK,
      '-e',
      `DATABASE_URL=${databaseUrl}`,
      IMAGE_TAG,
      'node',
      'scripts/db-migrate.mjs',
    ], {
      allowFailure: true,
    });

    if (lastResult.status === 0) {
      return;
    }

    if (attempt < attempts) {
      await waitForMs(delayMs * attempt);
      continue;
    }
  }

  const migrationError = `${lastResult?.stdout || ''}${lastResult?.stderr || ''}`.trim() || 'no command output';
  throw new Error(`Postgres migration did not complete in ${attempts} attempts: ${migrationError}`);
}

async function waitForEndpoint(path) {
  const endpoint = `${APP_URL}${path}`;
  const startedAt = Date.now();
  const timeoutMs = 45_000;
  let lastError;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(endpoint);
      if (response.ok) {
        return true;
      }
      lastError = `status ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await waitForMs(500);
  }

  throw new Error(`Endpoint ${endpoint} not available in ${timeoutMs}ms; last error: ${lastError}`);
}

function hasDockerAvailable() {
  try {
    runCommand(['--version'], { stdio: 'ignore' });
    return true;
  } catch (_error) {
    return false;
  }
}

async function clearTodos(request) {
  const listResponse = await request.get(`${APP_URL}/api/todos`);
  if (!listResponse.ok()) {
    return;
  }

  const rows = await listResponse.json().catch(() => []);
  if (!Array.isArray(rows)) {
    return;
  }

  for (const row of rows) {
    if (typeof row?.id === 'number' && Number.isFinite(row.id)) {
      await request.delete(`${APP_URL}/api/todos/${row.id}`);
    }
  }
}

test.describe('Docker runtime smoke', () => {
  test.beforeEach(async ({ request }) => {
    if (!dockerAvailable) {
      test.skip('Docker CLI is not available in this environment.');
    }

    await clearTodos(request);
  });

  test.beforeAll(async () => {
    dockerAvailable = hasDockerAvailable();
    if (!dockerAvailable) {
      return;
    }

    runCommand(['build', '-t', IMAGE_TAG, '.']);
    runCommand([
      'network',
      'create',
      NETWORK,
    ]);
    runCommand([
      'run',
      '-d',
      '--name',
      POSTGRES_CONTAINER,
      '--network',
      NETWORK,
      '-e',
      'POSTGRES_DB=astra_arch_setup_6',
      '-e',
      'POSTGRES_USER=postgres',
      '-e',
      'POSTGRES_PASSWORD=postgres',
      'postgres:16-alpine',
    ]);

    await waitForPostgresReadiness();
    await runMigrationWithRetry(DATABASE_URL);

    runCommand([
      'run',
      '-d',
      '--name',
      APP_CONTAINER,
      '--network',
      NETWORK,
      '-e',
      `DATABASE_URL=${DATABASE_URL}`,
      '-p',
      `${PORT}:${APP_CONTAINER_PORT}`,
      IMAGE_TAG,
    ]);

    await waitForEndpoint('/api/health');
  });

  test.afterAll(() => {
    if (!dockerAvailable) {
      return;
    }

    runCommand(['rm', '-f', APP_CONTAINER], { allowFailure: true });
    runCommand(['rm', '-f', POSTGRES_CONTAINER], { allowFailure: true });
    runCommand(['network', 'rm', NETWORK], { allowFailure: true });
    runCommand(['rmi', '-f', IMAGE_TAG], { allowFailure: true, stdio: 'ignore' });
  });

  test('Docker smoke path: app root returns the app shell', async ({ request }) => {
    test.skip(!dockerAvailable, 'Docker CLI is not available in this environment.');
    const response = await request.get(`${APP_URL}/`);
    const body = await response.text();

    expect(response.status()).toBe(200);
    expect(body).toContain('<title>');
    expect(body).toContain('Astra Todo');
  });

  test('Database smoke path: health endpoint and todos list respond', async ({ request }) => {
    test.skip(!dockerAvailable, 'Docker CLI is not available in this environment.');
    const health = await request.get(`${APP_URL}/api/health`);
    const healthPayload = await health.json();
    expect(health.status()).toBe(200);
    expect(healthPayload).toEqual({ ok: true });

    const list = await request.get(`${APP_URL}/api/todos`);
    const todos = await list.json();
    expect(list.status()).toBe(200);
    expect(Array.isArray(todos)).toBe(true);
  });

  test('Persistence path: todo survives container restart and remains in Postgres', async ({ request }) => {
    test.skip(!dockerAvailable, 'Docker CLI is not available in this environment.');
    await request.post(`${APP_URL}/api/todos`, {
      data: { title: 'Docker persisted todo' },
      headers: { 'content-type': 'application/json' },
    });

    let list = await request.get(`${APP_URL}/api/todos`);
    const beforeRows = await list.json();
    expect(beforeRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Docker persisted todo',
          complete: false,
        }),
      ]),
    );

    runCommand(['restart', APP_CONTAINER]);
    await waitForEndpoint('/api/health');

    list = await request.get(`${APP_URL}/api/todos`);
    const afterRows = await list.json();
    expect(afterRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Docker persisted todo',
          complete: false,
        }),
      ]),
    );
  });

  test('Configuration failure path: missing DATABASE_URL prevents startup', async () => {
    test.skip(!dockerAvailable, 'Docker CLI is not available in this environment.');
    const result = runCommand(
      ['run', '--rm', '--name', `${APP_CONTAINER}-invalid`, IMAGE_TAG],
      { allowFailure: true },
    );
    const output = `${result.stdout || ''}${result.stderr || ''}`;

    expect(result.status).not.toBe(0);
    expect(output).toContain('DATABASE_URL is required for Postgres access');
  });

  test('Documentation path: local setup includes docker instructions and no secrets', async () => {
    const docs = fs.readFileSync('LOCAL_SETUP.md', 'utf8');
    expect(docs).toContain('docker build -t astra-arch-setup-6-todo .');
    expect(docs).toContain('docker compose up --build');
    expect(docs).not.toContain('postgres://postgres:postgres:');
    expect(docs).toContain('DATABASE_URL');
  });
});
