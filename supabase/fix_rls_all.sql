-- Check RLS status
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Disable RLS temporarily for testing
ALTER TABLE columns DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE deals DISABLE ROW LEVEL SECURITY;

-- Add permissive policies for authenticated users
DROP POLICY IF EXISTS "Allow all for columns" ON columns;
CREATE POLICY "Allow all for columns" ON columns FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all for profiles" ON profiles;
CREATE POLICY "Allow all for profiles" ON profiles FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all for deals" ON deals;
CREATE POLICY "Allow all for deals" ON deals FOR ALL USING (true);

-- Re-enable RLS
ALTER TABLE columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

-- Grant access to authenticated and anon roles
GRANT SELECT ON columns TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON deals TO authenticated;
