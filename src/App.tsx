import './App.css';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  createTodo,
  deleteTodo,
  getTodoRequestErrorMessage,
  listTodos,
  updateTodo,
} from './todoApiClient.js';

type Todo = {
  id: number;
  title: string;
  complete: boolean;
};

type Filter = 'all' | 'active' | 'completed';

function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [validationMessage, setValidationMessage] = useState('');
  const [apiErrorMessage, setApiErrorMessage] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [editingTodoId, setEditingTodoId] = useState<number | null>(null);
  const [editingTodoTitle, setEditingTodoTitle] = useState('');
  const [editingValidationMessage, setEditingValidationMessage] = useState('');
  const [deletingTodoId, setDeletingTodoId] = useState<number | null>(null);
  const [isLoadingTodos, setIsLoadingTodos] = useState(true);
  const [isPersisting, setIsPersisting] = useState(false);

  const activeCount = useMemo(() => todos.filter((todo) => !todo.complete).length, [todos]);
  const completedCount = todos.length - activeCount;

  const loadTodos = useCallback(async (showSpinner = true) => {
    if (showSpinner) {
      setIsLoadingTodos(true);
    }

    try {
      const nextTodos = await listTodos();
      setTodos(nextTodos);
      setApiErrorMessage('');
    } catch (error) {
      setApiErrorMessage(getTodoRequestErrorMessage(error, 'Unable to load todos from the server.'));
    } finally {
      setIsLoadingTodos(false);
      setIsPersisting(false);
    }
  }, []);

  useEffect(() => {
    void loadTodos(true);
  }, [loadTodos]);

  const runMutation = useCallback(
    async (mutation: () => Promise<unknown>) => {
      if (isPersisting) {
        return;
      }

      setIsPersisting(true);
      setApiErrorMessage('');

      try {
        await mutation();
        await loadTodos(false);
      } catch (error) {
        setApiErrorMessage(getTodoRequestErrorMessage(error, 'Unable to save changes.'));
        setIsPersisting(false);
      }
    },
    [isPersisting, loadTodos],
  );

  const visibleTodos = useMemo(() => {
    if (filter === 'active') {
      return todos.filter((todo) => !todo.complete);
    }

    if (filter === 'completed') {
      return todos.filter((todo) => todo.complete);
    }

    return todos;
  }, [filter, todos]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = newTodoTitle.trim();

    if (!title) {
      setValidationMessage('Task title is required');
      return;
    }

    setValidationMessage('');
    setNewTodoTitle('');
    await runMutation(() => createTodo(title));
  };

  const toggleTodo = async (id: number) => {
    const todo = todos.find((current) => current.id === id);
    if (!todo) {
      return;
    }

    await runMutation(() => updateTodo(id, { complete: !todo.complete }));
  };

  const clearEditingState = () => {
    setEditingTodoId(null);
    setEditingTodoTitle('');
    setEditingValidationMessage('');
  };

  const requestDeleteTodo = (id: number) => {
    clearEditingState();
    setDeletingTodoId(id);
  };

  const cancelDeleteTodo = () => {
    setDeletingTodoId(null);
  };

  const confirmDeleteTodo = async (id: number) => {
    await runMutation(async () => {
      await deleteTodo(id);
    });

    setDeletingTodoId((currentId) => (currentId === id ? null : currentId));
    if (editingTodoId === id) {
      clearEditingState();
    }
  };

  const startEditingTodo = (todo: Todo) => {
    setDeletingTodoId(null);
    setEditingTodoId(todo.id);
    setEditingTodoTitle(todo.title);
    setEditingValidationMessage('');
  };

  const cancelEditingTodo = () => {
    clearEditingState();
  };

  const saveEditingTodo = async (id: number) => {
    const title = editingTodoTitle.trim();

    if (!title) {
      setEditingValidationMessage('Task title is required');
      return;
    }

    await runMutation(async () => {
      await updateTodo(id, { title });
      clearEditingState();
    });
  };

  const clearCompletedTodos = async () => {
    const completedTodos = todos.filter((todo) => todo.complete);
    if (completedTodos.length === 0) {
      return;
    }

    await runMutation(() =>
      Promise.all(completedTodos.map((todo) => deleteTodo(todo.id)) as Promise<unknown>[]),
    );
  };

  return (
    <main className="todo-page">
      <div className="todo-frame">
        <header className="todo-header">
          <h1>Simple Todo</h1>
          <p className="summary">
            {todos.length} total, {activeCount} active, {completedCount} completed
          </p>
        </header>

        <section className="todo-panel" aria-label="Todo list">
          <form className="todo-form" noValidate onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="todo-title-input">
              Task title
            </label>
            <input
              id="todo-title-input"
              aria-label="Task title"
              type="text"
              placeholder="Add a task"
              value={newTodoTitle}
              onChange={(event) => setNewTodoTitle(event.target.value)}
              aria-invalid={Boolean(validationMessage)}
              aria-describedby={validationMessage ? 'todo-validation' : undefined}
              disabled={isPersisting}
            />
            <button
              type="submit"
              className="add-button"
              aria-label="Add task"
              disabled={isPersisting}
            >
              Add
            </button>
          </form>

          {validationMessage ? (
            <p id="todo-validation" role="status" className="todo-validation" aria-live="polite">
              {validationMessage}
            </p>
          ) : null}

          <nav className="todo-filters" aria-label="Todo filters">
            <button
              type="button"
              className={`filter-button ${filter === 'all' ? 'is-active' : ''}`}
              aria-pressed={filter === 'all'}
              onClick={() => setFilter('all')}
              disabled={isPersisting}
            >
              All
            </button>
            <button
              type="button"
              className={`filter-button ${filter === 'active' ? 'is-active' : ''}`}
              aria-pressed={filter === 'active'}
              onClick={() => setFilter('active')}
              disabled={isPersisting}
            >
              Active
            </button>
            <button
              type="button"
              className={`filter-button ${filter === 'completed' ? 'is-active' : ''}`}
              aria-pressed={filter === 'completed'}
              onClick={() => setFilter('completed')}
              disabled={isPersisting}
            >
              Completed
            </button>
            <button
              type="button"
              className="filter-button"
              onClick={clearCompletedTodos}
              disabled={isPersisting || completedCount === 0}
            >
              Clear completed
            </button>
          </nav>

          {isLoadingTodos ? (
            <p className="todo-status todo-loading" role="status" aria-live="polite">
              Loading tasks...
            </p>
          ) : (
            <>
              {apiErrorMessage ? (
                <div className="todo-status todo-error" role="alert" aria-live="polite">
                  <p>{apiErrorMessage}</p>
                  <button
                    type="button"
                    className="retry-button"
                    onClick={() => loadTodos(false)}
                    disabled={isPersisting}
                  >
                    Retry
                  </button>
                </div>
              ) : null}

              {visibleTodos.length === 0 ? (
                <div className="todo-empty" role="status" aria-live="polite">
                  <p>No tasks yet. Add a task to get started.</p>
                </div>
              ) : (
                <ul className="todo-list" aria-live="polite">
                  {visibleTodos.map((todo) => (
                    <li
                      key={todo.id}
                      className={`todo-row ${todo.complete ? 'is-complete' : ''} ${
                        editingTodoId === todo.id ? 'is-editing' : ''
                      } ${deletingTodoId === todo.id ? 'is-deleting' : ''}`}
                    >
                      {editingTodoId === todo.id ? (
                        <form
                          className="todo-edit-form"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void saveEditingTodo(todo.id);
                          }}
                        >
                          <button
                            type="button"
                            className={`todo-check ${todo.complete ? 'is-complete' : ''}`}
                            aria-label={`Mark task ${todo.title} as ${
                              todo.complete ? 'active' : 'completed'
                            }`}
                            onClick={() => void toggleTodo(todo.id)}
                            disabled={isPersisting}
                          />
                          <label htmlFor={`edit-title-${todo.id}`} className="sr-only">
                            Edit title
                          </label>
                          <input
                            id={`edit-title-${todo.id}`}
                            className="todo-edit-input"
                            type="text"
                            value={editingTodoTitle}
                            onChange={(event) => setEditingTodoTitle(event.target.value)}
                            aria-label={`Edit title for task ${todo.title}`}
                            aria-invalid={Boolean(editingValidationMessage)}
                            aria-describedby={
                              editingValidationMessage ? `edit-validation-${todo.id}` : undefined
                            }
                            disabled={isPersisting}
                          />
                          <button
                            type="submit"
                            className="todo-edit-save"
                            aria-label={`Save task ${todo.title}`}
                            disabled={isPersisting}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="todo-edit-cancel"
                            aria-label={`Cancel editing ${todo.title}`}
                            onClick={cancelEditingTodo}
                            disabled={isPersisting}
                          >
                            Cancel
                          </button>
                          {editingValidationMessage ? (
                            <p
                              id={`edit-validation-${todo.id}`}
                              role="status"
                              className="edit-validation"
                              aria-live="polite"
                            >
                              {editingValidationMessage}
                            </p>
                          ) : null}
                        </form>
                      ) : deletingTodoId === todo.id ? (
                        <>
                          <button
                            type="button"
                            className={`todo-check ${todo.complete ? 'is-complete' : ''}`}
                            aria-label={`Mark task ${todo.title} as ${
                              todo.complete ? 'active' : 'completed'
                            }`}
                            onClick={() => void toggleTodo(todo.id)}
                            disabled={isPersisting}
                          />
                          <span className="todo-title">{todo.title}</span>
                          <span className="todo-delete-prompt">Delete?</span>
                          <button
                            type="button"
                            className="todo-delete todo-action todo-delete-confirm"
                            aria-label={`Confirm delete ${todo.title}`}
                            onClick={() => void confirmDeleteTodo(todo.id)}
                            disabled={isPersisting}
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            className="todo-delete todo-action todo-delete-cancel"
                            aria-label={`Cancel delete ${todo.title}`}
                            onClick={cancelDeleteTodo}
                            disabled={isPersisting}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className={`todo-check ${todo.complete ? 'is-complete' : ''}`}
                            aria-label={`Mark task ${todo.title} as ${
                              todo.complete ? 'active' : 'completed'
                            }`}
                            onClick={() => void toggleTodo(todo.id)}
                            disabled={isPersisting}
                          />
                          <span className="todo-title">{todo.title}</span>
                          <button
                            type="button"
                            className="todo-action"
                            aria-label={`Edit task ${todo.title}`}
                            onClick={() => startEditingTodo(todo)}
                            disabled={isPersisting}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="todo-delete todo-action"
                            aria-label={`Delete task ${todo.title}`}
                            onClick={() => requestDeleteTodo(todo.id)}
                            disabled={isPersisting}
                          >
                            ×
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

export default App;
