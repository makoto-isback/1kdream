export type Language = 'en' | 'my';

export interface BotTranslations {
  languageSelection: {
    title: string;
    chooseLanguage: string;
    english: string;
    burmese: string;
  };
  welcome: string;
  help: string;
  rules: string;
  play: {
    title: string;
    button: string;
  };
  round: {
    title: string;
    timeRemaining: string;
    prizePool: string;
    winnerPool: string;
    yourStake: string;
    noActiveRound: string;
    userNotFound: string;
    error: string;
  };
  pool: {
    title: string;
    totalPool: string;
    winnerPool: string;
    adminFee: string;
    round: string;
    noActiveRound: string;
    userNotFound: string;
    error: string;
  };
  myBets: {
    title: string;
    totalStake: string;
    blocks: string;
    noBets: string;
    userNotFound: string;
    noActiveRound: string;
    error: string;
  };
  history: {
    title: string;
    noHistory: string;
    pending: string;
    won: string;
    winning: string;
    lost: string;
    userNotFound: string;
    error: string;
  };
  winners: {
    title: string;
    winningBlock: string;
    prizePool: string;
    noCompletedRounds: string;
    error: string;
  };
  balance: {
    title: string;
    kyat: string;
    points: string;
    available: string;
    userNotFound: string;
    error: string;
  };
  deposit: {
    title: string;
    method: string;
    steps: string;
    step1: string;
    step2: string;
    step3: string;
    step4: string;
    step5: string;
    exchangeRate: string;
    rate: string;
    minimum: string;
    note: string;
    userNotFound: string;
    error: string;
  };
  withdraw: {
    title: string;
    limits: string;
    minimum: string;
    dailyMax: string;
    processingTime: string;
    process: string;
    step1: string;
    step2: string;
    step3: string;
    step4: string;
    step5: string;
    step6: string;
    exchangeRate: string;
    rate: string;
    important: string;
    important1: string;
    important2: string;
    important3: string;
  };
  points: {
    title: string;
    yourPoints: string;
    howToEarn: string;
    earn1: string;
    earn2: string;
    earn3: string;
    redemption: string;
    ratio: string;
    minimum: string;
    redeemAnytime: string;
    example: string;
    example1: string;
    example2: string;
    example3: string;
    userNotFound: string;
    error: string;
  };
  support: {
    title: string;
    needHelp: string;
    channels: string;
    telegram: string;
    openApp: string;
    commonIssues: string;
    issue1: string;
    issue2: string;
    issue3: string;
    contactButton: string;
  };
  errors: {
    unknownCommand: string;
    errorOccurred: string;
    nonCommandMessage: string;
  };
}

