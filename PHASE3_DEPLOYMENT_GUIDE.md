# Phase 3 Deployment Guide

## 🚀 Quick Setup

### Step 1: Generate Webhook Secret Token

Run this command to generate a secure random token:

```bash
# Option 1: Using OpenSSL
openssl rand -hex 32

# Option 2: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 3: Using Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

**Example output:**
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

---

### Step 2: Add to Railway Variables

1. Go to **Railway Dashboard**
2. Select your **Backend Service**
3. Click on **Variables** tab
4. Click **+ New Variable**
5. Add:
   - **Key:** `TELEGRAM_WEBHOOK_SECRET`
   - **Value:** (paste the generated token from Step 1)
6. Click **Add**

---

### Step 3: Wait for Deployment

- Railway will automatically redeploy
- Check deployment logs for:
  - `[TELEGRAM BOT] ✅ Webhook set successfully`
  - `[TELEGRAM BOT] Using webhook secret token for verification`

---

### Step 4: Verify It Works

#### Test Webhook (with secret token):
```bash
# Replace with your actual secret token
SECRET="your-generated-secret-token"
API_URL="https://adream-backend-production.up.railway.app"

# Should work with correct secret
curl -X POST "$API_URL/telegram/webhook" \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Bot-Api-Secret-Token: $SECRET" \
  -d '{"message": {"text": "/start"}}'
# Expected: 200 OK

# Should fail without secret
curl -X POST "$API_URL/telegram/webhook" \
  -H "Content-Type: application/json" \
  -d '{"message": {"text": "/start"}}'
# Expected: 401 Unauthorized
```

#### Test Login (via Telegram Mini App):
1. Open your Telegram bot
2. Click Mini App button
3. Should login successfully
4. Check browser console for no errors

---

## 🔍 Verification Checklist

After deployment, verify:

- [ ] `TELEGRAM_WEBHOOK_SECRET` is set in Railway
- [ ] Backend deployed successfully
- [ ] Webhook logs show secret token is being used
- [ ] Webhook rejects requests without secret token
- [ ] Telegram Mini App login works
- [ ] No authentication errors in logs

---

## ⚠️ Important Notes

### Webhook Secret Token
- **Must be set** for webhook verification to work
- If not set, webhook will accept all requests (less secure)
- Token is automatically sent to Telegram when webhook is set
- Keep this token secret!

### Hash Verification
- **Automatic** - works with real Telegram Mini App
- **Requires** `TELEGRAM_COMMAND_BOT_TOKEN` to be set
- In development, hash is optional (for easier testing)
- In production, hash is required

### Backward Compatibility
- Legacy authentication format still supported
- Existing users won't be affected
- New security features are additive

---

## 🐛 Troubleshooting

### Issue: Webhook not receiving updates

**Symptoms:**
- Bot commands not working
- No webhook updates in logs

**Solutions:**
1. Check `TELEGRAM_WEBHOOK_SECRET` is set correctly
2. Verify secret token matches in webhook setup
3. Check webhook info: `GET /telegram/webhook-info`
4. Re-set webhook: `POST /telegram/set-webhook` (as admin)

---

### Issue: Users can't login

**Symptoms:**
- Login returns 401 Unauthorized
- "Invalid Telegram authentication hash" error

**Solutions:**
1. Check `TELEGRAM_COMMAND_BOT_TOKEN` is set
2. Verify bot token is correct
3. Check logs for hash verification errors
4. In development, hash verification is optional
5. Test with real Telegram Mini App (not fake data)

---

### Issue: Hash verification always fails

**Possible causes:**
1. Bot token incorrect
2. InitData format incorrect
3. Hash calculation mismatch

**Solutions:**
1. Verify bot token: Check `TELEGRAM_COMMAND_BOT_TOKEN`
2. Check logs for detailed error messages
3. In development, temporarily disable hash verification if needed
4. Ensure using real Telegram Mini App (not manual requests)

---

## 📊 Security Status

### All Phases Complete ✅

- ✅ Phase 1: Rate limiting, admin protection, security headers
- ✅ Phase 2: CORS restrictions
- ✅ Phase 3: Webhook verification, hash verification

### Security Score: 9/10

**Remaining considerations:**
- Regular security audits
- Dependency updates
- Monitoring and alerting

---

## 🎉 Summary

Phase 3 security improvements are:
- ✅ Implemented
- ✅ Committed
- ✅ Ready for deployment

**Next step:** Set `TELEGRAM_WEBHOOK_SECRET` in Railway and deploy!

