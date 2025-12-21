
export const CURRENCIES = {
  INR: { symbol: '₹', name: 'Indian Rupee', locale: 'en-IN' },
  USD: { symbol: '$', name: 'US Dollar', locale: 'en-US' }
};

export const getActiveCompanyId = () => localStorage.getItem('activeCompanyId') || '';

export const getAppSettings = () => {
  const cid = getActiveCompanyId();
  const s = localStorage.getItem(`appSettings_${cid}`);
  try {
    return s ? JSON.parse(s) : { currency: 'INR', dateFormat: 'DD/MM/YYYY' };
  } catch (e) {
    return { currency: 'INR', dateFormat: 'DD/MM/YYYY' };
  }
};

export const saveAppSettings = (settings: any) => {
  const cid = getActiveCompanyId();
  localStorage.setItem(`appSettings_${cid}`, JSON.stringify(settings));
};

export const formatCurrency = (amount: number | undefined | null) => {
  if (amount === undefined || amount === null || isNaN(amount)) return '';
  const { currency } = getAppSettings();
  const config = CURRENCIES[currency as keyof typeof CURRENCIES] || CURRENCIES.INR;
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  }).format(amount);
};

export const formatDate = (iso: any) => {
  if (!iso || typeof iso !== 'string') return '';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
};

export const parseDateFromInput = (input: string): string | null => {
  if (!input) return null;
  const parts = input.split(/[\/\-\.]/);
  if (parts.length !== 3) return null;
  let [d, m, y] = parts;
  if (y.length === 2) {
    const currentYearPrefix = new Date().getFullYear().toString().slice(0, 2);
    y = currentYearPrefix + y;
  }
  const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  const dateObj = new Date(iso);
  return isNaN(dateObj.getTime()) ? null : iso;
};

export const getDatePlaceholder = () => 'DD/MM/YYYY';

export const toDisplayValue = (value: any) => {
  const num = parseFloat(value);
  return isNaN(num) ? 0 : num;
};

export const toStorageValue = (value: any) => {
  const num = parseFloat(value);
  return isNaN(num) ? 0 : num;
};

export const moveToTrash = (type: string, label: string, data: any) => {
  const cid = getActiveCompanyId();
  const trashKey = `trash_${cid}`;
  const existingTrash = JSON.parse(localStorage.getItem(trashKey) || '[]');
  
  const newItem = {
    id: Date.now().toString(),
    type,
    label,
    data,
    deletedAt: new Date().toISOString()
  };
  
  localStorage.setItem(trashKey, JSON.stringify([newItem, ...existingTrash]));
};
