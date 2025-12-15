-- Простая система аутентификации
-- Добавляем поле password_hash в таблицу profiles

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Функция для проверки пароля (будет использоваться из Next.js API)
-- Пароли хешируются с помощью bcrypt на стороне сервера

-- Создаем индекс для быстрого поиска по email
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Обновляем комментарии
COMMENT ON COLUMN profiles.password_hash IS 'Bcrypt hash пароля пользователя';
