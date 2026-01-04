
import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

interface DateFilterProps {
  onFilterChange: (range: { startDate: string | null, endDate: string | null }) => void;
}

export interface DateFilterHandle {
  focusYear: () => void;
  focusMonth: () => void;
}

const DateFilter = forwardRef<DateFilterHandle, DateFilterProps>(({ onFilterChange }, ref) => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(`This Year`);
  const [selectedMonth, setSelectedMonth] = useState('This Month');

  const yearRef = useRef<HTMLSelectElement>(null);
  const monthRef = useRef<HTMLSelectElement>(null);

  useImperativeHandle(ref, () => ({
    focusYear: () => yearRef.current?.focus(),
    focusMonth: () => monthRef.current?.focus(),
  }));

  const years = ['This Year', `${currentYear - 1}-${currentYear}`, `${currentYear}-${currentYear + 1}`];
  const months = ['This Month', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  useEffect(() => {
    onFilterChange({ startDate: null, endDate: null });
  }, [selectedYear, selectedMonth]);

  return (
    <div className="flex space-x-2">
      <div className="relative">
        <select
          ref={yearRef}
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          className="appearance-none bg-white border border-slate-200 rounded-md py-2 pl-4 pr-10 text-xs font-normal text-slate-700 hover:bg-slate-50 cursor-pointer outline-none min-w-[110px] focus:border-primary focus:ring-1 focus:ring-primary"
        >
          {years.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <ChevronDown className="w-3 h-3 absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>

      <div className="relative">
        <select
          ref={monthRef}
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="appearance-none bg-white border border-slate-200 rounded-md py-2 pl-4 pr-10 text-xs font-normal text-slate-700 hover:bg-slate-50 cursor-pointer outline-none min-w-[110px] focus:border-primary focus:ring-1 focus:ring-primary"
        >
          {months.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <ChevronDown className="w-3 h-3 absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>
    </div>
  );
});

export default DateFilter;
