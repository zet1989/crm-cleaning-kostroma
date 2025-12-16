-- Fix RLS for all tables

-- Executors
DROP POLICY IF EXISTS "Allow all for executors" ON executors;
CREATE POLICY "Allow all for executors" ON executors FOR ALL USING (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON executors TO authenticated;

-- Calls
DROP POLICY IF EXISTS "Allow all for calls" ON calls;
CREATE POLICY "Allow all for calls" ON calls FOR ALL USING (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON calls TO authenticated;

-- AI Settings
DROP POLICY IF EXISTS "Allow all for ai_settings" ON ai_settings;
CREATE POLICY "Allow all for ai_settings" ON ai_settings FOR ALL USING (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_settings TO authenticated;

-- Call Comments
DROP POLICY IF EXISTS "Allow all for call_comments" ON call_comments;
CREATE POLICY "Allow all for call_comments" ON call_comments FOR ALL USING (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON call_comments TO authenticated;

-- Bonuses
DROP POLICY IF EXISTS "Allow all for bonuses" ON bonuses;
CREATE POLICY "Allow all for bonuses" ON bonuses FOR ALL USING (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON bonuses TO authenticated;

-- Notifications
DROP POLICY IF EXISTS "Allow all for notifications" ON notifications;
CREATE POLICY "Allow all for notifications" ON notifications FOR ALL USING (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO authenticated;

-- Deal Managers
DROP POLICY IF EXISTS "Allow all for deal_managers" ON deal_managers;
CREATE POLICY "Allow all for deal_managers" ON deal_managers FOR ALL USING (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON deal_managers TO authenticated;

-- Deal Executors
DROP POLICY IF EXISTS "Allow all for deal_executors" ON deal_executors;
CREATE POLICY "Allow all for deal_executors" ON deal_executors FOR ALL USING (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON deal_executors TO authenticated;

-- Webhook Settings
DROP POLICY IF EXISTS "Allow all for webhook_settings" ON webhook_settings;
CREATE POLICY "Allow all for webhook_settings" ON webhook_settings FOR ALL USING (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON webhook_settings TO authenticated;
