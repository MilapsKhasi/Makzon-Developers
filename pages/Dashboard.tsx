
import React, { useEffect, useState } from 'react';
import { Search, Loader2, ReceiptText, TrendingUp, DollarSign, PieChart, Check, Plus, LayoutDashboard } from 'lucide-react';
import { formatCurrency, getActiveCompanyId, formatDate } from '../utils/helpers';
import DateFilter from '../components/DateFilter';
import Modal from '../components/Modal';
import BillForm from '../components/BillForm';
import { supabase } from '../lib/supabase';

const StatCard = ({ label, value, icon: Icon, color }: { label: string, value: string, icon: any, color: string }) => (
  <div className="bg-white p-8 border border-slate-200 rounded-2xl boxy-shadow hover:border-primary transition-all duration-300 flex flex-col justify-between h-full group">
    <div className="flex justify-between items-start mb-6">
      <div className={`p-3 rounded-xl ${color} shadow-inner transition-transform group-hover:scale-110 duration-300`}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{label}</p>
      <h2 className="text-3xl font-bold text-slate-900 tracking-tight truncate">{value}</h2>
    </div>
  </div>
);

const Dashboard = () => {
  const [stats, setStats] = useState({ 
    totalPurchases: 0, 
    withoutGst: 0, 
    gst: 0, 
    withGst: 0, 
    gstPaid: 0 
  });
  const [recentBills, setRecentBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dateRange, setDateRange] = useState({ startDate: null, endDate: null });

  const loadData = async () => {
    setLoading(true);
    const cid = getActiveCompanyId();
    if (!cid) return;

    let query = supabase
      .from('bills')
      .select('*')
      .eq('company_id', cid)
      .eq('is_deleted', false)
      .order('date', { ascending: false });

    if (dateRange.startDate && dateRange.endDate) {
      query = query.gte('date', dateRange.startDate).lte('date', dateRange.endDate);
    }

    const { data } = await query;
    const bills = data || [];

    const summary = bills.reduce((acc: any, b: any) => ({
      totalPurchases: acc.totalPurchases + Number(b.grand_total || 0),
      withoutGst: acc.withoutGst + Number(b.total_without_gst || 0),
      gst: acc.gst + Number(b.total_gst || 0),
      withGst: acc.withGst + Number(b.grand_total || 0),
      gstPaid: acc.gstPaid + (b.status === 'Paid' ? Number(b.total_gst || 0) : 0)
    }), { totalPurchases: 0, withoutGst: 0, gst: 0, withGst: 0, gstPaid: 0 });
    
    setStats(summary);
    setRecentBills(bills.slice(0, 10));
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    window.addEventListener('appSettingsChanged', loadData);
    return () => window.removeEventListener('appSettingsChanged', loadData);
  }, [dateRange]);

  return (
    <div className="space-y-12 animate-in fade-in duration-500">
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Register Purchase Bill">
        <BillForm onSubmit={() => { setIsModalOpen(false); loadData(); }} onCancel={() => setIsModalOpen(false)} />
      </Modal>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-white border border-slate-200 rounded-xl flex items-center justify-center shadow-sm">
            <LayoutDashboard className="w-6 h-6 text-slate-400" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight leading-none">Executive Dashboard</h1>
        </div>
        <div className="flex items-center space-x-4">
          <DateFilter onFilterChange={setDateRange} />
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-primary text-slate-900 px-8 py-3 rounded-lg font-bold text-sm border border-primary hover:bg-primary-dark shadow-md transition-all active:scale-95 flex items-center"
          >
            <Plus className="w-4.5 h-4.5 mr-2" /> Quick Entry
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
        <StatCard label="Net Total Volume" value={formatCurrency(stats.totalPurchases)} icon={TrendingUp} color="bg-blue-50 text-blue-600" />
        <StatCard label="Basic Taxable Val" value={formatCurrency(stats.withoutGst)} icon={DollarSign} color="bg-slate-50 text-slate-600" />
        <StatCard label="Total Tax Accrual" value={formatCurrency(stats.gst)} icon={PieChart} color="bg-amber-50 text-amber-600" />
        <StatCard label="Grand Total (Net)" value={formatCurrency(stats.withGst)} icon={ReceiptText} color="bg-green-50 text-green-600" />
        <StatCard label="Cleared Tax Credit" value={formatCurrency(stats.gstPaid)} icon={Check} color="bg-primary/20 text-slate-900" />
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Historical Voucher Activity</h2>
          <span className="text-[10px] text-slate-400 font-medium">Last 10 Records</span>
        </div>
        <div className="border border-slate-200 rounded-2xl overflow-hidden boxy-shadow bg-white">
          {loading ? (
            <div className="py-32 flex flex-col items-center justify-center">
              <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Updating Dashboard analytics...</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  <th className="py-5 px-8 border-r border-slate-200 w-12 text-center">No</th>
                  <th className="py-5 px-8 border-r border-slate-200">Voucher Date</th>
                  <th className="py-5 px-8 border-r border-slate-200">Invoice No</th>
                  <th className="py-5 px-8 border-r border-slate-200">Vendor / Party</th>
                  <th className="py-5 px-8 border-r border-slate-200 text-right">Taxable</th>
                  <th className="py-5 px-8 border-r border-slate-200 text-right font-bold">Grand Total</th>
                  <th className="py-5 px-8 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentBills.map((bill, i) => (
                  <tr key={bill.id} className="hover:bg-slate-50 transition-all duration-200 group">
                    <td className="py-5 px-8 border-r border-slate-200 text-slate-400 text-center font-mono text-[10px]">{i + 1}</td>
                    <td className="py-5 px-8 border-r border-slate-200 font-bold text-slate-600">{formatDate(bill.date)}</td>
                    <td className="py-5 px-8 border-r border-slate-200 font-mono font-bold text-slate-900">{bill.bill_number}</td>
                    <td className="py-5 px-8 border-r border-slate-200 font-bold text-slate-900 truncate max-w-[250px]">{bill.vendor_name}</td>
                    <td className="py-5 px-8 border-r border-slate-200 text-right text-slate-600 font-medium">{formatCurrency(bill.total_without_gst)}</td>
                    <td className="py-5 px-8 border-r border-slate-200 text-right font-bold text-slate-900">{formatCurrency(bill.grand_total)}</td>
                    <td className="py-5 px-8 text-center">
                      <span className={`text-[9px] font-bold uppercase px-3 py-1 rounded-full border shadow-sm ${bill.status === 'Paid' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>{bill.status}</span>
                    </td>
                  </tr>
                ))}
                {recentBills.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-40 text-center">
                      <PieChart className="w-16 h-16 text-slate-100 mx-auto mb-4" />
                      <p className="text-slate-300 italic font-medium">No transactional activity detected in this selected range.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
