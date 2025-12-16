-- Добавляем поле phone в profiles если его нет
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT UNIQUE;

-- Создаём индекс для быстрого поиска по телефону
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);

-- Обновляем телефон админа
UPDATE profiles 
SET phone = '+79999999999' 
WHERE email = 'admin@crm-kostroma.ru';
