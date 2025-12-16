# PostgreSQL Setup Guide

## Current Status
- ❌ PostgreSQL: Not installed
- ❌ Homebrew: Not installed  
- ✅ Username: makoto
- ⚠️  .env: Needs DATABASE_URL

## Installation Options

### Option 1: Install Homebrew + PostgreSQL (Recommended)

**Step 1: Install Homebrew**
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

This will:
- Ask for your password (admin access required)
- Install Homebrew to `/opt/homebrew` (Apple Silicon) or `/usr/local` (Intel)

**Step 2: Add Homebrew to PATH**
After installation, run:
```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zshrc
source ~/.zshrc
```

**Step 3: Install PostgreSQL**
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Step 4: Add PostgreSQL to PATH**
```bash
echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

**Step 5: Create Database**
```bash
createdb adream
```

### Option 2: Postgres.app (Easiest - No Terminal)

1. Download: https://postgresapp.com/
2. Install the .app file
3. Open Postgres.app
4. Click "Initialize" to create a server
5. The app includes `psql` - use it from the app's menu

Then create database:
```bash
/Applications/Postgres.app/Contents/Versions/latest/bin/createdb adream
```

### Option 3: Docker (If you have Docker Desktop)

```bash
docker run --name postgres-adream \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=adream \
  -p 5432:5432 \
  -d postgres:16

# Then use:
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/adream
```

## After Installation

### Update .env File

Once PostgreSQL is installed and database is created, your `.env` should have:

**If using Homebrew (default user = makoto):**
```env
DATABASE_URL=postgresql://makoto@localhost:5432/adream
```

**If using Postgres.app or Docker (postgres user):**
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/adream
```

### Start Backend

```bash
cd apps/backend-api
npm run start:dev
```

Expected output:
```
✅ Environment variables validated
🚀 Server running on port 3000
🔧 Development mode: TON listener disabled
```

