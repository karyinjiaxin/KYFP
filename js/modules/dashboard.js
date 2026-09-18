/* ============================================================
   dashboard.js — Overview module
   Layout mirrors the "3-bucket" style personal dashboard: a
   compact goal strip up top, then charts front-and-center
   (moved above the detailed KPI grid so the visuals are what a
   client sees first), then AI notes, then the full number grid
   for anyone who wants to drill in.
   ============================================================ */

var ModuleDashboard = (function () {

  function kpi(label, value, deltaText, deltaDir) {
    var delta = deltaText ? Dom.el('div', { class: 'kpi-delta ' + (deltaDir || 'flat') }, [deltaText]) : null;
    var children = [Dom.el('div', { class: 'kpi-label' }, [label]), Dom.el('div', { class: 'kpi-value' }, [value])];
    if (delta) children.push(delta);
    return Dom.el('div', { class: 'card kpi-card hoverable' }, children);
  }

  function goalChip(label, value, accent) {
    return Dom.el('div', { class: 'card', style: 'padding:14px 16px;' + (accent ? 'border-color:' + accent + '55' : '') }, [
      Dom.el('div', { class: 'kpi-label', style: 'font-size:11px' }, [label]),
      Dom.el('div', { style: 'font-family:var(--font-serif);font-size:19px;font-weight:700;margin-top:2px' }, [value])
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
      var coverage = Calc.totalCoverage(c);
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
      var chartGrid = Dom.el('div', { class: 'grid grid-2 mb-3' });
      chartGrid.appendChild(chartCard('Annual Spending by Category', 'chartSpendDonut', true));
      chartGrid.appendChild(chartCard('Assets, Debt & Net Worth', 'chartNwHistory', true));
      container.appendChild(chartGrid);

      var chartGrid2 = Dom.el('div', { class: 'grid grid-3 mb-3' });
      chartGrid2.appendChild(chartCard('Saving Rate: Goal vs Actual', 'chartSavingsRate'));
      chartGrid2.appendChild(chartCard('Net Worth Goal vs Current', 'chartNwGoal'));
      chartGrid2.appendChild(chartCard('Investment Balance Trend', 'chartInvestReturns'));
      container.appendChild(chartGrid2);

      // ---- AI panel ----
      container.appendChild(Dom.el('div', { class: 'section-title', style: 'margin-top:0' }, ['🤖 AI Recommendations']));
      var recs = AI.getRecommendations(c);
      var aiPanel = Dom.el('div', { class: 'ai-panel mb-3' });
      recs.forEach(function (r) {
        aiPanel.appendChild(Dom.el('div', { class: 'ai-rec' }, [
          Dom.el('div', { class: 'ai-dot ' + r.severity }),
          Dom.el('div', {}, [
            Dom.el('div', { style: 'font-weight:700;font-size:13.5px' }, [r.title]),
            Dom.el('div', { class: 'text-secondary', style: 'margin-top:2px' }, [r.detail])
          ])
        ]));
      });
      container.appendChild(aiPanel);

      // ---- Detailed KPI grid (full numeric drill-down, now below the visuals) ----
      container.appendChild(Dom.el('div', { class: 'section-title' }, ['🔍 Full Detail']));
      var targetRetireAge = Calc.num((c.retirement || {}).retirementAge);
      var kpiGrid = Dom.el('div', { class: 'grid grid-kpi' }, [
        kpi('Monthly Income', Dom.fmtMoney(Calc.monthlyIncome(c))),
        kpi('Monthly Expenses', Dom.fmtMoney(Calc.monthlyExpenses(c))),
        kpi('Savings Rate', Dom.fmtPct(savingsRate), savingsRate >= 20 ? 'Healthy' : 'Below target', savingsRate >= 20 ? 'up' : 'down'),
        kpi('Net Worth', Dom.fmtMoney(nw)),
        kpi('Investment Value (today)', Dom.fmtMoney(invValue)),
        kpi('Insurance Coverage', Dom.fmtMoney(coverage)),
        kpi('Retirement Progress', Dom.fmtPct(rp.requiredPortfolio > 0 ? (rp.projectedAssets / rp.requiredPortfolio) * 100 : 100), '% of required portfolio projected by age ' + targetRetireAge, 'flat'),
        kpi('Passive Income / mo', Dom.fmtMoney(passiveIncome), 'Rental + investment dividends + other investment income', 'flat'),
        kpi('Dividend Income / mo', Dom.fmtMoney(dividendIncome)),
        kpi('Emergency Fund', efMonths.toFixed(1) + ' mo', efMonths >= ((c.emergencyFund || {}).targetMonths || 6) ? 'On target' : 'Below target', efMonths >= ((c.emergencyFund || {}).targetMonths || 6) ? 'up' : 'down'),
        kpi('Financial Independence', Dom.fmtPct(fiPct), 'Passive income vs today\u2019s expenses', 'flat'),
        kpi('Target Retirement Age', targetRetireAge || '—', 'Set on Retirement Planning', 'flat'),
        kpi('Earliest Possible Retirement Age', projRetireAge ? projRetireAge : 'Not by 85', projRetireAge && targetRetireAge ? (projRetireAge <= targetRetireAge ? 'Ahead of target' : 'Behind target') : '', projRetireAge && targetRetireAge ? (projRetireAge <= targetRetireAge ? 'up' : 'down') : 'flat')
      ]);
      container.appendChild(kpiGrid);

      requestAnimationFrame(function () { drawCharts(c); });
    }

    function drawCharts(c) {
      var t = Charts.themeColors();

      // Annual Spending by Category (donut) — from cashflow categories
      var cats = c.cashflowCategories || [];
      var colors = t.palette.concat(['#E0A458', '#6FA394', '#B98BB0', '#8B7EC8']);
      Charts.render(document.getElementById('chartSpendDonut'), {
        type: 'doughnut',
        data: {
          labels: cats.map(function (cat) { return cat.name; }),
          datasets: [{ data: cats.map(Calc.categoryAnnualTotal), backgroundColor: colors }]
        },
        options: Object.assign({ scales: { x: false, y: false } }, Charts.leaderLineDonutOptions(t.text))
      });

      // Assets, Debt & Net Worth — from monthly history
      var hist = Calc.netWorthHistorySeries(c);
      Charts.render(document.getElementById('chartNwHistory'), {
        type: 'line',
        data: {
          labels: hist.map(function (h) { return h.month; }),
          datasets: [
            { label: 'Assets', data: hist.map(function (h) { return h.assets; }), borderColor: t.palette[1], backgroundColor: 'rgba(26,85,93,0.12)', fill: true, tension: 0.3 },
            { label: 'Net Worth', data: hist.map(function (h) { return h.netWorth; }), borderColor: t.palette[2], backgroundColor: 'rgba(28,145,102,0.18)', fill: true, tension: 0.3 },
            { label: 'Liabilities', data: hist.map(function (h) { return -h.liabilities; }), borderColor: t.palette[3], backgroundColor: 'rgba(214,72,74,0.15)', fill: true, tension: 0.3 }
          ]
        }
      });

      // Saving Rate: Goal vs Actual
      var savingsGoal = Calc.num((c.budgetGoals || {}).savingsRateGoal);
      var savingsActual = Calc.savingsRate(c);
      Charts.render(document.getElementById('chartSavingsRate'), {
        type: 'bar',
        data: { labels: ['Goal', 'Actual'], datasets: [{ data: [savingsGoal, savingsActual], backgroundColor: [t.palette[1], t.palette[0]] }] },
        options: { plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: function (v) { return v + '%'; } } } } }
      });

      // Net Worth Goal vs Current
      var nwGoal = Calc.num((c.budgetGoals || {}).netWorthGoal);
      var nwCurrent = Calc.netWorth(c);
      Charts.render(document.getElementById('chartNwGoal'), {
        type: 'bar',
        data: { labels: ['Goal', 'Current'], datasets: [{ data: [nwGoal, nwCurrent], backgroundColor: [t.palette[1], t.brass] }] },
        options: { indexAxis: 'y', plugins: { legend: { display: false } } }
      });

      // Investment Balance Trend (bar) + linear trendline
      var invLabels = [], invValues = [];
      (c.investments || []).forEach(function (plan) {
        var rows = Calc.investmentPlanProjection(plan, plan.projectionAge);
        rows.forEach(function (r, idx) {
          if (!invLabels[idx]) invLabels[idx] = 'Age ' + r.age;
          invValues[idx] = (invValues[idx] || 0) + r.accumulatedValue;
        });
      });
      var trend = Calc.linearTrendline(invValues);
      Charts.render(document.getElementById('chartInvestReturns'), {
        type: 'bar',
        data: {
          labels: invLabels,
          datasets: [
            { type: 'bar', label: 'Balance', data: invValues, backgroundColor: t.brass },
            { type: 'line', label: 'Trend', data: trend, borderColor: t.palette[1], borderDash: [5, 4], pointRadius: 0, fill: false }
          ]
        },
        options: { plugins: { legend: { display: false } } }
      });
    }

    draw();
    return Store.subscribe('*', Dom.debounce(function () { Dom.withFocusPreserved(container, draw); }, 30));
  }

  return { title: 'Dashboard', render: render };
})();
