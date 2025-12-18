# TON Native Coin Deposits

## Overview

TON native coin deposit detection using seed phrase-based wallet initialization. This system automatically detects incoming TON transfers, parses user IDs from transaction memos, and auto-confirms deposits after required block confirmations.

## Features

- **Seed Phrase Wallet**: Derives wallet from 12/24 word mnemonic seed phrase
- **Address Verification**: Validates derived wallet address matches configured address
- **Automatic Detection**: Monitors TON blockchain every 30 seconds for incoming transfers
- **Memo Parsing**: Extracts user ID from transaction comment (format: `deposit:<userId>`)
- **Auto-Confirmation**: Automatically confirms deposits after required block confirmations
- **Idempotent**: Prevents double-crediting using transaction hash
- **Mainnet Only**: Only supports TON mainnet for security

## Configuration

### Required Environment Variables

```env
# Enable TON deposits (must be 'true' to enable)
TON_ENABLE_DEPOSITS=true

# Seed phrase (12 or 24 words, space-separated)
TON_SEED_PHRASE=word1 word2 word3 ... word12

# Wallet address (optional - will be derived from seed phrase if not provided)
TON_WALLET_ADDRESS=EQ...

# Network (must be 'mainnet' for deposits)
TON_NETWORK=mainnet

# TON API configuration
TON_API_URL=https://tonapi.io/v2
TON_API_KEY=your-ton-api-key

# Block confirmations required before auto-confirmation (default: 10)
TON_DEPOSIT_CONFIRMATIONS=10
```

### Security Requirements

1. **Seed Phrase Storage**: 
   - Store seed phrase securely (environment variables, secret manager)
   - Never log or expose seed phrase or private keys
   - Use Railway encrypted variables in production

2. **Network Restriction**:
   - Only works on `mainnet` (testnet disabled for safety)
   - Application will exit if `TON_NETWORK !== 'mainnet'` when deposits enabled

3. **Address Verification**:
   - `TON_WALLET_ADDRESS` should be set to the wallet address derived from seed phrase
   - Seed phrase is validated on startup (must be 12 or 24 words)
   - Wallet address is used for monitoring incoming transfers

## How It Works

### 1. Wallet Initialization

On application startup:
1. Reads `TON_SEED_PHRASE` from environment
2. Validates seed phrase format (12 or 24 words)
3. Derives private key from seed phrase (validates seed phrase is correct)
4. Uses `TON_WALLET_ADDRESS` for monitoring (should match address derived from seed phrase)
5. Initializes wallet for monitoring

### 2. Deposit Detection

Every 30 seconds:
1. Queries TON API for new transactions to wallet address
2. Filters for incoming transfers (where wallet is destination)
3. Parses transaction comment/memo for user ID
4. Creates deposit record with status `PENDING` or `PENDING_MANUAL`

### 3. Transaction Memo Format

Users must include their user ID in the transaction comment:

```
deposit:<userId>
```

Example:
```
deposit:f263f129-8bdf-4e8f-b7fd-d2695af652ea
```

**Note**: If memo is missing or invalid, deposit is created as `PENDING_MANUAL` for admin review.

### 4. Auto-Confirmation

After deposit is detected:
1. System checks block confirmations every check cycle
2. When confirmations >= `TON_DEPOSIT_CONFIRMATIONS`:
   - Automatically confirms deposit
   - Credits user balance in database transaction
   - Updates deposit status to `CONFIRMED`

### 5. Idempotency

- All deposits are tracked by transaction hash
- Duplicate transactions are ignored
- Double-crediting is prevented

## Deposit Flow

```
User sends TON → Transaction with memo "deposit:<userId>"
    ↓
Listener detects (within 30 seconds)
    ↓
Creates Deposit record (status: PENDING)
    ↓
Waits for confirmations (default: 10 blocks)
    ↓
Auto-confirms deposit
    ↓
Credits user balance
```

## Database Integration

Deposits are stored in the `deposits` table:

- `usdtAmount`: TON amount (1 TON ≈ 1 USDT)
- `kyatAmount`: Converted amount (usdtAmount * 5000)
- `tonTxHash`: Transaction hash
- `senderTonAddress`: Sender's TON address
- `status`: `PENDING` → `CONFIRMED` (or `PENDING_MANUAL` if no user ID)
- `userId`: User ID from memo (or null)

## Logging

All TON deposit operations use `[TON DEPOSIT]` prefix:

```
[TON DEPOSIT] Wallet initialized successfully. Address verified: EQ...
[TON DEPOSIT] New TON deposit detected: 1.5 TON (1.5 USDT) from EQ... for user abc-123 (txHash)
[TON DEPOSIT] Created deposit record: deposit-id (status: PENDING)
[TON DEPOSIT] Deposit txHash has 10/10 confirmations. Auto-confirming...
[TON DEPOSIT] Auto-confirmed deposit deposit-id for user abc-123
```

## Error Handling

- **Invalid Seed Phrase**: Application exits with error
- **Address Mismatch**: Application exits with error
- **Network Not Mainnet**: Listener disabled, warning logged
- **API Errors**: Logged, listener continues
- **Transaction Parsing Errors**: Logged, transaction skipped

## Manual Confirmation

If deposit is created as `PENDING_MANUAL` (no user ID in memo), admin can manually confirm:

```http
POST /admin/deposits/:id/confirm
{
  "tonTxHash": "transaction-hash",
  "userId": "user-id"  // Optional: to assign to user
}
```

## Testing

### Test Deposit

1. Get your user ID from database:
   ```sql
   SELECT id FROM users WHERE "telegramId" = 'your-telegram-id';
   ```

2. Send TON to wallet address with memo:
   ```
   deposit:<your-user-id>
   ```

3. Wait up to 30 seconds for detection

4. Check logs for `[TON DEPOSIT]` messages

5. Wait for confirmations (default: 10 blocks)

6. Verify balance credited automatically

## Troubleshooting

**Listener not starting:**
- Check `TON_ENABLE_DEPOSITS=true`
- Verify `TON_NETWORK=mainnet`
- Check seed phrase is valid (12 or 24 words)
- Verify wallet initialization in logs

**Deposits not detected:**
- Check TON API is accessible
- Verify `TON_API_KEY` is valid
- Check wallet address is correct
- Review logs for API errors

**Deposits not auto-confirming:**
- Check `TON_DEPOSIT_CONFIRMATIONS` value
- Verify transaction has enough confirmations
- Check logs for confirmation status

**Address mismatch:**
- Verify `TON_WALLET_ADDRESS` matches derived address
- Or remove `TON_WALLET_ADDRESS` to use derived address

## Security Notes

⚠️ **CRITICAL**: 
- Never commit seed phrase to git
- Never log seed phrase or private keys
- Use secure environment variable storage
- Rotate seed phrase if compromised
- Monitor wallet for unauthorized access

## Related Documentation

- [TON Integration](./TON_INTEGRATION.md) - USDT deposits
- [Railway Deployment](./RAILWAY_DEPLOYMENT.md) - Production setup

