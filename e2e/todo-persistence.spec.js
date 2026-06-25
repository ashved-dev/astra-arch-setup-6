import { expect, test } from '@playwright/test';

async function resetDatabase(request) {
  const listResponse = await request.get('/api/todos');
  if (!listResponse.ok()) {
    return false;
  }

  const todos = await listResponse.json();
  if (!Array.isArray(todos)) {
    return true;
  }

  for (const todo of todos) {
    if (typeof todo?.id !== 'number' || !Number.isFinite(todo.id)) {
      continue;
    }

    await request.delete(`/api/todos/${todo.id}`);
  }

  return true;
}

async function confirmDelete(page, title) {
  await page.getByRole('button', { name: `Delete task ${title}` }).click();
  await expect(page.getByRole('button', { name: `Confirm delete ${title}` })).toBeVisible();
  await page.getByRole('button', { name: `Confirm delete ${title}` }).click();
}

test.beforeEach(async ({ page, request }) => {
  const ready = await resetDatabase(request);
  if (!ready) {
    test.skip(true, 'Postgres-backed API is unavailable for persistence E2E tests.');
    return;
  }

  await page.goto('/');
});

test('Planned persistence use case 1: create todo persists after reload', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Task title' }).fill('Persisted todo');
  await page.getByRole('button', { name: 'Add task' }).click();
  await expect(page.locator('.todo-row')).toHaveCount(1);
  await expect(page.getByText('Persisted todo')).toBeVisible();

  await page.reload();
  await expect(page.locator('.todo-row')).toHaveCount(1);
  await expect(page.getByText('Persisted todo')).toBeVisible();
});

test('Planned persistence use case 2: edit changes title and survives reload', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Task title' }).fill('Original title');
  await page.getByRole('button', { name: 'Add task' }).click();
  await expect(page.locator('.todo-row')).toHaveCount(1);

  await page.getByRole('button', { name: 'Edit task Original title' }).click();
  await page
    .getByLabel('Edit title for task Original title')
    .fill('Edited title');
  await page.getByRole('button', { name: 'Save task Original title' }).click();

  await page.reload();
  await expect(page.locator('.todo-row')).toHaveCount(1);
  await expect(page.getByText('Edited title')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Mark task Edited title as/ })).toBeVisible();
});

test('Planned persistence use case 3: completed state survives reload', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Task title' }).fill('Completion check');
  await page.getByRole('button', { name: 'Add task' }).click();
  await page.getByRole('button', { name: 'Mark task Completion check as completed' }).click();
  await expect(page.locator('.todo-row.is-complete')).toHaveCount(1);

  await page.reload();
  await expect(page.locator('.todo-row.is-complete')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Mark task Completion check as active' })).toBeVisible();
  await expect(page.getByText('1 total, 0 active, 1 completed')).toBeVisible();
});

test('Planned persistence use case 4: confirmed delete removes row after reload', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Task title' }).fill('Delete persisted todo');
  await page.getByRole('button', { name: 'Add task' }).click();
  await expect(page.locator('.todo-row')).toHaveCount(1);
  await confirmDelete(page, 'Delete persisted todo');

  await page.reload();
  await expect(page.getByText('No tasks yet. Add a task to get started.')).toBeVisible();
  await expect(page.locator('.todo-row')).toHaveCount(0);
});

test('Planned persistence use case 5: empty state is shown against an empty Postgres database', async ({ page }) => {
  await expect(page.locator('.todo-row')).toHaveCount(0);
  await expect(page.getByText('No tasks yet. Add a task to get started.')).toBeVisible();
});

test('Planned persistence use case 6: startup/API failure surfaces an error instead of localStorage fallback', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('astra-arch-setup-6-todos', JSON.stringify([{ id: 999, title: 'Stale item', complete: false }]));
  });

  await page.route('**/api/todos**', (route) => {
    route.fulfill({
      status: 500,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({
        error: 'DATABASE_ERROR',
        message: 'Postgres startup not available',
      }),
    });
  });

  await page.goto('/');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('Postgres startup not available')).toBeVisible();
  await expect(page.getByText('Stale item')).toHaveCount(0);
  await expect(page.locator('.todo-row')).toHaveCount(0);
});
