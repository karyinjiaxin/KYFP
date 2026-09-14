/* ============================================================
   dividends.js — Insurance + Dividends module
   Combines participating-policy dividends/cash value growth with
   investment plan dividends into one passive-income picture.
   ============================================================ */

var ModuleDividends = (function () {
  function render(container) {
    function draw() {
      var c = Store.getAll();
      container.innerHTML = '';
      container.appendChild(Dom.el('div', { class: 'page-header' }, [
        Dom.el('h1', {}, ['Insurance + Dividends']),
        Dom.el('div', { class: 'sub' }, ['Participating policy cash values and investment dividends, combined into one passive-income view.'])
      ]));

      var currentAge = Calc.ageFromDob((c.personal || {}).dob) || (c.retirement || {}).currentAge;
      var investDividend = Calc.totalAnnualDividendAtAge(c, currentAge);
      var participating = (c.insurance || []).filter(function (p) { return Calc.num(p.dividend) > 0; });
      var atAge = ((c.retirement || {}).retirementAge) || 65;
      var projectedCashValue = Calc.sum(participating, function (p) { return Calc.insuranceCashValueProjected(p, atAge); });

      container.appendChild(Dom.el('div', { class: 'grid grid-kpi mb-3' }, [
        kpiMini('Investment Dividend (annual)', Dom.fmtMoney(investDividend)),
        kpiMini('Participating Policies', String(participating.length)),
        kpiMini('Projected Cash Value @ ' + atAge, Dom.fmtMoney(projectedCashValue)),
        kpiMini('Total Passive Income / mo', Dom.fmtMoney(Calc.passiveIncomeMonthly(c)))
      ]));

      container.appendChild(Dom.el('div', { class: 'section-title', style: 'margin-top:0' }, ['📜 Participating Policies (Dividend / Cash Value)']));
      if (participating.length === 0) {
        container.appendChild(Dom.el('div', { class: 'card empty-state' }, [Dom.el('div', {}, ['No participating (dividend-paying) policies on record.'])]));
      } else {
        var wrap = Dom.el('div', { class: 'table-scroll' });
        var table = Dom.el('table', { class: 'data-table' });
        table.appendChild(Dom.el('thead', {}, [Dom.el('tr', {}, ['Policy', 'Company', 'Cash Value Today', 'Dividend Rate', 'Projected @ Age ' + atAge].map(function (h) { return Dom.el('th', {}, [h]); }))]));
        var tbody = Dom.el('tbody');
        participating.forEach(function (p) {
          tbody.appendChild(Dom.el('tr', {}, [
            Dom.el('td', {}, [p.policyName]), Dom.el('td', {}, [p.company]),
            Dom.el('td', {}, [Dom.fmtMoney(p.cashValue)]), Dom.el('td', {}, [Dom.fmtPct(p.dividend)]),
            Dom.el('td', {}, [Dom.fmtMoney(Calc.insuranceCashValueProjected(p, atAge))])
          ]));
        });
        table.appendChild(tbody); wrap.appendChild(table); container.appendChild(wrap);
      }

      container.appendChild(Dom.el('div', { class: 'section-title' }, ['💹 Investment Plan Dividends']));
      var wrap2 = Dom.el('div', { class: 'table-scroll' });
      var table2 = Dom.el('table', { class: 'data-table' });
      table2.appendChild(Dom.el('thead', {}, [Dom.el('tr', {}, ['Plan', 'Accumulated Value', 'Annual Dividend', 'Monthly Dividend', 'Yield on Cost'].map(function (h) { return Dom.el('th', {}, [h]); }))]));
      var tbody2 = Dom.el('tbody');
      (c.investments || []).forEach(function (plan) {
        var s = Calc.planSummary(plan);
        tbody2.appendChild(Dom.el('tr', {}, [
          Dom.el('td', {}, [plan.name]), Dom.el('td', {}, [Dom.fmtMoney(s.accumulatedValue)]),
          Dom.el('td', {}, [Dom.fmtMoney(s.annualDividend)]), Dom.el('td', {}, [Dom.fmtMoney(s.monthlyDividend)]),
          Dom.el('td', {}, [Dom.fmtPct(s.yieldOnCost)])
        ]));
      });
      table2.appendChild(tbody2); wrap2.appendChild(table2); container.appendChild(wrap2);

      container.appendChild(Dom.el('div', { class: 'section-title' }, ['🥧 Passive Income Composition']));
      container.appendChild(Dom.el('div', { class: 'card' }, [Dom.el('div', { class: 'chart-wrap' }, [Dom.el('canvas', { id: 'passiveChart' })])]));

      requestAnimationFrame(function () {
        var t = Charts.themeColors();
        Charts.render(document.getElementById('passiveChart'), {
          type: 'doughnut',
          data: {
            labels: ['Rental Income', 'Investment Dividends', 'Other Investment Income'],
            datasets: [{ data: [Calc.num((c.income || {}).rentalIncome), Calc.totalMonthlyDividendAtAge(c, currentAge), Calc.num((c.income || {}).investmentIncome) / 12], backgroundColor: t.palette }]
          },
          options: Object.assign({ scales: { x: false, y: false } }, Charts.leaderLineDonutOptions(t.text))
        });
      });
    }
    function kpiMini(label, value) {
      return Dom.el('div', { class: 'card kpi-card' }, [Dom.el('div', { class: 'kpi-label' }, [label]), Dom.el('div', { class: 'kpi-value' }, [value])]);
    }
    draw();
    return Store.subscribe('*', Dom.debounce(function () { Dom.withFocusPreserved(container, draw); }, 30));
  }
  return { title: 'Insurance + Dividends', render: render };
})();
