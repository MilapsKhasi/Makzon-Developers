import React, { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
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
  iconColor = 'text-slate-700 dark:text-slate-200',
  withIconContainer = true,
  title,
  subtitle,
  badge,
  actions,
  className = ''
}) => {
  return (
    <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${className}`}>
      {/* Icon + Title + Subtitle */}
      <div className="flex items-center space-x-3 min-w-0">
        {icon && (
          <div className="shrink-0 flex items-center justify-center">
            <SectionIcon 
              icon={icon} 
              className={iconColor} 
              withContainer={withIconContainer} 
              size={22}
            />
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center space-x-2 flex-wrap">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight capitalize truncate">
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
