-- Создание администратора с телефоном
-- Логин: 79999999999
-- Пароль: admin123

DO $$
DECLARE
  user_id UUID;
  admin_email TEXT := 'admin@crm-kostroma.ru';
  admin_phone TEXT := '+79999999999';
  admin_password TEXT := 'admin123';
BEGIN
  -- Проверяем, есть ли уже пользователь
  SELECT id INTO user_id FROM auth.users WHERE email = admin_email;
  
  IF user_id IS NULL THEN
    -- Генерируем новый UUID
    user_id := gen_random_uuid();
    
    -- Создаём пользователя в auth.users
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
      admin_email,
      crypt(admin_password, gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Администратор"}'::jsonb,
      false,
      'authenticated',
      'authenticated',
      '',
      ''
    );
    
    RAISE NOTICE 'Создан новый пользователь: %', admin_email;
  ELSE
    -- Обновляем пароль существующего пользователя
    UPDATE auth.users 
    SET encrypted_password = crypt(admin_password, gen_salt('bf')),
        updated_at = NOW()
    WHERE id = user_id;
    
    RAISE NOTICE 'Обновлён пароль для: %', admin_email;
  END IF;

  -- Создаём или обновляем профиль
  INSERT INTO profiles (
    id,
    email,
    phone,
    full_name,
    roles,
    can_view_analytics,
    created_at,
    updated_at
  ) VALUES (
    user_id,
    admin_email,
    admin_phone,
    'Администратор',
    ARRAY['admin', 'manager']::user_role[],
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    phone = admin_phone,
    roles = ARRAY['admin', 'manager']::user_role[],
    full_name = 'Администратор',
    can_view_analytics = true,
    updated_at = NOW();

  RAISE NOTICE 'Профиль обновлён. Телефон: %, Роли: admin, manager', admin_phone;
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'ДАННЫЕ ДЛЯ ВХОДА:';
  RAISE NOTICE 'Телефон: 79999999999 (можно с 8 вместо 7)';
  RAISE NOTICE 'Пароль: admin123';
  RAISE NOTICE '===========================================';
  
END $$;
