import { createServer } from 'node:http';
import { test, expect } from '@playwright/test';

import { createTodoApiHandler } from '../src/api/todoApi.js';

function startApiServer(repository) {
  const handler = createTodoApiHandler({ repository });
  const server = createServer((request, response) => {
    handler(request, response).catch((error) => {
      response.statusCode = 500;
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.end(
        JSON.stringify({
          error: 'UNEXPECTED_ERROR',
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    });
  });

  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address !== 'object') {
        reject(new Error('Failed to start API test server'));
        return;
      }

      resolve({
        url: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise((done) => {
            server.close(() => done());
          }),
      });
    });
  });
}

function createStatefulRepository(seedRows = []) {
  const rows = [...seedRows];
  let nextId = seedRows.length + 1;

  return {
    async list() {
      return [...rows].sort((a, b) => a.position - b.position || a.id - b.id);
    },
    async create(title) {
      const todo = {
        id: nextId++,
        title,
        complete: false,
        position: 0,
        createdAt: '2026-06-26T00:00:00.000Z',
        updatedAt: '2026-06-00T00:00:00.000Z',
      };
      rows.push(todo);
      return { ...todo };
    },
    async updateTitle(id, title) {
      const target = rows.find((todo) => todo.id === id);
      if (!target) {
        return null;
      }

      target.title = title;
      target.updatedAt = '2026-06-26T01:00:00.000Z';
      return { ...target };
    },
    async updateComplete(id, complete) {
      const target = rows.find((todo) => todo.id === id);
      if (!target) {
        return null;
      }

      target.complete = complete;
      target.updatedAt = '2026-06-26T01:00:00.000Z';
      return { ...target };
    },
    async delete(id) {
      const nextLength = rows.length;
      const nextRows = rows.filter((todo) => todo.id !== id);
      rows.splice(0, rows.length, ...nextRows);

      const deletedRows = nextLength - nextRows.length;
      return {
        success: deletedRows > 0,
        deletedRows,
      };
    },
    getRows() {
      return [...rows];
    },
  };
}

test.describe('Todo API endpoints', () => {
  let api;

  test.beforeEach(async () => {
    api = await startApiServer(createStatefulRepository());
  });

  test.afterEach(async () => {
    await api.close();
  });

  test('Planned use case 1: health endpoint returns OK for local smoke checks', async ({ request }) => {
    const response = await request.get(`${api.url}/api/health`);
    const body = await response.json();

    expect(response.status()).toBe(200);
    expect(body).toEqual({ ok: true });
  });

  test('Planned use case 2: creating a todo returns normalized response', async ({ request }) => {
    const response = await request.post(`${api.url}/api/todos`, {
      data: { title: '  API seeded task  ' },
      headers: { 'content-type': 'application/json' },
    });
    const body = await response.json();

    expect(response.status()).toBe(201);
    expect(body).toMatchObject({
      id: 1,
      title: 'API seeded task',
      complete: false,
      completed: false,
    });
    expect(typeof body.createdAt).toBe('string');
    expect(typeof body.updatedAt).toBe('string');
  });

  test('Planned use case 3: listing todos returns deterministic ordering', async ({ request }) => {
    api = await startApiServer(
      createStatefulRepository([
        { id: 3, title: 'Third', complete: true, position: 2, createdAt: null, updatedAt: null },
        { id: 1, title: 'First', complete: false, position: 1, createdAt: null, updatedAt: null },
        { id: 2, title: 'Second', complete: false, position: 3, createdAt: null, updatedAt: null },
      ]),
    );

    const response = await request.get(`${api.url}/api/todos`);
    const body = await response.json();

    expect(response.status()).toBe(200);
    expect(body.map((todo) => todo.id)).toEqual([1, 3, 2]);
  });

  test('Planned use case 4: patch updates title/completed fields and rejects unsupported fields', async ({ request }) => {
    await request.post(`${api.url}/api/todos`, {
      data: { title: 'Original title' },
      headers: { 'content-type': 'application/json' },
    });

    const updateResponse = await request.patch(`${api.url}/api/todos/1`, {
      data: { title: 'Updated title', complete: true },
      headers: { 'content-type': 'application/json' },
    });
    const updateBody = await updateResponse.json();

    expect(updateResponse.status()).toBe(200);
    expect(updateBody).toMatchObject({
      id: 1,
      title: 'Updated title',
      complete: true,
      completed: true,
    });

    const invalidResponse = await request.patch(`${api.url}/api/todos/1`, {
      data: { title: 'Another', isFavorite: true },
      headers: { 'content-type': 'application/json' },
    });
    const invalidBody = await invalidResponse.json();

    expect(invalidResponse.status()).toBe(400);
    expect(invalidBody.error).toBe('VALIDATION_ERROR');
  });

  test('Planned use case 5: invalid empty title returns validation error without write', async ({ request }) => {
    const createResponse = await request.post(`${api.url}/api/todos`, {
      data: { title: '   ' },
      headers: { 'content-type': 'application/json' },
    });
    const createBody = await createResponse.json();

    expect(createResponse.status()).toBe(400);
    expect(createBody.error).toBe('VALIDATION_ERROR');

    await request.post(`${api.url}/api/todos`, {
      data: { title: 'Persisted' },
      headers: { 'content-type': 'application/json' },
    });

    const patchResponse = await request.patch(`${api.url}/api/todos/1`, {
      data: { title: '   ' },
      headers: { 'content-type': 'application/json' },
    });
    const patchBody = await patchResponse.json();

    expect(patchResponse.status()).toBe(400);
    expect(patchBody.error).toBe('VALIDATION_ERROR');

    const listResponse = await request.get(`${api.url}/api/todos`);
    const todos = await listResponse.json();
    expect(todos).toHaveLength(1);
    expect(todos[0].title).toBe('Persisted');
  });

  test('Planned use case 6: deleting unknown todo returns not found error', async ({ request }) => {
    const response = await request.delete(`${api.url}/api/todos/999`);
    const body = await response.json();

    expect(response.status()).toBe(404);
    expect(body.error).toBe('NOT_FOUND');
  });

  test('Planned use case 7: existing browser todo flow remains unchanged', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.getByRole('textbox', { name: 'Task title' }).fill('UI remains local');
    await page.getByRole('button', { name: 'Add task' }).click();
    await expect(page.getByText('UI remains local')).toBeVisible();

    await page.reload();
    await expect(page.getByText('UI remains local')).toBeVisible();
  });
});
