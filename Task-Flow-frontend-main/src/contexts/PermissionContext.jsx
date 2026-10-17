import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import API from '../api/api';
import { useAuth } from './AuthContext';

const PermissionContext = createContext();

export const usePermissions = () => {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
};

export const PermissionProvider = ({ children }) => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [permissionsUser, setPermissionsUser] = useState(null);

  useEffect(() => {
    const loadPermissions = async () => {
      if (!user) {
        setPermissions([]);
        setPermissionsUser(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const response = await API.get('/user-permissions');
        setPermissions(response.data || []);
        setPermissionsUser(user?._id || user);
      } catch (error) {
        console.error("Failed to load permissions:", error);
        setPermissions([]);
      } finally {
        setLoading(false);
      }
    };

    loadPermissions();
  }, [user]);

  const hasPermission = (permissionValue, action = 'read') => {
    const isStillLoading = loading || (user && permissionsUser !== (user?._id || user));
    if (isStillLoading) return false;

    const permission = permissions.find(p => p.value === permissionValue);
    if (!permission) return false;

    return permission.all || permission[action];
  };

  const hasAnyPermission = (permissionValues, action = 'read') => {
    const isStillLoading = loading || (user && permissionsUser !== (user?._id || user));
    if (isStillLoading) return false;

    return permissionValues.some(value => hasPermission(value, action));
  };

  const value = {
    permissions,
    loading: loading || (user && permissionsUser !== (user?._id || user)),
    hasPermission,
    hasAnyPermission,
    refreshPermissions: async () => {
        setLoading(true);
        try {
            const response = await API.get('/user-permissions');
            setPermissions(response.data || []);
        } finally {
            setLoading(false);
        }
    }
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
};
