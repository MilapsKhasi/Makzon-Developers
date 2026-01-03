import React, { useState, useEffect } from 'react';
import { X, ChevronDown, Loader2, Save, ArrowLeft } from 'lucide-react';

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

const CashbookSheet: React.FC<CashbookSheetProps> = ({ initialData, onSave, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [reportDate, setReportDate] = useState('');
  
  const createEmptyRow = () => ({ id: Math.random().toString(36).substr(2, 9), particulars: '', amount: '' });

  const [incomeRows, setIncomeRows] = useState<CashbookRow[]>([]);
  const [expenseRows, setExpenseRows] = useState<CashbookRow[]>([]);

  useEffect(() => {
    if (initialData) {
      setReportDate(initialData.date || '');
      // Ensure we have at least 15 rows for the 'sheet' look even when editing
      const raw = initialData.raw_data || {};
      const inc = Array.isArray(raw.incomeRows) ? [...raw.incomeRows] : [];
      const exp = Array.isArray(raw.expenseRows) ? [...raw.expenseRows] : [];
      
      while (inc.length < 15) inc.push(createEmptyRow());
      while (exp.length < 15) exp.push(createEmptyRow());
      
      setIncomeRows(inc);
      setExpenseRows(exp);
    } else {
      setIncomeRows(Array(15).fill(null).map(createEmptyRow));
      setExpenseRows(Array(15).fill(null).map(createEmptyRow));
    }
  }, [initialData]);

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
      } else {
        // Move to next row particulars input
        const nextInput = (e.currentTarget.closest('tr')?.nextElementSibling?.querySelector('input')) as HTMLInputElement;
        nextInput?.focus();
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
    <div className="bg-white w-full border border-slate-300 rounded-md flex flex-col h-full animate-in fade-in duration-300 shadow-sm overflow-hidden">
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
            onClick={() => {
              setLoading(true);
              onSave({
                id: initialData?.id,
                date: reportDate,
                incomeTotal,
                expenseTotal,
                balance,
                incomeRows,
                expenseRows
              });
            }}
            disabled={loading}
            className="bg-primary text-slate-900 px-8 py-2.5 rounded font-bold text-[14px] hover:bg-primary-dark transition-all flex items-center shadow-sm"
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
          <div className="bg-white px-6 py-5 border border-slate-200 rounded shadow-sm flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <label className="text-[13px] font-bold text-slate-400 uppercase tracking-wider">Statement Date</label>
              <input 
                type="text" 
                placeholder="YYYY-MM-DD"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="border border-slate-200 rounded px-4 py-2 text-[14px] outline-none w-40 font-mono focus:border-link transition-colors"
              />
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-[13px] font-bold text-slate-400 uppercase tracking-wider">Closing Bal</span>
              <span className={`text-[18px] font-bold font-mono ${balance >= 0 ? 'text-link' : 'text-rose-500'}`}>₹ {balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
          
          <div className="bg-white px-6 py-5 border border-slate-200 rounded shadow-sm flex items-center justify-end space-x-6">
            <div className="flex items-center space-x-2">
                <span className="text-[12px] font-bold text-slate-400 uppercase">Export Options</span>
                <div className="relative">
                  <select className="appearance-none border border-slate-200 rounded pl-4 pr-10 py-1.5 text-[12px] bg-slate-50 outline-none cursor-pointer text-slate-600 hover:bg-slate-100">
                      <option>XLSX Sheet</option>
                      <option>PDF Print</option>
                      <option>CSV Data</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
            </div>
          </div>
        </div>

        {/* Ledger Grid */}
        <div className="flex-1 flex flex-col min-h-0 border border-slate-300 rounded shadow-lg overflow-hidden bg-white">
          {/* Legend Headers */}
          <div className="grid grid-cols-2 divide-x divide-slate-300 bg-white border-b border-slate-200 shrink-0">
            <div className="flex items-center justify-between px-6 py-4 bg-emerald-50/30">
              <span className="text-[15px] font-bold text-emerald-700 uppercase tracking-tighter">Inward (Income)</span>
              <div className="flex items-center space-x-3">
                <span className="text-[11px] text-emerald-600/60 uppercase font-black">Subtotal</span>
                <span className="text-[16px] font-black text-emerald-600 font-mono">₹{incomeTotal.toFixed(2)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between px-6 py-4 bg-rose-50/30">
              <span className="text-[15px] font-bold text-rose-700 uppercase tracking-tighter">Outward (Expense)</span>
              <div className="flex items-center space-x-3">
                <span className="text-[11px] text-rose-600/60 uppercase font-black">Subtotal</span>
                <span className="text-[16px] font-black text-rose-600 font-mono">₹{expenseTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 divide-x divide-slate-300 flex-1 overflow-hidden">
            {/* Income Table */}
            <div className="overflow-y-auto custom-scrollbar bg-white">
              <table className="w-full text-[13px] border-collapse relative">
                <thead className="sticky top-0 bg-slate-100 z-20 ring-1 ring-slate-200">
                  <tr className="text-slate-600 uppercase font-bold text-[11px]">
                    <th className="w-16 py-3 px-3 border-r border-slate-200 text-center bg-slate-100">Sr</th>
                    <th className="py-3 px-4 text-left">Particulars / Source</th>
                    <th className="w-40 py-3 px-4 text-right border-l border-slate-200">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {incomeRows.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-slate-50 group border-b border-slate-100 last:border-0">
                      <td className="py-2 px-3 border-r border-slate-200 text-slate-400 text-center font-mono select-none">{idx + 1}</td>
                      <td className="py-0 px-0">
                        <input
                          type="text"
                          value={row.particulars}
                          onChange={(e) => handleInputChange('income', idx, 'particulars', e.target.value)}
                          onKeyDown={(e) => handleKeyDown('income', idx, e)}
                          placeholder="Type description..."
                          className="w-full h-10 px-4 outline-none bg-transparent focus:bg-white placeholder:text-slate-200 transition-colors"
                        />
                      </td>
                      <td className="py-0 px-0 border-l border-slate-200">
                        <input
                          type="number"
                          value={row.amount}
                          onChange={(e) => handleInputChange('income', idx, 'amount', e.target.value)}
                          onKeyDown={(e) => handleKeyDown('income', idx, e)}
                          placeholder="0.00"
                          className="w-full h-10 px-4 text-right outline-none bg-transparent focus:bg-white font-mono font-semibold text-slate-700 placeholder:text-slate-200"
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
                  <tr className="text-slate-600 uppercase font-bold text-[11px]">
                    <th className="w-16 py-3 px-3 border-r border-slate-200 text-center bg-slate-100">Sr</th>
                    <th className="py-3 px-4 text-left">Particulars / Usage</th>
                    <th className="w-40 py-3 px-4 text-right border-l border-slate-200">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {expenseRows.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-slate-50 group border-b border-slate-100 last:border-0">
                      <td className="py-2 px-3 border-r border-slate-200 text-slate-400 text-center font-mono select-none">{idx + 1}</td>
                      <td className="py-0 px-0">
                        <input
                          type="text"
                          value={row.particulars}
                          onChange={(e) => handleInputChange('expense', idx, 'particulars', e.target.value)}
                          onKeyDown={(e) => handleKeyDown('expense', idx, e)}
                          placeholder="Type description..."
                          className="w-full h-10 px-4 outline-none bg-transparent focus:bg-white placeholder:text-slate-200 transition-colors"
                        />
                      </td>
                      <td className="py-0 px-0 border-l border-slate-200">
                        <input
                          type="number"
                          value={row.amount}
                          onChange={(e) => handleInputChange('expense', idx, 'amount', e.target.value)}
                          onKeyDown={(e) => handleKeyDown('expense', idx, e)}
                          placeholder="0.00"
                          className="w-full h-10 px-4 text-right outline-none bg-transparent focus:bg-white font-mono font-semibold text-slate-700 placeholder:text-slate-200"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sheet Footer Summary */}
          <div className="bg-slate-900 px-8 py-6 shrink-0 flex items-center justify-between text-white">
            <div className="flex space-x-12">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Inward Sum</span>
                <span className="text-xl font-bold font-mono">₹{incomeTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Outward Sum</span>
                <span className="text-xl font-bold font-mono">₹{expenseTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Net Balance</span>
              <span className={`text-2xl font-black font-mono ${balance >= 0 ? 'text-primary' : 'text-rose-400'}`}>
                ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CashbookSheet;