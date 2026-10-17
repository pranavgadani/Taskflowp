# Role-Based Permission System

## Overview
This system provides role-based access control with granular permissions for each module.

## Database Structure

### Permissions
- **Collection**: `permissions`
- **Fields**: `name`, `value`
- **Default Permissions**:
  - Staff Management (`staff_management`)
  - Task Management (`task_management`)
  - Role Management (`role_management`)
  - Permission Management (`permission_management`)
  - Task Status Management (`task_status_management`)
  - View Dashboard (`view_dashboard`)
  - View Reports (`view_reports`)
  - Assign Tasks (`assign_tasks`)
  - Edit Tasks (`edit_tasks`)
  - Delete Tasks (`delete_tasks`)

### Roles
- **Collection**: `roles`
- **Fields**: `name`, `status`, `permissions`
- **Permission Structure**:
  ```javascript
  {
    permissionId: ObjectId, // Reference to Permission
    all: Boolean,           // Full access
    create: Boolean,        // Create access
    read: Boolean,         // Read access
    update: Boolean,       // Update access
    delete: Boolean        // Delete access
  }
  ```

### Default Roles
1. **Admin**: Full access to all permissions (all: true)
2. **Manager**: Most permissions except delete roles/permissions
3. **Staff**: Basic permissions (read tasks, view dashboard)

## API Endpoints

### Permissions
- `GET /api/permissions` - Get all permissions
- `POST /api/permissions` - Create permission
- `PUT /api/permissions/:id` - Update permission
- `DELETE /api/permissions/:id` - Delete permission

### Roles
- `GET /api/roles` - Get all roles with populated permissions
- `GET /api/roles/:id` - Get specific role with permissions
- `POST /api/roles` - Create role with permissions
- `PUT /api/roles/:id` - Update role permissions
- `DELETE /api/roles/:id` - Delete role

### User Permissions
- `GET /api/user-permissions` - Get current user's permissions (requires auth)

## Frontend Implementation Guide

### Role Management Component
When adding/editing roles, display checkboxes for each permission:

```javascript
// Example role data structure
{
  name: "Manager",
  status: "Active",
  permissions: [
    {
      permissionId: "permission_id",
      all: false,
      create: true,
      read: true,
      update: true,
      delete: false
    }
  ]
}
```

### Checkbox Logic
- **All checkbox**: When checked, enables all other checkboxes
- **Individual checkboxes**: Work independently unless "All" is checked
- **Permission groups**: Group permissions by module (Staff, Tasks, Roles, etc.)

### Permission Checking
Use middleware to protect routes:
```javascript
const { checkPermission } = require('./middleware/permissions');

// Protect task creation
router.post('/', checkPermission('task_management', 'create'), (req, res) => {
  // Only users with task_management create permission can access
});

// Protect staff deletion
router.delete('/:id', checkPermission('staff_management', 'delete'), (req, res) => {
  // Only users with staff_management delete permission can access
});
```

### Frontend Permission Display
- Fetch user permissions from `/api/user-permissions`
- Show/hide menu items based on permissions
- Disable buttons for actions user doesn't have permission for
- Show permission warnings when attempting restricted actions

## Usage Examples

### Creating a Role with Permissions
```javascript
POST /api/roles
{
  "name": "Supervisor",
  "status": "Active",
  "permissions": [
    {
      "permissionId": "permission_id_for_task_management",
      "all": false,
      "create": true,
      "read": true,
      "update": true,
      "delete": false
    }
  ]
}
```

### Checking User Permissions
```javascript
// Response from /api/user-permissions
[
  {
    "permissionId": "permission_id",
    "name": "Task Management",
    "value": "task_management",
    "all": false,
    "create": true,
    "read": true,
    "update": true,
    "delete": false
  }
]
```

## Security Features
- JWT-based authentication
- Role-based access control
- Granular permission system
- Middleware protection for API routes
- Automatic permission validation

## Next Steps for Frontend
1. Create role management UI with permission checkboxes
2. Implement permission-based menu visibility
3. Add permission checks to all CRUD operations
4. Display user permissions in profile/settings
5. Handle permission denied scenarios gracefully
