import { expect, test } from '@playwright/test';
import { createMockTodoApi } from './utils/todoApiMock.js';

let todoApi;

async function clickDeleteConfirm(page, title, action = 'confirm') {
  await page.getByRole('button', { name: `Delete task ${title}` }).click();
  if (action === 'cancel') {
    await expect(page.getByRole('button', { name: `Cancel delete ${title}` })).toBeVisible();
    await page.getByRole('button', { name: `Cancel delete ${title}` }).click();
    return;
  }

  await expect(page.getByRole('button', { name: `Confirm delete ${title}` })).toBeVisible();
  await page.getByRole('button', { name: `Confirm delete ${title}` }).click();
}

test.beforeEach(async ({ page }) => {
  todoApi = await createMockTodoApi(page);
  await todoApi.clear();
  await page.goto('/');
});

test('Planned interaction use case 0: fresh load shows loading and then data', async ({ page }) => {
  await todoApi.setDelay(150);
  await page.goto('/');
  await expect(page.getByText('Loading tasks...')).toBeVisible();

  await page.getByRole('textbox', { name: 'Task title' }).fill('Delayed seed');
  await page.getByRole('button', { name: 'Add task' }).click();
  await expect(page.locator('.todo-row')).toHaveCount(1);
  await expect(page.getByText('Delayed seed')).toBeVisible();
  await todoApi.setDelay(0);
});

test('Planned interaction use case 1: full flow add, validation, toggle, filters, delete, and empty', async ({
  page,
}) => {
  await page.getByRole('textbox', { name: 'Task title' }).fill('   ');
  await page.getByRole('button', { name: 'Add task' }).click();
  await expect(page.getByText('Task title is required')).toBeVisible();

  await page.getByRole('textbox', { name: 'Task title' }).fill('Write tests');
  await page.getByRole('button', { name: 'Add task' }).click();
  await page.getByRole('textbox', { name: 'Task title' }).fill('Review docs');
  await page.getByRole('button', { name: 'Add task' }).click();
  await page.getByRole('textbox', { name: 'Task title' }).fill('Ship release');
  await page.getByRole('button', { name: 'Add task' }).click();

  await expect(page.locator('.todo-row')).toHaveCount(3);

  await page.getByRole('button', { name: 'Mark task Write tests as completed' }).click();
  await page.getByRole('button', { name: 'Mark task Review docs as completed' }).click();

  await page.getByRole('button', { name: 'Active', exact: true }).click();
  await expect(page.locator('.todo-row')).toHaveCount(1);
  await expect(page.getByText('Ship release')).toBeVisible();

  await page.getByRole('button', { name: 'Completed', exact: true }).click();
  await expect(page.locator('.todo-row')).toHaveCount(2);
  await expect(page.getByText('Write tests')).toBeVisible();
  await expect(page.getByText('Review docs')).toBeVisible();

  await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(page.locator('.todo-row')).toHaveCount(3);

  let rowCount = await page.locator('.todo-row').count();
  while (rowCount > 0) {
    const firstRow = page.locator('.todo-row').first();
    const deleteButton = firstRow.getByRole('button', { name: /^Delete task / });
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();
    const confirmButton = firstRow.getByRole('button', { name: /^Confirm delete / });
    await expect(confirmButton).toBeVisible();
    await confirmButton.click();
    rowCount -= 1;
    await expect(page.locator('.todo-row')).toHaveCount(rowCount);
  }

  await expect(page.getByText('No tasks yet. Add a task to get started.')).toBeVisible();
  await expect(page.locator('.todo-row')).toHaveCount(0);
  await expect(page.getByText('0 total, 0 active, 0 completed')).toBeVisible();
});

test('Planned interaction use case 2: persistence path keeps completed and active state on reload', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Task title' }).fill('Persist todo');
  await page.getByRole('button', { name: 'Add task' }).click();
  await page.getByRole('textbox', { name: 'Task title' }).fill('Second todo');
  await page.getByRole('button', { name: 'Add task' }).click();

  await page.getByRole('button', { name: 'Mark task Second todo as completed' }).click();
  await expect(page.getByText('2 total, 1 active, 1 completed')).toBeVisible();

  await page.reload();

  await expect(page.getByText('2 total, 1 active, 1 completed')).toBeVisible();
  await expect(page.getByText('Persist todo')).toBeVisible();
  await expect(page.getByText('Second todo')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark task Persist todo as completed' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark task Second todo as active' })).toBeVisible();
});

test('Planned interaction use case 6: API failure keeps current todo list visible', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Task title' }).fill('Transient API path');
  await page.getByRole('button', { name: 'Add task' }).click();
  await expect(page.locator('.todo-row')).toHaveCount(1);

  await todoApi.setFailure({ status: 500, message: 'Simulated API failure' });
  await page.getByRole('button', { name: 'Mark task Transient API path as completed' }).click();

  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('Simulated API failure')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark task Transient API path as completed' })).toBeVisible();
});

test('Planned interaction use case 3: invalid storage path does not crash the app', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => {
    errors.push(error);
  });

  await expect(page.getByText('No tasks yet. Add a task to get started.')).toBeVisible();
  await expect(page.locator('.todo-row')).toHaveCount(0);
  expect(errors).toHaveLength(0);
});

test('Planned interaction use case 4: filter path shows All/Active/Completed correctly', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Task title' }).fill('Active action');
  await page.getByRole('button', { name: 'Add task' }).click();
  await page.getByRole('textbox', { name: 'Task title' }).fill('Completed action');
  await page.getByRole('button', { name: 'Add task' }).click();
  await page.getByRole('button', { name: 'Mark task Completed action as completed' }).click();

  await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(page.locator('.todo-row')).toHaveCount(2);
  await page.getByRole('button', { name: 'Active', exact: true }).click();
  await expect(page.locator('.todo-row')).toHaveCount(1);
  await expect(page.getByText('2 total, 1 active, 1 completed')).toBeVisible();
  await page.getByRole('button', { name: 'Completed', exact: true }).click();
  await expect(page.locator('.todo-row')).toHaveCount(1);
});

test('Planned interaction use case 5: responsive flow still works at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const titleInput = page.getByRole('textbox', { name: 'Task title' });
  const addButton = page.getByRole('button', { name: 'Add task' });

  await expect(titleInput).toBeVisible();
  await expect(addButton).toBeVisible();

  await titleInput.fill('Mobile flow');
  await addButton.click();
  await expect(page.getByRole('button', { name: 'Mark task Mobile flow as completed' })).toBeVisible();
  await page.getByRole('button', { name: 'Mark task Mobile flow as completed' }).click();
  await page.getByRole('button', { name: 'Completed', exact: true }).click();
  await expect(page.locator('.todo-row')).toHaveCount(1);
  await clickDeleteConfirm(page, 'Mobile flow', 'cancel');
  await expect(page.getByText('Mobile flow')).toBeVisible();
  await page.getByRole('button', { name: 'Delete task Mobile flow' }).click();
  await page.getByRole('button', { name: 'Confirm delete Mobile flow' }).click();
  await expect(page.locator('.todo-row')).toHaveCount(0);
  await expect(page.getByText('No tasks yet. Add a task to get started.')).toBeVisible();
});
