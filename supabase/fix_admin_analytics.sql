-- Обновляем can_view_analytics для админов
UPDATE profiles 
SET can_view_analytics = true 
WHERE 'admin' = ANY(roles);
