import React, { useEffect, useState, useRef } from 'react';
import { Printer, X, Download, Share2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getActiveCompanyId, formatDate, formatCurrency } from '../utils/helpers';

interface InvoicePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: any;
}

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({ isOpen, onClose, invoice }) => {
  const cid = getActiveCompanyId();
  const [company, setCompany] = useState<any>({});
  const [customer, setCustomer] = useState<any>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!invoiceRef.current) return;
    const htmlContent = invoiceRef.current.outerHTML;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Invoice - ${invoice.bill_number || invoice.invoice_number || ''}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              @media print {
                body { background: white; color: black; margin: 0; padding: 0; }
                .print\\:hidden { display: none !important; }
              }
              body {
                font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                padding: 20px;
                background-color: #ffffff;
              }
            </style>
          </head>
          <body>
            <div class="max-w-[850px] mx-auto bg-white p-4">
              ${htmlContent}
            </div>
            <script>
              window.addEventListener('load', () => {
                setTimeout(() => {
                  window.print();
                  window.close();
                }, 500);
              });
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  useEffect(() => {
    if (!isOpen || !invoice) return;

    const fetchDetails = async () => {
      if (cid) {
        const { data: comp } = await supabase.from('companies').select('*').eq('id', cid).maybeSingle();
        if (comp) setCompany(comp);
      }
      const partyName = invoice.customer_name || invoice.vendor_name;
      if (partyName && cid) {
        let { data: cust } = await supabase.from('customers').select('*').eq('company_id', cid).eq('name', partyName).maybeSingle();
        if (!cust) {
          const res = await supabase.from('vendors').select('*').eq('company_id', cid).eq('name', partyName).maybeSingle();
          cust = res.data;
        }
        if (cust) setCustomer(cust);
      }
    };
    fetchDetails();
  }, [isOpen, invoice, cid]);

  if (!isOpen || !invoice) return null;

  const itemsRaw = invoice.items_raw || {};
  let lineItems: any[] = [];
  if (Array.isArray(invoice.items)) lineItems = invoice.items;
  else if (Array.isArray(itemsRaw.line_items)) lineItems = itemsRaw.line_items;

  const duties = itemsRaw.duties_and_taxes || [];
  const payment = itemsRaw.payment_details || {};

  const totalQty = lineItems.reduce((sum, item) => sum + (parseFloat(item.qty || item.quantity) || 0), 0);
  const totalTax = parseFloat(invoice.total_gst) || 0;
  const grandTotal = parseFloat(invoice.grand_total) || 0;

  // HSN Breakdown calculation
  const hsnMap: { [key: string]: { taxable: number; cgstRate: number; cgstAmt: number; sgstRate: number; sgstAmt: number; totalTax: number } } = {};
  lineItems.forEach(item => {
    const hsn = item.hsnCode || '808';
    const taxable = parseFloat(item.taxableAmount) || ((parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0));
    const taxRate = parseFloat(item.tax_rate) || 5;
    const cgstRate = taxRate / 2;
    const sgstRate = taxRate / 2;
    const taxAmt = taxable * (taxRate / 100);
    
    if (!hsnMap[hsn]) {
      hsnMap[hsn] = { taxable: 0, cgstRate, cgstAmt: 0, sgstRate, sgstAmt: 0, totalTax: 0 };
    }
    hsnMap[hsn].taxable += taxable;
    hsnMap[hsn].cgstAmt += taxAmt / 2;
    hsnMap[hsn].sgstAmt += taxAmt / 2;
    hsnMap[hsn].totalTax += taxAmt;
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 overflow-y-auto print:p-0 print:bg-white print:fixed print:inset-0">
      {/* Top Controls - Hidden during printing */}
      <div className="fixed top-4 right-4 flex items-center space-x-3 bg-slate-800 text-white px-4 py-2.5 rounded-lg shadow-xl print:hidden z-[101] border border-slate-700">
        <button 
          onClick={handlePrint} 
          className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-bold text-sm transition-all shadow-md active:scale-95"
        >
          <Printer className="w-4 h-4" />
          <span>Print Tax Invoice</span>
        </button>
        <button 
          onClick={onClose} 
          className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Invoice Paper A4 Sheet */}
      <div ref={invoiceRef} className="bg-white text-slate-900 w-full max-w-[850px] shadow-2xl mx-auto my-8 print:my-0 print:shadow-none print:w-full print:max-w-none border border-slate-300 text-xs font-sans">
        
        {/* Header Section */}
        <div className="grid grid-cols-2 border-b border-slate-300 p-6 print:p-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold text-red-600 tracking-tight">{company.name || ''}</h1>
            <p className="text-slate-600 font-medium">{company.address || ''}</p>
            <p className="text-slate-800 font-semibold mt-1">Phone: <span className="font-mono">{company.phone || ''}</span></p>
            <p className="text-slate-800 font-semibold">GSTIN: <span className="font-mono">{company.gstin || ''}</span></p>
            <p className="text-slate-800 font-semibold">PAN Number: <span className="font-mono">{company.pan || ''}</span></p>
          </div>
          
          <div className="text-right flex flex-col justify-between">
            <div>
              <span className="text-[10px] text-slate-400 tracking-widest uppercase block mb-1">Original For Recipient</span>
              <h2 className="text-xl font-bold text-slate-900 tracking-wider uppercase">Tax Invoice</h2>
            </div>
            <div className="space-y-0.5 text-xs text-slate-700 mt-4">
              <p><strong className="text-slate-900">Invoice No :</strong> <span className="font-mono font-bold text-slate-900">{invoice.bill_number || invoice.invoice_number || ''}</span></p>
              <p><strong className="text-slate-900">Invoice Date :</strong> {formatDate(invoice.date)}</p>
              <p><strong className="text-slate-900">Website :</strong> {company.website || ''}</p>
            </div>
          </div>
        </div>

        {/* Bill To / Ship To Grid */}
        <div className="grid grid-cols-2 border-b border-slate-300 divide-x divide-slate-300 bg-slate-50/50 print:bg-transparent">
          <div className="p-4 space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Bill To</span>
            <p className="text-sm font-bold text-slate-900">{invoice.customer_name || invoice.vendor_name || customer?.name || ''}</p>
            <p className="text-slate-600">{customer?.address || ''}</p>
            <p className="text-slate-700 font-medium">Pin: <span className="font-mono">{customer?.pin || ''}</span></p>
            <p className="text-slate-700 font-medium">Phone: <span className="font-mono">{customer?.phone || ''}</span></p>
            <p className="text-slate-700 font-medium">GSTIN: <span className="font-mono font-bold">{customer?.gstin || ''}</span></p>
          </div>

          <div className="p-4 space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Ship To</span>
            <p className="text-sm font-bold text-slate-900">{invoice.customer_name || invoice.vendor_name || customer?.name || ''}</p>
            <p className="text-slate-600">{customer?.shipping_address || customer?.address || ''}</p>
            <p className="text-slate-700 font-medium">Pin: <span className="font-mono">{customer?.pin || ''}</span></p>
            <p className="text-slate-700 font-medium mt-2">Place of Supply: <strong className="text-slate-900">{customer?.state || ''}</strong></p>
          </div>
        </div>

        {/* Item Table */}
        <div className="min-h-[300px] flex flex-col justify-between">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-red-600 text-white text-[11px] font-bold uppercase tracking-wider border-b border-red-700">
                <th className="py-2.5 px-3 w-12 text-center">S. No.</th>
                <th className="py-2.5 px-3">Item</th>
                <th className="py-2.5 px-3 text-center w-20">HSN</th>
                <th className="py-2.5 px-3 text-right w-24">Quantity</th>
                <th className="py-2.5 px-3 text-right w-24">Rate</th>
                <th className="py-2.5 px-3 text-right w-28">Tax/Unit</th>
                <th className="py-2.5 px-3 text-right w-28">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
              {lineItems.map((item: any, idx: number) => {
                const qty = parseFloat(item.qty || item.quantity) || 0;
                const rate = parseFloat(item.rate) || 0;
                const taxRate = parseFloat(item.tax_rate) || 5;
                const taxUnit = (rate * (taxRate / 100)).toFixed(2);
                const amount = parseFloat(item.itemTotal || item.amount) || (qty * rate * (1 + taxRate/100));

                return (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 text-center font-mono text-slate-500">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{item.itemName || item.name || 'Item'}</td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-600">{item.hsnCode || item.hsn || '808'}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{qty} {item.unit || 'KG'}</td>
                    <td className="py-2.5 px-3 text-right font-mono">Rs. {rate.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600">Rs. {taxUnit} ({taxRate}%)</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">Rs. {amount.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Table Totals Row */}
          <div>
            {parseFloat(invoice.round_off) !== 0 && !isNaN(parseFloat(invoice.round_off)) && (
              <div className="flex justify-between items-center py-2 px-3 border-t border-slate-200 text-slate-600 text-xs">
                <span className="font-semibold ml-auto pr-8">Round Off</span>
                <span className="font-mono text-right w-28">Rs. {(parseFloat(invoice.round_off) || 0).toFixed(2)}</span>
              </div>
            )}
            <div className="grid grid-cols-7 bg-slate-100/80 border-t-2 border-b border-slate-300 py-2.5 px-3 font-bold text-slate-900 text-xs items-center">
              <div className="col-span-3">TOTAL</div>
              <div className="text-right font-mono">{totalQty} KG</div>
              <div></div>
              <div className="text-right font-mono">Rs. {totalTax.toFixed(2)}</div>
              <div className="text-right font-mono text-sm text-red-600">Rs. {grandTotal.toFixed(2)}</div>
            </div>
          </div>
        </div>

        {/* Payment Summary Strip */}
        <div className="grid grid-cols-4 divide-x divide-slate-300 border-b border-slate-300 bg-slate-50 py-2.5 px-4 text-center text-xs font-semibold text-slate-700">
          <div>Received Amount <span className="font-mono font-bold text-slate-900 ml-1">Rs {parseFloat(payment.received_amount || 0).toFixed(2)}</span></div>
          <div>Balance Amount <span className="font-mono font-bold text-red-600 ml-1">Rs {parseFloat(payment.balance_amount || grandTotal).toFixed(2)}</span></div>
          <div>Previous Balance <span className="font-mono font-bold text-slate-900 ml-1">Rs. {parseFloat(payment.previous_balance || 0).toFixed(2)}</span></div>
          <div>Current Balance <span className="font-mono font-bold text-slate-900 ml-1">Rs. {parseFloat(payment.current_balance || payment.balance_amount || grandTotal).toFixed(2)}</span></div>
        </div>

        {/* HSN Tax Breakdown Table */}
        <div className="border-b border-slate-300 overflow-hidden">
          <table className="w-full text-center border-collapse text-[11px]">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold divide-x divide-slate-300">
                <th rowSpan={2} className="py-2 px-2 w-16">HSN</th>
                <th rowSpan={2} className="py-2 px-2 text-right">Taxable Amount</th>
                <th colSpan={2} className="py-1 px-2 border-b border-slate-300">CGST</th>
                <th colSpan={2} className="py-1 px-2 border-b border-slate-300">SGST</th>
                <th rowSpan={2} className="py-2 px-2 text-right">Total Tax Amount</th>
              </tr>
              <tr className="bg-slate-50 border-b border-slate-300 text-slate-600 font-semibold divide-x divide-slate-300 text-[10px]">
                <th className="py-1 px-2">Rate</th>
                <th className="py-1 px-2 text-right">Amount</th>
                <th className="py-1 px-2">Rate</th>
                <th className="py-1 px-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono text-slate-800 divide-x divide-slate-200">
              {Object.entries(hsnMap).map(([hsn, data]) => (
                <tr key={hsn}>
                  <td className="py-2 px-2 font-bold text-slate-900">{hsn}</td>
                  <td className="py-2 px-2 text-right">Rs. {data.taxable.toFixed(2)}</td>
                  <td className="py-2 px-2">{data.cgstRate}%</td>
                  <td className="py-2 px-2 text-right">Rs. {data.cgstAmt.toFixed(2)}</td>
                  <td className="py-2 px-2">{data.sgstRate}%</td>
                  <td className="py-2 px-2 text-right">Rs. {data.sgstAmt.toFixed(2)}</td>
                  <td className="py-2 px-2 text-right font-bold text-slate-900">Rs. {data.totalTax.toFixed(2)}</td>
                </tr>
              ))}
              {/* Total HSN Row */}
              <tr className="bg-slate-100 font-bold text-slate-900 border-t border-slate-300 divide-x divide-slate-300">
                <td className="py-2 px-2">Total</td>
                <td className="py-2 px-2 text-right">Rs. {Object.values(hsnMap).reduce((s, d)=>s+d.taxable, 0).toFixed(2)}</td>
                <td></td>
                <td className="py-2 px-2 text-right">Rs. {Object.values(hsnMap).reduce((s, d)=>s+d.cgstAmt, 0).toFixed(2)}</td>
                <td></td>
                <td className="py-2 px-2 text-right">Rs. {Object.values(hsnMap).reduce((s, d)=>s+d.sgstAmt, 0).toFixed(2)}</td>
                <td className="py-2 px-2 text-right text-red-600">Rs. {totalTax.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Remark Section */}
        <div className="border-b border-slate-300 p-3 bg-slate-50/50 flex items-center space-x-4 text-xs">
          <strong className="text-slate-900 uppercase tracking-wider block">Remark</strong>
          <span className="text-slate-700 italic">{invoice.description || payment.remark || ''}</span>
        </div>

        {/* Footer Terms & Bank Details */}
        <div className="grid grid-cols-3 divide-x divide-slate-300 text-xs p-4 bg-white">
          
          <div className="pr-3 space-y-1">
            <strong className="text-slate-900 uppercase tracking-wider block mb-2 border-b border-slate-200 pb-1">Terms & Conditions</strong>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 leading-relaxed font-medium">
              <li>Customer will pay the GST</li>
              <li>Customer will pay the Delivery charges</li>
              <li>Pay due amount within 15 days</li>
            </ol>
          </div>

          <div className="px-3 space-y-1 text-[11px]">
            <strong className="text-slate-900 uppercase tracking-wider block mb-2 border-b border-slate-200 pb-1">Bank Details</strong>
            <p><span className="text-slate-500">Account holder:</span> <strong className="text-slate-900">{payment.account_holder || company.name || ''}</strong></p>
            <p><span className="text-slate-500">Account number:</span> <strong className="font-mono text-slate-900">{payment.account_number || ''}</strong></p>
            <p><span className="text-slate-500">Bank:</span> <strong className="text-slate-900">{payment.bank_name || ''}</strong></p>
            <p><span className="text-slate-500">Branch:</span> <strong className="text-slate-900">{payment.branch || ''}</strong></p>
            <p><span className="text-slate-500">IFSC code:</span> <strong className="font-mono text-slate-900">{payment.ifsc || ''}</strong></p>
            <p><span className="text-slate-500">UPI ID:</span> <strong className="font-mono text-slate-900">{payment.upi_id || ''}</strong></p>
          </div>

          <div className="pl-3 flex flex-col justify-between text-center pt-2">
            <div></div>
            <div className="mt-16 border-t border-slate-300 pt-2">
              <span className="text-[11px] font-bold text-slate-800 block">Authorised Signatory For</span>
              <span className="text-xs font-extrabold text-red-600 block mt-0.5">{company.name || ''}</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
