import React, { useState, useEffect, useMemo } from 'react';
import { Search, ChevronDown, FileText, Loader2 } from 'lucide-react';
import DateFilter from '../components/DateFilter';
import ExportModal from '../components/ExportModal';
import { getActiveCompanyId, formatDate, getAppSettings } from '../utils/helpers';
import { exportToExcel, exportToCSV, triggerPrint } from '../utils/exportHelper';
import { supabase } from '../lib/supabase';

const Reports = () => {
  const [activeTab, setActiveTab] = useState('Purchases');
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ startDate: null, endDate: null });
  const [searchQuery, setSearchQuery] = useState('');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [companyInfo, setCompanyInfo] = useState<any>(null);

  const tabs = ['Starred', 'Favorites', 'Purchases', 'Vendors Summary', 'GST Summary'];

  const loadData = async () => {
    setLoading(true);
    const cid = getActiveCompanyId();
    if (!cid) {
      setLoading(false);
      return;
    }

    // Load company info for export headers
    const { data: company } = await supabase.from('companies').select('*').eq('id', cid).single();
    setCompanyInfo(company);

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
        "STATUS": doc.status || 'Pending'
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
        const taxable = Number(doc.total_without_gst) || 0;
        const gst = Number(doc.total_gst) || 0;
        const rate = taxable > 0 ? Math.round((gst / taxable) * 100) : 0;
        const key = rate.toString();
        if (!gstGrouped[key]) gstGrouped[key] = { "RATE (%)": key + '%', "TAXABLE": 0, "CGST": 0, "SGST": 0, "IGST": 0, "TOTAL GST": 0 };
        gstGrouped[key]["TAXABLE"] += taxable;
        gstGrouped[key]["CGST"] += Number(doc.total_cgst || 0);
        gstGrouped[key]["SGST"] += Number(doc.total_sgst || 0);
        gstGrouped[key]["IGST"] += Number(doc.total_igst || 0);
        gstGrouped[key]["TOTAL GST"] += gst;
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

  const handleExport = (type: 'excel' | 'csv' | 'pdf') => {
    if (!reportTableData.length || !companyInfo) return;

    const headers = Object.keys(reportTableData[0]);
    const rows = reportTableData.map(obj => Object.values(obj));
    const config = {
        companyName: companyInfo.name,
        gstin: companyInfo.gstin || '',
        email: companyInfo.email || '',
        phone: companyInfo.phone || '',
        address: companyInfo.address || '',
        reportTitle: `${activeTab} Statement`,
        dateRange: dateRange.startDate && dateRange.endDate 
            ? `${dateRange.startDate} to ${dateRange.endDate}` 
            : 'All Time'
    };

    if (type === 'excel') exportToExcel(headers, rows, config);
    else if (type === 'csv') exportToCSV(headers, rows, config);
    else if (type === 'pdf') triggerPrint();
    
    setIsExportModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 print:space-y-0 print:p-0">
      <ExportModal 
        isOpen={isExportModalOpen} 
        onClose={() => setIsExportModalOpen(false)} 
        onExport={handleExport} 
        reportName={`${activeTab} Register`} 
      />

      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-[20px] font-normal text-slate-900">Reports Dashboard</h1>
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => setIsExportModalOpen(true)}
            disabled={reportTableData.length === 0}
            className="px-6 py-2 bg-white border border-slate-200 rounded-md text-xs font-bold uppercase tracking-tight hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
          >
            Export to
          </button>
          <DateFilter onFilterChange={setDateRange} />
        </div>
      </div>

      <div className="relative print:hidden">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search within report..." 
          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-slate-300 shadow-sm" 
        />
      </div>

      <div className="flex gap-6 min-h-[500px] print:block print:gap-0">
        <div className="w-64 space-y-1 print:hidden">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`w-full text-left px-4 py-2 text-xs font-normal transition-none ${
                activeTab === tab ? 'bg-slate-50 text-slate-900 font-bold border-r-2 border-slate-900' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex-1 bg-white border border-slate-200 rounded-md overflow-hidden flex flex-col shadow-sm print:border-none print:shadow-none">
          {/* Print Header */}
          <div className="hidden print:block p-8 border-b-2 border-slate-900 mb-8">
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{companyInfo?.name}</h2>
              <p className="text-xs text-slate-500 font-bold mt-1">GSTIN: {companyInfo?.gstin || 'N/A'}</p>
              <div className="mt-6 flex justify-between items-end">
                <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">{activeTab} Register</h3>
                    <p className="text-[10px] text-slate-400">Statement Generated: {new Date().toLocaleDateString()}</p>
                </div>
                <p className="text-[10px] font-bold text-slate-500">
                    Period: {dateRange.startDate || 'Start'} to {dateRange.endDate || 'Present'}
                </p>
              </div>
          </div>

          <div className="p-4 border-b border-slate-100 shrink-0 print:hidden flex justify-between items-center">
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{activeTab} Register</h3>
             <span className="text-[10px] font-bold text-slate-400">{reportTableData.length} records found</span>
          </div>

          <div className="flex-1 overflow-auto bg-white custom-scrollbar">
            {loading ? (
                <div className="h-full flex items-center justify-center py-24">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
            ) : reportTableData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-32 text-center">
                    <FileText className="w-12 h-12 text-slate-100 mb-4" />
                    <p className="text-slate-300 italic text-xs font-medium">This report is currently blank.</p>
                </div>
            ) : (
                <table className="clean-table w-full text-[11px] print:text-[10px]">
                  <thead className="sticky top-0 z-10 print:static">
                    <tr>
                      {Object.keys(reportTableData[0] || {}).map(h => (
                          <th key={h} className="whitespace-nowrap py-3 font-black text-slate-500 bg-slate-50">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportTableData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 print:break-inside-avoid transition-colors">
                        {Object.values(row).map((val: any, vIdx) => (
                          <td key={vIdx} className="whitespace-nowrap py-3 font-medium text-slate-700">{val}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
            )}
          </div>
          
          {/* Print Footer */}
          <div className="hidden print:block p-8 border-t border-slate-200 mt-auto text-center">
              <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Digital Copy - Generated via Findesk Prime</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;