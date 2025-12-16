#!/bin/bash

# PostgreSQL Setup Script for ADream
# This script will help you install PostgreSQL and set up the database

set -e

echo "🔍 Checking current setup..."

# Check if PostgreSQL is installed
if command -v psql &> /dev/null; then
    echo "✅ PostgreSQL is already installed"
    psql --version
else
    echo "❌ PostgreSQL not found"
    
    # Check if Homebrew is installed
    if command -v brew &> /dev/null; then
        echo "✅ Homebrew is installed"
        echo "📦 Installing PostgreSQL..."
        brew install postgresql@16
        brew services start postgresql@16
        
        # Add to PATH
        if [[ "$SHELL" == *"zsh"* ]]; then
            echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc
            export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
        fi
        
        echo "✅ PostgreSQL installed and started"
    else
        echo "❌ Homebrew not found"
        echo ""
        echo "Please install Homebrew first:"
        echo "  /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        echo ""
        echo "Then run this script again."
        exit 1
    fi
fi

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 3

# Check if database exists
if psql -lqt | cut -d \| -f 1 | grep -qw adream; then
    echo "✅ Database 'adream' already exists"
else
    echo "📝 Creating database 'adream'..."
    createdb adream || createdb -U $(whoami) adream
    echo "✅ Database 'adream' created"
fi

# Update .env file
ENV_FILE="apps/backend-api/.env"
USERNAME=$(whoami)

echo "📝 Updating .env file..."

# Check if DATABASE_URL exists
if grep -q "DATABASE_URL" "$ENV_FILE" 2>/dev/null; then
    # Update existing DATABASE_URL
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|DATABASE_URL=.*|DATABASE_URL=postgresql://${USERNAME}@localhost:5432/adream|" "$ENV_FILE"
    else
        sed -i "s|DATABASE_URL=.*|DATABASE_URL=postgresql://${USERNAME}@localhost:5432/adream|" "$ENV_FILE"
    fi
    echo "✅ Updated DATABASE_URL in .env"
else
    # Add DATABASE_URL if it doesn't exist
    echo "" >> "$ENV_FILE"
    echo "DATABASE_URL=postgresql://${USERNAME}@localhost:5432/adream" >> "$ENV_FILE"
    echo "✅ Added DATABASE_URL to .env"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Start the backend: cd apps/backend-api && npm run start:dev"
echo "  2. Open frontend: http://localhost:5173"
echo ""

