export type TodoShape = {
  id: number;
  title: string;
  complete: boolean;
};

export const TODO_STORAGE_KEY: string;

export function loadTodosFromStorage(storage?: Storage): TodoShape[];
export function saveTodosToStorage(todos: TodoShape[], storage?: Storage): void;

