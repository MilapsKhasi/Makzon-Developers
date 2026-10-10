import React, { useRef } from 'react';
import { Printer, X } from 'lucide-react';

interface PartyLedgerPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  party: any;
  companyInfo?: any;
  ledgerRows?: any[];
  transactions?: any[];
  dateRange?: { startDate?: string; endDate?: string };
}

const formatLedgerDate = (dStr: string) => {
  if (!dStr) return '';
  const d = new Date(dStr);
  if (isNaN(d.getTime())) return dStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
};

const formatAmount = (num: number | undefined | null) => {
  if (num === undefined || num === null || isNaN(num)) return '0';
  const val = Number(num);
  if (Number.isInteger(val)) {
    return String(val);
  }
  return val.toFixed(2);
};

export const PartyLedgerPrintModal: React.FC<PartyLedgerPrintModalProps> = ({
  isOpen,
  onClose,
  party,
  companyInfo,
  ledgerRows = [],
  transactions = [],
  dateRange
}) => {
  const printSheetRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !party) return null;

  let rows: any[] = [];
  if (ledgerRows && ledgerRows.length > 0) {
    rows = ledgerRows;
  } else if (transactions && transactions.length > 0) {
    let runningBalance = Number(party.balance) || 0;
    rows = transactions.map((t: any) => {
      const isInvoice = t.source === 'sales_invoices' || t.type === 'Sale' || (t.invoice_number && !t.invoice_number.startsWith('REC-'));
      const debit = isInvoice ? (Number(t.grand_total) || 0) : 0;
      const credit = !isInvoice ? (Number(t.grand_total) || 0) : 0;
      runningBalance += (debit - credit);
      return {
        date: t.date,
        transaction: isInvoice ? `Invoice #${t.invoice_number || t.bill_number || ''}` : `Payment #${t.reference || t.invoice_number || ''}`,
        reference: t.invoice_number || t.bill_number || '',
        debit,
        credit,
        balance: runningBalance
      };
    });
  }

  let totalDebit = 0;
  let totalCredit = 0;
  rows.forEach((r: any) => {
    totalDebit += Number(r.debit || 0);
    totalCredit += Number(r.credit || 0);
  });

  const lastRow = rows.length > 0 ? rows[rows.length - 1] : null;
  const closingBalance = lastRow ? Number(lastRow.balance || 0) : (totalDebit - totalCredit);

  let fromDate = dateRange?.startDate ? formatLedgerDate(dateRange.startDate) : '';
  let toDate = dateRange?.endDate ? formatLedgerDate(dateRange.endDate) : '';

  if (!fromDate && rows.length > 0) {
    const validDates = rows.map((r: any) => r.date).filter(Boolean);
    if (validDates.length > 0) {
      fromDate = formatLedgerDate(validDates[0]);
    }
  }
  if (!toDate && rows.length > 0) {
    const validDates = rows.map((r: any) => r.date).filter(Boolean);
    if (validDates.length > 0) {
      toDate = formatLedgerDate(validDates[validDates.length - 1]);
    }
  }

  if (!fromDate) fromDate = '01/04/26';
  if (!toDate) toDate = '31/03/27';

  const companyName = companyInfo?.name || 'SK ENTERPRISE';
  const companyGstin = companyInfo?.gstin || '24CMAPK3117Q1ZZ';
  const fullAddress = companyInfo?.address || 'Shop No 28, Shiv Om Circle, Golden Point, GIDC, Phase III, Dared, Jamnagar';

  const addressParts = fullAddress.split(',').map((s: string) => s.trim()).filter(Boolean);
  const midPoint = Math.ceil(addressParts.length / 2);
  const addressLine1 = addressParts.slice(0, midPoint).join(', ');
  const addressLine2 = addressParts.slice(midPoint).join(', ');

  const blankRowsNeeded = Math.max(0, 10 - rows.length);

  const handlePrint = () => {
    // Print feature disabled: not available on this device
  };

  return (
    <div className="ledger-print-backdrop fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-fadeIn print:p-0 print:bg-white print:static print:inset-auto print:z-auto">
      <style dangerouslySetInnerHTML={{ __html: `
        @page {
          size: A4 portrait;
          margin: 0;
        }

        @media print {
          html, body {
            width: 210mm !important;
            height: 297mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
          }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          header, nav, aside, footer, .sidebar, .liquid-glass-header, .print-modal-header, .print\\:hidden, .toolbar, .no-print {
            display: none !important;
          }

          .ledger-print-backdrop {
            position: static !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            inset: auto !important;
            z-index: auto !important;
            overflow: visible !important;
            display: block !important;
            height: auto !important;
            max-height: none !important;
          }

          .ledger-print-container {
            position: static !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            max-height: none !important;
            height: auto !important;
            overflow: visible !important;
            background: transparent !important;
            width: 210mm !important;
            max-width: 210mm !important;
          }

          .ledger-print-scroll {
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
            background: transparent !important;
            display: block !important;
          }

          .exact-ledger-page {
            box-shadow: none !important;
            margin: 0 !important;
            border: none !important;
            width: 210mm !important;
            height: 297mm !important;
            min-height: 297mm !important;
            max-height: 297mm !important;
            padding: 10mm !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            overflow: hidden !important;
            background: #ffffff !important;
          }

          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }

        .exact-ledger-page {
          width: 210mm;
          min-height: 297mm;
          height: 297mm;
          padding: 10mm;
          background: #ffffff;
          box-sizing: border-box;
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          font-size: 12px;
          line-height: 1.4;
          color: #1e293b;
        }

        .exact-ledger-page .ledger-table {
          width: 100%;
          table-layout: fixed;
          border-collapse: collapse;
        }

        .exact-ledger-page .ledger-table th {
          background-color: #D32F2F !important;
          color: #ffffff !important;
          font-weight: 600;
          font-size: 11.5px;
          text-transform: uppercase;
          padding: 8px 10px;
          letter-spacing: 0.3px;
          border: none;
        }

        .exact-ledger-page .ledger-table td {
          padding: 7px 10px;
          font-size: 12px;
          color: #1e293b;
          vertical-align: middle;
          border-bottom: 1px solid #f1f5f9;
        }

        .exact-ledger-page .col-party-desc   { width: 46%; text-align: left; }
        .exact-ledger-page .col-party-debit  { width: 18%; text-align: right; font-family: monospace; }
        .exact-ledger-page .col-party-credit { width: 18%; text-align: right; font-family: monospace; }
        .exact-ledger-page .col-party-bal    { width: 18%; text-align: right; font-family: monospace; }

        .exact-ledger-page .ledger-table tbody tr.empty-row td {
          border-bottom: 1px solid #f8fafc;
          height: 26px;
        }

        /* Consistent bottom totals rows matching invoice style borders & fills */
        .exact-ledger-page .ledger-total-row-top td {
          border-top: 1.5px solid #0f172a !important;
          border-bottom: 1px solid #cbd5e1 !important;
          background-color: #F4F8FA !important;
          font-weight: 700;
          color: #0f172a;
          padding: 8px 10px;
        }

        .exact-ledger-page .ledger-total-row-bottom td {
          border-bottom: 2px solid #0f172a !important;
          background-color: #F4F8FA !important;
          font-weight: 800;
          color: #0f172a;
          padding: 8px 10px;
        }
      `}} />

      <div className="ledger-print-container w-full max-w-[950px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh] print:max-h-none print:border-none print:shadow-none print:rounded-none">
        
        <div className="print-modal-header flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 print:hidden">
          <div className="flex-1" />
          
          <div className="flex items-center gap-4">
            <span className="text-base font-semibold text-slate-800 dark:text-slate-100">Ledger Print Preview</span>
            <div className="relative group inline-flex items-center">
              <button
                type="button"
                disabled
                className="flex items-center gap-2 bg-[#D32F2F]/70 text-white px-5 py-2 rounded-md font-semibold text-sm cursor-not-allowed shadow-none select-none transition-all"
                title="Print feature is currently not available in this device"
              >
                <span>Print Ledger</span>
                <Printer className="w-4 h-4" />
              </button>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-900/95 text-white text-xs font-normal rounded-md shadow-xl whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 border border-slate-700">
                Print feature is currently not available in this device
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900/95" />
              </div>
            </div>
          </div>

          <div className="flex-1 flex justify-end">
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="ledger-print-scroll flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100/80 dark:bg-slate-950 flex justify-center print:p-0 print:bg-white print:overflow-visible">
          <div
            ref={printSheetRef}
            className="exact-ledger-page shadow-lg print:shadow-none"
          >
            <div>
              <div className="text-center pt-1 pb-3 space-y-1">
                <h1 className="text-2xl font-bold text-slate-900 tracking-wide uppercase">
                  {companyName}
                </h1>
                {companyGstin && (
                  <p className="text-xs font-semibold text-slate-800 font-mono">
                    GSTIN : {companyGstin}
                  </p>
                )}
                {addressLine1 && (
                  <p className="text-xs text-slate-600">
                    {addressLine1}
                  </p>
                )}
                {addressLine2 && (
                  <p className="text-xs text-slate-600">
                    {addressLine2}
                  </p>
                )}
              </div>

              <div className="text-center my-3 text-xs text-slate-700 font-medium">
                <span>Statement from : <strong className="font-mono text-slate-900">{fromDate}</strong></span>
                <span className="mx-3 text-slate-400">|</span>
                <span>Statement to : <strong className="font-mono text-slate-900">{toDate}</strong></span>
              </div>

              <div className="mb-3 text-xs">
                <span className="font-semibold text-slate-700">Account : </span>
                <span className="font-bold text-slate-900 uppercase">{party?.name}</span>
              </div>

              <div className="mb-4">
                <table className="ledger-table">
                  <thead>
                    <tr>
                      <th className="col-party-desc">Particulars</th>
                      <th className="col-party-debit">Debit</th>
                      <th className="col-party-credit">Credit</th>
                      <th className="col-party-bal">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row: any, idx: number) => {
                      const desc = row.particulars || row.transaction || '';
                      const isPayment = desc.toLowerCase().includes('payment') || desc.toLowerCase().includes('receipt');
                      const refStr = row.reference && !desc.includes(row.reference) ? ` #${row.reference}` : '';
                      const fullTitle = `${desc}${refStr}`;

                      return (
                        <tr key={`row-${idx}`}>
                          <td className={`col-party-desc ${isPayment ? 'pl-8 text-slate-600 font-normal' : 'text-slate-900 font-semibold'}`}>
                            {fullTitle}
                          </td>
                          <td className="col-party-debit font-mono font-medium">
                            {row.debit > 0 ? formatAmount(row.debit) : ''}
                          </td>
                          <td className="col-party-credit font-mono font-medium">
                            {row.credit > 0 ? formatAmount(row.credit) : ''}
                          </td>
                          <td className="col-party-bal font-mono font-semibold text-slate-900">
                            {formatAmount(row.balance)}
                          </td>
                        </tr>
                      );
                    })}
                    {Array.from({ length: blankRowsNeeded }).map((_, idx) => (
                      <tr key={`blank-${idx}`} className="empty-row">
                        <td colSpan={4}>&nbsp;</td>
                      </tr>
                    ))}
                  </tbody>
                  
                  <tfoot>
                    <tr className="ledger-total-row-top">
                      <td className="col-party-desc font-bold text-slate-900">
                        Total
                      </td>
                      <td className="col-party-debit font-mono font-bold text-slate-900">
                        {formatAmount(totalDebit)}
                      </td>
                      <td className="col-party-credit font-mono font-bold text-slate-900">
                        {formatAmount(totalCredit)}
                      </td>
                      <td className="col-party-bal font-mono font-bold"></td>
                    </tr>
                    <tr className="ledger-total-row-bottom">
                      <td className="col-party-desc font-bold text-slate-900">
                        Net Closing Balance
                      </td>
                      <td colSpan={2} className="col-party-debit"></td>
                      <td className="col-party-bal font-mono font-extrabold text-slate-900 text-sm">
                        {formatAmount(closingBalance)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="pt-2 text-center text-[10px] text-slate-400"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PartyLedgerPrintModal;