# Quick Setup Instructions

## What I've Prepared For You

I've created a setup script that will:
1. Check if PostgreSQL is installed
2. Install it via Homebrew if needed
3. Create the `adream` database
4. Update your `.env` file with the correct DATABASE_URL

## How to Run

### Step 1: Install Homebrew (One-time setup)

Since Homebrew requires admin access, you need to run this manually:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

This will:
- Ask for your password
- Install Homebrew (takes 5-10 minutes)

### Step 2: Run the Setup Script

After Homebrew is installed, run:

```bash
./setup-postgres.sh
```

This script will:
- ✅ Install PostgreSQL
- ✅ Start PostgreSQL service
- ✅ Create `adream` database
- ✅ Update `.env` file with: `DATABASE_URL=postgresql://makoto@localhost:5432/adream`

### Step 3: Start Backend

```bash
cd apps/backend-api
npm run start:dev
```

You should see:
```
✅ Environment variables validated
🚀 Server running on port 3000
🔧 Development mode: TON listener disabled
```

## Alternative: Manual Setup

If you prefer not to use Homebrew, see `SETUP_POSTGRES.md` for:
- Postgres.app installation (GUI, no terminal)
- Docker setup
- Manual installation steps

## Current Status

- ✅ Setup script created: `setup-postgres.sh`
- ✅ Username detected: `makoto`
- ⚠️  Homebrew: Needs manual installation (requires password)
- ⚠️  PostgreSQL: Will be installed by script
- ⚠️  Database: Will be created by script
- ⚠️  .env: Will be updated by script

---

**Once you install Homebrew and run the script, everything will be ready!**

