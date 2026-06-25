import { createReadStream } from 'node:fs';
import { access, readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { createTodoApiHandler } from '../api/todoApi.js';
import { createTodoRepository, ensureDatabaseUrl } from '../db/todoRepository.js';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT ?? '4173');
const HOST = process.env.HOST ?? '0.0.0.0';
const DIST_ROOT = path.resolve(process.cwd(), 'dist');
const DIST_INDEX_PATH = path.join(DIST_ROOT, 'index.html');
const MIGRATION_PATH = path.join(process.cwd(), 'db', 'migrations', '001_create_todos.sql');

function parsePort() {
  if (Number.isInteger(PORT) && PORT > 0) {
    return PORT;
  }

  return 4173;
}

function isApiRequest(pathname) {
  return pathname.startsWith('/api');
}

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.txt': 'text/plain; charset=utf-8',
    '.ico': 'image/x-icon',
  };

  return map[extension] ?? 'application/octet-stream';
}

function toAbsoluteStaticPath(urlPath) {
  const trimmed = urlPath === '/' ? '/index.html' : urlPath;
  let decoded;

  let normalized;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch (_error) {
    return null;
  }

  if (decoded.includes('..')) {
    return null;
  }

  normalized = path.normalize(decoded);
  if (normalized.includes('..')) {
    return null;
  }

  const relative = normalized.startsWith('/') ? normalized.slice(1) : normalized;
  const candidate = path.join(DIST_ROOT, relative);

  if (!candidate.startsWith(`${DIST_ROOT}${path.sep}`) && candidate !== DIST_ROOT) {
    return null;
  }

  return candidate;
}

async function ensureMigrationApplied() {
  const databaseUrl = ensureDatabaseUrl();

  try {
    // Validate URL shape early for a clearer startup failure.
    new URL(databaseUrl);
  } catch (_error) {
    throw new Error('DATABASE_URL is invalid. Set DATABASE_URL to a valid Postgres URL.');
  }

  const migrationSql = await readFile(MIGRATION_PATH, 'utf8');
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    await pool.query(migrationSql);
  } finally {
    await pool.end();
  }
}

function createStaticResponseHandler() {
  return async function staticHandler(request, response) {
    if (!request.url) {
      response.statusCode = 404;
      response.setHeader('content-type', 'text/plain; charset=utf-8');
      response.end('Not Found');
      return;
    }

    const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
    const requestPath = url.pathname;
    const extension = path.extname(requestPath);
    const candidatePath = toAbsoluteStaticPath(requestPath);
    const shouldFallbackToIndex = !candidatePath || requestPath === '/' || extension.length === 0;
    const staticPath = shouldFallbackToIndex ? DIST_INDEX_PATH : candidatePath;

    try {
      const fileInfo = await stat(staticPath);
      if (!fileInfo.isFile()) {
        throw new Error('Static target is not a file.');
      }

      await access(staticPath);
      response.statusCode = 200;
      response.setHeader('content-type', getContentType(staticPath));
      createReadStream(staticPath).pipe(response);
    } catch (_error) {
      response.statusCode = candidatePath ? 404 : 200;
      response.setHeader('content-type', 'text/plain; charset=utf-8');
      response.end(candidatePath ? 'Not Found' : 'Unable to load page assets.');
    }
  };
}

function createRuntimeHandler() {
  const todoRepository = createTodoRepository();
  const todoApiHandler = createTodoApiHandler({ repository: todoRepository });
  const serveStatic = createStaticResponseHandler();

  return async function runtimeHandler(request, response) {
    if (!request.url) {
      response.statusCode = 500;
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.end(JSON.stringify({ error: 'INVALID_REQUEST', message: 'Request URL is required.' }));
      return;
    }

    const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);

  if (isApiRequest(url.pathname)) {
      await todoApiHandler(request, response);
      return;
    }

    await serveStatic(request, response);
  };
}

function startServer() {
  const port = parsePort();
  const handler = createRuntimeHandler();
  const server = createServer(async (request, response) => {
    try {
      await handler(request, response);
    } catch (error) {
      response.statusCode = 500;
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.end(
        JSON.stringify({
          error: 'UNEXPECTED_ERROR',
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  });

  server.listen(port, HOST, () => {
    console.log(`Todo runtime server listening on http://${HOST}:${port}`);
    console.log('DATABASE_URL configured:', Boolean(process.env.DATABASE_URL));
  });
}

async function boot() {
  try {
    await ensureMigrationApplied();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Cannot start runtime server: ${message}`);
    process.exit(1);
  }

  startServer();
}

const isDirectInvocation = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectInvocation) {
  boot();
}

export { boot, createRuntimeHandler, toAbsoluteStaticPath, getContentType, startServer };
