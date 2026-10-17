const { test, expect } = require('@playwright/test');
const { queryMySQL } = require('../../utils/dbHelper');

test.describe('Database Sync Mongo to MySQL @sync', () => {
  test('MySQL taskflow_db connection and tables check', async () => {
    const tables = await queryMySQL('SHOW TABLES;');
    expect(tables.length).toBeGreaterThan(0);
  });

  test('Staff records exist in MySQL staff table', async () => {
    const staff = await queryMySQL('SELECT * FROM staff LIMIT 5;');
    expect(staff.length).toBeGreaterThan(0);
  });
});
