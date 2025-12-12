-- Add source column to deals table
ALTER TABLE deals ADD COLUMN IF NOT EXISTS source VARCHAR(50);
