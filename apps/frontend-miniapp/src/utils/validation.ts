// Business rules validation
export const MIN_BUY = 1000;
export const MAX_BUY_PER_ROUND = 100000;
export const MAX_BUYS_PER_ROUND = 10;
export const MIN_WITHDRAWAL = 5000;
export const DAILY_MAX_WITHDRAWAL = 500000;
export const MIN_REDEMPTION_POINTS = 10000;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export const validateBuy = (
  amount: number,
  selectedCount: number,
  currentBuysInRound: number,
  currentTotalBuyInRound: number,
  language: 'my' | 'en' = 'my'
): ValidationResult => {
  if (amount < MIN_BUY) {
    return {
      valid: false,
      error: language === 'my' 
        ? 'အနည်းဆုံး ဝယ်ယူမှုသည် 1,000 KYAT ဖြစ်သည်'
        : 'Minimum buy is 1,000 KYAT',
    };
  }

  if (amount > MAX_BUY_PER_ROUND) {
    return {
      valid: false,
      error: language === 'my'
        ? 'တစ်ပတ်လျှင် အများဆုံး ဝယ်ယူမှုသည် 100,000 KYAT ဖြစ်သည်'
        : 'Maximum buy per round is 100,000 KYAT',
    };
  }

  const totalBuyAmount = amount * selectedCount;
  if (currentTotalBuyInRound + totalBuyAmount > MAX_BUY_PER_ROUND) {
    return {
      valid: false,
      error: language === 'my'
        ? `တစ်ပတ်လျှင် အများဆုံး ဝယ်ယူမှု ကျော်လွန်နေသည်။ ကျန်ရှိသော: ${MAX_BUY_PER_ROUND - currentTotalBuyInRound} KYAT`
        : `Maximum buy per round exceeded. Remaining: ${MAX_BUY_PER_ROUND - currentTotalBuyInRound} KYAT`,
    };
  }

  if (currentBuysInRound + selectedCount > MAX_BUYS_PER_ROUND) {
    return {
      valid: false,
      error: language === 'my'
        ? `တစ်ပတ်လျှင် အများဆုံး 10 ကြိမ် ဝယ်နိုင်သည်။ ကျန်ရှိသော: ${MAX_BUYS_PER_ROUND - currentBuysInRound}`
        : `Maximum 10 buys per round. Remaining: ${MAX_BUYS_PER_ROUND - currentBuysInRound}`,
    };
  }

  return { valid: true };
};

export const validateAutoBuy = (
  blocks: number[],
  amountPerBlock: number,
  _rounds: number,
  _currentBuysInRound: number,
  _currentTotalBuyInRound: number,
  language: 'my' | 'en' = 'my'
): ValidationResult => {
  if (blocks.length === 0) {
    return {
      valid: false,
      error: language === 'my' ? 'အနည်းဆုံး ဘလောက်တစ်ခု ရွေးချယ်ရမည်' : 'Select at least one block',
    };
  }

  if (amountPerBlock < MIN_BUY) {
    return {
      valid: false,
      error: language === 'my'
        ? 'အနည်းဆုံး ဝယ်ယူမှုသည် 1,000 KYAT ဖြစ်သည်'
        : 'Minimum buy is 1,000 KYAT',
    };
  }

  const totalPerRound = blocks.length * amountPerBlock;
  if (totalPerRound > MAX_BUY_PER_ROUND) {
    return {
      valid: false,
      error: language === 'my'
        ? `တစ်ပတ်လျှင် အများဆုံး ဝယ်ယူမှု ကျော်လွန်နေသည် (${totalPerRound} KYAT)`
        : `Maximum buy per round exceeded (${totalPerRound} KYAT)`,
    };
  }

  if (blocks.length > MAX_BUYS_PER_ROUND) {
    return {
      valid: false,
      error: language === 'my'
        ? 'တစ်ပတ်လျှင် အများဆုံး 10 ကြိမ် ဝယ်နိုင်သည်'
        : 'Maximum 10 buys per round',
    };
  }

  return { valid: true };
};

export const validateWithdrawal = (
  amount: number,
  dailyWithdrawn: number,
  language: 'my' | 'en' = 'my'
): ValidationResult => {
  if (amount < MIN_WITHDRAWAL) {
    return {
      valid: false,
      error: language === 'my'
        ? 'အနည်းဆုံး ငွေထုတ်ယူမှုသည် 5,000 KYAT ဖြစ်သည်'
        : 'Minimum withdrawal is 5,000 KYAT',
    };
  }

  if (dailyWithdrawn + amount > DAILY_MAX_WITHDRAWAL) {
    return {
      valid: false,
      error: language === 'my'
        ? `နေ့စဉ် ငွေထုတ်ယူမှု ကန့်သတ်ချက်ကို ကျော်လွန်နေသည်။ ကျန်ရှိသော: ${DAILY_MAX_WITHDRAWAL - dailyWithdrawn} KYAT`
        : `Daily withdrawal limit exceeded. Remaining: ${DAILY_MAX_WITHDRAWAL - dailyWithdrawn} KYAT`,
    };
  }

  return { valid: true };
};

export const validatePointsRedemption = (
  points: number,
  userPoints: number,
  language: 'my' | 'en' = 'my'
): ValidationResult => {
  if (points < MIN_REDEMPTION_POINTS) {
    return {
      valid: false,
      error: language === 'my'
        ? 'အနည်းဆုံး ပြန်လည်ထုတ်ယူမှုသည် 10,000 အမှတ်ဖြစ်သည်'
        : 'Minimum redemption is 10,000 points',
    };
  }

  if (points > userPoints) {
    return {
      valid: false,
      error: language === 'my'
        ? 'အမှတ်မလုံလောက်ပါ'
        : 'Insufficient points',
    };
  }

  return { valid: true };
};

