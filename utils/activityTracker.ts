export type UserStatus = 'active' | 'inactive';

export interface UserActivity {
  userId: string;
  email: string;
  lastActivityAt: number;
  status: UserStatus;
}

export const getAllUserActivity = (): Record<string, UserActivity> => ({});
export const recordActivity = (_userId?: string, _email?: string) => {};
export const processInactivity = () => {};
export const getUserActivity = (_userId?: string): UserActivity | null => null;
export const shouldShowInactivityWarning = (_userId?: string): boolean => false;
