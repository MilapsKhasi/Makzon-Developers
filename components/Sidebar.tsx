
import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, ReceiptText, Users, Calculator, Package, BarChart3, Settings } from 'lucide-react';

const Sidebar = () => {
  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Purchases', path: '/purchases', icon: ShoppingCart },
    { name: 'Bills', path: '/bills', icon: ReceiptText },
    { name: 'Vendors', path: '/vendors', icon: Users },
    { name: 'Duties & Taxes', path: '/duties-taxes', icon: Calculator },
    { name: 'Stock Management', path: '/stock', icon: Package },
    { name: 'Reports', path: '/reports', icon: BarChart3 },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <aside className="w-64 border-r border-slate-200 h-full py-6 flex flex-col shrink-0">
      <nav className="space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center space-x-3 px-6 py-3 text-sm font-medium transition-none ${
                isActive
                  ? 'bg-primary border-r-4 border-slate-800 text-slate-900'
                  : 'text-slate-600 hover:bg-slate-50'
              }`
            }
          >
            <item.icon className="w-4 h-4" />
            <span>{item.name}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
