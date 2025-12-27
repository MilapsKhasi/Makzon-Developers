
import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Vendors from './pages/Vendors';
import Bills from './pages/Bills';
import Stock from './pages/Stock';
import Masters from './pages/Masters';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Purchases from './pages/Purchases';
import DutiesTaxes from './pages/DutiesTaxes';
import Auth from './pages/Auth';
import Companies from './pages/Companies';
import ModeSelection from './pages/ModeSelection';
import { getActiveCompanyId } from './utils/helpers';
import { supabase } from './lib/supabase';

const App = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasSelectedMode, setHasSelectedMode] = useState<boolean>(!!localStorage.getItem('selectedMode'));
  const [activeCompanyId, setActiveCompanyId] = useState(getActiveCompanyId());

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    const handleSettingsChange = () => {
      setActiveCompanyId(getActiveCompanyId());
      setHasSelectedMode(!!localStorage.getItem('selectedMode'));
    };

    window.addEventListener('appSettingsChanged', handleSettingsChange);
    return () => {
      subscription.unsubscribe();
      window.removeEventListener('appSettingsChanged', handleSettingsChange);
    };
  }, []);

  if (loading) return (
    <div className="h-screen w-screen flex items-center justify-center bg-white">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );

  return (
    <Router>
      <Routes>
        <Route path="/setup" element={session ? <Navigate to="/mode-selection" replace /> : <Auth />} />
        <Route path="/mode-selection" element={session ? (hasSelectedMode ? <Navigate to="/companies" replace /> : <ModeSelection />) : <Navigate to="/setup" replace />} />
        <Route path="/companies" element={session ? (hasSelectedMode ? <Companies /> : <Navigate to="/mode-selection" replace />) : <Navigate to="/setup" replace />} />
        <Route path="/" element={session && hasSelectedMode ? (activeCompanyId ? <Layout /> : <Navigate to="/companies" replace />) : (<Navigate to="/setup" replace />)}>
          <Route index element={<Dashboard />} />
          <Route path="masters" element={<Masters />} />
          <Route path="purchases" element={<Purchases />} />
          <Route path="bills" element={<Bills />} />
          <Route path="vendors" element={<Vendors />} />
          <Route path="duties-taxes" element={<DutiesTaxes />} />
          <Route path="stock" element={<Stock />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
