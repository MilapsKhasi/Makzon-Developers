import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, getAuthUser } from '../lib/supabase';

export interface TrialInfo {
  createdAt: string | null;
  expiresAt: string | null;
  licenseType: 'evaluation' | 'standard' | 'advanced';
  licenseStatus: 'active' | 'expired';
  daysRemaining: number;
  hoursRemaining: number;
  minutesRemaining: number;
  isExpired: boolean;
  isReadOnly: boolean;
  workspaceCount: number;
  isWorkspaceLimitReached: boolean;
  show5DayWarning: boolean;
  dismiss5DayWarning: () => void;
  loading: boolean;
  devMode: boolean;
  setDevMode: (active: boolean) => void;
  setDevTrialDuration: (durationMinutes: number) => Promise<void>;
  setDevEdition: (type: 'evaluation' | 'standard' | 'advanced', durationAmount: number, isMinutes?: boolean) => Promise<void>;
  refreshLicense: () => Promise<void>;
}

const LicenseContext = createContext<TrialInfo | undefined>(undefined);

const getStoredTrialState = () => {
  let start = localStorage.getItem('zenter_trial_created_at');
  let end = localStorage.getItem('zenter_trial_expires_at');
  let type = (localStorage.getItem('zenter_license_type') as 'evaluation' | 'standard' | 'advanced') || 'evaluation';
  let status = (localStorage.getItem('zenter_license_status') as 'active' | 'expired') || 'active';

  const now = new Date();
  let shouldResetTo14Days = false;
  if (start && end && type === 'evaluation') {
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    const durationDays = (endTime - startTime) / (1000 * 60 * 60 * 24);
    // If previous trial was short (e.g., 1 day trial set previously), reset to 14 days
    if (durationDays < 13 || endTime <= now.getTime()) {
      shouldResetTo14Days = true;
    }
  }

  if (!start || !end || shouldResetTo14Days) {
    start = now.toISOString();
    const endDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    end = endDate.toISOString();
    status = 'active';
    type = 'evaluation';

    try {
      localStorage.setItem('zenter_trial_created_at', start);
      localStorage.setItem('zenter_trial_expires_at', end);
      localStorage.setItem('zenter_license_type', type);
      localStorage.setItem('zenter_license_status', status);
    } catch {}
  }

  if (end && new Date(end).getTime() <= Date.now() && type !== 'evaluation') {
    status = 'expired';
    try {
      localStorage.setItem('zenter_license_status', 'expired');
    } catch {}
  }

  return { start, end, type, status };
};

