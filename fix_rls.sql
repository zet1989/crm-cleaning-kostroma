-- Fix RLS recursion on profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Simple policy: authenticated users can see all profiles
CREATE POLICY "Authenticated can view profiles" ON profiles
FOR SELECT TO authenticated
USING (true);

-- Users can update own profile
CREATE POLICY "Users can update own profile" ON profiles
FOR UPDATE TO authenticated
USING (auth.uid() = id);

-- Admins can update any profile (using auth.jwt to avoid recursion)
CREATE POLICY "Admins can update all profiles" ON profiles
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() 
    AND 'admin' = ANY(p.roles)
  )
);
