/* ============================================================
   dashboard.js — Overview module
   Layout mirrors the "3-bucket" style personal dashboard: a
   compact goal strip up top, then charts front-and-center
   (moved above the detailed KPI grid so the visuals are what a
   client sees first), then AI notes, then the full number grid
   for anyone who wants to drill in.
   ============================================================ */

var ModuleDashboard = (function () {

  function kpi(label, value, deltaText, deltaDir, accent) {
    var delta = deltaText ? Dom.el('div', { class: 'kpi-delta ' + (deltaDir || 'flat') }, [deltaText]) : null;
    var children = [Dom.el('div', { class: 'kpi-label' }, [label]), Dom.el('div', { class: 'kpi-value' }, [value])];
    if (delta) children.push(delta);
    return Dom.el('div', { class: 'card kpi-card hoverable' + (accent ? ' kpi-accent-' + accent : '') }, children);
  }

  function goalChip(label, value, accent) {
    return Dom.el('div', { class: 'card', style: 'padding:14px 16px;' + (accent ? 'border-color:' + accent + '55' : '') }, [
      Dom.el('div', { class: 'kpi-label', style: 'font-size:10px' }, [label]),
      Dom.el('div', { style: 'font-family:var(--font-serif);font-size:17px;font-weight:700;margin-top:2px' }, [value])
    ]);
  }

  function chartCard(title, canvasId, tall) {
    return Dom.el('div', { class: 'card' }, [
      Dom.el('div', { class: 'card-title' }, [title]),
      Dom.el('div', { class: 'chart-wrap' + (tall ? ' tall' : '') }, [Dom.el('canvas', { id: canvasId })])
    ]);
  }

  function render(container) {
    function draw() {
      var c = Store.getAll();
      container.innerHTML = '';

      var savingsRate = Calc.savingsRate(c);
      var nw = Calc.netWorth(c);
      var invValue = Calc.investmentAssetsTotal(c);
      var coverage = Calc.totalDeathOnlyCoverage(c);
      var rp = Calc.retirementProjection(c);
      var passiveIncome = Calc.passiveIncomeMonthly(c);
      var dividendIncome = Calc.totalMonthlyDividendAtAge(c, Calc.num((c.retirement || {}).currentAge));
      var efMonths = Calc.emergencyFundMonths(c);
      var fiPct = Calc.financialIndependencePercent(c);
      var projRetireAge = Calc.projectedRetirementAge(c);
      var nwGoalPct = Calc.netWorthGoalProgress(c);
      var savingsGoal = Calc.num((c.budgetGoals || {}).savingsRateGoal);

      container.appendChild(Dom.el('div', { class: 'page-header' }, [
        Dom.el('h1', {}, ['Dashboard']),
        Dom.el('div', { class: 'sub' }, ['Live overview for ' + ((c.personal || {}).name || 'Client') + ' — every figure below is wired to the client master data.'])
      ]));

      // ---- Goal strip (mirrors the "Her Financial Dashboard" top row) ----
      container.appendChild(Dom.el('div', { class: 'grid grid-kpi mb-3' }, [
        goalChip('Net Worth Goal', Dom.fmtMoney(Calc.num((c.budgetGoals || {}).netWorthGoal))),
        goalChip('Current Net Worth', Dom.fmtMoney(nw)),
        goalChip('Net Worth Achieved', Dom.fmtPct(nwGoalPct), 'var(--accent)'),
        goalChip('Saving Rate Goal', Dom.fmtPct(savingsGoal)),
        goalChip('Saving Rate Actual', Dom.fmtPct(savingsRate), savingsRate >= savingsGoal ? 'var(--good)' : 'var(--warn)')
      ]));

      // ---- Charts, front and center ----
      var chartGrid = Dom.el('div', { class: 'grid grid-2 chart-row-2 mb-3' });
      chartGrid.appendChild(chartCard('Annual Spending by Category', 'chartSpendDonut', true));
      chartGrid.appendChild(chartCard('Assets, Debt & Net Worth', 'chartNwHistory', true));
      container.appendChild(chartGrid);

      // Investment Balance Trend only has anything to show once at least
      // one plan exists on Wealth Accumulation Planning — with none, the
      // chart would just be blank axes with nothing plotted, so the card
      // is left out entirely rather than shown empty.
      var hasInvestmentPlans = (c.investments || []).length > 0;
      var chartGrid2 = Dom.el('div', { class: 'grid ' + (hasInvestmentPlans ? 'grid-3 chart-row-3' : 'grid-2 chart-row-2') + ' mb-3' });
      chartGrid2.appendChild(chartCard('Saving Rate: Goal vs Actual', 'chartSavingsRate'));
      chartGrid2.appendChild(chartCard('Net Worth Goal vs Current', 'chartNwGoal'));
      if (hasInvestmentPlans) chartGrid2.appendChild(chartCard('Investment Balance Trend', 'chartInvestReturns'));
      container.appendChild(chartGrid2);

      // ---- AI panel ----
      container.appendChild(Dom.el('div', { class: 'section-title', style: 'margin-top:0' }, ['Recommendations']));
      var recs = AI.getRecommendations(c);
      var aiPanel = Dom.el('div', { class: 'ai-panel mb-3' });
      recs.forEach(function (r) {
        aiPanel.appendChild(Dom.el('div', { class: 'ai-rec' }, [
          Dom.el('div', { class: 'ai-dot ' + r.severity }),
          Dom.el('div', {}, [
            Dom.el('div', { style: 'font-weight:700;font-size:12px' }, [r.title]),
            Dom.el('div', { class: 'text-secondary', style: 'margin-top:2px' }, [r.detail])
          ])
        ]));
      });
      container.appendChild(aiPanel);

      // ---- Detailed KPI grid (full numeric drill-down, now below the visuals) ----
      container.appendChild(Dom.el('div', { class: 'section-title' }, ['🔍 Full Detail']));
      var targetRetireAge = Calc.num((c.retirement || {}).retirementAge);
      var kpiGrid = Dom.el('div', { class: 'grid grid-kpi' }, [
        kpi('Monthly Income', Dom.fmtMoney(Calc.monthlyIncome(c)), null, null, 'green'),
        kpi('Monthly Expenses', Dom.fmtMoney(Calc.monthlyExpenses(c)), null, null, 'orange'),
        kpi('Savings Rate', Dom.fmtPct(savingsRate), savingsRate >= 20 ? 'Healthy' : 'Below target', savingsRate >= 20 ? 'up' : 'down', 'blue'),
        kpi('Net Worth', Dom.fmtMoney(nw), null, null, 'violet'),
        kpi('Investment Value (today)', Dom.fmtMoney(invValue), null, null, 'burgundy'),
        kpi('Death Coverage', Dom.fmtMoney(coverage), null, null, 'red'),
        kpi('Retirement Progress', Dom.fmtPct(rp.requiredPortfolio > 0 ? (rp.projectedAssets / rp.requiredPortfolio) * 100 : 100), '% of required portfolio projected by age ' + targetRetireAge, 'flat', 'yellow'),
        kpi('Passive Income / mo', Dom.fmtMoney(passiveIncome), 'Rental + investment dividends + other investment income', 'flat', 'cyan'),
        kpi('Dividend Income / mo', Dom.fmtMoney(dividendIncome), null, null, 'pink'),
        kpi('Emergency Fund', efMonths.toFixed(1) + ' mo', efMonths >= ((c.emergencyFund || {}).targetMonths || 6) ? 'On target' : 'Below target', efMonths >= ((c.emergencyFund || {}).targetMonths || 6) ? 'up' : 'down', 'red'),
        kpi('Financial Independence', Dom.fmtPct(fiPct), 'Passive income vs today\u2019s expenses', 'flat', 'yellow'),
        kpi('Target Retirement Age', targetRetireAge || '—', 'Set on Retirement Planning', 'flat', 'indigo'),
        kpi('Earliest Possible Retirement Age', projRetireAge ? projRetireAge : 'Not by 85', projRetireAge && targetRetireAge ? (projRetireAge <= targetRetireAge ? 'Ahead of target' : 'Behind target') : '', projRetireAge && targetRetireAge ? (projRetireAge <= targetRetireAge ? 'up' : 'down') : 'flat', 'indigo')
      ]);
      container.appendChild(kpiGrid);

      requestAnimationFrame(function () { drawCharts(c); });
    }

    function drawCharts(c) {
      // Configs live in Charts.dashboardConfigs — shared with the Summary
      // report's own "Dashboard graphs" section, so the two can never
      // disagree on what these charts actually show.
      var cfg = Charts.dashboardConfigs(c);
      Charts.render(document.getElementById('chartSpendDonut'), cfg.spendDonut);
      Charts.render(document.getElementById('chartNwHistory'), cfg.nwHistory);
      Charts.render(document.getElementById('chartSavingsRate'), cfg.savingsRate);
      Charts.render(document.getElementById('chartNwGoal'), cfg.nwGoal);
      var investCanvas = document.getElementById('chartInvestReturns');
      if (investCanvas) Charts.render(investCanvas, cfg.investTrend);
    }

    draw();
    return Store.subscribe('*', Dom.debounce(function () { Dom.withFocusPreserved(container, draw); }, 30));
  }

  return { title: 'Dashboard', render: render };
})();
