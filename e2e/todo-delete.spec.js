import { expect, test } from '@playwright/test';

import { createMockTodoApi } from './utils/todoApiMock.js';

let todoApi;

async function addTodo(page, title) {
  await page.getByRole('textbox', { name: 'Task title' }).fill(title);
  await page.getByRole('button', { name: 'Add task' }).click();
}

async function requestDelete(page, title) {
  const deleteButton = page.getByRole('button', { name: `Delete task ${title}` });
  await expect(deleteButton).toBeVisible();
  await deleteButton.click();
  await expect(page.getByRole('button', { name: `Confirm delete ${title}` })).toBeVisible();
  await expect(page.getByRole('button', { name: `Cancel delete ${title}` })).toBeVisible();
}

async function confirmDelete(page, title) {
  await requestDelete(page, title);
  await page.getByRole('button', { name: `Confirm delete ${title}` }).click();
}

async function cancelDelete(page, title) {
  const cancelButton = page.getByRole('button', { name: `Cancel delete ${title}` });
  const alreadyVisible = await cancelButton.isVisible();
  if (!alreadyVisible) {
    await requestDelete(page, title);
  }
  await cancelButton.click();
}

function horizontalOverflow(page) {
  return page.evaluate(() => {
    return (
      Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) -
      document.documentElement.clientWidth
    );
  });
}

test.beforeEach(async ({ page }) => {
  todoApi = await createMockTodoApi(page);
  await todoApi.clear();
  await page.goto('/');
});

test('Planned delete use case 1: cancel path keeps todo visible', async ({ page }) => {
  await addTodo(page, 'Cancelable task');
  await cancelDelete(page, 'Cancelable task');

  await expect(page.getByText('Cancelable task')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm delete Cancelable task' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Cancel delete Cancelable task' })).toHaveCount(0);
});

test('Planned delete use case 2: confirm path removes todo and updates summary', async ({ page }) => {
  await addTodo(page, 'Deletable task');
  await expect(page.getByText('1 total, 1 active, 0 completed')).toBeVisible();

  await confirmDelete(page, 'Deletable task');

  await expect(page.locator('.todo-row')).toHaveCount(0);
  await expect(page.getByText('0 total, 0 active, 0 completed')).toBeVisible();
});

test('Planned delete use case 3: confirmed deletion persists across reload', async ({ page }) => {
  await addTodo(page, 'Persistent delete');
  await confirmDelete(page, 'Persistent delete');

  await page.reload();

  await expect(page.locator('.todo-row')).toHaveCount(0);
  await expect(page.getByText('No tasks yet. Add a task to get started.')).toBeVisible();
});

test('Planned delete use case 4: completed filter delete removes only selected completed row', async ({
  page,
}) => {
  await addTodo(page, 'Stay active');
  await addTodo(page, 'Will delete');
  await page.getByRole('button', { name: 'Mark task Will delete as completed' }).click();

  await page.getByRole('button', { name: 'Completed', exact: true }).click();
  await expect(page.locator('.todo-row')).toHaveCount(1);

  await confirmDelete(page, 'Will delete');

  await expect(page.locator('.todo-row')).toHaveCount(0);
  await expect(page.getByText('1 total, 1 active, 0 completed')).toBeVisible();
  await expect(page.getByText('Stay active')).toHaveCount(0);
});

test('Planned delete use case 5: single-target path only confirms one row', async ({ page }) => {
  await addTodo(page, 'Alpha');
  await addTodo(page, 'Beta');

  await requestDelete(page, 'Alpha');

  await expect(page.getByRole('button', { name: 'Confirm delete Alpha' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel delete Alpha' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Confirm delete / })).toHaveCount(1);
  await expect(page.getByRole('button', { name: /^Cancel delete / })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Confirm delete Beta' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Cancel delete Beta' })).toHaveCount(0);
});

test('Planned delete use case 6: responsive mobile confirm and cancel flow has no overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await addTodo(page, 'Mobile delete');
  await addTodo(page, 'Mobile keep');

  await requestDelete(page, 'Mobile delete');
  await expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

  await cancelDelete(page, 'Mobile delete');
  await expect(page.getByText('Mobile delete')).toBeVisible();
  await expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

  await requestDelete(page, 'Mobile keep');
  await page.getByRole('button', { name: 'Confirm delete Mobile keep' }).click();
  await expect(page.locator('.todo-row')).toHaveCount(1);
  await expect(page.getByText('Mobile delete')).toBeVisible();
  await expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
});
