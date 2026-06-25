import { test, expect } from '@playwright/test';

test('Happy path: add, complete, filter to Completed, then delete', async ({ page }) => {
  await page.goto('/');

  const allFilter = page.locator('button.filter-button', { hasText: 'All' });
  const completedFilter = page.locator('button.filter-button', { hasText: 'Completed' });

  await page.getByRole('textbox', { name: 'Task title' }).fill('Write tests');
  await page.getByRole('button', { name: 'Add task' }).click();
  await expect(page.locator('.todo-row')).toHaveCount(4);

  await page.getByRole('button', { name: 'Mark task Write tests as completed' }).click();
  await allFilter.click();
  await completedFilter.click();
  await expect(page.locator('.todo-row')).toHaveCount(2);

  await page.getByRole('button', { name: 'Delete task Write tests' }).click();
  await expect(page.locator('.todo-row')).toHaveCount(1);
  await expect(page.getByText('3 total, 2 active, 1 completed')).toBeVisible();
});

test('Validation path: blank submission should show feedback and not add', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('textbox', { name: 'Task title' }).fill('   ');
  await page.getByRole('button', { name: 'Add task' }).click();
  await expect(page.getByText('Task title is required')).toBeVisible();
  await expect(page.locator('.todo-row')).toHaveCount(3);
  await expect(page.getByText('3 total, 2 active, 1 completed')).toBeVisible();
});

test('Filter path: All, Active, Completed show expected rows', async ({ page }) => {
  await page.goto('/');
  const allFilter = page.locator('button.filter-button', { hasText: 'All' });
  const activeFilter = page.locator('button.filter-button', { hasText: 'Active' });
  const completedFilter = page.locator('button.filter-button', { hasText: 'Completed' });

  await page.getByRole('textbox', { name: 'Task title' }).fill('Active action');
  await page.getByRole('button', { name: 'Add task' }).click();
  await page.getByRole('textbox', { name: 'Task title' }).fill('Completed action');
  await page.getByRole('button', { name: 'Add task' }).click();
  await page.getByRole('button', { name: 'Mark task Completed action as completed' }).click();

  await allFilter.click();
  await expect(page.locator('.todo-row')).toHaveCount(5);
  await activeFilter.click();
  await expect(page.locator('.todo-row')).toHaveCount(3);
  await completedFilter.click();
  await expect(page.locator('.todo-row')).toHaveCount(2);
  await expect(page.getByText('5 total, 3 active, 2 completed')).toBeVisible();
});

test('Empty path: deleting all todos shows empty state', async ({ page }) => {
  await page.goto('/');

  const deleteButtons = page.getByRole('button', { name: /^Delete task / });
  const count = await deleteButtons.count();
  for (let index = 0; index < count; index += 1) {
    await deleteButtons.first().click();
  }

  await expect(page.getByText('No tasks yet. Add a task to get started.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('0 total, 0 active, 0 completed')).toBeVisible();
});

test('Responsive path: add, toggle, delete at 390px width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const completedFilter = page.locator('button.filter-button', { hasText: 'Completed' });

  const titleInput = page.getByRole('textbox', { name: 'Task title' });
  const addButton = page.getByRole('button', { name: 'Add task' });

  await expect(titleInput).toBeVisible();
  await expect(addButton).toBeVisible();
  await expect(completedFilter).toBeVisible();

  await titleInput.fill('Mobile flow');
  await addButton.click();
  await page.getByRole('button', { name: 'Mark task Mobile flow as completed' }).click();
  await completedFilter.click();
  await expect(page.locator('.todo-row')).toHaveCount(2);
  await page.getByRole('button', { name: 'Delete task Mobile flow' }).click();
  await expect(page.locator('.todo-row')).toHaveCount(1);
});
