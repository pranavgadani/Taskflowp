class Sidebar {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.sidebar = page.locator('.sidebar');
    this.projectDropdown = page.locator('.sidebar-dropdown-header', { hasText: 'Project' });
  }

  getMenuItem(name) {
    return this.sidebar.locator('.sidebar-link, .sidebar-dropdown-item, .sidebar-item-text', { hasText: name });
  }

  async expandProjects() {
    const isArrowUp = await this.sidebar.locator('.dropdown-arrow').textContent();
    if (!isArrowUp.includes('▲')) {
      await this.projectDropdown.click();
    }
  }

  async navigateTo(name) {
    const subItems = ['Projects', 'Task', 'Timesheets', 'Issue', 'Task Status', 'Team', 'Document', 'QA & Testing', 'Clients'];
    if (subItems.includes(name)) {
      await this.expandProjects();
    }
    await this.sidebar.getByText(name, { exact: true }).first().click();
  }
}

module.exports = { Sidebar };
