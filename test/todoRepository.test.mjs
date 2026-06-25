import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TODO_RETURNING_COLUMNS,
  createTodoRepository,
  DATABASE_URL_MISSING_ERROR,
  ensureDatabaseUrl,
} from '../src/db/todoRepository.js';

function createFakeTodoPool(seedRows = []) {
  const rows = [...seedRows];

  return {
    query(queryText, values) {
      if (queryText.includes('INSERT INTO todos')) {
        const [title, complete, position] = values;
        const row = {
          id: rows.length + 1,
          title,
          complete,
          position,
          createdAt: '2026-06-26T00:00:00.000Z',
          updatedAt: '2026-06-26T00:00:00.000Z',
        };
        rows.push(row);
        return Promise.resolve({ rows: [row] });
      }

      if (queryText.includes('UPDATE todos\n         SET title')) {
        const [title, id] = values;
        const current = rows.find((todo) => todo.id === id);
        if (!current) {
          return Promise.resolve({ rows: [] });
        }

        current.title = title;
        current.updatedAt = '2026-06-26T01:00:00.000Z';
        return Promise.resolve({ rows: [current] });
      }

      if (queryText.includes('UPDATE todos\n         SET complete')) {
        const [complete, id] = values;
        const current = rows.find((todo) => todo.id === id);
        if (!current) {
          return Promise.resolve({ rows: [] });
        }

        current.complete = complete;
        current.updatedAt = '2026-06-26T01:00:00.000Z';
        return Promise.resolve({ rows: [current] });
      }

      if (queryText.startsWith('DELETE FROM todos')) {
        const [id] = values;
        const nextLength = rows.length;
        const remainder = rows.filter((todo) => todo.id !== id);
        rows.splice(0, rows.length, ...remainder);
        const removed = nextLength - remainder.length;
        return Promise.resolve({ rowCount: removed });
      }

      if (queryText.includes(`SELECT ${TODO_RETURNING_COLUMNS} FROM todos`)) {
        return Promise.resolve({ rows: [...rows] });
      }

      return Promise.reject(new Error(`Unexpected query: ${queryText}`));
    },
    rows,
    getRows() {
      return rows;
    },
  };
}

function createErrorPool() {
  return {
    query() {
      return Promise.reject(new Error('pool failed'));
    },
  };
}

test('list returns normalized todos and strips malformed rows', async () => {
  const pool = createFakeTodoPool([
    { id: 1, title: '  Trim me  ', complete: false, position: 2 },
    { id: 'bad-id', title: 'Bad id', complete: false, position: 1 },
    { id: 3, title: ' ', complete: true, position: 0 },
  ]);
  const repository = createTodoRepository({ pool });

  const todos = await repository.list();

  assert.deepEqual(todos, [
    {
      id: 1,
      title: 'Trim me',
      complete: false,
      position: 2,
      createdAt: null,
      updatedAt: null,
    },
  ]);
  assert.equal(pool.rows.length, 3);
});

test('create trims and normalizes title and returns normalized row', async () => {
  const pool = createFakeTodoPool();
  const repository = createTodoRepository({ pool });

  const todo = await repository.create('   Persisted todo   ');

  assert.deepEqual(todo, {
    id: 1,
    title: 'Persisted todo',
    complete: false,
    position: 0,
    createdAt: '2026-06-26T00:00:00.000Z',
    updatedAt: '2026-06-26T00:00:00.000Z',
  });
  assert.equal(pool.getRows().length, 1);
});

test('create rejects blank title with validation error', async () => {
  const repository = createTodoRepository({ pool: createFakeTodoPool() });

  await assert.rejects(
    () => repository.create('   '),
    { message: 'Todo title must be a non-empty string.' },
  );
});

test('update title and completion preserve unrelated fields', async () => {
  const pool = createFakeTodoPool([
    {
      id: 10,
      title: 'Old title',
      complete: false,
      position: 7,
      createdAt: '2026-06-20T00:00:00.000Z',
      updatedAt: '2026-06-20T00:00:00.000Z',
    },
  ]);
  const repository = createTodoRepository({ pool });

  const titleUpdated = await repository.updateTitle(10, '   Renamed   ');
  const completedUpdated = await repository.updateComplete(10, true);

  assert.equal(titleUpdated.id, 10);
  assert.equal(titleUpdated.title, 'Renamed');
  assert.equal(titleUpdated.complete, false);
  assert.equal(titleUpdated.position, 7);
  assert.equal(titleUpdated.createdAt, '2026-06-20T00:00:00.000Z');

  assert.equal(completedUpdated.id, 10);
  assert.equal(completedUpdated.title, 'Renamed');
  assert.equal(completedUpdated.complete, true);
  assert.equal(completedUpdated.position, 7);
});

test('delete reports success without affecting unrelated rows', async () => {
  const pool = createFakeTodoPool([
    { id: 1, title: 'Keep', complete: false, position: 1 },
    { id: 2, title: 'Delete', complete: true, position: 2 },
    { id: 3, title: 'Keep too', complete: false, position: 3 },
  ]);
  const repository = createTodoRepository({ pool });

  const result = await repository.delete(2);

  assert.equal(result.success, true);
  assert.equal(result.deletedRows, 1);
  assert.deepEqual(
    pool
      .getRows()
      .map((todo) => todo.id)
      .sort((a, b) => a - b),
    [1, 3],
  );
});

test('missing DATABASE_URL is rejected before running database query', async () => {
  const originalUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;

  const repository = createTodoRepository();
  try {
    await assert.rejects(
      () => repository.list(),
      { message: DATABASE_URL_MISSING_ERROR },
    );
  } finally {
    if (originalUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalUrl;
    }
  }
});

test('database query errors are surfaced as repository errors', async () => {
  const repository = createTodoRepository({ pool: createErrorPool() });

  await assert.rejects(
    () => repository.list(),
    { message: 'Database operation failed: pool failed' },
  );
});

test('ensureDatabaseUrl throws explicit config error when missing', () => {
  const originalUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;

  try {
    assert.throws(() => ensureDatabaseUrl(), { message: DATABASE_URL_MISSING_ERROR });
  } finally {
    if (originalUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalUrl;
    }
  }
});
