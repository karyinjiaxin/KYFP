/* ============================================================
   sgTax.js — Singapore CPF contribution + progressive tax brackets
   (2024/2025 resident rates, used as advisory approximations)
   ============================================================ */

var SG = (function () {
  // Resident individual income tax brackets (annual chargeable income, SGD)
  var TAX_BRACKETS = [
    { upTo: 20000, rate: 0 },
    { upTo: 30000, rate: 0.02 },
    { upTo: 40000, rate: 0.035 },
    { upTo: 80000, rate: 0.07 },
    { upTo: 120000, rate: 0.115 },
    { upTo: 160000, rate: 0.15 },
    { upTo: 200000, rate: 0.18 },
    { upTo: 240000, rate: 0.19 },
    { upTo: 280000, rate: 0.195 },
    { upTo: 320000, rate: 0.20 },
    { upTo: 500000, rate: 0.22 },
    { upTo: 1000000, rate: 0.23 },
    { upTo: Infinity, rate: 0.24 }
  ];

  function estimateIncomeTax(chargeableIncome) {
    var income = Math.max(0, Number(chargeableIncome) || 0);
    var tax = 0, lower = 0;
    for (var i = 0; i < TAX_BRACKETS.length; i++) {
      var b = TAX_BRACKETS[i];
      var bandAmount = Math.min(income, b.upTo) - lower;
      if (bandAmount > 0) tax += bandAmount * b.rate;
      lower = b.upTo;
      if (income <= b.upTo) break;
    }
    return Math.max(0, tax);
  }

  function effectiveRate(chargeableIncome) {
    var tax = estimateIncomeTax(chargeableIncome);
    return chargeableIncome > 0 ? (tax / chargeableIncome) * 100 : 0;
  }

  // Personalized incremental breakdown for a specific chargeable income —
  // "First $20,000 @ 0% = $0", "Next $10,000 @ 2% = $200", stopping at
  // the actual income (a partial final band, not the full bracket width),
  // rather than showing the whole generic table regardless of the client.
  function personalizedTaxBreakdown(chargeableIncome) {
    var income = Math.max(0, Number(chargeableIncome) || 0);
    var breakdown = [];
    var lower = 0;
    for (var i = 0; i < TAX_BRACKETS.length; i++) {
      var b = TAX_BRACKETS[i];
      if (income <= lower) break;
      var bandAmount = Math.min(income, b.upTo) - lower;
      if (bandAmount > 0) {
        var label = i === 0 ? ('First $' + bandAmount.toLocaleString()) : ('Next $' + bandAmount.toLocaleString());
        breakdown.push({ label: label, rate: b.rate, amount: bandAmount, tax: bandAmount * b.rate });
      }
      lower = b.upTo;
      if (income <= b.upTo) break;
    }
    return breakdown;
  }

  // CPF contribution rates by age band (employee + employer, applied to
  // Ordinary Wage up to ceiling). Source: CPF Board "CPF Contribution
  // Rate Table from 1 January 2026" (official PDF, cpf.gov.sg/employer),
  // reflecting the Senior Worker CPF Contribution Rate increases.
  function cpfRatesForAge(age) {
    if (age <= 55) return { employee: 0.20, employer: 0.17 };
    if (age <= 60) return { employee: 0.18, employer: 0.16 };
    if (age <= 65) return { employee: 0.125, employer: 0.125 };
    if (age <= 70) return { employee: 0.075, employer: 0.09 };
    return { employee: 0.05, employer: 0.075 };
  }

  var OW_CEILING = 8000; // monthly ordinary wage ceiling, effective 1 Jan 2026 (raised from $7,400)

  function monthlyCpfContribution(monthlySalary, age) {
    var rates = cpfRatesForAge(age);
    var wageBase = Math.min(Number(monthlySalary) || 0, OW_CEILING);
    var employee = wageBase * rates.employee;
    var employer = wageBase * rates.employer;
    return { employee: employee, employer: employer, total: employee + employer, rates: rates, wageBase: wageBase };
  }

  // Allocation of contribution across OA/SA/MA (or OA/RA/MA from 55) by
  // age band. Source: CPF Board "CPF Allocation Rates from 1 January
  // 2026" (official PDF, cpf.gov.sg/employer). Note the 55-60/60-65/65-70
  // bands allocate to a Retirement Account, not Special Account.
  function allocationForAge(age) {
    if (age <= 35) return { oa: 0.6217, sa: 0.1621, ma: 0.2162 };
    if (age <= 45) return { oa: 0.5677, sa: 0.1891, ma: 0.2432 };
    if (age <= 50) return { oa: 0.5136, sa: 0.2162, ma: 0.2702 };
    if (age <= 55) return { oa: 0.4055, sa: 0.3108, ma: 0.2837 };
    if (age <= 60) return { oa: 0.353, sa: 0.3382, ma: 0.3088 };
    if (age <= 65) return { oa: 0.14, sa: 0.44, ma: 0.42 };
    if (age <= 70) return { oa: 0.0607, sa: 0.303, ma: 0.6363 };
    return { oa: 0.08, sa: 0.08, ma: 0.84 };
  }

  // Self-employed persons in Singapore are NOT required to contribute to
  // CPF Ordinary/Special Accounts — only MediSave, and only once net
  // trade income exceeds $6,000/year. The real CPF Board formula phases
  // in gradually between $6,000–$18,000 income; this uses a flat
  // age-based rate (~6%–10.5%, per CPF Board's published range) above
  // that threshold as a reasonable approximation, not the exact tiered
  // schedule. Source: CPF Board MediSave Contribution Rates for
  // Self-Employed Persons.
  function selfEmployedMedisaveRate(age) {
    if (age < 35) return 0.06;
    if (age < 45) return 0.07;
    if (age < 50) return 0.08;
    if (age < 55) return 0.09;
    if (age < 60) return 0.085;
    if (age < 65) return 0.095;
    return 0.105;
  }
  function selfEmployedMedisaveMonthly(annualNetTradeIncome, age) {
    var income = Number(annualNetTradeIncome) || 0;
    if (income <= 6000) return 0;
    return (income * selfEmployedMedisaveRate(age)) / 12;
  }

  return {
    TAX_BRACKETS: TAX_BRACKETS,
    estimateIncomeTax: estimateIncomeTax,
    effectiveRate: effectiveRate,
    personalizedTaxBreakdown: personalizedTaxBreakdown,
    cpfRatesForAge: cpfRatesForAge,
    monthlyCpfContribution: monthlyCpfContribution,
    allocationForAge: allocationForAge,
    selfEmployedMedisaveRate: selfEmployedMedisaveRate,
    selfEmployedMedisaveMonthly: selfEmployedMedisaveMonthly,
    OW_CEILING: OW_CEILING
  };
})();
