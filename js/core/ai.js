/* ============================================================
   ai.js — AI Recommendation Engine
   Deliberately isolated: getRecommendations(client) is the ONLY
   entry point the UI calls. Today it's rule-based. To swap in a
   real LLM, replace the body of this one function with an API
   call (see anthropic_api_in_artifacts pattern) and keep the
   same return shape: [{ severity, title, detail }]
   ============================================================ */

var AI = (function () {

  function getRecommendations(client) {
    var recs = [];
    var c = client;

    var savingsRate = Calc.savingsRate(c);
    if (savingsRate < 10) {
      recs.push({
        severity: 'high',
        title: 'Savings rate is low',
        detail: 'Current savings rate is ' + Dom.fmtPct(savingsRate) + '. Consider trimming discretionary expenses or increasing income to reach a healthier 20%+ savings rate.'
      });
    }

    var efMonths = Calc.emergencyFundMonths(c);
    var targetMonths = ((c.emergencyFund || {}).targetMonths) || 6;
    if (efMonths < targetMonths) {
      recs.push({
        severity: 'high',
        title: 'Emergency fund is insufficient',
        detail: 'Client has ' + efMonths.toFixed(1) + ' months of expenses in cash reserves, below the ' + targetMonths + '-month target. Recommend building this up before increasing investment contributions.'
      });
    }

    var gap = Calc.coverageGap(c);
    if (gap > 0) {
      recs.push({
        severity: 'high',
        title: 'Client is underinsured',
        detail: 'Estimated protection gap of ' + Dom.fmtMoney(gap) + ' against a 10x-income + liabilities benchmark. Review life and critical illness coverage.'
      });
    }

    var protectionRatio = Calc.protectionRatio(c);
    if (protectionRatio > 15) {
      recs.push({
        severity: 'medium',
        title: 'Insurance premiums exceed recommended ratio',
        detail: 'Annual premiums are ' + Dom.fmtPct(protectionRatio) + ' of annual income, above the typical 10-15% guideline. Review policy mix for efficiency.'
      });
    }

    var rp = Calc.retirementProjection(c);
    if (rp.retirementGap > 0) {
      recs.push({
        severity: 'high',
        title: 'Retirement goal unlikely at current trajectory',
        detail: 'Projected shortfall of ' + Dom.fmtMoney(rp.retirementGap) + ' at retirement. Success probability is ' + rp.successProbability.toFixed(0) + '%.'
      });
      var surplus = Calc.monthlySurplus(c);
      var suggestion = Math.max(200, Math.round(rp.retirementGap / Math.max(1, rp.yearsToRetirement) / 12 / 100) * 100);
      recs.push({
        severity: 'medium',
        title: 'Suggested action: increase monthly investments',
        detail: 'Increasing monthly investment contributions by approximately ' + Dom.fmtMoney(suggestion) + ' could help close the retirement gap over time.'
      });
    } else if (rp.requiredPortfolio > 0) {
      recs.push({
        severity: 'good',
        title: 'Retirement plan on track',
        detail: 'Projected assets meet or exceed the required portfolio at current retirement age, with a success probability of ' + rp.successProbability.toFixed(0) + '%.'
      });
    }

    var debtRatio = Calc.debtRatio(c);
    if (debtRatio > 50) {
      recs.push({
        severity: 'medium',
        title: 'Debt ratio elevated',
        detail: 'Liabilities represent ' + Dom.fmtPct(debtRatio) + ' of total assets. Prioritise high-interest debt paydown where possible.'
      });
    }

    if (recs.length === 0) {
      recs.push({ severity: 'good', title: 'No urgent flags', detail: 'Client\u2019s financial position appears balanced across the reviewed areas.' });
    }

    return recs;
  }

  return { getRecommendations: getRecommendations };
})();
