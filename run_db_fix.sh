#!/bin/bash

# Script to check and fix language column in Railway database
# Usage: ./run_db_fix.sh "your_railway_database_url"

if [ -z "$1" ]; then
    echo "Usage: ./run_db_fix.sh \"postgresql://user:pass@host:port/dbname\""
    echo ""
    echo "Or set DATABASE_URL environment variable:"
    echo "export DATABASE_URL=\"postgresql://user:pass@host:port/dbname\""
    echo "./run_db_fix.sh"
    exit 1
fi

DATABASE_URL="${1:-$DATABASE_URL}"

if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL not provided"
    exit 1
fi

echo "🔍 Checking database connection..."
psql "$DATABASE_URL" -c "SELECT version();" > /dev/null 2>&1

if [ $? -ne 0 ]; then
    echo "❌ Failed to connect to database. Please check your DATABASE_URL"
    exit 1
fi

echo "✅ Connected to database"
echo ""
echo "🔍 Checking if language column exists..."
psql "$DATABASE_URL" -c "\d users" | grep -q "language"

if [ $? -eq 0 ]; then
    echo "✅ Language column exists"
else
    echo "⚠️  Language column not found. Adding it..."
fi

echo ""
echo "🔧 Running migration script..."
psql "$DATABASE_URL" -f check_and_fix_language_column.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration completed successfully!"
    echo ""
    echo "📊 Current user language distribution:"
    psql "$DATABASE_URL" -c "SELECT COUNT(*) as total, COUNT(CASE WHEN language = 'en' THEN 1 END) as english, COUNT(CASE WHEN language = 'my' THEN 1 END) as burmese FROM users;"
else
    echo "❌ Migration failed. Please check the error above."
    exit 1
fi

