import { expect, test } from '@playwright/test';

import { createMockTodoApi } from './utils/todoApiMock.js';

let todoApi;

async function deleteTodo(page) {
  const firstRow = page.locator('.todo-row').first();
  await firstRow.getByRole('button', { name: /^Delete task / }).click();
  const confirmButton = firstRow.getByRole('button', { name: /^Confirm delete / });
  await expect(confirmButton).toBeVisible();
  await confirmButton.click();
}

test.beforeEach(async ({ page }) => {
  todoApi = await createMockTodoApi(page);
  await todoApi.clear();
  await page.goto('/');
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

  const deleteCount = await page.locator('.todo-row').count();
  for (let index = 0; index < deleteCount; index += 1) {
    await deleteTodo(page);
  }

  await expect(page.getByText('No tasks yet. Add a task to get started.')).toBeVisible();
  await expect(page.locator('.todo-row')).toHaveCount(0);

  await page.reload();
  await expect(page.getByText('No tasks yet. Add a task to get started.')).toBeVisible();
  await expect(page.locator('.todo-row')).toHaveCount(0);
  await expect(page.getByText('0 total, 0 active, 0 completed')).toBeVisible();
});

test('Planned persistence use case 4: invalid stored payload keeps app usable', async ({ page }) => {
  await page.reload();

  await page.getByRole('textbox', { name: 'Task title' }).fill('Recovered');
  await page.getByRole('button', { name: 'Add task' }).click();

  await expect(page.getByText('Recovered')).toBeVisible();
  await expect(page.getByText('1 total, 1 active, 0 completed')).toBeVisible();
});
