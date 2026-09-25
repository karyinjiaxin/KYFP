/* ============================================================
   blankClient.js — genuinely blank starting point for a new
   client meeting, as opposed to SampleClient (which is a fully
   populated demo). Keeps the same category/field STRUCTURE (so
   nothing breaks and useful starting categories are pre-named)
   but every number is 0 and every person-specific name/date/note
   is empty — nobody's real client should start out looking like
   "Jonathan Tan".
   ============================================================ */

var BlankClient = {
  personal: {
    name: '', dob: '', gender: 'Male', maritalStatus: 'Single', nationality: 'Singaporean',
    occupation: '', employmentStatus: 'Full-Time Employed', employer: '', email: '', phone: '', advisor: '',
    partnerClientId: '', partnerName: ''
  },
  dependants: [],
  income: { salary: 0, bonus: 0, rentalIncome: 0, businessIncome: 0, investmentIncome: 0 },
  cashflow: { lumpSumMonthlyExpenses: 0, incomeGrowthRate: 3 },
  roadmap: { interestRate: 0.05, inflationRate: 2, lifeEvents: [], retirementPayoutOverride: null },
  cashflowCategories: [
    { id: 'home', name: 'Home', bucket: 'Bills', items: [
      { id: 'i1', name: 'Electricity/Water', cost: 0, frequency: 'Monthly' },
      { id: 'i2', name: 'Mortgage/Rent', cost: 0, frequency: 'Monthly' },
      { id: 'i3', name: 'Groceries', cost: 0, frequency: 'Monthly' },
      { id: 'i4', name: 'Internet', cost: 0, frequency: 'Monthly' },
      { id: 'i5', name: 'Mobile', cost: 0, frequency: 'Monthly' }
    ] },
    { id: 'taxes', name: 'Taxes', bucket: 'Bills', items: [
      { id: 'i6', name: 'Income Tax', cost: 0, frequency: 'Monthly' }
    ] },
    { id: 'subscriptions', name: 'Subscriptions', bucket: 'Bills', items: [
      { id: 'i7', name: 'Subscriptions', cost: 0, frequency: 'Monthly' }
    ] },
    { id: 'insurance', name: 'Insurance', bucket: 'Bills', items: [
      { id: 'i13', name: 'Health Insurance', cost: 0, frequency: 'Annually' },
      { id: 'i14', name: 'Life Insurance', cost: 0, frequency: 'Annually' },
      { id: 'i15', name: 'Home + Contents Insurance', cost: 0, frequency: 'Annually' }
    ] },
    { id: 'work', name: 'Work', bucket: 'Bills', items: [
      { id: 'i16', name: 'Business Expense', cost: 0, frequency: 'Monthly' }
    ] },
    { id: 'entertainment', name: 'Entertainment', bucket: 'Fun', items: [
      { id: 'i18', name: 'Eating Out', cost: 0, frequency: 'Monthly' },
      { id: 'i20', name: 'Holidays', cost: 0, frequency: 'Annually' },
      { id: 'i21', name: 'Gifts', cost: 0, frequency: 'Annually' }
    ] },
    { id: 'investment', name: 'Investment', bucket: 'Savings', items: [
      { id: 'i23', name: 'Wealth Accumulation', cost: 0, frequency: 'Annually' },
      { id: 'i24', name: 'CPF Contribution', cost: 0, frequency: 'Monthly', autoCpf: true }
    ] },
    { id: 'transport', name: 'Transport', bucket: 'Bills', items: [
      { id: 'i25', name: 'Public Transport/Taxis', cost: 0, frequency: 'Monthly' }
    ] },
    { id: 'health', name: 'Health/Fitness', bucket: 'Bills', items: [
      { id: 'i34', name: 'Health/Fitness', cost: 0, frequency: 'Monthly' }
    ] },
    { id: 'kidselderly', name: 'Kids + Elderly', bucket: 'Bills', items: [
      { id: 'i38', name: 'Childcare / Elderly Care', cost: 0, frequency: 'Monthly' }
    ] }
  ],
  cpf: {
    oa: 0, sa: 0, ma: 0, ra: 0,
    monthlyMortgageDeduction: 0, stopWorkAge: 65, mortgageDeductionEndAge: 0,
    retirementSumTier: 'FRS', voluntaryAllAccounts: 0, voluntarySA: 0, voluntaryMA: 0
  },
  assets: {
    cash: 0, stocks: 0, etfs: 0, unitTrusts: 0, crypto: 0, business: 0, insuranceCashValue: 0,
    property: []
  },
  liabilities: {
    mortgage: 0, mortgageDetails: { monthlyCash: 0, monthlyCPF: 0, tenureYears: 0, interestRate: 2.6 },
    creditCards: 0, carLoan: 0, personalLoan: 0
  },
  emergencyFund: { targetMonths: 6 },
  netWorthHistory: [],
  insuranceQuickCoverage: {
    deathTpd: 0, terminalIllness: 0, earlyStageCI: 0, lateStageCI: 0, incomeProtection: 0,
    longTermCare: 0, accidentalDeath: 0, accidentalMedicalReimbursement: 0, annualHospitalClaimableLimit: 0
  },
  insurance: [],
  hospitalPlans: [],
  investments: [],
  retirement: {
    currentAge: 0, retirementAge: 65, lifeExpectancy: 90,
    desiredMonthlyIncome: 0, inflation: 2.5, cpfLifePayout: 0,
    expectedReturn: 5, monthlyInvestmentOverride: 0
  },
  budgetGoals: { netWorthGoal: 0, savingsRateGoal: 30 },
  goals: [],
  tax: {
    parenthoodTaxRebate: 0,
    reliefs: { earnedIncome: 0, cpfRelief: 0, spouseRelief: 0, wmcr: 0, parentRelief: 0, grandparentCaregiver: 0, cpfCashTopUp: 0, srs: 0, others: 0 }
  },
  estate: { hasWill: 'No', willLastUpdated: '', hasLPA: 'No', executors: '', trustees: '', notes: '' },
  sessionNotes: [],
  meetingNotes: [],
  settings: { theme: 'light', currency: 'SGD' }
};
