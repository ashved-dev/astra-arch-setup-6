import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';

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
        reject(new Error('Failed to start test API server'));
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
      return [...rows];
    },
    async create(title) {
      const todo = {
        id: nextId++,
        title,
        complete: false,
        position: 0,
        createdAt: '2026-06-26T00:00:00.000Z',
        updatedAt: '2026-06-26T00:00:00.000Z',
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

function createErrorRepository() {
  return {
    async list() {
      throw new Error('query failed');
    },
    async create() {
      throw new Error('query failed');
    },
    async updateTitle() {
      throw new Error('query failed');
    },
    async updateComplete() {
      throw new Error('query failed');
    },
    async delete() {
      throw new Error('query failed');
    },
  };
}

test('health endpoint returns OK', async () => {
  const server = await startApiServer(createStatefulRepository());
  try {
    const response = await fetch(`${server.url}/api/health`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload, { ok: true });
  } finally {
    await server.close();
  }
});

test('POST /api/todos creates normalized todo response', async () => {
  const server = await startApiServer(createStatefulRepository());
  try {
    const response = await fetch(`${server.url}/api/todos`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '  API task  ' }),
    });
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.equal(payload.id, 1);
    assert.equal(payload.title, 'API task');
    assert.equal(payload.complete, false);
    assert.equal(payload.completed, false);
    assert.equal(payload.createdAt, '2026-06-26T00:00:00.000Z');
    assert.equal(payload.updatedAt, '2026-06-26T00:00:00.000Z');
  } finally {
    await server.close();
  }
});

test('GET /api/todos returns deterministic order', async () => {
  const repository = createStatefulRepository([
    { id: 3, title: 'Third', complete: true, position: 2, createdAt: null, updatedAt: null },
    { id: 1, title: 'First', complete: false, position: 1, createdAt: null, updatedAt: null },
    { id: 2, title: 'Second', complete: false, position: 3, createdAt: null, updatedAt: null },
  ]);
  repository.list = async () => repository.getRows().sort((a, b) => a.position - b.position || a.id - b.id);

  const server = await startApiServer(repository);
  try {
    const response = await fetch(`${server.url}/api/todos`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload.map((todo) => todo.id), [1, 3, 2]);
  } finally {
    await server.close();
  }
});

test('PATCH validates supported fields and updates title/completed', async () => {
  const repository = createStatefulRepository([{ id: 1, title: 'Old', complete: false, position: 1 }]);
  const server = await startApiServer(repository);
  try {
    const response = await fetch(`${server.url}/api/todos/1`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'New title', completed: true }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.id, 1);
    assert.equal(payload.title, 'New title');
    assert.equal(payload.complete, true);
    assert.equal(payload.completed, true);

    const invalidResponse = await fetch(`${server.url}/api/todos/1`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Ignored', extra: false }),
    });
    const invalidPayload = await invalidResponse.json();

    assert.equal(invalidResponse.status, 400);
    assert.equal(invalidPayload.error, 'VALIDATION_ERROR');
  } finally {
    await server.close();
  }
});

test('POST and PATCH reject blank titles and do not mutate', async () => {
  const repository = createStatefulRepository();
  const server = await startApiServer(repository);
  try {
    const createResponse = await fetch(`${server.url}/api/todos`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '   ' }),
    });

    assert.equal(createResponse.status, 400);
    const createPayload = await createResponse.json();
    assert.equal(createPayload.error, 'VALIDATION_ERROR');

    const createTodo = await repository.create('Persisted');
    assert.equal(createTodo.id, 1);

    const updateResponse = await fetch(`${server.url}/api/todos/1`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '   ', complete: false }),
    });
    const updatePayload = await updateResponse.json();

    assert.equal(updateResponse.status, 400);
    assert.equal(updatePayload.error, 'VALIDATION_ERROR');

    const listResponse = await fetch(`${server.url}/api/todos`);
    const listPayload = await listResponse.json();

    assert.equal(listPayload.length, 1);
    assert.equal(listPayload[0].title, 'Persisted');
  } finally {
    await server.close();
  }
});

test('PATCH validates mixed title and complete payload before mutating and returns validation errors for invalid complete', async () => {
  const repository = createStatefulRepository([{ id: 1, title: 'Original', complete: false, position: 1 }]);
  const server = await startApiServer(repository);
  try {
    const response = await fetch(`${server.url}/api/todos/1`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Changed', complete: 'bad' }),
    });
    const payload = await response.json();
    const rows = repository.getRows();

    assert.equal(response.status, 400);
    assert.equal(payload.error, 'VALIDATION_ERROR');
    assert.equal(rows[0].title, 'Original');
    assert.equal(rows[0].complete, false);
  } finally {
    await server.close();
  }
});

test('PATCH with repository failure returns stable database errors', async () => {
  const server = await startApiServer(createErrorRepository());
  try {
    const response = await fetch(`${server.url}/api/todos/1`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Will fail' }),
    });
    const payload = await response.json();

    assert.equal(response.status, 500);
    assert.equal(payload.error, 'DATABASE_ERROR');
  } finally {
    await server.close();
  }
});

test('PATCH with completion update repository failure returns database error', async () => {
  const server = await startApiServer(createErrorRepository());
  try {
    const response = await fetch(`${server.url}/api/todos/1`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ complete: true }),
    });
    const payload = await response.json();

    assert.equal(response.status, 500);
    assert.equal(payload.error, 'DATABASE_ERROR');
  } finally {
    await server.close();
  }
});

test('DELETE unknown todo returns 404', async () => {
  const server = await startApiServer(createStatefulRepository());
  try {
    const response = await fetch(`${server.url}/api/todos/999`, {
      method: 'DELETE',
    });
    const payload = await response.json();

    assert.equal(response.status, 404);
    assert.equal(payload.error, 'NOT_FOUND');
  } finally {
    await server.close();
  }
});

test('repository failures return 500 database error payloads', async () => {
  const server = await startApiServer(createErrorRepository());
  try {
    const response = await fetch(`${server.url}/api/todos`);
    const payload = await response.json();

    assert.equal(response.status, 500);
    assert.equal(payload.error, 'DATABASE_ERROR');
  } finally {
    await server.close();
  }
});
