import React, { ReactNode } from 'react';
import { 
  BarChart3, FileDown, Search, ArrowLeft, Printer, 
  TrendingUp, ShoppingBag, ArrowDownLeft, ArrowUpRight, 
  Users, Receipt, Loader2, LucideIcon
} from 'lucide-react';
import PageHeader from './PageHeader';

export type ReportTabId = 
  | 'Sales Register'
  | 'Purchases Register'
  | 'Accounts Receivables'
  | 'Accounts Payables'
  | 'Party Ledgers'
  | 'GSTR Summary';

export interface TabConfig {
  id: ReportTabId;
  label: string;
  icon: LucideIcon;
  badgeCount?: number;
}

export const REPORT_TABS_CONFIG: TabConfig[] = [
  { id: 'Sales Register', label: 'Sales Register', icon: TrendingUp },
  { id: 'Purchases Register', label: 'Purchases Register', icon: ShoppingBag },
  { id: 'Accounts Receivables', label: 'Accounts Receivables', icon: ArrowDownLeft },
  { id: 'Accounts Payables', label: 'Accounts Payables', icon: ArrowUpRight },
  { id: 'Party Ledgers', label: 'Party Ledgers', icon: Users },
  { id: 'GSTR Summary', label: 'GSTR Summary', icon: Receipt },
];

/* -------------------------------------------------------------------------- */
/* 1. Main Page Shell                                                        */
/* -------------------------------------------------------------------------- */

interface ReportsEngineShellProps {
  activeTab: ReportTabId;
  onTabChange: (tab: ReportTabId) => void;
  headerDateFilter?: ReactNode;
  onExportClick?: () => void;
  isExportDisabled?: boolean;
  pendingReceivablesCount?: number;
  pendingPayablesCount?: number;
  children: ReactNode;
}

export const ReportsEngineShell: React.FC<ReportsEngineShellProps> = ({
  activeTab,
  onTabChange,
  headerDateFilter,
  onExportClick,
  isExportDisabled = false,
  pendingReceivablesCount,
  pendingPayablesCount,
  children
}) => {
  return (
    <div className="space-y-5">
      {/* Page Header */}
      <PageHeader
        className="print:hidden"
        icon={BarChart3}
        iconColor="text-primary dark:text-primary-light"
        title="Reports Engine"
        subtitle="Tax registers, outstanding receivables & payables, party ledgers and GST analytics"
        actions={
          <>
            {headerDateFilter}
            {onExportClick && (
              <button
                type="button"
                onClick={onExportClick}
                disabled={isExportDisabled}
                className="px-4 py-2 bg-primary text-white font-medium text-xs hover:bg-primary-dark rounded-lg shadow-xs transition-colors flex items-center justify-center disabled:opacity-50 cursor-pointer"
              >
                <FileDown className="w-4 h-4 mr-1.5" />
                <span>Export Statement</span>
              </button>
            )}
          </>
        }
      />

      {/* Main Workspace Frame */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row gap-5 min-h-[580px]">
          
          {/* Side Navigation Menu */}
          <nav 
            aria-label="Reports Navigation"
            className="w-full lg:w-60 flex lg:flex-col overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 gap-1.5 print:hidden shrink-0"
          >
            {REPORT_TABS_CONFIG.map((tab) => {
              const isCurrent = activeTab === tab.id;
              const Icon = tab.icon;
              
              let badge: number | undefined = undefined;
              if (tab.id === 'Accounts Receivables') badge = pendingReceivablesCount;
              if (tab.id === 'Accounts Payables') badge = pendingPayablesCount;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  className={`text-left px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-between cursor-pointer whitespace-nowrap lg:whitespace-normal shrink-0 lg:shrink ${
                    isCurrent
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isCurrent ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
                    <span className="truncate">{tab.label}</span>
                  </div>
                  {typeof badge === 'number' && badge > 0 && (
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ml-2 shrink-0 ${
                      isCurrent 
                        ? 'bg-white/20 text-white' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}>
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Active Report View Canvas */}
          <div className="flex-1 min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col">
            {children}
          </div>

        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 2. Unified Report View Header                                              */
/* -------------------------------------------------------------------------- */

interface ReportViewHeaderProps {
  title: string;
  subtitle: string;
  badge?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  filterControl?: ReactNode;
  actionButton?: ReactNode;
}

export const ReportViewHeader: React.FC<ReportViewHeaderProps> = ({
  title,
  subtitle,
  badge,
  onBack,
  backLabel = 'Back',
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search records...',
  filterControl,
  actionButton
}) => {
  return (
    <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
      {/* Left: Title & Subtitle or Back drilldown */}
      <div className="flex items-center space-x-3 min-w-0">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-colors cursor-pointer flex items-center text-xs font-semibold shrink-0"
            title={backLabel}
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            <span>{backLabel}</span>
          </button>
        )}
        <div className="min-w-0">
          <div className="flex items-center space-x-2 flex-wrap">
            <h2 
              style={{ fontFamily: 'Ubuntu', fontWeight: 'normal' }}
              className="text-sm font-normal text-slate-800 dark:text-slate-100 uppercase tracking-wide truncate"
            >
              {title}
            </h2>
            {badge}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
            {subtitle}
          </p>
        </div>
      </div>

      {/* Right Controls: Search, Filter, Action */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto shrink-0">
        {onSearchChange !== undefined && (
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery || ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 dark:text-white rounded-lg text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all placeholder:text-slate-400"
            />
          </div>
        )}

        {filterControl}
        {actionButton}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 3. Unified KPI Summary Bar & Cards                                         */
/* -------------------------------------------------------------------------- */

export interface KpiItem {
  label: string;
  value: string;
  subtitle?: string;
  valueColorClass?: string;
}

interface ReportKpiGridProps {
  items: KpiItem[];
}

export const ReportKpiGrid: React.FC<ReportKpiGridProps> = ({ items }) => {
  return (
    <div className={`p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 grid grid-cols-2 md:grid-cols-${Math.min(items.length, 4)} gap-3`}>
      {items.map((item, idx) => (
        <div 
          key={idx}
          className="p-3 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-lg space-y-1"
        >
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
            {item.label}
          </span>
          <div className={`text-base sm:text-lg font-mono font-bold truncate ${item.valueColorClass || 'text-slate-900 dark:text-white'}`}>
            {item.value}
          </div>
          {item.subtitle && (
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
              {item.subtitle}
            </p>
          )}
        </div>
      ))}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 4. Unified Table Layout Component                                          */
/* -------------------------------------------------------------------------- */

interface ReportTableProps {
  loading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  minWidth?: string;
  children: ReactNode;
}

export const ReportTable: React.FC<ReportTableProps> = ({
  loading = false,
  isEmpty = false,
  emptyMessage = 'No records found for the selected period.',
  minWidth = 'min-w-[700px]',
  children
}) => {
  return (
    <div className="flex-1 overflow-x-auto custom-scrollbar">
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center space-y-2">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-xs text-slate-400 font-medium">Loading report records...</span>
        </div>
      ) : isEmpty ? (
        <div className="py-24 text-center text-slate-400 dark:text-slate-500 italic text-xs">
          {emptyMessage}
        </div>
      ) : (
        <table className={`w-full text-xs text-left border-collapse ${minWidth}`}>
          {children}
        </table>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 5. Unified Totals Summary Footer                                           */
/* -------------------------------------------------------------------------- */

interface ReportTotalsBarProps {
  children: ReactNode;
}

export const ReportTotalsBar: React.FC<ReportTotalsBarProps> = ({ children }) => {
  return (
    <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/50 shrink-0 space-y-3">
      {children}
    </div>
  );
};
