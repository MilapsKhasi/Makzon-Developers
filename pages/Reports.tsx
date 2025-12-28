
import React, { useState, useEffect, useMemo } from 'react';
import { Search, ChevronDown, FileText } from 'lucide-react';
import DateFilter from '../components/DateFilter';
import { getActiveCompanyId, formatDate } from '../utils/helpers';
import { supabase } from '../lib/supabase';

const Reports = () => {
  const [activeTab, setActiveTab] = useState('Purchases');
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ startDate: null, endDate: null });
  const [searchQuery, setSearchQuery] = useState('');
  const tabs = ['Starred', 'Favorites', 'Purchases', 'Vendors Summary', 'GST Summary'];

  const loadData = async () => {
    setLoading(true);
    const cid = getActiveCompanyId();
    if (!cid) {
      setLoading(false);
      return;
    }

    const { data: vouchers, error } = await supabase
      .from('bills')
      .select('*')
      .eq('company_id', cid)
      .eq('is_deleted', false);
    
    if (error) {
      console.error("Error loading reports data:", error);
      setLoading(false);
      return;
    }

    // Strictly filter for relevant transactions (Purchases)
    const items = (vouchers || []).filter(v => v.type === 'Purchase' || !v.type);
    
    const filterFn = (item: any) => {
        if (dateRange.startDate && dateRange.endDate) {
          const bDate = new Date(item.date);
          const start = new Date(dateRange.startDate);
          const end = new Date(dateRange.endDate);
          if (bDate < start || bDate > end) return false;
        }
        if (activeTab === 'Starred' && !item.is_starred) return false;
        if (activeTab === 'Favorites' && !item.is_favorite) return false;
        
        const search = searchQuery.toLowerCase();
        return (item.bill_number)?.toLowerCase().includes(search) || (item.vendor_name)?.toLowerCase().includes(search);
    };

    setBills(items.filter(filterFn));
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    window.addEventListener('appSettingsChanged', loadData);
    return () => window.removeEventListener('appSettingsChanged', loadData);
  }, [dateRange, activeTab, searchQuery]);

  const reportTableData = useMemo(() => {
    // If no bills found, return empty early to ensure "blank" state
    if (!bills || bills.length === 0) return [];

    if (activeTab === 'Purchases' || activeTab === 'Starred' || activeTab === 'Favorites') {
      return bills.map(doc => ({
        "DATE": formatDate(doc.date),
        "BILL NO": doc.bill_number,
        "VENDOR": doc.vendor_name,
        "TAXABLE": (doc.total_without_gst || 0).toFixed(2),
        "CGST": (doc.total_cgst || 0).toFixed(2),
        "SGST": (doc.total_sgst || 0).toFixed(2),
        "IGST": (doc.total_igst || 0).toFixed(2),
        "GST TOTAL": (doc.total_gst || 0).toFixed(2),
        "NET TOTAL": (doc.grand_total || 0).toFixed(2),
        "STATUS": doc.status
      }));
    }

    if (activeTab === 'Vendors Summary') {
      const grouped: Record<string, any> = {};
      bills.forEach(bill => {
        const name = bill.vendor_name || 'Unknown';
        if (!grouped[name]) {
          grouped[name] = { "VENDOR": name, "GSTIN": bill.gstin || 'N/A', "BILLS": 0, "TAXABLE": 0, "CGST": 0, "SGST": 0, "IGST": 0, "TOTAL": 0 };
        }
        grouped[name]["BILLS"] += 1;
        grouped[name]["TAXABLE"] += Number(bill.total_without_gst || 0);
        grouped[name]["CGST"] += Number(bill.total_cgst || 0);
        grouped[name]["SGST"] += Number(bill.total_sgst || 0);
        grouped[name]["IGST"] += Number(bill.total_igst || 0);
        grouped[name]["TOTAL"] += Number(bill.grand_total || 0);
      });
      return Object.values(grouped).map(v => ({
        ...v,
        "TAXABLE": v["TAXABLE"].toFixed(2),
        "CGST": v["CGST"].toFixed(2),
        "SGST": v["SGST"].toFixed(2),
        "IGST": v["IGST"].toFixed(2),
        "TOTAL": v["TOTAL"].toFixed(2)
      }));
    }

    if (activeTab === 'GST Summary') {
      const gstGrouped: Record<string, any> = {};
      bills.forEach(doc => {
        const rate = doc.total_without_gst > 0 ? Math.round((doc.total_gst / doc.total_without_gst) * 100) : 0;
        const key = rate.toString();
        if (!gstGrouped[key]) gstGrouped[key] = { "RATE (%)": key + '%', "TAXABLE": 0, "CGST": 0, "SGST": 0, "IGST": 0, "TOTAL GST": 0 };
        gstGrouped[key]["TAXABLE"] += Number(doc.total_without_gst || 0);
        gstGrouped[key]["CGST"] += Number(doc.total_cgst || 0);
        gstGrouped[key]["SGST"] += Number(doc.total_sgst || 0);
        gstGrouped[key]["IGST"] += Number(doc.total_igst || 0);
        gstGrouped[key]["TOTAL GST"] += Number(doc.total_gst || 0);
      });
      return Object.values(gstGrouped).map(g => ({
        ...g,
        "TAXABLE": g["TAXABLE"].toFixed(2),
        "CGST": g["CGST"].toFixed(2),
        "SGST": g["SGST"].toFixed(2),
        "IGST": g["IGST"].toFixed(2),
        "TOTAL GST": g["TOTAL GST"].toFixed(2)
      }));
    }

    return [];
  }, [activeTab, bills]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-normal text-slate-900">Reports</h1>
        <div className="flex items-center space-x-2">
          <button className="px-4 py-2 bg-white border border-slate-200 rounded-md text-xs hover:bg-slate-50">Export to</button>
          <DateFilter onFilterChange={setDateRange} />
          <button className="bg-primary text-slate-900 px-6 py-2 rounded-md font-normal text-sm hover:bg-primary-dark transition-none">
            NEW REPORT
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search within current report..." 
          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-slate-400" 
        />
      </div>

      <div className="flex gap-6 min-h-[500px]">
        <div className="w-64 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`w-full text-left px-4 py-2 text-xs font-normal transition-none ${
                activeTab === tab ? 'bg-slate-50 text-slate-900 font-medium' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex-1 bg-white border border-slate-200 rounded-md overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 shrink-0">
             <h3 className="text-xs font-normal text-slate-900 uppercase tracking-tight">{activeTab} Register</h3>
          </div>
          <div className="flex-1 overflow-auto bg-white">
            {loading ? (
                <div className="h-full flex items-center justify-center py-20">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
            ) : reportTableData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-32 text-center">
                    <FileText className="w-12 h-12 text-slate-100 mb-4" />
                    <p className="text-slate-300 italic text-xs font-medium">This report is currently blank.</p>
                    <p className="text-slate-300 text-[10px] mt-1">No matching bills or transactions found for this selection.</p>
                </div>
            ) : (
                <table className="clean-table w-full">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      {Object.keys(reportTableData[0] || {}).map(h => (
                          <th key={h} className="whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportTableData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        {Object.values(row).map((val: any, vIdx) => (
                          <td key={vIdx} className="whitespace-nowrap">{val}</td>
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
