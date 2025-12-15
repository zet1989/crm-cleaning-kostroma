INSERT INTO profiles (email, full_name, roles, password_hash) 
VALUES (
  'admin@crm-kostroma.ru', 
  'Администратор', 
  '{admin}', 
  '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9'
) 
ON CONFLICT (email) DO UPDATE SET 
  password_hash = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
  full_name = 'Администратор',
  roles = '{admin}';
