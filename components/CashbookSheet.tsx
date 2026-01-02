
import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronDown, Loader2 } from 'lucide-react';
import { formatCurrency } from '../utils/helpers';

interface CashbookRow {
  particulars: string;
  amount: string;
}

interface CashbookSheetProps {
  initialData?: any;
  onSave: (data: any) => void;
  onCancel: () => void;
}

const CashbookSheet: React.FC<CashbookSheetProps> = ({ initialData, onSave, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [pageSize, setPageSize] = useState('15');
  
  const [incomeRows, setIncomeRows] = useState<CashbookRow[]>(
    Array(15).fill(null).map(() => ({ particulars: '', amount: '' }))
  );
  const [expenseRows, setExpenseRows] = useState<CashbookRow[]>(
    Array(15).fill(null).map(() => ({ particulars: '', amount: '' }))
  );

  const handleInputChange = (type: 'income' | 'expense', index: number, field: keyof CashbookRow, value: string) => {
    if (type === 'income') {
      const newRows = [...incomeRows];
      newRows[index][field] = value;
      setIncomeRows(newRows);
    } else {
      const newRows = [...expenseRows];
      newRows[index][field] = value;
      setExpenseRows(newRows);
    }
  };

  const handleKeyDown = (type: 'income' | 'expense', index: number, field: keyof CashbookRow, e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const rows = type === 'income' ? incomeRows : expenseRows;
      const setter = type === 'income' ? setIncomeRows : setExpenseRows;
      
      if (index === rows.length - 1) {
        setter([...rows, { particulars: '', amount: '' }]);
        // Using setTimeout to ensure focus happens after render
        setTimeout(() => {
          const nextRowInputs = document.querySelectorAll(`[data-type="${type}"] input[data-field="particulars"]`);
          (nextRowInputs[index + 1] as HTMLInputElement)?.focus();
        }, 0);
      } else {
        const nextRowInputs = document.querySelectorAll(`[data-type="${type}"] input[data-field="particulars"]`);
        (nextRowInputs[index + 1] as HTMLInputElement)?.focus();
      }
    }
  };

  const calculateTotal = (rows: CashbookRow[]) => {
    return rows.reduce((acc, row) => acc + (parseFloat(row.amount) || 0), 0);
  };

  const incomeTotal = calculateTotal(incomeRows);
  const expenseTotal = calculateTotal(expenseRows);
  const balance = incomeTotal - expenseTotal;

  const handleSave = async () => {
    setLoading(true);
    try {
      onSave({
        date: reportDate,
        income: incomeRows.filter(r => r.particulars || r.amount),
        expense: expenseRows.filter(r => r.particulars || r.amount),
        incomeTotal,
        expenseTotal,
        balance
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col w-full max-w-[1200px] mx-auto bg-white border border-slate-200 shadow-sm overflow-hidden text-[#334155]">
      {/* Top Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
        <h2 className="text-lg font-medium text-slate-900">Cashbook Entry</h2>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Control Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3">
            <label className="text-sm text-slate-600">Date</label>
            <input 
              type="date" 
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="border border-slate-300 rounded px-3 py-1.5 text-sm outline-none focus:border-slate-400"
            />
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-slate-600">Closing Balance</span>
            <span className="text-sm font-medium text-[#38b6ff]">₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <div className="relative">
            <select 
              value={pageSize}
              onChange={(e) => setPageSize(e.target.value)}
              className="appearance-none border border-slate-300 rounded px-3 pr-8 py-1.5 text-xs text-slate-600 bg-white outline-none cursor-pointer"
            >
              <option value="15">Page Size</option>
              <option value="30">30 Rows</option>
              <option value="50">50 Rows</option>
            </select>
            <ChevronDown className="w-3 h-3 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select className="appearance-none border border-slate-300 rounded px-3 pr-8 py-1.5 text-xs text-slate-600 bg-white outline-none cursor-pointer">
              <option>Export</option>
              <option>PDF</option>
              <option>Excel</option>
            </select>
            <ChevronDown className="w-3 h-3 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Grid Header */}
      <div className="grid grid-cols-2">
        <div className="flex items-center justify-between px-4 py-3 border-r border-b border-slate-200 bg-white">
          <span className="text-sm font-medium">Income</span>
          <div className="flex items-center space-x-2">
            <span className="text-[11px] text-slate-500 font-normal">Total Income</span>
            <span className="text-sm font-medium text-[#10b981]">₹{incomeTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
          <span className="text-sm font-medium">Expense</span>
          <div className="flex items-center space-x-2">
            <span className="text-[11px] text-slate-500 font-normal">Total Expense</span>
            <span className="text-sm font-medium text-[#ef4444]">₹{expenseTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* Main Grid Body */}
      <div className="grid grid-cols-2 divide-x divide-slate-200">
        {/* Income Column */}
        <div className="flex flex-col bg-white" data-type="income">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="w-12 py-2.5 px-3 border-r border-slate-200 text-left font-normal bg-[#f9f9f9]">Sr No</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-left font-normal bg-[#f9f9f9]">Particulars</th>
                <th className="w-32 py-2.5 px-3 text-right font-normal bg-[#f9f9f9]">Amount</th>
              </tr>
            </thead>
            <tbody>
              {incomeRows.map((row, idx) => (
                <tr key={idx} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50">
                  <td className="w-12 py-2 px-3 border-r border-slate-200 text-slate-400 font-mono text-center select-none">{idx + 1}</td>
                  <td className="py-0 px-0 border-r border-slate-200">
                    <input 
                      type="text" 
                      value={row.particulars}
                      data-field="particulars"
                      onChange={(e) => handleInputChange('income', idx, 'particulars', e.target.value)}
                      onKeyDown={(e) => handleKeyDown('income', idx, 'particulars', e)}
                      className="w-full h-8 px-3 outline-none bg-transparent"
                    />
                  </td>
                  <td className="w-32 py-0 px-0">
                    <input 
                      type="number" 
                      value={row.amount}
                      data-field="amount"
                      onChange={(e) => handleInputChange('income', idx, 'amount', e.target.value)}
                      onKeyDown={(e) => handleKeyDown('income', idx, 'amount', e)}
                      className="w-full h-8 px-3 text-right outline-none bg-transparent font-mono"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="h-2 border-t border-[#10b981]/30"></div>
        </div>

        {/* Expense Column */}
        <div className="flex flex-col bg-white" data-type="expense">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="w-12 py-2.5 px-3 border-r border-slate-200 text-left font-normal bg-[#f9f9f9]">Sr No</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-left font-normal bg-[#f9f9f9]">Particulars</th>
                <th className="w-32 py-2.5 px-3 text-right font-normal bg-[#f9f9f9]">Amount</th>
              </tr>
            </thead>
            <tbody>
              {expenseRows.map((row, idx) => (
                <tr key={idx} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50">
                  <td className="w-12 py-2 px-3 border-r border-slate-200 text-slate-400 font-mono text-center select-none">{idx + 1}</td>
                  <td className="py-0 px-0 border-r border-slate-200">
                    <input 
                      type="text" 
                      value={row.particulars}
                      data-field="particulars"
                      onChange={(e) => handleInputChange('expense', idx, 'particulars', e.target.value)}
                      onKeyDown={(e) => handleKeyDown('expense', idx, 'particulars', e)}
                      className="w-full h-8 px-3 outline-none bg-transparent"
                    />
                  </td>
                  <td className="w-32 py-0 px-0">
                    <input 
                      type="number" 
                      value={row.amount}
                      data-field="amount"
                      onChange={(e) => handleInputChange('expense', idx, 'amount', e.target.value)}
                      onKeyDown={(e) => handleKeyDown('expense', idx, 'amount', e)}
                      className="w-full h-8 px-3 text-right outline-none bg-transparent font-mono"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="h-2 border-t border-[#ef4444]/30"></div>
        </div>
      </div>

      {/* Summary Footer */}
      <div className="bg-white border-t border-slate-200 p-8 space-y-2">
        <div className="flex flex-col items-center">
          <div className="w-full max-w-[400px] space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500 font-normal">Total Income</span>
              <span className="font-medium text-[#10b981]">₹{incomeTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-normal">Total Expense</span>
              <span className="font-medium text-[#ef4444]">₹{expenseTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-100">
              <span className="text-slate-500 font-normal">Balance</span>
              <span className="font-medium text-[#38b6ff]">₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-end space-x-4 px-6 py-4 bg-white border-t border-slate-100">
        <button 
          onClick={onCancel} 
          className="text-sm font-normal text-slate-500 hover:text-slate-700 px-4"
        >
          Discard
        </button>
        <button 
          onClick={handleSave}
          disabled={loading}
          className="bg-primary text-slate-900 px-6 py-2 rounded font-normal text-sm hover:bg-[#f0db69] transition-all flex items-center shadow-sm"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Create Statement
        </button>
      </div>
    </div>
  );
};

export default CashbookSheet;
