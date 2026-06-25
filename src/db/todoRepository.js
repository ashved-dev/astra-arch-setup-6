const DATABASE_URL_MISSING_ERROR =
  'DATABASE_URL is required for Postgres access. Set DATABASE_URL before using todo repository operations.';
const TODO_TITLE_ERROR = 'Todo title must be a non-empty string.';

function sanitizeTodoTitle(rawTitle) {
  const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
  if (!title) {
    throw new Error(TODO_TITLE_ERROR);
  }

  return title;
}

function toNumber(value, fallback = 0) {
  const asNumber = Number(value);
  return Number.isFinite(asNumber) ? asNumber : fallback;
}

function toIsoDate(value) {
  if (value == null) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function normalizeTodo(row) {
  if (!row || typeof row !== 'object') {
    return null;
  }

  const id = toNumber(row.id, NaN);
  if (!Number.isInteger(id) || id < 1) {
    return null;
  }

  const title = typeof row.title === 'string' ? row.title.trim() : '';
  if (!title) {
    return null;
  }

  const completeRaw = row.complete ?? row.completed;
  const complete = completeRaw === true || completeRaw === false ? completeRaw : false;
  const position = Number.isInteger(toNumber(row.position, 0)) ? Math.trunc(toNumber(row.position, 0)) : 0;
  const createdAt = toIsoDate(row.createdAt ?? row.created_at);
  const updatedAt = toIsoDate(row.updatedAt ?? row.updated_at);

  const normalized = {
    id,
    title,
    complete,
    position,
    createdAt,
    updatedAt,
  };

  return normalized;
}

function rowsToTodos(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((row) => normalizeTodo(row))
    .filter((value) => value !== null);
}

export function hasDatabaseUrl(env = process.env) {
  return typeof env.DATABASE_URL === 'string' && env.DATABASE_URL.trim().length > 0;
}

export function ensureDatabaseUrl(env = process.env) {
  if (!hasDatabaseUrl(env)) {
    throw new Error(DATABASE_URL_MISSING_ERROR);
  }

  return env.DATABASE_URL;
}

function formatTodoSelect(columns = '*') {
  return `SELECT ${columns} FROM todos ORDER BY position ASC, id ASC`;
}

const TODO_RETURNING_COLUMNS =
  'id, title, complete, position, created_at AS "createdAt", updated_at AS "updatedAt"';

export function createTodoRepository({ pool } = {}) {
  let resolvedPool = pool;
  let initializingPromise = null;

  async function getPool() {
    if (resolvedPool) {
      return resolvedPool;
    }

    if (!initializingPromise) {
      initializingPromise = (async () => {
        const databaseUrl = ensureDatabaseUrl();
        const { Pool } = await import('pg');
        resolvedPool = new Pool({ connectionString: databaseUrl });
        return resolvedPool;
      })();
    }

    return initializingPromise;
  }

  async function query(text, values = []) {
    const activePool = await getPool();
    if (!activePool || typeof activePool.query !== 'function') {
      throw new Error('Database pool must provide a query method.');
    }

    try {
      return await activePool.query(text, values);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Database operation failed: ${message}`);
    }
  }

  return {
    async list() {
      const result = await query(formatTodoSelect(TODO_RETURNING_COLUMNS));
      const rows = rowsToTodos(result?.rows);
      return rows;
    },

    async create(title) {
      const safeTitle = sanitizeTodoTitle(title);
      const result = await query(
        `INSERT INTO todos (title, complete, position) VALUES ($1, $2, $3) RETURNING ${TODO_RETURNING_COLUMNS}`,
        [safeTitle, false, 0],
      );
      const inserted = rowsToTodos(result?.rows)[0] || null;
      return inserted;
    },

    async updateTitle(id, title) {
      const safeTitle = sanitizeTodoTitle(title);
      const safeId = toNumber(id, NaN);
      if (!Number.isInteger(safeId) || safeId < 1) {
        throw new Error('Todo id must be a positive integer.');
      }

      const result = await query(
        `UPDATE todos
         SET title = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING ${TODO_RETURNING_COLUMNS}`,
        [safeTitle, safeId],
      );
      return rowsToTodos(result?.rows)[0] || null;
    },

    async updateComplete(id, complete) {
      const safeId = toNumber(id, NaN);
      if (!Number.isInteger(safeId) || safeId < 1) {
        throw new Error('Todo id must be a positive integer.');
      }

      if (complete !== true && complete !== false) {
        throw new Error('Todo complete state must be true or false.');
      }

      const result = await query(
        `UPDATE todos
         SET complete = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING ${TODO_RETURNING_COLUMNS}`,
        [complete, safeId],
      );
      return rowsToTodos(result?.rows)[0] || null;
    },

    async delete(id) {
      const safeId = toNumber(id, NaN);
      if (!Number.isInteger(safeId) || safeId < 1) {
        throw new Error('Todo id must be a positive integer.');
      }

      const result = await query('DELETE FROM todos WHERE id = $1', [safeId]);
      return {
        success: !!(result && Number.isInteger(result.rowCount) ? result.rowCount > 0 : false),
        deletedRows: result?.rowCount ?? 0,
      };
    },
  };
}

export { normalizeTodo, TODO_RETURNING_COLUMNS, DATABASE_URL_MISSING_ERROR, TODO_TITLE_ERROR };
