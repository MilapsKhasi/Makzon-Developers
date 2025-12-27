
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
    <aside className="w-64 border-r border-slate-200 h-full py-6 flex flex-col shrink-0 bg-white relative z-10">
      <nav className="px-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              `group relative flex items-center space-x-3 px-4 py-2.5 text-sm font-bold transition-all duration-200 rounded-lg outline-none ${
                isActive
                  ? 'bg-primary text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                <span className="truncate">{item.name}</span>
                {isActive && (
                  <div className="absolute right-0 top-2 bottom-2 w-1 bg-slate-900 rounded-l-full" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
