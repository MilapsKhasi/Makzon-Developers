
import React, { useState, useEffect, useMemo } from 'react';
import { Search, Download, Star, Heart, Filter } from 'lucide-react';
import DateFilter from '../components/DateFilter';
import ExportModal from '../components/ExportModal';
import { getActiveCompanyId, formatCurrency, formatDate } from '../utils/helpers';
import { exportToExcel } from '../utils/exportHelper';
import { supabase } from '../lib/supabase';

const Reports = () => {
  const [activeTab, setActiveTab] = useState('Purchases');
  const [bills, setBills] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState({ startDate: null, endDate: null });
  const [statusFilter, setStatusFilter] = useState('All');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const tabs = ['Purchases', 'Vendors Summary', 'GST Summary', 'Starred', 'Favorites'];

  const loadData = async () => {
    const cid = getActiveCompanyId();
    if (!cid) return;

    const { data: savedBills } = await supabase
      .from('bills')
      .select('*')
      .eq('company_id', cid)
      .eq('is_deleted', false);
    
    let filtered = (savedBills || []).filter((b: any) => {
        if (dateRange.startDate && dateRange.endDate) {
          const bDate = new Date(b.date);
          if (bDate < new Date(dateRange.startDate) || bDate > new Date(dateRange.endDate)) return false;
        }
        if (statusFilter !== 'All' && b.status !== statusFilter) return false;
        if (activeTab === 'Starred' && !b.is_starred) return false;
        if (activeTab === 'Favorites' && !b.is_favorite) return false;
        
        const search = searchQuery.toLowerCase();
        const matchesSearch = b.bill_number?.toLowerCase().includes(search) || 
                              b.vendor_name?.toLowerCase().includes(search);
        return matchesSearch;
    });

    setBills(filtered);
  };

  useEffect(() => {
    loadData();
    window.addEventListener('appSettingsChanged', loadData);
    return () => window.removeEventListener('appSettingsChanged', loadData);
  }, [dateRange, statusFilter, activeTab, searchQuery]);

  const toggleFlag = async (id: string, field: 'is_starred' | 'is_favorite') => {
    const bill = bills.find(b => b.id === id);
    if (!bill) return;
    await supabase.from('bills').update({ [field]: !bill[field] }).eq('id', id);
    loadData();
  };

  const reportTableData = useMemo(() => {
    if (activeTab === 'Purchases' || activeTab === 'Starred' || activeTab === 'Favorites') {
      const rows: any[] = [];
      bills.forEach(bill => {
        const validItems = Array.isArray(bill.items) ? bill.items : [];
        // Safely extract narration from JSON metadata if column missing
        const narration = bill.description || (validItems[0] as any)?.description || '';
        
        const commonData = {
          "Date": formatDate(bill.date),
          "Voucher Type": "Purchase",
          "Voucher No": bill.bill_number,
          "Party Name": bill.vendor_name,
          "GST Registration Type": "Regular",
          "Party GSTIN": bill.gstin || '',
          "Place of Supply": bill.address || '',
          "Narration": narration,
          status: bill.status,
          isStarred: bill.is_starred,
          isFavorite: bill.is_favorite,
          originalBillId: bill.id
        };

        if (validItems.length > 0) {
          validItems.forEach((item: any) => {
            rows.push({
              id: `${bill.id}-${item.id || Math.random()}`,
              ...commonData,
              "Item Name": item.itemName || 'N/A',
              "Quantity": Number(item.qty || 0),
              "Unit": item.unit || 'PCS',
              "Rate": Number(item.rate || 0).toFixed(2),
              "Amount": Number(item.taxableAmount || 0).toFixed(2),
              "GST Rate": (Number(item.igstRate) || (Number(item.cgstRate) + Number(item.sgstRate)) || 0).toString() + '%',
              "CGST Amount": Number(item.cgstAmount || 0).toFixed(2),
              "SGST Amount": Number(item.sgstAmount || 0).toFixed(2),
              "IGST Amount": Number(item.igstAmount || 0).toFixed(2),
            });
          });
        } else {
          rows.push({
            id: `${bill.id}-fallback`,
            ...commonData,
            "Item Name": "General Purchase",
            "Quantity": 1,
            "Unit": "NOS",
            "Rate": Number(bill.total_without_gst || 0).toFixed(2),
            "Amount": Number(bill.total_without_gst || 0).toFixed(2),
            "GST Rate": (bill.total_without_gst > 0 ? ((bill.total_gst / bill.total_without_gst) * 100).toFixed(0) : "0") + '%',
            "CGST Amount": (Number(bill.total_gst || 0) / 2).toFixed(2),
            "SGST Amount": (Number(bill.total_gst || 0) / 2).toFixed(2),
            "IGST Amount": "0.00",
          });
        }
      });
      return rows.map(r => ({
        id: r.id,
        "Date": r.Date,
        "Voucher Type": r["Voucher Type"],
        "Voucher No": r["Voucher No"],
        "Party Name": r["Party Name"],
        "GST Registration Type": r["GST Registration Type"],
        "Party GSTIN": r["Party GSTIN"],
        "Place of Supply": r["Place of Supply"],
        "Item Name": r["Item Name"],
        "Quantity": r["Quantity"],
        "Unit": r["Unit"],
        "Rate": r["Rate"],
        "Amount": r["Amount"],
        "GST Rate": r["GST Rate"],
        "CGST Amount": r["CGST Amount"],
        "SGST Amount": r["SGST Amount"],
        "IGST Amount": r["IGST Amount"],
        "Narration": r["Narration"],
        status: r.status,
        isStarred: r.isStarred,
        isFavorite: r.isFavorite,
        originalBillId: r.originalBillId
      }));
    }

    if (activeTab === 'Vendors Summary') {
      const grouped: Record<string, any> = {};
      bills.forEach(bill => {
        const name = bill.vendor_name || 'Unknown';
        if (!grouped[name]) {
          grouped[name] = { 
            "Vendor Name": name, 
            "Vendor GSTIN": bill.gstin || '',
            "Vendor State": bill.address || '',
            "Total Bills": 0, 
            "Total Quantity": 0,
            "Taxable Amount": 0, 
            "CGST Amount": 0,
            "SGST Amount": 0,
            "IGST Amount": 0,
            "Total GST": 0, 
            "Round Off": 0,
            "Gross Amount": 0,
            "Paid Amount": 0,
            "Outstanding Amount": 0,
            "Last Bill Date": bill.date,
            "Last Bill No": bill.bill_number,
            "Vendor Ledger Group": "Sundry Creditors"
          };
        }
        
        const items = Array.isArray(bill.items) ? bill.items : [];
        const qty = items.reduce((sum, i) => sum + Number(i.qty || 0), 0) || 1;
        const cgst = items.reduce((sum, i) => sum + Number(i.cgstAmount || 0), 0) || (bill.total_gst / 2);
        const sgst = items.reduce((sum, i) => sum + Number(i.sgstAmount || 0), 0) || (bill.total_gst / 2);
        const igst = items.reduce((sum, i) => sum + Number(i.igstAmount || 0), 0) || 0;

        grouped[name]["Total Bills"] += 1;
        grouped[name]["Total Quantity"] += qty;
        grouped[name]["Taxable Amount"] += Number(bill.total_without_gst || 0);
        grouped[name]["CGST Amount"] += cgst;
        grouped[name]["SGST Amount"] += sgst;
        grouped[name]["IGST Amount"] += igst;
        grouped[name]["Total GST"] += Number(bill.total_gst || 0);
        grouped[name]["Round Off"] += Number(bill.round_off || 0);
        grouped[name]["Gross Amount"] += Number(bill.grand_total || 0);
        
        if (bill.status === 'Paid') grouped[name]["Paid Amount"] += Number(bill.grand_total || 0);
        else grouped[name]["Outstanding Amount"] += Number(bill.grand_total || 0);

        if (new Date(bill.date) > new Date(grouped[name]["Last Bill Date"])) {
          grouped[name]["Last Bill Date"] = bill.date;
          grouped[name]["Last Bill No"] = bill.bill_number;
        }
      });
      
      return Object.values(grouped).map((v, idx) => ({ 
        id: `v-${idx}`, 
        ...v, 
        "Taxable Amount": v["Taxable Amount"].toFixed(2), 
        "CGST Amount": v["CGST Amount"].toFixed(2),
        "SGST Amount": v["SGST Amount"].toFixed(2),
        "IGST Amount": v["IGST Amount"].toFixed(2),
        "Total GST": v["Total GST"].toFixed(2), 
        "Round Off": v["Round Off"].toFixed(2),
        "Gross Amount": v["Gross Amount"].toFixed(2),
        "Paid Amount": v["Paid Amount"].toFixed(2),
        "Outstanding Amount": v["Outstanding Amount"].toFixed(2),
        "Last Bill Date": formatDate(v["Last Bill Date"])
      }));
    }

    if (activeTab === 'GST Summary') {
      const gstGrouped: Record<string, any> = {};
      bills.forEach(bill => {
        const items = Array.isArray(bill.items) ? bill.items : [];
        if (items.length > 0) {
          items.forEach((it: any) => {
            const rate = Number(it.igstRate || (it.cgstRate + it.sgstRate) || 0);
            const rateKey = rate.toString();
            if (!gstGrouped[rateKey]) {
              gstGrouped[rateKey] = { 
                "GST Rate ( % )": rateKey, 
                "Tax Type": it.igstRate > 0 ? "IGST" : "CGST + SGST",
                "Taxable Amount": 0, 
                "CGST Amount": 0,
                "SGST Amount": 0,
                "IGST Amount": 0,
                "Total GST": 0,
                "Gross Amount": 0,
                "Number of Bills": new Set(),
                "Supply Type": it.igstRate > 0 ? "Inter-State" : "Intra-State",
                "Reverse Charge": "No",
                "HSN Count": new Set()
              };
            }
            gstGrouped[rateKey]["Taxable Amount"] += Number(it.taxableAmount || 0);
            gstGrouped[rateKey]["CGST Amount"] += Number(it.cgstAmount || 0);
            gstGrouped[rateKey]["SGST Amount"] += Number(it.sgstAmount || 0);
            gstGrouped[rateKey]["IGST Amount"] += Number(it.igstAmount || 0);
            gstGrouped[rateKey]["Total GST"] += Number(it.igstAmount + it.cgstAmount + it.sgstAmount || 0);
            gstGrouped[rateKey]["Gross Amount"] += Number(it.amount || 0);
            gstGrouped[rateKey]["Number of Bills"].add(bill.bill_number);
            if (it.hsnCode) gstGrouped[rateKey]["HSN Count"].add(it.hsnCode);
          });
        } else {
          const rate = bill.total_without_gst > 0 ? Math.round((bill.total_gst / bill.total_without_gst) * 100) : 0;
          const rateKey = rate.toString();
          if (!gstGrouped[rateKey]) {
            gstGrouped[rateKey] = { 
              "GST Rate ( % )": rateKey, 
              "Tax Type": "CGST + SGST",
              "Taxable Amount": 0, 
              "CGST Amount": 0,
              "SGST Amount": 0,
              "IGST Amount": 0,
              "Total GST": 0,
              "Gross Amount": 0,
              "Number of Bills": new Set(),
              "Supply Type": "Intra-State",
              "Reverse Charge": "No",
              "HSN Count": new Set()
            };
          }
          gstGrouped[rateKey]["Taxable Amount"] += Number(bill.total_without_gst || 0);
          gstGrouped[rateKey]["CGST Amount"] += Number(bill.total_gst || 0) / 2;
          gstGrouped[rateKey]["SGST Amount"] += Number(bill.total_gst || 0) / 2;
          gstGrouped[rateKey]["Total GST"] += Number(bill.total_gst || 0);
          gstGrouped[rateKey]["Gross Amount"] += Number(bill.grand_total || 0);
          gstGrouped[rateKey]["Number of Bills"].add(bill.bill_number);
        }
      });
      return Object.values(gstGrouped).map((g, idx) => ({ 
        id: `g-${idx}`, 
        ...g, 
        "Taxable Amount": g["Taxable Amount"].toFixed(2), 
        "CGST Amount": g["CGST Amount"].toFixed(2),
        "SGST Amount": g["SGST Amount"].toFixed(2),
        "IGST Amount": g["IGST Amount"].toFixed(2),
        "Total GST": g["Total GST"].toFixed(2),
        "Gross Amount": g["Gross Amount"].toFixed(2),
        "Number of Bills": g["Number of Bills"].size,
        "HSN Count": g["HSN Count"].size || 0
      }));
    }

    return [];
  }, [activeTab, bills]);

  const handleExport = async () => {
    const cid = getActiveCompanyId();
    const { data: comp } = await supabase.from('companies').select('*').eq('id', cid).single();
    
    const headers = Object.keys(reportTableData[0] || {}).filter(k => !['id', 'isStarred', 'isFavorite', 'originalBillId', 'status'].includes(k));
    const rows = reportTableData.map(r => headers.map(h => r[h]));

    exportToExcel(headers, rows, {
      companyName: comp?.name || 'My Company',
      gstin: comp?.gstin || '',
      email: '',
      phone: '',
      address: comp?.address || '',
      reportTitle: activeTab,
      dateRange: dateRange.startDate ? `${dateRange.startDate} to ${dateRange.endDate}` : 'All Time'
    });
  };

  return (
    <div className="space-y-8 h-full flex flex-col">
      <ExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} onExport={handleExport} reportName={activeTab} />

      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-2xl font-medium text-slate-900 tracking-tight">Reports Center</h1>
        <div className="flex items-center space-x-2">
          <button onClick={() => setIsExportModalOpen(true)} className="px-5 py-2.5 bg-primary text-slate-900 border border-slate-200 rounded-md text-[11px] font-bold uppercase tracking-widest hover:bg-primary-dark transition-all flex items-center shadow-md active:scale-95"><Download className="w-4 h-4 mr-2" /> Export to Excel</button>
          <DateFilter onFilterChange={setDateRange} />
        </div>
      </div>

      <div className="flex items-center space-x-4 shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search report..." 
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-md text-sm outline-none focus:border-slate-400 shadow-sm" 
          />
        </div>
        <div className="flex items-center space-x-2 bg-slate-50 px-4 py-2 rounded-md border border-slate-200">
           <Filter className="w-3.5 h-3.5 text-slate-400" />
           <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-[10px] font-bold uppercase border-none bg-transparent outline-none cursor-pointer text-slate-600">
             <option value="All">All Transactions</option>
             <option value="Paid">Cleared</option>
             <option value="Pending">Outstanding</option>
           </select>
        </div>
      </div>

      <div className="flex-1 flex gap-8 overflow-hidden min-h-0">
        <div className="w-64 space-y-1 shrink-0 overflow-y-auto">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`w-full text-left px-5 py-4 text-[10px] font-bold uppercase tracking-widest transition-all border-l-4 ${
                activeTab === tab ? 'bg-slate-100 text-slate-900 border-slate-800 shadow-sm' : 'text-slate-400 hover:bg-slate-50 border-transparent'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex-1 bg-white border border-slate-200 rounded-lg p-6 overflow-hidden flex flex-col boxy-shadow">
          <div className="flex justify-between items-center mb-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">
            <span>Viewing: {activeTab}</span>
            <span>Record Count: {reportTableData.length}</span>
          </div>
          
          <div className="flex-1 overflow-auto border border-slate-200 rounded-md">
            {reportTableData.length === 0 ? (
                <div className="py-32 text-center text-slate-300 italic text-xs">No records found.</div>
            ) : (
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                    <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {['Purchases', 'Starred', 'Favorites'].includes(activeTab) && <th className="py-3 px-4">Flags</th>}
                      {Object.keys(reportTableData[0] || {}).filter(k => !['id', 'isStarred', 'isFavorite', 'originalBillId', 'status'].includes(k)).map(h => (
                          <th key={h} className="py-3 px-4 border-r border-slate-200 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportTableData.map((row: any) => (
                      <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                        {['Purchases', 'Starred', 'Favorites'].includes(activeTab) && (
                          <td className="py-3 px-4 flex space-x-2">
                            <button onClick={() => toggleFlag(row.originalBillId, 'is_starred')} className={`${row.isStarred ? 'text-amber-400' : 'text-slate-200 hover:text-slate-400'}`}><Star className={`w-3.5 h-3.5 ${row.isStarred ? 'fill-amber-400' : ''}`} /></button>
                            <button onClick={() => toggleFlag(row.originalBillId, 'is_favorite')} className={`${row.isFavorite ? 'text-rose-400' : 'text-slate-200 hover:text-slate-400'}`}><Heart className={`w-3.5 h-3.5 ${row.isFavorite ? 'fill-rose-400' : ''}`} /></button>
                          </td>
                        )}
                        {Object.keys(row).filter(k => !['id', 'isStarred', 'isFavorite', 'originalBillId', 'status'].includes(k)).map(k => (
                          <td key={k} className="py-3 px-4 border-r border-slate-100 whitespace-nowrap">{row[k]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
