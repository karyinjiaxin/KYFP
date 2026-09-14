/* ============================================================
   sampleClient.js — default client master data
   Embedded as JS (not fetched JSON) so the app runs from file://
   without a server. This is the ONE object every module reads
   from and writes to.
   ============================================================ */

var SampleClient = {
  personal: {
    name: 'Jonathan Tan',
    dob: '12/04/1988',
    gender: 'Male',
    maritalStatus: 'Married',
    nationality: 'Singaporean',
    occupation: 'Senior Manager, Tech',
    employmentStatus: 'Full-Time Employed',
    employer: 'Nimbus Cloud Pte Ltd',
    email: 'jonathan.tan@example.com',
    phone: '+65 9123 4567',
    advisor: 'Kar Yin',
    partnerClientId: '', partnerName: ''
  },
  dependants: [
    { name: 'Mei Ling Tan', relation: 'Spouse', age: 36 },
    { name: 'Ethan Tan', relation: 'Child', age: 6 },
    { name: 'Ava Tan', relation: 'Child', age: 3 }
  ],
  income: {
    salary: 12500,
    bonus: 25000,
    rentalIncome: 1800,
    businessIncome: 0,
    investmentIncome: 3600
  },
  cashflow: { lumpSumMonthlyExpenses: 0, incomeGrowthRate: 3 },
  roadmap: { interestRate: 0.05, inflationRate: 2, lifeEvents: [], retirementPayoutOverride: null },
  cashflowCategories: [
    {
      id: 'home', name: 'Home', bucket: 'Bills',
      items: [
        { id: 'i1', name: 'Electricity/Water', cost: 110, frequency: 'Monthly' },
        { id: 'i2', name: 'Mortgage/Rent', cost: 1600, frequency: 'Monthly' },
        { id: 'i3', name: 'Groceries', cost: 100, frequency: 'Monthly' },
        { id: 'i4', name: 'Internet', cost: 74, frequency: 'Weekly' },
        { id: 'i5', name: 'Mobile', cost: 137, frequency: 'Monthly' }
      ]
    },
    {
      id: 'taxes', name: 'Taxes', bucket: 'Bills',
      items: [
        { id: 'i6', name: 'Income Tax', cost: 1704, frequency: 'Monthly' }
      ]
    },
    {
      id: 'subscriptions', name: 'Subscriptions', bucket: 'Bills',
      items: [
        { id: 'i7', name: 'Amazon Prime', cost: 5, frequency: 'Monthly' },
        { id: 'i8', name: 'Netflix', cost: 23, frequency: 'Monthly' },
        { id: 'i9', name: 'Google One', cost: 3, frequency: 'Monthly' },
        { id: 'i10', name: 'ChatGPT', cost: 30, frequency: 'Monthly' },
        { id: 'i11', name: 'Microsoft', cost: 29, frequency: 'Annually' },
        { id: 'i12', name: 'Claude', cost: 30, frequency: 'Monthly' }
      ]
    },
    {
      id: 'insurance', name: 'Insurance', bucket: 'Bills',
      items: [
        { id: 'i13', name: 'Health Insurance', cost: 2000, frequency: 'Annually' },
        { id: 'i14', name: 'Life Insurance', cost: 13707, frequency: 'Annually' },
        { id: 'i15', name: 'Home + Contents Insurance', cost: 150, frequency: 'Annually' }
      ]
    },
    {
      id: 'work', name: 'Work', bucket: 'Bills',
      items: [
        { id: 'i16', name: 'Business Expense', cost: 100, frequency: 'Weekly' },
        { id: 'i17', name: 'Zoom', cost: 25, frequency: 'Monthly' }
      ]
    },
    {
      id: 'entertainment', name: 'Entertainment', bucket: 'Fun',
      items: [
        { id: 'i18', name: 'Eating Out', cost: 200, frequency: 'Weekly' },
        { id: 'i19', name: 'Books & Magazines', cost: 0, frequency: 'Annually' },
        { id: 'i20', name: 'Holidays', cost: 10000, frequency: 'Annually' },
        { id: 'i21', name: 'Gifts', cost: 2000, frequency: 'Annually' },
        { id: 'i22', name: 'Clothes', cost: 0, frequency: 'Monthly' }
      ]
    },
    {
      id: 'investment', name: 'Investment', bucket: 'Savings',
      items: [
        { id: 'i23', name: 'Wealth Accumulation', cost: 24914, frequency: 'Annually' },
        { id: 'i24', name: 'CPF Contribution', cost: 1480, frequency: 'Monthly', autoCpf: true }
      ]
    },
    {
      id: 'transport', name: 'Transport', bucket: 'Bills',
      items: [
        { id: 'i25', name: 'Public Transport/Taxis', cost: 0, frequency: 'Monthly' },
        { id: 'i26', name: 'Car Insurance', cost: 1261, frequency: 'Annually' },
        { id: 'i27', name: 'EV Charging Cost', cost: 0, frequency: 'Annually' },
        { id: 'i28', name: 'Petrol', cost: 70, frequency: 'Weekly' },
        { id: 'i29', name: 'Parking (HDB + Office)', cost: 437, frequency: 'Monthly' },
        { id: 'i30', name: 'Repairs & Maintenance', cost: 650, frequency: 'Annually' },
        { id: 'i31', name: 'Road Tax', cost: 624, frequency: 'Annually' },
        { id: 'i32', name: 'Loan', cost: 0, frequency: 'Monthly' },
        { id: 'i33', name: 'Cashcard', cost: 100, frequency: 'Monthly' }
      ]
    },
    {
      id: 'health', name: 'Health/Fitness', bucket: 'Bills',
      items: [
        { id: 'i34', name: 'Yoga', cost: 194, frequency: 'Monthly' },
        { id: 'i35', name: 'Gym', cost: 140, frequency: 'Weekly' },
        { id: 'i36', name: 'Medications', cost: 0, frequency: 'Annually' },
        { id: 'i37', name: 'Sanitary Products', cost: 20, frequency: 'Monthly' }
      ]
    },
    {
      id: 'kidselderly', name: 'Kids + Elderly', bucket: 'Bills',
      items: [
        { id: 'i38', name: 'Pets (Food + Vet)', cost: 100, frequency: 'Weekly' },
        { id: 'i39', name: 'Childcare', cost: 0, frequency: 'Monthly' },
        { id: 'i40', name: 'Child Clothings + Toys', cost: 0, frequency: 'Annually' },
        { id: 'i41', name: 'Child Activities', cost: 0, frequency: 'Monthly' },
        { id: 'i42', name: 'Elderly Parents Care', cost: 0, frequency: 'Monthly' },
        { id: 'i43', name: "Mom's Insurance", cost: 2500, frequency: 'Annually' }
      ]
    }
  ],
  cpf: {
    oa: 145000,
    sa: 98000,
    ma: 62000,
    ra: 0,
    monthlyMortgageDeduction: 1500,
    stopWorkAge: 65,
    mortgageDeductionEndAge: 63,
    homePurchaseAge: 0,
    homePurchaseDownpaymentOA: 0,
    retirementSumTier: 'FRS',
    voluntaryAllAccounts: 0,
    voluntarySA: 0,
    voluntaryMA: 0,
    voluntaryEndAge: 0
  },
  assets: {
    cash: 85000,
    cpf: 305000,
    stocks: 62000,
    etfs: 48000,
    unitTrusts: 35000,
    crypto: 8000,
    business: 0,
    insuranceCashValue: 21000,
    property: [
      { name: 'Home — The Sail @ Marina Bay', value: 1850000, loan: 980000 }
    ]
  },
  liabilities: {
    mortgage: 0,
    mortgageDetails: { monthlyCash: 2000, monthlyCPF: 1500, tenureYears: 25, interestRate: 2.6 },
    creditCards: 4200,
    carLoan: 38000,
    personalLoan: 0
  },
  emergencyFund: { targetMonths: 6 },
  // Monthly net worth snapshots for the Assets/Debt/Net Worth trend chart.
  // Use the "Record This Month" button on Net Worth to append/update
  // today's totals as you use the app over time.
  netWorthHistory: [
    { month: 'Apr', assets: 1180000, liabilities: 1035000 },
    { month: 'May', assets: 1205000, liabilities: 1028000 },
    { month: 'Jun', assets: 1232000, liabilities: 1021000 },
    { month: 'Jul', assets: 1258000, liabilities: 1013000 },
    { month: 'Aug', assets: 1281000, liabilities: 1005000 },
    { month: 'Sep', assets: 1304000, liabilities: 997000 }
  ],
  insuranceQuickCoverage: {
    deathTpd: 0, terminalIllness: 0, earlyStageCI: 0, lateStageCI: 0, incomeProtection: 0,
    longTermCare: 0, accidentalDeath: 0, accidentalMedicalReimbursement: 0, annualHospitalClaimableLimit: 0
  },
  insurance: [
    {
      id: 'pol_1', company: 'Great Eastern', policyName: 'GREAT Life Signature',
      type: 'Life', premium: 380, premiumFrequency: 'Monthly', coverage: 500000,
      startAge: 30, endAge: 99, paymentTerm: 20, cashValue: 12000, dividend: 3.2
    },
    {
      id: 'pol_2', company: 'Prudential', policyName: 'PRUActive Protect',
      type: 'CI', premium: 210, premiumFrequency: 'Monthly', coverage: 300000,
      startAge: 30, endAge: 75, paymentTerm: 20, cashValue: 4000, dividend: 0
    },
    {
      id: 'pol_4', company: 'NTUC Income', policyName: 'Income PA Secure',
      type: 'PA', premium: 45, premiumFrequency: 'Monthly', coverage: 200000,
      startAge: 30, endAge: 70, paymentTerm: 40, cashValue: 0, dividend: 0
    }
  ],
  // Hospital Plan Premiums lives on its own, separate from the general
  // Insurance Coverage list — a hospital plan modelled here doesn't
  // create or require a matching entry over there.
  hospitalPlans: [
    {
      id: 'hosp_1', company: 'Great Eastern', policyName: 'GREAT SupremeHealth',
      coverage: 1500000, endAge: 99,
      insurer: 'Great Eastern', gshPlan: 'P Plus', riderFamily: 'GTC', riderKey: 'P Signature',
      projectFrom: 'today',
      funding: { mode: 'Regular', amount: 0, growthRate: 5, dividendRate: 4 }
    }
  ],
  investments: [
    {
      id: 'inv_1', name: 'Manulife Income Accumulator', assetType: 'Investment Policy (ILP)', monthlyPremium: 1000,
      startAge: 38, stopAge: 58, dividendYield: 4.5,
      welcomeBonus: 2000, loyaltyBonus: 5000, fees: 1.2, feesEndAge: 58, expectedReturn: 6.5,
      inflation: 2.5, projectionAge: 65, dividendSwitchAge: 58, postSwitchDividendYield: 5.5
    },
    {
      id: 'inv_2', name: 'Endowus Core Equity Portfolio', assetType: 'ETF', monthlyPremium: 1500,
      startAge: 38, stopAge: 65, dividendYield: 2.2,
      welcomeBonus: 0, loyaltyBonus: 0, fees: 0.4, feesEndAge: 65, expectedReturn: 6,
      inflation: 2.5, projectionAge: 65
    }
  ],
  retirement: {
    currentAge: 38, retirementAge: 65, lifeExpectancy: 90,
    desiredMonthlyIncome: 8000, inflation: 2.5, cpfLifePayout: 1900,
    expectedReturn: 5, monthlyInvestmentOverride: 0
  },
  budgetGoals: {
    netWorthGoal: 3473433,
    savingsRateGoal: 30
  },
  goals: [
    { id: 'goal_1', name: "Children's University Education", category: 'Children Education', targetAmount: 400000, currentAmount: 35000, yearsLeft: 14, expectedReturn: 4 },
    { id: 'goal_2', name: 'Second Property (Investment)', category: 'Property', targetAmount: 600000, currentAmount: 120000, yearsLeft: 6, expectedReturn: 4 },
    { id: 'goal_3', name: 'Dream Family Trip — New Zealand', category: 'Travel', targetAmount: 25000, currentAmount: 6000, yearsLeft: 2, expectedReturn: 2 }
  ],
  tax: {
    parenthoodTaxRebate: 0,
    reliefs: { earnedIncome: 1000, cpfRelief: 17760, spouseRelief: 0, wmcr: 0, parentRelief: 0, grandparentCaregiver: 0, cpfCashTopUp: 0, srs: 0, others: 0 }
  },
  estate: {
    hasWill: 'Yes', willLastUpdated: '2022-06-01',
    hasLPA: 'No',
    executors: 'Mei Ling Tan (Spouse)',
    trustees: '',
    notes: 'Consider setting up an insurance trust for the children given estate size and CI/Life payouts.'
  },
  sessionNotes: [
    { id: 'sn_1', date: '2026-06-02', text: 'Discussed increasing CI coverage given family history. Client to think it over.' }
  ],
  meetingNotes: [
    { id: 'mn_1', date: '2026-07-14', title: 'Annual Review', text: 'Reviewed portfolio performance, agreed to top up SRS this year.' }
  ],
  settings: {
    theme: 'light',
    currency: 'SGD'
  }
};
