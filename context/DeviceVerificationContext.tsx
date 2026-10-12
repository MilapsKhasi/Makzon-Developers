import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase, setDeviceVerifiedSession, syncUserWorkspaceDataToIndexedDB } from '../lib/supabase';
import {
  checkDeviceAuthorization,
  verifyZPinWithServer,
  enrollZPinWithServer,
  RateLimitInfo,
  clearStoredBrowserVerificationKey
} from '../lib/deviceAuth';

interface DeviceVerificationContextType {
  isCheckingDevice: boolean;
  isDeviceVerified: boolean;
  isPinEnrolled: boolean;
  requiresVerification: boolean;
  requiresEnrollment: boolean;
  currentUserId: string | null;
  rateLimit: RateLimitInfo | null;
  verifyPin: (pin: string) => Promise<{ success: boolean; error?: string }>;
  enrollPin: (pin: string, confirmPin: string) => Promise<{ success: boolean; error?: string }>;
  refreshDeviceStatus: () => Promise<void>;
  resetDeviceSession: () => void;
}

const DeviceVerificationContext = createContext<DeviceVerificationContextType | undefined>(undefined);

export const DeviceVerificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isCheckingDevice, setIsCheckingDevice] = useState<boolean>(true);
  const [isDeviceVerified, setIsDeviceVerified] = useState<boolean>(false);
  const [isPinEnrolled, setIsPinEnrolled] = useState<boolean>(true);
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    // If running in offline local mode, bypass cloud device check
    if (typeof window !== 'undefined' && localStorage.getItem('use_offline_mode') === 'true') {
      setIsDeviceVerified(true);
      setDeviceVerifiedSession(true);
      setIsCheckingDevice(false);
      return;
    }

    try {
      const { data } = await supabase.auth.getSession();
      const user = data?.session?.user;

      if (!user) {
        setIsCheckingDevice(false);
        setIsDeviceVerified(false);
        setDeviceVerifiedSession(false);
        setCurrentUserId(null);
        return;
      }

      setCurrentUserId(user.id);
      setIsCheckingDevice(true);

      const result = await checkDeviceAuthorization(user.id);

      if (result.rateLimit) {
        setRateLimit(result.rateLimit);
      }

      setIsPinEnrolled(result.pinEnrolled);

      if (result.deviceVerified) {
        setIsDeviceVerified(true);
        setDeviceVerifiedSession(true);
        // Trigger safe workspace sync only now that device is verified
        syncUserWorkspaceDataToIndexedDB(user.id).catch(() => {});
      } else {
        setIsDeviceVerified(false);
        setDeviceVerifiedSession(false);
      }
    } catch (err) {
      console.error('[DeviceContext] Check status error:', err);
      setIsDeviceVerified(false);
      setDeviceVerifiedSession(false);
    } finally {
      setIsCheckingDevice(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();

    const { data: authListener } = supabase.auth.onAuthStateChange((event: any, session: any) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        checkStatus();
      } else if (event === 'SIGNED_OUT') {
        setIsDeviceVerified(false);
        setDeviceVerifiedSession(false);
        setIsCheckingDevice(false);
        setCurrentUserId(null);
        setRateLimit(null);
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [checkStatus]);

  const verifyPin = async (pin: string): Promise<{ success: boolean; error?: string }> => {
    const res = await verifyZPinWithServer(pin, currentUserId);

    if (res.verified) {
      setIsDeviceVerified(true);
      setDeviceVerifiedSession(true);
      if (currentUserId) {
        syncUserWorkspaceDataToIndexedDB(currentUserId).catch(() => {});
      }
      return { success: true };
    }

    if (res.locked) {
      setRateLimit({
        allowed: false,
        remainingAttempts: 0,
        retryAfterSeconds: res.retryAfterSeconds,
        lockedUntil: res.lockedUntil
      });
    } else if (typeof res.remainingAttempts === 'number') {
      setRateLimit(prev => ({
        allowed: res.remainingAttempts! > 0,
        remainingAttempts: res.remainingAttempts!,
        retryAfterSeconds: res.retryAfterSeconds,
        lockedUntil: res.lockedUntil
      }));
    }

    return { success: false, error: res.error || 'Verification failed' };
  };

  const enrollPin = async (pin: string, confirmPin: string): Promise<{ success: boolean; error?: string }> => {
    const res = await enrollZPinWithServer(pin, confirmPin, currentUserId);

    if (res.success) {
      setIsPinEnrolled(true);
      setIsDeviceVerified(true);
      setDeviceVerifiedSession(true);
      if (currentUserId) {
        syncUserWorkspaceDataToIndexedDB(currentUserId).catch(() => {});
      }
      return { success: true };
    }

    return { success: false, error: res.error || 'Failed to enroll Z-PIN' };
  };

  const resetDeviceSession = () => {
    setIsDeviceVerified(false);
    setDeviceVerifiedSession(false);
    clearStoredBrowserVerificationKey().catch(() => {});
  };

  const requiresEnrollment = Boolean(currentUserId && !isCheckingDevice && !isPinEnrolled);
  const requiresVerification = Boolean(currentUserId && !isCheckingDevice && isPinEnrolled && !isDeviceVerified);

  return (
    <DeviceVerificationContext.Provider
      value={{
        isCheckingDevice,
        isDeviceVerified,
        isPinEnrolled,
        requiresVerification,
        requiresEnrollment,
        currentUserId,
        rateLimit,
        verifyPin,
        enrollPin,
        refreshDeviceStatus: checkStatus,
        resetDeviceSession
      }}
    >
      {children}
    </DeviceVerificationContext.Provider>
  );
};

export const useDeviceVerification = () => {
  const context = useContext(DeviceVerificationContext);
  if (!context) {
    throw new Error('useDeviceVerification must be used within a DeviceVerificationProvider');
  }
  return context;
};
