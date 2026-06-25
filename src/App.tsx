import './App.css';

type Todo = {
  id: number;
  title: string;
  complete: boolean;
};

const sampleTodos: Todo[] = [
  { id: 1, title: 'Draft the first task', complete: false },
  { id: 2, title: 'Create project shell', complete: true },
  { id: 3, title: 'Verify mobile layout', complete: false },
];

function App() {
  const params = new URLSearchParams(window.location.search);
  const isEmpty = params.get('state') === 'empty';
  const isValidationVisible = params.get('validation') === 'error';
  const todos = isEmpty ? [] : sampleTodos;

  return (
    <main className="todo-page">
      <div className="todo-frame">
        <header className="todo-header">
          <h1>Simple Todo</h1>
          <p className="summary">3 total, 2 active, 1 completed</p>
        </header>

        <section className="todo-panel" aria-label="Todo list">
          <form className="todo-form" noValidate>
            <label className="sr-only" htmlFor="todo-title-input">
              Task title
            </label>
            <input
              id="todo-title-input"
              aria-label="Task title"
              type="text"
              placeholder="Add a task"
            />
            <button type="button" className="add-button" aria-label="Add task">
              Add
            </button>
          </form>

          {isValidationVisible ? (
            <p role="status" className="todo-validation" aria-live="polite">
              Task title is required
            </p>
          ) : null}

          <nav className="todo-filters" aria-label="Todo filters">
            <button type="button" className="filter-button is-active" aria-pressed="true">
              All
            </button>
            <button type="button" className="filter-button">
              Active
            </button>
            <button type="button" className="filter-button">
              Completed
            </button>
          </nav>

          {todos.length === 0 ? (
            <div className="todo-empty" role="status" aria-live="polite">
              <p>No tasks yet. Add a task to get started.</p>
            </div>
          ) : (
            <ul className="todo-list" aria-live="polite">
              {todos.map((todo) => (
                <li key={todo.id} className={`todo-row ${todo.complete ? 'is-complete' : ''}`}>
                  <span className="todo-check" aria-hidden="true" />
                  <span className="todo-title">{todo.title}</span>
                  <button type="button" className="todo-delete" aria-label={`Delete task ${todo.title}`}>
                    x
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
