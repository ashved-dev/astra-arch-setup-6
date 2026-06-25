import { expect, test } from '@playwright/test';
import { TODO_STORAGE_KEY } from '../src/todoStorage.js';

async function deleteTodo(page, title) {
  await page.getByRole('button', { name: `Delete task ${title}` }).click();
  await expect(page.getByRole('button', { name: `Confirm delete ${title}` })).toBeVisible();
  await page.getByRole('button', { name: `Confirm delete ${title}` }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('Planned persistence use case 1: persists added todo after reload', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Task title' }).fill('Persisted todo');
  await page.getByRole('button', { name: 'Add task' }).click();
  await expect(page.locator('.todo-row')).toHaveCount(1);

  await page.reload();
  await expect(page.locator('.todo-row')).toHaveCount(1);
  await expect(page.getByText('Persisted todo')).toBeVisible();
  await expect(page.getByText('1 total, 1 active, 0 completed')).toBeVisible();
});

test('Planned persistence use case 2: completed state survives reload', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Task title' }).fill('Finished todo');
  await page.getByRole('button', { name: 'Add task' }).click();
  await page.getByRole('button', { name: 'Mark task Finished todo as completed' }).click();
  await expect(page.locator('.todo-row.is-complete')).toHaveCount(1);

  await page.reload();
  await expect(page.locator('.todo-row.is-complete')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Mark task Finished todo as active' })).toBeVisible();
  await expect(page.getByText('1 total, 0 active, 1 completed')).toBeVisible();
});

test('Planned persistence use case 3: deleting all todos keeps empty state across reload', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Task title' }).fill('One');
  await page.getByRole('button', { name: 'Add task' }).click();
  await page.getByRole('textbox', { name: 'Task title' }).fill('Two');
  await page.getByRole('button', { name: 'Add task' }).click();
  await expect(page.locator('.todo-row')).toHaveCount(2);

  const deleteButtons = page.getByRole('button', { name: /^Delete task / });
  const deleteCount = await deleteButtons.count();
  for (let index = 0; index < deleteCount; index += 1) {
    const title = await page.locator('.todo-row .todo-title').first().textContent();
    expect(title).toBeTruthy();
    await deleteTodo(page, title);
  }

  await expect(page.getByText('No tasks yet. Add a task to get started.')).toBeVisible();
  await expect(page.locator('.todo-row')).toHaveCount(0);

  await page.reload();
  await expect(page.getByText('No tasks yet. Add a task to get started.')).toBeVisible();
  await expect(page.locator('.todo-row')).toHaveCount(0);
  await expect(page.getByText('0 total, 0 active, 0 completed')).toBeVisible();
});

test('Planned persistence use case 4: invalid stored payload keeps app usable', async ({ page }) => {
  await page.evaluate((storageKey) => {
    localStorage.setItem(storageKey, '{"invalid": "data"');
  }, TODO_STORAGE_KEY);
  await page.reload();

  await page.getByRole('textbox', { name: 'Task title' }).fill('Recovered');
  await page.getByRole('button', { name: 'Add task' }).click();

  await expect(page.getByText('Recovered')).toBeVisible();
  await expect(page.getByText('1 total, 1 active, 0 completed')).toBeVisible();
});
