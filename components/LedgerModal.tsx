import React, { useState, useEffect, useMemo } from 'react';
import { X, ArrowUpRight, ArrowDownLeft, Calculator, Printer, History, Loader2 } from 'lucide-react';
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
  const [companyInfo, setCompanyInfo] = useState<any>(null);
  const cid = getActiveCompanyId();

  const loadLedgerData = async () => {
    if (!party || !cid) return;
    setLoading(true);
    try {
      const { data: company } = await supabase
        .from('companies')
        .select('*')
        .eq('id', cid)
        .single();
      if (company) {
        setCompanyInfo(company);
      }

      const { data: voucherData } = await supabase
        .from('purchase_bills')
        .select('*')
        .eq('company_id', cid)
        .eq('is_deleted', false);
      
      const { data: salesData } = await supabase
        .from('sales_invoices')
        .select('*')
        .eq('company_id', cid)
        .eq('is_deleted', false);

      const allVouchers = [
        ...(voucherData || []).map(v => ({ ...normalizeBill(v), source: 'purchase_bills' })),
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

  const { ledgerRows } = useMemo(() => {
    if (!party) return { ledgerRows: [], finalBalance: 0 };
    const rows: any[] = [];
    let runningBalance = Number(party.balance) || 0;

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
      
      if (isSale) {
        runningBalance += amount;
        rows.push({
          date: t.date,
          particulars: `Sales Bill No: ${t.bill_number}`,
          debit: amount,
          credit: 0,
          balance: runningBalance
        });
      } else {
        runningBalance += amount;
        rows.push({
          date: t.date,
          particulars: `Purchase Bill No: ${t.bill_number}`,
          debit: 0,
          credit: amount,
          balance: runningBalance
        });
      }

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

          if (isSale) {
            runningBalance -= pAmount;
            rows.push({
              date: pDate,
              particulars: `Payment Received (Bill ${t.bill_number})`,
              debit: 0,
              credit: pAmount,
              balance: runningBalance
            });
          } else {
            runningBalance -= pAmount;
            rows.push({
              date: pDate,
              particulars: `Payment Made (Bill ${t.bill_number})`,
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

  const formatMmmYyDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [y, m, d] = parts;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIdx = parseInt(m) - 1;
    const mmm = months[monthIdx] || 'Apr';
    const yy = y.length === 4 ? y.substring(2) : y;
    return `${d.padStart(2, '0')}-${mmm}-${yy}`;
  };

  const formatLedgerDate = (isoStr: string) => {
    if (!isoStr) return '';
    const parts = isoStr.split('-');
    if (parts.length !== 3) return isoStr;
    const [y, m, d] = parts;
    return `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y}`;
  };

  const fromDateFormatted = useMemo(() => {
    if (transactions.length === 0) return '01-Apr-26';
    const dates = transactions.map(t => new Date(t.date).getTime()).filter(Boolean);
    if (dates.length === 0) return '01-Apr-26';
    const minDate = new Date(Math.min(...dates));
    return formatMmmYyDate(minDate.toISOString().split('T')[0]);
  }, [transactions]);

  const toDateFormatted = useMemo(() => {
    if (transactions.length === 0) return '31-Mar-27';
    const dates = transactions.map(t => new Date(t.date).getTime()).filter(Boolean);
    if (dates.length === 0) return '31-Mar-27';
    const maxDate = new Date(Math.max(...dates));
    return formatMmmYyDate(maxDate.toISOString().split('T')[0]);
  }, [transactions]);

  const getPrintParticulars = (row: any) => {
    if (!row.particulars) return '';
    
    if (row.particulars.startsWith('Sales Bill No:')) {
      const num = row.particulars.replace('Sales Bill No:', '').trim();
      return `Sales A/c ${num}`;
    }
    if (row.particulars.startsWith('Purchase Bill No:')) {
      const num = row.particulars.replace('Purchase Bill No:', '').trim();
      return `Purchase A/c ${num}`;
    }
    if (row.particulars.startsWith('Payment Received')) {
      const match = row.particulars.match(/Bill\s+([^\s\)]+)/);
      const billNo = match ? match[1] : '';
      return billNo ? `Payment of Sales A/c ${billNo}` : 'Payment Received';
    }
    if (row.particulars.startsWith('Payment Made')) {
      const match = row.particulars.match(/Bill\s+([^\s\)]+)/);
      const billNo = match ? match[1] : '';
      return billNo ? `Payment of Purchase A/c ${billNo}` : 'Payment Made';
    }
    
    return row.particulars;
  };

  const printRows = useMemo(() => {
    const list = [...ledgerRows];
    while (list.length < 25) {
      list.push({
        isPlaceholder: true,
        date: '',
        particulars: '',
        debit: 0,
        credit: 0,
        balance: 0
      });
    }
    return list.slice(0, 25);
  }, [ledgerRows]);

  const debitSum = totals.debit;
  const creditSum = totals.credit;
  const netClosingBalance = Math.abs(debitSum - creditSum);

  if (!isOpen || !party) return null;

  return (
    <>
      {/* SCREEN MODAL VIEW */}
      <div className="fixed inset-0 z-[550] flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300 print:hidden">
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
              <button 
                onClick={() => window.print()}
                className="flex items-center space-x-2 px-3 sm:px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4 text-primary" />
                <span className="hidden sm:inline">Print Ledger</span>
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
              <p className="text-xl sm:text-2xl font-mono font-bold text-slate-900 dark:text-white">
                {formatCurrency(netClosingBalance)}
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

      {/* ISOLATED PRINT PREVIEW TARGET */}
      <div className="ledger-print-wrapper text-black/80 font-sans bg-white">
        <style dangerouslySetInnerHTML={{ __html: `
          @media screen {
            .ledger-print-wrapper {
              display: none !important;
            }
          }

          @media print {
            body * {
              visibility: hidden !important;
            }
            
            .ledger-print-wrapper,
            .ledger-print-wrapper * {
              visibility: visible !important;
            }

            .ledger-print-wrapper {
              display: block !important;
              position: absolute !important;
              left: 0mm !important;
              top: 0mm !important;
              width: 100% !important;
              background-color: #ffffff !important;
              color: rgba(0, 0, 0, 0.8) !important;
              padding: 0mm !important;
              margin: 0mm !important;
            }

            @page {
              size: A4 portrait;
              margin: 12mm 12mm 12mm 12mm;
            }
          }
        `}} />
        
        {/* Main Framework frame box container with softer text/border controls */}
        <div className="border border-black/40 w-full min-h-[262mm] flex flex-col justify-between p-0 m-0 bg-white text-black/80 font-medium">
          <div>
            {/* Top Row Profile Header Banner Block */}
            <div className="grid grid-cols-12 border-b border-black/40 text-[11px] tracking-wide text-black/70 font-medium">
              <div className="col-span-5 p-1.5">
                GSTIN: {companyInfo?.gstin || ''}
              </div>
              <div className="col-span-3 p-1.5"></div>
              <div className="col-span-4 p-1.5 text-right">
                PHONE: {party?.phone || ''}
              </div>
            </div>

            {/* Business Brand Information Banner Section */}
            <div className="text-center py-2.5 border-b border-black/40 px-4">
              <h1 className="text-lg font-bold tracking-wide text-black/60 m-0 leading-tight">
                {companyInfo?.name?.toUpperCase() || 'SK ENTERPRISE'}
              </h1>
              <p className="text-[9px] text-black/60 uppercase tracking-wide mt-1 leading-snug font-medium">
                {companyInfo?.address || ''}
              </p>
            </div>

            {/* Meta Profile Info Account Box Data Layout */}
            <div className="grid grid-cols-12 text-[11px] border-b border-black/40 text-black/80 font-medium">
              <div className="col-span-7 p-2 space-y-1">
                <div className="flex items-baseline">
                  <span className="w-20 shrink-0 text-black/60">ACCOUNT:</span>
                  <span className="col-span-7 font-bold text-black/90">{party?.name?.toUpperCase() || ''}</span>
                </div>
                <div className="flex items-baseline mt-1">
                  <span className="w-20 shrink-0 text-black/60">GSTIN:</span>
                  <span className="col-span-7 font-bold text-black/90">{party?.gstin || ''}</span>
                </div>
              </div>
              <div className="col-span-5 p-2 flex flex-col justify-center text-black/70">
                <div className="grid grid-cols-12 gap-x-1">
                  <span className="col-span-5 text-black/60">FROM DATE</span>
                  <span className="col-span-7 font-bold text-black/90">{fromDateFormatted}</span>
                </div>
                <div className="grid grid-cols-12 gap-x-1 mt-1.5">
                  <span className="col-span-5 text-black/60">TO DATE</span>
                  <span className="col-span-7 font-bold text-black/90">{toDateFormatted}</span>
                </div>
              </div>
            </div>

            {/* Core Statement Ledger Table presentation layout */}
            <table className="w-full text-[11px] border-collapse text-black/80 table-fixed font-medium">
              <thead>
                <tr className="border-b border-black/40 text-left text-black/70 h-[8mm]">
                  <th className="p-1 text-center w-[14%] font-bold">SR NO</th>
                  <th className="p-1 text-center w-[16%] font-bold">DATE</th>
                  <th className="p-1 px-2 w-[42%] font-bold">PARTICULARS</th>
                  <th className="p-1 text-right w-[14%] px-2 font-bold">DEBIT</th>
                  <th className="p-1 text-right w-[14%] px-2 font-bold">CREDIT</th>
                </tr>
              </thead>
              <tbody>
                {printRows.map((row, idx) => {
                  const srNo = idx + 1;
                  const isPlaceholder = row.isPlaceholder;
                  
                  return (
                    <tr key={idx} className="h-[7.4mm] text-black/70 font-medium">
                      <td className="p-1 text-center">{srNo}</td>
                      <td className="p-1 text-center">
                        {isPlaceholder ? '' : (row.date ? formatLedgerDate(row.date) : '')}
                      </td>
                      <td className="p-1 px-2 truncate text-left">
                        {isPlaceholder ? '' : getPrintParticulars(row)}
                      </td>
                      <td className="p-1 text-right px-2">
                        {isPlaceholder || !row.debit ? '' : Number(row.debit).toFixed(2)}
                      </td>
                      <td className="p-1 text-right px-2">
                        {isPlaceholder || !row.credit ? '' : Number(row.credit).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Summary Calculations Frame Footer block */}
          <div className="border-t border-black/40 text-[11px] bg-white font-medium text-black/80">
            {/* Combined rows summary totals layout block row */}
            <div className="grid grid-cols-12 uppercase border-b border-black/40 h-[8mm] items-center text-black/70">
              <div className="col-span-8 text-right pr-2 font-bold text-black/80">
                TOTAL OF DEBIT CREDIT
              </div>
              <div className="col-span-2 text-right font-bold text-black/90 px-2">
                {debitSum.toFixed(2)}
              </div>
              <div className="col-span-2 text-right font-bold text-black/90 px-2">
                {creditSum.toFixed(2)}
              </div>
            </div>
            
            {/* Account statement net closure tracking row line item */}
            <div className="grid grid-cols-12 uppercase h-[8mm] items-center text-black/70">
              <div className="col-span-8 text-right pr-2 font-bold text-black/80">
                NET CLOSING BALANCE
              </div>
              <div className="col-span-2 text-right font-bold text-black/90 px-2">
                {debitSum > creditSum ? netClosingBalance.toFixed(2) : ''}
              </div>
              <div className="col-span-2 text-right font-bold text-black/90 px-2">
                {creditSum > debitSum ? netClosingBalance.toFixed(2) : ''}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default LedgerModal;
