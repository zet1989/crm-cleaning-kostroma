-- Fix RLS infinite recursion - remove all policies that reference profiles table
-- Run this once to fix infinite recursion issue: 42P17
-- The problem was policies on profiles table were checking profiles table (recursion!)

-- Create a security definer function to check admin role without RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND 'admin' = ANY(roles)
  );
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Now fix all policies to use this function instead of direct profiles lookup

-- PROFILES table
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

CREATE POLICY "Admins can view all profiles" ON profiles
FOR SELECT USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Admins can update all profiles" ON profiles
FOR UPDATE USING (auth.uid() = id OR public.is_admin());

-- COLUMNS table
DROP POLICY IF EXISTS "Admins can manage columns" ON columns;
CREATE POLICY "Admins can manage columns" ON columns
FOR ALL USING (public.is_admin());

-- EXECUTORS table
DROP POLICY IF EXISTS "Admins can manage executors" ON executors;
CREATE POLICY "Admins can manage executors" ON executors
FOR ALL USING (public.is_admin());

-- DEALS table
DROP POLICY IF EXISTS "Admins can delete deals" ON deals;
CREATE POLICY "Admins can delete deals" ON deals
FOR DELETE USING (public.is_admin());

-- BONUSES table
DROP POLICY IF EXISTS "Admins can manage bonuses" ON bonuses;
CREATE POLICY "Admins can manage bonuses" ON bonuses
FOR ALL USING (public.is_admin());

-- SETTINGS table
DROP POLICY IF EXISTS "settings_admin_all" ON settings;
CREATE POLICY "settings_admin_all" ON settings
FOR ALL USING (public.is_admin());
