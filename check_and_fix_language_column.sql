-- Check if language column exists
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name = 'language';

-- If column doesn't exist, add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
          AND column_name = 'language'
    ) THEN
        ALTER TABLE users ADD COLUMN language VARCHAR DEFAULT 'en';
        RAISE NOTICE 'Added language column to users table';
    ELSE
        RAISE NOTICE 'Language column already exists';
    END IF;
END $$;

-- Update existing users to have default language if NULL
UPDATE users 
SET language = 'en' 
WHERE language IS NULL OR language = '';

-- Verify the update
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN language = 'en' THEN 1 END) as english_users,
    COUNT(CASE WHEN language = 'my' THEN 1 END) as burmese_users,
    COUNT(CASE WHEN language IS NULL OR language = '' THEN 1 END) as null_users
FROM users;

