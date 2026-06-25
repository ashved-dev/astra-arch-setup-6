import { createTodoRepository } from '../db/todoRepository.js';

const DEFAULT_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

function normalizeTodoForResponse(todo) {
  if (!todo) {
    return todo;
  }

  return {
    id: todo.id,
    title: todo.title,
    complete: todo.complete,
    completed: todo.complete,
    createdAt: todo.createdAt,
    updatedAt: todo.updatedAt,
  };
}

function parseTodoId(rawId) {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id < 1) {
    return null;
  }

  return id;
}

async function parseJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return null;
  }

  const text = Buffer.concat(chunks).toString('utf8');
  if (!text.trim()) {
    return null;
  }

  return JSON.parse(text);
}

function createValidationError(message, details) {
  return {
    error: 'VALIDATION_ERROR',
    message,
    details: details ? [...details] : undefined,
  };
}

function createNotFoundError(message) {
  return {
    error: 'NOT_FOUND',
    message,
  };
}

function createDatabaseError(message) {
  return {
    error: 'DATABASE_ERROR',
    message,
  };
}

function createUnexpectedError(message) {
  return {
    error: 'UNEXPECTED_ERROR',
    message,
  };
}

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  for (const [key, value] of Object.entries(DEFAULT_HEADERS)) {
    response.setHeader(key, value);
  }

  response.end(JSON.stringify(payload));
}

function sendNoContent(response, statusCode = 204) {
  response.statusCode = statusCode;
  for (const [key, value] of Object.entries(DEFAULT_HEADERS)) {
    response.setHeader(key, value);
  }
  response.end();
}

export function createTodoApiHandler({ repository } = {}) {
  const todoRepository = repository ?? createTodoRepository();

  return async function todoApiHandler(request, response) {
    try {
      if (request.method === 'OPTIONS') {
        sendNoContent(response, 204);
        return;
      }

      const url = new URL(request.url ?? '', 'http://localhost');
      const pathname = url.pathname;

      if (pathname === '/api/health') {
        if (request.method !== 'GET') {
          sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Use GET for /api/health.' });
          return;
        }

        sendJson(response, 200, { ok: true });
        return;
      }

      if (pathname === '/api/todos') {
        if (request.method === 'GET') {
          try {
            const todos = await todoRepository.list();
            sendJson(response, 200, todos.map(normalizeTodoForResponse));
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            sendJson(response, 500, createDatabaseError(message));
          }
          return;
        }

        if (request.method === 'POST') {
          let body;
          try {
            body = await parseJsonBody(request);
          } catch (error) {
            sendJson(response, 400, createValidationError('Request body must be valid JSON.'));
            return;
          }

          if (!body || typeof body !== 'object' || body == null) {
            sendJson(response, 400, createValidationError('Request body must include a title field.'));
            return;
          }

          if (!('title' in body)) {
            sendJson(response, 400, createValidationError('Request body must include a title field.'));
            return;
          }

          if (typeof body.title !== 'string' || !body.title.trim()) {
            sendJson(response, 400, createValidationError('Todo title must be a non-empty string.'));
            return;
          }

          try {
            const created = await todoRepository.create(body.title.trim());
            if (!created) {
              sendJson(response, 500, createDatabaseError('Todo creation failed.'));
              return;
            }

            sendJson(response, 201, normalizeTodoForResponse(created));
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            sendJson(response, 500, createDatabaseError(message));
          }
          return;
        }

        sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Use GET or POST for /api/todos.' });
        return;
      }

      const todoIdMatch = pathname.match(/^\/api\/todos\/(\d+)$/);
      if (todoIdMatch) {
        const todoId = parseTodoId(todoIdMatch[1]);
        if (!todoId) {
          sendJson(response, 400, createValidationError('Todo id must be a positive integer.'));
          return;
        }

        if (request.method === 'DELETE') {
          try {
            const deleted = await todoRepository.delete(todoId);
            if (!deleted || !deleted.success) {
              sendJson(response, 404, createNotFoundError(`Todo with id ${todoId} not found.`));
              return;
            }

            sendJson(response, 200, { success: true, id: todoId });
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            sendJson(response, 500, createDatabaseError(message));
          }
          return;
        }

        if (request.method === 'PATCH') {
          let body;
          try {
            body = await parseJsonBody(request);
          } catch (error) {
            sendJson(response, 400, createValidationError('Request body must be valid JSON.'));
            return;
          }

          if (!body || typeof body !== 'object' || body == null) {
            sendJson(response, 400, createValidationError('Request body must include supported todo fields.'));
            return;
          }

          const supportedFields = new Set(['title', 'complete', 'completed']);
          const providedFields = Object.keys(body).filter((field) => Object.prototype.hasOwnProperty.call(body, field));
          const unknownFields = providedFields.filter((field) => !supportedFields.has(field));

          if (!providedFields.length || unknownFields.length > 0) {
            sendJson(response, 400, createValidationError('Only title and complete/completed fields are supported.', unknownFields));
            return;
          }

          let nextTodo = null;
          if (Object.prototype.hasOwnProperty.call(body, 'title')) {
            if (typeof body.title !== 'string' || !body.title.trim()) {
              sendJson(response, 400, createValidationError('Todo title must be a non-empty string.'));
              return;
            }

            nextTodo = await todoRepository.updateTitle(todoId, body.title.trim());
            if (!nextTodo) {
              sendJson(response, 404, createNotFoundError(`Todo with id ${todoId} not found.`));
              return;
            }
          }

          if (Object.prototype.hasOwnProperty.call(body, 'complete') || Object.prototype.hasOwnProperty.call(body, 'completed')) {
            const complete = Object.prototype.hasOwnProperty.call(body, 'complete') ? body.complete : body.completed;
            if (complete !== true && complete !== false) {
              sendJson(response, 400, createValidationError('Todo complete state must be true or false.'));
              return;
            }

            nextTodo = await todoRepository.updateComplete(todoId, complete);
            if (!nextTodo) {
              sendJson(response, 404, createNotFoundError(`Todo with id ${todoId} not found.`));
              return;
            }
          }

          sendJson(response, 200, normalizeTodoForResponse(nextTodo));
          return;
        }

        sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Use PATCH or DELETE for /api/todos/:id.' });
        return;
      }

      sendJson(response, 404, { error: 'NOT_FOUND', message: 'Endpoint not found.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(response, 500, createUnexpectedError(message));
    }
  };
}

export { DEFAULT_HEADERS, normalizeTodoForResponse };
