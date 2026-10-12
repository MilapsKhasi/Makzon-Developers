import fs from 'fs';
import path from 'path';

export interface UserPinRecord {
  userId: string;
  email: string;
  pinHash: string;
  salt: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegisteredDeviceRecord {
  id: string;
  userId: string;
  credentialHash: string;
  deviceName: string;
  createdAt: string;
  lastVerifiedAt: string;
  isRevoked: boolean;
}

export interface RateLimitRecord {
  userId: string;
  failedAttempts: number;
  lockoutCount: number;
  lockedUntil: string | null;
  lastAttemptAt: string;
}

export interface SecurityStoreData {
  pins: Record<string, UserPinRecord>; // keyed by userId
  devices: Record<string, RegisteredDeviceRecord>; // keyed by device id
  rateLimits: Record<string, RateLimitRecord>; // keyed by userId
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_FILE = path.join(DATA_DIR, 'security_store.json');

let inMemoryStore: SecurityStoreData = {
  pins: {},
  devices: {},
  rateLimits: {}
};

function ensureDirExists() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadSecurityStore(): SecurityStoreData {
  try {
    ensureDirExists();
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf-8');
      inMemoryStore = JSON.parse(raw);
    } else {
      saveSecurityStore(inMemoryStore);
    }
  } catch (err) {
    console.error('[SecurityStore] Error reading store, using in-memory default:', err);
  }
  return inMemoryStore;
}

export function saveSecurityStore(data: SecurityStoreData): void {
  try {
    ensureDirExists();
    inMemoryStore = data;
    // Atomic write via temp file
    const tempFile = `${STORE_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, STORE_FILE);
  } catch (err) {
    console.error('[SecurityStore] Error saving store:', err);
  }
}

export function getStore(): SecurityStoreData {
  return inMemoryStore;
}
