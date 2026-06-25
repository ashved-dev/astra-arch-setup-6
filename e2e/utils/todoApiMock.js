const INITIAL_TODOS = [];

function createTodoResponse(todo) {
  return {
    id: todo.id,
    title: todo.title,
    complete: todo.complete,
    completed: todo.complete,
    createdAt: todo.createdAt ?? '2026-06-26T00:00:00.000Z',
    updatedAt: todo.updatedAt ?? '2026-06-26T00:00:00.000Z',
  };
}

function parseTodoId(rawId) {
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function sanitizeTitle(rawTitle) {
  return typeof rawTitle === 'string' ? rawTitle.trim() : '';
}

export async function createMockTodoApi(page) {
  let todos = INITIAL_TODOS.map((todo) => ({ ...todo }));
  if (todos.length === 0) {
    todos = [];
  }

  let nextId = 1;
  if (todos.length) {
    const maxId = Math.max(...todos.map((todo) => todo.id));
    nextId = Number.isFinite(maxId) ? maxId + 1 : 1;
  }

  let pendingFailure = null;
  let responseDelayMs = 0;

  function normalizeBody(rawBody) {
    if (!rawBody || typeof rawBody !== 'object') {
      return null;
    }

    return rawBody;
  }

  function respondWithFailure(route) {
    const status = pendingFailure?.status ?? 500;
    const payload = pendingFailure?.payload ?? {
      error: 'DATABASE_ERROR',
      message: 'Simulated API failure',
    };
    pendingFailure = null;
    return route.fulfill({
      status,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(payload),
    });
  }

  function getTodo(id) {
    return todos.find((todo) => todo.id === id) || null;
  }

  async function handleListTodoRequest(route) {
    if (responseDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, responseDelayMs));
    }

    if (pendingFailure) {
      return respondWithFailure(route);
    }

    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;

    if (pathname === '/api/todos') {
      if (request.method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify(todos.map((todo) => createTodoResponse(todo))),
        });
        return;
      }

      if (request.method() === 'POST') {
        let rawBody = null;
        try {
          rawBody = JSON.parse(request.postData() || '{}');
        } catch (_error) {
          rawBody = null;
        }

        const body = normalizeBody(rawBody);

        const title = sanitizeTitle(body?.title);
        if (!title) {
          route.fulfill({
            status: 400,
            contentType: 'application/json; charset=utf-8',
            body: JSON.stringify({
              error: 'VALIDATION_ERROR',
              message: 'Todo title must be a non-empty string.',
            }),
          });
          return;
        }

        const todo = {
          id: nextId,
          title,
          complete: false,
          createdAt: '2026-06-26T00:00:00.000Z',
          updatedAt: '2026-06-26T00:00:00.000Z',
        };

        todos = [...todos, todo];
        nextId += 1;

        route.fulfill({
          status: 201,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify(createTodoResponse(todo)),
        });
        return;
      }

      route.fulfill({
        status: 405,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({ error: 'METHOD_NOT_ALLOWED', message: 'Use GET or POST for /api/todos.' }),
      });
      return;
    }

    const match = pathname.match(/^\/api\/todos\/(\d+)$/);
    if (!match) {
      await route.continue();
      return;
    }

    const todoId = parseTodoId(match[1]);
    if (!todoId) {
      route.fulfill({
        status: 400,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({ error: 'VALIDATION_ERROR', message: 'Todo id must be a positive integer.' }),
      });
      return;
    }

    if (request.method() === 'DELETE') {
      const previous = getTodo(todoId);
      todos = todos.filter((todo) => todo.id !== todoId);
      if (!previous) {
        route.fulfill({
          status: 404,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify({ error: 'NOT_FOUND', message: `Todo with id ${todoId} not found.` }),
        });
        return;
      }

      route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({ success: true, id: todoId }),
      });
      return;
    }

    if (request.method() === 'PATCH') {
      const rawBody = (() => {
        try {
          return JSON.parse(request.postData() || '{}');
        } catch (_error) {
          return null;
        }
      })();
      const body = normalizeBody(rawBody);
      if (!body || typeof body !== 'object') {
        route.fulfill({
          status: 400,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify({ error: 'VALIDATION_ERROR', message: 'Todo body must include supported fields.' }),
        });
        return;
      }

      const providedFields = Object.keys(body);
      if (providedFields.length === 0) {
        route.fulfill({
          status: 400,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify({ error: 'VALIDATION_ERROR', message: 'Todo body must include supported fields.' }),
        });
        return;
      }

      const allowedFields = new Set(['title', 'complete', 'completed']);
      const hasUnknown = providedFields.some((field) => !allowedFields.has(field));
      if (hasUnknown) {
        route.fulfill({
          status: 400,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify({
            error: 'VALIDATION_ERROR',
            message: 'Only title and complete/completed fields are supported.',
          }),
        });
        return;
      }

      const hasTitle = Object.prototype.hasOwnProperty.call(body, 'title');
      const hasComplete = Object.prototype.hasOwnProperty.call(body, 'complete');
      const hasCompleted = Object.prototype.hasOwnProperty.call(body, 'completed');
      if (hasComplete && hasCompleted) {
        route.fulfill({
          status: 400,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify({
            error: 'VALIDATION_ERROR',
            message: 'Provide either complete or completed, not both.',
          }),
        });
        return;
      }

      const completeField = hasComplete ? 'complete' : hasCompleted ? 'completed' : null;
      const updatedTodo = getTodo(todoId);
      if (!updatedTodo) {
        route.fulfill({
          status: 404,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify({ error: 'NOT_FOUND', message: `Todo with id ${todoId} not found.` }),
        });
        return;
      }

      if (hasTitle) {
        const title = sanitizeTitle(body.title);
        if (!title) {
          route.fulfill({
            status: 400,
            contentType: 'application/json; charset=utf-8',
            body: JSON.stringify({
              error: 'VALIDATION_ERROR',
              message: 'Todo title must be a non-empty string.',
            }),
          });
          return;
        }

        updatedTodo.title = title;
      }

      if (completeField) {
        if (body[completeField] !== true && body[completeField] !== false) {
          route.fulfill({
            status: 400,
            contentType: 'application/json; charset=utf-8',
            body: JSON.stringify({
              error: 'VALIDATION_ERROR',
              message: 'Todo complete state must be true or false.',
            }),
          });
          return;
        }

        updatedTodo.complete = body[completeField];
      }

      route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(createTodoResponse(updatedTodo)),
      });
      return;
    }

    route.fulfill({
      status: 405,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({ error: 'METHOD_NOT_ALLOWED', message: 'Use PATCH or DELETE for /api/todos/:id.' }),
    });
  }

  await page.route('**/api/todos**', (route) => {
    void handleListTodoRequest(route);
  });

  return {
    async clear() {
      todos = [];
      nextId = 1;
    },
    getTodos() {
      return [...todos];
    },
    async setDelay(ms) {
      responseDelayMs = ms;
    },
    async setFailure(options = {}) {
      pendingFailure = {
        status: options.status ?? 500,
        payload: options.payload ?? {
          error: options.error ?? 'DATABASE_ERROR',
          message: options.message ?? 'Simulated API failure',
        },
      };
    },
    async clearFailure() {
      pendingFailure = null;
    },
  };
}
