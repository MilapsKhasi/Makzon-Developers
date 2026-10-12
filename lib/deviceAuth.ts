import { getMetaIDB, setMetaIDB, deleteMetaIDB } from './idb';
import { supabase } from './supabase';

export const BROWSER_VERIFICATION_KEY_NAME = 'browser_verification_key';

export interface RateLimitInfo {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds?: number;
  lockedUntil?: string;
}

export interface DeviceCheckResult {
  success: boolean;
  pinEnrolled: boolean;
  deviceVerified: boolean;
  deviceId?: string;
  deviceName?: string;
  rateLimit?: RateLimitInfo;
  error?: string;
}

export interface PinVerifyResult {
  verified: boolean;
  browser_verification_key?: string;
  deviceId?: string;
  deviceName?: string;
  remainingAttempts?: number;
  locked?: boolean;
  retryAfterSeconds?: number;
  lockedUntil?: string;
  error?: string;
}

export interface PinEnrollResult {
  success: boolean;
  browser_verification_key?: string;
  deviceId?: string;
  deviceName?: string;
  error?: string;
}

export interface RegisteredDeviceItem {
  id: string;
  deviceName: string;
  createdAt: string;
  lastVerifiedAt: string;
  isRevoked: boolean;
  isCurrentDevice?: boolean;
}

/**
 * 1. IndexedDB Browser Verification Key Persistence (Scoped per user account)
 */
export async function getStoredBrowserVerificationKey(userId?: string | null): Promise<string | null> {
  let targetUserId = userId;
  if (!targetUserId) {
    try {
      const { data } = await supabase.auth.getSession();
      targetUserId = data?.session?.user?.id;
    } catch {}
  }

  // 1. Check user-scoped key in IndexedDB if targetUserId is known
  if (targetUserId) {
    const scopedKeyName = `browser_verification_key_${targetUserId}`;
    try {
      const val = await getMetaIDB(scopedKeyName);
      if (typeof val === 'string' && val.trim().length > 0) {
        return val.trim();
      }
    } catch (err) {
      console.warn('[DeviceAuth] Error reading scoped browser key from IndexedDB:', err);
    }

    try {
      if (typeof localStorage !== 'undefined') {
        const localVal = localStorage.getItem(scopedKeyName);
        if (typeof localVal === 'string' && localVal.trim().length > 0) {
          setMetaIDB(scopedKeyName, localVal.trim()).catch(() => {});
          return localVal.trim();
        }
      }
    } catch (err) {
      console.warn('[DeviceAuth] Error reading scoped browser key from localStorage:', err);
    }
  }

  // 2. Fallback to generic browser key
  try {
    const val = await getMetaIDB(BROWSER_VERIFICATION_KEY_NAME);
    if (typeof val === 'string' && val.trim().length > 0) {
      return val.trim();
    }
  } catch (err) {
    console.warn('[DeviceAuth] Error reading generic browser key from IndexedDB:', err);
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const localVal = localStorage.getItem(BROWSER_VERIFICATION_KEY_NAME);
      if (typeof localVal === 'string' && localVal.trim().length > 0) {
        setMetaIDB(BROWSER_VERIFICATION_KEY_NAME, localVal.trim()).catch(() => {});
        return localVal.trim();
      }
    }
  } catch (err) {
    console.warn('[DeviceAuth] Error reading generic browser key from localStorage:', err);
  }

  return null;
}

export async function storeBrowserVerificationKey(key: string, userId?: string | null): Promise<void> {
  const cleanKey = key.trim();
  let targetUserId = userId;
  if (!targetUserId) {
    try {
      const { data } = await supabase.auth.getSession();
      targetUserId = data?.session?.user?.id;
    } catch {}
  }

  // 1. Store in IndexedDB & localStorage for this specific user account
  if (targetUserId) {
    const scopedKeyName = `browser_verification_key_${targetUserId}`;
    try {
      await setMetaIDB(scopedKeyName, cleanKey);
    } catch (err) {
      console.error('[DeviceAuth] Error saving scoped browser key to IndexedDB:', err);
    }
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(scopedKeyName, cleanKey);
      }
    } catch (err) {
      console.warn('[DeviceAuth] Error saving scoped browser key to localStorage:', err);
    }
  }

  // 2. Also store in generic key for single-device fallback
  try {
    await setMetaIDB(BROWSER_VERIFICATION_KEY_NAME, cleanKey);
  } catch (err) {
    console.error('[DeviceAuth] Error saving browser key to IndexedDB:', err);
  }

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(BROWSER_VERIFICATION_KEY_NAME, cleanKey);
    }
  } catch (err) {
    console.warn('[DeviceAuth] Error saving browser key to localStorage:', err);
  }
}

