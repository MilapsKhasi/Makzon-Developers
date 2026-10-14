export const applyEditionTheme = (edition?: string | null) => {
  if (typeof window === 'undefined') return;

  const current = edition || localStorage.getItem('zenter_edition') || localStorage.getItem('zenter_license_type');
  const isProfessional = current === 'professional';

  if (isProfessional) {
    document.documentElement.style.setProperty('--color-primary', '#2563EB'); // Professional Royal Blue
    document.documentElement.style.setProperty('--color-primary-dark', '#1D4ED8');
    document.documentElement.style.setProperty('--color-primary-light', '#DBEAFE');
    document.documentElement.setAttribute('data-edition', 'professional');
  } else {
    document.documentElement.style.setProperty('--color-primary', '#4338ca'); // Standard Violet
    document.documentElement.style.setProperty('--color-primary-dark', '#3730a3');
    document.documentElement.style.setProperty('--color-primary-light', '#e0e7ff');
    document.documentElement.setAttribute('data-edition', 'standard');
  }
};
