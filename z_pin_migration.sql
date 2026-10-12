-- ============================================================================
-- ZenterPrime Z-PIN & Legacy Account Migration Setup for Supabase
-- ============================================================================
-- Run this script in your Supabase SQL Editor (Dashboard > SQL Editor > New query).
-- This script is completely safe and idempotent (can be run multiple times).

-- 1. Ensure public.profiles table exists with z_pin support
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active_company_id uuid,
  full_name text,
  trial_start timestamptz DEFAULT now(),
  trial_end timestamptz DEFAULT (now() + interval '14 days'),
  license_type text DEFAULT 'evaluation',
  license_status text DEFAULT 'active',
  z_pin text DEFAULT NULL,
  created_at timestamptz DEFAULT now()
);

-- Ensure required columns exist on an existing profiles table without erroring
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS z_pin text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS license_status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS license_type text DEFAULT 'evaluation',
ADD COLUMN IF NOT EXISTS full_name text DEFAULT NULL;

-- 2. Ensure public.login_verifications table exists for browser session verification
CREATE TABLE IF NOT EXISTS public.login_verifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  browser_verification_key text DEFAULT NULL,
  device_name text DEFAULT 'Browser Session',
  last_verified_at timestamptz DEFAULT now(),
  otp text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '30 days')
);

-- Ensure browser verification columns exist on existing login_verifications table
ALTER TABLE public.login_verifications 
ADD COLUMN IF NOT EXISTS browser_verification_key text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS device_name text DEFAULT 'Browser Session',
ADD COLUMN IF NOT EXISTS last_verified_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT (now() + interval '30 days');

-- 3. High-performance Indexes for instant lookup during login & device checks
CREATE INDEX IF NOT EXISTS idx_profiles_z_pin 
ON public.profiles(id, z_pin);

CREATE INDEX IF NOT EXISTS idx_login_verifications_user_key 
ON public.login_verifications(user_id, browser_verification_key);

CREATE INDEX IF NOT EXISTS idx_login_verifications_expires_at 
ON public.login_verifications(expires_at);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_verifications ENABLE ROW LEVEL SECURITY;

-- 5. Strict RLS Policies for Profiles (Only authenticated user can access their own profile)
DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;
CREATE POLICY "Users can manage own profile" 
ON public.profiles FOR ALL TO authenticated 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 6. Strict RLS Policies for Login Verifications (Only authenticated user can access their own verifications)
DROP POLICY IF EXISTS "Users can manage own verifications" ON public.login_verifications;
CREATE POLICY "Users can manage own verifications" 
ON public.login_verifications FOR ALL TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 7. Verification Query: Confirm existing profiles status
-- Accounts where has_z_pin is FALSE will smoothly receive the "Set Up Your Z-PIN" screen on login.
SELECT id, (z_pin IS NOT NULL) AS has_z_pin 
FROM public.profiles 
LIMIT 10;
