-- Даём права администратора пользователю aleksey.zyryanov.nn@gmail.com
UPDATE profiles 
SET 
  roles = ARRAY['admin', 'manager']::user_role[],
  can_view_analytics = true,
  salary_percent = 10.00
WHERE email = 'aleksey.zyryanov.nn@gmail.com';

-- Проверка
SELECT id, email, roles, can_view_analytics FROM profiles WHERE email = 'aleksey.zyryanov.nn@gmail.com';
