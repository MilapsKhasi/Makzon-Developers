
import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ReceiptText, BarChart3, Package, Calculator, Users, Wallet, ShoppingBag, Contact } from 'lucide-react';

const Sidebar = () => {
  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Sales Invoices', path: '/sales', icon: ShoppingBag },
    { name: 'Customers', path: '/customers', icon: Contact },
    { name: 'Purchase Bills', path: '/bills', icon: ReceiptText },
    { name: 'Vendors', path: '/vendors', icon: Users },
    { name: 'Stock Management', path: '/stock', icon: Package },
    { name: 'Cashbook', path: '/cashbook', icon: Wallet },
    { name: 'Duties & Taxes', path: '/duties-taxes', icon: Calculator },
    { name: 'Reports', path: '/reports', icon: BarChart3 },
  ];

  return (
    <aside className="w-64 border-r border-slate-200 h-full py-4 flex flex-col shrink-0 bg-white z-10 overflow-y-auto transition-none">
      <nav className="space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.name + item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center space-x-4 px-6 py-3 text-[14px] font-normal transition-none ${
                isActive
                  ? 'bg-primary text-slate-900 border-r-4 border-slate-900'
                  : 'text-slate-600 hover:bg-slate-50'
              }`
            }
          >
            <item.icon className={`w-4 h-4 ${window.location.hash.includes(item.path) ? 'text-slate-900' : 'text-slate-400'}`} />
            <span className="truncate">{item.name}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
