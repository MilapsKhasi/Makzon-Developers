
import React from 'react';
import { NavLink } from 'react-router-dom';

const Sidebar = () => {
  const navItems = [
    { name: 'Dashboard', path: '/' },
    { name: 'Purchases', path: '/purchases' },
    { name: 'Bills', path: '/bills' },
    { name: 'Vendors', path: '/vendors' },
    { name: 'Reports', path: '/reports' },
    { name: 'Stock Management', path: '/stock' },
  ];

  return (
    <aside className="w-64 border-r border-slate-200 h-full py-6 flex flex-col shrink-0">
      <nav className="space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              `block px-6 py-3 text-sm font-medium transition-none ${
                isActive
                  ? 'bg-primary border-r-4 border-slate-800'
                  : 'text-slate-600 hover:bg-slate-50'
              }`
            }
          >
            {item.name}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
