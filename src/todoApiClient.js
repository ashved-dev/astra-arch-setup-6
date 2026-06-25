const API_BASE_URL = '/api/todos';

const DEFAULT_LIST = [];

function normalizeTodo(rawTodo) {
  if (!rawTodo || typeof rawTodo !== 'object') {
    return null;
  }

  const id = Number(rawTodo.id);
  if (!Number.isInteger(id) || id < 1) {
    return null;
  }

  const title = typeof rawTodo.title === 'string' ? rawTodo.title.trim() : '';
  if (!title) {
    return null;
  }

  let normalizedComplete = false;
  if (rawTodo.complete === true || rawTodo.complete === false) {
    normalizedComplete = rawTodo.complete;
  } else if (rawTodo.completed === true || rawTodo.completed === false) {
    normalizedComplete = rawTodo.completed;
  } else {
    return null;
  }

  return {
    id,
    title,
    complete: Boolean(normalizedComplete),
  };
}

class ApiRequestError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

function parseJsonSafely(response) {
  return response.text().then((text) => {
    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch (_error) {
      return null;
    }
  });
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await parseJsonSafely(response);

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? String(payload.message)
        : `Request failed with status ${response.status}`;

    throw new ApiRequestError(response.status, message);
  }

  return payload;
}

export async function listTodos() {
  const response = await requestJson(API_BASE_URL, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!Array.isArray(response)) {
    return DEFAULT_LIST;
  }

  return response
    .map(normalizeTodo)
    .filter((item) => item !== null);
}

export async function createTodo(title) {
  const response = await requestJson(API_BASE_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ title }),
  });

  const todo = normalizeTodo(response);
  if (!todo) {
    throw new Error('Unable to parse created todo from API response.');
  }

  return todo;
}

export async function updateTodo(id, update) {
  const response = await requestJson(`${API_BASE_URL}/${id}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(update),
  });

  const todo = normalizeTodo(response);
  if (!todo) {
    throw new Error('Unable to parse updated todo from API response.');
  }

  return todo;
}

export async function deleteTodo(id) {
  const response = await requestJson(`${API_BASE_URL}/${id}`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response || typeof response !== 'object' || response.success !== true) {
    throw new Error('Unable to delete todo through API.');
  }

  return true;
}

export function getTodoRequestErrorMessage(error, fallback = 'Request failed. Contact support if this continues.') {
  if (error instanceof ApiRequestError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}
