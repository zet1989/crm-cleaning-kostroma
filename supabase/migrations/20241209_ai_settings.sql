-- Create ai_settings table
CREATE TABLE IF NOT EXISTS ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  openrouter_api_key TEXT,
  selected_model TEXT NOT NULL DEFAULT 'openai/gpt-4o-mini',
  temperature DECIMAL(3,2) NOT NULL DEFAULT 0.7,
  auto_process_webhooks BOOLEAN NOT NULL DEFAULT true,
  auto_transcribe_calls BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS policies
ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write ai_settings
CREATE POLICY "Admins can view ai_settings"
  ON ai_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND 'admin' = ANY(profiles.roles)
    )
  );

CREATE POLICY "Admins can update ai_settings"
  ON ai_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND 'admin' = ANY(profiles.roles)
    )
  );

-- Insert default settings
INSERT INTO ai_settings (
  selected_model, 
  temperature, 
  auto_process_webhooks, 
  auto_transcribe_calls
) VALUES (
  'openai/gpt-4o-mini',
  0.7,
  true,
  false
);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_ai_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_settings_updated_at
  BEFORE UPDATE ON ai_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_settings_updated_at();
