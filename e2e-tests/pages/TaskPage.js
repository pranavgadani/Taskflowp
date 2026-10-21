/**
 * Page Object Model: Task Page
 */
class TaskPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;

    this.addTaskBtn    = page.locator('button', { hasText: /Add Task|New Task|\+ Task/i }).first();
    this.taskList      = page.locator('.task-card, [class*="task-item"], [class*="kanban-card"]');
    this.taskNameInput = page.locator('input[placeholder*="task" i], input[name="title"], input[name="task_title"]').first();
    this.saveBtn       = page.locator('button[type="submit"], button', { hasText: /Save|Create|Add/i }).last();
    this.cancelBtn     = page.locator('button', { hasText: /Cancel|Close/i }).first();
    this.modal         = page.locator('.modal, [class*="modal"], [role="dialog"]').first();
  }

  async goto() {
    await this.page.goto('/task');
    await this.page.waitForLoadState('networkidle');
  }

  async openAddTaskModal() {
    await this.addTaskBtn.waitFor({ state: 'visible', timeout: 8000 });
    await this.addTaskBtn.click();
    await this.modal.waitFor({ state: 'visible', timeout: 6000 });
  }

  async fillTaskName(name) {
    await this.taskNameInput.waitFor({ state: 'visible', timeout: 5000 });
    await this.taskNameInput.fill(name);
  }

  async submitForm() {
    await this.saveBtn.click();
    await this.page.waitForTimeout(800);
  }
}

module.exports = { TaskPage };
