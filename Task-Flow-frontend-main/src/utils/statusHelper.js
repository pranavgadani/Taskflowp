// Status color helper utility for consistent status styling across the application

export const getStatusBadgeClass = (status) => {
  if (!status) return 'badge-secondary';
  
  const statusLower = status.toString().toLowerCase().replace(/\s+/g, '-');
  
  const statusMap = {
    // Active/Inactive states
    'active': 'badge-success',
    'inactive': 'badge-danger',
    'enabled': 'badge-success',
    'disabled': 'badge-danger',
    'online': 'badge-success',
    'offline': 'badge-danger',
    
    // Task statuses
    'pending': 'badge-warning',
    'in-progress': 'badge-secondary',
    'inprogress': 'badge-secondary',
    'progress': 'badge-secondary',
    'completed': 'badge-primary',
    'complete': 'badge-primary',
    'done': 'badge-primary',
    'cancelled': 'badge-secondary',
    'canceled': 'badge-secondary',
    'on-hold': 'badge-warning',
    'hold': 'badge-warning',
    'blocked': 'badge-danger',
    'review': 'badge-info',
    'testing': 'badge-info',
    'deployed': 'badge-success',
    'live': 'badge-success',
    
    // Priority levels
    'high': 'badge-danger',
    'medium': 'badge-warning',
    'low': 'badge-success',
    'critical': 'badge-danger',
    'urgent': 'badge-danger',
    'normal': 'badge-secondary',
    
    // Common statuses
    'new': 'badge-info',
    'open': 'badge-info',
    'closed': 'badge-secondary',
    'resolved': 'badge-success',
    'rejected': 'badge-danger',
    'approved': 'badge-success',
    'denied': 'badge-danger',
    'draft': 'badge-secondary',
    'published': 'badge-success',
    'archived': 'badge-secondary',
    'deleted': 'badge-danger',
    'removed': 'badge-danger',
    
    // Payment/Financial statuses
    'paid': 'badge-success',
    'unpaid': 'badge-warning',
    'overdue': 'badge-danger',
    'pending-payment': 'badge-warning',
    'refunded': 'badge-secondary',
    'failed': 'badge-danger',
    'processing': 'badge-info',
    
    // User/Account statuses
    'verified': 'badge-success',
    'unverified': 'badge-warning',
    'suspended': 'badge-danger',
    'banned': 'badge-danger',
    'guest': 'badge-secondary',
    'admin': 'badge-primary',
    'moderator': 'badge-info',
    
    // System statuses
    'healthy': 'badge-success',
    'unhealthy': 'badge-danger',
    'maintenance': 'badge-warning',
    'degraded': 'badge-warning',
    'operational': 'badge-success',
    'down': 'badge-danger',
    'error': 'badge-danger',
    'warning': 'badge-warning',
    'info': 'badge-info'
  };
  
  return statusMap[statusLower] || 'badge-secondary';
};

export const getStatusColor = (status) => {
  const badgeClass = getStatusBadgeClass(status);
  
  const colorMap = {
    'badge-success': { bg: '#e3fcef', color: '#006644', border: '#abf5d1' },
    'badge-warning': { bg: '#fff4b3', color: '#973f00', border: '#ffe58f' },
    'badge-danger': { bg: '#ffebe6', color: '#de350b', border: '#ffbdad' },
    'badge-primary': { bg: '#e4f0ff', color: '#0052cc', border: '#b3d4ff' },
    'badge-secondary': { bg: '#f4f5f7', color: '#6b778c', border: '#dfe1e6' },
    'badge-info': { bg: '#e4f0ff', color: '#0052cc', border: '#b3d4ff' }
  };
  
  return colorMap[badgeClass] || colorMap['badge-secondary'];
};

export const formatStatusText = (status) => {
  if (!status) return 'Unknown';
  
  // Convert to title case and replace common abbreviations
  return status
    .toString()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .replace(/Id$/i, 'ID')
    .replace(/Url$/i, 'URL')
    .replace(/Api$/i, 'API')
    .replace(/Sql$/i, 'SQL')
    .replace(/Html$/i, 'HTML')
    .replace(/Css$/i, 'CSS')
    .replace(/Js$/i, 'JavaScript')
    .replace(/Ui$/i, 'UI')
    .replace(/Ux$/i, 'UX');
};

// React component helper for rendering status badges
// Note: This should be used in .jsx files, not .js files
export const createStatusBadge = (status, children, className = '') => {
  const badgeClass = getStatusBadgeClass(status);
  const formattedText = children || formatStatusText(status);
  
  return {
    className: `badge ${badgeClass} ${className}`,
    text: formattedText
  };
};

export default {
  getStatusBadgeClass,
  getStatusColor,
  formatStatusText,
  createStatusBadge
};