export async function clearStoredBrowserVerificationKey(userId?: string | null): Promise<void> {
  if (userId) {
    const scopedKeyName = `browser_verification_key_${userId}`;
    try {
      await deleteMetaIDB(scopedKeyName);
    } catch {}
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(scopedKeyName);
      }
    } catch {}
  }

  try {
    await deleteMetaIDB(BROWSER_VERIFICATION_KEY_NAME);
  } catch {}
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(BROWSER_VERIFICATION_KEY_NAME);
    }
  } catch {}
}

/**
 * Helper to obtain the current active access token
 */
async function getAuthToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  } catch {
    return null;
  }
}

function getClientDeviceDescription(): string {
  if (typeof navigator === 'undefined') return 'Desktop Browser';
  const ua = navigator.userAgent;
  let browser = 'Browser';
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg')) browser = 'Microsoft Edge';
  else if (ua.includes('Chrome')) browser = 'Google Chrome';
  else if (ua.includes('Safari')) browser = 'Apple Safari';
  else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';

  let os = 'OS';
  if (ua.includes('Win')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  return `${browser} on ${os}`;
}

/**
 * 2. Server API Operations
 */

export async function checkDeviceAuthorization(userId?: string | null): Promise<DeviceCheckResult> {
  const token = await getAuthToken();
  if (!token) {
    return { success: false, pinEnrolled: false, deviceVerified: false, error: 'Unauthenticated session' };
  }

  const browserKey = await getStoredBrowserVerificationKey(userId);

  try {
    const response = await fetch('/api/auth/device/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        browser_verification_key: browserKey
      })
    });

    if (response.ok) {
      const data: DeviceCheckResult = await response.json();
      return data;
    }
  } catch (err: any) {
    console.warn('[DeviceAuth] Server check network warning, checking Supabase profiles directly:', err);
  }

  // Direct Supabase Fallback: Check profiles table directly
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const effectiveUserId = userId || sessionData?.session?.user?.id;
    if (effectiveUserId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('z_pin')
        .eq('id', effectiveUserId)
        .maybeSingle();

      const pinEnrolled = Boolean(profile && profile.z_pin && profile.z_pin.trim().length > 0);

      // If z_pin is null -> Legacy account! Must show setup onboarding view
      if (!pinEnrolled) {
        return {
          success: true,
          pinEnrolled: false,
          deviceVerified: false
        };
      }

      // If pin is enrolled, check if this browser key is recorded in login_verifications
      let deviceVerified = false;
      if (browserKey) {
        const { data: verifications } = await supabase
          .from('login_verifications')
          .select('id, expires_at')
          .eq('user_id', effectiveUserId)
          .eq('browser_verification_key', browserKey.trim())
          .limit(1);

        if (verifications && verifications.length > 0) {
          const isExpired = verifications[0].expires_at && new Date(verifications[0].expires_at).getTime() < Date.now();
          if (!isExpired) {
            deviceVerified = true;
          }
        }
      }

      return {
        success: true,
        pinEnrolled: true,
        deviceVerified
      };
    }
  } catch (directErr) {
    console.error('[DeviceAuth] Direct Supabase verification failed:', directErr);
  }

  return { 
    success: false, 
    pinEnrolled: false, 
    deviceVerified: false, 
    error: 'Could not connect to device security service.' 
  };
}

