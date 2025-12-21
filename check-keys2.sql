SELECT 
  LEFT(transcription_api_key, 5) as trans_prefix,
  LEFT(openrouter_api_key, 5) as openrouter_prefix,
  LENGTH(transcription_api_key) as trans_len,
  LENGTH(openrouter_api_key) as openrouter_len
FROM ai_settings LIMIT 1;
