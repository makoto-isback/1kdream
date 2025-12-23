import { Translations } from '../types/ui';

export const TRANSLATIONS: Translations = {
  app_title: { en: "1K Dream", my: "1K Dream" },
  round: { en: "Round", my: "အကြိမ်" },
  pool: { en: "Prize Pool", my: "ဆုကြေးငွေ" },
  ends_in: { en: "Ends in", my: "အချိန်ကျန်" },
  your_stake: { en: "Your Stake", my: "ထည့်ဝင်ငွေ" },
  buy_numbers: { en: "Buy Numbers", my: "နံပါတ်ဝယ်မည်" },
  single_buy: { en: "Single Buy", my: "တစ်ကြိမ်ဝယ်" },
  auto_buy: { en: "Auto Buy", my: "အလိုအလျောက်" },
  amount_kyat: { en: "Amount (KYAT)", my: "ပမာဏ (ကျပ်)" },
  rounds_count: { en: "No. of Rounds", my: "အကြိမ်အရေအတွက်" },
  total_cost: { en: "Total Cost", my: "စုစုပေါင်းကုန်ကျစရိတ်" },
  wallet: { en: "Wallet", my: "ပိုက်ဆံအိတ်" },
  points: { en: "Points", my: "အမှတ်များ" },
  redeem: { en: "Redeem", my: "လဲလှယ်မည်" },
  balance: { en: "Balance", my: "လက်ကျန်ငွေ" },
  deposit: { en: "Deposit", my: "ငွေသွင်း" },
  withdraw: { en: "Withdraw", my: "ငွေထုတ်" },
  buyers: { en: "Buyers", my: "ဝယ်ယူသူ" },
  selected: { en: "Selected", my: "ရွေးချယ်ပြီး" },
  confirm: { en: "Confirm Purchase", my: "အတည်ပြုပါ" },
  contact_support: { en: "Contact Support", my: "အကူအညီရယူရန်" },
  direct_transfer: { en: "Direct Transfer", my: "တိုက်ရိုက်လွှဲပြောင်း" },
  loading: { en: "Loading...", my: "ခေတ္တစောင့်ပါ..." },
  error: { en: "Error", my: "အမှား" },
  success: { en: "Success", my: "အောင်မြင်ပါသည်" },
  min_buy: { en: "Minimum buy is 1,000 KYAT", my: "အနည်းဆုံး ဝယ်ယူမှုသည် 1,000 KYAT ဖြစ်သည်" },
  max_buy: { en: "Maximum buy per round is 100,000 KYAT", my: "တစ်ပတ်လျှင် အများဆုံး ဝယ်ယူမှုသည် 100,000 KYAT ဖြစ်သည်" },
  max_buys: { en: "Maximum 10 buys per round", my: "တစ်ပတ်လျှင် အများဆုံး 10 ကြိမ် ဝယ်နိုင်သည်" },
  insufficient_balance: { en: "Insufficient balance", my: "လက်ကျန်ငွေ မလုံလောက်ပါ" },
  min_withdrawal: { en: "Minimum withdrawal is 5,000 KYAT", my: "အနည်းဆုံး ငွေထုတ်ယူမှုသည် 5,000 KYAT ဖြစ်သည်" },
  daily_limit: { en: "Daily withdrawal limit exceeded", my: "နေ့စဉ် ငွေထုတ်ယူမှု ကန့်သတ်ချက်ကို ကျော်လွန်နေသည်" },
  withdrawal_delay: { en: "Withdrawal can only be processed after 1 hour", my: "ငွေထုတ်ယူမှုကို 1 နာရီအကြာတွင်သာ လုပ်ဆောင်နိုင်သည်" },
  min_redemption: { en: "Minimum redemption is 10,000 points", my: "အနည်းဆုံး ပြန်လည်ထုတ်ယူမှုသည် 10,000 အမှတ်ဖြစ်သည်" },
  insufficient_points: { en: "Insufficient points", my: "အမှတ်မလုံလောက်ပါ" },
  howItWorks: {
    title: { en: "How It Works", my: "ဘယ်လိုအလုပ်လုပ်လဲ" },
    step1: {
      title: { en: "Choose Your Numbers", my: "နံပါတ်များ ရွေးချယ်ပါ" },
      description: { en: "Select 1-25 blocks (numbers) you want to bet on. You can choose multiple blocks.", my: "သင်ဝယ်လိုသော 1-25 ဘလောက် (နံပါတ်) များကို ရွေးချယ်ပါ။ ဘလောက်များစွာ ရွေးချယ်နိုင်သည်။" }
    },
    step2: {
      title: { en: "Set Your Bet Amount", my: "ဝယ်ငွေ သတ်မှတ်ပါ" },
      description: { en: "Enter the amount you want to bet per block. Minimum is 1,000 KYAT per block.", my: "နံပါတ် တစ်ခုစီအတွက် ဝယ်လိုသော ငွေပမာဏကို ထည့်သွင်းပါ။ အနည်းဆုံး 1,000 KYAT ဖြစ်သည်။" }
    },
    step3: {
      title: { en: "Wait for the Draw", my: "ဆုရရှိရန် စောင့်ဆိုင်းပါ" },
      description: { en: "Each round lasts until the draw time. The winning number is randomly selected from 1-25.", my: "ပွဲစဉ်တစ်ခုစီသည် ဆုရရှိရန် အချိန်အထိ ကြာမြင့်သည်။ အနိုင်ရသော နံပါတ်ကို 1-25 မှ ကျပန်းရွေးချယ်သည်။" }
    },
    step4: {
      title: { en: "Win Prizes", my: "ဆုများ ရရှိပါ" },
      description: { en: "If your number matches the winning number, you share the prize pool with other winners! If no one wins, all players get 90% of their bet back (proportional to bet amount).", my: "သင့်နံပါတ်သည် အနိုင်ရသော နံပါတ်နှင့် ကိုက်ညီပါက၊ အခြားအနိုင်ရရှိသူများနှင့် ဆုကြေးငွေကို ဝေငှရရှိပါသည်။ သင့် ဝယ်ငွေများလျှင် ဝေဆုပိုပြီးရပါမည်။ အနိုင်ရရှိသူ မရှိပါက၊ လောင်းကစားသူအားလုံးအား သူတို့၏ လောင်းကစားငွေ၏ 90% ကို ပြန်ပေးမည် (လောင်းကစားငွေပမာဏအလိုက်)။" }
    },
    exchangeRate: { en: "5,000 KYAT = $1", my: "5,000 KYAT = $1" },
    example: {
      title: { en: "Example: How Payouts Work", my: "ဥပမာ: ဆုငွေ ခွဲဝေပုံ" },
      roundDetails: { en: "Round Details:", my: "ပွဲစဉ် အချက်အလက်များ:" },
      totalPool: { en: "Total Pool:", my: "စုစုပေါင်း ဆုကြေးငွေ:" },
      winnerPool: { en: "Winner Pool:", my: "အနိုင်ရရှိသူများ ဆုကြေးငွေ:" },
      winningBlock: { en: "Winning Block:", my: "အနိုင်ရသော ဘလောက်:" },
      betsOnBlock: { en: "Bets on Block 12:", my: "ဘလောက် 12 တွင် လောင်းကစားငွေ:" },
      totalOnBlock: { en: "Total on Block 12:", my: "ဘလောက် 12 တွင် စုစုပေါင်း:" },
      calculations: { en: "Calculations:", my: "တွက်ချက်မှုများ:" },
      payoutFormula: { en: "Formula: (Your Bet / Total Winning Bets) × Winner Pool", my: "ပုံသေနည်း: (သင့်လောင်းကစားငွေ / စုစုပေါင်း အနိုင်ရ လောင်းကစားငွေ) × အနိုင်ရရှိသူများ ဆုကြေးငွေ" },
      totalPaid: { en: "Total paid:", my: "စုစုပေါင်း ပေးချေငွေ:" },
      note: { en: "Note: Winners receive their original bet amount back PLUS profit. The payout includes both!", my: "မှတ်ချက်: အနိုင်ရရှိသူများသည် သူတို့၏ မူလလောင်းကစားငွေကို ပြန်ရရှိပြီး အမြတ်ငွေကိုလည်း ရရှိပါသည်။ ပေးချေငွေတွင် နှစ်ခုလုံး ပါဝင်ပါသည်။" },
      noWinnerTitle: { en: "What if No One Wins?", my: "အနိုင်ရရှိသူ မရှိပါက?" },
      noWinnerDescription: { en: "If no one bets on the winning number, all players get 90% of their bet back (proportional to bet amount). The remaining 10% is the admin fee.", my: "အနိုင်ရသော နံပါတ်တွင် လောင်းကစားသူ မရှိပါက၊ လောင်းကစားသူအားလုံးအား သူတို့၏ လောင်းကစားငွေ၏ 90% ကို ပြန်ပေးမည် (လောင်းကစားငွေပမာဏအလိုက်)။ ကျန်ရှိသော 10% သည် စီမံခန့်ခွဲမှု အခကြေးငွေ ဖြစ်သည်။" },
      noWinnerExample: { en: "Example: If you bet 10,000 KYAT and no one wins, you get 9,000 KYAT back.", my: "ဥပမာ: သင်သည် 10,000 KYAT လောင်းကစားပြီး အနိုင်ရရှိသူ မရှိပါက၊ သင်သည် 9,000 KYAT ပြန်ရရှိမည်။" }
    },
    rules: {
      title: { en: "Important Rules", my: "အရေးကြီးသော စည်းမျဉ်းများ" },
      rule1: { en: "Minimum bet: 1,000 KYAT per block", my: "အနည်းဆုံး လောင်းကစားငွေ: ဘလောက်တစ်ခုလျှင် 1,000 KYAT" },
      rule2: { en: "Maximum 10 bets per round", my: "တစ်ပတ်လျှင် အများဆုံး 10 ကြိမ်" },
      rule3: { en: "Maximum 100,000 KYAT total per round", my: "တစ်ပတ်လျှင် အများဆုံး 100,000 KYAT" }
    },
    close: { en: "Got it!", my: "နားလည်ပါပြီ" }
  }
};

