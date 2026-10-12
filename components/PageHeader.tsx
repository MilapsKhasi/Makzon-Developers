import React, { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import SectionIcon from './SectionIcon';

export interface PageHeaderProps {
  icon?: LucideIcon;
  iconColor?: string;
  withIconContainer?: boolean;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/**
 * Shared PageHeader component for all first-level ZenterPrime pages.
 * Normalizes title hierarchy, subtitle styling, icon slot placement,
 * and right-side action slot across the application.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  icon,
  iconColor,
  withIconContainer = true,
  title,
  subtitle,
  badge,
  actions,
  className = ''
}) => {
  let location: any = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    location = useLocation();
  } catch {
    // outside router context fallback
  }

  const path = location?.pathname || '';

  const resolvedIconColor = iconColor || (() => {
    // Sales: Green
    if (path.startsWith('/sales') || path.startsWith('/receive-payment') || path.startsWith('/delivery-challan')) {
      return 'text-emerald-600 dark:text-emerald-400';
    }
    // Purchases: Violet
    if (path.startsWith('/bills') || path.startsWith('/make-payment') || path.startsWith('/purchases')) {
      return 'text-violet-600 dark:text-violet-400';
    }
    // Stock: Teal blue
    if (path.startsWith('/stock')) {
      return 'text-teal-600 dark:text-teal-400';
    }
    // Parties: Orange
    if (path.startsWith('/parties')) {
      return 'text-orange-500 dark:text-orange-400';
    }
    // Others: Blue
    if (path.startsWith('/cashbook') || path.startsWith('/additional-charges') || path.startsWith('/reports') || path.startsWith('/masters')) {
      return 'text-blue-600 dark:text-blue-400';
    }
    // Dashboard: As it is
    return 'text-slate-700 dark:text-slate-200';
  })();

  return (
    <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${className}`}>
      {/* Icon + Title + Subtitle */}
      <div className="flex items-center space-x-3 min-w-0">
        {icon && (
          <div className="shrink-0 flex items-center justify-center">
            <SectionIcon 
              icon={icon} 
              className={resolvedIconColor} 
              withContainer={withIconContainer} 
              size={22}
            />
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center space-x-2 flex-wrap">
            <h1 
              style={{ fontFamily: 'Ubuntu', fontWeight: 'normal', lineHeight: '30px' }}
              className="text-xl font-normal text-slate-900 dark:text-white tracking-tight capitalize truncate"
            >
              {title}
            </h1>
            {badge}
          </div>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right-side Action Slot */}
      {actions && (
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-start sm:justify-end shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
