import React, { useState } from 'react';
import { X, ChevronDown, Loader2 } from 'lucide-react';

interface CashbookRow {
  id: string;
  particulars: string;
  amount: string;
}

interface CashbookSheetProps {
  initialData?: any;
  onSave: (data: any) => void;
  onCancel: () => void;
}

// Fixed missing default export and completed truncated file
const CashbookSheet: React.FC<CashbookSheetProps> = ({ onSave, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [reportDate, setReportDate] = useState('');
  
  const createEmptyRow = () => ({ id: Math.random().toString(36).substr(2, 9), particulars: '', amount: '' });

  const [incomeRows, setIncomeRows] = useState<CashbookRow[]>(Array(15).fill(null).map(createEmptyRow));
  const [expenseRows, setExpenseRows] = useState<CashbookRow[]>(Array(15).fill(null).map(createEmptyRow));

  const handleInputChange = (type: 'income' | 'expense', index: number, field: keyof CashbookRow, value: string) => {
    const setter = type === 'income' ? setIncomeRows : setExpenseRows;
    const rows = type === 'income' ? [...incomeRows] : [...expenseRows];
    rows[index] = { ...rows[index], [field]: value };
    setter(rows);
  };

  const handleKeyDown = (type: 'income' | 'expense', index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    const rows = type === 'income' ? incomeRows : expenseRows;
    const setter = type === 'income' ? setIncomeRows : setExpenseRows;

    if (e.key === 'Enter') {
      e.preventDefault();
      if (index === rows.length - 1) {
        setter([...rows, createEmptyRow()]);
      }
    }
  };

  const calculateTotal = (rows: CashbookRow[]) => {
    return rows.reduce((acc, row) => acc + (parseFloat(row.amount) || 0), 0);
  };

  const incomeTotal = calculateTotal(incomeRows);
  const expenseTotal = calculateTotal(expenseRows);
  const balance = incomeTotal - expenseTotal;

  return (
    <div className="relative bg-white w-full max-w-[1100px] flex flex-col max-h-[90vh] overflow-hidden rounded-md border border-slate-300 isolate z-10 shadow-none">
      {/* Fixed Header - Pinned at top */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shrink-0 z-50">
        <h2 className="text-[18px] font-normal text-slate-900">Cashbook Entry</h2>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-none p-1">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Container - Scrollable Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 bg-white flex flex-col space-y-4 custom-scrollbar">
        {/* Top Control Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-4 border border-slate-200 rounded-md bg-white shrink-0">
          <div className="flex flex-wrap items-center gap-6 lg:gap-10">
            <div className="flex items-center space-x-3">
              <label className="text-[14px] text-slate-700 whitespace-nowrap">Date</label>
              <input 
                type="text" 
                placeholder="DD/MM/YY"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="border border-slate-200 rounded px-3 py-1.5 text-[14px] outline-none w-32 placeholder:text-slate-300 focus:border-slate-400"
              />
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-[14px] text-slate-700 whitespace-nowrap">Closing Balance</span>
              <span className="text-[14px] font-bold text-link whitespace-nowrap">₹ {balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative">
                <select className="appearance-none border border-slate-200 rounded pl-4 pr-10 py-1.5 text-[12px] bg-white outline-none cursor-pointer text-slate-600 hover:bg-slate-50">
                    <option>Page Size</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
            <div className="relative">
                <select className="appearance-none border border-slate-200 rounded pl-4 pr-10 py-1.5 text-[12px] bg-white outline-none cursor-pointer text-slate-600 hover:bg-slate-50">
                    <option>Export</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* The Grid - Main Table Section */}
        <div className="flex-1 flex flex-col min-h-0 border border-slate-200 rounded-md overflow-hidden bg-white">
          <div className="grid grid-cols-2 divide-x divide-slate-200 shrink-0">
            {/* Income Header Row */}
            <div className="flex items-center justify-between px-4 py-3 border-b-2 border-emerald-500 bg-white">
              <span className="text-[14px] font-normal text-slate-700 uppercase tracking-tight">Income</span>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] text-slate-400 uppercase font-medium">Total Income</span>
                <span className="text-[14px] font-bold text-emerald-500 font-mono">₹{incomeTotal.toFixed(2)}</span>
              </div>
            </div>
            {/* Expense Header Row */}
            <div className="flex items-center justify-between px-4 py-3 border-b-2 border-rose-500 bg-white">
              <span className="text-[14px] font-normal text-slate-700 uppercase tracking-tight">Expense</span>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] text-slate-400 uppercase font-medium">Total Expense</span>
                <span className="text-[14px] font-bold text-rose-500 font-mono">₹{expenseTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 divide-x divide-slate-200 flex-1 overflow-hidden">
            {/* Income Table */}
            <div className="overflow-y-auto custom-scrollbar bg-white">
              <table className="w-full text-[13px] border-collapse relative">
                <thead className="sticky top-0 bg-slate-50 z-20">
                  <tr className="text-slate-500 border-b border-slate-200">
                    <th className="w-16 py-2 px-3 border-r border-slate-200 font-medium text-left bg-slate-50">Sr No</th>
                    <th className="py-2 px-3 font-medium text-left">Particulars</th>
                    <th className="w-32 py-2 px-3 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {incomeRows.map((row, idx) => (
                    <tr key={row.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 px-3 border-r border-slate-100 text-slate-400 text-center">{idx + 1}</td>
                      <td className="py-0 px-0">
                        <input
                          type="text"
                          value={row.particulars}
                          onChange={(e) => handleInputChange('income', idx, 'particulars', e.target.value)}
                          onKeyDown={(e) => handleKeyDown('income', idx, e)}
                          className="w-full h-9 px-3 outline-none bg-transparent"
                        />
                      </td>
                      <td className="py-0 px-0">
                        <input
                          type="number"
                          value={row.amount}
                          onChange={(e) => handleInputChange('income', idx, 'amount', e.target.value)}
                          onKeyDown={(e) => handleKeyDown('income', idx, e)}
                          className="w-full h-9 px-3 text-right outline-none bg-transparent font-mono"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Expense Table */}
            <div className="overflow-y-auto custom-scrollbar bg-white">
              <table className="w-full text-[13px] border-collapse relative">
                <thead className="sticky top-0 bg-slate-50 z-20">
                  <tr className="text-slate-500 border-b border-slate-200">
                    <th className="w-16 py-2 px-3 border-r border-slate-200 font-medium text-left bg-slate-50">Sr No</th>
                    <th className="py-2 px-3 font-medium text-left">Particulars</th>
                    <th className="w-32 py-2 px-3 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseRows.map((row, idx) => (
                    <tr key={row.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 px-3 border-r border-slate-100 text-slate-400 text-center">{idx + 1}</td>
                      <td className="py-0 px-0">
                        <input
                          type="text"
                          value={row.particulars}
                          onChange={(e) => handleInputChange('expense', idx, 'particulars', e.target.value)}
                          onKeyDown={(e) => handleKeyDown('expense', idx, e)}
                          className="w-full h-9 px-3 outline-none bg-transparent"
                        />
                      </td>
                      <td className="py-0 px-0">
                        <input
                          type="number"
                          value={row.amount}
                          onChange={(e) => handleInputChange('expense', idx, 'amount', e.target.value)}
                          onKeyDown={(e) => handleKeyDown('expense', idx, e)}
                          className="w-full h-9 px-3 text-right outline-none bg-transparent font-mono"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-end space-x-4 pt-4 shrink-0">
          <button
            onClick={onCancel}
            className="px-6 py-2 text-[14px] text-slate-500 hover:text-slate-800 transition-none"
          >
            Discard
          </button>
          <button
            onClick={() => onSave({
              date: reportDate,
              incomeTotal,
              expenseTotal,
              balance,
              incomeRows,
              expenseRows
            })}
            disabled={loading}
            className="bg-primary text-slate-900 px-8 py-2.5 rounded font-normal text-[14px] hover:bg-primary-dark transition-none flex items-center"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Save Statement
          </button>
        </div>
      </div>
    </div>
  );
};

export default CashbookSheet;