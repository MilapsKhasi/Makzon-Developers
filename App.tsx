import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';

// Components
import Layout from './components/Layout';
import SplashScreen from './components/SplashScreen';

// Pages
import Dashboard from './pages/Dashboard';
import Sales from './pages/Sales';
import Bills from './pages/Bills';
import Customers from './pages/Customers';
import Vendors from './pages/Vendors';
import Stock from './pages/Stock';
import Ledger from './pages/Ledger'; // New Prime Ledger
import Reports from './pages/Reports';
import Taxes from './pages/Taxes'; // import Taxes from './pages/Taxes';
import Settings from './pages/Settings';
import Auth from './pages/Auth';
import Companies from './pages/Companies';

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // 1. Handle Authentication State
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // 2. Splash Screen Timer
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  if (showSplash) return <SplashScreen isExiting={false} />;
  if (loading) return <div className="h-screen w-screen flex items-center justify-center bg-white font-mono text-xs uppercase tracking-widest text-slate-400">Initializing Findesk...</div>;

  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/auth" element={!session ? <Auth /> : <Navigate to="/" replace />} />
        
        {/* Protected Routes */}
        {session ? (
          <>
            <Route path="/companies" element={<Companies />} />
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="sales" element={<Sales />} />
              <Route path="bills" element={<Bills />} />
              <Route path="ledger" element={<Ledger />} /> {/* Updated Path */}
              <Route path="customers" element={<Customers />} />
              <Route path="vendors" element={<Vendors />} />
              <Route path="stock" element={<Stock />} />
              <Route path="reports" element={<Reports />} />
              <Route path="taxes" element={<Taxes />} /> 
              <Route path="settings" element={<Settings />} />
            </Route>
          </>
        ) : (
          <Route path="*" element={<Navigate to="/auth" replace />} />
        )}

        {/* Catch-all Redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
