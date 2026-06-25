export const TODO_STORAGE_KEY = 'astra-arch-setup-6-todos';

function sanitizeTodo(input) {
  if (!input || typeof input !== 'object') {
    return null;
  }

  if (typeof input.id !== 'number' || !Number.isFinite(input.id) || input.id < 1) {
    return null;
  }

  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title) {
    return null;
  }

  const complete = typeof input.complete === 'boolean' ? input.complete : false;
  return { id: input.id, title, complete };
}

function sanitizeTodoList(input) {
  if (!Array.isArray(input)) {
    return null;
  }

  const output = [];
  for (const item of input) {
    const todo = sanitizeTodo(item);
    if (todo) {
      output.push(todo);
    }
  }

  return output;
}

export function loadTodosFromStorage(storage = globalThis.localStorage) {
  if (!storage || typeof storage.getItem !== 'function') {
    return [];
  }

  try {
    const raw = storage.getItem(TODO_STORAGE_KEY);
    if (raw === null || raw === undefined) {
      return [];
    }

    const parsed = JSON.parse(raw);
    const sanitized = sanitizeTodoList(parsed);
    if (!sanitized) {
      return [];
    }

    return sanitized;
  } catch (_error) {
    return [];
  }
}

export function saveTodosToStorage(todos, storage = globalThis.localStorage) {
  if (!Array.isArray(todos)) {
    return;
  }

  if (!storage || typeof storage.setItem !== 'function') {
    return;
  }

  const safeTodos = [];
  for (const todo of todos) {
    const sanitized = sanitizeTodo(todo);
    if (sanitized) {
      safeTodos.push(sanitized);
    }
  }

  storage.setItem(TODO_STORAGE_KEY, JSON.stringify(safeTodos));
}

