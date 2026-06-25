import { test, expect } from '@playwright/test';

test('Planned interaction use case 1: happy path add, complete, filter completed, and delete', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('textbox', { name: 'Task title' }).fill('Write tests');
  await page.getByRole('button', { name: 'Add task' }).click();
  await expect(page.locator('.todo-row')).toHaveCount(4);

  await page.getByRole('button', { name: 'Mark task Write tests as completed' }).click();
  await page.getByRole('button', { name: 'Completed', exact: true }).click();
  await expect(page.locator('.todo-row')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Delete task Write tests' })).toBeVisible();

  await page.getByRole('button', { name: 'Delete task Write tests' }).click();
  await expect(page.locator('.todo-row')).toHaveCount(1);
  await expect(page.getByText('3 total, 2 active, 1 completed')).toBeVisible();
});

test('Planned interaction use case 2: validation path blocks blank submissions', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('textbox', { name: 'Task title' }).fill('   ');
  await page.getByRole('button', { name: 'Add task' }).click();
  await expect(page.getByText('Task title is required')).toBeVisible();
  await expect(page.locator('.todo-row')).toHaveCount(3);
  await expect(page.getByText('3 total, 2 active, 1 completed')).toBeVisible();
});

test('Planned interaction use case 3: filter path shows All/Active/Completed correctly', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('textbox', { name: 'Task title' }).fill('Active action');
  await page.getByRole('button', { name: 'Add task' }).click();
  await page.getByRole('textbox', { name: 'Task title' }).fill('Completed action');
  await page.getByRole('button', { name: 'Add task' }).click();
  await page.getByRole('button', { name: 'Mark task Completed action as completed' }).click();

  await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(page.locator('.todo-row')).toHaveCount(5);
  await page.getByRole('button', { name: 'Active', exact: true }).click();
  await expect(page.locator('.todo-row')).toHaveCount(3);
  await expect(page.getByText('5 total, 3 active, 2 completed')).toBeVisible();
  await page.getByRole('button', { name: 'Completed', exact: true }).click();
  await expect(page.locator('.todo-row')).toHaveCount(2);
});

test('Planned interaction use case 4: empty path shows empty state after deleting todos', async ({ page }) => {
  await page.goto('/');

  const deleteButtons = page.getByRole('button', { name: /^Delete task / });
  const count = await deleteButtons.count();
  for (let index = 0; index < count; index += 1) {
    await deleteButtons.first().click();
  }

  await expect(page.getByText('No tasks yet. Add a task to get started.')).toBeVisible();
  await expect(page.getByText('0 total, 0 active, 0 completed')).toBeVisible();
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
  await expect(page.locator('.todo-row')).toHaveCount(2);
  await page.getByRole('button', { name: 'Delete task Mobile flow' }).click();
  await expect(page.locator('.todo-row')).toHaveCount(1);
});
