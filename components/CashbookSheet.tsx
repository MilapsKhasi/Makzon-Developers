
import React, { useState, useEffect } from 'react';
import { X, ChevronDown, Loader2, Save, ArrowLeft, Trash2, FileSpreadsheet, FileText } from 'lucide-react';
import { exportCashbookEntryToExcel, exportCashbookEntryToPDF } from '../utils/exportHelper';
import { formatDate, parseDateFromInput, formatCurrency } from '../utils/helpers';

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
  const [lastDate, setLastDate] = useState('');
  
  const createEmptyRow = () => ({ id: Math.random().toString(36).substr(2, 9), particulars: '', amount: '' });

  const [incomeRows, setIncomeRows] = useState<CashbookRow[]>([]);
  const [expenseRows, setExpenseRows] = useState<CashbookRow[]>([]);

  const findPreviousBalance = (dateStr: string) => {
    if (!dateStr || !existingEntries.length) {
      setOpeningBalance(0);
      setLastDate('');
      return;
    }

    const previousEntries = existingEntries
      .filter(e => e.date < dateStr && e.id !== initialData?.id)
      .sort((a, b) => b.date.localeCompare(a.date));

    if (previousEntries.length > 0) {
      setOpeningBalance(Number(previousEntries[0].balance) || 0);
      setLastDate(formatDate(previousEntries[0].date));
    } else {
      setOpeningBalance(0);
      setLastDate('');
    }
  };

  useEffect(() => {
    if (initialData) {
      const isoDate = initialData.date || '';
      setReportDate(isoDate);
      setDisplayDate(formatDate(isoDate));
      
      const raw = initialData.raw_data || {};
      const inc = Array.isArray(raw.incomeRows) ? [...raw.incomeRows] : [];
      const exp = Array.isArray(raw.expenseRows) ? [...raw.expenseRows] : [];
      
      while (inc.length < 12) inc.push(createEmptyRow());
      while (exp.length < 12) exp.push(createEmptyRow());
      
      setIncomeRows(inc);
      setExpenseRows(exp);
      setOpeningBalance(Number(raw.openingBalance) || 0);
      setLastDate(raw.lastDate || '');
    } else {
      const todayIso = new Date().toISOString().split('T')[0];
      setReportDate(todayIso);
      setDisplayDate(formatDate(todayIso));
      setIncomeRows(Array(12).fill(null).map(createEmptyRow));
      setExpenseRows(Array(12).fill(null).map(createEmptyRow));
      findPreviousBalance(todayIso);
    }
  }, [initialData]);

  useEffect(() => {
    if (!initialData && reportDate) {
      findPreviousBalance(reportDate);
    }
  }, [reportDate, existingEntries]);

  const handleDateBlur = () => {
    const iso = parseDateFromInput(displayDate);
    if (iso) {
      setReportDate(iso);
      setDisplayDate(formatDate(iso));
    } else {
      setDisplayDate(formatDate(reportDate));
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
    
    if (rows.length > 12) {
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
    const companyName = localStorage.getItem('activeCompanyName') || 'Findesk Workspace';
    const cleanIncome = incomeRows.filter(r => r.particulars.trim() !== '' && r.amount !== '');
    const cleanExpense = expenseRows.filter(r => r.particulars.trim() !== '' && r.amount !== '');
    
    exportCashbookEntryToExcel(cleanIncome, cleanExpense, {
        companyName,
        date: reportDate || new Date().toISOString().split('T')[0]
    });
  };

  const handleExportPDF = () => {
    const companyName = localStorage.getItem('activeCompanyName') || 'Findesk Workspace';
    const cleanIncome = incomeRows.filter(r => r.particulars.trim() !== '' && r.amount !== '');
    const cleanExpense = expenseRows.filter(r => r.particulars.trim() !== '' && r.amount !== '');
    
    exportCashbookEntryToPDF(cleanIncome, cleanExpense, {
        companyName,
        date: reportDate || new Date().toISOString().split('T')[0]
    });
  };

  const incomeTotal = calculateTotal(incomeRows);
  const expenseTotal = calculateTotal(expenseRows);
  const closingBalance = openingBalance + incomeTotal - expenseTotal;

  return (
    <div className="bg-white dark:bg-slate-900 w-full border border-slate-300 dark:border-slate-800 rounded-md flex flex-col h-full animate-in fade-in duration-300 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shrink-0">
        <div className="flex items-center space-x-4">
          <button onClick={onCancel} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-[18px] font-semibold text-slate-900 dark:text-slate-100 tracking-tight capitalize">
            {initialData ? 'Update Statement' : 'Cashbook Entry Sheet'}
          </h2>
        </div>
        <div className="flex items-center space-x-2">
          <button onClick={handleExportPDF} className="flex items-center px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-600 dark:text-slate-300 font-semibold text-[13px] hover:bg-slate-50 dark:hover:bg-slate-700 transition-all capitalize">
            <FileText className="w-4 h-4 mr-2 text-rose-500" /> PDF
          </button>
          <button onClick={handleExportXLSX} className="flex items-center px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-600 dark:text-slate-300 font-semibold text-[13px] hover:bg-slate-50 dark:hover:bg-slate-700 transition-all capitalize">
            <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-500" /> Excel
          </button>
          <button 
            onClick={() => {
              setLoading(true);
              onSave({
                id: initialData?.id,
                date: reportDate,
                openingBalance,
                lastDate,
                incomeTotal,
                expenseTotal,
                balance: closingBalance,
                incomeRows,
                expenseRows
              });
            }}
            disabled={loading}
            className="bg-primary text-slate-900 px-8 py-2.5 rounded font-bold text-[13px] hover:bg-primary-dark transition-all flex items-center ml-2 capitalize"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            {initialData ? 'Update' : 'Save'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-slate-950 flex flex-col space-y-4 custom-scrollbar">
        <div className="bg-white dark:bg-slate-900 px-6 py-5 border border-slate-200 dark:border-slate-800 rounded flex items-center justify-between shadow-sm">
            <div className="flex items-center space-x-4">
              <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Statement Date</label>
              <input 
                type="text" 
                placeholder="DD/MM/YY"
                value={displayDate}
                onChange={(e) => setDisplayDate(e.target.value)}
                onBlur={handleDateBlur}
                className="border border-slate-200 dark:border-slate-700 rounded px-4 py-2 text-[14px] outline-none w-44 font-mono focus:border-slate-400 bg-slate-50/50 dark:bg-slate-800 dark:text-white"
              />
            </div>
            
            <div className="flex items-center space-x-12">
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Opening Balance</span>
                <span className="text-[18px] font-bold font-mono text-slate-500">{formatCurrency(openingBalance)}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Closing Balance</span>
                <span className={`text-[22px] font-bold font-mono ${closingBalance >= 0 ? 'text-link' : 'text-rose-600'}`}>{formatCurrency(closingBalance)}</span>
              </div>
            </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 border border-slate-300 dark:border-slate-800 rounded overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
          <div className="grid grid-cols-2 divide-x divide-slate-300 dark:divide-slate-800 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <div className="flex items-center justify-between px-6 py-4 bg-emerald-50/20 dark:bg-emerald-950/10">
              <span className="text-[14px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-tight">Income (Inward)</span>
              <div className="flex items-center space-x-3">
                <span className="text-[10px] text-emerald-600 font-bold uppercase">Subtotal</span>
                <span className="text-[16px] font-bold text-emerald-600 font-mono">{formatCurrency(incomeTotal)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between px-6 py-4 bg-rose-50/20 dark:bg-rose-950/10">
              <span className="text-[14px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-tight">Expense (Outward)</span>
              <div className="flex items-center space-x-3">
                <span className="text-[10px] text-rose-600 font-bold uppercase">Subtotal</span>
                <span className="text-[16px] font-bold text-rose-600 font-mono">{formatCurrency(expenseTotal)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 divide-x divide-slate-300 dark:divide-slate-800 flex-1 overflow-hidden">
            <div className="overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900">
              <table className="w-full text-[14px] border-collapse relative">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 z-20 ring-1 ring-slate-200 dark:ring-slate-700">
                  <tr className="text-slate-500 dark:text-slate-400 uppercase font-bold text-[10px] tracking-widest">
                    <th className="w-14 py-3 px-3 border-r border-slate-200 dark:border-slate-700 text-center">#</th>
                    <th className="py-3 px-4 text-left">Particulars / Source</th>
                    <th className="w-36 py-3 px-4 text-right border-l border-slate-200 dark:border-slate-700">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {incomeRows.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 group">
                      <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600 text-center font-mono select-none relative">
                        <span className="group-hover:hidden text-[11px]">{idx + 1}</span>
                        <button type="button" onClick={() => removeRow('income', idx)} className="hidden group-hover:flex absolute inset-0 items-center justify-center text-rose-400 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      </td>
                      <td className="py-0 px-0"><input type="text" value={row.particulars} onChange={(e) => handleInputChange('income', idx, 'particulars', e.target.value)} onKeyDown={(e) => handleKeyDown('income', idx, e)} className="w-full h-10 px-4 outline-none bg-transparent font-medium text-slate-700 dark:text-slate-300" /></td>
                      <td className="py-0 px-0 border-l border-slate-200 dark:border-slate-700"><input type="text" value={row.amount} onChange={(e) => handleInputChange('income', idx, 'amount', e.target.value)} onKeyDown={(e) => handleKeyDown('income', idx, e)} placeholder="0.00" className="w-full h-10 px-4 text-right outline-none bg-transparent font-mono font-bold text-slate-900 dark:text-white" /></td>
                    </tr>
                  ))}
                  {/* Opening Balance Row - Income */}
                  <tr className="bg-slate-50/50 dark:bg-slate-800/20 border-t border-slate-200 dark:border-slate-700">
                    <td className="w-14 py-3 px-3 border-r border-slate-200 dark:border-slate-700"></td>
                    <td className="py-3 px-4 text-slate-400 dark:text-slate-500 font-bold italic text-xs uppercase tracking-tight">Opening Balance Of {lastDate || 'Initial'}</td>
                    <td className="w-36 py-3 px-4 text-right border-l border-slate-200 dark:border-slate-700 font-mono font-bold text-slate-400 dark:text-slate-600">{formatCurrency(openingBalance, false)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900">
              <table className="w-full text-[14px] border-collapse relative">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 z-20 ring-1 ring-slate-200 dark:ring-slate-700">
                  <tr className="text-slate-500 dark:text-slate-400 uppercase font-bold text-[10px] tracking-widest">
                    <th className="w-14 py-3 px-3 border-r border-slate-200 dark:border-slate-700 text-center">#</th>
                    <th className="py-3 px-4 text-left">Particulars / Usage</th>
                    <th className="w-36 py-3 px-4 text-right border-l border-slate-200 dark:border-slate-700">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {expenseRows.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 group">
                      <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600 text-center font-mono select-none relative">
                        <span className="group-hover:hidden text-[11px]">{idx + 1}</span>
                        <button type="button" onClick={() => removeRow('expense', idx)} className="hidden group-hover:flex absolute inset-0 items-center justify-center text-rose-400 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      </td>
                      <td className="py-0 px-0"><input type="text" value={row.particulars} onChange={(e) => handleInputChange('expense', idx, 'particulars', e.target.value)} onKeyDown={(e) => handleKeyDown('expense', idx, e)} className="w-full h-10 px-4 outline-none bg-transparent font-medium text-slate-700 dark:text-slate-300" /></td>
                      <td className="py-0 px-0 border-l border-slate-200 dark:border-slate-700"><input type="text" value={row.amount} onChange={(e) => handleInputChange('expense', idx, 'amount', e.target.value)} onKeyDown={(e) => handleKeyDown('expense', idx, e)} placeholder="0.00" className="w-full h-10 px-4 text-right outline-none bg-transparent font-mono font-bold text-slate-900 dark:text-white" /></td>
                    </tr>
                  ))}
                  {/* Opening Balance Row - Expense */}
                  <tr className="bg-slate-50/50 dark:bg-slate-800/20 border-t border-slate-200 dark:border-slate-700">
                    <td className="w-14 py-3 px-3 border-r border-slate-200 dark:border-slate-700"></td>
                    <td className="py-3 px-4 text-slate-400 dark:text-slate-500 font-bold italic text-xs uppercase tracking-tight">Opening Balance Of {lastDate || 'Initial'}</td>
                    <td className="w-36 py-3 px-4 text-right border-l border-slate-200 dark:border-slate-700 font-mono font-bold text-slate-400 dark:text-slate-600">{formatCurrency(openingBalance, false)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/40 px-8 py-6 shrink-0 flex items-center justify-between border-t border-slate-200 dark:border-slate-800">
            <div className="flex space-x-6">
              <div className="flex flex-col bg-white dark:bg-slate-900 px-5 py-3 rounded border border-slate-200 dark:border-slate-800 min-w-[160px] shadow-sm">
                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Total Inward</span>
                <span className="text-[18px] font-bold font-mono text-emerald-600">{formatCurrency(incomeTotal)}</span>
              </div>
              <div className="flex flex-col bg-white dark:bg-slate-900 px-5 py-3 rounded border border-slate-200 dark:border-slate-800 min-w-[160px] shadow-sm">
                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Total Outward</span>
                <span className="text-[18px] font-bold font-mono text-rose-600">{formatCurrency(expenseTotal)}</span>
              </div>
            </div>
            <div className="flex flex-col items-end bg-white dark:bg-slate-900 px-8 py-4 rounded border border-slate-300 dark:border-slate-700 min-w-[280px] shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Net Closing Balance</span>
              <span className={`text-[26px] font-bold font-mono ${closingBalance >= 0 ? 'text-link' : 'text-rose-600'}`}>{formatCurrency(closingBalance)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CashbookSheet;
