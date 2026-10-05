import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ShieldAlert, CheckCircle2, AlertTriangle, X, Shield, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ToastItem {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'alert' | 'error';
}

interface VerificationModalState {
  isOpen: boolean;
  actionName: string;
  onVerifySuccess: () => void | Promise<void>;
  onCancel?: () => void;
}

interface SecurityDemoContextType {
  investigationMode: boolean;
  setInvestigationMode: (active: boolean) => void;
  trustedDevice: boolean;
  setTrustedDevice: (trusted: boolean) => void;
  isForeignAccount: boolean;
  setIsForeignAccount: (isForeign: boolean) => void;
  demoZPin: string;
  setDemoZPin: (pin: string) => void;
  currentAccountEmail: string;
  setCurrentAccountEmail: (email: string) => void;
  updateAccountZPin: (newPin: string, accountEmail?: string) => { success: boolean; error?: string };
  getAccountZPin: (accountEmail?: string) => string;
  isVerificationRequired: boolean;
  verifyAction: (actionName: string, onExecute: () => void | Promise<void>, onCancel?: () => void) => void;
  resetInvestigationDemo: () => void;
  showToast: (title: string, message: string, type?: 'success' | 'alert' | 'error') => void;
  isBannerDismissed: boolean;
  dismissBanner: () => void;
}

const WEAK_PINS = ['1234', '0000', '1111', '1212', '2580', '4321'];

const getBrowserName = (): string => {
  if (typeof navigator === 'undefined') return 'Unknown Browser';
  const ua = navigator.userAgent;
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('SamsungBrowser')) return 'Samsung Internet';
  if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
  if (ua.includes('Trident')) return 'Internet Explorer';
  if (ua.includes('Edge') || ua.includes('Edg')) return 'Edge';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  return 'Desktop Browser';
};

const getOSName = (): string => {
  if (typeof navigator === 'undefined') return 'Unknown OS';
  const ua = navigator.userAgent;
  if (ua.includes('Win')) return 'Windows';
  if (ua.includes('Mac')) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  return 'Desktop OS';
};

const SecurityDemoContext = createContext<SecurityDemoContextType | undefined>(undefined);

