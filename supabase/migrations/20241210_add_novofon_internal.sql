-- Добавление поля для внутреннего номера Novofon к профилям менеджеров
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS novofon_internal VARCHAR(10);

-- Индекс для быстрого поиска по внутреннему номеру
CREATE INDEX IF NOT EXISTS idx_profiles_novofon_internal ON profiles(novofon_internal);

-- Комментарий
COMMENT ON COLUMN profiles.novofon_internal IS 'Внутренний номер Novofon для привязки входящих звонков к менеджеру';

-- Добавление метаданных для звонков в сделках
ALTER TABLE deals ADD COLUMN IF NOT EXISTS call_duration INTEGER;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS call_recording_url TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Индекс для поиска по метаданным
CREATE INDEX IF NOT EXISTS idx_deals_metadata ON deals USING gin(metadata);

-- Комментарии
COMMENT ON COLUMN deals.call_duration IS 'Длительность звонка в секундах';
COMMENT ON COLUMN deals.call_recording_url IS 'URL записи звонка';
COMMENT ON COLUMN deals.metadata IS 'Дополнительные данные (ID звонка, транскрипция и т.д.)';
