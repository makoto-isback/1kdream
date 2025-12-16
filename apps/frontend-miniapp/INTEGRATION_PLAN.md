# Frontend Integration Plan

## Status: In Progress

### Components to Integrate from Uploaded Frontend

1. ✅ **UI Components** (Preserve Design)
   - GlassCard.tsx
   - Icons.tsx (lucide-react)
   - NumberGrid.tsx
   - RoundPanel.tsx
   - PurchaseControl.tsx
   - WalletModal.tsx
   - PointsModal.tsx
   - LanguageToggle.tsx

2. ✅ **Styling**
   - Tailwind CSS with iOS-style dark theme
   - Custom color palette
   - Glass morphism effects

3. ⚠️ **Backend Integration Required**
   - Replace mock data with API calls
   - Add Telegram WebApp SDK
   - Add authentication flow
   - Add business rule validation
   - Add error handling

### Integration Steps

1. Setup Tailwind CSS
2. Copy UI components
3. Integrate with AuthContext
4. Connect to API endpoints
5. Add business rules validation
6. Add error handling
7. Test all flows

### Business Rules to Enforce

- Min buy: 1,000 KYAT
- Max buy per round: 100,000 KYAT
- Max 10 buys per round
- Daily withdrawal limit: 500,000 KYAT
- Withdrawal delay: 1 hour
- Auto Buy constraints
- Points redemption: min 10,000 points

