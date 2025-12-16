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

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  const isDev = process.env.NODE_ENV === 'development';
  
  await app.listen(port);
  console.log(`🚀 Server running on port ${port}`);
  
  if (isDev) {
    console.log(`🔧 Development mode: TON listener disabled`);
    console.log(`📝 Use admin endpoints to manually confirm deposits`);
  } else {
    console.log(`📡 USDT deposit listener will start automatically`);
  }
}

bootstrap();

