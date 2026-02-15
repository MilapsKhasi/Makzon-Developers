import React, { useState, useEffect, useMemo } from 'react';
import { Search, ChevronDown, FileText, Loader2 } from 'lucide-react';
import DateFilter from '../components/DateFilter';
import ExportModal from '../components/ExportModal';
import { getActiveCompanyId, formatDate, normalizeBill } from '../utils/helpers';
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

  const tabs = ['Purchases', 'Sales Register', 'Vendors Summary', 'Customers Summary', 'Gst Summary'];

  const loadData = async () => {
    setLoading(true);
    const cid = getActiveCompanyId();
    if (!cid) {
      setLoading(false);
      return;
    }

    const { data: company } = await supabase.from('companies').select('*').eq('id', cid).single();
    setCompanyInfo(company);

    const [{ data: purchaseData }, { data: saleData }] = await Promise.all([
      supabase.from('bills').select('*').eq('company_id', cid).eq('is_deleted', false),
      supabase.from('sales_invoices').select('*').eq('company_id', cid).eq('is_deleted', false)
    ]);
    
    const combined = [
      ...(purchaseData || []).map(normalizeBill),
      ...(saleData || []).map(normalizeBill)
    ];

    const filterFn = (item: any) => {
        if (dateRange.startDate && dateRange.endDate) {
          const bDate = new Date(item.date);
          const start = new Date(dateRange.startDate);
          const end = new Date(dateRange.endDate);
          if (bDate < start || bDate > end) return false;
        }

        const typeFilter = activeTab === 'Purchases' || activeTab === 'Vendors Summary' ? 'Purchase' : 'Sale';
        if (activeTab === 'Gst Summary') return true;
        if (item.type !== typeFilter) return false;
        
        const search = searchQuery.toLowerCase();
        const partyName = item.vendor_name || item.customer_name || '';
        return (item.bill_number || item.invoice_number)?.toLowerCase().includes(search) || partyName.toLowerCase().includes(search);
    };

    setBills(combined.filter(filterFn));
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    window.addEventListener('appSettingsChanged', loadData);
    return () => window.removeEventListener('appSettingsChanged', loadData);
  }, [dateRange, activeTab, searchQuery]);

  const reportTableData = useMemo(() => {
    if (!bills || bills.length === 0) return [];

    if (activeTab === 'Purchases' || activeTab === 'Sales Register') {
      return bills.map(doc => ({
        "Date": formatDate(doc.date),
        "Doc No": doc.bill_number || doc.invoice_number,
        "Party": doc.vendor_name || doc.customer_name,
        "Taxable": (Number(doc.total_without_gst) || 0).toFixed(2),
        "Gst": (Number(doc.total_gst) || 0).toFixed(2),
        "Net Total": (Number(doc.grand_total) || 0).toFixed(2),
        "Status": doc.status || 'Pending'
      }));
    }

    if (activeTab === 'Vendors Summary' || activeTab === 'Customers Summary') {
      const grouped: Record<string, any> = {};
      bills.forEach(bill => {
        const name = bill.vendor_name || bill.customer_name || 'Unknown';
        if (!grouped[name]) {
          grouped[name] = { "Party Name": name, "Gstin": bill.gstin || 'N/A', "Doc Count": 0, "Taxable": 0, "Gst": 0, "Grand Total": 0 };
        }
        grouped[name]["Doc Count"] += 1;
        grouped[name]["Taxable"] += Number(bill.total_without_gst || 0);
        grouped[name]["Gst"] += Number(bill.total_gst || 0);
        grouped[name]["Grand Total"] += Number(bill.grand_total || 0);
      });
      return Object.values(grouped).map(v => ({
        ...v,
        "Taxable": Number(v["Taxable"]).toFixed(2),
        "Gst": Number(v["Gst"]).toFixed(2),
        "Grand Total": Number(v["Grand Total"]).toFixed(2)
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
    <div className="space-y-6 animate-in fade-in duration-300">
      <ExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} onExport={handleExport} reportName={`${activeTab}`} />

      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-[20px] font-medium text-slate-900 capitalize">Reports Engine</h1>
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => setIsExportModalOpen(true)}
            disabled={reportTableData.length === 0}
            className="px-6 py-2 bg-white border border-slate-200 rounded-md text-xs font-medium capitalize hover:bg-slate-50 disabled:opacity-50 shadow-sm transition-all"
          >
            Export Statement
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
          placeholder="Filter report data..." 
          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-slate-300" 
        />
      </div>

      <div className="flex gap-6 min-h-[500px]">
        <div className="w-64 space-y-1 print:hidden">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`w-full text-left px-4 py-2 text-xs font-medium transition-none capitalize ${
                activeTab === tab ? 'bg-slate-50 text-slate-900 font-medium border-r-2 border-slate-900' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex-1 bg-white border border-slate-200 rounded-md overflow-hidden flex flex-col shadow-sm print:border-none">
          <div className="p-4 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center">
             <h3 className="text-[10px] font-medium text-slate-400 capitalize tracking-widest">{activeTab} Register</h3>
             <span className="text-[10px] font-medium text-slate-400 capitalize">{reportTableData.length} entries matching</span>
          </div>

          <div className="flex-1 overflow-auto bg-white custom-scrollbar">
            {loading ? (
                <div className="h-full flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : reportTableData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-32 text-center">
                    <FileText className="w-12 h-12 text-slate-100 mb-4" />
                    <p className="text-slate-300 italic text-xs capitalize">Report set is currently empty.</p>
                </div>
            ) : (
                <table className="clean-table w-full text-[11px]">
                  <thead>
                    <tr>
                      {Object.keys(reportTableData[0] || {}).map(h => (
                          <th key={h} className="whitespace-nowrap font-medium text-slate-500 bg-slate-50/50 capitalize">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportTableData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        {Object.values(row).map((val: any, vIdx) => (
                          <td key={vIdx} className="whitespace-nowrap font-medium text-slate-700">{val}</td>
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