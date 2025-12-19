BEGIN;

-- USERS TABLE FIX

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'users'
      AND column_name = 'isActivated'
  ) THEN
    ALTER TABLE users
      ADD COLUMN "isActivated" BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'users'
      AND column_name = 'activatedAt'
  ) THEN
    ALTER TABLE users
      ADD COLUMN "activatedAt" TIMESTAMP;
  END IF;
END $$;

-- USDT WITHDRAWALS TABLE

CREATE TABLE IF NOT EXISTS usdt_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "usdtAmount" NUMERIC(38, 18) NOT NULL,
  "kyatAmount" NUMERIC(38, 18) NOT NULL,
  "tonAddress" TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  "signedAt" TIMESTAMP,
  "executeAfter" TIMESTAMP,
  "tonTxHash" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),

  CONSTRAINT fk_usdt_withdrawals_user
    FOREIGN KEY ("userId")
    REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_usdt_withdrawals_user
  ON usdt_withdrawals("userId");

CREATE INDEX IF NOT EXISTS idx_usdt_withdrawals_status
  ON usdt_withdrawals(status);

COMMIT;


