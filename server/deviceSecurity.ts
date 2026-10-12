import crypto from 'crypto';
import { 
  getStore, 
  saveSecurityStore, 
  loadSecurityStore, 
  UserPinRecord, 
  RegisteredDeviceRecord, 
  RateLimitRecord 
} from './store';

// Initialize store on startup
loadSecurityStore();

// Mutex for atomic rate limit and device operations to prevent race conditions
const userLocks = new Map<string, Promise<void>>();

async function withUserLock<T>(userId: string, action: () => Promise<T> | T): Promise<T> {
  let releaseLock: () => void = () => {};
  const lockPromise = new Promise<void>((resolve) => { releaseLock = resolve; });

  const currentLock = userLocks.get(userId) || Promise.resolve();
  userLocks.set(userId, currentLock.then(() => lockPromise));

  try {
    await currentLock;
    return await action();
  } finally {
    releaseLock();
    if (userLocks.get(userId) === lockPromise) {
      userLocks.delete(userId);
    }
  }
}

/**
 * 1. Z-PIN Cryptographic Validation & Hashing
 * Accepts exactly four numeric digits ('0000' - '9999').
 * Uses Node.js crypto.scrypt with N=32768, r=8, p=1 and 32-byte salt.
 */
export function validatePinFormat(pin: string): { isValid: boolean; error?: string } {
  if (typeof pin !== 'string') {
    return { isValid: false, error: 'Z-PIN must be a 4-digit numeric string.' };
  }
  const clean = pin.trim();
  if (!/^\d{4}$/.test(clean)) {
    return { isValid: false, error: 'Z-PIN must contain exactly 4 numeric digits (0-9).' };
  }
  return { isValid: true };
}

export function hashPin(pin: string, existingSalt?: string): { pinHash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(32).toString('hex');
  const derivedKey = crypto.scryptSync(pin, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024
  });
  return { pinHash: derivedKey.toString('hex'), salt };
}

export function verifyPinHash(pin: string, storedHash: string, salt: string): boolean {
  try {
    const { pinHash } = hashPin(pin, salt);
    const hashBuf = Buffer.from(pinHash, 'hex');
    const storedBuf = Buffer.from(storedHash, 'hex');
    if (hashBuf.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(hashBuf, storedBuf);
  } catch {
    return false;
  }
}

/**
 * Formats a 4-digit PIN into a secure representation for database storage (scrypt:<salt>:<hash>)
 */
export function encodePinForStorage(pin: string): string {
  const { pinHash, salt } = hashPin(pin.trim());
  return `scrypt:${salt}:${pinHash}`;
}

/**
 * Verifies an entered PIN against a stored database z_pin record (scrypt:<salt>:<hash> or <salt>:<hash>)
 */
export function verifyStoredPin(pin: string, storedRecord: string | null | undefined): boolean {
  if (!storedRecord || typeof storedRecord !== 'string') return false;
  try {
    const clean = storedRecord.trim();
    const parts = clean.split(':');
    let salt = '';
    let hash = '';
    if (parts.length === 3 && parts[0] === 'scrypt') {
      salt = parts[1];
      hash = parts[2];
    } else if (parts.length === 2) {
      salt = parts[0];
      hash = parts[1];
    } else {
      // Legacy SHA256 fallback comparison
      const sha = crypto.createHash('sha256').update(pin.trim()).digest('hex');
      const shaBuf = Buffer.from(sha, 'hex');
      const recBuf = Buffer.from(clean, 'hex');
      if (shaBuf.length !== recBuf.length) return false;
      return crypto.timingSafeEqual(shaBuf, recBuf);
    }
    return verifyPinHash(pin.trim(), hash, salt);
  } catch {
    return false;
  }
}

/**
 * 2. Device Credential Hashing (SHA-256)
 * Server stores only the cryptographic hash of the credential, never the raw token.
 */
export function generateDeviceCredential(): string {
  // 256-bit cryptographically secure random token
  return crypto.randomBytes(32).toString('hex');
}

export function hashDeviceCredential(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey, 'utf-8').digest('hex');
}