export const botTranslations: Record<Language, BotTranslations> = {
  en: {
    languageSelection: {
      title: '🌐 Choose Your Language / ဘာသာစကား ရွေးချယ်ပါ',
      chooseLanguage: 'Please select your preferred language:\nကျေးဇူးပြု၍ သင်နှစ်သက်သော ဘာသာစကားကို ရွေးချယ်ပါ:',
      english: '🇬🇧 English',
      burmese: '🇲🇲 မြန်မာ',
    },
    welcome: `🎉 <b>Welcome to 1K Dream Lottery!</b> 🎉

Hello! 👋 We're excited to have you here!

🎮 <b>HOW TO PLAY:</b>

1️⃣ <b>Choose Your Numbers</b>
   • Select any number from 1-25 (you can pick multiple!)
   • Each number is a "block" you can bet on

2️⃣ <b>Set Your Bet Amount</b>
   • Minimum: 1,000 KYAT per block
   • Maximum: 100,000 KYAT total per round
   • Maximum: 10 bets per round

3️⃣ <b>Wait for the Draw</b>
   • New round starts every hour
   • One winning number is randomly selected (1-25)
   • Watch the countdown timer!

4️⃣ <b>Win Prizes!</b> 💰
   • If your number wins, you share 90% of the prize pool!
   • Payouts are proportional - bet more, win more!
   • You get your original bet back PLUS profit!

💡 <b>EXAMPLE:</b>
   • Prize Pool: 500,000 KYAT
   • Winner Pool: 450,000 KYAT (90%)
   • You bet 10,000 KYAT on winning block
   • Total bets on winning block: 100,000 KYAT
   • Your payout: (10,000 ÷ 100,000) × 450,000 = 45,000 KYAT
   • Profit: 35,000 KYAT! 🎊

📋 <b>IMPORTANT RULES:</b>
   • Minimum bet: 1,000 KYAT per block
   • Max 10 bets per round
   • Max 100,000 KYAT total per round
   • Exchange rate: 5,000 KYAT = $1

✨ <b>FEATURES:</b>
   • 🎯 Single Buy - Bet on one round
   • 🔄 Auto Buy - Set it and forget it!
   • 💎 Points System - Earn points with every bet
   • 💰 Deposit/Withdraw - Easy TON USDT transfers

🎁 <b>BONUS:</b>
   • Earn 10 points for every 1,000 KYAT bet
   • Redeem 10,000+ points for KYAT (1:1 ratio)

Ready to play? Use /play to open the app! 🚀

Good luck! 🍀`,
    help: `📋 <b>Available Commands:</b>

<b>Basic:</b>
/start - Welcome message and game explanation
/help - Show this help message
/rules - Display game rules and limits
/play - Open the game app

<b>Game Info:</b>
/round - Current round info
/pool - Current prize pool amount
/mybets - Your bets in current round
/history - Your betting history
/winners - Recent winners list

<b>Wallet:</b>
/balance - Check your KYAT balance and points
/deposit - Deposit instructions (TON USDT)
/withdraw - Withdrawal info and limits
/points - Points system explanation

<b>Support:</b>
/support - Contact support team

Use any command to get started! 🚀`,
    rules: `📋 <b>Game Rules</b>

<b>Betting Limits:</b>
• Minimum bet: 1,000 KYAT per block
• Maximum bets: 10 per round
• Maximum total: 100,000 KYAT per round

<b>Round Frequency:</b>
• New round every hour
• One winning number (1-25) selected randomly

<b>Payouts:</b>
• 90% of pool goes to winners
• 10% admin fee
• Proportional payouts (bet more, win more!)
• You get original bet + profit

<b>No Winner Refund:</b>
• If no one wins, all players get 90% of their bet back
• Refund is proportional to your bet amount
• 10% admin fee applies (same as winning rounds)

<b>Exchange Rate:</b>
• 5,000 KYAT = $1 USDT

<b>Points System:</b>
• Earn 10 points per 1,000 KYAT bet
• Redeem 10,000+ points for KYAT (1:1 ratio)

<b>Withdrawals:</b>
• Minimum: 5,000 KYAT
• Daily max: 500,000 KYAT
• Processing time: 1 hour

Use /play to start betting! 🎯`,
    play: {
      title: `🎮 <b>Open the Game</b>

Click the button below to open the 1K Dream Lottery app! 🚀`,
      button: '🎮 Open Game',
    },
    round: {
      title: '🎯 <b>Current Round',
      timeRemaining: '⏰ <b>Time remaining:</b>',
      prizePool: '💰 <b>Prize Pool:</b>',
      winnerPool: '🏆 <b>Winner Pool:</b>',
      yourStake: '💵 <b>Your stake:</b>',
      noActiveRound: '⏳ No active round at the moment. Check back soon!',
      userNotFound: '❌ User not found. Please open the app first to create your account.',
      error: '❌ Error fetching round info. Please try again.',
    },
    pool: {
      title: '💰 <b>Prize Pool</b>',
      totalPool: '💵 <b>Total Pool:</b>',
      winnerPool: '🏆 <b>Winner Pool:</b>',
      adminFee: '⚙️ <b>Admin Fee:</b>',
      round: 'Round',
      noActiveRound: '⏳ No active round at the moment.',
      userNotFound: '❌ User not found. Please open the app first.',
      error: '❌ Error fetching pool info.',
    },
    myBets: {
      title: '📊 <b>Your Bets',
      totalStake: '💵 <b>Total Stake:</b>',
      blocks: '🎯 <b>Blocks:</b>',
      noBets: '📝 <b>No bets in current round</b>',
      userNotFound: '❌ User not found. Please open the app first.',
      noActiveRound: '⏳ No active round at the moment.',
      error: '❌ Error fetching your bets.',
    },
    history: {
      title: '📜 <b>Your Betting History</b>',
      noHistory: '📝 <b>No betting history</b>',
      pending: '⏳ Pending',
      won: '✅ Won',
      winning: '🎯 Winning!',
      lost: '❌ Lost',
      userNotFound: '❌ User not found. Please open the app first.',
      error: '❌ Error fetching history.',
    },
    winners: {
      title: '🏆 <b>Recent Winners</b>',
      winningBlock: '🎯 Winning Block:',
      prizePool: '💰 Prize Pool:',
      noCompletedRounds: '📝 <b>No completed rounds yet</b>',
      error: '❌ Error fetching winners.',
    },
    balance: {
      title: '💰 <b>Your Balance</b>',
      kyat: '💵 <b>KYAT:</b>',
      points: '💎 <b>Points:</b>',
      available: '<b>Available for withdrawal:</b>',
      userNotFound: '❌ User not found. Please open the app first to create your account.',
      error: '❌ Error fetching balance.',
    },
    deposit: {
      title: '💵 <b>Deposit Instructions</b>',
      method: '<b>Method:</b> TON USDT',
      steps: '<b>Steps:</b>',
      step1: '1. Open the app using /play',
      step2: '2. Go to Deposit section',
      step3: '3. Enter amount in USDT',
      step4: '4. Send USDT to the provided TON address',
      step5: '5. Wait for confirmation (usually within minutes)',
      exchangeRate: '<b>Exchange Rate:</b>',
      rate: '• 1 USDT = 5,000 KYAT\n• Minimum deposit: 0.2 USDT (1,000 KYAT)',
      minimum: '• Minimum deposit: 0.2 USDT (1,000 KYAT)',
      note: '<b>Note:</b> Make sure to use the address shown in the app for your deposit to be credited automatically.',
      userNotFound: '❌ User not found. Please open the app first.',
      error: '❌ Error. Please try again.',
    },
    withdraw: {
      title: '💸 <b>Withdrawal Information</b>',
      limits: '<b>Limits:</b>',
      minimum: '• Minimum: 5,000 KYAT (1 USDT)',
      dailyMax: '• Daily maximum: 500,000 KYAT per user',
      processingTime: '• Processing time: 1 hour after request',
      process: '<b>Process:</b>',
      step1: '1. Open the app using /play',
      step2: '2. Go to Withdraw section',
      step3: '3. Enter amount and TON address',
      step4: '4. Submit withdrawal request',
      step5: '5. Wait 1 hour for processing',
      step6: '6. Funds will be sent to your TON address',
      exchangeRate: '<b>Exchange Rate:</b>',
      rate: '• 5,000 KYAT = 1 USDT',
      important: '<b>Important:</b>',
      important1: '• Balance is deducted immediately when you request withdrawal',
      important2: '• If rejected, balance will be refunded',
      important3: '• Make sure your TON address is correct!',
    },
    points: {
      title: '💎 <b>Points System</b>',
      yourPoints: '<b>Your Points:</b>',
      howToEarn: '<b>How to Earn:</b>',
      earn1: '• Bet 1,000 KYAT = Earn 10 points',
      earn2: '• Bet 5,000 KYAT = Earn 50 points',
      earn3: '• Bet 10,000 KYAT = Earn 100 points',
      redemption: '<b>Redemption:</b>',
      ratio: '• 1,000 points = 1,000 KYAT (1:1 ratio)',
      minimum: '• Minimum redemption: 10,000 points',
      redeemAnytime: '• Redeem anytime in the app',
      example: '<b>Example:</b>',
      example1: '• You have 15,000 points',
      example2: '• Redeem 12,000 points = Get 12,000 KYAT',
      example3: '• Remaining: 3,000 points',
      userNotFound: '❌ User not found. Please open the app first.',
      error: '❌ Error fetching points.',
    },
    support: {
      title: '🆘 <b>Contact Support</b>',
      needHelp: 'Need help? Our support team is here for you!',
      channels: '<b>Support Channels:</b>',
      telegram: '• Telegram: @onekadmin',
      openApp: '• Open app and use "Contact Support" button',
      commonIssues: '<b>Common Issues:</b>',
      issue1: '• Deposit not credited? Contact support with TX hash',
      issue2: '• Withdrawal delayed? Check status in app',
      issue3: '• Account issues? Contact support',
      contactButton: '💬 Contact Support',
    },
    errors: {
      unknownCommand: 'Unknown command. Use /help to see all commands.',
      errorOccurred: 'An error occurred. Please try again later.',
      nonCommandMessage: 'Please use a command. Type /help to see available commands.',
    },
  },
  my: {
    languageSelection: {
      title: '🌐 ဘာသာစကား ရွေးချယ်ပါ / Choose Your Language',
      chooseLanguage: 'ကျေးဇူးပြု၍ သင်နှစ်သက်သော ဘာသာစကားကို ရွေးချယ်ပါ:\nPlease select your preferred language:',
      english: '🇬🇧 English',
      burmese: '🇲🇲 မြန်မာ',
    },
    welcome: `🎉 <b>1K Dream Lottery သို့ ကြိုဆိုပါသည်!</b> 🎉

မင်္ဂလာပါ! 👋 သင်တို့ကို ဤနေရာတွင် တွေ့ရသည်ကို ဝမ်းသာပါသည်!

🎮 <b>ကစားနည်း:</b>

1️⃣ <b>နံပါတ်များ ရွေးချယ်ပါ</b>
   • 1-25 မှ မည်သည့်နံပါတ်ကိုမဆို ရွေးချယ်ပါ (အများအပြား ရွေးချယ်နိုင်သည်!)
   • နံပါတ်တစ်ခုစီသည် သင်လောင်းကစားနိုင်သော "ဘလောက်" တစ်ခုဖြစ်သည်

2️⃣ <b>လောင်းကစားငွေ သတ်မှတ်ပါ</b>
   • အနည်းဆုံး: ဘလောက်တစ်ခုလျှင် 1,000 KYAT
   • အများဆုံး: တစ်ပတ်လျှင် စုစုပေါင်း 100,000 KYAT
   • အများဆုံး: တစ်ပတ်လျှင် 10 ကြိမ်

3️⃣ <b>ဆုရရှိရန် စောင့်ဆိုင်းပါ</b>
   • ပွဲစဉ်အသစ်တစ်ခုကို တစ်နာရီတိုင်း စတင်သည်
   • အနိုင်ရသော နံပါတ်တစ်ခုကို ကျပန်းရွေးချယ်သည် (1-25)
   • ရေတွက်ချိန်ကို စောင့်ကြည့်ပါ!

4️⃣ <b>ဆုများ ရရှိပါ!</b> 💰
   • သင့်နံပါတ်သည် အနိုင်ရပါက၊ သင်သည် ဆုကြေးငွေ၏ 90% ကို ဝေငှရရှိပါသည်!
   • ပေးချေငွေများသည် အချိုးကျဖြစ်သည် - ပိုလောင်းကစားလေ၊ ပိုရလေ!
   • သင်သည် သင့်မူလလောင်းကစားငွေကို ပြန်ရရှိပြီး အမြတ်ငွေကိုလည်း ရရှိပါသည်!

💡 <b>ဥပမာ:</b>
   • ဆုကြေးငွေ: 500,000 KYAT
   • အနိုင်ရရှိသူများ ဆုကြေးငွေ: 450,000 KYAT (90%)
   • သင်သည် အနိုင်ရသော ဘလောက်တွင် 10,000 KYAT လောင်းကစားသည်
   • အနိုင်ရသော ဘလောက်တွင် စုစုပေါင်း လောင်းကစားငွေ: 100,000 KYAT
   • သင့်ပေးချေငွေ: (10,000 ÷ 100,000) × 450,000 = 45,000 KYAT
   • အမြတ်ငွေ: 35,000 KYAT! 🎊

📋 <b>အရေးကြီးသော စည်းမျဉ်းများ:</b>
   • အနည်းဆုံး လောင်းကစားငွေ: ဘလောက်တစ်ခုလျှင် 1,000 KYAT
   • တစ်ပတ်လျှင် အများဆုံး 10 ကြိမ်
   • တစ်ပတ်လျှင် အများဆုံး စုစုပေါင်း 100,000 KYAT
   • ငွေလဲလှယ်နှုန်း: 5,000 KYAT = $1

✨ <b>အင်္ဂါရပ်များ:</b>
   • 🎯 တစ်ကြိမ်ဝယ် - တစ်ပတ်တွင် လောင်းကစားပါ
   • 🔄 အလိုအလျောက် - သတ်မှတ်ပြီး မေ့ထားပါ!
   • 💎 အမှတ်စနစ် - လောင်းကစားတိုင်း အမှတ်များ ရရှိပါ
   • 💰 ငွေသွင်း/ထုတ် - TON USDT လွှဲပြောင်းမှု လွယ်ကူပါသည်

🎁 <b>ဘောနပ်စ်:</b>
   • 1,000 KYAT လောင်းကစားတိုင်း အမှတ် 10 ရရှိပါသည်
   • 10,000+ အမှတ်ကို KYAT သို့ လဲလှယ်ပါ (1:1 အချိုး)

ကစားရန် အဆင်သင့်ဖြစ်ပြီလား? /play ကို အသုံးပြု၍ အက်ပ်ကို ဖွင့်ပါ! 🚀

ကံကောင်းပါစေ! 🍀`,
    help: `📋 <b>အသုံးပြုနိုင်သော ညွှန်ကြားချက်များ:</b>

<b>အခြေခံ:</b>
/start - ကြိုဆိုစကား နှင့် ဂိမ်းရှင်းလင်းချက်
/help - ဤအကူအညီ စာတမ်းကို ပြပါ
/rules - ဂိမ်းစည်းမျဉ်းများ နှင့် ကန့်သတ်ချက်များကို ပြပါ
/play - ဂိမ်းအက်ပ်ကို ဖွင့်ပါ

<b>ဂိမ်းအချက်အလက်:</b>
/round - လက်ရှိပွဲစဉ် အချက်အလက်
/pool - လက်ရှိ ဆုကြေးငွေ ပမာဏ
/mybets - လက်ရှိပွဲစဉ်တွင် သင့်လောင်းကစားငွေများ
/history - သင့်လောင်းကစားမှု မှတ်တမ်း
/winners - မကြာသေးမီက အနိုင်ရရှိသူများ စာရင်း

<b>ပိုက်ဆံအိတ်:</b>
/balance - သင့် KYAT လက်ကျန်ငွေ နှင့် အမှတ်များကို စစ်ဆေးပါ
/deposit - ငွေသွင်းညွှန်ကြားချက် (TON USDT)
/withdraw - ငွေထုတ်ယူမှု အချက်အလက် နှင့် ကန့်သတ်ချက်များ
/points - အမှတ်စနစ် ရှင်းလင်းချက်

<b>အကူအညီ:</b>
/support - အကူအညီအဖွဲ့ကို ဆက်သွယ်ပါ

စတင်ရန် မည်သည့်ညွှန်ကြားချက်ကိုမဆို အသုံးပြုပါ! 🚀`,
    rules: `📋 <b>ဂိမ်းစည်းမျဉ်းများ</b>

<b>လောင်းကစားငွေ ကန့်သတ်ချက်များ:</b>
• အနည်းဆုံး လောင်းကစားငွေ: ဘလောက်တစ်ခုလျှင် 1,000 KYAT
• တစ်ပတ်လျှင် အများဆုံး 10 ကြိမ်
• တစ်ပတ်လျှင် အများဆုံး စုစုပေါင်း 100,000 KYAT

<b>ပွဲစဉ် အကြိမ်ရေ:</b>
• တစ်နာရီတိုင်း ပွဲစဉ်အသစ်
• အနိုင်ရသော နံပါတ်တစ်ခု (1-25) ကို ကျပန်းရွေးချယ်သည်

<b>ပေးချေငွေများ:</b>
• ဆုကြေးငွေ၏ 90% သည် အနိုင်ရရှိသူများသို့ သွားသည်
• 10% စီမံခန့်ခွဲမှု အခကြေးငွေ
• အချိုးကျ ပေးချေငွေများ (ပိုလောင်းကစားလေ၊ ပိုရလေ!)
• သင်သည် မူလလောင်းကစားငွေ + အမြတ်ငွေ ရရှိပါသည်

<b>အနိုင်ရရှိသူ မရှိပါက ပြန်ပေးငွေ:</b>
• အနိုင်ရရှိသူ မရှိပါက၊ လောင်းကစားသူအားလုံးအား သူတို့၏ လောင်းကစားငွေ၏ 90% ကို ပြန်ပေးမည်
• ပြန်ပေးငွေသည် သင့်လောင်းကစားငွေ ပမာဏအလိုက် အချိုးကျဖြစ်သည်
• 10% စီမံခန့်ခွဲမှု အခကြေးငွေ ကျင့်သုံးသည် (အနိုင်ရသော ပွဲစဉ်များနှင့် အတူတူပင်)

<b>ငွေလဲလှယ်နှုန်း:</b>
• 5,000 KYAT = $1 USDT

<b>အမှတ်စနစ်:</b>
• 1,000 KYAT လောင်းကစားတိုင်း အမှတ် 10 ရရှိပါသည်
• 10,000+ အမှတ်ကို KYAT သို့ လဲလှယ်ပါ (1:1 အချိုး)

<b>ငွေထုတ်ယူမှုများ:</b>
• အနည်းဆုံး: 5,000 KYAT
• နေ့စဉ် အများဆုံး: 500,000 KYAT
• လုပ်ဆောင်ချိန်: 1 နာရီ

လောင်းကစားရန် /play ကို အသုံးပြုပါ! 🎯`,
    play: {
      title: `🎮 <b>ဂိမ်းကို ဖွင့်ပါ</b>

1K Dream Lottery အက်ပ်ကို ဖွင့်ရန် အောက်ပါ ခလုတ်ကို နှိပ်ပါ! 🚀`,
      button: '🎮 ဂိမ်းဖွင့်ပါ',
    },
    round: {
      title: '🎯 <b>လက်ရှိပွဲစဉ်',
      timeRemaining: '⏰ <b>အချိန်ကျန်:</b>',
      prizePool: '💰 <b>ဆုကြေးငွေ:</b>',
      winnerPool: '🏆 <b>အနိုင်ရရှိသူများ ဆုကြေးငွေ:</b>',
      yourStake: '💵 <b>သင့်လောင်းကစားငွေ:</b>',
      noActiveRound: '⏳ လက်ရှိတွင် ပွဲစဉ်မရှိပါ။ မကြာမီ ပြန်စစ်ဆေးပါ!',
      userNotFound: '❌ အသုံးပြုသူ မတွေ့ရှိပါ။ ကျေးဇူးပြု၍ အက်ပ်ကို ဖွင့်၍ အကောင့်ကို ဖန်တီးပါ။',
      error: '❌ ပွဲစဉ်အချက်အလက် ရယူရာတွင် အမှားအယွင်း။ ကျေးဇူးပြု၍ ထပ်မံကြိုးစားပါ။',
    },
    pool: {
      title: '💰 <b>ဆုကြေးငွေ</b>',
      totalPool: '💵 <b>စုစုပေါင်း ဆုကြေးငွေ:</b>',
      winnerPool: '🏆 <b>အနိုင်ရရှိသူများ ဆုကြေးငွေ:</b>',
      adminFee: '⚙️ <b>စီမံခန့်ခွဲမှု အခကြေးငွေ:</b>',
      round: 'ပွဲစဉ်',
      noActiveRound: '⏳ လက်ရှိတွင် ပွဲစဉ်မရှိပါ။',
      userNotFound: '❌ အသုံးပြုသူ မတွေ့ရှိပါ။ ကျေးဇူးပြု၍ အက်ပ်ကို ဖွင့်ပါ။',
      error: '❌ ဆုကြေးငွေ အချက်အလက် ရယူရာတွင် အမှားအယွင်း။',
    },
    myBets: {
      title: '📊 <b>သင့်လောင်းကစားငွေများ',
      totalStake: '💵 <b>စုစုပေါင်း လောင်းကစားငွေ:</b>',
      blocks: '🎯 <b>ဘလောက်များ:</b>',
      noBets: '📝 <b>လက်ရှိပွဲစဉ်တွင် လောင်းကစားငွေ မရှိပါ</b>',
      userNotFound: '❌ အသုံးပြုသူ မတွေ့ရှိပါ။ ကျေးဇူးပြု၍ အက်ပ်ကို ဖွင့်ပါ။',
      noActiveRound: '⏳ လက်ရှိတွင် ပွဲစဉ်မရှိပါ။',
      error: '❌ သင့်လောင်းကစားငွေများ ရယူရာတွင် အမှားအယွင်း။',
    },
    history: {
      title: '📜 <b>သင့်လောင်းကစားမှု မှတ်တမ်း</b>',
      noHistory: '📝 <b>လောင်းကစားမှု မှတ်တမ်း မရှိပါ</b>',
      pending: '⏳ စောင့်ဆိုင်းနေသည်',
      won: '✅ အနိုင်ရရှိသည်',
      winning: '🎯 အနိုင်ရရှိနေသည်!',
      lost: '❌ ရှုံးနိမ့်သည်',
      userNotFound: '❌ အသုံးပြုသူ မတွေ့ရှိပါ။ ကျေးဇူးပြု၍ အက်ပ်ကို ဖွင့်ပါ။',
      error: '❌ မှတ်တမ်း ရယူရာတွင် အမှားအယွင်း။',
    },
    winners: {
      title: '🏆 <b>မကြာသေးမီက အနိုင်ရရှိသူများ</b>',
      winningBlock: '🎯 အနိုင်ရသော ဘလောက်:',
      prizePool: '💰 ဆုကြေးငွေ:',
      noCompletedRounds: '📝 <b>အောင်မြင်သော ပွဲစဉ်များ မရှိသေးပါ</b>',
      error: '❌ အနိုင်ရရှိသူများ ရယူရာတွင် အမှားအယွင်း။',
    },
    balance: {
      title: '💰 <b>သင့်လက်ကျန်ငွေ</b>',
      kyat: '💵 <b>KYAT:</b>',
      points: '💎 <b>အမှတ်များ:</b>',
      available: '<b>ငွေထုတ်ယူရန် ရရှိနိုင်သော:</b>',
      userNotFound: '❌ အသုံးပြုသူ မတွေ့ရှိပါ။ ကျေးဇူးပြု၍ အက်ပ်ကို ဖွင့်၍ အကောင့်ကို ဖန်တီးပါ။',
      error: '❌ လက်ကျန်ငွေ ရယူရာတွင် အမှားအယွင်း။',
    },
    deposit: {
      title: '💵 <b>ငွေသွင်းညွှန်ကြားချက်</b>',
      method: '<b>နည်းလမ်း:</b> TON USDT',
      steps: '<b>အဆင့်များ:</b>',
      step1: '1. /play ကို အသုံးပြု၍ အက်ပ်ကို ဖွင့်ပါ',
      step2: '2. ငွေသွင်းရန် ကဏ္ဍသို့ သွားပါ',
      step3: '3. USDT ပမာဏကို ထည့်သွင်းပါ',
      step4: '4. ပေးထားသော TON လိပ်စာသို့ USDT ပို့ပါ',
      step5: '5. အတည်ပြုချက်ကို စောင့်ဆိုင်းပါ (များသောအားဖြင့် မိနစ်အနည်းငယ်အတွင်း)',
      exchangeRate: '<b>ငွေလဲလှယ်နှုန်း:</b>',
      rate: '• 1 USDT = 5,000 KYAT\n• အနည်းဆုံး ငွေသွင်းမှု: 0.2 USDT (1,000 KYAT)',
      minimum: '• အနည်းဆုံး ငွေသွင်းမှု: 0.2 USDT (1,000 KYAT)',
      note: '<b>မှတ်ချက်:</b> သင့်ငွေသွင်းမှုကို အလိုအလျောက် ထည့်သွင်းရန် အက်ပ်တွင် ပြထားသော လိပ်စာကို အသုံးပြုရန် သေချာပါစေ။',
      userNotFound: '❌ အသုံးပြုသူ မတွေ့ရှိပါ။ ကျေးဇူးပြု၍ အက်ပ်ကို ဖွင့်ပါ။',
      error: '❌ အမှားအယွင်း။ ကျေးဇူးပြု၍ ထပ်မံကြိုးစားပါ။',
    },
    withdraw: {
      title: '💸 <b>ငွေထုတ်ယူမှု အချက်အလက်</b>',
      limits: '<b>ကန့်သတ်ချက်များ:</b>',
      minimum: '• အနည်းဆုံး: 5,000 KYAT (1 USDT)',
      dailyMax: '• နေ့စဉ် အများဆုံး: အသုံးပြုသူတစ်ဦးလျှင် 500,000 KYAT',
      processingTime: '• လုပ်ဆောင်ချိန်: တောင်းဆိုမှု ပြီးနောက် 1 နာရီ',
      process: '<b>လုပ်ငန်းစဉ်:</b>',
      step1: '1. /play ကို အသုံးပြု၍ အက်ပ်ကို ဖွင့်ပါ',
      step2: '2. ငွေထုတ်ယူရန် ကဏ္ဍသို့ သွားပါ',
      step3: '3. ပမာဏ နှင့် TON လိပ်စာကို ထည့်သွင်းပါ',
      step4: '4. ငွေထုတ်ယူမှု တောင်းဆိုမှုကို တင်သွင်းပါ',
      step5: '5. လုပ်ဆောင်ရန် 1 နာရီ စောင့်ဆိုင်းပါ',
      step6: '6. ငွေများကို သင့် TON လိပ်စာသို့ ပို့ပေးမည်',
      exchangeRate: '<b>ငွေလဲလှယ်နှုန်း:</b>',
      rate: '• 5,000 KYAT = 1 USDT',
      important: '<b>အရေးကြီးသော:</b>',
      important1: '• ငွေထုတ်ယူမှု တောင်းဆိုသောအခါ လက်ကျန်ငွေကို ချက်ချင်း နုတ်ယူသည်',
      important2: '• ငြင်းဆိုပါက၊ လက်ကျန်ငွေကို ပြန်ပေးမည်',
      important3: '• သင့် TON လိပ်စာ မှန်ကန်ကြောင်း သေချာပါစေ!',
    },
    points: {
      title: '💎 <b>အမှတ်စနစ်</b>',
      yourPoints: '<b>သင့်အမှတ်များ:</b>',
      howToEarn: '<b>ရရှိပုံ:</b>',
      earn1: '• 1,000 KYAT လောင်းကစားပါ = အမှတ် 10 ရရှိပါသည်',
      earn2: '• 5,000 KYAT လောင်းကစားပါ = အမှတ် 50 ရရှိပါသည်',
      earn3: '• 10,000 KYAT လောင်းကစားပါ = အမှတ် 100 ရရှိပါသည်',
      redemption: '<b>လဲလှယ်မှု:</b>',
      ratio: '• 1,000 အမှတ် = 1,000 KYAT (1:1 အချိုး)',
      minimum: '• အနည်းဆုံး လဲလှယ်မှု: 10,000 အမှတ်',
      redeemAnytime: '• အက်ပ်တွင် မည်သည့်အချိန်တွင်မဆို လဲလှယ်ပါ',
      example: '<b>ဥပမာ:</b>',
      example1: '• သင်တွင် 15,000 အမှတ် ရှိသည်',
      example2: '• 12,000 အမှတ် လဲလှယ်ပါ = 12,000 KYAT ရရှိပါသည်',
      example3: '• ကျန်ရှိသော: 3,000 အမှတ်',
      userNotFound: '❌ အသုံးပြုသူ မတွေ့ရှိပါ။ ကျေးဇူးပြု၍ အက်ပ်ကို ဖွင့်ပါ။',
      error: '❌ အမှတ်များ ရယူရာတွင် အမှားအယွင်း။',
    },
    support: {
      title: '🆘 <b>အကူအညီကို ဆက်သွယ်ပါ</b>',
      needHelp: 'အကူအညီ လိုအပ်ပါသလား? ကျွန်ုပ်တို့၏ အကူအညီအဖွဲ့သည် သင်တို့အတွက် ဤနေရာတွင် ရှိပါသည်!',
      channels: '<b>အကူအညီ လမ်းကြောင်းများ:</b>',
      telegram: '• Telegram: @onekadmin',
      openApp: '• အက်ပ်ကို ဖွင့်၍ "အကူအညီကို ဆက်သွယ်ပါ" ခလုတ်ကို အသုံးပြုပါ',
      commonIssues: '<b>အဖြစ်များသော ပြဿနာများ:</b>',
      issue1: '• ငွေသွင်းမှု မထည့်သွင်းပါက? TX hash နှင့်အတူ အကူအညီကို ဆက်သွယ်ပါ',
      issue2: '• ငွေထုတ်ယူမှု နောက်ကျပါက? အက်ပ်တွင် အခြေအနေကို စစ်ဆေးပါ',
      issue3: '• အကောင့် ပြဿနာများပါက? အကူအညီကို ဆက်သွယ်ပါ',
      contactButton: '💬 အကူအညီကို ဆက်သွယ်ပါ',
    },
    errors: {
      unknownCommand: 'မသိသော ညွှန်ကြားချက်။ ညွှန်ကြားချက်အားလုံးကို ကြည့်ရန် /help ကို အသုံးပြုပါ။',
      errorOccurred: 'အမှားအယွင်း ဖြစ်ပွားခဲ့သည်။ ကျေးဇူးပြု၍ နောက်ပိုင်းတွင် ထပ်မံကြိုးစားပါ။',
      nonCommandMessage: 'ကျေးဇူးပြု၍ ညွှန်ကြားချက်ကို အသုံးပြုပါ။ အသုံးပြုနိုင်သော ညွှန်ကြားချက်များကို ကြည့်ရန် /help ကို ရိုက်ထည့်ပါ။',
    },
  },
};

