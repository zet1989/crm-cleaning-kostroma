-- Создание тестового администратора
DO $$
DECLARE
  user_id UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
BEGIN
  -- Удаляем старого если есть
  DELETE FROM auth.users WHERE email = 'admin@test.com';
  
  -- Создаём пользователя
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    aud,
    role,
    confirmation_token,
    recovery_token
  ) VALUES (
    user_id,
    '00000000-0000-0000-0000-000000000000',
    'admin@test.com',
    crypt('test123', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Admin User"}'::jsonb,
    false,
    'authenticated',
    'authenticated',
    '',
    ''
  );

  -- Профиль создастся автоматически триггером, обновим его
  UPDATE profiles 
  SET 
    roles = ARRAY['admin', 'manager']::user_role[],
    full_name = 'Admin User',
    can_view_analytics = true
  WHERE id = user_id;

  RAISE NOTICE 'User created: admin@test.com / test123';
END $$;
