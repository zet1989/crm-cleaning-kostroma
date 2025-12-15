-- Create admin profile
INSERT INTO profiles (id, email, full_name, roles) 
SELECT id, email, 'Admin', 'admin' 
FROM auth.users 
WHERE email = 'admin@crm-kostroma.ru'
ON CONFLICT (id) DO UPDATE SET roles = 'admin';

-- Seed initial columns
INSERT INTO columns (id, name, color, position) VALUES
    ('550e8400-e29b-41d4-a716-446655440001', 'Новые', '#6366F1', 0),
    ('550e8400-e29b-41d4-a716-446655440002', 'В работе', '#F59E0B', 1),
    ('550e8400-e29b-41d4-a716-446655440003', 'Выполнено', '#10B981', 2),
    ('550e8400-e29b-41d4-a716-446655440004', 'Отменено', '#EF4444', 3)
ON CONFLICT DO NOTHING;
