import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionContext';

const ProtectedRoute = ({ children, permissionValue, action = 'read', fallback = null }) => {
  const { user, loading: authLoading } = useAuth();
  const { hasPermission, loading: permLoading } = usePermissions();

  if (authLoading || permLoading) {
    return null; // or a loading spinner
  }

  const isSuperAdmin = user?.email === "gadanipranav@gmail.com" || user?.role?.name === "Super Admin";

  if (isSuperAdmin || hasPermission(permissionValue, action)) {
    return children;
  }

  return fallback || null;
};

export default ProtectedRoute;
