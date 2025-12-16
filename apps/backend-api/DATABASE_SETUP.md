# Database Setup Guide

## Prerequisites

- PostgreSQL installed locally (version 12+)
- `psql` command-line tool available

## Quick Start

### 1. Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE adream;

# Exit psql
\q
```

Or using command line:
```bash
createdb -U postgres adream
```

### 2. Configure Environment

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Update `DATABASE_URL` in `.env`:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/adream
```

Replace `postgres:postgres` with your PostgreSQL username and password.

### 3. Run Migrations

The backend uses TypeORM with `synchronize: true` in development mode, which automatically creates/updates tables.

**For Production:**
- Set `NODE_ENV=production` in `.env`
- Use TypeORM migrations (see below)

### 4. Verify Connection

Start the backend:
```bash
npm run start:dev
```

Check logs for:
```
✅ Environment variables validated
🚀 Server running on port 3000
```

If you see database connection errors, verify:
- PostgreSQL is running: `pg_isready`
- Database exists: `psql -U postgres -l | grep adream`
- Connection string is correct in `.env`

## Reset Database (Testing)

### Option 1: Drop and Recreate

```bash
# Drop database
dropdb -U postgres adream

# Recreate
createdb -U postgres adream

# Restart backend (will auto-create tables)
npm run start:dev
```

### Option 2: Using psql

```bash
psql -U postgres -c "DROP DATABASE IF EXISTS adream;"
psql -U postgres -c "CREATE DATABASE adream;"
```

## TypeORM Migrations (Production)

### Generate Migration

```bash
npm run migration:generate -- -n MigrationName
```

### Run Migrations

```bash
npm run migration:run
```

### Revert Migration

```bash
npm run migration:revert
```

## Troubleshooting

### Connection Refused

- Check PostgreSQL is running: `pg_isready`
- Verify port (default: 5432)
- Check firewall settings

### Authentication Failed

- Verify username/password in `DATABASE_URL`
- Check `pg_hba.conf` for authentication method

### Database Does Not Exist

- Create database: `createdb -U postgres adream`
- Verify: `psql -U postgres -l | grep adream`

### Permission Denied

- Ensure user has CREATE DATABASE privilege
- Or create database as superuser, then grant privileges

## Common Commands

```bash
# Connect to database
psql -U postgres -d adream

# List all tables
\dt

# Describe table
\d users

# View table data
SELECT * FROM users LIMIT 10;

# Exit psql
\q
```

