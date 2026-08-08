import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, getAuthUser } from '../lib/supabase';
import { applyEditionTheme } from '../utils/themeHelper';

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
  isBackendActive: boolean;
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

  if (start && end && type === 'evaluation') {
    if (new Date(end).getTime() > now.getTime()) {
      status = 'active';
    } else {
      status = 'expired';
    }
  }

  return { start: start || null, end: end || null, type, status };
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

  const [devMode, setDevModeState] = useState<boolean>(false);
  const [isBackendActive, setIsBackendActive] = useState<boolean>(false);

  const setDevMode = (active: boolean) => {
    setDevModeState(active);
  };

  const updateTrialStorage = (
    start: string | null,
    end: string | null,
    type: 'evaluation' | 'standard' | 'advanced' = 'evaluation',
    status: 'active' | 'expired' = 'active'
  ) => {
    setCreatedAt(start);
    setExpiresAt(end);
    setLicenseType(type);
    setLicenseStatus(status);
    try {
      if (start) localStorage.setItem('zenter_trial_created_at', start);
      else localStorage.removeItem('zenter_trial_created_at');

      if (end) localStorage.setItem('zenter_trial_expires_at', end);
      else localStorage.removeItem('zenter_trial_expires_at');

      localStorage.setItem('zenter_license_type', type);
      localStorage.setItem('zenter_license_status', status);
      applyEditionTheme(type);
    } catch {}
  };

  const refreshLicense = useCallback(async () => {
    setLoading(true);
    try {
      const user = await getAuthUser();
      const userId = user?.id || null;

      let profile: any = null;
      let licRow: any = null;
      let isDbDeveloper = false;
      let backendActive = false;

      const checkIsYes = (val: any) => {
        if (typeof val === 'string') {
          const s = val.trim().toUpperCase();
          return s === 'YES' || s === 'TRUE';
        }
        return val === true;
      };

      if (userId) {
        try {
          const { data: prof } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();
          profile = prof;

          const { data: licenseData } = await supabase
            .from('licenses')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();
          licRow = licenseData;

          if (
            checkIsYes(profile?.is_developer) ||
            checkIsYes(profile?.isDeveloper) ||
            checkIsYes(licRow?.is_developer) ||
            checkIsYes(licRow?.isDeveloper)
          ) {
            isDbDeveloper = true;
          }

          if (
            checkIsYes(licRow?.isActive) ||
            checkIsYes(licRow?.is_active) ||
            checkIsYes(profile?.isActive) ||
            checkIsYes(profile?.is_active)
          ) {
            backendActive = true;
          }
        } catch (e) {
          console.warn('Developer & license check warning:', e);
        }
      }

      setIsBackendActive(backendActive);

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

      let startIso: string | null = null;
      let endIso: string | null = null;
      let type: 'evaluation' | 'standard' | 'advanced' = isDevVerified ? 'advanced' : ((localStorage.getItem('zenter_license_type') as any) || 'evaluation');
      let status: 'active' | 'expired' = isDevVerified ? 'active' : ((localStorage.getItem('zenter_license_status') as any) || 'active');

      if (userId) {
        // Fetch user's company count
        const { data: companiesData } = await supabase
          .from('companies')
          .select('id')
          .eq('is_deleted', false)
          .or(`created_by.eq.${userId},user_id.eq.${userId}`);

        const userWorkspaceCount = (companiesData || []).filter((c: any) => c.id !== 'local-company-1').length;
        setWorkspaceCount(userWorkspaceCount);

        // Fetch official trial & license data directly from Supabase profiles (primary source)
        if (profile) {
          startIso = profile.trial_start || profile.trial_created_at || profile.created_at || profile.start_date || null;
          endIso = profile.trial_end || profile.trial_expires_at || profile.expires_at || profile.end_date || null;
          if (profile.license_type) type = profile.license_type;
          if (profile.license_status) status = profile.license_status;
        }

        // Fallback check on licenses table if profiles has no trial dates
        if (!startIso || !endIso) {
          if (licRow) {
            if (!startIso) startIso = licRow.trial_start || licRow.start_date || licRow.created_at || null;
            if (!endIso) endIso = licRow.trial_end || licRow.end_date || licRow.expires_at || null;
            if (licRow.license_type) type = licRow.license_type;
            if (licRow.license_status) status = licRow.license_status;
          }
        }

        // Check login_verifications table if dates still missing
        if (!startIso || !endIso) {
          try {
            const { data: verifications } = await supabase
              .from('login_verifications')
              .select('created_at, expires_at')
              .eq('user_id', userId)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (verifications?.created_at && verifications?.expires_at) {
              if (!startIso) startIso = verifications.created_at;
              if (!endIso) endIso = verifications.expires_at;
            }
          } catch {}
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

      // Fallback to localStorage ONLY if no dates were found in Supabase
      if (!startIso) startIso = localStorage.getItem('zenter_trial_created_at');
      if (!endIso) endIso = localStorage.getItem('zenter_trial_expires_at');

      // Calculate status strictly from current time vs endIso for evaluation trials
      if (isDevVerified) {
        type = 'advanced';
        status = 'active';
      } else if (backendActive) {
        // When backend isActive is YES: account is activated without trial limit.
        // Expiration date won't work / lockout. Converts evaluation to proper edition.
        status = 'active';
        const storedEdition = localStorage.getItem('zenter_edition') || localStorage.getItem('zenter_license_type');
        if (storedEdition === 'professional' || storedEdition === 'advanced' || profile?.license_type === 'advanced' || licRow?.license_type === 'advanced') {
          type = 'advanced';
        } else {
          type = 'standard';
        }
      } else if (type === 'evaluation' && endIso) {
        const endTimeMs = new Date(endIso).getTime();
        if (now.getTime() < endTimeMs) {
          status = 'active';
          if (userId && profile?.license_status === 'expired') {
            try {
              await supabase.from('profiles').update({ license_status: 'active' }).eq('id', userId);
            } catch {}
          }
        } else {
          status = 'expired';
          if (userId && profile?.license_status !== 'expired') {
            try {
              await supabase.from('profiles').update({ license_status: 'expired' }).eq('id', userId);
            } catch {}
          }
        }
      } else if (endIso) {
        const endTimeMs = new Date(endIso).getTime();
        if (endTimeMs && now.getTime() >= endTimeMs) {
          status = 'expired';
        } else if (profile?.license_status) {
          status = profile.license_status;
        } else {
          status = 'active';
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
      if (!isBackendActive && expiresAt && licenseStatus === 'active' && licenseType === 'evaluation') {
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
  }, [expiresAt, licenseStatus, licenseType, isBackendActive]);

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

  const isExpired = !devMode && !isBackendActive && (licenseStatus === 'expired' || (licenseType === 'evaluation' && diffMs <= 0));
  const isReadOnly = isExpired;
  const isWorkspaceLimitReached = !devMode && !isBackendActive && licenseType === 'evaluation' && workspaceCount >= 1;

  // Show 5-day warning popup if trial is active and <= 5 days remain
  const show5DayWarning =
    !devMode &&
    !isBackendActive &&
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
        isBackendActive,
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
