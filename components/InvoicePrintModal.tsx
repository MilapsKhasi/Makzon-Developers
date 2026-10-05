import React, { useEffect, useState, useRef } from 'react';
import { Printer, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getActiveCompanyId, getAppSettings } from '../utils/helpers';

interface InvoicePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: any;
}

export function numberToWords(num: number): string {
  if (isNaN(num) || num === 0) return 'Rupees Zero only...';

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords = (n: number): string => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + inWords(n % 100) : '');
    if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + inWords(n % 1000) : '');
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + inWords(n % 100000) : '');
    return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + inWords(n % 10000000) : '');
  };

  const integerPart = Math.floor(Math.abs(num));
  const decimalPart = Math.round((Math.abs(num) - integerPart) * 100);

  let str = 'Rupees ' + inWords(integerPart);
  if (decimalPart > 0) {
    str += ' and ' + inWords(decimalPart) + ' Paise';
  }
  str += ' only...';
  return str;
}

const formatInvoiceDate = (dStr: string) => {
  if (!dStr) return '';
  const d = new Date(dStr);
  if (isNaN(d.getTime())) return dStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
};

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({ isOpen, onClose, invoice }) => {
  const cid = getActiveCompanyId();
  const [company, setCompany] = useState<any>({});
  const [partnerInfo, setPartnerInfo] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !invoice) return;

    const fetchDetails = async () => {
      let currentComp: any = null;
      if (cid) {
        const { data: comp } = await supabase.from('companies').select('*').eq('id', cid).maybeSingle();
        currentComp = comp;
        if (comp) setCompany(comp);
      }

      // Check if invoice or workspace has a connected registered partner firm
      const raw = invoice?.items_raw || invoice?.items || {};
      const savedPartner = raw?.partner_company;
      const settings = getAppSettings();
      const partnerId = savedPartner?.id || settings.partnerCompanyId || currentComp?.partner_company_id;

      if (savedPartner && savedPartner.gstin) {
        setPartnerInfo(savedPartner);
      } else if (partnerId) {
        const { data: pComp } = await supabase.from('companies').select('*').eq('id', partnerId).maybeSingle();
        if (pComp && pComp.gstin) {
          setPartnerInfo(pComp);
        } else if (settings.partnerCompanyGstin) {
          setPartnerInfo({
            id: settings.partnerCompanyId,
            name: settings.partnerCompanyName,
            gstin: settings.partnerCompanyGstin,
            address: settings.partnerCompanyAddress
          });
        }
      } else {
        setPartnerInfo(null);
      }

      const partyName = invoice.customer_name || invoice.vendor_name;
      if (partyName && cid) {
        let { data: cust } = await supabase.from('vendors').select('*').eq('company_id', cid).eq('name', partyName).eq('is_deleted', false).maybeSingle();
        if (!cust) {
          const res = await supabase.from('customers').select('*').eq('company_id', cid).eq('name', partyName).eq('is_deleted', false).maybeSingle();
          cust = res.data;
        }
        if (cust) setCustomer(cust);
      }
    };
    fetchDetails();
  }, [isOpen, invoice, cid]);

  if (!isOpen || !invoice) return null;

  const itemsRaw = invoice?.items_raw || invoice?.items || {};
  let lineItems: any[] = [];
  if (Array.isArray(invoice?.items)) {
    lineItems = invoice.items;
  } else if (Array.isArray(itemsRaw?.line_items)) {
    lineItems = itemsRaw.line_items;
  }

  let dutiesAndTaxes: any[] = [];
  if (Array.isArray(invoice?.duties_and_taxes)) {
    dutiesAndTaxes = invoice.duties_and_taxes;
  } else if (Array.isArray(itemsRaw?.duties_and_taxes)) {
    dutiesAndTaxes = itemsRaw.duties_and_taxes;
  } else if (Array.isArray(invoice?.items?.duties_and_taxes)) {
    dutiesAndTaxes = invoice.items.duties_and_taxes;
  }

  const payment = itemsRaw?.payment_details || invoice?.payment_details || {};

  // Company Details
  const isConnectedToRd = Boolean(partnerInfo && partnerInfo.gstin && partnerInfo.gstin.trim().length > 0);
  const companyName = isConnectedToRd ? partnerInfo.name : (company?.name || 'JAGRUTI');
  const companyAddress = isConnectedToRd ? (partnerInfo.address || company?.address || '') : (company?.address || '');
  const companyPhone = company?.phone || partnerInfo?.phone || '';
  const companyGstin = isConnectedToRd ? partnerInfo.gstin : (company?.gstin || '');
  const hasGstin = Boolean(companyGstin && companyGstin.trim().length > 0 && companyGstin.toUpperCase() !== 'URD');

  // Customer Details
  const customerName = invoice.customer_name || invoice.vendor_name || customer?.name || 'KARAN';
  const customerAddress = customer?.address || '';
  const customerPhone = customer?.phone || '';
  const customerGstin = customer?.gstin || '';
  const customerState = customer?.state || '';
  const customerCountry = customer?.country || 'India';
  const customerStateCountry = [customerState, customerCountry].filter(Boolean).join(', ') || 'India';

  const shipToName = customerName;
  const shipToAddress = customer?.shipping_address || customerAddress;

  // Invoice Details
  const invoiceNo = invoice.invoice_number || invoice.bill_number || '';
  const invoiceDate = invoice.date ? formatInvoiceDate(invoice.date) : '';
  const poNumber = payment?.po_number || invoice.po_number || itemsRaw?.po_number || '';

  // GST & Tax Calculations
  const gstType = itemsRaw?.gst_type || invoice.gst_type || 'Intra-State';
  const isInterState = gstType === 'Inter-State' || gstType === 'IGST';

  let totalQty = 0;
  let totalAmount = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  let totalSubtotal = 0;

  const calculatedItems = lineItems.map((item: any) => {
    const qty = parseFloat(item.qty || item.quantity) || 0;
    const rate = parseFloat(item.rate) || 0;
    const taxRate = hasGstin ? (parseFloat(item.tax_rate || item.gst || item.tax) || 0) : 0;
    const amount = parseFloat(item.taxableAmount) || (qty * rate);

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (hasGstin) {
      if (isInterState) {
        igst = amount * (taxRate / 100);
      } else {
        cgst = amount * (taxRate / 2 / 100);
        sgst = amount * (taxRate / 2 / 100);
      }
    }

    const subtotal = amount + (isInterState ? igst : (cgst + sgst));

    totalQty += qty;
    totalAmount += amount;
    totalCgst += cgst;
    totalSgst += sgst;
    totalIgst += igst;
    totalSubtotal += subtotal;

    return {
      name: item.itemName || item.name || '',
      hsn: item.hsnCode || item.hsn || '',
      qty,
      rate,
      amount,
      taxRate,
      cgst,
      sgst,
      igst,
      subtotal
    };
  });

  // Additional Charges
  const appliedCharges = dutiesAndTaxes.filter((d: any) => {
    const amt = parseFloat(d.amount) || 0;
    return amt !== 0 && !['CGST', 'SGST', 'IGST'].includes((d.name || '').toUpperCase());
  });

  const sumAdditionalCharges = appliedCharges.reduce((acc: number, d: any) => {
    const amt = parseFloat(d.amount) || 0;
    return acc + (d.type === 'Deduction' ? -Math.abs(amt) : amt);
  }, 0);

  const taxableVal = invoice.total_without_gst !== undefined ? parseFloat(invoice.total_without_gst) : totalAmount;
  const gstVal = hasGstin ? (invoice.total_gst !== undefined ? parseFloat(invoice.total_gst) : (isInterState ? totalIgst : (totalCgst + totalSgst))) : 0;
  const grandTotalVal = invoice.grand_total !== undefined && hasGstin ? parseFloat(invoice.grand_total) : (taxableVal + gstVal + sumAdditionalCharges);

  // Bank Details
  const bankName = payment?.bank_name || company?.bank_name || company?.raw_data?.bank_name || '';
  const bankHolder = payment?.account_holder || company?.account_holder || company?.account_name || company?.raw_data?.account_holder || '';
  const bankAccount = payment?.account_number || company?.account_number || company?.raw_data?.account_number || '';
  const bankIfsc = payment?.ifsc || company?.ifsc_code || company?.ifsc || company?.raw_data?.ifsc || '';

  const blankRowsNeeded = Math.max(0, 10 - calculatedItems.length);

  const handlePrint = () => {
    if (!invoiceRef.current) return;
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-fadeIn print:p-0 print:bg-white print:static print:inset-auto print:z-auto">
      {/* Print Stylesheet injection */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          body {
            background: white !important;
            color: black !important;
          }
          header, nav, aside, .print-modal-header, .print\\:hidden {
            display: none !important;
          }
          .printable-invoice-sheet {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            min-height: auto !important;
          }
        }
      `}} />

      {/* Modal Popup Container */}
      <div className="w-full max-w-[950px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh] print:max-h-none print:border-none print:shadow-none print:rounded-none">
        
        {/* Top Control Bar matching the design in the image */}
        <div className="print-modal-header flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 print:hidden">
          <div className="flex-1" />
          
          <div className="flex items-center gap-4">
            <span className="text-base font-semibold text-slate-800 dark:text-slate-100">Print Preview</span>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-[#D32F2F] hover:bg-red-700 text-white px-5 py-2 rounded-md font-semibold text-sm transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <span>Print Invoice</span>
              <Printer className="w-4 h-4" />
            </button>
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

        {/* Scrollable Preview Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100/80 dark:bg-slate-950 flex justify-center print:p-0 print:bg-white print:overflow-visible">
          {/* Printable Sheet */}
          <div
            ref={invoiceRef}
            className="printable-invoice-sheet bg-white text-slate-900 w-full max-w-[800px] p-8 sm:p-10 border border-slate-200 shadow-sm flex flex-col justify-between font-sans text-xs leading-snug min-h-[1080px] print:min-h-0 print:border-none print:shadow-none print:p-0 print:m-0"
          >
            <div>
              {/* 1. Top Header Grid */}
              <div className="grid grid-cols-2 gap-8 border-b border-slate-200 pb-5 mb-5">
                {/* Left Column: Company Info */}
                <div className="pr-4 space-y-2">
                  <h1 className="text-2xl font-bold text-[#D32F2F] tracking-wide uppercase leading-tight">
                    {companyName}
                  </h1>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-normal">Phone</span>
                      <span className="font-medium text-slate-800">{companyPhone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-normal">GSTIN</span>
                      <span className="font-semibold text-slate-900 font-mono">{companyGstin || '24FJWK1245Q1ZD'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-normal">Address</span>
                      <span className="font-medium text-slate-800 text-right max-w-[240px]">{companyAddress}</span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Invoice Info */}
                <div className="pl-8 border-l border-slate-200 space-y-2">
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight leading-tight">
                    {itemsRaw?.is_delivery_challan || invoice?.is_delivery_challan ? 'Delivery Challan' : (companyGstin ? 'Tax Invoice' : 'Bill of Supply')}
                  </h2>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-normal">Invoice Number</span>
                      <span className="font-medium text-slate-800 font-mono">{invoiceNo || '2026/27/006'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-normal">Invoice Date</span>
                      <span className="font-medium text-slate-800 font-mono">{invoiceDate || '06/08/26'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-normal">Purchase Order Number</span>
                      <span className="font-medium text-slate-800 font-mono">{poNumber || ''}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Billed To / Shipped To Box */}
              <div className="mb-5 border border-[#D5E0EB] rounded-xs overflow-hidden text-xs">
                {/* Header row */}
                <div className="grid grid-cols-2 bg-[#F4F8FA] border-b border-[#D5E0EB] px-4 py-2">
                  <div className="flex justify-between items-center pr-4">
                    <span className="text-slate-500">Billed to</span>
                    <span className="font-bold text-slate-900 uppercase">{customerName}</span>
                  </div>
                  <div className="flex justify-between items-center pl-4 border-l border-[#D5E0EB]">
                    <span className="text-slate-500">Shipped to</span>
                    <span className="font-bold text-slate-900 uppercase">{shipToName}</span>
                  </div>
                </div>

                {/* Details row */}
                <div className="grid grid-cols-2 px-4 py-2.5 bg-white">
                  <div className="pr-4 space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500">GSTIN</span>
                      <span className="font-medium text-slate-800 font-mono">{customerGstin || ''}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Phone</span>
                      <span className="font-medium text-slate-800">{customerPhone || ''}</span>
                    </div>
                  </div>
                  <div className="pl-4 border-l border-[#D5E0EB] space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Address</span>
                      <span className="font-medium text-slate-800 text-right max-w-[220px]">{shipToAddress || ''}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">State & Country</span>
                      <span className="font-semibold text-slate-900">{customerStateCountry}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Items Table */}
              <div className="mb-5">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#D32F2F] text-white">
                      <th className="py-2.5 px-2 text-center w-[5%] font-semibold">Sr</th>
                      <th className="py-2.5 px-3 text-left w-[27%] font-semibold">Particulars</th>
                      <th className="py-2.5 px-2 text-center w-[9%] font-semibold">HSN</th>
                      <th className="py-2.5 px-2 text-center w-[7%] font-semibold">QTY</th>
                      <th className="py-2.5 px-2 text-right w-[9%] font-semibold">Rate</th>
                      <th className="py-2.5 px-2 text-right w-[11%] font-semibold">Amount</th>
                      {hasGstin && (
                        <>
                          <th className="py-2.5 px-2 text-center w-[7%] font-semibold">Tax %</th>
                          <th className="py-2.5 px-2 text-right w-[8%] font-semibold">{isInterState ? 'IGST' : 'CGST'}</th>
                          <th className="py-2.5 px-2 text-right w-[8%] font-semibold">{isInterState ? '—' : 'SGST'}</th>
                        </>
                      )}
                      <th className="py-2.5 px-2 text-right w-[9%] font-semibold">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {calculatedItems.map((item: any, idx: number) => (
                      <tr key={`item-${idx}`} className="h-8">
                        <td className="py-2 px-2 text-center text-slate-600">{idx + 1}</td>
                        <td className="py-2 px-3 text-left font-bold text-slate-900 uppercase">{item.name}</td>
                        <td className="py-2 px-2 text-center text-slate-600 font-mono">{item.hsn || '—'}</td>
                        <td className="py-2 px-2 text-center font-medium font-mono">{item.qty}</td>
                        <td className="py-2 px-2 text-right font-mono">{item.rate.toFixed(2)}</td>
                        <td className="py-2 px-2 text-right font-mono">{item.amount.toFixed(2)}</td>
                        {hasGstin && (
                          <>
                            <td className="py-2 px-2 text-center font-mono">{item.taxRate}%</td>
                            <td className="py-2 px-2 text-right font-mono">{item.cgst.toFixed(2)}</td>
                            <td className="py-2 px-2 text-right font-mono">{item.sgst.toFixed(2)}</td>
                          </>
                        )}
                        <td className="py-2 px-2 text-right font-semibold font-mono text-slate-900">{item.subtotal.toFixed(2)}</td>
                      </tr>
                    ))}
                    {Array.from({ length: blankRowsNeeded }).map((_, idx) => (
                      <tr key={`blank-${idx}`} className="h-8 border-b border-slate-100/60">
                        <td colSpan={hasGstin ? 10 : 7} className="py-2">&nbsp;</td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Total Row */}
                  <tfoot>
                    <tr className="bg-[#EBF3FA] font-bold text-slate-900 text-xs border-t border-b border-[#D5E0EB]">
                      <td className="py-2.5 px-2"></td>
                      <td className="py-2.5 px-3 text-left font-bold">Total</td>
                      <td className="py-2.5 px-2"></td>
                      <td className="py-2.5 px-2 text-center font-mono font-bold">{totalQty}</td>
                      <td className="py-2.5 px-2"></td>
                      <td className="py-2.5 px-2 text-right font-mono font-bold">{totalAmount.toFixed(2)}</td>
                      {hasGstin && (
                        <>
                          <td className="py-2.5 px-2"></td>
                          <td className="py-2.5 px-2 text-right font-mono font-bold">{isInterState ? totalIgst.toFixed(2) : totalCgst.toFixed(2)}</td>
                          <td className="py-2.5 px-2 text-right font-mono font-bold">{isInterState ? '—' : totalSgst.toFixed(2)}</td>
                        </>
                      )}
                      <td className="py-2.5 px-2 text-right font-mono font-bold">{totalSubtotal.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* 4. Grand Total in Words & Calculations Grid */}
              <div className="grid grid-cols-2 gap-8 mb-6 pt-2">
                {/* Left: Grand Total in Words */}
                <div className="pr-4">
                  <div className="text-xs italic text-slate-400 mb-1">
                    Grand Total in words
                  </div>
                  <div className="border-b border-slate-200 pb-1 mb-2"></div>
                  <div className="text-xs font-bold text-slate-900 leading-relaxed">
                    {numberToWords(grandTotalVal)}
                  </div>
                </div>

                {/* Right: Amounts & Additional Charges */}
                <div className="pl-4 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-600 font-medium">Taxable Amount</span>
                    <span className="text-slate-900 font-mono font-semibold">{taxableVal.toFixed(2)}</span>
                  </div>
                  {hasGstin && (
                    <div className="flex justify-between">
                      <span className="text-slate-600 font-medium">GST Amount</span>
                      <span className="text-slate-900 font-mono font-semibold">{gstVal.toFixed(2)}</span>
                    </div>
                  )}

                  {/* Additional Charges Block */}
                  {appliedCharges.length > 0 && (
                    <div className="pt-2">
                      <div className="font-semibold text-slate-800 mb-1">
                        Additional Charges
                      </div>
                      <div className="border-b border-slate-200 mb-2"></div>
                      <div className="space-y-1">
                        {appliedCharges.map((ch: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-xs">
                            <span className="text-slate-600">{ch.name}</span>
                            <span className="text-slate-900 font-mono font-semibold">
                              {ch.type === 'Deduction' ? `-${Math.abs(ch.amount).toFixed(2)}` : parseFloat(ch.amount || 0).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Grand Total Bar */}
                  <div className="bg-[#EBF3FA] px-4 py-2 flex justify-between font-bold text-sm text-slate-900 border border-[#D5E0EB] mt-2 rounded-xs">
                    <span>Grand Total</span>
                    <span className="font-mono">{grandTotalVal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Footer: Bank Details & Authorized Signatory */}
            <div className="grid grid-cols-2 gap-8 border-t border-slate-200 pt-5 mt-auto text-xs">
              {/* Left: Bank Details */}
              <div className="pr-4 space-y-1.5">
                <div className="text-xs italic text-slate-400 mb-1">
                  Bank Details
                </div>
                <div className="border-b border-slate-200 pb-0.5 mb-1.5"></div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Bank</span>
                    <span className="font-medium text-slate-800">{bankName || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">A/c Holder</span>
                    <span className="font-medium text-slate-800">{bankHolder || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">A/c Number</span>
                    <span className="font-medium text-slate-800 font-mono">{bankAccount || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">IFSC Code</span>
                    <span className="font-medium text-slate-800 font-mono">{bankIfsc || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Right: Authorized Signatory */}
              <div className="pl-4 flex flex-col justify-between items-end text-right">
                <div className="text-xs italic text-slate-500">
                  for {companyName}
                </div>
                <div className="w-48 border-b border-slate-300 mt-10 mb-1"></div>
                <div className="text-[11px] italic text-slate-500 w-48 text-center">
                  Authorized Signatory
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoicePrintModal;
