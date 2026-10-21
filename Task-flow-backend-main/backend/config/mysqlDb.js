const mysql = require("mysql2/promise");

// MySQL Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "taskflow_db",
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
});

async function initDB() {
  try {
    const connection = await pool.getConnection();
    console.log("✅ MySQL Connected successfully to database: taskflow_db");

    // Create tables
    await connection.query(`
      CREATE TABLE IF NOT EXISTS collections (
        collection_name VARCHAR(100) NOT NULL,
        _id VARCHAR(50) NOT NULL,
        data JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (collection_name, _id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        status VARCHAR(50) DEFAULT 'Active',
        permissions JSON,
        company_id VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        value VARCHAR(100) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS task_statuses (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        status VARCHAR(50) DEFAULT 'Active',
        project_id VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS ratings (
        id VARCHAR(50) PRIMARY KEY,
        employee_id VARCHAR(50) NOT NULL,
        rated_by VARCHAR(50) NOT NULL,
        company_id VARCHAR(50),
        project_id VARCHAR(50),
        task_id VARCHAR(50),
        score INT NOT NULL DEFAULT 5,
        category VARCHAR(100) DEFAULT 'Overall Performance',
        review_period VARCHAR(100) DEFAULT 'General Review',
        feedback TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_emp (employee_id),
        INDEX idx_comp (company_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS chat_conversations (
        id VARCHAR(50) PRIMARY KEY,
        type VARCHAR(20) DEFAULT 'direct',
        name VARCHAR(150),
        participants JSON,
        client_participants JSON,
        created_by VARCHAR(50),
        company_id VARCHAR(50),
        last_message JSON,
        is_archived TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id VARCHAR(50) PRIMARY KEY,
        conversation_id VARCHAR(50) NOT NULL,
        sender_id VARCHAR(50) NOT NULL,
        sender_name VARCHAR(150),
        sender_image VARCHAR(255),
        text TEXT,
        file_url VARCHAR(255),
        file_name VARCHAR(255),
        read_by JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_conv (conversation_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS staff (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(150),
        email VARCHAR(150) UNIQUE,
        password VARCHAR(255),
        role VARCHAR(100),
        position VARCHAR(100),
        status VARCHAR(50) DEFAULT 'Active',
        phone VARCHAR(50),
        company_id VARCHAR(50),
        reset_password_token VARCHAR(255),
        reset_password_expires BIGINT,
        image VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(255),
        description TEXT,
        status VARCHAR(50),
        priority VARCHAR(50),
        project VARCHAR(100),
        assigned_to VARCHAR(100),
        due_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(150),
        description TEXT,
        status VARCHAR(50) DEFAULT 'Active',
        assigned_to JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        user_name VARCHAR(150),
        user_email VARCHAR(150),
        date DATE NOT NULL,
        clock_in DATETIME,
        clock_out DATETIME,
        work_mode VARCHAR(50) DEFAULT 'Office',
        break_start DATETIME,
        break_end DATETIME,
        total_break_minutes INT DEFAULT 0,
        total_hours DECIMAL(5,2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'Present',
        notes TEXT,
        is_regularized TINYINT(1) DEFAULT 0,
        only_admin_clock_out TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY user_date_unique (user_id, date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Ensure columns exist in attendance
    try {
      await connection.query("ALTER TABLE attendance ADD COLUMN only_admin_clock_out TINYINT(1) DEFAULT 0");
    } catch (_) {}
    try {
      await connection.query("ALTER TABLE attendance ADD COLUMN auto_clock_out TINYINT(1) DEFAULT 0");
    } catch (_) {}
    try {
      await connection.query("ALTER TABLE attendance ADD COLUMN missed_clock_out TINYINT(1) DEFAULT 0");
    } catch (_) {}
    try {
      await connection.query("ALTER TABLE attendance ADD COLUMN is_late_instance TINYINT(1) DEFAULT 0");
    } catch (_) {}
    try {
      await connection.query("ALTER TABLE attendance ADD COLUMN late_minutes INT DEFAULT 0");
    } catch (_) {}
    try {
      await connection.query("ALTER TABLE attendance ADD COLUMN first_half_deducted TINYINT(1) DEFAULT 0");
    } catch (_) {}

    await connection.query(`
      CREATE TABLE IF NOT EXISTS attendance_settings (
        id VARCHAR(50) PRIMARY KEY DEFAULT 'default_settings',
        monthly_late_instances INT DEFAULT 3,
        late_grace_minutes INT DEFAULT 30,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Ensure default attendance settings exist
    try {
      const [existingSettings] = await connection.query("SELECT COUNT(*) as count FROM attendance_settings");
      if (existingSettings[0].count === 0) {
        await connection.query(`
          INSERT INTO attendance_settings (id, monthly_late_instances, late_grace_minutes)
          VALUES ('default_settings', 3, 30)
        `);
        console.log("✅ Seeded default attendance settings (3 monthly late instances, 30 min grace)");
      }
    } catch (_) {}

    await connection.query(`
      CREATE TABLE IF NOT EXISTS break_logs (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        user_name VARCHAR(150),
        user_email VARCHAR(150),
        company_id VARCHAR(50),
        date DATE NOT NULL,
        start_time DATETIME NOT NULL,
        end_time DATETIME,
        duration_minutes INT DEFAULT 0,
        reason VARCHAR(255) DEFAULT 'Break',
        status VARCHAR(50) DEFAULT 'On Break',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_date (user_id, date),
        INDEX idx_company (company_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS break_types (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        duration_minutes INT DEFAULT 15,
        window_start VARCHAR(10) DEFAULT '00:00',
        window_end VARCHAR(10) DEFAULT '23:59',
        company_id VARCHAR(50),
        status VARCHAR(50) DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_company (company_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS work_schedules (
        id VARCHAR(50) PRIMARY KEY,
        day_of_week VARCHAR(20) NOT NULL,
        is_working_day TINYINT(1) DEFAULT 1,
        clock_in_time VARCHAR(10) DEFAULT '09:30',
        clock_out_time VARCHAR(10) DEFAULT '18:30',
        saturday_rule VARCHAR(30) DEFAULT '2nd_4th_off',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_day (day_of_week)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Ensure columns exist if table was already created
    try {
      const [colCheck] = await connection.query("SHOW COLUMNS FROM work_schedules LIKE 'saturday_rule'");
      if (colCheck.length === 0) {
        await connection.query("ALTER TABLE work_schedules ADD COLUMN saturday_rule VARCHAR(30) DEFAULT '2nd_4th_off'");
      }
    } catch (e) {}

    // Seed default weekday work schedules
    const [existingSchedules] = await connection.query("SELECT COUNT(*) as count FROM work_schedules");
    if (existingSchedules[0].count === 0) {
      await connection.query(`
        INSERT INTO work_schedules (id, day_of_week, is_working_day, clock_in_time, clock_out_time)
        VALUES 
          ('sched_1', 'Monday', 1, '09:30', '18:30'),
          ('sched_2', 'Tuesday', 1, '09:30', '18:30'),
          ('sched_3', 'Wednesday', 1, '09:30', '18:30'),
          ('sched_4', 'Thursday', 1, '09:30', '18:30'),
          ('sched_5', 'Friday', 1, '09:30', '18:30'),
          ('sched_6', 'Saturday', 0, '09:30', '14:00'),
          ('sched_7', 'Sunday', 0, '00:00', '00:00')
      `);
      console.log("✅ Seeded default work schedules (Mon-Fri 09:30 - 18:30)");
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS test_cases (
        id VARCHAR(50) PRIMARY KEY,
        project_id VARCHAR(50),
        project_name VARCHAR(150),
        module_name VARCHAR(100),
        title VARCHAR(255) NOT NULL,
        preconditions TEXT,
        steps TEXT,
        expected_result TEXT,
        actual_result TEXT,
        status VARCHAR(50) DEFAULT 'Not Executed',
        severity VARCHAR(50) DEFAULT 'Medium',
        created_by VARCHAR(150),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS qa_bugs (
        id VARCHAR(50) PRIMARY KEY,
        project_id VARCHAR(50),
        project_name VARCHAR(150),
        test_case_id VARCHAR(50),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        steps_to_reproduce TEXT,
        severity VARCHAR(50) DEFAULT 'Major',
        status VARCHAR(50) DEFAULT 'Open',
        assigned_to VARCHAR(150),
        reported_by VARCHAR(150),
        environment VARCHAR(100) DEFAULT 'Staging',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS leave_balances (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL UNIQUE,
        user_name VARCHAR(150),
        cl_balance INT DEFAULT 12,
        sl_balance INT DEFAULT 8,
        pl_balance INT DEFAULT 15,
        comp_off INT DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS leave_requests (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        user_name VARCHAR(150),
        user_email VARCHAR(150),
        leave_type VARCHAR(50) NOT NULL,
        from_date DATE NOT NULL,
        to_date DATE NOT NULL,
        day_type VARCHAR(50) DEFAULT 'Full Day',
        total_days DECIMAL(4,1) DEFAULT 1.0,
        reason TEXT,
        status VARCHAR(50) DEFAULT 'Pending',
        approved_by VARCHAR(150),
        rejection_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS short_leaves (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        user_name VARCHAR(150),
        date DATE NOT NULL,
        from_time VARCHAR(20) NOT NULL,
        to_time VARCHAR(20) NOT NULL,
        hours DECIMAL(3,1) DEFAULT 2.0,
        reason TEXT,
        status VARCHAR(50) DEFAULT 'Pending',
        approved_by VARCHAR(150),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS timesheets (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        user_name VARCHAR(150),
        user_email VARCHAR(150),
        project_id VARCHAR(50) NOT NULL,
        project_name VARCHAR(150),
        task_id VARCHAR(50),
        task_title VARCHAR(255),
        subtask_id VARCHAR(50),
        subtask_title VARCHAR(255),
        date DATE NOT NULL,
        hours DECIMAL(4,2) NOT NULL DEFAULT 0.00,
        description TEXT NOT NULL,
        is_billable TINYINT(1) DEFAULT 1,
        task_status VARCHAR(50) DEFAULT 'In Process',
        status VARCHAR(50) DEFAULT 'Submitted',
        approved_by VARCHAR(150),
        rejection_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_date (user_id, date),
        INDEX idx_project (project_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Ensure subtasks table exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS subtasks (
        id VARCHAR(50) PRIMARY KEY,
        task_id VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'Pending',
        assigned_to VARCHAR(150),
        start_date DATE,
        end_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_subtask_task (task_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Ensure internal_tickets table exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS internal_tickets (
        id VARCHAR(50) PRIMARY KEY,
        ticket_number VARCHAR(50) UNIQUE NOT NULL,
        user_id VARCHAR(100) NOT NULL,
        user_name VARCHAR(150) NOT NULL,
        user_email VARCHAR(150) NOT NULL,
        category VARCHAR(100) NOT NULL,
        item_type VARCHAR(100),
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        priority VARCHAR(50) DEFAULT 'Medium',
        status VARCHAR(50) DEFAULT 'Open',
        admin_remarks TEXT,
        assigned_to VARCHAR(150),
        resolved_at DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_ticket_user (user_id),
        INDEX idx_ticket_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Alter timesheets table if columns do not exist
    try { await connection.query(`ALTER TABLE timesheets ADD COLUMN subtask_id VARCHAR(50) AFTER task_title`); } catch (e) {}
    try { await connection.query(`ALTER TABLE timesheets ADD COLUMN subtask_title VARCHAR(255) AFTER subtask_id`); } catch (e) {}
    try { await connection.query(`ALTER TABLE timesheets ADD COLUMN task_status VARCHAR(50) DEFAULT 'In Process' AFTER is_billable`); } catch (e) {}
    try { await connection.query(`ALTER TABLE tasks ADD COLUMN start_date DATE`); } catch (e) {}
    try { await connection.query(`ALTER TABLE tasks ADD COLUMN end_date DATE`); } catch (e) {}

    connection.release();
    console.log("✅ MySQL Tables ready in phpMyAdmin (taskflow_db)");
  } catch (err) {
    console.error("❌ MySQL Connection/Init Error:", err);
    throw err;
  }
}

module.exports = { pool, initDB };
