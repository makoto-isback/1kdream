# Quick Start Guide

## Prerequisites
- Node.js 18+ installed
- PostgreSQL database (or Supabase account)
- Telegram Bot created via @BotFather

## Step 1: Database Setup

### Option A: Local PostgreSQL
```bash
createdb onedream
```

### Option B: Supabase
1. Create account at https://supabase.com
2. Create new project
3. Copy connection string from Settings > Database

## Step 2: Backend Setup

```bash
cd backend
npm install
```

Create `.env` file:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/onedream
JWT_SECRET=change-this-to-random-string-in-production
JWT_EXPIRES_IN=7d
TELEGRAM_BOT_TOKEN=your-bot-token-from-botfather
TON_WALLET_ADDRESS=your-ton-wallet-address
TON_NETWORK=mainnet
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173
```

Start backend:
```bash
npm run start:dev
```

Backend will run on http://localhost:3000

## Step 3: Frontend Setup

```bash
cd frontend
npm install
```

Create `.env` file:
```env
VITE_API_URL=http://localhost:3000
```

Start frontend:
```bash
npm run dev
```

Frontend will run on http://localhost:5173

## Step 4: Telegram Bot Setup

1. Open @BotFather on Telegram
2. Create new bot: `/newbot`
3. Get bot token
4. Set up Mini App: `/newapp`
5. Select your bot
6. Set app title: "1K Dream"
7. Set app URL: Your frontend URL (e.g., https://your-domain.com)
8. Upload app icon (optional)

## Step 5: Create Admin User

Connect to your database and run:
```sql
-- First, login via Telegram to create your user account
-- Then update your user to admin:
UPDATE users SET "isAdmin" = true WHERE "telegramId" = 'your-telegram-id';
```

## Step 6: Test the App

1. Open your Telegram bot
2. Click the Mini App button
3. Login should happen automatically
4. Test features:
   - View balance
   - Place a bet
   - Check deposit/withdrawal flows
   - View history

## Production Deployment

### Backend
1. Set `NODE_ENV=production`
2. Update all environment variables
3. Build: `npm run build`
4. Deploy to server (Heroku, Railway, etc.)
5. Run migrations if needed

### Frontend
1. Build: `npm run build`
2. Deploy `dist/` folder to:
   - Vercel
   - Netlify
   - Cloudflare Pages
   - Or any static hosting

3. Update Telegram Mini App URL in BotFather

## Important Notes

- Lottery runs automatically every hour via cron job
- Deposits require admin confirmation (manual or automated)
- Withdrawals require admin processing
- TON integration needs proper API setup for automatic detection
- Always use HTTPS in production
- Keep JWT_SECRET secure and random

## Troubleshooting

### Database Connection Error
- Check DATABASE_URL format
- Verify database is running
- Check firewall settings

### Telegram Login Not Working
- Verify bot token is correct
- Check Telegram WebApp SDK is loaded
- Ensure frontend URL matches Telegram Mini App URL

### Lottery Not Running
- Check cron job is enabled
- Verify server timezone
- Check logs for errors

### CORS Errors
- Update FRONTEND_URL in backend .env
- Ensure frontend URL matches exactly