/**
 * 3. Progressive Rate Limiting Policy
 * Max 5 failed attempts per window.
 * Cooldown progression:
 * - 1st Lockout: 5 minutes (300s)
 * - 2nd Lockout: 15 minutes (900s)
 * - 3rd Lockout: 30 minutes (1800s)
 * - 4th+ Lockout: 60 minutes (3600s max delay)
 */
const MAX_FAILED_ATTEMPTS = 5;
const PROGRESSIVE_COOLDOWNS_SEC = [300, 900, 1800, 3600];

export function getRateLimitStatus(userId: string): { 
  allowed: boolean; 
  remainingAttempts: number; 
  retryAfterSeconds?: number;
  lockedUntil?: string;
} {
  const store = getStore();
  const record = store.rateLimits[userId];
  const now = new Date();

  if (!record) {
    return { allowed: true, remainingAttempts: MAX_FAILED_ATTEMPTS };
  }

  if (record.lockedUntil) {
    const lockTime = new Date(record.lockedUntil);
    if (now < lockTime) {
      const remainingSec = Math.ceil((lockTime.getTime() - now.getTime()) / 1000);
      return { 
        allowed: false, 
        remainingAttempts: 0, 
        retryAfterSeconds: remainingSec,
        lockedUntil: record.lockedUntil
      };
    } else {
      // Cooldown expired: reset failed attempts for the new attempt window
      record.failedAttempts = 0;
      record.lockedUntil = null;
      saveSecurityStore(store);
      return { allowed: true, remainingAttempts: MAX_FAILED_ATTEMPTS };
    }
  }

  const remaining = Math.max(0, MAX_FAILED_ATTEMPTS - record.failedAttempts);
  return { allowed: remaining > 0, remainingAttempts: remaining };
}

export async function recordFailedPinAttempt(userId: string): Promise<{
  locked: boolean;
  remainingAttempts: number;
  retryAfterSeconds?: number;
  lockedUntil?: string;
}> {
  return withUserLock(userId, async () => {
    const store = getStore();
    const now = new Date();
    let record = store.rateLimits[userId];

    if (!record) {
      record = {
        userId,
        failedAttempts: 0,
        lockoutCount: 0,
        lockedUntil: null,
        lastAttemptAt: now.toISOString()
      };
      store.rateLimits[userId] = record;
    }

    record.failedAttempts += 1;
    record.lastAttemptAt = now.toISOString();

    if (record.failedAttempts >= MAX_FAILED_ATTEMPTS) {
      const lockoutTier = Math.min(record.lockoutCount, PROGRESSIVE_COOLDOWNS_SEC.length - 1);
      const cooldownSec = PROGRESSIVE_COOLDOWNS_SEC[lockoutTier];
      const lockedUntilDate = new Date(now.getTime() + cooldownSec * 1000);

      record.lockedUntil = lockedUntilDate.toISOString();
      record.lockoutCount += 1;
      saveSecurityStore(store);

      return {
        locked: true,
        remainingAttempts: 0,
        retryAfterSeconds: cooldownSec,
        lockedUntil: record.lockedUntil
      };
    }

    saveSecurityStore(store);
    return {
      locked: false,
      remainingAttempts: MAX_FAILED_ATTEMPTS - record.failedAttempts
    };
  });
}

export async function recordSuccessfulPinVerification(userId: string): Promise<void> {
  return withUserLock(userId, async () => {
    const store = getStore();
    const record = store.rateLimits[userId];
    if (record) {
      record.failedAttempts = 0;
      record.lockedUntil = null;
      // Decay lockout count on successful verification if last lockout was over 2 hours ago
      const lastAttempt = new Date(record.lastAttemptAt).getTime();
      if (Date.now() - lastAttempt > 2 * 3600 * 1000) {
        record.lockoutCount = 0;
      }
      saveSecurityStore(store);
    }
  });
}

