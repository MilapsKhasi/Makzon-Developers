import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import {
  validatePinFormat,
  getRateLimitStatus,
  recordFailedPinAttempt,
  recordSuccessfulPinVerification,
  getUserPinRecord,
  enrollUserPin,
  verifyPinHash,
  encodePinForStorage,
  verifyStoredPin,
  generateDeviceCredential,
  registerDeviceForUser,
  verifyDeviceCredential,
  revokeDevice,
  listUserDevices
} from './server/deviceSecurity.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Initialize Supabase Auth validator
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://blbaolnlzohguwqiyflg.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsYmFvbG5sem9oZ3V3cWl5ZmxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxMjY2ODgsImV4cCI6MjA4MzcwMjY4OH0.nGCG_M3-m2hNnP8Nu0aftZ1Ug0OheU5GmbGNr-Iwxxg';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

app.use(express.json());

// Extend express Request type with user
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

// Authentication Middleware: Validates Supabase JWT from Authorization Bearer header
async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing or malformed Authorization header.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      res.status(401).json({ error: 'Unauthorized: Invalid or expired session token.' });
      return;
    }

    req.user = {
      id: data.user.id,
      email: data.user.email || ''
    };
    next();
  } catch (err: any) {
    res.status(401).json({ error: 'Unauthorized: Token verification failed.' });
  }
}

function getUserSupabase(token: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  });
}

/* ========================================================================== */
/* Device Verification API Routes                                             */
/* ========================================================================== */

// 1. Check Device & PIN Status (Legacy Account Detection)
app.post('/api/auth/device/check', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const token = req.headers.authorization!.split(' ')[1];
    const userClient = getUserSupabase(token);
    const { browser_verification_key } = req.body || {};

    let zPin: string | null = null;
    let profilesFoundInDb = false;

    // 1. Fetch user record from profiles table to check if z_pin is NULL
    try {
      const { data: profile, error: profErr } = await userClient
        .from('profiles')
        .select('z_pin')
        .eq('id', userId)
        .maybeSingle();

      if (!profErr) {
        profilesFoundInDb = true;
        zPin = (profile && profile.z_pin && profile.z_pin.trim().length > 0) ? profile.z_pin.trim() : null;
      }
    } catch (e) {
      console.warn('[Check] Could not read profiles.z_pin from Supabase:', e);
    }

    // Only fallback to local store if Supabase database query failed completely
    if (!profilesFoundInDb && !zPin) {
      const pinRecord = getUserPinRecord(userId);
      if (pinRecord) {
        zPin = `scrypt:${pinRecord.salt}:${pinRecord.pinHash}`;
      }
    }

    // z_pin is NULL -> Legacy account detected!
    const pinEnrolled = Boolean(zPin && zPin.trim().length > 0);
    const isLegacyAccount = !pinEnrolled;

    const rateStatus = getRateLimitStatus(userId);

    let deviceVerified = false;
    let matchedDeviceId: string | undefined = undefined;
    let matchedDeviceName: string | undefined = undefined;

    // If account has Z-PIN and browser supplied key, verify against login_verifications
    if (pinEnrolled && browser_verification_key && typeof browser_verification_key === 'string') {
      const cleanKey = browser_verification_key.trim();
      try {
        const { data: verifications, error: lvErr } = await userClient
          .from('login_verifications')
          .select('id, device_name, expires_at')
          .eq('user_id', userId)
          .eq('browser_verification_key', cleanKey)
          .limit(1);

        if (!lvErr && verifications && verifications.length > 0) {
          const rec = verifications[0];
          const isExpired = rec.expires_at && new Date(rec.expires_at).getTime() < Date.now();
          if (!isExpired) {
            deviceVerified = true;
            matchedDeviceId = rec.id;
            matchedDeviceName = rec.device_name || 'Authorized Browser';
          }
        }
      } catch (e) {
        console.warn('[Check] login_verifications lookup note:', e);
      }

      // Check local store if not found in table
      if (!deviceVerified) {
        const localResult = await verifyDeviceCredential(userId, cleanKey);
        if (localResult.verified) {
          deviceVerified = true;
          matchedDeviceId = localResult.deviceId;
          matchedDeviceName = localResult.deviceName;
        }
      }
    }

    res.json({
      success: true,
      pinEnrolled,
      deviceVerified,
      isLegacyAccount,
      deviceId: matchedDeviceId,
      deviceName: matchedDeviceName,
      rateLimit: rateStatus
    });
  } catch (err: any) {
    console.error('[API /check] Error:', err);
    res.status(500).json({ error: 'Internal server error checking device status.' });
  }
});

