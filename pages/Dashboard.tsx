import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, Users, ShoppingCart, Wallet, 
  ArrowUpRight, ArrowDownLeft, BadgeIndianRupee 
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getActiveCompanyId, formatCurrency } from '../utils/helpers';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalSales: 0,
    totalPurchases: 0,
    cashBalance: 0,
    customerCount: 0
  });
  const [loading, setLoading] = useState(true);
  const cid = getActiveCompanyId();

  useEffect(() => {
    const fetchStats = async () => {
      if (!cid) return;
      setLoading(true);
      try {
        // Fetch Ledger Totals for Cash Balance
        const { data: ledgerData } = await supabase
          .from('ledgers')
          .select('amount, type')
          .eq('company_id', cid)
          .eq('is_deleted', false);

        const totalIn = ledgerData?.filter(e => e.type === 'IN').reduce((sum, e) => sum + Number(e.amount), 0) || 0;
        const totalOut = ledgerData?.filter(e => e.type === 'OUT').reduce((sum, e) => sum + Number(e.amount), 0) || 0;

        // Fetch Customer Count
        const { count: custCount } = await supabase
          .from('customers')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', cid);

        setStats({
          totalSales: 0, // Link to your invoices table later
          totalPurchases: 0,
          cashBalance: totalIn - totalOut,
          customerCount: custCount || 0
        });
      } catch (err) {
        console.error("Dashboard Stats Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [cid]);

  const statCards = [
    { label: 'Cash Balance', value: formatCurrency(stats.cashBalance), icon: Wallet, color: 'text-primary', bg: 'bg-slate-900' },
    { label: 'Total Sales', value: formatCurrency(stats.totalSales), icon: BadgeIndianRupee, color: 'text-green-600', bg: 'bg-white' },
    { label: 'Purchases', value: formatCurrency(stats.totalPurchases), icon: ShoppingCart, color: 'text-red-500', bg: 'bg-white' },
    { label: 'Active Customers', value: stats.customerCount.toString(), icon: Users, color: 'text-blue-600', bg: 'bg-white' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col">
        <h1 className="text-2xl font-bold text-slate-900">Business Overview</h1>
        <p className="text-sm text-slate-500">Findesk Prime v26.1.9 • Real-time Insights</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, i) => (
          <div key={i} className={`${card.bg} p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:scale-[1.02]`}>
            <div className="flex justify-between items-start">
              <div>
                <p className={`text-[10px] font-black uppercase tracking-widest ${card.bg === 'bg-slate-900' ? 'text-slate-400' : 'text-slate-400'}`}>
                  {card.label}
                </p>
                <p className={`text-2xl font-bold mt-1 font-mono ${card.bg === 'bg-slate-900' ? 'text-white' : 'text-slate-900'}`}>
                  {loading ? '...' : card.value}
                </p>
              </div>
              <div className={`p-3 rounded-xl ${card.bg === 'bg-slate-900' ? 'bg-white/10' : 'bg-slate-50'}`}>
                <card.icon size={20} className={card.color} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
