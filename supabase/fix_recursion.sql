-- Remove all existing policies from profiles
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'profiles' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', pol.policyname);
    END LOOP;
END $$;

-- Remove all existing policies from columns
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'columns' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON columns', pol.policyname);
    END LOOP;
END $$;

-- Remove all existing policies from deals
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'deals' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON deals', pol.policyname);
    END LOOP;
END $$;

-- Disable RLS temporarily
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE columns DISABLE ROW LEVEL SECURITY;
ALTER TABLE deals DISABLE ROW LEVEL SECURITY;

-- Simple non-recursive policies
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (true);
CREATE POLICY "profiles_delete" ON profiles FOR DELETE USING (true);

CREATE POLICY "columns_select" ON columns FOR SELECT USING (true);
CREATE POLICY "columns_insert" ON columns FOR INSERT WITH CHECK (true);
CREATE POLICY "columns_update" ON columns FOR UPDATE USING (true);
CREATE POLICY "columns_delete" ON columns FOR DELETE USING (true);

CREATE POLICY "deals_select" ON deals FOR SELECT USING (true);
CREATE POLICY "deals_insert" ON deals FOR INSERT WITH CHECK (true);
CREATE POLICY "deals_update" ON deals FOR UPDATE USING (true);
CREATE POLICY "deals_delete" ON deals FOR DELETE USING (true);

-- Re-enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON profiles TO anon, authenticated;
GRANT ALL ON columns TO anon, authenticated;
GRANT ALL ON deals TO anon, authenticated;
