SELECT 
  transcription_api_key IS NOT NULL as has_trans_key,
  openrouter_api_key IS NOT NULL as has_openrouter_key,
  transcription_model
FROM ai_settings LIMIT 1;
