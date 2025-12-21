SELECT LEFT(transcription_api_key, 10) as trans_key_prefix, LEFT(openrouter_api_key, 10) as openrouter_prefix FROM ai_settings LIMIT 1;
