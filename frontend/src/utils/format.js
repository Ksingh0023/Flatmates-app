// Format INR currency
export function formatINR(amount) {
  if (amount === null || amount === undefined) return '—';
  const num = parseFloat(amount);
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0
  }).format(num);
}

// Format any currency
export function formatCurrency(amount, currency = 'INR') {
  if (amount === null || amount === undefined) return '—';
  const num = parseFloat(amount);
  if (isNaN(num)) return '—';
  if (currency === 'INR') return formatINR(num);
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency, maximumFractionDigits: 2
  }).format(num);
}

// Format date to display
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Get initials from name
export function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
}

// Avatar color class from name
const COLORS = ['avatar-0','avatar-1','avatar-2','avatar-3','avatar-4','avatar-5'];
export function getAvatarColor(name) {
  if (!name) return COLORS[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return COLORS[Math.abs(h) % COLORS.length];
}

// Split type display name
export const SPLIT_TYPE_LABELS = {
  equal:      'Equal',
  unequal:    'Unequal',
  percentage: 'Percentage',
  share:      'Share-weighted'
};

// Badge color by split type
export const SPLIT_TYPE_BADGES = {
  equal:      'badge-blue',
  unequal:    'badge-purple',
  percentage: 'badge-yellow',
  share:      'badge-green'
};
