# Railway Deployment Guide

## Required Environment Variables

The backend **requires** the following environment variables at startup. If any are missing, the application will exit with an error code 1.

### Required Variables

1. **DATABASE_URL** - PostgreSQL connection string
   - Format: `postgresql://user:password@host:port/database`
   - Used by: Database connection (TypeORM)

2. **JWT_SECRET** - Secret key for JWT token signing
   - Used by: Authentication module, JWT guards
   - ⚠️ **Must be changed from default in production**

3. **TON_NETWORK** - TON blockchain network
   - Values: `mainnet` or `testnet`
   - Used by: TON service configuration

4. **HOT_WALLET_ADDRESS** - TON wallet address for receiving deposits
   - Format: TON address string
   - Used by: TON deposit listener

5. **USDT_JETTON_MASTER** - USDT Jetton Master contract address
   - Format: TON contract address
   - Used by: USDT deposit detection

### Optional Variables

- **PORT** - Server port (default: 3000)
- **NODE_ENV** - Environment mode (default: development)
- **FRONTEND_URL** - Frontend URL for CORS (default: http://localhost:5173)
- **TON_API_URL** - TON API endpoint (default: https://tonapi.io/v2)
- **TON_API_KEY** - TON API key (optional, for rate limits)

## Railway Configuration

### ⚠️ Important: Railway Does NOT Read `.env` Files

Railway does **not** automatically read `.env` files from your repository. All environment variables must be set in the Railway dashboard.

### Setting Environment Variables in Railway

1. Go to your Railway project dashboard
2. Select your backend service (`adream-backend`)
3. Click on the **Variables** tab
4. Add each required environment variable:
   - Click **+ New Variable**
   - Enter the variable name (e.g., `DATABASE_URL`)
   - Enter the variable value
   - Click **Add**

### Expected Behavior

If any required environment variables are missing:

- ✅ The application will **exit immediately** with error code 1
- ✅ Railway will detect the crash and restart the service
- ✅ This creates a **crash loop** until all variables are set
- ✅ This is **expected and correct behavior** - the app should not start without required config

### Validation Logic

The validation happens in `src/main.ts` before the NestJS application starts:

```typescript
function validateEnvVars() {
  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'TON_NETWORK',
    'HOT_WALLET_ADDRESS',
    'USDT_JETTON_MASTER',
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    process.exit(1); // Exit if any are missing
  }
}
```

### Troubleshooting

**Problem**: Service keeps crashing on Railway

**Solution**: 
1. Check Railway logs for missing environment variables
2. Verify all 5 required variables are set in Railway → Variables
3. Ensure variable names match exactly (case-sensitive)
4. Check for typos or extra spaces in variable values

**Problem**: Service starts but database connection fails

**Solution**:
1. Verify `DATABASE_URL` is correctly formatted
2. Check Railway PostgreSQL service is running
3. Ensure database credentials are correct

## Development vs Production

- **Development**: Uses `.env` file (loaded via `dotenv.config()`)
- **Production (Railway)**: Uses Railway environment variables only
- The `.env` file is **not** deployed to Railway

## Security Notes

- ✅ Never commit `.env` files to git
- ✅ Use Railway's encrypted environment variables
- ✅ Rotate `JWT_SECRET` regularly in production
- ✅ Use different secrets for staging and production