export const LicenseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialTrial = getStoredTrialState();
  const [createdAt, setCreatedAt] = useState<string | null>(initialTrial.start);
  const [expiresAt, setExpiresAt] = useState<string | null>(initialTrial.end);
  const [licenseType, setLicenseType] = useState<'evaluation' | 'standard' | 'advanced'>(initialTrial.type);
  const [licenseStatus, setLicenseStatus] = useState<'active' | 'expired'>(initialTrial.status);
  const [workspaceCount, setWorkspaceCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [warningDismissed, setWarningDismissed] = useState(false);

  // Developer mode is false by default in production and only controllable via code
  const [devMode, setDevModeState] = useState<boolean>(false);

  const setDevMode = (active: boolean) => {
    setDevModeState(active);
  };

  const updateTrialStorage = (
    start: string,
    end: string,
    type: 'evaluation' | 'standard' | 'advanced' = 'evaluation',
    status: 'active' | 'expired' = 'active'
  ) => {
    setCreatedAt(start);
    setExpiresAt(end);
    setLicenseType(type);
    setLicenseStatus(status);
    try {
      localStorage.setItem('zenter_trial_created_at', start);
      localStorage.setItem('zenter_trial_expires_at', end);
      localStorage.setItem('zenter_license_type', type);
      localStorage.setItem('zenter_license_status', status);
    } catch {}
  };

  const refreshLicense = useCallback(async () => {
    setLoading(true);
    try {
      const user = await getAuthUser();
      const userId = user?.id || null;

      let profile: any = null;
      let isDbDeveloper = false;

      if (userId) {
        try {
          const { data: prof } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();
          profile = prof;

          if (
            (typeof profile?.is_developer === 'string' && profile.is_developer.trim().toUpperCase() === 'YES') ||
            (typeof profile?.isDeveloper === 'string' && profile.isDeveloper.trim().toUpperCase() === 'YES') ||
            profile?.is_developer === true ||
            profile?.isDeveloper === true
          ) {
            isDbDeveloper = true;
          } else {
            const { data: licenseRow } = await supabase
              .from('licenses')
              .select('*')
              .eq('user_id', userId)
              .maybeSingle();

            if (
              (typeof licenseRow?.is_developer === 'string' && licenseRow.is_developer.trim().toUpperCase() === 'YES') ||
              (typeof licenseRow?.isDeveloper === 'string' && licenseRow.isDeveloper.trim().toUpperCase() === 'YES') ||
              licenseRow?.is_developer === true ||
              licenseRow?.isDeveloper === true
            ) {
              isDbDeveloper = true;
            }
          }
        } catch (e) {
          console.warn('Developer mode check warning:', e);
        }
      }

      const isDevEmail = !!user && user.email?.trim().toLowerCase() === 'khasimilap@gmail.com';
      const devToken = localStorage.getItem('zenter_dev_cred_verified');
      const isDevVerified = isDevEmail || isDbDeveloper || (devToken === btoa('khasimilap@gmail.com:Milaps123') && isDevEmail);
      if (isDevVerified) {
        try { localStorage.setItem('zenter_dev_cred_verified', btoa('khasimilap@gmail.com:Milaps123')); } catch {}
      } else {
        try { localStorage.removeItem('zenter_dev_cred_verified'); } catch {}
      }
      setDevModeState(isDevVerified);

      const now = new Date();

      let startIso = localStorage.getItem('zenter_trial_created_at');
      let endIso = localStorage.getItem('zenter_trial_expires_at');
      let type = isDevVerified ? 'advanced' : ((localStorage.getItem('zenter_license_type') as any) || 'evaluation');
      let status = isDevVerified ? 'active' : ((localStorage.getItem('zenter_license_status') as any) || 'active');

      if (userId) {
        // Fetch user's company count
        const { data: companiesData } = await supabase
          .from('companies')
          .select('id')
          .eq('is_deleted', false)
          .or(`created_by.eq.${userId},user_id.eq.${userId}`);

        const userWorkspaceCount = (companiesData || []).filter((c: any) => c.id !== 'local-company-1').length;
        setWorkspaceCount(userWorkspaceCount);

        // Fetch latest trial data from Supabase login_verifications or profiles
        const { data: verifications } = await supabase
          .from('login_verifications')
          .select('created_at, expires_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (verifications?.created_at && verifications?.expires_at) {
          startIso = verifications.created_at;
          endIso = verifications.expires_at;
        } else if (profile?.trial_start && profile?.trial_end) {
          startIso = profile.trial_start;
          endIso = profile.trial_end;
        }

        if (profile?.license_type) type = profile.license_type;
        if (profile?.license_status) status = profile.license_status;

        // If evaluation trial duration is short (e.g. 1 day trial set previously) or expired, reset to full 14-day trial
        if (type === 'evaluation' && startIso && endIso) {
          const startTime = new Date(startIso).getTime();
          const endTime = new Date(endIso).getTime();
          const durationDays = (endTime - startTime) / (1000 * 60 * 60 * 24);
          if (durationDays < 13 || endTime <= now.getTime()) {
            startIso = now.toISOString();
            const endDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
            endIso = endDate.toISOString();
            status = 'active';
            try {
              await supabase.from('profiles').upsert({
                id: userId,
                trial_start: startIso,
                trial_end: endIso,
                license_type: 'evaluation',
                license_status: 'active',
              });
            } catch {}
          }
        }

        // If user profile / verification is missing, initialize automatic 14-day evaluation in Supabase
        if (!startIso || !endIso) {
          startIso = now.toISOString();
          const endDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
          endIso = endDate.toISOString();
          type = 'evaluation';
          status = 'active';

          try {
            await supabase.from('profiles').upsert({
              id: userId,
              trial_start: startIso,
              trial_end: endIso,
              license_type: type,
              license_status: status,
            });

            await supabase.from('login_verifications').insert({
              user_id: userId,
              otp: '',
              created_at: startIso,
              expires_at: endIso,
            });
          } catch (initErr) {
            console.warn('Auto-init trial error:', initErr);
          }
        }
      } else {
        // Offline or unauthenticated count from local companies
        try {
          const rawComp = localStorage.getItem('local_db_companies');
          if (rawComp) {
            const comps = JSON.parse(rawComp);
            const filtered = Array.isArray(comps) ? comps.filter((c: any) => !c.is_deleted && c.id !== 'local-company-1') : [];
            setWorkspaceCount(filtered.length);
          }
        } catch {}
      }

      if (!startIso || !endIso) {
        startIso = now.toISOString();
        const endDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
        endIso = endDate.toISOString();
        type = 'evaluation';
        status = 'active';
      }

      const endTime = new Date(endIso).getTime();
      if (now.getTime() >= endTime && type === 'evaluation') {
        status = 'expired';
        if (userId) {
          try {
            await supabase.from('profiles').update({ license_status: 'expired' }).eq('id', userId);
          } catch {}
        }
      }

      updateTrialStorage(startIso, endIso, type, status);
    } catch (err) {
      console.error('License refresh error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshLicense();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      refreshLicense();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshLicense]);

  // Periodic status check every 5 seconds to update time remaining and expiry status
  useEffect(() => {
    const interval = setInterval(() => {
      if (expiresAt && licenseStatus === 'active' && licenseType === 'evaluation') {
        const now = Date.now();
        const end = new Date(expiresAt).getTime();
        if (now >= end) {
          setLicenseStatus('expired');
          try {
            localStorage.setItem('zenter_license_status', 'expired');
          } catch {}
          getAuthUser().then(async (user) => {
            if (user) {
              try {
                await supabase.from('profiles').update({ license_status: 'expired' }).eq('id', user.id);
              } catch {}
            }
          });
        }
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [expiresAt, licenseStatus, licenseType]);

  // Developer mode duration & edition setter
  const setDevEdition = async (
    type: 'evaluation' | 'standard' | 'advanced',
    durationAmount: number,
    isMinutes: boolean = false
  ) => {
    const start = new Date();
    const durationMs = isMinutes ? durationAmount * 60 * 1000 : durationAmount * 24 * 60 * 60 * 1000;
    const end = new Date(start.getTime() + durationMs);

    const startIso = start.toISOString();
    const endIso = end.toISOString();

    updateTrialStorage(startIso, endIso, type, 'active');

    const user = await getAuthUser();
    if (!user) return;

    try {
      await supabase.from('profiles').upsert({
        id: user.id,
        trial_start: startIso,
        trial_end: endIso,
        license_type: type,
        license_status: 'active',
      });

      if (type === 'evaluation') {
        await supabase.from('login_verifications').insert({
          user_id: user.id,
          otp: '',
          created_at: startIso,
          expires_at: endIso,
        });
      }
    } catch (err) {
      console.error('Error setting dev edition:', err);
    }
  };

  const setDevTrialDuration = async (durationMinutes: number) => {
    await setDevEdition('evaluation', durationMinutes, true);
  };

  const nowTime = Date.now();
  const endTime = expiresAt ? new Date(expiresAt).getTime() : 0;
  const diffMs = Math.max(0, endTime - nowTime);

  const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const hoursRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60)));
  const minutesRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60)));

  const isExpired = !devMode && (licenseStatus === 'expired' || (licenseType === 'evaluation' && diffMs <= 0));
  const isReadOnly = isExpired;
  const isWorkspaceLimitReached = !devMode && licenseType === 'evaluation' && workspaceCount >= 1;

  // Show 5-day warning popup if trial is active and <= 5 days remain
  const show5DayWarning =
    !devMode &&
    licenseType === 'evaluation' &&
    !isExpired &&
    daysRemaining <= 5 &&
    !warningDismissed;

  const dismiss5DayWarning = () => setWarningDismissed(true);

  return (
    <LicenseContext.Provider
      value={{
        createdAt,
        expiresAt,
        licenseType,
        licenseStatus,
        daysRemaining,
        hoursRemaining,
        minutesRemaining,
        isExpired,
        isReadOnly,
        workspaceCount,
        isWorkspaceLimitReached,
        show5DayWarning,
        dismiss5DayWarning,
        loading,
        devMode,
        setDevMode,
        setDevTrialDuration,
        setDevEdition,
        refreshLicense,
      }}
    >
      {children}
    </LicenseContext.Provider>
  );
};

export const useLicense = () => {
  const context = useContext(LicenseContext);
  if (context === undefined) {
    throw new Error('useLicense must be used within a LicenseProvider');
  }
  return context;
};
