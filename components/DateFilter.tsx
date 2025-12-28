
import React, { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface DateFilterProps {
  onFilterChange: (range: { startDate: string | null, endDate: string | null }) => void;
}

const DateFilter: React.FC<DateFilterProps> = ({ onFilterChange }) => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(`This Year`);
  const [selectedMonth, setSelectedMonth] = useState('This Month');

  const years = ['This Year', `${currentYear - 1}-${currentYear}`, `${currentYear}-${currentYear + 1}`];
  const months = ['This Month', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  useEffect(() => {
    // Basic logic for now as requested UI focus is priority
    onFilterChange({ startDate: null, endDate: null });
  }, [selectedYear, selectedMonth]);

  const Dropdown = ({ value, onChange, options }: any) => (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-white border border-slate-200 rounded-md py-2 pl-4 pr-10 text-xs font-normal text-slate-700 hover:bg-slate-50 cursor-pointer outline-none min-w-[110px]"
      >
        {options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
      <ChevronDown className="w-3 h-3 absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  );

  return (
    <div className="flex space-x-2">
      <Dropdown value={selectedYear} onChange={setSelectedYear} options={years} />
      <Dropdown value={selectedMonth} onChange={setSelectedMonth} options={months} />
    </div>
  );
};

export default DateFilter;
