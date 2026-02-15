
import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ReceiptText, BarChart3, Package, Calculator, Users, Wallet, ShoppingBag, Contact } from 'lucide-react';

const Sidebar = () => {
  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, shortcut: 'D' },
    { name: 'Sales Invoices', path: '/sales', icon: ShoppingBag, shortcut: 'I' },
    { name: 'Customers', path: '/customers', icon: Contact, shortcut: 'C' },
    { name: 'Purchase Bills', path: '/bills', icon: ReceiptText, shortcut: 'B' },
    { name: 'Vendors', path: '/vendors', icon: Users, shortcut: 'V' },
    { name: 'Stock Management', path: '/stock', icon: Package, shortcut: 'S' },
    { name: 'Cashbook', path: '/cashbook', icon: Wallet, shortcut: 'K' },
    { name: 'Duties & Taxes', path: '/duties-taxes', icon: Calculator, shortcut: 'T' },
    { name: 'Reports', path: '/reports', icon: BarChart3, shortcut: 'R' },
  ];

  const renderLabel = (text: string, shortcut: string) => {
    const char = shortcut.toLowerCase();
    const index = text.toLowerCase().indexOf(char);
    if (index === -1) return text;

    return (
      <>
        {text.slice(0, index)}
        <span className="underline decoration-1 underline-offset-2">{text[index]}</span>
        {text.slice(index + 1)}
      </>
    );
  };

  return (
    <aside className="w-64 border-r border-slate-200 h-full py-4 flex flex-col shrink-0 bg-white z-10 overflow-y-auto transition-none">
      <nav className="space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.name + item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center justify-between px-6 py-3 text-[14px] font-normal transition-none ${
                isActive
                  ? 'bg-primary text-slate-900 border-r-4 border-slate-900 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50'
              }`
            }
          >
            {/* Fix: Wrap children in a function to access the 'isActive' state provided by NavLink */}
            {({ isActive }) => (
              <div className="flex items-center space-x-4 min-w-0">
                <item.icon className={`w-4 h-4 shrink-0 ${isActive ? 'opacity-100' : 'opacity-70'}`} />
                <span className="truncate">{renderLabel(item.name, item.shortcut)}</span>
              </div>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
