
import React, { useState, useEffect } from 'react';
import { X, ChevronDown, Loader2, Save, ArrowLeft, Trash2, FileSpreadsheet } from 'lucide-react';
import { exportCashbookEntryToExcel } from '../utils/exportHelper';
import { formatDateShort, parseDateFromInput } from '../utils/helpers';

interface CashbookRow {
  id: string;
  particulars: string;
  amount: string;
}

interface CashbookSheetProps {
  initialData?: any;
  existingEntries?: any[];
  onSave: (data: any) => void;
  onCancel: () => void;
}

const CashbookSheet: React.FC<CashbookSheetProps> = ({ initialData, existingEntries = [], onSave, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [reportDate, setReportDate] = useState(''); // ISO Format (YYYY-MM-DD)
  const [displayDate, setDisplayDate] = useState(''); // UI Format (DD/MM/YY)
  const [openingBalance, setOpeningBalance] = useState(0);
  
  const createEmptyRow = () => ({ id: Math.random().toString(36).substr(2, 9), particulars: '', amount: '' });

  const [incomeRows, setIncomeRows] = useState<CashbookRow[]>([]);
  const [expenseRows, setExpenseRows] = useState<CashbookRow[]>([]);

  const findPreviousBalance = (dateStr: string) => {
    if (!dateStr || !existingEntries.length) {
      setOpeningBalance(0);
      return;
    }

    // Find entries with date < selected date
    const previousEntries = existingEntries
      .filter(e => e.date < dateStr && e.id !== initialData?.id)
      .sort((a, b) => b.date.localeCompare(a.date)); // Sort descending to get most recent

    if (previousEntries.length > 0) {
      setOpeningBalance(Number(previousEntries[0].balance) || 0);
    } else {
      setOpeningBalance(0);
    }
  };

  useEffect(() => {
    if (initialData) {
      const isoDate = initialData.date || '';
      setReportDate(isoDate);
      setDisplayDate(formatDateShort(isoDate));
      
      const raw = initialData.raw_data || {};
      const inc = Array.isArray(raw.incomeRows) ? [...raw.incomeRows] : [];
      const exp = Array.isArray(raw.expenseRows) ? [...raw.expenseRows] : [];
      
      while (inc.length < 15) inc.push(createEmptyRow());
      while (exp.length < 15) exp.push(createEmptyRow());
      
      setIncomeRows(inc);
      setExpenseRows(exp);
      setOpeningBalance(Number(raw.openingBalance) || 0);
    } else {
      const todayIso = new Date().toISOString().split('T')[0];
      setReportDate(todayIso);
      setDisplayDate(formatDateShort(todayIso));
      setIncomeRows(Array(15).fill(null).map(createEmptyRow));
      setExpenseRows(Array(15).fill(null).map(createEmptyRow));
      findPreviousBalance(todayIso);
    }
  }, [initialData]);

  // When date changes, automatically find the previous closing balance
  useEffect(() => {
    if (!initialData && reportDate) {
      findPreviousBalance(reportDate);
    }
  }, [reportDate, existingEntries]);

  const handleDateBlur = () => {
    const iso = parseDateFromInput(displayDate);
    if (iso) {
      setReportDate(iso);
      setDisplayDate(formatDateShort(iso));
    } else {
      // Revert to last valid ISO date if user typed gibberish
      setDisplayDate(formatDateShort(reportDate));
    }
  };

  const handleInputChange = (type: 'income' | 'expense', index: number, field: keyof CashbookRow, value: string) => {
    const setter = type === 'income' ? setIncomeRows : setExpenseRows;
    const rows = type === 'income' ? [...incomeRows] : [...expenseRows];
    rows[index] = { ...rows[index], [field]: value };
    setter(rows);
  };

  const removeRow = (type: 'income' | 'expense', index: number) => {
    const setter = type === 'income' ? setIncomeRows : setExpenseRows;
    const rows = type === 'income' ? [...incomeRows] : [...expenseRows];
    
    if (rows.length > 15) {
      rows.splice(index, 1);
    } else {
      rows[index] = createEmptyRow();
    }
    setter(rows);
  };

  const handleKeyDown = (type: 'income' | 'expense', index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    const rows = type === 'income' ? incomeRows : expenseRows;
    const setter = type === 'income' ? setIncomeRows : setExpenseRows;

    if (e.key === 'Enter') {
      e.preventDefault();
      if (index === rows.length - 1) {
        setter([...rows, createEmptyRow()]);
      } else {
        const nextInput = (e.currentTarget.closest('tr')?.nextElementSibling?.querySelector('input')) as HTMLInputElement;
        nextInput?.focus();
      }
    }

    if (e.key === 'Delete' && e.currentTarget.value === '') {
      e.preventDefault();
      removeRow(type, index);
    }
  };

  const calculateTotal = (rows: CashbookRow[]) => {
    return rows.reduce((acc, row) => acc + (parseFloat(row.amount) || 0), 0);
  };

  const handleExportXLSX = () => {
    const companyName = localStorage.getItem('activeCompanyName') || 'My Digital Finance Desk';
    const cleanIncome = incomeRows.filter(r => r.particulars.trim() !== '' || r.amount !== '');
    const cleanExpense = expenseRows.filter(r => r.particulars.trim() !== '' || r.amount !== '');
    
    exportCashbookEntryToExcel(cleanIncome, cleanExpense, {
        companyName,
        date: reportDate || new Date().toISOString().split('T')[0]
    });
  };

  const incomeTotal = calculateTotal(incomeRows);
  const expenseTotal = calculateTotal(expenseRows);
  const closingBalance = openingBalance + incomeTotal - expenseTotal;

  return (
    <div className="bg-white w-full border border-slate-300 rounded-md flex flex-col h-full animate-in fade-in duration-300 overflow-hidden">
      {/* Sheet Header Toolbar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
        <div className="flex items-center space-x-4">
          <button onClick={onCancel} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-[18px] font-semibold text-slate-900 tracking-tight">
            {initialData ? 'Update Statement' : 'Cashbook Entry Sheet'}
          </h2>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={handleExportXLSX}
            className="flex items-center px-4 py-2.5 bg-white border border-slate-200 rounded text-slate-600 font-semibold text-[14px] hover:bg-slate-50 transition-all"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Download XLSX
          </button>
          <button 
            onClick={() => {
              setLoading(true);
              onSave({
                id: initialData?.id,
                date: reportDate,
                openingBalance,
                incomeTotal,
                expenseTotal,
                balance: closingBalance,
                incomeRows,
                expenseRows
              });
            }}
            disabled={loading}
            className="bg-primary text-slate-900 px-8 py-2.5 rounded font-semibold text-[14px] hover:bg-primary-dark transition-all flex items-center"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            {initialData ? 'Update Statement' : 'Save Statement'}
          </button>
        </div>
      </div>

      {/* Sheet Content */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50 flex flex-col space-y-4 custom-scrollbar">
        {/* Info Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white px-6 py-5 border border-slate-200 rounded flex items-center justify-between col-span-1 lg:col-span-2">
            <div className="flex items-center space-x-4">
              <label className="text-[13px] font-semibold text-slate-400 uppercase tracking-wider">Statement Date</label>
              <input 
                type="text" 
                placeholder="DD/MM/YY"
                value={displayDate}
                onChange={(e) => setDisplayDate(e.target.value)}
                onBlur={handleDateBlur}
                className="border border-slate-200 rounded px-4 py-2 text-[14px] outline-none w-40 font-mono focus:border-link transition-colors"
              />
            </div>
            
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-3">
                <span className="text-[13px] font-semibold text-slate-400 uppercase tracking-wider">Opening Bal</span>
                <span className="text-[18px] font-semibold font-mono text-slate-500">
                  ₹ {openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              
              <div className="flex items-center space-x-3">
                <span className="text-[13px] font-semibold text-slate-400 uppercase tracking-wider">Closing Bal</span>
                <span className={`text-[18px] font-semibold font-mono ${closingBalance >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                  ₹ {closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Ledger Grid */}
        <div className="flex-1 flex flex-col min-h-0 border border-slate-300 rounded overflow-hidden bg-white">
          {/* Legend Headers */}
          <div className="grid grid-cols-2 divide-x divide-slate-300 bg-white border-b border-slate-200 shrink-0">
            <div className="flex items-center justify-between px-6 py-4 bg-emerald-50/30">
              <span className="text-[15px] font-semibold text-emerald-700 uppercase tracking-tighter">Inward (Income)</span>
              <div className="flex items-center space-x-3">
                <span className="text-[11px] text-emerald-600/60 uppercase font-semibold">Subtotal</span>
                <span className="text-[16px] font-semibold text-green-600 font-mono">₹{incomeTotal.toFixed(2)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between px-6 py-4 bg-rose-50/30">
              <span className="text-[15px] font-semibold text-rose-700 uppercase tracking-tighter">Outward (Expense)</span>
              <div className="flex items-center space-x-3">
                <span className="text-[11px] text-rose-600/60 uppercase font-semibold">Subtotal</span>
                <span className="text-[16px] font-semibold text-red-600 font-mono">₹{expenseTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 divide-x divide-slate-300 flex-1 overflow-hidden">
            {/* Income Table */}
            <div className="overflow-y-auto custom-scrollbar bg-white">
              <table className="w-full text-[13px] border-collapse relative">
                <thead className="sticky top-0 bg-slate-100 z-20 ring-1 ring-slate-200">
                  <tr className="text-slate-600 uppercase font-semibold text-[11px]">
                    <th className="w-16 py-3 px-3 border-r border-slate-200 text-center bg-slate-100">Sr</th>
                    <th className="py-3 px-4 text-left">Particulars / Source</th>
                    <th className="w-40 py-3 px-4 text-right border-l border-slate-200">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {incomeRows.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-slate-50 group border-b border-slate-100 last:border-0 relative">
                      <td className="py-2 px-3 border-r border-slate-200 text-slate-400 text-center font-mono select-none relative group/sr">
                        <span className="group-hover:hidden">{idx + 1}</span>
                        <button 
                          type="button" 
                          onClick={() => removeRow('income', idx)}
                          className="hidden group-hover:flex absolute inset-0 items-center justify-center text-rose-500 hover:bg-rose-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                      <td className="py-0 px-0">
                        <input
                          type="text"
                          value={row.particulars}
                          onChange={(e) => handleInputChange('income', idx, 'particulars', e.target.value)}
                          onKeyDown={(e) => handleKeyDown('income', idx, e)}
                          placeholder="Type description..."
                          className="w-full h-10 px-4 outline-none bg-white focus:bg-slate-50 placeholder:text-slate-200 transition-colors font-medium"
                        />
                      </td>
                      <td className="py-0 px-0 border-l border-slate-200 bg-white">
                        <input
                          type="number"
                          value={row.amount}
                          onChange={(e) => handleInputChange('income', idx, 'amount', e.target.value)}
                          onKeyDown={(e) => handleKeyDown('income', idx, e)}
                          placeholder="0.00"
                          className="w-full h-10 px-4 text-right outline-none bg-white focus:bg-slate-50 font-mono font-semibold text-slate-700 placeholder:text-slate-200"
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
                <thead className="sticky top-0 bg-slate-100 z-20 ring-1 ring-slate-200">
                  <tr className="text-slate-600 uppercase font-semibold text-[11px]">
                    <th className="w-16 py-3 px-3 border-r border-slate-200 text-center bg-slate-100">Sr</th>
                    <th className="py-3 px-4 text-left">Particulars / Usage</th>
                    <th className="w-40 py-3 px-4 text-right border-l border-slate-200">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {expenseRows.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-slate-50 group border-b border-slate-100 last:border-0 relative">
                      <td className="py-2 px-3 border-r border-slate-200 text-slate-400 text-center font-mono select-none relative group/sr">
                        <span className="group-hover:hidden">{idx + 1}</span>
                        <button 
                          type="button" 
                          onClick={() => removeRow('expense', idx)}
                          className="hidden group-hover:flex absolute inset-0 items-center justify-center text-rose-500 hover:bg-rose-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                      <td className="py-0 px-0">
                        <input
                          type="text"
                          value={row.particulars}
                          onChange={(e) => handleInputChange('expense', idx, 'particulars', e.target.value)}
                          onKeyDown={(e) => handleKeyDown('expense', idx, e)}
                          placeholder="Type description..."
                          className="w-full h-10 px-4 outline-none bg-white focus:bg-slate-50 placeholder:text-slate-200 transition-colors font-medium"
                        />
                      </td>
                      <td className="py-0 px-0 border-l border-slate-200 bg-white">
                        <input
                          type="number"
                          value={row.amount}
                          onChange={(e) => handleInputChange('expense', idx, 'amount', e.target.value)}
                          onKeyDown={(e) => handleKeyDown('expense', idx, e)}
                          placeholder="0.00"
                          className="w-full h-10 px-4 text-right outline-none bg-white focus:bg-slate-50 font-mono font-semibold text-slate-700 placeholder:text-slate-200"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sheet Footer Summary */}
          <div className="bg-slate-100 px-8 py-6 shrink-0 flex items-center justify-between border-t border-slate-200">
            <div className="flex space-x-6">
              <div className="flex flex-col bg-white px-6 py-3 rounded-md border border-slate-200 min-w-[180px]">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Inward Sum</span>
                <span className="text-xl font-semibold font-mono text-green-600">₹{incomeTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex flex-col bg-white px-6 py-3 rounded-md border border-slate-200 min-w-[180px]">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Outward Sum</span>
                <span className="text-xl font-semibold font-mono text-red-600">₹{expenseTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex flex-col items-end bg-white px-6 py-4 rounded-md border border-slate-200 min-w-[200px]">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Closing Balance</span>
                <span className="text-2xl font-semibold font-mono text-blue-600">
                  ₹{closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CashbookSheet;
