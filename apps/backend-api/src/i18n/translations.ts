/**
 * Internationalization support for backend
 * Frontend will use these keys for translations
 */
export const translations = {
  en: {
    errors: {
      insufficientBalance: 'Insufficient balance',
      invalidBlock: 'Block number must be between 1 and 25',
      minBet: 'Minimum bet is 1,000 KYAT',
      maxBet: 'Maximum bet per round is 100,000 KYAT',
      maxBets: 'Maximum 10 bets per round',
      bettingPaused: 'Betting is currently paused',
      withdrawalsPaused: 'Withdrawals are currently paused',
      minWithdrawal: 'Minimum withdrawal is 5,000 KYAT',
      dailyLimitExceeded: 'Daily withdrawal limit exceeded',
      withdrawalDelay: 'Withdrawal can only be processed after 1 hour',
      minDeposit: 'Minimum deposit is 1,000 KYAT',
      tonAddressRequired: 'Please register your TON address before making deposits',
      invalidTonAddress: 'Invalid TON address',
      minRedemption: 'Minimum redemption is 10,000 points',
      insufficientPoints: 'Insufficient points',
    },
    success: {
      betPlaced: 'Bet placed successfully',
      withdrawalRequested: 'Withdrawal requested successfully',
      depositCreated: 'Deposit request created',
      pointsRedeemed: 'Points redeemed successfully',
      tonAddressUpdated: 'TON address updated',
    },
  },
  my: {
    errors: {
      insufficientBalance: 'လက်ကျန်ငွေ မလုံလောက်ပါ',
      invalidBlock: 'ဘလောက်နံပါတ်သည် 1 နှင့် 25 အကြားရှိရမည်',
      minBet: 'အနည်းဆုံး လောင်းကြေးသည် 1,000 KYAT ဖြစ်သည်',
      maxBet: 'တစ်ပတ်လျှင် အများဆုံး လောင်းကြေးသည် 100,000 KYAT ဖြစ်သည်',
      maxBets: 'တစ်ပတ်လျှင် အများဆုံး 10 ကြိမ် လောင်းနိုင်သည်',
      bettingPaused: 'လောင်းကြေးသည် ယခု ရပ်နားထားသည်',
      withdrawalsPaused: 'ငွေထုတ်ယူမှုများသည် ယခု ရပ်နားထားသည်',
      minWithdrawal: 'အနည်းဆုံး ငွေထုတ်ယူမှုသည် 5,000 KYAT ဖြစ်သည်',
      dailyLimitExceeded: 'နေ့စဉ် ငွေထုတ်ယူမှု ကန့်သတ်ချက်ကို ကျော်လွန်နေသည်',
      withdrawalDelay: 'ငွေထုတ်ယူမှုကို 1 နာရီအကြာတွင်သာ လုပ်ဆောင်နိုင်သည်',
      minDeposit: 'အနည်းဆုံး ငွေသွင်းမှုသည် 1,000 KYAT ဖြစ်သည်',
      tonAddressRequired: 'ငွေသွင်းမီ သင့် TON လိပ်စာကို မှတ်ပုံတင်ပါ',
      invalidTonAddress: 'မမှန်ကန်သော TON လိပ်စာ',
      minRedemption: 'အနည်းဆုံး ပြန်လည်ထုတ်ယူမှုသည် 10,000 အမှတ်ဖြစ်သည်',
      insufficientPoints: 'အမှတ်မလုံလောက်ပါ',
    },
    success: {
      betPlaced: 'လောင်းကြေး အောင်မြင်စွာ ထားရှိပြီး',
      withdrawalRequested: 'ငွေထုတ်ယူမှု တောင်းဆိုမှု အောင်မြင်ပါသည်',
      depositCreated: 'ငွေသွင်းမှု တောင်းဆိုမှု ဖန်တီးပြီး',
      pointsRedeemed: 'အမှတ်များ အောင်မြင်စွာ ပြန်လည်ထုတ်ယူပြီး',
      tonAddressUpdated: 'TON လိပ်စာ မွမ်းမံပြီး',
    },
  },
};

export type Language = 'en' | 'my';
export type TranslationKey = keyof typeof translations.en;