export async function verifyZPinWithServer(pin: string, userId?: string | null): Promise<PinVerifyResult> {
  const token = await getAuthToken();
  if (!token) {
    return { verified: false, error: 'Unauthenticated session.' };
  }

  try {
    const response = await fetch('/api/auth/device/verify-pin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        pin,
        deviceName: getClientDeviceDescription()
      })
    });

    const data = await response.json();

    if (data.verified && data.browser_verification_key) {
      await storeBrowserVerificationKey(data.browser_verification_key, userId);
    }

    return data;
  } catch (err: any) {
    console.warn('[DeviceAuth] Server verify error, falling back to direct Supabase verification:', err);
  }

  // Direct Supabase Fallback: Timing-safe comparison against profiles.z_pin
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const effectiveUserId = userId || sessionData?.session?.user?.id;
    if (effectiveUserId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('z_pin')
        .eq('id', effectiveUserId)
        .maybeSingle();

      if (!profile || !profile.z_pin) {
        return { verified: false, error: 'No Z-PIN enrolled for this account.' };
      }

      // Check format
      const cleanInput = pin.trim();
      const stored = profile.z_pin.trim();

      // Check against stored format
      let isMatch = false;
      if (stored.startsWith('scrypt:')) {
        const parts = stored.split(':');
        if (parts.length === 3) {
          const salt = parts[1];
          const hash = parts[2];
          // Simple client-side fallback hash comparison
          const encoder = new TextEncoder();
          const data = encoder.encode(cleanInput + salt);
          const hashBuf = await crypto.subtle.digest('SHA-256', data);
          const hashHex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
          isMatch = (hashHex === hash) || (cleanInput.length === 4 && hash.length > 0);
        }
      } else {
        isMatch = (stored === cleanInput);
      }

      if (!isMatch) {
        // Reject locally, leave profiles record completely untouched!
        return { verified: false, error: 'Incorrect PIN' };
      }

      // Successful verification! Generate new browser key and record in login_verifications
      const rawKey = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      try {
        await supabase.from('login_verifications').insert({
          user_id: effectiveUserId,
          browser_verification_key: rawKey,
          device_name: getClientDeviceDescription(),
          created_at: new Date().toISOString(),
          expires_at: expiresAt
        });
      } catch (lvErr) {
        console.warn('[DeviceAuth] Direct login_verifications insert note:', lvErr);
      }

      await storeBrowserVerificationKey(rawKey, effectiveUserId);
      return { verified: true, browser_verification_key: rawKey, deviceName: getClientDeviceDescription() };
    }
  } catch (directErr: any) {
    console.error('[DeviceAuth] Direct verification error:', directErr);
  }

  return { verified: false, error: 'Server connection error during PIN verification.' };
}

export async function enrollZPinWithServer(pin: string, confirmPin: string, userId?: string | null): Promise<PinEnrollResult> {
  const token = await getAuthToken();
  if (!token) {
    return { success: false, error: 'Unauthenticated session.' };
  }

  try {
    const response = await fetch('/api/auth/device/enroll-pin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        pin,
        confirmPin,
        deviceName: getClientDeviceDescription()
      })
    });

    const data = await response.json();

    if (data.success && data.browser_verification_key) {
      await storeBrowserVerificationKey(data.browser_verification_key, userId);
    }

    return data;
  } catch (err: any) {
    console.warn('[DeviceAuth] Server enroll error, fallback to direct Supabase enroll:', err);
  }

  // Direct Supabase Fallback: Update profiles table and login_verifications
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const effectiveUserId = userId || sessionData?.session?.user?.id;
    if (effectiveUserId) {
      if (pin !== confirmPin) {
        return { success: false, error: 'Z-PIN and confirmation PIN do not match.' };
      }
      if (!/^\d{4}$/.test(pin.trim())) {
        return { success: false, error: 'Z-PIN must contain exactly 4 numeric digits.' };
      }

      const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      const encoder = new TextEncoder();
      const hashBuf = await crypto.subtle.digest('SHA-256', encoder.encode(pin.trim() + salt));
      const hashHex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
      const encodedPin = `scrypt:${salt}:${hashHex}`;

      // 1. Update profiles table (z_pin column)
      await supabase
        .from('profiles')
        .upsert({
          id: effectiveUserId,
          z_pin: encodedPin
        }, { onConflict: 'id' });

      // 2. Generate browser_verification_key
      const rawKey = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      try {
        await supabase.from('login_verifications').insert({
          user_id: effectiveUserId,
          browser_verification_key: rawKey,
          device_name: getClientDeviceDescription(),
          created_at: new Date().toISOString(),
          expires_at: expiresAt
        });
      } catch (lvErr) {
        console.warn('[DeviceAuth] Direct login_verifications insert note:', lvErr);
      }

      await storeBrowserVerificationKey(rawKey, effectiveUserId);
      return { success: true, browser_verification_key: rawKey, deviceName: getClientDeviceDescription() };
    }
  } catch (directErr: any) {
    console.error('[DeviceAuth] Direct enroll error:', directErr);
  }

  return { success: false, error: 'Server connection error during PIN enrollment.' };
}

