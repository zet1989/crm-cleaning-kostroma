-- Очищаем старую расшифровку и обновляем модель транскрипции
UPDATE calls SET transcript = NULL, ai_summary = NULL WHERE id = '8941d13f-d142-4464-981f-e2035e4b3fdc';
UPDATE ai_settings SET transcription_model = 'google/gemini-3-flash-preview';
SELECT id, transcript IS NULL as cleared FROM calls WHERE id = '8941d13f-d142-4464-981f-e2035e4b3fdc';
