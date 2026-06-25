import './App.css';
import { FormEvent, useMemo, useState } from 'react';

type Todo = {
  id: number;
  title: string;
  complete: boolean;
};

type Filter = 'all' | 'active' | 'completed';

const sampleTodos: Todo[] = [
  { id: 1, title: 'Draft the first task', complete: false },
  { id: 2, title: 'Create project shell', complete: true },
  { id: 3, title: 'Verify mobile layout', complete: false },
];

function createTodoId(todos: Todo[]): number {
  return todos.length ? Math.max(...todos.map((todo) => todo.id)) + 1 : 1;
}

function App() {
  const [todos, setTodos] = useState<Todo[]>(sampleTodos);
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [validationMessage, setValidationMessage] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const activeCount = useMemo(
    () => todos.filter((todo) => !todo.complete).length,
    [todos],
  );
  const completedCount = todos.length - activeCount;

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
                <li key={todo.id} className={`todo-row ${todo.complete ? 'is-complete' : ''}`}>
                  <button
                    type="button"
                    className={`todo-check ${todo.complete ? 'is-complete' : ''}`}
                    aria-label={`Mark task ${todo.title} as ${todo.complete ? 'active' : 'completed'}`}
                    onClick={() => toggleTodo(todo.id)}
                  />
                  <span className="todo-title">{todo.title}</span>
                  <button
                    type="button"
                    className="todo-delete"
                    aria-label={`Delete task ${todo.title}`}
                    onClick={() => deleteTodo(todo.id)}
                  >
                    ×
                  </button>
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
