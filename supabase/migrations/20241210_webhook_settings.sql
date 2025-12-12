-- Create webhook_settings table
CREATE TABLE IF NOT EXISTS webhook_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  webhook_type TEXT NOT NULL CHECK (webhook_type IN ('novofon', 'site', 'email')),
  webhook_url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, webhook_type)
);

-- RLS policies
ALTER TABLE webhook_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own webhooks"
  ON webhook_settings FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR 
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND 'admin' = ANY(profiles.roles)
    )
  );

CREATE POLICY "Users can manage their own webhooks"
  ON webhook_settings FOR ALL
  TO authenticated
  USING (
    auth.uid() = user_id OR 
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND 'admin' = ANY(profiles.roles)
    )
  );

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_webhook_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER webhook_settings_updated_at
  BEFORE UPDATE ON webhook_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_webhook_settings_updated_at();
