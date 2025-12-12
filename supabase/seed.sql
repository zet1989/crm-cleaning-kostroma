-- Seed данные для локальной разработки

-- Создаём колонки канбана (если нет)
INSERT INTO columns (id, name, position, color, is_success) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Новые', 0, '#6b7280', false),
    ('22222222-2222-2222-2222-222222222222', 'В работе', 1, '#3b82f6', false),
    ('33333333-3333-3333-3333-333333333333', 'Выполнено', 2, '#f97316', false),
    ('44444444-4444-4444-4444-444444444444', 'Оплачено', 3, '#22c55e', true)
ON CONFLICT (id) DO NOTHING;

-- Добавим тестовых исполнителей
INSERT INTO executors (name, phone, is_active) VALUES
    ('Иван Петров', '+7 999 111-11-11', true),
    ('Мария Сидорова', '+7 999 222-22-22', true),
    ('Алексей Козлов', '+7 999 333-33-33', true)
ON CONFLICT DO NOTHING;

-- Создаём тестового пользователя с правами админа
-- Сначала создаём auth user (id будет создан триггером для profiles)
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
  role
)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '00000000-0000-0000-0000-000000000000',
  'admin@test.com',
  crypt('test123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  false,
  'authenticated',
  'authenticated'
)
ON CONFLICT (id) DO NOTHING;

-- Даём права админа (профиль создаётся триггером)
UPDATE profiles SET roles = '{admin}' WHERE email = 'admin@test.com';
