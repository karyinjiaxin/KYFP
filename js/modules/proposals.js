/* ============================================================
   proposals.js — Proposal Generator
   Pulls from every module's derived data. Print-to-PDF via
   the browser print dialog (css @media print hides chrome).
   ============================================================ */

var ModuleProposals = (function () {
  function render(container) {
    function draw() {
      var c = Store.getAll();
      var recs = AI.getRecommendations(c);
      var rp = Calc.retirementProjection(c);

      container.innerHTML = '';
      container.appendChild(Dom.el('div', { class: 'page-header no-print flex justify-between items-center' }, [
        Dom.el('div', {}, [
          Dom.el('h1', {}, ['Proposal Generator']),
          Dom.el('div', { class: 'sub' }, ['Auto-compiled from every module. Use Print (top right) to export as PDF.'])
        ]),
        Dom.el('button', { class: 'btn btn-primary', onclick: function () { window.print(); } }, ['Print / Export PDF'])
      ]));

      var doc = Dom.el('div', { class: 'card', id: 'proposalDoc' });

      doc.appendChild(Dom.el('div', { style: 'text-align:center;margin-bottom:24px' }, [
        Dom.el('div', { style: 'font-family:var(--font-serif);font-size:22px;font-weight:700' }, ['Financial Advisory Proposal']),
        Dom.el('div', { class: 'text-secondary', style: 'margin-top:4px' }, ['Prepared for ' + ((c.personal || {}).name || 'Client') + ' · ' + new Date().toLocaleDateString('en-SG', { year: 'numeric', month: 'long', day: 'numeric' })])
      ]));

      section(doc, 'Current Situation', [
        propRow('Monthly Income', Dom.fmtMoney(Calc.monthlyIncome(c))),
        propRow('Monthly Expenses', Dom.fmtMoney(Calc.monthlyExpenses(c))),
        propRow('Savings Rate', Dom.fmtPct(Calc.savingsRate(c))),
        propRow('Net Worth', Dom.fmtMoney(Calc.netWorth(c))),
        propRow('Total Insurance Coverage', Dom.fmtMoney(Calc.totalCoverage(c))),
        propRow('Investment Assets', Dom.fmtMoney(Calc.investmentAssetsTotal(c)))
      ]);

      var problems = recs.filter(function (r) { return r.severity !== 'good'; });
      section(doc, 'Problems Identified', problems.length ? problems.map(function (r) {
        return Dom.el('div', { style: 'margin-bottom:8px' }, [
          Dom.el('div', { style: 'font-weight:700;font-size:13.5px' }, ['• ' + r.title]),
          Dom.el('div', { class: 'text-secondary', style: 'margin-left:14px' }, [r.detail])
        ]);
      }) : [Dom.el('div', { class: 'text-secondary' }, ['No material issues identified in the current review.'])]);

      section(doc, 'Recommendations — Insurance', [
        propRow('Coverage Gap', Dom.fmtMoney(Calc.coverageGap(c))),
        propRow('Recommended Additional Coverage', Dom.fmtMoney(Calc.coverageGap(c))),
        propRow('Current Protection Ratio', Dom.fmtPct(Calc.protectionRatio(c)))
      ]);

      var currentAge = Calc.ageFromDob((c.personal || {}).dob) || (c.retirement || {}).currentAge;
      section(doc, 'Recommendations — Investments', [
        propRow('Current Investment Value', Dom.fmtMoney(Calc.investmentValueAtAge(c, currentAge))),
        propRow('Monthly Dividend Income', Dom.fmtMoney(Calc.totalMonthlyDividendAtAge(c, currentAge))),
        propRow('Suggested Monthly Surplus to Invest', Dom.fmtMoney(Math.max(0, Calc.monthlySurplus(c) * 0.7)))
      ]);

      section(doc, 'Recommendations — Retirement', [
        propRow('Required Portfolio at Retirement', Dom.fmtMoney(rp.requiredPortfolio)),
        propRow('Projected Assets at Retirement', Dom.fmtMoney(rp.projectedAssets)),
        propRow('Retirement Gap', Dom.fmtMoney(rp.retirementGap)),
        propRow('Success Probability', rp.successProbability.toFixed(0) + '%')
      ]);

      section(doc, 'Recommendations — Cashflow', [
        propRow('Monthly Surplus', Dom.fmtMoney(Calc.monthlySurplus(c))),
        propRow('Cashflow Ratio', Dom.fmtPct(Calc.cashflowRatio(c))),
        propRow('Emergency Fund Coverage', Calc.emergencyFundMonths(c).toFixed(1) + ' months')
      ]);

      var priorities = buildPriorities(c, rp);
      section(doc, 'Priority Actions', priorities.map(function (p, i) {
        return Dom.el('div', { style: 'margin-bottom:6px;font-size:13.5px' }, [(i + 1) + '. ' + p]);
      }));

      container.appendChild(doc);
    }

    function buildPriorities(c, rp) {
      var list = [];
      if (Calc.emergencyFundMonths(c) < ((c.emergencyFund || {}).targetMonths || 6)) list.push('Top up emergency fund to target coverage.');
      if (Calc.coverageGap(c) > 0) list.push('Close protection gap of ' + Dom.fmtMoney(Calc.coverageGap(c)) + ' via life/CI review.');
      if (rp.retirementGap > 0) list.push('Increase retirement contributions to close projected shortfall.');
      if (Calc.savingsRate(c) < 20) list.push('Review discretionary expenses to lift savings rate toward 20%+.');
      if (list.length === 0) list.push('Maintain current strategy; revisit at next annual review.');
      return list;
    }

    function section(doc, title, children) {
      doc.appendChild(Dom.el('div', { class: 'section-title' }, [title]));
      var box = Dom.el('div', { class: 'mb-3' }, children);
      doc.appendChild(box);
    }
    function propRow(label, value) {
      return Dom.el('div', { class: 'flex justify-between items-center', style: 'padding:6px 0;border-bottom:1px solid var(--border)' }, [
        Dom.el('div', { class: 'text-secondary' }, [label]),
        Dom.el('div', { style: 'font-weight:700;font-size:13.5px' }, [value])
      ]);
    }

    draw();
    return Store.subscribe('*', Dom.debounce(function () { Dom.withFocusPreserved(container, draw); }, 30));
  }
  return { title: 'Proposals', render: render };
})();
