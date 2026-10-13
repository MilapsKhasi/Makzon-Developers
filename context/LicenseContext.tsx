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

  if (type === 'evaluation') {
    if (start) {
      const calculatedEnd = new Date(new Date(start).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
      end = calculatedEnd;
      if (new Date(end).getTime() > now.getTime()) {
        status = 'active';
      } else {
        status = 'expired';
      }
    } else {
      status = 'active';
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

          let { data: licenseData } = await supabase
            .from('licenses')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

          if (!licenseData && user?.email) {
            const { data: licenseByEmail } = await supabase
              .from('licenses')
              .select('*')
              .eq('email', user.email)
              .maybeSingle();
            licenseData = licenseByEmail;
          }
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

        // Account creation date: profile created_at or user auth created_at or profile trial_start or current time
        const accountCreatedAt =
          profile?.created_at ||
          user?.created_at ||
          profile?.trial_start ||
          new Date().toISOString();

        if (profile?.license_type) type = profile.license_type;
        if (profile?.license_status) status = profile.license_status;

        if (licRow?.license_type) type = licRow.license_type;
        if (licRow?.license_status) status = licRow.license_status;

        // If user is on Evaluation Edition:
        // Start date is strictly the account creation date.
        // Expiry date is strictly start date + 14 days (14 full days evaluation).
        if (type === 'evaluation' || (!isDevVerified && !backendActive && type !== 'standard' && type !== 'advanced')) {
          type = 'evaluation';
          startIso = accountCreatedAt;
          const startDateObj = new Date(startIso || Date.now());
          const expiryDateObj = new Date(startDateObj.getTime() + 14 * 24 * 60 * 60 * 1000);
          endIso = expiryDateObj.toISOString();

          // Trial only expires if current time is on or after the 14-day expiry date
          if (now.getTime() >= expiryDateObj.getTime()) {
            status = 'expired';
          } else {
            status = 'active';
          }

          // Persist these exact dates to Supabase profiles table so backend is 100% in sync
          if (
            profile &&
            (profile.trial_start !== startIso ||
              profile.trial_end !== endIso ||
              profile.license_status !== status ||
              profile.license_type !== 'evaluation')
          ) {
            try {
              await supabase.from('profiles').update({
                trial_start: startIso,
                trial_end: endIso,
                license_type: 'evaluation',
                license_status: status,
              }).eq('id', userId);
            } catch (pUpdateErr) {
              console.warn('[License] Could not sync trial dates in profiles:', pUpdateErr);
            }
          }
        } else {
          // Purchased Standard or Advanced license
          startIso = profile?.trial_start || profile?.created_at || user?.created_at || null;
          endIso = profile?.trial_end || profile?.expires_at || null;
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

        // Fallback to localStorage if unauthenticated
        if (!startIso) startIso = localStorage.getItem('zenter_trial_created_at');
        if (!endIso) {
          if (startIso) {
            endIso = new Date(new Date(startIso).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
          } else {
            const nowIso = new Date().toISOString();
            startIso = nowIso;
            endIso = new Date(new Date(nowIso).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
          }
        }
      }

      // Calculate status strictly from current time vs endIso for evaluation trials
      if (isDevVerified) {
        type = 'advanced';
        status = 'active';
      } else if (backendActive) {
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
        } else {
          status = 'expired';
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

  // Strictly 14-day evaluation trial: remaining days cannot exceed 14 (14/14 days initially)
  const daysRemaining = Math.min(14, Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24))));
  const hoursRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60)));
  const minutesRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60)));

  const isExpired =
    !devMode &&
    !isBackendActive &&
    (licenseStatus === 'expired' || (licenseType === 'evaluation' && !!expiresAt && diffMs <= 0));
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