// 2. Verify Z-PIN & Register Browser (Cross-Device Security)
app.post('/api/auth/device/verify-pin', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const token = req.headers.authorization!.split(' ')[1];
    const userClient = getUserSupabase(token);
    const { pin, deviceName } = req.body || {};

    // 1. Check rate limit
    const rateStatus = getRateLimitStatus(userId);
    if (!rateStatus.allowed) {
      res.status(429).json({
        verified: false,
        error: `Too many failed attempts. Device verification is temporarily locked. Please wait ${rateStatus.retryAfterSeconds} seconds.`,
        locked: true,
        retryAfterSeconds: rateStatus.retryAfterSeconds,
        lockedUntil: rateStatus.lockedUntil,
        remainingAttempts: 0
      });
      return;
    }

    // 2. Validate PIN format (must be 4 digits)
    const formatCheck = validatePinFormat(pin);
    if (!formatCheck.isValid) {
      const failResult = await recordFailedPinAttempt(userId);
      res.status(400).json({
        verified: false,
        error: 'Incorrect PIN',
        remainingAttempts: failResult.remainingAttempts,
        locked: failResult.locked,
        retryAfterSeconds: failResult.retryAfterSeconds,
        lockedUntil: failResult.lockedUntil
      });
      return;
    }

    // 3. Strictly server-side read of profiles.z_pin
    let storedPin: string | null = null;
    try {
      const { data: profile, error } = await userClient
        .from('profiles')
        .select('z_pin')
        .eq('id', userId)
        .maybeSingle();

      if (!error && profile?.z_pin) {
        storedPin = profile.z_pin;
      }
    } catch (e) {
      console.warn('[Verify] Profiles read note:', e);
    }

    if (!storedPin) {
      const pinRecord = getUserPinRecord(userId);
      if (pinRecord) {
        storedPin = `scrypt:${pinRecord.salt}:${pinRecord.pinHash}`;
      }
    }

    if (!storedPin) {
      res.status(400).json({
        verified: false,
        pinEnrolled: false,
        error: 'No Z-PIN enrolled for this account. Please complete PIN setup first.'
      });
      return;
    }

    // 4. Verify PIN Hash (Timing-safe read-and-compare against profiles.z_pin)
    const isMatch = verifyStoredPin(pin.trim(), storedPin);

    // If incorrect: Reject attempt locally, leaving profiles.z_pin completely untouched!
    if (!isMatch) {
      const failResult = await recordFailedPinAttempt(userId);
      res.status(401).json({
        verified: false,
        error: 'Incorrect PIN',
        remainingAttempts: failResult.remainingAttempts,
        locked: failResult.locked,
        retryAfterSeconds: failResult.retryAfterSeconds,
        lockedUntil: failResult.lockedUntil
      });
      return;
    }

    // 5. Successful Verification: Reset rate limiter
    await recordSuccessfulPinVerification(userId);

    const friendlyName = (typeof deviceName === 'string' && deviceName.trim()) 
      ? deviceName.trim().slice(0, 80) 
      : 'Authorized Browser';

    // Generate new cryptographically secure browser verification key
    const rawVerificationKey = generateDeviceCredential();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Store session in login_verifications table in Supabase
    try {
      await userClient
        .from('login_verifications')
        .insert({
          user_id: userId,
          browser_verification_key: rawVerificationKey,
          device_name: friendlyName,
          created_at: new Date().toISOString(),
          expires_at: expiresAt
        });
    } catch (lvErr) {
      console.warn('[Verify] login_verifications insert note:', lvErr);
    }

    // Also register in local device store
    const { deviceId } = await registerDeviceForUser(userId, friendlyName);

    res.json({
      verified: true,
      browser_verification_key: rawVerificationKey,
      deviceId,
      deviceName: friendlyName
    });
  } catch (err: any) {
    console.error('[API /verify-pin] Error:', err);
    res.status(500).json({ error: 'Internal server error verifying PIN.' });
  }
});

