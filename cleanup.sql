DELETE FROM profiles WHERE id NOT IN (SELECT id FROM auth.users);