/**
 * 4. User PIN Management
 */
export function getUserPinRecord(userId: string): UserPinRecord | null {
  const store = getStore();
  return store.pins[userId] || null;
}

export async function enrollUserPin(userId: string, email: string, pin: string): Promise<{ success: boolean; error?: string }> {
  return withUserLock(userId, async () => {
    const validation = validatePinFormat(pin);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }

    const { pinHash, salt } = hashPin(pin);
    const store = getStore();
    const now = new Date().toISOString();

    store.pins[userId] = {
      userId,
      email: email.toLowerCase().trim(),
      pinHash,
      salt,
      createdAt: now,
      updatedAt: now
    };

    saveSecurityStore(store);
    return { success: true };
  });
}

/**
 * 5. Device Registration & Verification
 */
export async function registerDeviceForUser(
  userId: string, 
  deviceName: string = 'Desktop Browser'
): Promise<{ deviceId: string; rawVerificationKey: string }> {
  return withUserLock(userId, async () => {
    const rawKey = generateDeviceCredential();
    const credHash = hashDeviceCredential(rawKey);
    const deviceId = crypto.randomUUID();
    const now = new Date().toISOString();

    const deviceRecord: RegisteredDeviceRecord = {
      id: deviceId,
      userId,
      credentialHash: credHash,
      deviceName,
      createdAt: now,
      lastVerifiedAt: now,
      isRevoked: false
    };

    const store = getStore();
    // Deactivate previous active device session for the same user with the same browser name to prevent duplicates
    Object.values(store.devices).forEach((d) => {
      if (d.userId === userId && d.deviceName === deviceName && !d.isRevoked) {
        d.isRevoked = true;
      }
    });

    store.devices[deviceId] = deviceRecord;
    saveSecurityStore(store);

    return {
      deviceId,
      rawVerificationKey: rawKey
    };
  });
}

export async function verifyDeviceCredential(
  userId: string, 
  rawVerificationKey: string
): Promise<{ verified: boolean; deviceId?: string; deviceName?: string; reason?: string }> {
  if (!rawVerificationKey || typeof rawVerificationKey !== 'string') {
    return { verified: false, reason: 'Missing device verification credential.' };
  }

  const incomingHash = hashDeviceCredential(rawVerificationKey.trim());
  const store = getStore();

  const userDevices = Object.values(store.devices).filter(
    (d) => d.userId === userId && !d.isRevoked
  );

  const matched = userDevices.find((d) => d.credentialHash === incomingHash);

  if (!matched) {
    return { verified: false, reason: 'Unregistered or revoked device credential.' };
  }

  // Update last verified timestamp
  matched.lastVerifiedAt = new Date().toISOString();
  saveSecurityStore(store);

  return {
    verified: true,
    deviceId: matched.id,
    deviceName: matched.deviceName
  };
}

export async function revokeDevice(userId: string, deviceId: string): Promise<boolean> {
  return withUserLock(userId, async () => {
    const store = getStore();
    const device = store.devices[deviceId];
    if (device && device.userId === userId) {
      device.isRevoked = true;
      saveSecurityStore(store);
      return true;
    }
    return false;
  });
}

export function listUserDevices(userId: string): Array<{
  id: string;
  deviceName: string;
  createdAt: string;
  lastVerifiedAt: string;
  isRevoked: boolean;
}> {
  const store = getStore();
  return Object.values(store.devices)
    .filter((d) => d.userId === userId)
    .sort((a, b) => new Date(b.lastVerifiedAt).getTime() - new Date(a.lastVerifiedAt).getTime())
    .map((d) => ({
      id: d.id,
      deviceName: d.deviceName,
      createdAt: d.createdAt,
      lastVerifiedAt: d.lastVerifiedAt,
      isRevoked: d.isRevoked
    }));
}
