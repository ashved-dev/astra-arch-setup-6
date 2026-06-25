import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createTodo,
  deleteTodo,
  getTodoRequestErrorMessage,
  listTodos,
  updateTodo,
} from '../src/todoApiClient.js';

function createResponse({ status, payload, init = {} }) {
  const text = payload === undefined ? '' : JSON.stringify(payload);

  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
    json: async () => payload,
    ...init,
  };
}

function installFetchStub(handler) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) =>
    handler(new URL(String(input), 'http://127.0.0.1'), init);

  return () => {
    globalThis.fetch = originalFetch;
  };
}

test('listTodos loads and normalizes API payloads', async () => {
  const restoreFetch = installFetchStub((url) => {
    assert.equal(url.pathname, '/api/todos');
    assert.equal(url.search, '');
    return createResponse({
      status: 200,
      payload: [
        { id: '1', title: '  API one  ', complete: false, completed: false },
        { id: 2, title: '', complete: true },
        { id: 3, title: 'API two', complete: 'yes', completed: true },
        { id: 4, title: 'API three', completed: false },
      ],
    });
  });

  try {
    const todos = await listTodos();
    assert.deepEqual(todos, [
      { id: 1, title: 'API one', complete: false },
      { id: 3, title: 'API two', complete: true },
      { id: 4, title: 'API three', complete: false },
    ]);
  } finally {
    restoreFetch();
  }
});

test('createTodo trims title and returns normalized todo', async () => {
  const restoreFetch = installFetchStub(() => {
    return createResponse({
      status: 201,
      payload: {
        id: 10,
        title: 'Saved todo',
        complete: false,
        completed: false,
      },
    });
  });

  try {
    const todo = await createTodo('  Saved todo  ');
    assert.deepEqual(todo, { id: 10, title: 'Saved todo', complete: false });
  } finally {
    restoreFetch();
  }
});

test('updateTodo maps both complete and completed fields', async () => {
  const restoreFetch = installFetchStub((url, init) => {
    assert.equal(url.pathname, '/api/todos/10');
    assert.equal(init.method, 'PATCH');

    return createResponse({
      status: 200,
      payload: {
        id: 10,
        title: 'Updated todo',
        complete: true,
        completed: true,
      },
    });
  });

  try {
    const todo = await updateTodo(10, { completed: true });
    assert.deepEqual(todo, { id: 10, title: 'Updated todo', complete: true });
  } finally {
    restoreFetch();
  }
});

test('deleteTodo accepts successful success payloads', async () => {
  const restoreFetch = installFetchStub((url, init) => {
    assert.equal(url.pathname, '/api/todos/3');
    assert.equal(init.method, 'DELETE');
    return createResponse({
      status: 200,
      payload: { success: true, id: 3 },
    });
  });

  try {
    const deleted = await deleteTodo(3);
    assert.equal(deleted, true);
  } finally {
    restoreFetch();
  }
});

test('error responses include API message in throw for user feedback', async () => {
  const restoreFetch = installFetchStub(() => {
    return createResponse({
      status: 500,
      payload: {
        error: 'DATABASE_ERROR',
        message: 'Unable to write todo',
      },
    });
  });

  try {
    await assert.rejects(listTodos(), /Unable to write todo/);
  } finally {
    restoreFetch();
  }
});

test('getTodoRequestErrorMessage classifies unknown errors', () => {
  assert.equal(
    getTodoRequestErrorMessage(new TypeError('network'), 'fallback'),
    'network',
  );
  assert.equal(
    getTodoRequestErrorMessage('bad shape', 'fallback'),
    'fallback',
  );
});
