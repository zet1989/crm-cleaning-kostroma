-- Создание колонки "Новые" если её нет
INSERT INTO columns (id, name, position, color, is_success) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Новые', 0, '#6b7280', false)
ON CONFLICT (id) DO NOTHING;
