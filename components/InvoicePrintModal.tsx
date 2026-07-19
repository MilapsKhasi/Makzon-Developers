import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Printer, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getActiveCompanyId, formatDate } from '../utils/helpers';

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

  // Print customization states
  const [userScale, setUserScale] = useState<number | 'auto'>('auto');
  const [marginSize, setMarginSize] = useState<string>('6mm');
  const [rowPadding, setRowPadding] = useState<'compact' | 'normal' | 'extra-compact'>('compact');

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

  const itemsRaw = invoice?.items_raw || {};
  let lineItems: any[] = [];
  if (invoice) {
    if (Array.isArray(invoice.items)) lineItems = invoice.items;
    else if (Array.isArray(itemsRaw.line_items)) lineItems = itemsRaw.line_items;
  }

  const itemLen = lineItems.length;
  const autoScale = useMemo(() => {
    if (itemLen <= 5) return 1.0;
    if (itemLen <= 8) return 0.95;
    if (itemLen <= 12) return 0.84;
    if (itemLen <= 16) return 0.73;
    if (itemLen <= 22) return 0.63;
    if (itemLen <= 28) return 0.53;
    return 0.45;
  }, [itemLen]);

  if (!isOpen || !invoice) return null;

  const payment = itemsRaw.payment_details || {};

  // Dynamically configure fallbacks to match the pixel-perfect mockup exactly, falling back to empty strings where not provided
  const companyName = company.name || '';
  const companyAddress = company.address || '';
  const companyPhone = company.phone || '';
  const companyGstin = company.gstin || '';
  const companyPan = company.pan || '';
  const companyEmail = company.email || '';
  const companyWebsite = company.website || '';
  const companyFssai = company.fssai || '';

  const customerName = invoice.customer_name || invoice.vendor_name || customer?.name || '';
  const customerAddress = customer?.address || '';
  const customerPin = customer?.pin || '';
  const customerPhone = customer?.phone || '';
  const customerPan = customer?.pan || '';
  const customerGstin = customer?.gstin || '';
  const customerState = customer?.state || '';

  const shipToName = invoice.customer_name || invoice.vendor_name || customer?.name || '';
  const shipToAddress = customer?.shipping_address || customer?.address || '';
  const shipToPin = customer?.shipping_pin || customer?.pin || '';

  const invoiceNo = invoice.bill_number || invoice.invoice_number || '';
  const invoiceDate = invoice.date ? formatDate(invoice.date) : '';

  // Item List
  let displayLineItems = [...lineItems];

  const activeScale = userScale === 'auto' ? autoScale : userScale;

  // Dynamic row, cell, section and inner layout classes
  const rowHeightClass = rowPadding === 'extra-compact' ? 'h-[18px]' : rowPadding === 'compact' ? 'h-[22px]' : 'h-[28px]';
  const cellPaddingClass = rowPadding === 'extra-compact' ? 'py-0.5 px-2 text-[9px]' : rowPadding === 'compact' ? 'py-1 px-2 text-[10px]' : 'py-1.5 px-3 text-[11px]';
  const sectionPaddingClass = rowPadding === 'extra-compact' ? 'p-2.5' : rowPadding === 'compact' ? 'p-3.5' : 'p-5';
  const innerPaddingClass = rowPadding === 'extra-compact' ? 'p-2 space-y-0.5 text-[10px]' : rowPadding === 'compact' ? 'p-3 space-y-1 text-[11px]' : 'p-4 space-y-1';
  const hsnRowHeightClass = rowPadding === 'extra-compact' ? 'h-[16px]' : rowPadding === 'compact' ? 'h-[19px]' : 'h-[24px]';
  const hsnCellPaddingClass = rowPadding === 'extra-compact' ? 'py-0.5 px-1.5 text-[8.5px]' : rowPadding === 'compact' ? 'py-0.5 px-2 text-[9px]' : 'py-1 px-2 text-[10px]';
  const footerPaddingClass = rowPadding === 'extra-compact' ? 'p-2 text-[8.5px]' : rowPadding === 'compact' ? 'p-3 text-[9.5px]' : 'p-4 text-[10px]';
  const summaryPaddingClass = rowPadding === 'extra-compact' ? 'py-1 px-2.5 text-[9px]' : rowPadding === 'compact' ? 'py-2 px-3 text-[10px]' : 'py-2.5 px-3';

  // Calculate total discount
  const totalDiscount = lineItems.reduce((sum, item) => {
    const qty = parseFloat(item.qty || item.quantity) || 0;
    const rate = parseFloat(item.rate) || 0;
    const disc = parseFloat(item.discount) || 0;
    const discType = item.discount_type || 'Percentage';
    
    const baseAmount = qty * rate;
    let discAmt = 0;
    if (discType === 'Percentage') {
      discAmt = baseAmount * (disc / 100);
    } else {
      discAmt = disc;
    }
    return sum + discAmt;
  }, 0);

  // Padding rows to make sure vertical borders span the entire table height
  const minRows = rowPadding === 'extra-compact' ? 4 : rowPadding === 'compact' ? 6 : 8;
  const paddedItems = [...displayLineItems];
  while (paddedItems.length < minRows) {
    paddedItems.push({ isPadding: true });
  }

  // Calculate totals
  const totalQty = displayLineItems.reduce((sum, item) => sum + (parseFloat(item.qty || item.quantity) || 0), 0);
  const totalTaxableVal = displayLineItems.reduce((sum, item) => sum + (parseFloat(item.taxableAmount) || ((parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0))), 0);
  
  const isInterState = invoice.gst_type === 'Inter-State' || invoice.gstType === 'IGST' || invoice.items_raw?.gst_type === 'Inter-State';

  // HSN Breakdown calculations
  const hsnMap: { [key: string]: { taxable: number; cgstRate: number; cgstAmt: number; sgstRate: number; sgstAmt: number; igstRate: number; igstAmt: number; totalTax: number } } = {};
  displayLineItems.forEach(item => {
    const hsn = item.hsnCode || item.hsn || '';
    const taxable = parseFloat(item.taxableAmount) || ((parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0));
    const taxRate = parseFloat(item.tax_rate) || 0;
    const cgstRate = taxRate / 2;
    const sgstRate = taxRate / 2;
    const igstRate = taxRate;
    const taxAmt = taxable * (taxRate / 100);
    
    if (hsn) {
      if (!hsnMap[hsn]) {
        hsnMap[hsn] = { taxable: 0, cgstRate, cgstAmt: 0, sgstRate, sgstAmt: 0, igstRate, igstAmt: 0, totalTax: 0 };
      }
      hsnMap[hsn].taxable += taxable;
      hsnMap[hsn].cgstAmt += taxAmt / 2;
      hsnMap[hsn].sgstAmt += taxAmt / 2;
      hsnMap[hsn].igstAmt += taxAmt;
      hsnMap[hsn].totalTax += taxAmt;
    }
  });

  const totalCgstVal = Object.values(hsnMap).reduce((s, d) => s + d.cgstAmt, 0);
  const totalSgstVal = Object.values(hsnMap).reduce((s, d) => s + d.sgstAmt, 0);
  const totalIgstVal = Object.values(hsnMap).reduce((s, d) => s + d.igstAmt, 0);
  const totalTaxVal = Object.values(hsnMap).reduce((s, d) => s + d.totalTax, 0);
  
  // Final calculations
  const totalTaxUnitValue = totalTaxVal;
  const grandTotalValue = totalTaxableVal + totalTaxVal - totalDiscount;

  // Received and Ledger values
  const receivedAmount = payment.received_amount !== undefined ? parseFloat(payment.received_amount) : 0;
  const balanceAmount = payment.balance_amount !== undefined ? parseFloat(payment.balance_amount) : (grandTotalValue - receivedAmount);
  const previousBalance = payment.previous_balance !== undefined ? parseFloat(payment.previous_balance) : 0;
  const currentBalance = payment.current_balance !== undefined ? parseFloat(payment.current_balance) : (previousBalance + balanceAmount);

  // Remark and Footer details values
  const remarkText = invoice.description || payment.remark || '';
  const bankHolder = payment.account_holder || '';
  const bankAccount = payment.account_number || '';
  const bankName = payment.bank_name || '';
  const bankBranch = payment.branch || '';
  const bankIfsc = payment.ifsc || '';
  const bankUpi = payment.upi_id || '';

  const handlePrint = () => {
    if (!invoiceRef.current) return;
    const htmlContent = invoiceRef.current.outerHTML;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Tax Invoice - ${invoiceNo}</title>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
              
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                box-sizing: border-box;
              }
              
              body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                margin: 0;
                padding: 0;
                background-color: #ffffff;
                color: #0f172a;
              }

              @page {
                size: A4 portrait;
                margin: ${marginSize} !important;
              }

              @media print {
                body {
                  background: white;
                  color: black;
                  margin: 0 !important;
                  padding: 0 !important;
                }
                .print\\:hidden {
                  display: none !important;
                }
                .print-container {
                  border: 1px solid #cbd5e1 !important;
                  width: 100% !important;
                  height: calc(297mm - 2 * ${marginSize}) !important;
                  max-height: calc(297mm - 2 * ${marginSize}) !important;
                  zoom: ${activeScale} !important;
                  display: flex !important;
                  flex-direction: column !important;
                  justify-content: space-between !important;
                  overflow: hidden !important;
                  box-sizing: border-box !important;
                  margin: 0 !important;
                  box-shadow: none !important;
                }
                tr {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }
                .avoid-break {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }
              }
            </style>
          </head>
          <body class="p-4 bg-white print:p-0 print:bg-white">
            <div class="max-w-[850px] mx-auto bg-white print:max-w-none print:w-full">
              ${htmlContent}
            </div>
            <script>
              window.addEventListener('load', () => {
                setTimeout(() => {
                  window.print();
                  window.close();
                }, 600);
              });
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center bg-slate-900/90 backdrop-blur-sm p-4 pt-24 pb-8 overflow-y-auto print:p-0 print:bg-white print:fixed print:inset-0 font-sans">
      {/* Top Controls - Floating Pill Dashboard */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 flex flex-wrap items-center gap-3 bg-slate-950/95 text-white px-5 py-2.5 rounded-full shadow-2xl print:hidden z-[101] border border-slate-800 backdrop-blur-md max-w-[95%] sm:max-w-max select-none">
        <div className="flex items-center space-x-2 border-r border-slate-800 pr-3 mr-1 shrink-0">
          <Printer className="w-4 h-4 text-red-500 animate-pulse" />
          <span className="font-extrabold text-[11px] uppercase tracking-wider text-slate-300">A4 Single-Page Studio</span>
        </div>

        {/* Margins */}
        <div className="flex items-center space-x-1.5 text-[11px] font-bold text-slate-400">
          <span>Margins:</span>
          <select 
            value={marginSize} 
            onChange={(e) => setMarginSize(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-[11px] rounded-full px-2.5 py-1 outline-none text-slate-200 font-bold focus:border-red-500 hover:border-slate-700 transition-colors cursor-pointer"
          >
            <option value="0mm">Zero (0mm)</option>
            <option value="4mm">Narrow (4mm)</option>
            <option value="6mm">Compact (6mm)</option>
            <option value="8mm">Default (8mm)</option>
            <option value="12mm">Wide (12mm)</option>
          </select>
        </div>

        {/* Scale/Zoom */}
        <div className="flex items-center space-x-1.5 text-[11px] font-bold text-slate-400">
          <span>Zoom Scale:</span>
          <select 
            value={userScale} 
            onChange={(e) => {
              const val = e.target.value;
              setUserScale(val === 'auto' ? 'auto' : parseFloat(val));
            }}
            className="bg-slate-900 border border-slate-800 text-[11px] rounded-full px-2.5 py-1 outline-none text-slate-200 font-bold focus:border-red-500 hover:border-slate-700 transition-colors cursor-pointer"
          >
            <option value="auto">Auto-Fit (1 Page) ~ {Math.round(autoScale * 100)}%</option>
            <option value="1">100% (Original)</option>
            <option value="0.95">95%</option>
            <option value="0.9">90%</option>
            <option value="0.85">85%</option>
            <option value="0.8">80%</option>
            <option value="0.75">75%</option>
            <option value="0.7">70%</option>
            <option value="0.65">65%</option>
            <option value="0.6">60%</option>
            <option value="0.55">55%</option>
            <option value="0.5">50%</option>
          </select>
        </div>

        {/* Row Density */}
        <div className="flex items-center space-x-1.5 text-[11px] font-bold text-slate-400">
          <span>Density:</span>
          <select 
            value={rowPadding} 
            onChange={(e) => setRowPadding(e.target.value as any)}
            className="bg-slate-900 border border-slate-800 text-[11px] rounded-full px-2.5 py-1 outline-none text-slate-200 font-bold focus:border-red-500 hover:border-slate-700 transition-colors cursor-pointer"
          >
            <option value="normal">Loose</option>
            <option value="compact">Compact</option>
            <option value="extra-compact">Super Compact</option>
          </select>
        </div>

        <div className="h-5 w-[1px] bg-slate-800 shrink-0 mx-1"></div>

        {/* Primary buttons */}
        <div className="flex items-center space-x-1.5 shrink-0">
          <button 
            onClick={handlePrint} 
            className="flex items-center space-x-1.5 bg-red-600 hover:bg-red-700 text-white px-3.5 py-1 rounded-full font-extrabold text-[11px] uppercase tracking-wider transition-all shadow-md active:scale-95"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Invoice</span>
          </button>
          <button 
            onClick={onClose} 
            className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-full transition-colors"
            title="Close Preview"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Invoice Paper A4 Sheet */}
      <div 
        ref={invoiceRef} 
        className="print-container bg-white text-slate-900 w-full max-w-[820px] print:max-w-none print:w-full shadow-2xl mx-auto my-0 print:my-0 print:shadow-none border border-slate-400 text-[11px] relative flex flex-col justify-between overflow-hidden print:overflow-hidden select-text leading-normal"
        style={{ 
          contentVisibility: 'visible',
          height: '280mm',
          maxHeight: '280mm',
          zoom: activeScale,
          padding: marginSize,
        }}
      >
        {/* 1. Header Section */}
        <div className="grid grid-cols-2 divide-x divide-slate-300 border-b border-slate-300">
          <div className={`${sectionPaddingClass} space-y-1 text-left`}>
            <h1 className="text-[25px] font-[800] text-red-600 uppercase tracking-tight leading-none mb-1">{companyName}</h1>
            <p className="text-slate-500 font-semibold text-[11px] leading-relaxed max-w-[95%]">{companyAddress}</p>
            <div className="pt-1 space-y-0.5 text-slate-800 font-semibold text-[11px]">
              <p>Phone: <span className="font-mono text-slate-950 font-bold">{companyPhone}</span></p>
              <p>GSTIN: <span className="font-mono text-slate-950 font-bold">{companyGstin}</span></p>
              <p>PAN Number: <span className="font-mono text-slate-950 font-bold">{companyPan}</span></p>
            </div>
          </div>
          
          <div className={`${sectionPaddingClass} flex flex-col justify-between text-left`}>
            <div className="flex justify-between items-start">
              <h2 className="text-[22px] font-[800] text-slate-900 tracking-wider uppercase leading-none">Tax Invoice</h2>
              <span className="text-[8px] font-[800] text-slate-400 tracking-widest uppercase border border-slate-200 px-1.5 py-0.5 rounded">Original For Recipient</span>
            </div>
            <div className="space-y-1 text-[11px] text-slate-700 mt-4 font-semibold">
              <p>Invoice No: <span className="font-mono font-extrabold text-slate-950">{invoiceNo}</span></p>
              <p>Invoice Date: <span className="font-medium text-slate-950">{invoiceDate}</span></p>
              <p className="flex justify-between max-w-[90%] gap-2">
                <span>Email id: <span className="font-medium text-slate-950">{companyEmail}</span></span>
                <span>Website: <span className="font-medium text-slate-950">{companyWebsite}</span></span>
              </p>
              <p>FSSAI No: <span className="font-mono text-slate-950 font-medium">{companyFssai}</span></p>
            </div>
          </div>
        </div>

        {/* 2. Bill To / Ship To Grid */}
        <div className="grid grid-cols-2 divide-x divide-slate-300 border-b border-slate-300">
          <div className="flex flex-col text-left">
            <div className="bg-slate-50 border-b border-slate-300 py-1 px-4 text-[9px] font-[800] text-slate-400 uppercase tracking-widest">Bill To</div>
            <div className={`${innerPaddingClass}`}>
              <p className="text-[12px] font-bold text-slate-950 capitalize">{customerName}</p>
              <p className="text-slate-500 font-semibold leading-relaxed">{customerAddress}</p>
              <p className="text-slate-800 font-semibold">Pin: <span className="font-mono text-slate-950 font-bold">{customerPin}</span></p>
              <div className="flex justify-between text-slate-700 font-semibold pt-1 text-[10px]">
                <span>Phone: <span className="font-mono text-slate-950 font-bold">{customerPhone}</span></span>
                <span>PAN Number: <span className="font-mono text-slate-950 font-bold">{customerPan}</span></span>
              </div>
              <div className="flex justify-between text-slate-700 font-semibold text-[10px]">
                <span>GSTIN: <span className="font-mono text-slate-950 font-bold">{customerGstin}</span></span>
                <span>Place of Supply: <span className="text-slate-950 font-bold">{customerState}</span></span>
              </div>
            </div>
          </div>

          <div className="flex flex-col text-left">
            <div className="bg-slate-50 border-b border-slate-300 py-1 px-4 text-[9px] font-[800] text-slate-400 uppercase tracking-widest">Ship To</div>
            <div className={`${innerPaddingClass}`}>
              <p className="text-[12px] font-bold text-slate-950 capitalize">{shipToName}</p>
              <p className="text-slate-500 font-semibold leading-relaxed">{shipToAddress}</p>
              <p className="text-slate-800 font-semibold">Pin: <span className="font-mono text-slate-950 font-bold">{shipToPin}</span></p>
            </div>
          </div>
        </div>

        {/* 3. Items Table Container */}
        <div className="flex-1 relative overflow-hidden flex flex-col justify-between min-h-0">
          {/* Subtle Flame-Gear Watermark */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.035] select-none z-0">
            <svg className="w-64 h-64 text-slate-900" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.2">
              <circle cx="50" cy="50" r="46" />
              <circle cx="50" cy="50" r="42" strokeDasharray="3 3" />
              <path d="M50,15 C40,30 35,45 42,60 C45,65 50,70 55,68 C60,66 65,60 62,50 C60,45 54,42 50,38 C46,42 42,48 45,55 C47,58 51,59 52,57 C53,55 51,52 49,50 C52,44 58,48 57,53 C56,56 52,62 46,59 C41,56 42,42 48,32 Z" fill="currentColor" opacity="0.85"/>
              <circle cx="50" cy="50" r="10" />
              <path d="M50,35 L50,39 M50,61 L50,65 M35,50 L39,50 M61,50 L65,50 M39,39 L42,42 M58,58 L61,61 M39,61 L42,58 M58,39 L61,42" strokeWidth="2" />
            </svg>
          </div>

          <table className="w-full text-left border-collapse z-10 relative">
            <thead>
              <tr className="bg-red-600 text-white text-[10px] font-extrabold uppercase tracking-wider border-b border-red-700 divide-x divide-red-500">
                <th className={`${rowPadding === 'extra-compact' ? 'py-1 px-1.5' : 'py-2 px-3'} w-[5%] text-center`}>S.</th>
                <th className={`${rowPadding === 'extra-compact' ? 'py-1 px-1.5' : 'py-2 px-3'} w-[35%] text-left`}>Item</th>
                <th className={`${rowPadding === 'extra-compact' ? 'py-1 px-1.5' : 'py-2 px-3'} w-[10%] text-center`}>HSN</th>
                <th className={`${rowPadding === 'extra-compact' ? 'py-1 px-1.5' : 'py-2 px-3'} w-[12%] text-right`}>Qty</th>
                <th className={`${rowPadding === 'extra-compact' ? 'py-1 px-1.5' : 'py-2 px-3'} w-[12%] text-right`}>Rate</th>
                <th className={`${rowPadding === 'extra-compact' ? 'py-1 px-1.5' : 'py-2 px-3'} w-[13%] text-right`}>Tax</th>
                <th className={`${rowPadding === 'extra-compact' ? 'py-1 px-1.5' : 'py-2 px-3'} w-[13%] text-right`}>Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {paddedItems.map((item: any, idx: number) => {
                if (item.isPadding) {
                  return (
                    <tr key={`pad-${idx}`} className={`${rowHeightClass} divide-x divide-slate-300`}>
                      <td className={cellPaddingClass}></td>
                      <td className={cellPaddingClass}></td>
                      <td className={cellPaddingClass}></td>
                      <td className={cellPaddingClass}></td>
                      <td className={cellPaddingClass}></td>
                      <td className={cellPaddingClass}></td>
                      <td className={cellPaddingClass}></td>
                    </tr>
                  );
                }

                const qty = parseFloat(item.qty || item.quantity) || 0;
                const rate = parseFloat(item.rate) || 0;
                const taxRate = parseFloat(item.tax_rate) || 5;
                const taxUnit = (rate * (taxRate / 100)).toFixed(2);
                const amount = parseFloat(item.itemTotal || item.amount) || (qty * rate * (1 + taxRate/100));

                return (
                  <tr key={idx} className={`${rowHeightClass} divide-x divide-slate-300 hover:bg-slate-50/20`}>
                    <td className={`${cellPaddingClass} text-center font-mono text-slate-400`}>{idx + 1}</td>
                    <td className={`${cellPaddingClass} text-left font-bold text-slate-900 truncate max-w-[200px]`}>{item.itemName || item.name || 'Item'}</td>
                    <td className={`${cellPaddingClass} text-center font-mono text-slate-600`}>{item.hsnCode || item.hsn || '808'}</td>
                    <td className={`${cellPaddingClass} text-right font-mono`}>{qty}</td>
                    <td className={`${cellPaddingClass} text-right font-mono`}>Rs. {rate.toFixed(2)}</td>
                    <td className={`${cellPaddingClass} text-right font-mono text-slate-600`}>Rs. {taxUnit} ({taxRate}%)</td>
                    <td className={`${cellPaddingClass} text-right font-mono font-bold text-slate-950`}>Rs. {amount.toFixed(2)}</td>
                  </tr>
                );
              })}

              {/* Discount Row */}
              {totalDiscount > 0 && (
                <tr className={`${rowHeightClass} divide-x divide-slate-300 bg-slate-50/20 border-t border-slate-200`}>
                  <td className={cellPaddingClass}></td>
                  <td colSpan={5} className={`${cellPaddingClass} text-right font-bold text-slate-700`}>Discount</td>
                  <td className={`${cellPaddingClass} text-right font-mono font-bold text-red-600`}>- Rs. {totalDiscount.toFixed(2)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 4. Total Summary Line */}
        <div className={`grid grid-cols-7 border-t border-b border-slate-300 ${summaryPaddingClass} font-extrabold text-slate-900 bg-slate-50 items-center avoid-break`}>
          <div className="col-span-3 text-left uppercase text-[10px] tracking-wider text-slate-500">Total</div>
          <div className="text-right font-mono pr-2">{totalQty}</div>
          <div></div>
          <div className="text-right font-mono pr-2">Rs. {totalTaxUnitValue.toFixed(2)}</div>
          <div className="text-right font-mono text-slate-950">Rs. {grandTotalValue.toFixed(2)}</div>
        </div>

        {/* 5. Payment Ledger Strip */}
        <div className={`grid grid-cols-4 divide-x divide-slate-300 border-b border-slate-300 bg-slate-50/30 ${rowPadding === 'extra-compact' ? 'py-1 px-2 text-[9px]' : 'py-2 px-4 text-[10px]'} text-center font-bold text-slate-700 avoid-break`}>
          <div>Received <span className="font-mono font-extrabold text-slate-950 ml-1.5">Rs. {receivedAmount.toFixed(2)}</span></div>
          <div>Balance <span className="font-mono font-extrabold text-red-600 ml-1.5">Rs. {balanceAmount.toFixed(2)}</span></div>
          <div>Prev. Bal. <span className="font-mono font-extrabold text-slate-950 ml-1.5">Rs. {previousBalance.toFixed(2)}</span></div>
          <div>Curr. Bal. <span className="font-mono font-extrabold text-slate-950 ml-1.5">Rs. {currentBalance.toFixed(2)}</span></div>
        </div>

        {/* 6. HSN GST Breakdown Table */}
        <div className="border-b border-slate-300 avoid-break">
          <table className="w-full text-center border-collapse text-[10px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-300 text-slate-700 font-extrabold divide-x divide-slate-300">
                <th rowSpan={2} className={`${hsnCellPaddingClass} w-16 text-center`}>HSN</th>
                <th rowSpan={2} className={`${hsnCellPaddingClass} text-right`}>Taxable Amount</th>
                {isInterState ? (
                  <th colSpan={2} className="py-0.5 px-2 text-center border-b border-slate-300">IGST</th>
                ) : (
                  <>
                    <th colSpan={2} className="py-0.5 px-2 text-center border-b border-slate-300">CGST</th>
                    <th colSpan={2} className="py-0.5 px-2 text-center border-b border-slate-300">SGST</th>
                  </>
                )}
                <th rowSpan={2} className={`${hsnCellPaddingClass} text-right`}>Total Tax Amount</th>
              </tr>
              <tr className="bg-slate-50 border-b border-slate-300 text-slate-500 font-bold divide-x divide-slate-300 text-[9px]">
                {isInterState ? (
                  <>
                    <th className="py-0.5 px-2">Rate</th>
                    <th className="py-0.5 px-2 text-right">Amount</th>
                  </>
                ) : (
                  <>
                    <th className="py-0.5 px-2">Rate</th>
                    <th className="py-0.5 px-2 text-right">Amount</th>
                    <th className="py-0.5 px-2">Rate</th>
                    <th className="py-0.5 px-2 text-right">Amount</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono text-slate-800 divide-x divide-slate-200">
              {Object.entries(hsnMap).map(([hsn, data]) => (
                <tr key={hsn} className={`${hsnRowHeightClass} divide-x divide-slate-200`}>
                  <td className={`${hsnCellPaddingClass} font-bold text-slate-900 text-center`}>{hsn}</td>
                  <td className={`${hsnCellPaddingClass} text-right`}>Rs. {data.taxable.toFixed(2)}</td>
                  {isInterState ? (
                    <>
                      <td className={`${hsnCellPaddingClass} text-center`}>{data.igstRate.toFixed(1)}%</td>
                      <td className={`${hsnCellPaddingClass} text-right`}>Rs. {data.igstAmt.toFixed(2)}</td>
                    </>
                  ) : (
                    <>
                      <td className={`${hsnCellPaddingClass} text-center`}>{data.cgstRate.toFixed(1)}%</td>
                      <td className={`${hsnCellPaddingClass} text-right`}>Rs. {data.cgstAmt.toFixed(2)}</td>
                      <td className={`${hsnCellPaddingClass} text-center`}>{data.sgstRate.toFixed(1)}%</td>
                      <td className={`${hsnCellPaddingClass} text-right`}>Rs. {data.sgstAmt.toFixed(2)}</td>
                    </>
                  )}
                  <td className={`${hsnCellPaddingClass} text-right font-bold text-slate-900`}>Rs. {data.totalTax.toFixed(2)}</td>
                </tr>
              ))}
              {/* Total Row */}
              <tr className={`bg-slate-50 font-bold text-slate-900 border-t border-slate-300 divide-x divide-slate-300 ${hsnRowHeightClass}`}>
                <td className={hsnCellPaddingClass}>Total</td>
                <td className={`${hsnCellPaddingClass} text-right`}>Rs. {totalTaxableVal.toFixed(2)}</td>
                {isInterState ? (
                  <>
                    <td></td>
                    <td className={`${hsnCellPaddingClass} text-right`}>Rs. {totalIgstVal.toFixed(2)}</td>
                  </>
                ) : (
                  <>
                    <td></td>
                    <td className={`${hsnCellPaddingClass} text-right`}>Rs. {totalCgstVal.toFixed(2)}</td>
                    <td></td>
                    <td className={`${hsnCellPaddingClass} text-right`}>Rs. {totalSgstVal.toFixed(2)}</td>
                  </>
                )}
                <td className={`${hsnCellPaddingClass} text-right font-extrabold text-slate-950`}>Rs. {totalTaxVal.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 7. Remark Strip */}
        <div className={`border-b border-slate-300 ${rowPadding === 'extra-compact' ? 'p-1.5 text-[10px]' : 'p-2.5 text-[11px]'} bg-slate-50/10 flex items-center space-x-3 leading-tight text-left avoid-break`}>
          <strong className="text-slate-900 uppercase tracking-wider block shrink-0">Remark</strong>
          <span className="text-slate-700 italic font-medium">{remarkText}</span>
        </div>

        {/* 8. Footer Section (Terms, Bank Details & Signature) */}
        <div className={`grid grid-cols-3 divide-x divide-slate-300 ${footerPaddingClass} bg-white items-stretch avoid-break`}>
          <div className="pr-3 space-y-1 text-left">
            <strong className="text-slate-900 uppercase tracking-wider block mb-1 border-b border-slate-200 pb-0.5 text-[9px]">Terms & Conditions</strong>
            <ol className="list-decimal list-inside space-y-0.5 text-slate-600 font-medium leading-relaxed">
              {/* Terms are empty or custom */}
            </ol>
          </div>

          <div className="px-3 space-y-0.5 text-left text-slate-700">
            <strong className="text-slate-900 uppercase tracking-wider block mb-1 border-b border-slate-200 pb-0.5 text-[9px]">Bank Details</strong>
            <p><span className="text-slate-500">Holder:</span> <strong className="text-slate-950">{bankHolder}</strong></p>
            <p><span className="text-slate-500">A/C No:</span> <strong className="font-mono text-slate-950">{bankAccount}</strong></p>
            <p><span className="text-slate-500">Bank:</span> <strong className="text-slate-950 text-[9.5px]">{bankName}</strong></p>
            <p><span className="text-slate-500">IFSC:</span> <strong className="font-mono text-slate-950">{bankIfsc}</strong></p>
            <p><span className="text-slate-500">UPI ID:</span> <strong className="font-mono text-slate-950 text-[9.5px]">{bankUpi}</strong></p>
          </div>

          <div className="pl-3 flex flex-col justify-between text-center min-h-[60px]">
            <div></div>
            <div className="border-t border-slate-300 pt-1">
              <span className="text-[8.5px] font-bold text-slate-500 block uppercase tracking-wider">Authorised Signatory For</span>
              <span className="text-[10px] font-[800] text-red-600 block mt-0.5 truncate uppercase">{companyName}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default InvoicePrintModal;
