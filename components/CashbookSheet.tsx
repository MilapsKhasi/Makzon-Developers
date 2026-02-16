
import React, { useState, useEffect } from 'react';
import { ChevronDown, Loader2, Save, ArrowLeft, Trash2, FileSpreadsheet, FileText, Calendar } from 'lucide-react';
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
  const [lastDateText, setLastDateText] = useState('');
  
  const createEmptyRow = () => ({ id: Math.random().toString(36).substr(2, 9), particulars: '', amount: '' });

  const [incomeRows, setIncomeRows] = useState<CashbookRow[]>([]);
  const [expenseRows, setExpenseRows] = useState<CashbookRow[]>([]);

  const findPreviousBalance = (dateStr: string) => {
    if (!dateStr || !existingEntries.length) {
      setOpeningBalance(0);
      setLastDateText('Initial Setup');
      return;
    }

    // Find the latest existing entry before the current report date
    const previousEntries = existingEntries
      .filter(e => e.date < dateStr && e.id !== initialData?.id)
      .sort((a, b) => {
        const dateComp = b.date.localeCompare(a.date);
        if (dateComp !== 0) return dateComp;
        return (b.created_at || '').localeCompare(a.created_at || '');
      });

    if (previousEntries.length > 0) {
      setOpeningBalance(Number(previousEntries[0].balance) || 0);
      setLastDateText(formatDate(previousEntries[0].date));
    } else {
      setOpeningBalance(0);
      setLastDateText('Initial Setup');
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
      setLastDateText(raw.lastDateText || '');
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
    exportCashbookEntryToExcel(cleanIncome, cleanExpense, { companyName, date: reportDate || new Date().toISOString().split('T')[0] });
  };

  const handleExportPDF = () => {
    const companyName = localStorage.getItem('activeCompanyName') || 'Findesk Workspace';
    const cleanIncome = incomeRows.filter(r => r.particulars.trim() !== '' && r.amount !== '');
    const cleanExpense = expenseRows.filter(r => r.particulars.trim() !== '' && r.amount !== '');
    exportCashbookEntryToPDF(cleanIncome, cleanExpense, { companyName, date: reportDate || new Date().toISOString().split('T')[0] });
  };

  const incomeTotal = calculateTotal(incomeRows);
  const expenseTotal = calculateTotal(expenseRows);
  const closingBalance = openingBalance + incomeTotal - expenseTotal;

  return (
    <div className="bg-white dark:bg-slate-900 w-full border border-slate-300 dark:border-slate-800 rounded-md flex flex-col h-full animate-in fade-in duration-300 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shrink-0">
        <div className="flex items-center space-x-4">
          <button onClick={onCancel} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-[18px] font-semibold text-slate-900 dark:text-slate-100 tracking-tight capitalize">
            {initialData ? 'Update Statement' : 'Cashbook Entry Sheet'}
          </h2>
        </div>
        <div className="flex items-center space-x-2">
          <button onClick={handleExportPDF} className="flex items-center px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-600 dark:text-slate-300 font-semibold text-[13px] hover:bg-slate-50 dark:hover:bg-slate-700 transition-all capitalize">
            <FileText className="w-4 h-4 mr-2 text-rose-500" /> PDF
          </button>
          <button onClick={handleExportXLSX} className="flex items-center px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-600 dark:text-slate-300 font-semibold text-[13px] hover:bg-slate-50 dark:hover:bg-slate-700 transition-all capitalize">
            <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-500" /> Excel
          </button>
          <button 
            onClick={() => {
              setLoading(true);
              onSave({ id: initialData?.id, date: reportDate, openingBalance, lastDateText, incomeTotal, expenseTotal, balance: closingBalance, incomeRows, expenseRows });
            }}
            disabled={loading}
            className="bg-primary text-slate-900 px-8 py-2 rounded font-bold text-[13px] hover:bg-primary-dark transition-all flex items-center ml-2 capitalize"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            {initialData ? 'Update' : 'Save'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 dark:bg-slate-950 flex flex-col space-y-3 custom-scrollbar">
        {/* Minimized Header with Statement Date and Mini Opening Balance Card */}
        <div className="flex items-center justify-between bg-white dark:bg-slate-900 px-5 py-3 border border-slate-200 dark:border-slate-800 rounded shadow-sm shrink-0">
            <div className="flex items-center space-x-4">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Statement Date</label>
              <input 
                type="text" 
                placeholder="DD/MM/YY"
                value={displayDate}
                onChange={(e) => setDisplayDate(e.target.value)}
                onBlur={handleDateBlur}
                className="border border-slate-200 dark:border-slate-700 rounded px-3 py-1.5 text-[13px] outline-none w-36 font-mono focus:border-slate-400 bg-slate-50/50 dark:bg-slate-800 dark:text-white font-bold"
              />
            </div>
            
            {/* Minimal Opening Balance Card - Small as possible */}
            <div className="flex flex-col items-end bg-white dark:bg-slate-900 px-5 py-2 rounded border border-slate-300 dark:border-slate-700 min-w-[200px] shadow-sm">
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5 leading-none">Opening Balance</span>
              <span className="text-[20px] font-bold font-mono text-slate-900 dark:text-white leading-none">
                {formatCurrency(openingBalance)}
              </span>
              <div className="flex items-center text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter mt-1 leading-none">
                <Calendar className="w-2.5 h-2.5 mr-1 opacity-50" />
                From {lastDateText}
              </div>
            </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 border border-slate-300 dark:border-slate-800 rounded overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
          <div className="grid grid-cols-2 divide-x divide-slate-300 dark:divide-slate-800 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <div className="flex items-center justify-between px-5 py-3 bg-emerald-50/20 dark:bg-emerald-950/10">
              <span className="text-[13px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-tight">Income (Inward)</span>
              <div className="flex items-center space-x-2">
                <span className="text-[9px] text-emerald-600 font-bold uppercase">Sub</span>
                <span className="text-[14px] font-bold text-emerald-600 font-mono">{formatCurrency(incomeTotal)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between px-5 py-3 bg-rose-50/20 dark:bg-rose-950/10">
              <span className="text-[13px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-tight">Expense (Outward)</span>
              <div className="flex items-center space-x-2">
                <span className="text-[9px] text-rose-600 font-bold uppercase">Sub</span>
                <span className="text-[14px] font-bold text-rose-600 font-mono">{formatCurrency(expenseTotal)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 divide-x divide-slate-300 dark:divide-slate-800 flex-1 overflow-hidden">
            <div className="overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900">
              <table className="w-full text-[13px] border-collapse relative">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 z-20 ring-1 ring-slate-200 dark:ring-slate-700">
                  <tr className="text-slate-500 dark:text-slate-400 uppercase font-bold text-[9px] tracking-widest">
                    <th className="w-12 py-2 px-2 border-r border-slate-200 dark:border-slate-700 text-center">#</th>
                    <th className="py-2 px-3 text-left">Particulars</th>
                    <th className="w-32 py-2 px-3 text-right border-l border-slate-200 dark:border-slate-700">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {incomeRows.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 group">
                      <td className="py-1 px-2 border-r border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600 text-center font-mono select-none relative">
                        <span className="group-hover:hidden text-[10px]">{idx + 1}</span>
                        <button type="button" onClick={() => removeRow('income', idx)} className="hidden group-hover:flex absolute inset-0 items-center justify-center text-rose-400 hover:text-rose-600"><Trash2 className="w-3 h-3" /></button>
                      </td>
                      <td className="py-0 px-0"><input type="text" value={row.particulars} onChange={(e) => handleInputChange('income', idx, 'particulars', e.target.value)} onKeyDown={(e) => handleKeyDown('income', idx, e)} className="w-full h-8 px-3 outline-none bg-transparent font-medium text-slate-700 dark:text-slate-300 capitalize" /></td>
                      <td className="py-0 px-0 border-l border-slate-200 dark:border-slate-700"><input type="text" value={row.amount} onChange={(e) => handleInputChange('income', idx, 'amount', e.target.value)} onKeyDown={(e) => handleKeyDown('income', idx, e)} placeholder="0.00" className="w-full h-8 px-3 text-right outline-none bg-transparent font-mono font-bold text-slate-900 dark:text-white" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900">
              <table className="w-full text-[13px] border-collapse relative">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 z-20 ring-1 ring-slate-200 dark:ring-slate-700">
                  <tr className="text-slate-500 dark:text-slate-400 uppercase font-bold text-[9px] tracking-widest">
                    <th className="w-12 py-2 px-2 border-r border-slate-200 dark:border-slate-700 text-center">#</th>
                    <th className="py-2 px-3 text-left">Particulars</th>
                    <th className="w-32 py-2 px-3 text-right border-l border-slate-200 dark:border-slate-700">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {expenseRows.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 group">
                      <td className="py-1 px-2 border-r border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600 text-center font-mono select-none relative">
                        <span className="group-hover:hidden text-[10px]">{idx + 1}</span>
                        <button type="button" onClick={() => removeRow('expense', idx)} className="hidden group-hover:flex absolute inset-0 items-center justify-center text-rose-400 hover:text-rose-600"><Trash2 className="w-3 h-3" /></button>
                      </td>
                      <td className="py-0 px-0"><input type="text" value={row.particulars} onChange={(e) => handleInputChange('expense', idx, 'particulars', e.target.value)} onKeyDown={(e) => handleKeyDown('expense', idx, e)} className="w-full h-8 px-3 outline-none bg-transparent font-medium text-slate-700 dark:text-slate-300 capitalize" /></td>
                      <td className="py-0 px-0 border-l border-slate-200 dark:border-slate-700"><input type="text" value={row.amount} onChange={(e) => handleInputChange('expense', idx, 'amount', e.target.value)} onKeyDown={(e) => handleKeyDown('expense', idx, e)} placeholder="0.00" className="w-full h-8 px-3 text-right outline-none bg-transparent font-mono font-bold text-slate-900 dark:text-white" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/40 px-6 py-4 shrink-0 flex items-center justify-between border-t border-slate-200 dark:border-slate-800">
            <div className="flex space-x-4">
              <div className="flex flex-col bg-white dark:bg-slate-900 px-4 py-2 rounded border border-slate-200 dark:border-slate-800 min-w-[140px] shadow-sm">
                <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Total In</span>
                <span className="text-[16px] font-bold font-mono text-emerald-600 leading-none">{formatCurrency(incomeTotal)}</span>
              </div>
              <div className="flex flex-col bg-white dark:bg-slate-900 px-4 py-2 rounded border border-slate-200 dark:border-slate-800 min-w-[140px] shadow-sm">
                <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Total Out</span>
                <span className="text-[16px] font-bold font-mono text-rose-600 leading-none">{formatCurrency(expenseTotal)}</span>
              </div>
            </div>
            <div className="flex flex-col items-end bg-white dark:bg-slate-900 px-6 py-3 rounded border border-slate-300 dark:border-slate-700 min-w-[240px] shadow-sm">
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Net Closing Balance</span>
              <span className={`text-[24px] font-bold font-mono leading-none ${closingBalance >= 0 ? 'text-link' : 'text-rose-600'}`}>{formatCurrency(closingBalance)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CashbookSheet;
