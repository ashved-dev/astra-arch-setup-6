import './App.css';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { loadTodosFromStorage, saveTodosToStorage } from './todoStorage.js';

type Todo = {
  id: number;
  title: string;
  complete: boolean;
};

type Filter = 'all' | 'active' | 'completed';

function createTodoId(todos: Todo[]): number {
  return todos.length ? Math.max(...todos.map((todo) => todo.id)) + 1 : 1;
}

function App() {
  const [todos, setTodos] = useState<Todo[]>(() => loadTodosFromStorage());
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [validationMessage, setValidationMessage] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [editingTodoId, setEditingTodoId] = useState<number | null>(null);
  const [editingTodoTitle, setEditingTodoTitle] = useState('');
  const [editingValidationMessage, setEditingValidationMessage] = useState('');

  const activeCount = useMemo(
    () => todos.filter((todo) => !todo.complete).length,
    [todos],
  );
  const completedCount = todos.length - activeCount;

  useEffect(() => {
    saveTodosToStorage(todos);
  }, [todos]);

  const visibleTodos = useMemo(() => {
    if (filter === 'active') {
      return todos.filter((todo) => !todo.complete);
    }
    if (filter === 'completed') {
      return todos.filter((todo) => todo.complete);
    }
    return todos;
  }, [filter, todos]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = newTodoTitle.trim();

    if (!title) {
      setValidationMessage('Task title is required');
      return;
    }

    setValidationMessage('');
    setTodos((prev) => [...prev, { id: createTodoId(prev), title, complete: false }]);
    setNewTodoTitle('');
  };

  const toggleTodo = (id: number) => {
    setTodos((prev) =>
      prev.map((todo) => (todo.id === id ? { ...todo, complete: !todo.complete } : todo)),
    );
  };

  const deleteTodo = (id: number) => {
    setTodos((prev) => prev.filter((todo) => todo.id !== id));
    if (editingTodoId === id) {
      setEditingTodoId(null);
      setEditingTodoTitle('');
      setEditingValidationMessage('');
    }
  };

  const startEditingTodo = (todo: Todo) => {
    setEditingTodoId(todo.id);
    setEditingTodoTitle(todo.title);
    setEditingValidationMessage('');
  };

  const cancelEditingTodo = () => {
    setEditingTodoId(null);
    setEditingTodoTitle('');
    setEditingValidationMessage('');
  };

  const saveEditingTodo = (id: number) => {
    const title = editingTodoTitle.trim();
    if (!title) {
      setEditingValidationMessage('Task title is required');
      return;
    }

    setTodos((prev) => prev.map((todo) => (todo.id === id ? { ...todo, title } : todo)));
    setEditingTodoId(null);
    setEditingTodoTitle('');
    setEditingValidationMessage('');
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
            />
            <button type="submit" className="add-button" aria-label="Add task">
              Add
            </button>
          </form>

          {validationMessage ? (
            <p id="todo-validation" role="status" className="todo-validation" aria-live="polite">
              Task title is required
            </p>
          ) : null}

          <nav className="todo-filters" aria-label="Todo filters">
            <button
              type="button"
              className={`filter-button ${filter === 'all' ? 'is-active' : ''}`}
              aria-pressed={filter === 'all'}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              type="button"
              className={`filter-button ${filter === 'active' ? 'is-active' : ''}`}
              aria-pressed={filter === 'active'}
              onClick={() => setFilter('active')}
            >
              Active
            </button>
            <button
              type="button"
              className={`filter-button ${filter === 'completed' ? 'is-active' : ''}`}
              aria-pressed={filter === 'completed'}
              onClick={() => setFilter('completed')}
            >
              Completed
            </button>
          </nav>

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
                  }`}
                >
                  {editingTodoId === todo.id ? (
                    <form
                      className="todo-edit-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        saveEditingTodo(todo.id);
                      }}
                    >
                      <button
                        type="button"
                        className={`todo-check ${todo.complete ? 'is-complete' : ''}`}
                        aria-label={`Mark task ${todo.title} as ${
                          todo.complete ? 'active' : 'completed'
                        }`}
                        onClick={() => toggleTodo(todo.id)}
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
                        aria-describedby={editingValidationMessage ? `edit-validation-${todo.id}` : undefined}
                      />
                      <button
                        type="submit"
                        className="todo-edit-save"
                        aria-label={`Save task ${todo.title}`}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="todo-edit-cancel"
                        aria-label={`Cancel editing ${todo.title}`}
                        onClick={cancelEditingTodo}
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
                  ) : (
                    <>
                      <button
                        type="button"
                        className={`todo-check ${todo.complete ? 'is-complete' : ''}`}
                        aria-label={`Mark task ${todo.title} as ${todo.complete ? 'active' : 'completed'}`}
                        onClick={() => toggleTodo(todo.id)}
                      />
                      <span className="todo-title">{todo.title}</span>
                      <button
                        type="button"
                        className="todo-action"
                        aria-label={`Edit task ${todo.title}`}
                        onClick={() => startEditingTodo(todo)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="todo-delete todo-action"
                        aria-label={`Delete task ${todo.title}`}
                        onClick={() => deleteTodo(todo.id)}
                      >
                        ×
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

export default App;
