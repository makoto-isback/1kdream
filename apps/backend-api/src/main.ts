import * as dotenv from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

// Load environment variables from .env before validation
// NOTE: In production (Railway), .env files are NOT used.
// All environment variables must be set in Railway → Service → Variables
dotenv.config();

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
    console.error('\n💡 Copy .env.example to .env and fill in the values');
    console.error('💡 On Railway: Set variables in Service → Variables (Railway does NOT read .env files)');
    process.exit(1);
  }

  // Validate TON deposit configuration if enabled
  const tonDepositsEnabled = process.env.TON_ENABLE_DEPOSITS === 'true';
  if (tonDepositsEnabled) {
    const network = process.env.TON_NETWORK || 'mainnet';
    if (network !== 'mainnet') {
      console.error('❌ TON deposits only supported on mainnet. Current network:', network);
      process.exit(1);
    }

    const seedPhrase = process.env.TON_SEED_PHRASE;
    const walletAddress = process.env.TON_WALLET_ADDRESS;

    if (!seedPhrase) {
      console.error('❌ TON_ENABLE_DEPOSITS=true requires TON_SEED_PHRASE');
      console.error('   TON_SEED_PHRASE should be 12 or 24 words (space-separated)');
      process.exit(1);
    }

    // Validate seed phrase format (12 or 24 words)
    const words = seedPhrase.trim().split(/\s+/);
    if (words.length !== 12 && words.length !== 24) {
      console.error(`❌ Invalid TON_SEED_PHRASE: ${words.length} words (expected 12 or 24)`);
      process.exit(1);
    }

    if (!walletAddress) {
      console.warn('⚠️  TON_WALLET_ADDRESS not set. Will derive from seed phrase.');
    } else {
      console.log('✅ TON deposit configuration validated');
      console.log('   - TON_SEED_PHRASE: Provided');
      console.log('   - TON_WALLET_ADDRESS: Will be verified against derived address');
    }
  }

  // Warn if JWT_SECRET is default
  if (process.env.JWT_SECRET === 'your-super-secret-jwt-key-change-this-in-production') {
    console.warn('⚠️  WARNING: Using default JWT_SECRET. Change it in production!');
  }

  console.log('✅ Environment variables validated');
}

async function bootstrap() {
  // Validate environment variables before starting
  validateEnvVars();

  const app = await NestFactory.create(AppModule);
  
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  // CORS configuration: Allow all origins (safe for Telegram Mini App with JWT auth)
  app.enableCors({
    origin: true,
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  const isDev = process.env.NODE_ENV === 'development';
  const databaseSync = process.env.DATABASE_SYNC === 'true';
  
  // Warn if DATABASE_SYNC is enabled in production
  if (!isDev && databaseSync) {
    console.warn('⚠️  WARNING: DATABASE_SYNC=true is enabled in production!');
    console.warn('⚠️  This should only be used for initial schema creation.');
    console.warn('⚠️  After first deploy, set DATABASE_SYNC=false and use migrations instead.');
  }
  
  await app.listen(port);
  console.log(`🚀 Server running on port ${port}`);
  
  if (isDev) {
    console.log(`🔧 Development mode: TON listener disabled`);
    console.log(`📝 Use admin endpoints to manually confirm deposits`);
  } else {
    console.log(`📡 USDT deposit listener will start automatically`);
    
    const tonDepositsEnabled = process.env.TON_ENABLE_DEPOSITS === 'true';
    if (tonDepositsEnabled) {
      console.log(`💰 TON deposit listener will start automatically`);
      console.log(`   - Confirmations required: ${process.env.TON_DEPOSIT_CONFIRMATIONS || '10'}`);
    }
  }
}

bootstrap();

