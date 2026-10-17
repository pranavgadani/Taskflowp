const { pool } = require("./mysqlDb");

/**
 * Sync Mongoose model change to MySQL table
 */
async function syncToMySQL(collectionName, doc) {
  try {
    if (!doc || !doc._id) return;
    const id = doc._id.toString();
    const dataJson = JSON.stringify(doc);

    // 1. Always save in MySQL 'collections' table (Universal store)
    await pool.query(
      `INSERT INTO collections (collection_name, _id, data) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = CURRENT_TIMESTAMP`,
      [collectionName, id, dataJson]
    );

    // 2. Sync to readable MySQL relational tables in taskflow_db
    if (collectionName === "staffs" || collectionName === "staff") {
      await pool.query(
        `INSERT INTO staff (id, name, email, password, role, position, status, phone, company_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           name = VALUES(name), email = VALUES(email), password = VALUES(password),
           role = VALUES(role), position = VALUES(position), status = VALUES(status),
           phone = VALUES(phone), company_id = VALUES(company_id)`,
        [
          id,
          doc.name || "",
          doc.email || "",
          doc.password || "",
          doc.role?.toString() || doc.position || "",
          doc.position || "",
          doc.status || "Active",
          doc.phone || "",
          doc.companyId?.toString() || ""
        ]
      );

      // Auto-provision leave balance for new employee from Company Leave Policy
      try {
        const [policyRows] = await pool.query("SELECT * FROM company_leave_settings WHERE id = 'default_policy' LIMIT 1");
        const policy = policyRows[0] || { cl_default: 12, sl_default: 8, pl_default: 15, comp_off_default: 2 };
        await pool.query(
          `INSERT INTO leave_balances (id, user_id, user_name, user_email, cl_balance, sl_balance, pl_balance, comp_off)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE user_name=VALUES(user_name), user_email=VALUES(user_email)`,
          [`bal_${id}`, id, doc.name || "Employee", doc.email || "", policy.cl_default, policy.sl_default, policy.pl_default, policy.comp_off_default]
        );
      } catch (leaveErr) {
        console.error("Auto leave balance creation error:", leaveErr);
      }
    } else if (collectionName === "tasks" || collectionName === "task") {
      await pool.query(
        `INSERT INTO tasks (id, title, description, status, priority, project, assigned_to, due_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           title = VALUES(title), description = VALUES(description), status = VALUES(status),
           priority = VALUES(priority), project = VALUES(project), assigned_to = VALUES(assigned_to),
           due_date = VALUES(due_date)`,
        [
          id,
          doc.title || "",
          doc.description || "",
          doc.status?.toString() || "",
          doc.priority || "Medium",
          doc.project?.toString() || "",
          doc.assignedTo?.toString() || "",
          doc.dueDate ? new Date(doc.dueDate) : null
        ]
      );
    } else if (collectionName === "projects" || collectionName === "project") {
      await pool.query(
        `INSERT INTO projects (id, name, description, status)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           name = VALUES(name), description = VALUES(description), status = VALUES(status)`,
        [
          id,
          doc.name || "",
          doc.description || "",
          doc.status || "Active"
        ]
      );
    }
  } catch (err) {
    console.error(`MySQL Sync Error for ${collectionName}:`, err.message);
  }
}

function registerMySQLSyncPlugin(schema) {
  schema.post("save", function (doc) {
    syncToMySQL(this.constructor.collection.name, doc.toObject());
  });

  schema.post("findOneAndUpdate", function (doc) {
    if (doc) {
      syncToMySQL(this.model.collection.name, doc.toObject ? doc.toObject() : doc);
    }
  });

  schema.post("insertMany", function (docs) {
    if (Array.isArray(docs)) {
      docs.forEach((doc) => {
        syncToMySQL(this.collection.name, doc.toObject ? doc.toObject() : doc);
      });
    }
  });
}

module.exports = { syncToMySQL, registerMySQLSyncPlugin };
