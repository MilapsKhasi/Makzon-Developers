
import React, { useState, useEffect, useMemo } from 'react';
import { X, ArrowUpRight, ArrowDownLeft, Calculator, Download, History, Loader2 } from 'lucide-react';
import { formatCurrency, formatDate, getActiveCompanyId, normalizeBill } from '../utils/helpers';
import { supabase } from '../lib/supabase';

interface LedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  party: any;
  type: 'customer' | 'vendor';
}

const LedgerModal: React.FC<LedgerModalProps> = ({ isOpen, onClose, party, type }) => {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const cid = getActiveCompanyId();

  const loadLedgerData = async () => {
    if (!party || !cid) return;
    setLoading(true);
    try {
      const { data: voucherData } = await supabase
        .from('bills')
        .select('*')
        .eq('company_id', cid)
        .eq('is_deleted', false);
      
      const { data: salesData } = await supabase
        .from('sales_invoices')
        .select('*')
        .eq('company_id', cid)
        .eq('is_deleted', false);

      const allVouchers = [
        ...(voucherData || []).map(v => ({ ...normalizeBill(v), source: 'bills' })),
        ...(salesData || []).map(v => ({ ...normalizeBill(v), source: 'sales_invoices' }))
      ];

      const partyTransactions = allVouchers.filter(v => 
        v.vendor_name?.toLowerCase().trim() === party.name?.toLowerCase().trim()
      );

      setTransactions(partyTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    } catch (error) {
      console.error("Error loading ledger:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) loadLedgerData();
  }, [isOpen, party, cid]);

  const { ledgerRows, finalBalance } = useMemo(() => {
    if (!party) return { ledgerRows: [], finalBalance: 0 };
    const rows: any[] = [];
    let runningBalance = Number(party.balance) || 0;

    // Opening Balance Row
    if (runningBalance !== 0) {
      rows.push({
        date: '',
        particulars: 'Opening Balance',
        debit: type === 'customer' ? (runningBalance > 0 ? runningBalance : 0) : (runningBalance < 0 ? Math.abs(runningBalance) : 0),
        credit: type === 'vendor' ? (runningBalance > 0 ? runningBalance : 0) : (runningBalance < 0 ? Math.abs(runningBalance) : 0),
        balance: runningBalance
      });
    }

    transactions.forEach(t => {
      const amount = Number(t.grand_total) || 0;
      const isSale = t.type === 'Sale';
      
      // Bill/Invoice Row
      if (isSale) {
        // Customer: Sales Bill is Debit (Increases Receivable)
        runningBalance += amount;
        rows.push({
          date: t.date,
          particulars: `Sales Bill No: ${t.bill_number}`,
          debit: amount,
          credit: 0,
          balance: runningBalance
        });
      } else {
        // Vendor: Purchase Bill is Credit (Increases Payable)
        runningBalance += amount;
        rows.push({
          date: t.date,
          particulars: `Purchase Bill No: ${t.bill_number}`,
          debit: 0,
          credit: amount,
          balance: runningBalance
        });
      }

      // Payment Row (if Paid)
      if (t.status === 'Paid') {
        const pDetailsRaw = t.items_raw?.payment_details;
        const payments = Array.isArray(pDetailsRaw) ? pDetailsRaw : (pDetailsRaw ? [pDetailsRaw] : [{
          payment_amount: amount,
          payment_date: t.date,
          payment_method: 'Cash'
        }]);

        payments.forEach((p: any) => {
          const pAmount = Number(p.payment_amount) || 0;
          const pDate = p.payment_date || t.date;
          const pMethod = p.payment_method || 'Cash';

          if (isSale) {
            // Customer: Payment Received is Credit (Decreases Receivable)
            runningBalance -= pAmount;
            rows.push({
              date: pDate,
              particulars: `Payment Received (Bill ${t.bill_number}) - ${pMethod}`,
              debit: 0,
              credit: pAmount,
              balance: runningBalance
            });
          } else {
            // Vendor: Payment Made is Debit (Decreases Payable)
            runningBalance -= pAmount;
            rows.push({
              date: pDate,
              particulars: `Payment Made (Bill ${t.bill_number}) - ${pMethod}`,
              debit: pAmount,
              credit: 0,
              balance: runningBalance
            });
          }
        });
      }
    });

    return { ledgerRows: rows, finalBalance: runningBalance };
  }, [transactions, party, type]);

  const totals = useMemo(() => {
    return ledgerRows.reduce((acc, row) => ({
      debit: acc.debit + (row.debit || 0),
      credit: acc.credit + (row.credit || 0)
    }), { debit: 0, credit: 0 });
  }, [ledgerRows]);

  if (!isOpen || !party) return null;

  return (
    <div className="fixed inset-0 z-[550] flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 w-full max-w-6xl h-full sm:h-[90vh] rounded-none sm:rounded-2xl shadow-2xl border-0 sm:border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
          <div className="flex items-center space-x-3 sm:space-x-4 overflow-hidden">
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shadow-inner shrink-0 ${type === 'customer' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600'}`}>
              <History className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="truncate">
              <h2 className="text-base sm:text-xl font-bold text-slate-900 dark:text-white capitalize tracking-tight truncate">{party.name} - Ledger</h2>
              <p className="text-[9px] sm:text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5 sm:mt-1">Statement of Accounts</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-3">
            <button className="flex items-center space-x-2 px-3 sm:px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export PDF</span>
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-slate-800 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <div className="p-4 sm:p-6 flex flex-col items-center justify-center">
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 sm:mb-2">Total Debit</p>
            <p className="text-xl sm:text-2xl font-mono font-bold text-red-500">{formatCurrency(totals.debit)}</p>
          </div>
          <div className="p-4 sm:p-6 flex flex-col items-center justify-center">
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 sm:mb-2">Total Credit</p>
            <p className="text-xl sm:text-2xl font-mono font-bold text-emerald-500">{formatCurrency(totals.credit)}</p>
          </div>
          <div className="p-4 sm:p-6 flex flex-col items-center justify-center bg-slate-50/30 dark:bg-slate-800/20">
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 sm:mb-2">Net Balance</p>
            <p className={`text-xl sm:text-2xl font-mono font-bold ${finalBalance > 0 ? (type === 'customer' ? 'text-red-500' : 'text-emerald-500') : (finalBalance < 0 ? (type === 'customer' ? 'text-emerald-500' : 'text-red-500') : 'text-slate-400')}`}>
              {formatCurrency(Math.abs(finalBalance))}
              <span className="text-[10px] sm:text-xs ml-1 sm:ml-2 uppercase opacity-50">
                {finalBalance === 0 ? '' : (type === 'customer' ? (finalBalance > 0 ? 'Dr' : 'Cr') : (finalBalance > 0 ? 'Cr' : 'Dr'))}
              </span>
            </p>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-white dark:bg-slate-900 custom-scrollbar">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-primary animate-spin opacity-20" />
            </div>
          ) : ledgerRows.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 italic">
              <Calculator className="w-16 h-16 opacity-5 mb-4" />
              <p className="text-sm font-medium">No ledger entries found for this party.</p>
            </div>
          ) : (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto shadow-sm">
              <table className="w-full text-xs border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="p-4 text-left w-32">Date</th>
                    <th className="p-4 text-left">Particulars</th>
                    <th className="p-4 text-right w-40">Debit (Dr)</th>
                    <th className="p-4 text-right w-40">Credit (Cr)</th>
                    <th className="p-4 text-right w-44 bg-slate-100/50 dark:bg-slate-800/50">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {ledgerRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                      <td className="p-4 text-slate-500 dark:text-slate-400 font-medium">{row.date ? formatDate(row.date) : '-'}</td>
                      <td className="p-4">
                        <div className="flex items-center">
                          {row.debit > 0 ? <ArrowUpRight className="w-3.5 h-3.5 mr-2 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" /> : <ArrowDownLeft className="w-3.5 h-3.5 mr-2 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />}
                          <span className="font-medium text-slate-700 dark:text-slate-200">{row.particulars}</span>
                        </div>
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-red-500/80">{row.debit > 0 ? formatCurrency(row.debit, false) : '-'}</td>
                      <td className="p-4 text-right font-mono font-bold text-emerald-500/80">{row.credit > 0 ? formatCurrency(row.credit, false) : '-'}</td>
                      <td className="p-4 text-right font-mono font-bold text-slate-900 dark:text-white bg-slate-50/30 dark:bg-slate-800/30">
                        {formatCurrency(Math.abs(row.balance), false)}
                        <span className="text-[10px] ml-1 uppercase opacity-40">
                          {row.balance === 0 ? '' : (type === 'customer' ? (row.balance > 0 ? 'Dr' : 'Cr') : (row.balance > 0 ? 'Cr' : 'Dr'))}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-8 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex flex-col sm:flex-row justify-between items-center shrink-0 gap-2">
          <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Generated on {new Date().toLocaleString()}</p>
          <div className="flex items-center space-x-2">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
             <span className="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Live Ledger Sync Active</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LedgerModal;
