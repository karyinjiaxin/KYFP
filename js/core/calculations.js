/* ============================================================
   calculations.js — pure formula engine
   Every derived number in the app comes from here. No module
   computes its own numbers independently — this keeps every
   page in sync, like formulas across one spreadsheet.
   ============================================================ */

var Calc = (function () {

  function num(v) { var n = Number(v); return isNaN(n) ? 0 : n; }
  function sum(arr, fn) { return (arr || []).reduce(function (s, x) { return s + num(fn(x)); }, 0); }

  // CPF as a Net Worth asset is always the sum of the actual CPF account
  // balances on the CPF tab (OA + SA + MA + RA) — never a separately
  // typed number that could drift out of sync with the real balances.
  function totalCpfBalance(c) {
    var cpf = c.cpf || {};
    return num(cpf.oa) + num(cpf.sa) + num(cpf.ma) + num(cpf.ra);
  }

  // Parses a date string the user actually types, prioritizing the
  // Singapore-convention DD/MM/YYYY format. Falls back to trying native
  // Date parsing (handles ISO YYYY-MM-DD) for any older stored values
  // that predate this format, so existing client data doesn't break.
  // Native Date parsing is NOT used for slash-separated dates directly,
  // since browsers inconsistently treat "12/04/1988" as MM/DD/YYYY —
  // that would silently misread day and month for most Singapore dates.
  function parseDateString(str) {
    if (!str) return null;
    var s = String(str).trim();
    var slashParts = s.split('/');
    if (slashParts.length === 3) {
      var day = parseInt(slashParts[0], 10), month = parseInt(slashParts[1], 10), year = parseInt(slashParts[2], 10);
      if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
      var d = new Date(year, month - 1, day);
      // Reject silently-rolled-over invalid dates (e.g. 31/02/2026 -> March)
      if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
      return d;
    }
    var iso = new Date(s);
    return isNaN(iso.getTime()) ? null : iso;
  }

  function ageFromDob(dob) {
    if (!dob) return null;
    var d = parseDateString(dob);
    if (!d) return null;
    var now = new Date();
    var age = now.getFullYear() - d.getFullYear();
    var m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    return age;
  }

  // ---------- CASHFLOW ----------
  function monthlyIncome(c) {
    var i = c.income || {};
    return num(i.salary) + num(i.bonus) / 12 + num(i.rentalIncome) + num(i.businessIncome) + num(i.investmentIncome) / 12;
  }

  // Total annual income excluding investment income — useful as a
  // standalone figure for things like tax computations or lender
  // affordability checks where investment income is often excluded or
  // treated separately.
  function annualIncomeExclInvestment(c) {
    var i = c.income || {};
    return num(i.salary) * 12 + num(i.bonus) + num(i.rentalIncome) * 12 + num(i.businessIncome) * 12;
  }

  // ---------- CASHFLOW CATEGORIES (category -> line items, each with its
  // own billing frequency) — the single source of truth for all expenses.
  var FREQUENCY_MONTHS = { Monthly: 1, Quarterly: 3, Annually: 12, Weekly: 12 / 52 };
  var FREQUENCY_MULTIPLIER = { Monthly: 12, Quarterly: 4, Annually: 1, Weekly: 52 };

  function itemAnnual(item) {
    var mult = FREQUENCY_MULTIPLIER[item.frequency] || 12;
    return num(item.cost) * mult;
  }
  function itemMonthly(item) { return itemAnnual(item) / 12; }
  function categoryMonthlyTotal(cat) { return sum(cat.items, itemMonthly); }
  function categoryAnnualTotal(cat) { return sum(cat.items, itemAnnual); }
  function allCategoriesMonthlyTotal(c) { return sum(c.cashflowCategories, categoryMonthlyTotal); }

  function monthlyExpenses(c) {
    // A lump sum overrides the detailed category breakdown entirely when
    // set — for a client where there isn't time or information to build
    // out expenses category by category, one total figure still lets
    // every calculation that depends on Monthly Expenses work correctly.
    // Category-specific views (Spending Breakdown, Bucket Allocation)
    // won't reflect it, since there's no per-category detail to show.
    var lumpSum = num((c.cashflow || {}).lumpSumMonthlyExpenses);
    if (lumpSum > 0) return lumpSum;
    return allCategoriesMonthlyTotal(c);
  }
  function monthlySurplus(c) { return monthlyIncome(c) - monthlyExpenses(c); }

  // The monthly amount Retirement Planning assumes gets invested until
  // retirement. Defaults to Cashflow's computed Monthly Surplus, but is
  // directly editable/overridable via "Monthly Amount Invested" on the
  // Retirement Planning page — e.g. if a client's real surplus won't
  // actually all be invested, or if the advisor wants to model a
  // specific commitment amount instead of the raw Cashflow figure.
  function monthlyInvestmentAmount(c) {
    var r = c.retirement || {};
    return num(r.monthlyInvestmentOverride);
  }
  function annualSurplus(c) { return monthlySurplus(c) * 12; }
  function savingsRate(c) {
    var inc = monthlyIncome(c);
    if (inc <= 0) return 0;
    // Savings + whatever's left unallocated after Bills/Savings/Fun —
    // Leftover isn't being spent on anything, so it's effectively
    // available to save even before it's formally bucketed (the Buckets
    // page itself suggests directing it to Savings or a Goal). Counting
    // only the explicitly-tagged Savings bucket alone understated this
    // for clients whose cashflow doesn't yet route everything through a
    // formal Savings category.
    var bt = bucketTotals(c);
    return ((bt.savings + bt.leftover) / inc) * 100;
  }
  function cashflowRatio(c) {
    var inc = monthlyIncome(c);
    if (inc <= 0) return 0;
    return (monthlyExpenses(c) / inc) * 100;
  }

  // ---------- NET WORTH ----------
  function propertyValueTotal(c) { return sum((c.assets || {}).property, function (p) { return p.value; }); }
  function propertyLoanTotal(c) { return sum((c.assets || {}).property, function (p) { return p.loan; }); }

  function totalAssets(c) {
    var a = c.assets || {};
    // Stocks/ETFs/Unit Trusts/Crypto here already reflect Investment
    // Planning's contribution (they auto-sync from matching plans there,
    // with manual entries preserved for anything NOT tracked as a plan)
    // — adding investmentValueAtAge() on top would double-count the same
    // money once via these fields and again by recomputing the plans
    // directly.
    return num(a.cash) + totalCpfBalance(c) + num(a.stocks) + num(a.etfs) + num(a.unitTrusts) +
      num(a.crypto) + propertyValueTotal(c) + num(a.business) + num(a.insuranceCashValue);
  }
  function totalLiabilities(c) {
    var l = c.liabilities || {};
    // Mortgage debt belongs on the specific Property it's attached to
    // (Assets > Property > Outstanding Loan) — there's no separate flat
    // "mortgage" liability added here, since that would double-count
    // against the same debt already tracked per-property.
    return num(l.creditCards) + num(l.carLoan) + num(l.personalLoan) + propertyLoanTotal(c);
  }
  function netWorth(c) { return totalAssets(c) - totalLiabilities(c); }
  function liquidAssets(c) {
    var a = c.assets || {};
    return num(a.cash) + num(a.stocks) + num(a.etfs) + num(a.unitTrusts) + num(a.crypto);
  }
  function investmentAssetsTotal(c) {
    var a = c.assets || {};
    // Same reasoning as totalAssets above — these fields already reflect
    // Investment Planning's contribution via auto-sync, so adding the
    // plans' value again here would double-count.
    return num(a.stocks) + num(a.etfs) + num(a.unitTrusts) + num(a.crypto);
  }
  function debtRatio(c) {
    var ta = totalAssets(c);
    if (ta <= 0) return 0;
    return (totalLiabilities(c) / ta) * 100;
  }

  // ---------- INSURANCE ----------
  function policyAnnualPremium(p) {
    var monthly = num(p.premium);
    return p.premiumFrequency === 'Annually' ? monthly : monthly * 12;
  }
  function totalAnnualPremium(c) { return sum(c.insurance, policyAnnualPremium); }
  function totalMonthlyPremium(c) { return totalAnnualPremium(c) / 12; }
  function totalCoverageByType(c, type) {
    return sum((c.insurance || []).filter(function (p) { return p.type === type; }), function (p) { return p.coverage; });
  }
  function totalCoverage(c) { return sum(c.insurance, function (p) { return p.coverage; }); }

  // ---------- QUICK-INPUT COVERAGE (aggregate amounts entered directly,
  // for a fast estimate without keying every individual policy) ----------
  var QUICK_COVERAGE_FIELDS = [
    'deathTpd', 'terminalIllness', 'earlyStageCI', 'lateStageCI', 'incomeProtection',
    'longTermCare', 'accidentalDeath', 'accidentalMedicalReimbursement', 'annualHospitalClaimableLimit'
  ];
  function quickCoverageTotal(c) {
    var q = c.insuranceQuickCoverage || {};
    return sum(QUICK_COVERAGE_FIELDS.map(function (k) { return q[k]; }), function (v) { return v; });
  }
  function combinedTotalCoverage(c) { return totalCoverage(c) + quickCoverageTotal(c); }
  function quickDeathTpdCoverage(c) {
    var q = c.insuranceQuickCoverage || {};
    return num(q.deathTpd);
  }
  function quickCICoverage(c) {
    var q = c.insuranceQuickCoverage || {};
    return num(q.earlyStageCI) + num(q.lateStageCI);
  }
  // Every coverage type shown on the "Coverage by Type" chart, combining
  // individual policies with the quick-input fields (which don't map to
  // a policy "Type" 1:1) — the chart should read as one true total per
  // category, not policies alone.
  function combinedCoverageByType(c) {
    var q = c.insuranceQuickCoverage || {};
    return {
      'Life': totalCoverageByType(c, 'Life') + num(q.deathTpd),
      'CI': totalCoverageByType(c, 'CI') + num(q.lateStageCI),
      'ECI': totalCoverageByType(c, 'ECI') + num(q.earlyStageCI),
      'Hospital': totalCoverageByType(c, 'Hospital') + num(q.annualHospitalClaimableLimit),
      'PA': totalCoverageByType(c, 'PA') + num(q.accidentalDeath) + num(q.accidentalMedicalReimbursement),
      'Disability': totalCoverageByType(c, 'Disability'),
      'Terminal Illness': num(q.terminalIllness),
      'Income Protection': num(q.incomeProtection),
      'Long Term Care': num(q.longTermCare)
    };
  }
  function recommendedLifeCoverage(c) {
    // Superseded by the LIA-based split below; kept as the combined
    // Death/TPD + CI benchmark so existing callers (AI panel, Proposal)
    // that just want "one recommended number" keep working.
    return recommendedDeathTpdCoverage(c) + recommendedCICoverage(c);
  }

  // ---------- INSURANCE NEED ANALYSIS (Life Insurance Association of
  // Singapore 2022 Protection Gap Study, adopted into the MAS/MoneySense
  // Basic Financial Planning Guide, Oct 2023 — jointly developed with the
  // CPF Board, LIA, the Association of Banks in Singapore, and the
  // Association of Financial Advisers): ~9x annual income for Death &
  // Total Permanent Disability, ~4x annual income for Critical Illness
  // (approximating ~5 years of income replacement during recovery).
  // Outstanding liabilities are added on top of the Death/TPD multiple,
  // a common refinement so a payout also clears debt, not just replaces
  // income. Source: lia.org.sg 2022 Protection Gap Study; mas.gov.sg
  // Basic Financial Planning Guide FAQs (Oct 2023).
  function recommendedDeathTpdCoverage(c) {
    return monthlyIncome(c) * 12 * 9 + totalLiabilities(c);
  }
  function recommendedCICoverage(c) {
    return monthlyIncome(c) * 12 * 4;
  }
  // Common industry benchmark for Income Protection / Disability Income
  // underwriting in Singapore: insurers typically cap the insurable
  // monthly benefit at up to 75% of gross income.
  function recommendedIncomeProtection(c) {
    return monthlyIncome(c) * 0.75;
  }
  // Long Term Care benchmark: S$6,000/month, rounded up from private
  // nursing home costs (~S$5,500/month for private facilities, per
  // Agency for Integrated Care and industry cost surveys 2025-2026) —
  // not a multiplier of income like Death/TPD or CI, since care costs
  // don't scale with income the same way.
  function recommendedLongTermCare(c) {
    return 6000;
  }
  function longTermCareHeld(c) {
    return num((c.insuranceQuickCoverage || {}).longTermCare);
  }
  function incomeProtectionHeld(c) {
    return num((c.insuranceQuickCoverage || {}).incomeProtection);
  }
  function deathTpdCoverageHeld(c) { return totalCoverageByType(c, 'Life') + quickDeathTpdCoverage(c); }
  function ciCoverageHeld(c) { return totalCoverageByType(c, 'CI') + totalCoverageByType(c, 'ECI') + quickCICoverage(c); }
  function deathTpdGap(c) { return Math.max(0, recommendedDeathTpdCoverage(c) - deathTpdCoverageHeld(c)); }
  function ciGap(c) { return Math.max(0, recommendedCICoverage(c) - ciCoverageHeld(c)); }

  function coverageGap(c) {
    return deathTpdGap(c) + ciGap(c);
  }
  function protectionRatio(c) {
    var inc = monthlyIncome(c) * 12;
    if (inc <= 0) return 0;
    return (totalAnnualPremium(c) / inc) * 100;
  }
  function insuranceCashValueProjected(p, atAge) {
    // simple compounding of current cash value using dividend rate as growth proxy
    var years = Math.max(0, num(atAge) - num(p.startAge));
    var rate = num(p.dividend) / 100 || 0.03;
    return num(p.cashValue) * Math.pow(1 + rate, years);
  }

  // ---------- INVESTMENT PLANNING ----------
  // Generates a year-by-year projection table for one investment plan.
  // ============================================================
  // GREAT Wealth Advantage 4 (GWA4) and GREAT Flexi Advantage (GFA)
  // — real fee/bonus structures from Great Eastern's own Product
  // Information Packs (GWA4: dated 28 June 2024; GFA: dated 1 April
  // 2026), so a client's regular (GWA4) or lump sum (GFA) investment
  // can be projected against actual product mechanics rather than a
  // generic assumed-fee model.
  //
  // Known simplification: Insurance Charge (GWA4's cost-of-insurance
  // deduction, based on Net Sum Assured and the life assured's age/
  // gender/smoking status) is NOT modelled here — it requires
  // mortality tables this app doesn't have. For a policy kept near its
  // minimum sum assured this is a small drag; for a large protection
  // component it would understate the fee impact. Flagged in the UI.
  var GWA4_RATES = {
    '5': {
      minAnnualPremium: 6000,
      // Below S$6,000/year, GWA4 Choice 5 isn't offered at all (per the
      // Welcome Bonus table's "Not Applicable" rows) — enforced in the UI.
      welcomeBonusTiers: [
        { min: 6000, max: 11999.99, pct: 15 },
        { min: 12000, max: Infinity, pct: 30 }
      ],
      policyFeeSchedule: [{ fromYear: 1, toYear: 10, pct: 2.5 }, { fromYear: 11, toYear: 999, pct: 0.7 }],
      loyaltyBonusYear: 10, loyaltyBonusPct: 0.30,
      premiumBonusStartYear: 6, premiumBonusPct: 2.00,
      surrenderChargeByYear: [100, 100, 75, 60, 50, 45, 40, 20, 15, 5, 0]
    },
    '10': {
      minAnnualPremium: 2400,
      welcomeBonusTiers: [
        { min: 2400, max: 3599.99, pct: 5 },
        { min: 3600, max: 5999.99, pct: 10 },
        { min: 6000, max: 11999.99, pct: 20 },
        { min: 12000, max: Infinity, pct: 40 }
      ],
      policyFeeSchedule: [{ fromYear: 1, toYear: 10, pct: 2.5 }, { fromYear: 11, toYear: 999, pct: 0.7 }],
      lowPremiumMonthlyFee: 5, lowPremiumThreshold: 6000, // fixed S$5/mo extra if prevailing annual premium < S$6,000
      loyaltyBonusYear: 10, loyaltyBonusPct: 0.30,
      premiumBonusStartYear: 11, premiumBonusPct: 2.00,
      surrenderChargeByYear: [100, 100, 75, 60, 50, 45, 40, 20, 15, 5, 0]
    },
    '15': {
      minAnnualPremium: 1200,
      welcomeBonusTiers: [
        { min: 1200, max: 2399.99, pct: 7.5 },
        { min: 2400, max: 3599.99, pct: 15 },
        { min: 3600, max: 5999.99, pct: 25 },
        { min: 6000, max: 11999.99, pct: 30 },
        { min: 12000, max: Infinity, pct: 55 }
      ],
      policyFeeSchedule: [{ fromYear: 1, toYear: 15, pct: 1.5 }, { fromYear: 16, toYear: 999, pct: 0.7 }],
      lowPremiumMonthlyFee: 5, lowPremiumThreshold: 6000,
      loyaltyBonusYear: 15, loyaltyBonusPct: 0.30,
      premiumBonusStartYear: 16, premiumBonusPct: 2.00,
      surrenderChargeByYear: [100, 100, 80, 60, 50, 50, 45, 30, 25, 15, 10, 8, 8, 7, 7]
    }
  };

  function gwa4WelcomeBonusPct(choice, annualPremium) {
    var tiers = (GWA4_RATES[choice] || GWA4_RATES['5']).welcomeBonusTiers;
    for (var i = 0; i < tiers.length; i++) {
      if (annualPremium >= tiers[i].min && annualPremium <= tiers[i].max) return tiers[i].pct;
    }
    return 0;
  }
  function gwa4PolicyFeePct(choice, policyYear) {
    var schedule = (GWA4_RATES[choice] || GWA4_RATES['5']).policyFeeSchedule;
    for (var i = 0; i < schedule.length; i++) {
      if (policyYear >= schedule[i].fromYear && policyYear <= schedule[i].toYear) return schedule[i].pct;
    }
    return schedule[schedule.length - 1].pct;
  }
  function gwa4SurrenderChargePct(choice, policyYear) {
    var arr = (GWA4_RATES[choice] || GWA4_RATES['5']).surrenderChargeByYear;
    return arr[policyYear - 1] != null ? arr[policyYear - 1] : 0;
  }

  // Year-by-year GWA4 projection: 100% of premium is allocated from day
  // one (no upfront charge, per Great Eastern's own "100% of basic
  // regular premiums invested from day one" positioning) — the cost
  // instead comes through the ongoing Policy Fee and the compounding
  // effect of that fee, offset by the Welcome/Loyalty/Premium bonuses.
  // premiumYears lets the projection run longer than the premium-paying
  // term implied by the Choice tier (5/10/15 years) — since GWA4 is a
  // WHOLE-OF-LIFE plan, the account keeps compounding indefinitely after
  // premiums stop, it just stops receiving new Basic Regular Premium
  // (and, per the product pack, the Premium Bonus that's tied to each
  // premium payment also stops). Defaults to the full projection length
  // if not given, matching "premiums continue throughout" as before.
  // Year N represents: Policy Year N has just completed (growth, fee,
  // Loyalty Bonus all apply using Policy Year N's own rates/milestones),
  // and — since that means Policy Year N+1 is now beginning — that next
  // premium (and any Premium Bonus tied to it) is paid immediately,
  // consistent with premiums being paid at the START of each policy
  // year. Year 0 is the exception: the very first premium and its
  // Welcome Bonus (credited "upon receipt", i.e. immediately) land
  // before any policy year has had time to complete, so there's no fee
  // or growth yet — but a dividend still starts accruing right away on
  // that starting balance, same reasoning as every other year.
  function gwa4Projection(annualPremium, choice, expectedReturnPct, years, premiumYears, dividendYieldPct) {
    var plan = GWA4_RATES[choice] || GWA4_RATES['5'];
    var expectedReturn = num(expectedReturnPct) / 100;
    var payYears = premiumYears != null ? premiumYears : years;
    var dividendYield = num(dividendYieldPct) / 100;
    var lowFeePct = plan.policyFeeSchedule[plan.policyFeeSchedule.length - 1].pct / 100;
    var rows = [];
    var accountValue = 0;
    var totalPremiumPaid = 0;

    for (var yearIndex = 0; yearIndex <= years; yearIndex++) {
      if (yearIndex === 0) {
        var isPayingFirst = 1 <= payYears;
        var firstPremium = isPayingFirst ? annualPremium : 0;
        var firstWelcomeBonus = isPayingFirst ? annualPremium * (gwa4WelcomeBonusPct(choice, annualPremium) / 100) : 0;
        // Fee applies from this SAME row as the Welcome Bonus — both
        // land "from the start" per the contract (Policy Fee: "deducted
        // on a monthly basis from the start of the policy"; Welcome
        // Bonus: "upon receipt" of the premium) — using the schedule's
        // Policy Year 1 rate, unless the premium term is only 1 year (an
        // edge case where this row is also the final payment, so the
        // rate has already dropped per the rule below).
        var y0FeePct = (payYears <= 0) ? lowFeePct : (gwa4PolicyFeePct(choice, 1) / 100);
        var balanceY0 = firstPremium + firstWelcomeBonus;
        var y0FeeAmount = balanceY0 * y0FeePct;
        accountValue = balanceY0 - y0FeeAmount;
        totalPremiumPaid += firstPremium;
        var y0SurrenderPct = gwa4SurrenderChargePct(choice, 1);
        rows.push({
          year: 0, premiumPaid: firstPremium, totalPremiumPaid: totalPremiumPaid, isPayingYear: isPayingFirst,
          policyFeePct: y0FeePct * 100, feeAmount: y0FeeAmount, welcomeBonus: firstWelcomeBonus, loyaltyBonus: 0, premiumBonus: 0,
          totalBonus: firstWelcomeBonus, accountValue: accountValue, annualDividend: accountValue * dividendYield,
          surrenderChargePct: y0SurrenderPct, surrenderValue: accountValue * (1 - y0SurrenderPct / 100)
        });
        continue;
      }

      // Policy Year `yearIndex` is the one just completing.
      var policyYearCompleting = yearIndex;
      // Fee drops to the schedule's long-term rate starting the SAME row
      // as the FINAL premium payment (policyYearCompleting = payYears-1)
      // — tied to when premiums actually stop, rather than the literal
      // Policy Year bracket boundary in the contract table (which, e.g.
      // for a 10-year term, wouldn't drop until Policy Year 11 — two
      // rows after the last payment).
      // Fee stays at the higher rate through the SAME row as the final
      // premium payment (policyYearCompleting = payYears - 1), and drops
      // to the long-term rate starting the very NEXT row — the first
      // one with no premium payment at all — not the same row as the
      // last payment itself.
      var policyFeePct = (policyYearCompleting >= payYears) ? lowFeePct : (gwa4PolicyFeePct(choice, policyYearCompleting) / 100);
      var wasLastYearPaying = policyYearCompleting <= payYears;
      var lowPremiumFee = wasLastYearPaying && plan.lowPremiumMonthlyFee && annualPremium > 0 && annualPremium < plan.lowPremiumThreshold ? plan.lowPremiumMonthlyFee * 12 : 0;
      var priorBalance = accountValue;
      var policyFeeAmount = priorBalance * policyFeePct;
      accountValue = priorBalance * (1 + expectedReturn) - policyFeeAmount - lowPremiumFee;
      var feeAmount = policyFeeAmount + lowPremiumFee;

      // Loyalty Bonus is "determined AS AT THE DATE OF THE END OF THAT
      // POLICY YEAR" (GWA4 PIP, Section 3) — based on the policy year
      // that just completed reaching the milestone, using this year's
      // own ending Account Value (confirmed against the product pack's
      // own worked example: year 10 = $300, year 12 = $360, an ongoing
      // yearly payment, not tied to ongoing premium payment, so it
      // continues even after the premium-paying term ends).
      var loyaltyBonus = policyYearCompleting >= plan.loyaltyBonusYear ? accountValue * (plan.loyaltyBonusPct / 100) : 0;
      accountValue += loyaltyBonus;

      // Policy Year `policyYearCompleting` has now ended, so Policy Year
      // `nextPolicyYear` begins immediately — if that's still within the
      // premium-paying term, its premium (and any Premium Bonus, which
      // IS tied to "receipt of each payment of Basic Regular Premium"
      // and so stops once premiums stop) is paid now.
      var nextPolicyYear = policyYearCompleting + 1;
      var isPayingYear = nextPolicyYear <= payYears;
      var thisYearPremium = isPayingYear ? annualPremium : 0;
      var premiumBonus = nextPolicyYear >= plan.premiumBonusStartYear && isPayingYear ? annualPremium * (plan.premiumBonusPct / 100) : 0;
      accountValue += thisYearPremium + premiumBonus;
      totalPremiumPaid += thisYearPremium;

      var annualDividend = accountValue * dividendYield;
      var totalBonus = loyaltyBonus + premiumBonus;

      var surrenderChargePct = gwa4SurrenderChargePct(choice, nextPolicyYear);
      var surrenderValue = accountValue * (1 - surrenderChargePct / 100);

      rows.push({
        year: yearIndex, premiumPaid: thisYearPremium, totalPremiumPaid: totalPremiumPaid, isPayingYear: isPayingYear,
        policyFeePct: policyFeePct * 100, feeAmount: feeAmount, welcomeBonus: 0, loyaltyBonus: loyaltyBonus,
        premiumBonus: premiumBonus, totalBonus: totalBonus, accountValue: accountValue, annualDividend: annualDividend,
        surrenderChargePct: surrenderChargePct, surrenderValue: surrenderValue
      });
    }
    return rows;
  }

  // GFA (Great Flexi Advantage): single premium, no ongoing Policy Fee,
  // no Insurance Charge, no Fund Switch Fee, no surrender charge (all
  // "Not Applicable" per Section E of its own Product Information
  // Pack) — just a one-time Premium Charge deducted upfront, then the
  // balance grows at the assumed return (which already reflects the
  // Fund Management Charge, since GFA's FMC is "factored into the Unit
  // Price" rather than shown as a separate deduction).
  function gfaPremiumChargePct(ageAtEntry) {
    return num(ageAtEntry) >= 76 ? 2.5 : 3.0;
  }
  function gfaProjection(lumpSum, ageAtEntry, expectedReturnPct, years, dividendYieldPct) {
    var chargePct = gfaPremiumChargePct(ageAtEntry) / 100;
    var expectedReturn = num(expectedReturnPct) / 100;
    var dividendYield = num(dividendYieldPct) / 100;
    var feeAmountYear1 = lumpSum * chargePct;
    var initialInvested = lumpSum - feeAmountYear1;
    var rows = [];
    var accountValue = initialInvested;
    // Year 0 = the instant of inception: the lump sum has just landed,
    // net of GFA's upfront Premium Charge, before any growth has had
    // time to apply. Dividends start accruing immediately on whatever's
    // already invested, so Year 0 already shows a dividend on this
    // starting balance, not zero — consistent with GWA4's Year 0.
    for (var year = 0; year <= years - 1; year++) {
      if (year > 0) accountValue = accountValue * (1 + expectedReturn);
      var premiumPaid = year === 0 ? lumpSum : 0;
      var feeAmount = year === 0 ? feeAmountYear1 : 0;
      var annualDividend = accountValue * dividendYield;
      rows.push({ year: year, accountValue: accountValue, premiumPaid: premiumPaid, feeAmount: feeAmount, annualDividend: annualDividend });
    }
    return rows;
  }

  function investmentPlanProjection(plan, projectionAge) {
    var startAge = num(plan.startAge);
    var stopAge = num(plan.stopAge);
    var endAge = num(projectionAge) || stopAge;

    // GWA4/GFA: real Great Eastern product mechanics instead of the
    // generic assumed-fee model below. Delegates to the dedicated
    // engines, then maps their output into the same row shape every
    // other caller (Dashboard, Net Worth, Retirement Planning) expects,
    // so nothing downstream needs to know these plans are special.
    if (plan.insurerProduct === 'GWA4' || plan.insurerProduct === 'GFA') {
      var years = Math.max(1, endAge - startAge + 1);
      var rawRows;
      if (plan.insurerProduct === 'GWA4') {
        var annualPremium = num(plan.monthlyPremium) * 12;
        var premiumYears = plan.gwa4PremiumYears != null && plan.gwa4PremiumYears !== '' ? num(plan.gwa4PremiumYears) : years;
        rawRows = gwa4Projection(annualPremium, plan.gwa4Choice || '10', num(plan.expectedReturn), years, premiumYears, num(plan.dividendYield));
      } else {
        rawRows = gfaProjection(num(plan.lumpSum), startAge, num(plan.expectedReturn), years, num(plan.dividendYield));
      }
      var totalPaidRunning = 0;
      return rawRows.map(function (r, i) {
        var premiumPaid = r.premiumPaid != null ? r.premiumPaid : (i === 0 ? num(plan.lumpSum) : 0);
        totalPaidRunning += premiumPaid;
        var roi = totalPaidRunning > 0 ? ((r.accountValue - totalPaidRunning) / totalPaidRunning) * 100 : 0;
        var annualDividend = r.annualDividend || 0;
        return {
          age: startAge + i, premiumPaid: premiumPaid, accumulatedValue: r.accountValue,
          annualDividend: annualDividend, monthlyDividend: annualDividend / 12, roi: roi, netCashflow: annualDividend - premiumPaid,
          switchedToDividendFund: false
        };
      });
    }

    var monthlyPremium = num(plan.monthlyPremium);
    var expectedReturn = num(plan.expectedReturn) / 100;
    var dividendYield = num(plan.dividendYield) / 100;
    var fees = num(plan.fees) / 100;
    var feesEndAge = plan.feesEndAge != null && plan.feesEndAge !== '' ? num(plan.feesEndAge) : stopAge;
    var welcomeBonus = num(plan.welcomeBonus);
    var loyaltyBonus = num(plan.loyaltyBonus);
    // Optional "switch to dividend fund at age XX": from that age onward,
    // dividends are computed off a separate, fillable dividend rate
    // instead of the plan's normal dividendYield. The accumulated-value
    // formula itself is untouched by the switch — it keeps compounding
    // exactly as it already does from premiums paid, stop age, and
    // expected return — so the fund value AT the switch age is
    // automatically the same number the rest of this projection already
    // produces, not a separately-entered figure that could disagree.
    var dividendSwitchAge = plan.dividendSwitchAge != null && plan.dividendSwitchAge !== '' ? num(plan.dividendSwitchAge) : null;
    var postSwitchDividendYield = num(plan.postSwitchDividendYield) / 100;
    // For a plan that's already been running a while, the advisor can
    // enter today's actual account value instead of trusting a from-$0
    // recomputation of every past year's premiums/returns (which likely
    // won't match the real statement anyway). If set, the projection is
    // grounded to this real figure at the given age, then keeps
    // compounding forward from there for all subsequent years.
    var currentValue = plan.currentValue != null && plan.currentValue !== '' ? num(plan.currentValue) : null;
    var currentValueAge = plan.currentValueAge != null && plan.currentValueAge !== '' ? num(plan.currentValueAge) : null;

    var rows = [];
    var accumulated = 0;
    var totalPaid = 0;

    for (var age = startAge; age <= endAge; age++) {
      var isPayingYear = age < stopAge;
      var yearPremium = isPayingYear ? monthlyPremium * 12 : 0;
      totalPaid += yearPremium;

      // Expected Return is the single total growth rate driving compounding
      // (it already represents the fund's overall growth — a separate
      // "capital growth" input used to be added on top of it, which
      // double-counted the same growth twice). Fees apply only up to
      // feesEndAge, so a platform/advisory fee that tapers off or stops
      // can be modelled instead of dragging on the whole projection.
      // Fee kept as an explicit dollar amount (not just a rate reduction)
      // so the detailed table can show what was actually deducted —
      // mathematically identical to the prior combined-rate formula.
      var feesActive = age < feesEndAge;
      var priorBalance = accumulated;
      var feeAmount = feesActive ? priorBalance * fees : 0;
      accumulated = priorBalance * (1 + expectedReturn) - feeAmount + yearPremium;

      var thisYearWelcomeBonus = age === startAge ? welcomeBonus : 0;
      var thisYearLoyaltyBonus = age === stopAge ? loyaltyBonus : 0;
      var totalBonus = thisYearWelcomeBonus + thisYearLoyaltyBonus;
      accumulated += totalBonus;
      if (currentValue !== null && currentValueAge !== null && age === currentValueAge) accumulated = currentValue;

      var hasSwitched = dividendSwitchAge != null && age >= dividendSwitchAge;
      var effectiveDividendYield = hasSwitched ? postSwitchDividendYield : dividendYield;
      var annualDividend = accumulated * effectiveDividendYield;
      var monthlyDividend = annualDividend / 12;
      var roi = totalPaid > 0 ? ((accumulated - totalPaid) / totalPaid) * 100 : 0;
      var netCashflow = annualDividend - yearPremium;

      rows.push({
        age: age,
        premiumPaid: yearPremium,
        accumulatedValue: accumulated,
        feeAmount: feeAmount,
        totalBonus: totalBonus,
        annualDividend: annualDividend,
        monthlyDividend: monthlyDividend,
        roi: roi,
        netCashflow: netCashflow,
        switchedToDividendFund: hasSwitched
      });
    }
    return rows;
  }

  function planSummary(plan) {
    var rows = investmentPlanProjection(plan, plan.projectionAge);
    var last = rows[rows.length - 1] || { accumulatedValue: 0, annualDividend: 0, monthlyDividend: 0 };
    var totalPaid = sum(rows, function (r) { return r.premiumPaid; });
    var yieldOnCost = totalPaid > 0 ? (last.annualDividend / totalPaid) * 100 : 0;
    return {
      accumulatedValue: last.accumulatedValue,
      annualDividend: last.annualDividend,
      monthlyDividend: last.monthlyDividend,
      yieldOnCost: yieldOnCost,
      cashflowGenerated: last.annualDividend
    };
  }

  function totalInvestmentValue(c) {
    return sum(c.investments, function (p) { return planSummary(p).accumulatedValue; });
  }
  function totalAnnualDividend(c) {
    return sum(c.investments, function (p) { return planSummary(p).annualDividend; });
  }
  function totalMonthlyDividend(c) { return totalAnnualDividend(c) / 12; }

  // Accumulated value of all investment plans AS OF a given age (e.g. "today"),
  // not at each plan's own projection age — used so retirement projections
  // don't double-count future growth as if it were today's balance.
  function investmentValueAtAge(c, age) {
    return sum(c.investments, function (plan) {
      var rows = investmentPlanProjection(plan, Math.max(age, num(plan.startAge)));
      if (!rows.length) return 0;
      var match = rows.filter(function (r) { return r.age <= age; });
      var row = match.length ? match[match.length - 1] : rows[0];
      return row.accumulatedValue;
    });
  }

  function passiveIncomeMonthly(c) {
    var i = c.income || {};
    var currentAge = num((c.retirement || {}).currentAge);
    return num(i.rentalIncome) + totalMonthlyDividendAtAge(c, currentAge) + num(i.investmentIncome) / 12;
  }
  function totalAnnualDividendAtAge(c, age) {
    return sum(c.investments, function (plan) {
      var rows = investmentPlanProjection(plan, Math.max(age, num(plan.startAge)));
      if (!rows.length) return 0;
      var match = rows.filter(function (r) { return r.age <= age; });
      var row = match.length ? match[match.length - 1] : rows[0];
      return row.annualDividend;
    });
  }
  function totalMonthlyDividendAtAge(c, age) { return totalAnnualDividendAtAge(c, age) / 12; }

  // ---------- RETIREMENT ----------
  function projectedDesiredMonthlyIncome(c) {
    var r = c.retirement || {};
    var yearsToRetirement = Math.max(0, num(r.retirementAge) - num(r.currentAge));
    return num(r.desiredMonthlyIncome) * Math.pow(1 + num(r.inflation) / 100, yearsToRetirement);
  }

  function retirementProjection(c) {
    var r = c.retirement || {};
    var currentAge = num(r.currentAge);
    var retireAge = num(r.retirementAge);
    var lifeExpectancy = num(r.lifeExpectancy);
    var desiredMonthly = num(r.desiredMonthlyIncome);
    var inflation = num(r.inflation) / 100;
    var expectedReturn = num(r.expectedReturn) / 100;
    var yearsToRetirement = Math.max(0, retireAge - currentAge);
    var yearsInRetirement = Math.max(0, lifeExpectancy - retireAge);

    // Desired Monthly Income can be entered either in today's dollars
    // (the default — it gets inflated forward to retirement age below) or
    // already in future dollars (use as typed, no further inflation).
    // CPF LIFE Payout is always treated as already a future-dollar
    // estimate (that's how CPF Board's own payout estimates work), so it
    // is never inflated here.
    var futureMonthlyNeed = desiredMonthly * Math.pow(1 + inflation, yearsToRetirement);
    // Required Portfolio is the GROSS desired income need — not netted
    // against CPF LIFE or passive income here. CPF is already counted as
    // an asset inside Projected Assets below, so subtracting CPF LIFE
    // from the need AND counting the CPF balance as an asset would credit
    // CPF's benefit twice. The gap (Required Portfolio minus Projected
    // Assets) is where CPF's contribution actually shows up.
    var netMonthlyNeed = futureMonthlyNeed;
    // Required Portfolio uses the real-return annuity formula, with the
    // real rate itself computed via the Fisher equation — the proper
    // way to adjust a nominal return for inflation — rather than the
    // simpler-but-less-accurate "nominal minus inflation" shortcut,
    // which understates the real return at higher rates.
    var realReturn = Math.max(0.001, (1 + expectedReturn) / (1 + inflation) - 1);
    var monthlyRate = realReturn / 12;
    var months = yearsInRetirement * 12;
    var requiredPortfolio = monthlyRate > 0
      ? netMonthlyNeed * (1 - Math.pow(1 + monthlyRate, -months)) / monthlyRate
      : netMonthlyNeed * months;

    // Projected assets at retirement: the client's existing total
    // portfolio (liquid assets, which already reflect Investment
    // Planning via auto-sync, + full CPF balance) grows at Expected
    // Return, plus ongoing monthly investment the same way, until
    // retirement age.
    var currentInvestable = liquidAssets(c) + totalCpfBalance(c);
    var monthlyContribution = monthlyInvestmentAmount(c);
    var monthlyGrowth = expectedReturn / 12;
    var n = yearsToRetirement * 12;
    var fvLumpSum = currentInvestable * Math.pow(1 + monthlyGrowth, n);
    var fvContributions = monthlyGrowth > 0
      ? monthlyContribution * ((Math.pow(1 + monthlyGrowth, n) - 1) / monthlyGrowth)
      : monthlyContribution * n;

    var projectedAssets = fvLumpSum + fvContributions;

    var retirementGap = requiredPortfolio - projectedAssets;
    var successProbability = requiredPortfolio > 0
      ? Dom_clamp((projectedAssets / requiredPortfolio) * 100, 0, 100)
      : 100;

    return {
      yearsToRetirement: yearsToRetirement,
      yearsInRetirement: yearsInRetirement,
      futureMonthlyNeed: futureMonthlyNeed,
      requiredPortfolio: requiredPortfolio,
      projectedAssets: projectedAssets,
      fvLumpSum: fvLumpSum,
      fvContributions: fvContributions,
      currentInvestable: currentInvestable,
      monthlyContribution: monthlyContribution,
      retirementGap: retirementGap,
      successProbability: successProbability
    };
  }

  // Year-by-year path from today's actual assets to the projected balance
  // at retirement, using the same growth-plus-contribution formula as
  // retirementProjection above (not a straight line — real compounding,
  // so it curves upward like an actual investment would).
  function retirementAssetTrajectory(c) {
    var r = c.retirement || {};
    var currentAge = num(r.currentAge);
    var retireAge = num(r.retirementAge);
    var expectedReturn = num(r.expectedReturn) / 100;
    var currentInvestable = liquidAssets(c) + totalCpfBalance(c);
    var monthlyContribution = monthlyInvestmentAmount(c);
    var monthlyGrowth = expectedReturn / 12;
    var points = [];
    for (var age = currentAge; age <= retireAge; age++) {
      var n = (age - currentAge) * 12;
      var fvLumpSum = currentInvestable * Math.pow(1 + monthlyGrowth, n);
      var fvContributions = monthlyGrowth > 0
        ? monthlyContribution * ((Math.pow(1 + monthlyGrowth, n) - 1) / monthlyGrowth)
        : monthlyContribution * n;
      points.push({ age: age, value: fvLumpSum + fvContributions });
    }
    return points;
  }

  // The "steady pace" reference line: a straight line from where the
  // client's investable assets actually stand today to the Required
  // Portfolio figure needed at retirement. It answers "if I needed to
  // close this gap at a perfectly even pace, what balance should I have
  // at each age along the way?" — plotted alongside the real (curved)
  // projection above, so the two lines crossing or diverging shows
  // whether the client is ahead of or behind the pace they'd need.
  function requiredPortfolioPace(c) {
    var r = c.retirement || {};
    var currentAge = num(r.currentAge);
    var retireAge = num(r.retirementAge);
    var years = Math.max(0.0001, retireAge - currentAge);
    var startValue = liquidAssets(c) + totalCpfBalance(c);
    var target = retirementProjection(c).requiredPortfolio;
    var points = [];
    for (var age = currentAge; age <= retireAge; age++) {
      var frac = (age - currentAge) / years;
      points.push({ age: age, value: startValue + (target - startValue) * frac });
    }
    return points;
  }
  function Dom_clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  // Classic FIRE-style definition: what fraction of TODAY's monthly
  // expenses could already be covered by passive income today. This is
  // deliberately a different metric from "Retirement Progress" (% of the
  // portfolio required AT retirement that's been accumulated) — showing
  // the same number under two names was a real bug.
  function financialIndependencePercent(c) {
    var expenses = monthlyExpenses(c);
    if (expenses <= 0) return 100;
    return Dom_clamp((passiveIncomeMonthly(c) / expenses) * 100, 0, 999);
  }

  function projectedRetirementAge(c) {
    // iterate retirement age forward until projected assets >= required portfolio, else return max tested
    var r = c.retirement || {};
    var base = JSON.parse(JSON.stringify(c));
    for (var age = num(r.currentAge) + 1; age <= 85; age++) {
      base.retirement.retirementAge = age;
      var rp = retirementProjection(base);
      if (rp.projectedAssets >= rp.requiredPortfolio) return age;
    }
    return null; // not achievable by 85 given current inputs
  }

  // ---------- AUTO CPF CONTRIBUTION (drives the auto-managed CPF line
  // item under Cashflow -> Investment, tagged with autoCpf: true) ----------
  // Single source of truth for "how much CPF contribution this month,
  // given employment status" — used by the CPF page, the Cashflow
  // auto-CPF item, and the age-55 projection, so they can never disagree.
  // Full/Part-Time Employed: normal employee+employer CPF rates.
  // Self-Employed: MediSave only (no OA/SA, no employer — self-employed
  // persons in Singapore aren't required to contribute to OA/SA, and
  // obviously have no employer). Unemployed: nothing.
  function cpfContributionBreakdown(c, age) {
    var status = (c.personal || {}).employmentStatus;
    var salary = monthlyIncome(c);
    if (status === 'Self-Employed') {
      // Self-employed CPF contributions vary too much by actual net trade
      // income and voluntary choices for a formula to estimate reliably —
      // no automatic mandatory estimate here. Whatever the advisor enters
      // under Additional Yearly Contributions (Voluntary) on the CPF page
      // is the entire self-employed contribution; it's added directly in
      // cpfProjectionTo55, not duplicated through this function.
      return { employee: 0, employer: 0, total: 0, allocation: { oa: 0, sa: 0, ma: 0 }, rates: { employee: 0, employer: 0 }, wageBase: 0, medisaveOnly: true };
    }
    if (status === 'Unemployed') {
      return { employee: 0, employer: 0, total: 0, allocation: { oa: 0, sa: 0, ma: 0 }, rates: { employee: 0, employer: 0 }, wageBase: 0, medisaveOnly: false };
    }
    // Full-Time or Part-Time Employed (or unset — default to employee rates)
    var contrib = SG.monthlyCpfContribution(salary, age);
    return { employee: contrib.employee, employer: contrib.employer, total: contrib.total, allocation: SG.allocationForAge(age), rates: contrib.rates, wageBase: contrib.wageBase, medisaveOnly: false };
  }

  function autoCpfContribution(c) {
    var age = ageFromDob((c.personal || {}).dob) || num((c.retirement || {}).currentAge) || 35;
    var status = (c.personal || {}).employmentStatus;
    if (status === 'Self-Employed') {
      // No formula estimate for self-employed — pulls from whatever the
      // advisor entered under Additional Yearly Contributions (Voluntary)
      // on the CPF page, same source cpfProjectionTo55 uses.
      var cpf = c.cpf || {};
      return (num(cpf.voluntaryAllAccounts) + num(cpf.voluntarySA) + num(cpf.voluntaryMA)) / 12;
    }
    return cpfContributionBreakdown(c, age).employee;
  }

  // Year-by-year OA/SA/MA balance projection from today to age 55, using
  // current CPF interest rates (OA 2.5% p.a., SA/MA 4% p.a. floor rates as
  // at 2026 — actual rates are reviewed quarterly by CPF Board and this
  // does not model the extra +1%/+2% bonus interest on small balances),
  // this month's contribution (employment-status aware, see above) held
  // constant, and an optional monthly OA deduction for mortgage/home loan
  // repayment.
  var CPF_OA_RATE = 0.025;
  var CPF_SA_MA_RATE = 0.04;
  var CPF_ANNUAL_LIMIT = 37740; // total CPF contributions (mandatory + most voluntary) per calendar year, all ages; source: cpf.gov.sg. Voluntary MediSave-only top-ups are capped by BHS alone instead, per IRAS.

  // Generic helper: look up a year in a known-values table, or project
  // forward from the last known year at an assumed growth rate. Shared by
  // BHS and the three Retirement Sum tiers (BRS/FRS/ERS) below, since both
  // follow the same "CPF Board confirms a year or a few years ahead, then
  // it's an assumption" pattern.
  function projectedSumForYear(table, growthRate, year) {
    var knownYears = Object.keys(table).map(Number);
    var lastKnownYear = Math.max.apply(null, knownYears);
    var firstKnownYear = Math.min.apply(null, knownYears);
    if (table[year] != null) return { amount: table[year], isOfficial: true };
    if (year < firstKnownYear) return { amount: table[firstKnownYear], isOfficial: true };
    var yearsBeyond = year - lastKnownYear;
    return { amount: table[lastKnownYear] * Math.pow(1 + growthRate, yearsBeyond), isOfficial: false };
  }

  // Basic Healthcare Sum by calendar year. Unlike the Retirement Sums
  // below, CPF Board only confirms BHS about a year ahead each December
  // (not several years like BRS/FRS/ERS) — 2025 and 2026 are the only
  // officially confirmed figures as of this writing. Beyond that, this
  // assumes the historical average pace (3.79%/4.38%/5.59%/4.64% for
  // 2023-2026) continues — clearly a projection, not an official number,
  // for any year not in this table.
  var BHS_TABLE = { 2025: 75500, 2026: 79000 };
  var BHS_GROWTH_RATE = 0.046;
  function bhsForYear(year) { return projectedSumForYear(BHS_TABLE, BHS_GROWTH_RATE, year); }

  // Retirement Sum tiers by the calendar year a member turns 55 — BRS/FRS/
  // ERS are fixed for life once set at 55. CPF Board has officially
  // announced these through 2027; beyond that this assumes the same
  // ~3.5%/year pace CPF Board itself used for 2023-2027.
  var BRS_TABLE = { 2025: 106500, 2026: 110200, 2027: 114100 };
  var FRS_TABLE = { 2025: 213000, 2026: 220400, 2027: 228200 };
  var ERS_TABLE = { 2025: 426000, 2026: 440800, 2027: 456400 };
  var RETIREMENT_SUM_GROWTH_RATE = 0.035;
  function retirementSumForYear(tier, year, growthRateOverride) {
    var table = tier === 'BRS' ? BRS_TABLE : tier === 'ERS' ? ERS_TABLE : FRS_TABLE;
    var rate = growthRateOverride != null ? growthRateOverride : RETIREMENT_SUM_GROWTH_RATE;
    return projectedSumForYear(table, rate, year);
  }
  // Rough CPF LIFE Standard Plan payout estimate, cross-referenced
  // against CPF Board's own published examples: for the 2026 cohort,
  // BRS S$110,200 -> ~S$950/month, FRS S$220,400 -> ~S$1,780/month, ERS
  // S$440,800 -> ~S$3,440/month (all "amount set aside AT 55" mapped to
  // "payout FROM 65" — the growth from 55 to 65 is already baked into
  // these official figures). The ratio is applied to RA right at the
  // age-55 transition, NOT this tool's own further-projected RA at 65 —
  // re-growing an already-55-to-65-inclusive ratio on top of this app's
  // own 55-65 growth simulation would double up two different sets of
  // growth assumptions and overstate the result.
  //
  // These published anchors aren't consistently labelled by gender, but
  // CPF LIFE is a life annuity, so the real payout genuinely differs by
  // gender — for the same RA balance, a female member's payout runs
  // ~7.8% lower than a male member's, reflecting longer average life
  // expectancy (the same pool of money is expected to be paid out over
  // more years). This ratio is consistent across multiple published
  // examples (e.g. FRS: male ~$1,540 vs female ~$1,420; ERS: male
  // ~$3,080 vs female ~$2,840 — both ratios are 0.9221 to 4 decimal
  // places), so it's applied here as a correction to the base (male-
  // leaning) anchor ratio above. This remains a planning estimate only,
  // NOT an official CPF LIFE quote — always defer to the official CPF
  // LIFE Estimator at cpf.gov.sg for a precise, gender-correct figure.
  var CPF_LIFE_PAYOUT_PER_DOLLAR_RA55 = 1780 / 220400; // FRS anchor, ~0.008076
  var CPF_LIFE_FEMALE_ADJUSTMENT = 0.9221;
  function estimatedCpfLifePayout(c) {
    var proj = cpfProjectionFull(c);
    var transitionRow = proj.filter(function (r) { return r.transitioned55; })[0];
    var raAt55 = transitionRow ? transitionRow.ra : num((c.cpf || {}).ra);
    var base = raAt55 * CPF_LIFE_PAYOUT_PER_DOLLAR_RA55;
    var gender = ((c.personal || {}).gender || '').toLowerCase();
    return gender === 'female' ? base * CPF_LIFE_FEMALE_ADJUSTMENT : base;
  }

  function frsAtClientAge55(c) {
    var currentAge = ageFromDob((c.personal || {}).dob) || num((c.retirement || {}).currentAge);
    if (!currentAge) return null;
    var yearTurns55 = new Date().getFullYear() + (55 - currentAge);
    var growthRateOverride = (c.cpf || {}).retirementSumGrowthRate != null && (c.cpf || {}).retirementSumGrowthRate !== '' ? num(c.cpf.retirementSumGrowthRate) / 100 : null;
    var result = retirementSumForYear('FRS', yearTurns55, growthRateOverride);
    return { year: yearTurns55, amount: result.amount, isOfficial: result.isOfficial };
  }
  // Full CPF projection from today's age to 99 — contributions, MA
  // capped at the (rising, then 65-locked) BHS, voluntary contributions
  // subject to the CPF Annual Limit exactly as in the mandatory-only
  // years, mandatory contributions stopping at the fillable "Stop Work
  // Age" (voluntary contributions can still continue after that), a real
  // Retirement Account formed at 55 from SA (topped up by OA if short)
  // up to the selected Retirement Sum tier (BRS/FRS/ERS), the official
  // extra-interest tiers (+1% on the first $60k combined below 55, +2%/
  // +1% on the first/next $30k from 55, OA capped at $20k of that, with
  // OA's own extra interest credited to SA/RA rather than OA itself, per
  // CPF Board's published mechanics), and CPF LIFE payouts drawing down
  // RA from age 65 (using the CPF LIFE Payout entered on Retirement
  // Planning) rather than letting RA compound indefinitely.
  function cpfExtraInterest(oaBal, saOrRaBal, maBal, age) {
    var oaForExtra = Math.min(oaBal, 20000);
    var afterOA = Math.max(0, 60000 - oaForExtra);
    var saOrRaForExtra = Math.min(Math.max(saOrRaBal, 0), afterOA);
    var afterSaOrRa = Math.max(0, afterOA - saOrRaForExtra);
    var maForExtra = Math.min(Math.max(maBal, 0), afterSaOrRa);

    function tierAmount(cumBefore, amount) {
      if (age < 55) return amount * 0.01;
      var cumAfter = cumBefore + amount;
      var inFirst30k = Math.max(0, Math.min(cumAfter, 30000) - Math.min(cumBefore, 30000));
      var inNext30k = Math.max(0, Math.min(cumAfter, 60000) - Math.max(cumBefore, 30000));
      return inFirst30k * 0.02 + inNext30k * 0.01;
    }

    var oaExtra = tierAmount(0, oaForExtra); // credited to SA/RA, not OA
    var saOrRaOwnExtra = tierAmount(oaForExtra, saOrRaForExtra);
    var maExtra = tierAmount(oaForExtra + saOrRaForExtra, maForExtra);
    return { oaExtraToSaRa: oaExtra, saOrRaExtra: saOrRaOwnExtra, maExtra: maExtra };
  }

  function cpfProjectionFull(c) {
    var currentAge = ageFromDob((c.personal || {}).dob) || num((c.retirement || {}).currentAge) || 30;
    if (currentAge >= 99) return [];
    var cpf = c.cpf || {};
    var stopWorkAge = cpf.stopWorkAge != null && cpf.stopWorkAge !== '' ? num(cpf.stopWorkAge) : 65;
    var retirementSumTier = cpf.retirementSumTier || 'FRS';
    var retirementSumGrowthRate = cpf.retirementSumGrowthRate != null && cpf.retirementSumGrowthRate !== '' ? num(cpf.retirementSumGrowthRate) / 100 : null;
    var mortgageDeduction = num(cpf.monthlyMortgageDeduction);
    var mortgageDeductionEndAge = cpf.mortgageDeductionEndAge != null && cpf.mortgageDeductionEndAge !== '' && num(cpf.mortgageDeductionEndAge) > 0 ? num(cpf.mortgageDeductionEndAge) : 999;
    var voluntaryAllAccounts = num(cpf.voluntaryAllAccounts);
    var voluntarySA = num(cpf.voluntarySA);
    var voluntaryMA = num(cpf.voluntaryMA);
    var voluntaryEndAge = cpf.voluntaryEndAge != null && cpf.voluntaryEndAge !== '' && num(cpf.voluntaryEndAge) > 0 ? num(cpf.voluntaryEndAge) : 999;
    var homePurchaseAge = cpf.homePurchaseAge != null && cpf.homePurchaseAge !== '' ? num(cpf.homePurchaseAge) : null;
    var homePurchaseOA = num(cpf.homePurchaseDownpaymentOA);
    var oa = num(cpf.oa), sa = num(cpf.sa), ma = num(cpf.ma), ra = num(cpf.ra);
    var currentYear = new Date().getFullYear();
    var bhsLockedAt65 = null;

    var rows = [{
      age: currentAge, oa: oa, sa: sa, ma: ma, ra: ra, total: oa + sa + ma + ra,
      addedOA: 0, addedSA: 0, addedRA: 0, addedMA: 0, bhsCapped: false, annualLimitCapped: false, transitioned55: false
    }];

    for (var age = currentAge; age < 99; age++) {
      var calendarYear = currentYear + (age - currentAge);
      var bhsThisYear = bhsLockedAt65 !== null ? bhsLockedAt65 : bhsForYear(calendarYear).amount;
      var isBelow55 = age < 55;

      var isWorking = age < stopWorkAge;
      var contrib = isWorking ? cpfContributionBreakdown(c, age) : { total: 0, allocation: { oa: 0, sa: 0, ma: 0 } };
      var mandatoryAnnual = contrib.total * 12;
      var mandatoryOA = mandatoryAnnual * contrib.allocation.oa;
      var mandatorySAPortion = mandatoryAnnual * contrib.allocation.sa;
      var mandatoryMA = mandatoryAnnual * contrib.allocation.ma;

      // Voluntary contributions stop from the fillable end age, same
      // pattern as Stop Work Age and Mortgage Fully Paid By Age — lets
      // an advisor model a client who plans a set number of years of
      // top-ups rather than assuming they continue indefinitely.
      var isVoluntaryActive = age < voluntaryEndAge;
      var voluntaryRequested = isVoluntaryActive ? (voluntaryAllAccounts + voluntarySA) : 0;
      var headroom = Math.max(0, CPF_ANNUAL_LIMIT - mandatoryAnnual);
      var annualLimitCapped = voluntaryRequested > headroom;
      var scale = voluntaryRequested > 0 ? Math.min(1, headroom / voluntaryRequested) : 0;
      var actualVoluntaryAllAccounts = isVoluntaryActive ? voluntaryAllAccounts * scale : 0;
      var actualVoluntarySA = isVoluntaryActive ? voluntarySA * scale : 0;
      var activeVoluntaryMA = isVoluntaryActive ? voluntaryMA : 0;

      var standardAllocation = SG.allocationForAge(age);
      var annualOAContrib = mandatoryOA + actualVoluntaryAllAccounts * standardAllocation.oa;
      var annualSAOrRAContrib = mandatorySAPortion + actualVoluntaryAllAccounts * standardAllocation.sa + actualVoluntarySA;
      var annualMAContrib = mandatoryMA + actualVoluntaryAllAccounts * standardAllocation.ma + activeVoluntaryMA;

      // Extra interest tiers, computed on start-of-year balances. SA is
      // the "SA-or-RA" account below 55; RA takes over from 55 onward
      // (including the transition year itself, since SA still holds the
      // balance for that whole year until it closes at year-end).
      var saOrRaBalance = isBelow55 ? sa : ra;
      var extra = cpfExtraInterest(oa, saOrRaBalance, ma, age);

      var oaInterest = oa * CPF_OA_RATE;
      var saOrRaBaseInterest = saOrRaBalance * CPF_SA_MA_RATE;
      // Once MA has genuinely reached its cap, it earns NO further
      // interest at all (base or bonus) — MA literally cannot hold more
      // than the Basic Healthcare Sum, so it just sits flat from here,
      // rather than manufacturing a "phantom" interest amount every year
      // that has to be perpetually redirected elsewhere. Only genuinely
      // NEW contributions arriving at an already-maxed MA still need to
      // redirect (that's a real, one-off event each time it happens, not
      // an ongoing leak).
      var maAlreadyAtCap = ma >= bhsThisYear;
      var maBaseInterest = maAlreadyAtCap ? 0 : ma * CPF_SA_MA_RATE;
      var maExtraInterest = maAlreadyAtCap ? 0 : extra.maExtra;

      // MediSave: base + extra interest, plus contributions, capped at
      // the (rising, then 65-locked) BHS — any excess (interest or
      // contribution) overflows to SA/RA instead.
      var maInterestTotal = maBaseInterest + maExtraInterest;
      var maRoomBeforeContribution = Math.max(0, bhsThisYear - (ma + maInterestTotal));
      var maAccepted = Math.min(annualMAContrib, maRoomBeforeContribution);
      var contributionOverflow = annualMAContrib - maAccepted;
      var maBeforeFinalCap = ma + maInterestTotal + maAccepted;
      var interestOverflow = Math.max(0, maBeforeFinalCap - bhsThisYear);
      var totalMAOverflow = contributionOverflow + interestOverflow;
      var bhsCapped = totalMAOverflow > 0;
      ma = Math.min(bhsThisYear, maBeforeFinalCap);

      // OA: base interest + contributions only — its OWN extra interest
      // is redirected to SA/RA, per CPF Board rules, not kept in OA.
      oa = Math.max(0, oa - (age < mortgageDeductionEndAge ? mortgageDeduction * 12 : 0));
      oa = oa + oaInterest + annualOAContrib;
      // One-time home purchase down payment withdrawn from OA — happens
      // exactly when the client reaches the specified age.
      var homePurchaseThisYear = (homePurchaseAge !== null && age + 1 === homePurchaseAge) ? Math.min(oa, homePurchaseOA) : 0;
      oa = oa - homePurchaseThisYear;

      var transitioned55 = false, transitionedToCpfLife = false, addedSA = 0, addedRA = 0, redirectedToOA = 0;
      // True for the transition row itself and every row after it — from
      // this point display uses "age arrived at" rather than "age at
      // start of year", since the transition is naturally indexed by the
      // age it happens AT (55), and switching the whole tail of the
      // table to the same convention keeps it consistent with no gaps
      // or collisions against the ordinary pre-55 rows.
      var isPostTransition = age >= 54;
      var saOrRaGrowth = saOrRaBaseInterest + extra.saOrRaExtra + extra.oaExtraToSaRa + annualSAOrRAContrib + totalMAOverflow;
      // Tracked separately purely for display, so the yearly table can
      // show WHY a balance grew — interest alone vs. contributions still
      // arriving (because the client hasn't reached Stop Work Age yet)
      // vs. MediSave overflow (because MA is already at its cap) — rather
      // than a single opaque total that looks like "just interest".
      var saOrRaInterestPortion = saOrRaBaseInterest + extra.saOrRaExtra + extra.oaExtraToSaRa;
      var saOrRaContribAndOverflowPortion = annualSAOrRAContrib + totalMAOverflow;

      if (age === 54) {
        // Last year before 55: SA still earns its own interest and
        // receives contributions/overflow, THEN transitions into RA.
        // Money is taken from SA first; only if SA alone falls short of
        // the target does OA get tapped for the difference. Any SA
        // balance BEYOND the target isn't needed for RA and flows back
        // to OA instead of being discarded.
        sa = sa + saOrRaGrowth;
        // Age 54 gets its own row here, BEFORE the RA conversion below —
        // otherwise the conversion (correctly labelled "Age 55", since
        // that's when it actually happens) would silently swallow age
        // 54's row entirely, making the table jump straight from 53 to
        // 55 with no explanation.
        rows.push({
          age: age + 1, oa: oa, sa: sa, ma: ma, ra: ra, total: oa + sa + ma + ra,
          addedOA: annualOAContrib + redirectedToOA, addedSA: saOrRaGrowth, addedRA: 0, addedMA: maAccepted,
          addedRAInterest: 0, addedRAContribOverflow: 0, homePurchaseWithdrawal: homePurchaseThisYear,
          bhsCapped: bhsCapped, annualLimitCapped: annualLimitCapped, transitioned55: false, transitionedToCpfLife: false,
          displayAgeOverride: 54
        });
        homePurchaseThisYear = 0; // already reported on the age-54 row above; avoid double-marking the age-55 transition row too
        var targetSum = retirementSumForYear(retirementSumTier, calendarYear + 1, retirementSumGrowthRate).amount;
        var fromSA = Math.min(sa, targetSum);
        var excessSA = Math.max(0, sa - targetSum);
        var shortfall = Math.max(0, targetSum - fromSA);
        var fromOA = Math.min(oa, shortfall);
        ra = fromSA + fromOA;
        oa = oa - fromOA + excessSA;
        sa = 0;
        transitioned55 = true;
        addedRA = ra; // the whole formed RA, for display on the transition year
      } else if (age >= 55 && age < 64) {
        ra = ra + saOrRaGrowth;
        addedRA = saOrRaGrowth;
      } else if (age === 64) {
        // At 65, CPF LIFE starts: RA still earns its final year of
        // interest and receives any last contributions/overflow, THEN
        // the balance is used to fund the annuity premium — NOT left
        // sitting as a personal balance that simply stops growing. Per
        // CPF Board, once payouts begin, RA is effectively emptied into
        // the pooled CPF LIFE scheme; modelling it as merely "frozen"
        // would wrongly suggest that money is still there and spendable
        // as a lump sum. The RA value right before this conversion is
        // what the CPF LIFE Payout estimate (on Retirement Planning) is
        // based on. From here, the client's ongoing CPF-derived income
        // is that monthly payout, not a continuing RA balance. Anything
        // that would otherwise still flow into RA (contributions,
        // MediSave overflow) redirects to OA instead.
        ra = ra + saOrRaGrowth;
        transitionedToCpfLife = true;
        ra = 0;
        addedRA = 0;
      } else if (age >= 65) {
        var redirectToOA65 = annualSAOrRAContrib + totalMAOverflow;
        oa = oa + redirectToOA65;
        redirectedToOA = redirectToOA65;
        ra = 0;
        addedRA = 0;
      } else {
        sa = sa + saOrRaGrowth;
        addedSA = saOrRaGrowth;
      }

      if (age + 1 === 65) bhsLockedAt65 = bhsThisYear;

      rows.push({
        age: age + 1, oa: oa, sa: sa, ma: ma, ra: ra, total: oa + sa + ma + ra,
        addedOA: annualOAContrib + redirectedToOA, addedSA: addedSA, addedRA: addedRA, addedMA: maAccepted,
        addedRAInterest: (age >= 55 && age < 65) ? saOrRaInterestPortion : 0,
        addedRAContribOverflow: (age >= 55 && age < 65) ? saOrRaContribAndOverflowPortion : 0,
        homePurchaseWithdrawal: homePurchaseThisYear,
        bhsCapped: bhsCapped, annualLimitCapped: annualLimitCapped, transitioned55: transitioned55, transitionedToCpfLife: transitionedToCpfLife,
        isPostTransition: isPostTransition
      });
    }
    return rows;
  }
  // Backward-compatible alias for any code still expecting the old name —
  // now runs to 99 instead of stopping at 55, but the shape is a superset.
  function cpfProjectionTo55(c) { return cpfProjectionFull(c); }

  // ---------- BANK ACCOUNT BUCKETS (3-bucket automation) ----------
  // Each cashflow category carries its own bucket tag (Bills/Savings/Fun,
  // editable on the Cashflow page), so this just groups + totals by that
  // tag — no separate data entry, and changing a category's bucket here
  // instantly moves it between accounts.
  function bucketTotals(c) {
    var cats = c.cashflowCategories || [];
    var groups = { Bills: [], Savings: [], Fun: [] };
    cats.forEach(function (cat) {
      var bucket = groups[cat.bucket] ? cat.bucket : 'Bills';
      groups[bucket].push({ key: cat.id, label: cat.name, value: categoryMonthlyTotal(cat) });
    });
    var billsTotal = sum(groups.Bills, function (x) { return x.value; });
    var savingsTotal = sum(groups.Savings, function (x) { return x.value; });
    var funTotal = sum(groups.Fun, function (x) { return x.value; });
    var income = monthlyIncome(c);
    var leftover = income - billsTotal - savingsTotal - funTotal;
    return { income: income, bills: billsTotal, savings: savingsTotal, fun: funTotal, leftover: leftover, groups: groups };
  }

  // ---------- NET WORTH GOAL ----------
  function netWorthGoalProgress(c) {
    var goal = num((c.budgetGoals || {}).netWorthGoal);
    if (goal <= 0) return 0;
    return Dom_clamp((netWorth(c) / goal) * 100, 0, 999);
  }

  // ---------- NET WORTH HISTORY (for the Assets/Debt/Net Worth trend chart) ----------
  function netWorthHistorySeries(c) {
    var hist = c.netWorthHistory || [];
    return hist.map(function (h) {
      var a = num(h.assets), l = num(h.liabilities);
      return { month: h.month, assets: a, liabilities: l, netWorth: a - l };
    });
  }
  var MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function recordNetWorthSnapshot(c) {
    var monthLabel = MONTH_ABBR[new Date().getMonth()];
    var hist = (c.netWorthHistory || []).slice();
    var entry = { month: monthLabel, assets: totalAssets(c), liabilities: totalLiabilities(c) };
    var idx = hist.length ? hist.length - 1 : -1;
    if (idx >= 0 && hist[idx].month === monthLabel) hist[idx] = entry;
    else hist.push(entry);
    return hist;
  }

  // simple least-squares linear trendline, used for the Investment Returns chart
  function linearTrendline(values) {
    var n = values.length;
    if (n === 0) return [];
    var sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (var i = 0; i < n; i++) { sumX += i; sumY += values[i]; sumXY += i * values[i]; sumXX += i * i; }
    var denom = (n * sumXX - sumX * sumX) || 1;
    var slope = (n * sumXY - sumX * sumY) / denom;
    var intercept = (sumY - slope * sumX) / n;
    var out = [];
    for (var j = 0; j < n; j++) out.push(intercept + slope * j);
    return out;
  }
  function emergencyFundMonths(c) {
    var exp = monthlyExpenses(c);
    if (exp <= 0) return 0;
    return num((c.assets || {}).cash) / exp;
  }

  // ---------- GOALS ----------
  function goalMonthlyRequired(goal) {
    var target = num(goal.targetAmount);
    var current = num(goal.currentAmount);
    var years = Math.max(0.1, num(goal.yearsLeft));
    var rate = num(goal.expectedReturn) / 100 || 0.04;
    var months = years * 12;
    var monthlyRate = rate / 12;
    var fvCurrent = current * Math.pow(1 + rate, years);
    var remaining = Math.max(0, target - fvCurrent);
    if (monthlyRate === 0) return remaining / months;
    return remaining * monthlyRate / (Math.pow(1 + monthlyRate, months) - 1);
  }
  // ---------- TAX RELIEFS (IRAS, YA2026 rates) ----------
  // Qualifying Child Relief: $4,000 per child, auto-counted from the
  // Dependants list on Client Profile (relation === 'Child') rather than
  // typed in separately, so it can't drift out of sync with who's
  // actually on file.
  function qualifyingChildRelief(c) {
    var deps = c.dependants || [];
    var children = deps.filter(function (d) { return (d.relation || '').toLowerCase() === 'child'; });
    return children.length * 4000;
  }
  // ---------- EARNED INCOME RELIEF (auto-computed, IRAS caps by age) ----------
  // Lesser of actual earned income (employment/trade/business — not
  // rental or investment income, which aren't "earned") or the age-based
  // cap. Source: iras.gov.sg Earned Income Relief.
  function earnedIncomeReliefCap(age) {
    if (age >= 60) return 8000;
    if (age >= 55) return 6000;
    return 1000;
  }
  function autoEarnedIncomeRelief(c) {
    var age = ageFromDob((c.personal || {}).dob) || num((c.retirement || {}).currentAge) || 35;
    var i = c.income || {};
    var earned = num(i.salary) * 12 + num(i.bonus) + num(i.businessIncome) * 12;
    return Math.min(earned, earnedIncomeReliefCap(age));
  }

  var PERSONAL_RELIEF_CAP = 80000; // IRAS overall cap on total personal reliefs, all YAs since 2018
  function totalTaxReliefs(c) {
    var r = (c.tax || {}).reliefs || {};
    var status = (c.personal || {}).employmentStatus;
    // Earned Income Relief and CPF Relief are auto-computed and shown as
    // read-only badges in the UI — the total here MUST use those same
    // auto-computed numbers, not the separate (and possibly stale) manual
    // fields, or the displayed badges and the total would silently
    // disagree. CPF Relief only auto-computes for Full/Part-Time Employed;
    // Self-Employed/Unemployed keep it as a manual field since self-employed
    // CPF relief follows different (MediSave-based) rules entirely.
    var earnedIncome = autoEarnedIncomeRelief(c);
    var cpfRelief = (status === 'Self-Employed' || status === 'Unemployed') ? num(r.cpfRelief) : (autoCpfContribution(c) * 12);
    var manualSum = earnedIncome + cpfRelief + num(r.spouseRelief) + num(r.wmcr) +
      num(r.parentRelief) + num(r.grandparentCaregiver) + num(r.cpfCashTopUp) + num(r.srs) + num(r.others);
    var uncapped = manualSum + qualifyingChildRelief(c);
    return {
      uncapped: uncapped, capped: Math.min(uncapped, PERSONAL_RELIEF_CAP), wasCapped: uncapped > PERSONAL_RELIEF_CAP,
      earnedIncome: earnedIncome, cpfRelief: cpfRelief
    };
  }

  // ---------- HOSPITAL PLAN PREMIUM FINANCING ----------
  // Integrated Shield Plan-style premiums escalate steeply with age (both
  // because rates go up by age band, and because claims risk rises).
  // Rather than hardcode any insurer's actual current rates — which vary
  // by rider, change often, and require pulling from that insurer's own
  // portal for accuracy in front of a real client — this models the
  // escalation with a single annual growth rate the advisor sets from the
  // insurer's current illustration, split into the CPF-MediSave-payable
  // and cash-payable portions.
  function hospitalPremiumProjection(policy) {
    var startAge = num(policy.startAge) || 30;
    var endAge = num(policy.endAge) || 99;
    var annualPremium = policyAnnualPremium(policy);
    var escalation = num(policy.annualEscalationRate) / 100;
    var medisavePercent = Dom_clamp(num(policy.medisavePercent), 0, 100) / 100;
    var rows = [];
    var cumCash = 0, cumMedisave = 0;
    for (var age = startAge; age <= endAge; age++) {
      var yearsElapsed = age - startAge;
      var thisYearPremium = annualPremium * Math.pow(1 + escalation, yearsElapsed);
      var medisavePortion = thisYearPremium * medisavePercent;
      var cashPortion = thisYearPremium - medisavePortion;
      cumCash += cashPortion;
      cumMedisave += medisavePortion;
      rows.push({ age: age, totalPremium: thisYearPremium, cash: cashPortion, medisave: medisavePortion, cumCash: cumCash, cumMedisave: cumMedisave });
    }
    return rows;
  }

  // ---------- NET WORTH GOAL HELPER ----------
  // Gives advisors a concrete way to help a client picture an abstract
  // lump-sum goal: "how many years of your desired retirement income does
  // this represent?" Each year's income figure is inflated forward (both
  // from today to retirement, and then year-by-year through retirement),
  // matching how retirementProjection treats inflation — so the two don't
  // silently disagree, and the goal isn't understated by using a single
  // flat income figure for a 25-year retirement.
  function netWorthGoalHelper(c) {
    var r = c.retirement || {};
    var monthlyIncome = num(r.desiredMonthlyIncome);
    var currentAge = num(r.currentAge);
    var retireAge = num(r.retirementAge);
    var lifeExp = num(r.lifeExpectancy);
    var inflation = num(r.inflation) / 100;
    var expectedReturn = num(r.expectedReturn) / 100;
    var years = Math.max(0, lifeExp - retireAge);
    var yearsToRetirement = Math.max(0, retireAge - currentAge);
    var incomeAtRetirement = monthlyIncome * Math.pow(1 + inflation, yearsToRetirement);

    // Same annuity methodology as retirementProjection's Required
    // Portfolio, so the two never disagree — a naive sum of every year's
    // withdrawal (with no credit for ongoing investment growth while
    // drawing down) would overstate what's actually needed.
    var suggestedGoal = retirementProjection(c).requiredPortfolio;

    // Bars: illustrative spending need per year (for the chart).
    // Balance line: the portfolio drawn down at the expected return,
    // starting from suggestedGoal, ending near zero at life expectancy —
    // this is what actually explains why the goal is smaller than the
    // raw sum of withdrawals.
    var yearlyIncomes = [];
    var balanceTrack = [];
    var balance = suggestedGoal;
    for (var i = 0; i < years; i++) {
      var thisYearAnnual = incomeAtRetirement * 12 * Math.pow(1 + inflation, i);
      yearlyIncomes.push(thisYearAnnual);
      balance = Math.max(0, balance * (1 + expectedReturn) - thisYearAnnual);
      balanceTrack.push(balance);
    }
    return {
      monthlyIncome: monthlyIncome, annualIncome: incomeAtRetirement * 12,
      retireAge: retireAge, lifeExpectancy: lifeExp, years: years,
      yearlyIncomes: yearlyIncomes, balanceTrack: balanceTrack,
      suggestedGoal: suggestedGoal
    };
  }

  // ---------- RETIREMENT: ASSET SPLIT, MILESTONES, ACTIONABLE GAP ----------
  // Separates "home/lifestyle" (illiquid, not funding retirement income)
  // from "income-producing retirement assets" (what can actually generate
  // retirement income) — a $3M net worth with $1.8M tied up in a home
  // reads very differently from $3M split evenly. MediSave is excluded
  // from the retirement-funding total since it can't be withdrawn for
  // general income, only approved healthcare costs.
  // ---------- COUPLE PLANNING (two linked, independently-stored clients) ----------
  // These take two full client data objects and combine them for a joint
  // view — the underlying data for each partner stays completely
  // separate and independently editable on their own pages; this only
  // reads both and adds the results together for a household picture,
  // it never writes anything back to either client.
  function combinedNetWorth(clientA, clientB) {
    var assetsA = totalAssets(clientA), assetsB = totalAssets(clientB);
    var liabA = totalLiabilities(clientA), liabB = totalLiabilities(clientB);
    return {
      totalAssets: assetsA + assetsB, totalLiabilities: liabA + liabB,
      netWorth: (assetsA - liabA) + (assetsB - liabB),
      assetsA: assetsA, assetsB: assetsB, liabA: liabA, liabB: liabB
    };
  }

  // ---------- CASH FLOW ROADMAP (year-by-year savings ledger) ----------
  // A running cash ledger from now to life expectancy — distinct from
  // Retirement Planning's "required portfolio vs projected assets"
  // comparison. Income (grown by Cashflow's Income Growth % YoY) credits
  // until Retirement Age, then stops and is replaced by Retirement
  // Payouts (CPF LIFE + dividends/passive income, editable). Expenses
  // (grown by the Roadmap's own inflation assumption) deduct every year
  // regardless of work status. Life events draw down a lump sum from the
  // running balance in the specific year they happen.
  function roadmapRetirementPayoutSuggestion(c) {
    // Uses dividend/investment income AT RETIREMENT AGE, not today's
    // figure — passiveIncomeMonthly() is tied to current age (correct
    // for showing "passive income today" elsewhere), but investment
    // plans typically grow substantially over the years until
    // retirement, so today's dividend figure would badly understate
    // what will actually be received once retired.
    var retirementAge = num((c.retirement || {}).retirementAge) || 65;
    var i = c.income || {};
    var cpfLifeMonthly = estimatedCpfLifePayout(c);
    var dividendAtRetirement = totalAnnualDividendAtAge(c, retirementAge) / 12;
    var otherPassive = num(i.rentalIncome) + num(i.investmentIncome) / 12;
    return cpfLifeMonthly + dividendAtRetirement + otherPassive;
  }

  function roadmapProjection(c) {
    var currentAge = ageFromDob((c.personal || {}).dob) || num((c.retirement || {}).currentAge) || 30;
    // Always shows at least to age 90, even if Life Expectancy elsewhere
    // is set lower — Life Expectancy there drives the retirement funding
    // target, but the roadmap itself should never cut off early just
    // because that input happens to be conservative.
    var lifeExpectancy = Math.max(num((c.retirement || {}).lifeExpectancy) || 90, 90);
    var retirementAge = num((c.retirement || {}).retirementAge) || 65;
    var rm = c.roadmap || {};
    var interestRate = (rm.interestRate != null && rm.interestRate !== '' ? num(rm.interestRate) : 0.05) / 100;
    var inflationRate = (rm.inflationRate != null && rm.inflationRate !== '' ? num(rm.inflationRate) : 2) / 100;
    var incomeGrowthRate = num((c.cashflow || {}).incomeGrowthRate) / 100;
    var retirementPayoutMonthly = rm.retirementPayoutOverride != null && rm.retirementPayoutOverride !== ''
      ? num(rm.retirementPayoutOverride) : roadmapRetirementPayoutSuggestion(c);

    var balance = num((c.assets || {}).cash);
    var annualIncome = monthlyIncome(c) * 12;
    var annualExpenses = monthlyExpenses(c) * 12;
    var annualRetirementPayout = retirementPayoutMonthly * 12;
    var lifeEvents = rm.lifeEvents || [];
    // Expenses that stop at a given age (mortgage paid off, an insurance
    // term ending, etc.) — not modelled as life events since they're a
    // permanent REDUCTION to the ongoing expense base from that point
    // forward, not a one-off or fixed-term item of their own. Each one's
    // monthly amount is entered in today's dollars and is grown to the
    // same inflation-adjusted value the main expense figure would have
    // reached by the time it stops, then continues growing at the same
    // rate indefinitely, so it stays proportional to the expense base
    // it's being subtracted from.
    var expenseStops = rm.expenseStops || [];
    var accumulatedExpenseReduction = 0;
    var currentYear = new Date().getFullYear();
    var rows = [];

    if (lifeExpectancy <= currentAge) return rows;

    for (var age = currentAge; age <= lifeExpectancy; age++) {
      var yearLabel = currentYear + (age - currentAge);
      // Never negative — a negative running balance shouldn't show as
      // "earning" negative interest (i.e. being charged on an overdraft);
      // it just earns nothing until the balance recovers.
      var interest = Math.max(0, balance * interestRate);
      balance += interest;

      var isWorking = age < retirementAge;
      var incomeCredited = 0, retirementPayoutCredited = 0;
      if (isWorking) {
        incomeCredited = annualIncome;
        balance += incomeCredited;
      } else {
        retirementPayoutCredited = annualRetirementPayout;
        balance += retirementPayoutCredited;
      }

      var stoppedThisYear = expenseStops.filter(function (es) { return num(es.endAge) === age; });
      stoppedThisYear.forEach(function (es) {
        accumulatedExpenseReduction += num(es.monthlyAmount) * 12 * Math.pow(1 + inflationRate, age - currentAge);
      });

      var expensesDeducted = Math.max(0, annualExpenses - accumulatedExpenseReduction);
      balance -= expensesDeducted;

      // Life events now support more than a single one-off lump sum:
      // - One-off (durationYears=1, the old behaviour): a car/home
      //   purchase, a lump-sum gift, etc.
      // - Recurring outflow (durationYears>1, direction='outflow'): a
      //   car loan repayment, insurance premiums for a fixed term, etc.
      // - Recurring inflow (direction='inflow'): a payout phase, e.g. an
      //   endowment or annuity-style plan paying out annually for a set
      //   number of years. A pay-in-then-payout product (like a
      //   retirement/endowment plan) is modelled as TWO separate life
      //   events sharing a name — one outflow event for the pay-in
      //   phase, one inflow event (starting later) for the payout phase
      //   — rather than one combined type, so the same simple building
      //   block covers both loans/premiums AND payout-style products.
      // Missing direction/durationYears (from events created before this
      // model existed) default to the original one-off outflow behaviour.
      var eventsThisYear = lifeEvents.filter(function (ev) {
        var evAge = num(ev.age);
        var duration = Math.max(1, ev.durationYears != null && ev.durationYears !== '' ? num(ev.durationYears) : 1);
        return age >= evAge && age < evAge + duration;
      });
      var eventNet = 0; // positive = net inflow this year, negative = net outflow
      eventsThisYear.forEach(function (ev) {
        var sign = (ev.direction || '').toLowerCase() === 'inflow' ? 1 : -1;
        eventNet += sign * num(ev.amount);
      });
      balance += eventNet;

      rows.push({
        year: yearLabel, age: age, balance: balance, interest: interest,
        incomeCredited: incomeCredited, retirementPayoutCredited: retirementPayoutCredited,
        expensesDeducted: expensesDeducted, events: eventsThisYear, eventNet: eventNet, stoppedExpenses: stoppedThisYear,
        isWorking: isWorking
      });

      if (isWorking) annualIncome *= (1 + incomeGrowthRate);
      annualExpenses *= (1 + inflationRate);
      accumulatedExpenseReduction *= (1 + inflationRate);
    }
    return rows;
  }

  function combinedRetirementProjection(clientA, clientB) {
    var rpA = retirementProjection(clientA), rpB = retirementProjection(clientB);
    var requiredPortfolio = rpA.requiredPortfolio + rpB.requiredPortfolio;
    var projectedAssets = rpA.projectedAssets + rpB.projectedAssets;
    var retirementGap = requiredPortfolio - projectedAssets;
    var successProbability = requiredPortfolio > 0 ? Dom_clamp((projectedAssets / requiredPortfolio) * 100, 0, 100) : 100;
    return {
      requiredPortfolio: requiredPortfolio, projectedAssets: projectedAssets, retirementGap: retirementGap,
      successProbability: successProbability, rpA: rpA, rpB: rpB
    };
  }

  function retirementAssetSplit(c) {
    var r = c.retirement || {};
    var currentAge = num(r.currentAge);
    var homeLifestyle = propertyValueTotal(c) - propertyLoanTotal(c);
    var cpf = c.cpf || {};
    var retirementCpf = num(cpf.oa) + num(cpf.sa) + num(cpf.ra); // excludes MediSave
    var l = c.liabilities || {};
    var otherLiabilities = num(l.creditCards) + num(l.carLoan) + num(l.personalLoan) + num(l.mortgage);
    var incomeProducing = liquidAssets(c) + retirementCpf +
      num((c.assets || {}).insuranceCashValue) + num((c.assets || {}).business) - otherLiabilities;
    var rp = retirementProjection(c);
    var futureGoal = rp.requiredPortfolio;
    // The future-dollar goal isn't directly comparable to today's assets
    // (present value) — discounted back to today at the expected return,
    // it becomes "what you'd need set aside right now, growing untouched,
    // to reach the future goal", which IS apples-to-apples with today's
    // income-producing assets.
    var expectedReturn = num(r.expectedReturn) / 100;
    var pvGoal = futureGoal / Math.pow(1 + expectedReturn, rp.yearsToRetirement || 0);
    var fundedPct = pvGoal > 0 ? Dom_clamp((incomeProducing / pvGoal) * 100, 0, 999) : 100;
    return {
      netWorth: netWorth(c), homeLifestyle: homeLifestyle, incomeProducing: incomeProducing,
      medisave: num(cpf.ma), retirementGoal: futureGoal, retirementGoalPV: pvGoal, fundedPct: fundedPct
    };
  }

  // Milestones at evenly-spaced ages between now and retirement, each
  // showing projected assets AND a plain-English stage label — replacing
  // one distant, emotionally-flat number ("$4M at 60") with a sequence a
  // client can track against as they go.
  // Milestones anchored to round FUNDING PERCENTAGES (25/50/75/100%) of
  // the retirement goal, rather than evenly-spaced ages — "you're 50%
  // funded" is a more intuitive story for a client than "at age 48
  // you'll have $1.5m", even though both come from the exact same
  // projection. For each threshold, finds the age it's actually crossed
  // by linearly interpolating between the two surrounding yearly points
  // on the trajectory (which is already based on current investable
  // assets + monthly contributions, both grown forward at the assumed
  // return, exactly as plotted elsewhere on this page).
  function retirementMilestones(c) {
    var r = c.retirement || {};
    var currentAge = num(r.currentAge);
    var retireAge = num(r.retirementAge);
    var trajectory = retirementAssetTrajectory(c);
    var goal = retirementProjection(c).requiredPortfolio;
    if (!trajectory.length || retireAge <= currentAge || goal <= 0) return [];

    var todayValue = trajectory[0].value;
    var todayPct = (todayValue / goal) * 100;

    function ageForValue(targetValue) {
      for (var i = 1; i < trajectory.length; i++) {
        var prev = trajectory[i - 1], cur = trajectory[i];
        if (cur.value >= targetValue) {
          if (cur.value === prev.value) return cur.age;
          var frac = (targetValue - prev.value) / (cur.value - prev.value);
          return prev.age + frac;
        }
      }
      return null; // never reached by retirement age
    }

    function stageLabel(pct, isFinal, reached) {
      if (isFinal) return reached ? 'Retirement funded' : 'Retirement (gap remains)';
      if (pct >= 100) return 'Ahead of pace';
      if (pct < 25) return 'Foundation';
      if (pct < 50) return 'Options increasing';
      if (pct < 80) return 'Work becoming optional';
      return 'Nearly there';
    }

    var thresholds = [25, 50, 75, 100].filter(function (t) { return t > todayPct; });
    var milestones = [{
      age: currentAge, value: todayValue, pct: todayPct, isRetirement: false,
      label: stageLabel(todayPct, false), isToday: true
    }];

    thresholds.forEach(function (t) {
      var targetValue = goal * (t / 100);
      var age = ageForValue(targetValue);
      if (age !== null && age <= retireAge) {
        milestones.push({ age: age, value: targetValue, pct: t, isRetirement: t === 100, label: stageLabel(t, t === 100, true), isToday: false });
      }
    });

    // If 100% is never reached by retirement, still show retirement age
    // itself as the final checkpoint, with whatever % it actually funds —
    // an honest endpoint rather than silently omitting the shortfall.
    var lastMilestoneIsRetirement = milestones.length && milestones[milestones.length - 1].isRetirement;
    if (!lastMilestoneIsRetirement) {
      var retirementPoint = trajectory[trajectory.length - 1];
      var retirementPct = (retirementPoint.value / goal) * 100;
      milestones.push({
        age: retireAge, value: retirementPoint.value, pct: retirementPct, isRetirement: true,
        label: stageLabel(retirementPct, true, retirementPct >= 100), isToday: false
      });
    }
    return milestones;
  }

  // The additional flat monthly amount (on top of current surplus) that
  // would close the projected gap by retirement — turns an abstract
  // dollar shortfall into a concrete, actionable number: "another $X/mo",
  // not an intimidating lump sum.
  function additionalMonthlyToCloseGap(c) {
    var rp = retirementProjection(c);
    if (rp.retirementGap <= 0) return 0;
    var r = c.retirement || {};
    var expectedReturn = num(r.expectedReturn) / 100;
    var monthlyGrowth = expectedReturn / 12;
    var n = rp.yearsToRetirement * 12;
    if (n <= 0) return rp.retirementGap;
    var factor = monthlyGrowth > 0 ? (Math.pow(1 + monthlyGrowth, n) - 1) / monthlyGrowth : n;
    return factor > 0 ? rp.retirementGap / factor : rp.retirementGap;
  }

  // Same "solve for the monthly payment" math as above, but taking gap/
  // return/years directly — lets the "Where You're Headed" scenario use
  // its own dedicated, independently-fillable return and years inputs
  // rather than always inheriting the page-level Expected Return.
  function additionalMonthlyForGap(gap, returnPct, years) {
    if (gap <= 0) return 0;
    var monthlyGrowth = (returnPct / 100) / 12;
    var n = years * 12;
    if (n <= 0) return gap;
    var factor = monthlyGrowth > 0 ? (Math.pow(1 + monthlyGrowth, n) - 1) / monthlyGrowth : n;
    return factor > 0 ? gap / factor : gap;
  }

  function goalProgress(goal) {
    var target = num(goal.targetAmount);
    if (target <= 0) return 0;
    return Dom_clamp((num(goal.currentAmount) / target) * 100, 0, 100);
  }

  // ---------- FINANCIAL RATIOS (0-100 scale gauges) ----------
  function financialRatios(c) {
    var rp = retirementProjection(c);
    return {
      savingsRatio: Dom_clamp(savingsRate(c), 0, 100),
      debtRatio: Dom_clamp(debtRatio(c), 0, 100),
      liquidityRatio: Dom_clamp(emergencyFundMonths(c) / 6 * 100, 0, 100),
      protectionRatio: Dom_clamp((combinedTotalCoverage(c) / Math.max(1, recommendedLifeCoverage(c))) * 100, 0, 100),
      investmentRatio: Dom_clamp((investmentAssetsTotal(c) / Math.max(1, totalAssets(c))) * 100, 0, 100),
      netWorthRatio: Dom_clamp((netWorth(c) / Math.max(1, totalAssets(c))) * 100, 0, 100),
      retirementRatio: Dom_clamp(rp.requiredPortfolio > 0 ? (rp.projectedAssets / rp.requiredPortfolio) * 100 : 100, 0, 100),
      passiveIncomeRatio: Dom_clamp((passiveIncomeMonthly(c) / Math.max(1, monthlyExpenses(c))) * 100, 0, 100)
    };
  }

  return {
    num: num, sum: sum, ageFromDob: ageFromDob, parseDateString: parseDateString, totalCpfBalance: totalCpfBalance,
    monthlyIncome: monthlyIncome, annualIncomeExclInvestment: annualIncomeExclInvestment, monthlyExpenses: monthlyExpenses, monthlySurplus: monthlySurplus,
    monthlyInvestmentAmount: monthlyInvestmentAmount,
    annualSurplus: annualSurplus, savingsRate: savingsRate, cashflowRatio: cashflowRatio,
    totalAssets: totalAssets, totalLiabilities: totalLiabilities, netWorth: netWorth,
    liquidAssets: liquidAssets, investmentAssetsTotal: investmentAssetsTotal, debtRatio: debtRatio,
    propertyValueTotal: propertyValueTotal, propertyLoanTotal: propertyLoanTotal,
    policyAnnualPremium: policyAnnualPremium, totalAnnualPremium: totalAnnualPremium, totalMonthlyPremium: totalMonthlyPremium,
    totalCoverageByType: totalCoverageByType, totalCoverage: totalCoverage, recommendedLifeCoverage: recommendedLifeCoverage,
    recommendedDeathTpdCoverage: recommendedDeathTpdCoverage, recommendedCICoverage: recommendedCICoverage,
    deathTpdCoverageHeld: deathTpdCoverageHeld, ciCoverageHeld: ciCoverageHeld, deathTpdGap: deathTpdGap, ciGap: ciGap,
    coverageGap: coverageGap, protectionRatio: protectionRatio, insuranceCashValueProjected: insuranceCashValueProjected,
    recommendedIncomeProtection: recommendedIncomeProtection, incomeProtectionHeld: incomeProtectionHeld,
    recommendedLongTermCare: recommendedLongTermCare, longTermCareHeld: longTermCareHeld,
    quickCoverageTotal: quickCoverageTotal, combinedTotalCoverage: combinedTotalCoverage,
    quickDeathTpdCoverage: quickDeathTpdCoverage, quickCICoverage: quickCICoverage, QUICK_COVERAGE_FIELDS: QUICK_COVERAGE_FIELDS,
    combinedCoverageByType: combinedCoverageByType,
    investmentPlanProjection: investmentPlanProjection, planSummary: planSummary,
    totalInvestmentValue: totalInvestmentValue, totalAnnualDividend: totalAnnualDividend, totalMonthlyDividend: totalMonthlyDividend,
    investmentValueAtAge: investmentValueAtAge, totalAnnualDividendAtAge: totalAnnualDividendAtAge, totalMonthlyDividendAtAge: totalMonthlyDividendAtAge,
    passiveIncomeMonthly: passiveIncomeMonthly,
    retirementProjection: retirementProjection, financialIndependencePercent: financialIndependencePercent, projectedRetirementAge: projectedRetirementAge,
    retirementAssetTrajectory: retirementAssetTrajectory, requiredPortfolioPace: requiredPortfolioPace,
    projectedDesiredMonthlyIncome: projectedDesiredMonthlyIncome,
    retirementAssetSplit: retirementAssetSplit, retirementMilestones: retirementMilestones, additionalMonthlyToCloseGap: additionalMonthlyToCloseGap,
    combinedNetWorth: combinedNetWorth, combinedRetirementProjection: combinedRetirementProjection,
    roadmapProjection: roadmapProjection, roadmapRetirementPayoutSuggestion: roadmapRetirementPayoutSuggestion,
    additionalMonthlyForGap: additionalMonthlyForGap,
    emergencyFundMonths: emergencyFundMonths,
    goalMonthlyRequired: goalMonthlyRequired, goalProgress: goalProgress,
    financialRatios: financialRatios,
    bucketTotals: bucketTotals, netWorthGoalProgress: netWorthGoalProgress,
    itemAnnual: itemAnnual, itemMonthly: itemMonthly, categoryMonthlyTotal: categoryMonthlyTotal,
    gwa4Projection: gwa4Projection, gfaProjection: gfaProjection, GWA4_RATES: GWA4_RATES,
    categoryAnnualTotal: categoryAnnualTotal, allCategoriesMonthlyTotal: allCategoriesMonthlyTotal,
    FREQUENCY_MULTIPLIER: FREQUENCY_MULTIPLIER,
    netWorthHistorySeries: netWorthHistorySeries, recordNetWorthSnapshot: recordNetWorthSnapshot,
    linearTrendline: linearTrendline, autoCpfContribution: autoCpfContribution,
    cpfContributionBreakdown: cpfContributionBreakdown, cpfProjectionTo55: cpfProjectionTo55,
    CPF_OA_RATE: CPF_OA_RATE, CPF_SA_MA_RATE: CPF_SA_MA_RATE, CPF_BHS_2026: BHS_TABLE[2026],
    CPF_ANNUAL_LIMIT: CPF_ANNUAL_LIMIT, CPF_BHS_GROWTH_RATE: BHS_GROWTH_RATE, frsAtClientAge55: frsAtClientAge55,
    estimatedCpfLifePayout: estimatedCpfLifePayout,
    retirementSumForYear: retirementSumForYear, cpfProjectionFull: cpfProjectionFull, bhsForYear: bhsForYear,
    hospitalPremiumProjection: hospitalPremiumProjection,
    netWorthGoalHelper: netWorthGoalHelper,
    qualifyingChildRelief: qualifyingChildRelief, totalTaxReliefs: totalTaxReliefs, PERSONAL_RELIEF_CAP: PERSONAL_RELIEF_CAP,
    earnedIncomeReliefCap: earnedIncomeReliefCap, autoEarnedIncomeRelief: autoEarnedIncomeRelief
  };
})();
