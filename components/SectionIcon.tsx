import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface SectionIconProps {
  icon: LucideIcon;
  className?: string;
  size?: number | string;
  withContainer?: boolean;
}

/**
 * Standardized SectionIcon component.
 * By default, all section icons use their section color directly with a transparent background.
 * If an icon container/background is used anywhere, it renders the exact same shared container
 * with identical size, padding, shape, background treatment, and behavior across all screens.
 */
export const SectionIcon: React.FC<SectionIconProps> = ({
  icon: Icon,
  className = '',
  size = 20,
  withContainer = false,
}) => {
  if (withContainer) {
    return (
      <div className="w-10 h-10 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700/70 flex items-center justify-center shrink-0">
        <Icon className={`w-5 h-5 shrink-0 ${className}`} />
      </div>
    );
  }

  return (
    <Icon 
      className={`shrink-0 ${className}`} 
      style={{ width: size, height: size }} 
    />
  );
};

export default SectionIcon;