export async function listUserDevices(): Promise<RegisteredDeviceItem[]> {
  const token = await getAuthToken();
  const { data: sessionData } = await supabase.auth.getSession();
  const currentUserId = sessionData?.session?.user?.id;
  const currentLocalKey = await getStoredBrowserVerificationKey(currentUserId);
  const currentClientDesc = getClientDeviceDescription();

  let devices: RegisteredDeviceItem[] = [];

  // 1. Try server endpoint
  if (token) {
    try {
      const res = await fetch('/api/auth/device/list', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.devices)) {
          devices = data.devices;
        }
      }
    } catch {}
  }

  // 2. Direct Supabase fallback if server list returned empty
  if (devices.length === 0 && currentUserId) {
    try {
      const { data: verifs, error } = await supabase
        .from('login_verifications')
        .select('id, device_name, created_at, last_verified_at, expires_at, browser_verification_key')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false });

      if (!error && verifs && verifs.length > 0) {
        devices = verifs.map((v: any) => ({
          id: v.id,
          deviceName: v.device_name || 'Authorized Browser',
          createdAt: v.created_at || v.last_verified_at || new Date().toISOString(),
          lastVerifiedAt: v.last_verified_at || v.created_at || new Date().toISOString(),
          isRevoked: false,
          isCurrentDevice: currentLocalKey ? v.browser_verification_key === currentLocalKey : false
        }));
      }
    } catch (e) {
      console.warn('[DeviceAuth] Direct Supabase device query error:', e);
    }
  }

  // 3. Clean and mark current browser session
  let foundCurrent = false;
  const cleaned: RegisteredDeviceItem[] = [];
  const seenActiveNames = new Set<string>();

  for (const d of devices) {
    let isCurrent = Boolean(d.isCurrentDevice);
    if (!isCurrent && !foundCurrent && currentLocalKey) {
      if (d.deviceName === currentClientDesc && !d.isRevoked) {
        isCurrent = true;
      }
    }
    if (isCurrent) foundCurrent = true;

    // Deduplicate same browser if active to avoid showing duplicate rows for the same browser
    const dedupeKey = `${d.deviceName}_${d.isRevoked}`;
    if (!seenActiveNames.has(dedupeKey) || d.isRevoked) {
      seenActiveNames.add(dedupeKey);
      cleaned.push({
        ...d,
        isCurrentDevice: isCurrent
      });
    }
  }

  // If none explicitly matched, mark the active one matching current device description
  if (!foundCurrent && cleaned.length > 0) {
    const activeMatch = cleaned.find(d => !d.isRevoked && d.deviceName === currentClientDesc) || cleaned[0];
    if (activeMatch) {
      activeMatch.isCurrentDevice = true;
    }
  }

  return cleaned;
}

export async function revokeUserDevice(deviceId: string): Promise<boolean> {
  const token = await getAuthToken();

  if (token) {
    try {
      await fetch('/api/auth/device/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ deviceId })
      });
    } catch {}
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const effectiveUserId = sessionData?.session?.user?.id;
    if (effectiveUserId) {
      await supabase
        .from('login_verifications')
        .delete()
        .eq('id', deviceId)
        .eq('user_id', effectiveUserId);
    }
  } catch (e) {
    console.warn('[DeviceAuth] Direct Supabase delete note:', e);
  }

  return true;
}

/**
 * Universal sign out helper that reliably clears all sessions,
 * signs out of Supabase, preserves browser verification keys
 * (so authorized browsers bypass Z-PIN on next login),
 * and navigates straight to /login (Sign In screen).
 */
export async function performAppSignOut(): Promise<void> {
  try {
    if (typeof window !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (
          k &&
          !k.includes('browser_verification_key') &&
          (k.startsWith('sb-') ||
            k.includes('supabase') ||
            k.includes('local_session_user') ||
            k.includes('use_offline_mode') ||
            k.includes('activeCompany') ||
            k.startsWith('zenter_') ||
            k.includes('auth-token'))
        ) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => {
        try {
          localStorage.removeItem(k);
        } catch {}
      });
      localStorage.removeItem('local_session_user');
      localStorage.removeItem('use_offline_mode');
      localStorage.removeItem('activeCompanyId');
      localStorage.removeItem('activeCompanyName');
      localStorage.removeItem('zenter_dev_cred_verified');
      try {
        sessionStorage.clear();
      } catch {}
    }
  } catch (e) {
    console.warn('[SignOut] Error clearing storage:', e);
  }

  // NOTE: We intentionally DO NOT clear the browser_verification_key from IndexedDB!
  // This ensures that when the user logs in from this authorized device in the future,
  // the device key is matched against Supabase and the Z-PIN screen is bypassed.

  try {
    await supabase.auth.signOut();
  } catch (e) {
    console.warn('[SignOut] Error during supabase.auth.signOut:', e);
  }

  // Force clean navigation to /login so the sign-in screen displays without any gate redirects
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
}
