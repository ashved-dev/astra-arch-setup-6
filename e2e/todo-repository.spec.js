import { expect, test } from '@playwright/test';

import {
  createTodoRepository,
  DATABASE_URL_MISSING_ERROR,
  TODO_RETURNING_COLUMNS,
} from '../src/db/todoRepository.js';

function createStatefulTodoPool(seedRows = []) {
  const rows = [...seedRows];

  return {
    query(queryText, values) {
      if (queryText.includes('INSERT INTO todos')) {
        const [title] = values;
        const row = {
          id: rows.length + 1,
          title,
          complete: false,
          position: 0,
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
        return Promise.resolve({ rows: [current] });
      }

      if (queryText.includes('UPDATE todos\n         SET complete')) {
        const [complete, id] = values;
        const current = rows.find((todo) => todo.id === id);
        if (!current) {
          return Promise.resolve({ rows: [] });
        }

        current.complete = complete;
        return Promise.resolve({ rows: [current] });
      }

      if (queryText.startsWith('DELETE FROM todos')) {
        const [id] = values;
        const rest = rows.filter((todo) => todo.id !== id);
        const removed = rows.length - rest.length;
        rows.splice(0, rows.length, ...rest);
        return Promise.resolve({ rowCount: removed });
      }

      if (queryText.includes(`SELECT ${TODO_RETURNING_COLUMNS} FROM todos`)) {
        return Promise.resolve({ rows: [...rows] });
      }

      return Promise.reject(new Error(`Unexpected query text: ${queryText}`));
    },

    dump() {
      return [...rows];
    },
  };
}

function createErrorPool() {
  return {
    query() {
      return Promise.reject(new Error('query failed'));
    },
  };
}

test('Planned use case: repository contract path returns normalized todo shape', async () => {
  const repository = createTodoRepository({ pool: createStatefulTodoPool() });

  const todo = await repository.create('  Repo contract  ');

  expect(todo).toMatchObject({
    id: 1,
    title: 'Repo contract',
    complete: false,
    position: 0,
  });
  expect(typeof todo.createdAt).toBe('string');
  expect(typeof todo.updatedAt).toBe('string');
});

test('Planned use case: repository update path preserves other fields', async () => {
  const repository = createTodoRepository({
    pool: createStatefulTodoPool([
      {
        id: 5,
        title: 'Original',
        complete: false,
        position: 2,
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      },
    ]),
  });

  const afterTitle = await repository.updateTitle(5, '  Updated Title  ');
  const afterComplete = await repository.updateComplete(5, true);

  expect(afterTitle).toMatchObject({
    id: 5,
    title: 'Updated Title',
    complete: false,
    position: 2,
    createdAt: '2026-06-01T00:00:00.000Z',
  });

  expect(afterComplete).toMatchObject({
    id: 5,
    title: 'Updated Title',
    complete: true,
    position: 2,
  });
});

test('Planned use case: repository delete path removes one row and keeps others', async () => {
  const pool = createStatefulTodoPool([
    { id: 1, title: 'Keep 1', complete: false, position: 1 },
    { id: 2, title: 'Delete me', complete: false, position: 2 },
    { id: 3, title: 'Keep 2', complete: true, position: 3 },
  ]);
  const repository = createTodoRepository({ pool });

  const result = await repository.delete(2);

  expect(result.success).toBe(true);
  expect(result.deletedRows).toBe(1);
  expect(pool.dump().map((todo) => todo.id)).toEqual([1, 3]);
});

test('Planned use case: missing config reports explicit DATABASE_URL error', async () => {
  const originalUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;

  const repository = createTodoRepository();
  try {
    await expect(repository.list()).rejects.toThrow(DATABASE_URL_MISSING_ERROR);
  } finally {
    if (originalUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalUrl;
    }
  }
});

test('Planned use case: existing browser todo flow remains intact', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole('textbox', { name: 'Task title' }).fill('UI stays local-only');
  await page.getByRole('button', { name: 'Add task' }).click();
  await expect(page.getByText('UI stays local-only')).toBeVisible();

  await page.reload();
  await expect(page.getByText('UI stays local-only')).toBeVisible();
  await expect(page.getByText('1 total, 1 active, 0 completed')).toBeVisible();
});

test('Planned use case: repository query errors are surfaced', async () => {
  const repository = createTodoRepository({ pool: createErrorPool() });

  await expect(repository.create('Failing')).rejects.toThrow('Database operation failed: query failed');
});
