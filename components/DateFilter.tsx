
import React, { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface DateFilterProps {
  onFilterChange: (range: { startDate: string | null, endDate: string | null }) => void;
}

const DateFilter: React.FC<DateFilterProps> = ({ onFilterChange }) => {
  const [selectedYear, setSelectedYear] = useState('All Time');
  const [selectedMonth, setSelectedMonth] = useState('All Months');

  const currentYear = new Date().getFullYear();
  // Dynamic years range: Previous, Current, Next
  const years = ['All Time', `${currentYear - 1}-${currentYear}`, `${currentYear}-${currentYear + 1}`, `${currentYear + 1}-${currentYear + 2}`];

  const getMonthsForYear = (year: string) => {
    if (year === 'All Time') return [{ name: 'All Months', value: 'all' }];

    const startYear = parseInt(year.split('-')[0]);
    const nextYear = startYear + 1;
    
    return [
      { name: 'All Months', value: 'all' },
      { name: `April ${startYear}`, value: `${startYear}-04` },
      { name: `May ${startYear}`, value: `${startYear}-05` },
      { name: `June ${startYear}`, value: `${startYear}-06` },
      { name: `July ${startYear}`, value: `${startYear}-07` },
      { name: `August ${startYear}`, value: `${startYear}-08` },
      { name: `September ${startYear}`, value: `${startYear}-09` },
      { name: `October ${startYear}`, value: `${startYear}-10` },
      { name: `November ${startYear}`, value: `${startYear}-11` },
      { name: `December ${startYear}`, value: `${startYear}-12` },
      { name: `January ${nextYear}`, value: `${nextYear}-01` },
      { name: `February ${nextYear}`, value: `${nextYear}-02` },
      { name: `March ${nextYear}`, value: `${nextYear}-03` },
    ];
  };

  const months = getMonthsForYear(selectedYear);

  useEffect(() => {
    let startDate: string | null = null;
    let endDate: string | null = null;

    if (selectedYear === 'All Time') {
        onFilterChange({ startDate: null, endDate: null });
        return;
    }

    const startYearInt = parseInt(selectedYear.split('-')[0]);
    const nextYearInt = startYearInt + 1;

    if (selectedMonth === 'All Months' || selectedMonth === 'all') {
      startDate = `${startYearInt}-04-01`;
      endDate = `${nextYearInt}-03-31`;
    } else {
         startDate = `${selectedMonth}-01`;
         // Get last day of month
         const [y, m] = selectedMonth.split('-').map(Number);
         // new Date(y, m, 0) gives last day of previous month (since m is 0-indexed in Date but 1-based in our string)
         // Our string "2024-04" -> m=4. Date(2024, 4, 0) -> 4 is May (index), Day 0 is Apr 30. Correct.
         const lastDay = new Date(y, m, 0).getDate();
         endDate = `${selectedMonth}-${lastDay}`;
    }
    
    onFilterChange({ startDate, endDate });
  }, [selectedYear, selectedMonth]);

  return (
    <div className="flex space-x-3">
      <div className="relative">
        <select
          value={selectedYear}
          onChange={(e) => {
             setSelectedYear(e.target.value);
             setSelectedMonth('All Months');
          }}
          className="appearance-none bg-white border border-slate-200 rounded-md py-2 pl-4 pr-10 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer outline-none focus:border-slate-400 min-w-[120px]"
        >
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>

      {selectedYear !== 'All Time' && (
      <div className="relative">
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="appearance-none bg-white border border-slate-200 rounded-md py-2 pl-4 pr-10 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer outline-none focus:border-slate-400 min-w-[140px]"
        >
            {months.map(m => (
                <option key={m.name} value={m.value}>{m.name}</option>
            ))}
        </select>
        <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>
      )}
    </div>
  );
};

export default DateFilter;