export const SecurityDemoProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Initialize from localStorage
  const [investigationMode, setInvestigationModeState] = useState<boolean>(() => {
    return localStorage.getItem('zenter_investigation_mode') === 'true';
  });

  const [trustedDevice, setTrustedDeviceState] = useState<boolean>(() => {
    const stored = localStorage.getItem('zenter_trusted_device');
    if (stored !== null) return stored === 'true';
    return localStorage.getItem('zenter_investigation_mode') !== 'true';
  });

  const [isForeignAccount, setIsForeignAccountState] = useState<boolean>(() => {
    return localStorage.getItem('zenter_is_foreign_account') === 'true';
  });

  const [currentAccountEmail, setCurrentAccountEmail] = useState<string>(() => {
    return localStorage.getItem('zenter_current_account_email') || '';
  });

  const [currentUserId, setCurrentUserId] = useState<string>('');

  const [demoZPin, setDemoZPinState] = useState<string>(() => {
    return localStorage.getItem('zenter_demo_zpin') || '9876';
  });

  const [isBannerDismissed, setIsBannerDismissed] = useState<boolean>(() => {
    return sessionStorage.getItem('zenter_investigation_banner_dismissed') === 'true';
  });

  // Floating Toasts Stack
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Verification Modal State
  const [modalState, setModalState] = useState<VerificationModalState>({
    isOpen: false,
    actionName: '',
    onVerifySuccess: () => {},
    onCancel: undefined
  });

  // Modal Input & Attempts State
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [failedAttempts, setFailedAttempts] = useState<number>(0);

  // Sync user info from Supabase session
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const user = data?.session?.user;
        if (user) {
          const userEmail = (user.email || '').toLowerCase().trim();
          setCurrentAccountEmail(userEmail);
          setCurrentUserId(user.id || '');
          localStorage.setItem('zenter_current_account_email', userEmail);

          // Check if this account has an initial creator recorded on this device
          const creatorKey = `zenter_creator_${userEmail}`;
          const existingCreator = localStorage.getItem(creatorKey);
          if (!existingCreator) {
            localStorage.setItem(creatorKey, user.id);
          } else if (existingCreator !== user.id) {
            setIsForeignAccountState(true);
            localStorage.setItem('zenter_is_foreign_account', 'true');
          }
        }
      } catch (err) {
        console.warn('Error fetching auth user for security context:', err);
      }
    };
    fetchUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      const user = session?.user;
      if (user) {
        const userEmail = (user.email || '').toLowerCase().trim();
        setCurrentAccountEmail(userEmail);
        setCurrentUserId(user.id || '');
        localStorage.setItem('zenter_current_account_email', userEmail);
      } else {
        setCurrentAccountEmail('');
        setCurrentUserId('');
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  // Check company creator ownership
  useEffect(() => {
    const checkCompanyOwnership = async () => {
      const activeCid = localStorage.getItem('activeCompanyId');
      if (activeCid && currentUserId && currentUserId !== 'local-user-1') {
        const { data: comp } = await supabase
          .from('companies')
          .select('created_by, user_id')
          .eq('id', activeCid)
          .maybeSingle();
        if (comp) {
          const creator = comp.created_by || comp.user_id;
          if (creator && creator !== currentUserId) {
            setIsForeignAccountState(true);
            localStorage.setItem('zenter_is_foreign_account', 'true');
          }
        }
      }
    };
    checkCompanyOwnership();
  }, [currentUserId]);

  const showToast = (title: string, message: string, type: 'success' | 'alert' | 'error' = 'alert') => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newToast: ToastItem = { id, title, message, type };
    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const setInvestigationMode = (active: boolean) => {
    setInvestigationModeState(active);
    localStorage.setItem('zenter_investigation_mode', active ? 'true' : 'false');
    const trusted = !active;
    setTrustedDeviceState(trusted);
    localStorage.setItem('zenter_trusted_device', trusted ? 'true' : 'false');
    if (!active) {
      sessionStorage.removeItem('zenter_investigation_banner_dismissed');
      setIsBannerDismissed(false);
    }
  };

  const setTrustedDevice = (trusted: boolean) => {
    setTrustedDeviceState(trusted);
    localStorage.setItem('zenter_trusted_device', trusted ? 'true' : 'false');
  };

  const setIsForeignAccount = (isForeign: boolean) => {
    setIsForeignAccountState(isForeign);
    localStorage.setItem('zenter_is_foreign_account', isForeign ? 'true' : 'false');
  };

  const setDemoZPin = (pin: string) => {
    setDemoZPinState(pin);
    localStorage.setItem('zenter_demo_zpin', pin);
    if (currentAccountEmail) {
      localStorage.setItem(`zenter_account_zpin_${currentAccountEmail.toLowerCase().trim()}`, pin);
    }
  };

  const getAccountZPinKey = (accountEmail?: string) => {
    const emailToUse = (accountEmail || currentAccountEmail || '').toLowerCase().trim();
    return emailToUse ? `zenter_account_zpin_${emailToUse}` : 'zenter_demo_zpin';
  };

  const getAccountZPin = (accountEmail?: string): string => {
    const key = getAccountZPinKey(accountEmail);
    const stored = localStorage.getItem(key);
    if (stored) return stored;
    return localStorage.getItem('zenter_demo_zpin') || '9876';
  };

  const updateAccountZPin = (newPin: string, accountEmail?: string): { success: boolean; error?: string } => {
    const validation = validateZPin(newPin);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }
    const cleanPin = newPin.trim();
    const key = getAccountZPinKey(accountEmail);
    localStorage.setItem(key, cleanPin);
    setDemoZPinState(cleanPin);
    localStorage.setItem('zenter_demo_zpin', cleanPin);
    return { success: true };
  };

  const dismissBanner = () => {
    setIsBannerDismissed(true);
    sessionStorage.setItem('zenter_investigation_banner_dismissed', 'true');
  };

  const resetInvestigationDemo = () => {
    setInvestigationModeState(false);
    setTrustedDeviceState(true);
    setIsForeignAccountState(false);
    setDemoZPinState('9876');
    setFailedAttempts(0);
    setIsBannerDismissed(false);

    localStorage.removeItem('zenter_investigation_mode');
    localStorage.removeItem('zenter_trusted_device');
    localStorage.removeItem('zenter_is_foreign_account');
    localStorage.removeItem('zenter_demo_zpin');
    if (currentAccountEmail) {
      localStorage.removeItem(`zenter_account_zpin_${currentAccountEmail.toLowerCase().trim()}`);
    }
    sessionStorage.removeItem('zenter_investigation_banner_dismissed');

    showToast(
      'Investigation Demo Reset',
      'Investigation Mode and account Z-PIN settings have been restored to defaults.',
      'success'
    );
  };

  const isVerificationRequired = investigationMode || isForeignAccount;

  // Core verification interceptor for create, delete, import, export, print actions
  // Terminated silently without any toast notification, popup appears to enter Z-PIN
  const verifyAction = (
    actionName: string,
    onExecute: () => void | Promise<void>,
    onCancel?: () => void
  ) => {
    if (!isVerificationRequired) {
      // Normal owner session without investigation - execute immediately
      onExecute();
      return;
    }

    // Print audit object to browser console for developer inspection
    console.warn('[ZenterPrime Security Audit - Protected Action Intercepted]', {
      Action: actionName,
      Account: currentAccountEmail || 'Current Session',
      Browser: getBrowserName(),
      OS: getOSName(),
      Timestamp: new Date().toLocaleString(),
      'Investigation Mode': investigationMode,
      'Foreign / Non-Owner Account': isForeignAccount,
      Session: 'Protected Action Intercepted'
    });

    // Terminated silently without any toast notification:
    // Open Verification Modal directly to enter Z-PIN
    setPinInput('');
    setPinError('');
    setModalState({
      isOpen: true,
      actionName,
      onVerifySuccess: onExecute,
      onCancel
    });
  };

  // Handle modal submit
  const handleVerifyPin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const cleanInput = pinInput.trim();
    const storedPin = getAccountZPin(currentAccountEmail);

    if (!cleanInput) {
      setPinError('Please enter your Z-PIN.');
      return;
    }

    if (cleanInput === storedPin) {
      // Correct PIN: execute protected action
      const callback = modalState.onVerifySuccess;
      setModalState({ isOpen: false, actionName: '', onVerifySuccess: () => {}, onCancel: undefined });
      setPinInput('');
      setPinError('');
      setFailedAttempts(0);

      // Execute original protected action
      if (callback) {
        callback();
      }
    } else {
      // Incorrect PIN:
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      const remaining = 3 - newAttempts;

      if (remaining > 0) {
        setPinError(`Incorrect Z-PIN. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
      } else {
        // After 3 failures: terminate silently without any toast notification
        const cancelCallback = modalState.onCancel;
        setModalState({ isOpen: false, actionName: '', onVerifySuccess: () => {}, onCancel: undefined });
        setPinInput('');
        setPinError('');
        setFailedAttempts(0);

        if (cancelCallback) {
          cancelCallback();
        }
      }
    }
  };

  const handleCloseModal = () => {
    const cancelCallback = modalState.onCancel;
    setModalState({ isOpen: false, actionName: '', onVerifySuccess: () => {}, onCancel: undefined });
    setPinInput('');
    setPinError('');
    // Terminate silently without any toast notification
    if (cancelCallback) {
      cancelCallback();
    }
  };

  return (
    <SecurityDemoContext.Provider
      value={{
        investigationMode,
        setInvestigationMode,
        trustedDevice,
        setTrustedDevice,
        isForeignAccount,
        setIsForeignAccount,
        demoZPin,
        setDemoZPin,
        currentAccountEmail,
        setCurrentAccountEmail,
        updateAccountZPin,
        getAccountZPin,
        isVerificationRequired,
        verifyAction,
        resetInvestigationDemo,
        showToast,
        isBannerDismissed,
        dismissBanner
      }}
    >
      {children}

      {/* Floating Toast Stack */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col space-y-2 pointer-events-none max-w-sm w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start justify-between p-3.5 rounded-lg border shadow-lg transition-all animate-in slide-in-from-bottom-2 ${
              toast.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100'
                : toast.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-100'
                : 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100'
            }`}
          >
            <div className="flex items-start space-x-2.5">
              {toast.type === 'success' && (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              )}
              {toast.type === 'error' && (
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              )}
              {toast.type === 'alert' && (
                <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              )}
              <div>
                <h4 className="text-xs font-bold leading-snug">{toast.title}</h4>
                <p className="text-[11.5px] opacity-90 mt-0.5 leading-relaxed">{toast.message}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Part 5: Security Verification Modal */}
      {modalState.isOpen && (
        <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-6 max-w-sm w-full relative">
            {/* Header */}
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  Security Verification
                </h3>
                <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  {investigationMode ? 'Unknown Device Detected' : 'Unverified Account Access'}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 mb-2 leading-relaxed">
              Enter your Z-PIN to continue this protected action
              {modalState.actionName ? (
                <span className="font-semibold text-slate-900 dark:text-white">
                  {' '}({modalState.actionName})
                </span>
              ) : null}.
            </p>

            {currentAccountEmail && (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-4 font-mono truncate">
                Account: {currentAccountEmail}
              </p>
            )}

            {/* Form */}
            <form onSubmit={handleVerifyPin} className="space-y-4">
              <div className="space-y-1.5">
                <div className="relative">
                  <input
                    type="password"
                    inputMode="numeric"
                    autoFocus
                    maxLength={6}
                    value={pinInput}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setPinInput(val);
                      if (pinError) setPinError('');
                    }}
                    placeholder="••••"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-primary font-mono tracking-widest text-center text-lg text-slate-900 dark:text-white"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                {pinError && (
                  <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400 mt-1">
                    {pinError}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-dark text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  Verify Z-PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </SecurityDemoContext.Provider>
  );
};

export const useSecurityDemo = (): SecurityDemoContextType => {
  const context = useContext(SecurityDemoContext);
  if (!context) {
    throw new Error('useSecurityDemo must be used within a SecurityDemoProvider');
  }
  return context;
};

// Helper to validate Z-PIN per Part 3 rules
export const validateZPin = (pin: string, accountPassword?: string): { isValid: boolean; error?: string } => {
  const cleanPin = pin.trim();
  if (cleanPin.length < 4 || cleanPin.length > 6) {
    return { isValid: false, error: 'Choose a stronger Z-PIN (4-6 digits).' };
  }
  if (!/^\d+$/.test(cleanPin)) {
    return { isValid: false, error: 'Z-PIN must contain only numbers.' };
  }
  if (accountPassword && cleanPin === accountPassword) {
    return { isValid: false, error: 'Z-PIN cannot be the same as your account password.' };
  }
  if (WEAK_PINS.includes(cleanPin)) {
    return { isValid: false, error: 'Choose a stronger Z-PIN.' };
  }
  return { isValid: true };
};
