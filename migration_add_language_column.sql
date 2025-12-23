-- Migration: Add language column to users table
-- Date: 2025-01-XX
-- Description: Adds language preference column for Telegram bot (English/Burmese)

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS language VARCHAR DEFAULT 'en';

-- Update existing users to have default language
UPDATE users 
SET language = 'en' 
WHERE language IS NULL;