// 3. Enroll Z-PIN for Legacy or New Account
app.post('/api/auth/device/enroll-pin', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const email = req.user!.email;
    const token = req.headers.authorization!.split(' ')[1];
    const userClient = getUserSupabase(token);
    const { pin, confirmPin, deviceName } = req.body || {};

    const formatCheck = validatePinFormat(pin);
    if (!formatCheck.isValid) {
      res.status(400).json({ error: formatCheck.error });
      return;
    }

    if (pin !== confirmPin) {
      res.status(400).json({ error: 'Z-PIN and confirmation PIN do not match.' });
      return;
    }

    const cleanPin = pin.trim();
    const encodedPinRecord = encodePinForStorage(cleanPin);

    // 1. Update profiles table (z_pin column) with the new hashed value and ensure trial dates exist
    try {
      const now = new Date();
      const trialStart = now.toISOString();
      const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();

      // Check existing profile first to determine start date from account creation
      const { data: existingProf } = await userClient
        .from('profiles')
        .select('trial_start, trial_end, created_at, license_type, license_status')
        .eq('id', userId)
        .maybeSingle();

      const finalStart = existingProf?.created_at || existingProf?.trial_start || trialStart;
      const finalEnd = new Date(new Date(finalStart).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();

      const upsertPayload: Record<string, any> = {
        id: userId,
        full_name: (email || '').split('@')[0] || 'User',
        z_pin: encodedPinRecord,
        trial_start: finalStart,
        trial_end: finalEnd,
        license_type: existingProf?.license_type || 'evaluation',
        license_status: new Date(finalEnd).getTime() > Date.now() ? 'active' : 'expired'
      };

      const { error: updErr } = await userClient
        .from('profiles')
        .upsert(upsertPayload, { onConflict: 'id' });

      if (updErr) {
        console.warn('[Enroll] profiles upsert note, trying update:', updErr.message);
        await userClient
          .from('profiles')
          .update(upsertPayload)
          .eq('id', userId);
      }
    } catch (err) {
      console.warn('[Enroll] profiles table update note:', err);
    }

    // Also maintain in local store
    await enrollUserPin(userId, email, cleanPin);

    // 2. Generate browser_verification_key
    const rawVerificationKey = generateDeviceCredential();
    const friendlyName = (typeof deviceName === 'string' && deviceName.trim()) 
      ? deviceName.trim().slice(0, 80) 
      : 'Authorized Browser';

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // 3. Store in login_verifications table
    try {
      await userClient
        .from('login_verifications')
        .insert({
          user_id: userId,
          browser_verification_key: rawVerificationKey,
          device_name: friendlyName,
          created_at: new Date().toISOString(),
          expires_at: expiresAt
        });
    } catch (lvErr) {
      console.warn('[Enroll] login_verifications insert note:', lvErr);
    }

    // Also register in local device store
    const { deviceId } = await registerDeviceForUser(userId, friendlyName);

    res.json({
      success: true,
      browser_verification_key: rawVerificationKey,
      deviceId,
      deviceName: friendlyName
    });
  } catch (err: any) {
    console.error('[API /enroll-pin] Error:', err);
    res.status(500).json({ error: 'Internal server error enrolling Z-PIN.' });
  }
});

// 4. List Registered Devices (For this authenticated user account only)
app.get('/api/auth/device/list', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    let userDevices: Array<{
      id: string;
      deviceName: string;
      createdAt: string;
      lastVerifiedAt: string;
      isRevoked: boolean;
    }> = [];

    // Query Supabase login_verifications using user client with RLS
    if (token) {
      try {
        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: `Bearer ${token}` } }
        });

        const { data: verifs, error: verifErr } = await userClient
          .from('login_verifications')
          .select('id, device_name, created_at, last_verified_at, expires_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (!verifErr && Array.isArray(verifs) && verifs.length > 0) {
          const now = Date.now();
          const validVerifs = verifs.filter((v: any) => {
            if (!v.expires_at) return true;
            return new Date(v.expires_at).getTime() > now;
          });

          userDevices = validVerifs.map((v: any) => ({
            id: v.id,
            deviceName: v.device_name || 'Authorized Browser',
            createdAt: v.created_at || v.last_verified_at || new Date().toISOString(),
            lastVerifiedAt: v.last_verified_at || v.created_at || new Date().toISOString(),
            isRevoked: false
          }));
        }
      } catch (sbErr) {
        console.warn('[API /device/list] Supabase query note:', sbErr);
      }
    }

    // If Supabase had no records, use local store devices strictly filtered by userId
    if (userDevices.length === 0) {
      userDevices = listUserDevices(userId);
    }

    // Deduplicate active entries for the same browser name (keep most recent active session)
    const deduped: typeof userDevices = [];
    const seenActiveNames = new Set<string>();

    for (const d of userDevices) {
      if (!d.isRevoked) {
        if (!seenActiveNames.has(d.deviceName)) {
          seenActiveNames.add(d.deviceName);
          deduped.push(d);
        }
      } else {
        deduped.push(d);
      }
    }

    res.json({ success: true, devices: deduped });
  } catch (err: any) {
    console.error('[API /list] Error:', err);
    res.status(500).json({ error: 'Internal server error listing devices.' });
  }
});

// 5. Revoke Registered Device
app.post('/api/auth/device/revoke', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];
    const { deviceId } = req.body || {};

    if (!deviceId || typeof deviceId !== 'string') {
      res.status(400).json({ error: 'Missing or invalid deviceId parameter.' });
      return;
    }

    // Delete or revoke in Supabase login_verifications
    if (token) {
      try {
        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: `Bearer ${token}` } }
        });
        await userClient
          .from('login_verifications')
          .delete()
          .eq('id', deviceId)
          .eq('user_id', userId);
      } catch (e) {
        console.warn('[API /revoke] Supabase delete note:', e);
      }
    }

    // Also mark as revoked in local store if present
    await revokeDevice(userId, deviceId);

    res.json({ success: true, message: 'Device revoked successfully.' });
  } catch (err: any) {
    console.error('[API /revoke] Error:', err);
    res.status(500).json({ error: 'Internal server error revoking device.' });
  }
});

/* ========================================================================== */
/* Vite Dev Server Middleware or Static Production Serve                       */
/* ========================================================================== */

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ZenterPrime Server] Full-stack application running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[ZenterPrime Server] Startup error:', err);
  process.exit(1);
});
