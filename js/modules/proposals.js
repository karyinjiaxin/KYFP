/* ============================================================
   proposals.js — Summary (client financial summary report)
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
          Dom.el('h1', {}, ['Summary']),
          Dom.el('div', { class: 'sub' }, ['Auto-compiled from every module. Use Print (top right) to export as PDF.'])
        ]),
        Dom.el('button', { class: 'btn btn-primary', onclick: function () { window.print(); } }, ['Print / Export PDF'])
      ]));

      var doc = Dom.el('div', { class: 'card', id: 'proposalDoc' });

      doc.appendChild(Dom.el('div', { style: 'text-align:center;margin-bottom:24px' }, [
        Dom.el('div', { style: 'font-family:var(--font-serif);font-size:20px;font-weight:700' }, ['Financial Advisory Summary']),
        Dom.el('div', { class: 'text-secondary', style: 'margin-top:4px' }, ['Prepared for ' + ((c.personal || {}).name || 'Client') + ' · ' + new Date().toLocaleDateString('en-SG', { year: 'numeric', month: 'long', day: 'numeric' })])
      ]));

      doc.appendChild(notesSection(c));

      doc.appendChild(dashboardOverview(c, rp));
      doc.appendChild(dashboardGraphsSection());
      doc.appendChild(scenarioComparisonSection(c));

      section(doc, 'Current Situation', [
        propRow('Monthly Income', Dom.fmtMoney(Calc.monthlyIncome(c))),
        propRow('Monthly Expenses', Dom.fmtMoney(Calc.monthlyExpenses(c))),
        propRow('Savings Rate', Dom.fmtPct(Calc.savingsRate(c))),
        propRow('Net Worth', Dom.fmtMoney(Calc.netWorth(c))),
        propRow('Total Death Coverage', Dom.fmtMoney(Calc.totalDeathOnlyCoverage(c))),
        propRow('Investment Assets', Dom.fmtMoney(Calc.investmentAssetsTotal(c)))
      ]);

      var problems = recs.filter(function (r) { return r.severity !== 'good'; });
      section(doc, 'Problems Identified', problems.length ? problems.map(function (r) {
        return Dom.el('div', { style: 'margin-bottom:8px' }, [
          Dom.el('div', { style: 'font-weight:700;font-size:12px' }, ['• ' + r.title]),
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
        propRow('Monthly Investment Needed to Close Retirement Gap', Dom.fmtMoney(Calc.monthlyInvestmentToCloseGap(c)))
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
        return Dom.el('div', { style: 'margin-bottom:6px;font-size:12px' }, [(i + 1) + '. ' + p]);
      }));

      container.appendChild(doc);

      requestAnimationFrame(function () { drawOverviewCharts(c, rp); drawScenarioChart(c); });
    }

    // Bar charts for the Dashboard Overview section — drawn after the doc
    // is in the live DOM (canvases need to exist first). Canvas is a real
    // bitmap once rendered, so these print into the PDF/printout fine,
    // same as any other chart in the app.
    function drawOverviewCharts(c, rp) {
      var t = Charts.themeColors();
      var monthlyIncome = Calc.monthlyIncome(c), monthlyExpenses = Calc.monthlyExpenses(c);
      Charts.render(document.getElementById('propIncomeExpenseChart'), {
        type: 'bar',
        data: {
          labels: ['Monthly Income', 'Monthly Expenses', 'Monthly Surplus'],
          datasets: [{ data: [monthlyIncome, monthlyExpenses, Math.max(0, monthlyIncome - monthlyExpenses)], backgroundColor: [t.palette[2], t.palette[3], t.palette[0]] }]
        },
        options: { plugins: { legend: { display: false } } }
      });

      Charts.render(document.getElementById('propRetirementChart'), {
        type: 'bar',
        data: {
          labels: ['Required Portfolio', 'Projected Assets'],
          datasets: [{ data: [rp.requiredPortfolio, rp.projectedAssets], backgroundColor: [t.palette[0], rp.projectedAssets >= rp.requiredPortfolio ? (t.good || t.palette[2]) : t.palette[3]] }]
        },
        options: { plugins: { legend: { display: false } } }
      });

      var gapsChartCanvas = document.getElementById('propGapsChart');
      if (gapsChartCanvas) {
        var gapLabels = [], gapValues = [];
        var coverageGap = Calc.coverageGap(c);
        var efMonths = Calc.emergencyFundMonths(c);
        var efTarget = (c.emergencyFund || {}).targetMonths || 6;
        if (coverageGap > 0) { gapLabels.push('Protection Gap'); gapValues.push(coverageGap); }
        if (rp.retirementGap > 0) { gapLabels.push('Retirement Gap'); gapValues.push(rp.retirementGap); }
        if (efMonths < efTarget) { gapLabels.push('Emergency Fund Gap'); gapValues.push((efTarget - efMonths) * Calc.monthlyExpenses(c)); }
        Charts.render(gapsChartCanvas, {
          type: 'bar',
          data: { labels: gapLabels, datasets: [{ data: gapValues, backgroundColor: t.palette[3] }] },
          options: { indexAxis: 'y', plugins: { legend: { display: false } } }
        });
      }

      // The same five charts shown on the Dashboard page itself — configs
      // come from Charts.dashboardConfigs so they can never disagree with
      // what the advisor sees there, just rendered into this report's own
      // canvas ids (a multi-tab printout can show Dashboard and Summary
      // together, so ids can't collide between the two pages).
      var dashCfg = Charts.dashboardConfigs(c);
      Charts.render(document.getElementById('propSpendDonut'), dashCfg.spendDonut);
      Charts.render(document.getElementById('propNwHistory'), dashCfg.nwHistory);
      Charts.render(document.getElementById('propSavingsRate'), dashCfg.savingsRate);
      Charts.render(document.getElementById('propNwGoal'), dashCfg.nwGoal);
      Charts.render(document.getElementById('propInvestTrend'), dashCfg.investTrend);
    }

    // Same chart set as the Dashboard page, reproduced here so the printed
    // Summary carries every graph the advisor sees day-to-day, not just
    // the Dashboard Overview's own 3 summary bars above.
    function dashboardGraphsSection() {
      var wrap = Dom.el('div', { class: 'mb-3' });
      wrap.appendChild(Dom.el('div', { class: 'section-title' }, ['📈 Dashboard Graphs']));
      var grid2 = Dom.el('div', { class: 'grid grid-2 mb-3' });
      grid2.appendChild(Dom.el('div', { class: 'card' }, [
        Dom.el('div', { class: 'card-title' }, ['Annual Spending by Category']),
        Dom.el('div', { class: 'chart-wrap tall' }, [Dom.el('canvas', { id: 'propSpendDonut' })])
      ]));
      grid2.appendChild(Dom.el('div', { class: 'card' }, [
        Dom.el('div', { class: 'card-title' }, ['Assets, Debt & Net Worth']),
        Dom.el('div', { class: 'chart-wrap tall' }, [Dom.el('canvas', { id: 'propNwHistory' })])
      ]));
      wrap.appendChild(grid2);
      var grid3 = Dom.el('div', { class: 'grid grid-3 mb-3' });
      grid3.appendChild(Dom.el('div', { class: 'card' }, [
        Dom.el('div', { class: 'card-title' }, ['Saving Rate: Goal vs Actual']),
        Dom.el('div', { class: 'chart-wrap' }, [Dom.el('canvas', { id: 'propSavingsRate' })])
      ]));
      grid3.appendChild(Dom.el('div', { class: 'card' }, [
        Dom.el('div', { class: 'card-title' }, ['Net Worth Goal vs Current']),
        Dom.el('div', { class: 'chart-wrap' }, [Dom.el('canvas', { id: 'propNwGoal' })])
      ]));
      grid3.appendChild(Dom.el('div', { class: 'card' }, [
        Dom.el('div', { class: 'card-title' }, ['Investment Balance Trend']),
        Dom.el('div', { class: 'chart-wrap' }, [Dom.el('canvas', { id: 'propInvestTrend' })])
      ]));
      wrap.appendChild(grid3);
      return wrap;
    }

    // A plain-English baseline statement, then — if the advisor has
    // actually added any scenario (a Life Event on Cash Flow Roadmap, or
    // an active House Purchase) — a before/after comparison against that
    // baseline. The baseline is "if nothing changes": working to the
    // client's own target Retirement Age, no home purchase, no planned
    // life events — i.e. Calc.roadmapProjection(c, {baseline:true}), NOT
    // a hardcoded age. Scenarios themselves are added on Roadmap/House
    // Purchase (already full-featured there), not re-entered here — this
    // section only shows the IMPACT of whatever's already been planned.
    function scenarioComparisonSection(c) {
      var wrap = Dom.el('div', { class: 'mb-3' });
      var retirementAge = Calc.num((c.retirement || {}).retirementAge);
      var name = (c.personal || {}).name || 'The client';
      var baselineRows = Calc.roadmapProjection(c, { baseline: true });
      var baselineAtRetirement = baselineRows.filter(function (r) { return r.age === retirementAge; })[0] || baselineRows[baselineRows.length - 1];

      wrap.appendChild(Dom.el('div', { class: 'section-title' }, ['🧭 Baseline Projection']));
      if (baselineAtRetirement) {
        var monthlyAtRetirement = baselineAtRetirement.retirementPayoutCredited / 12;
        wrap.appendChild(Dom.el('div', { class: 'card mb-3', style: 'font-size:12.5px;line-height:1.7' }, [
          'If ' + name + ' continues working until age ' + retirementAge + ' — with no home purchase and no other planned life events — they are projected to retire with a savings balance of around ',
          Dom.el('b', {}, [Dom.fmtMoney(baselineAtRetirement.balance)]),
          ' and approximately ',
          Dom.el('b', {}, [Dom.fmtMoney(monthlyAtRetirement) + '/month']),
          ' in retirement income (CPF LIFE, dividends, and other passive income).'
        ]));
      } else {
        wrap.appendChild(Dom.el('div', { class: 'card mb-3 text-secondary' }, ['Set Current Age, Retirement Age and Life Expectancy on Retirement Planning to see a baseline projection.']));
      }

      var activeEvents = (c.roadmap || {}).lifeEvents || [];
      var housePurchaseActive = Calc.num((c.housePurchase || {}).purchasePrice) > 0;
      wrap.appendChild(Dom.el('div', { class: 'section-title' }, ['🔀 Scenario Impact']));
      if (!activeEvents.length && !housePurchaseActive) {
        wrap.appendChild(Dom.el('div', { class: 'card mb-3 text-secondary' }, [
          'No scenarios added yet. Add one on Cash Flow Roadmap’s Life Events (e.g. Stop Work, Reduce Pay, a car loan) or House Purchase Planning — this section will show the impact on the cashflow automatically, compared to the baseline above.'
        ]));
      } else {
        var scenarioRows = Calc.roadmapProjection(c);
        var scenarioAtRetirement = scenarioRows.filter(function (r) { return r.age === retirementAge; })[0] || scenarioRows[scenarioRows.length - 1];
        var baselineLowest = baselineRows.reduce(function (min, r) { return r.balance < min.balance ? r : min; }, baselineRows[0] || { balance: 0, age: 0 });
        var scenarioLowest = scenarioRows.reduce(function (min, r) { return r.balance < min.balance ? r : min; }, scenarioRows[0] || { balance: 0, age: 0 });

        var scenarioNames = activeEvents.map(function (ev) { return ev.name || 'Unnamed Event'; });
        if (housePurchaseActive) scenarioNames.push('Home Purchase');
        wrap.appendChild(Dom.el('div', { class: 'text-secondary mb-2' }, ['Active scenarios: ' + scenarioNames.join(', ') + '.']));

        wrap.appendChild(Dom.el('div', { class: 'grid grid-kpi mb-3' }, [
          kpiTile('Baseline Lowest Balance', Dom.fmtMoney(baselineLowest.balance), baselineLowest.balance < 0 ? 'red' : 'green'),
          kpiTile('With Scenarios: Lowest Balance', Dom.fmtMoney(scenarioLowest.balance), scenarioLowest.balance < 0 ? 'red' : 'green'),
          kpiTile('Baseline Balance at Retirement', Dom.fmtMoney(baselineAtRetirement ? baselineAtRetirement.balance : 0), 'blue'),
          kpiTile('With Scenarios: Balance at Retirement', Dom.fmtMoney(scenarioAtRetirement ? scenarioAtRetirement.balance : 0), (scenarioAtRetirement && baselineAtRetirement && scenarioAtRetirement.balance < baselineAtRetirement.balance) ? 'red' : 'blue')
        ]));
        wrap.appendChild(Dom.el('div', { class: 'card mb-3' }, [
          Dom.el('div', { class: 'card-title' }, ['Savings Balance: Baseline vs With Scenarios']),
          Dom.el('div', { class: 'chart-wrap tall' }, [Dom.el('canvas', { id: 'propScenarioChart' })])
        ]));
      }
      return wrap;
    }

    function drawScenarioChart(c) {
      var canvas = document.getElementById('propScenarioChart');
      if (!canvas) return;
      var t = Charts.themeColors();
      var baselineRows = Calc.roadmapProjection(c, { baseline: true });
      var scenarioRows = Calc.roadmapProjection(c);
      Charts.render(canvas, {
        type: 'line',
        data: {
          labels: baselineRows.map(function (r) { return r.age; }),
          datasets: [
            { label: 'Baseline', data: baselineRows.map(function (r) { return r.balance; }), borderColor: t.palette[1], backgroundColor: 'transparent', tension: 0.2 },
            { label: 'With Scenarios', data: scenarioRows.map(function (r) { return r.balance; }), borderColor: t.palette[3], backgroundColor: 'transparent', tension: 0.2, borderDash: [6, 4] }
          ]
        }
      });
    }

    // A single at-a-glance scorecard up top, in three parts the advisor
    // asked for specifically — Where You Are Today (current snapshot),
    // Where You're Headed (retirement trajectory), and Gaps to Note (a
    // scannable numeric list, distinct from "Problems Identified" below
    // it, which explains WHY each one matters rather than just sizing it).
    // KPI tiles mirror Dashboard's own look for visual consistency between
    // what the advisor sees day-to-day and what the client receives.
    function kpiTile(label, value, accent) {
      return Dom.el('div', { class: 'card kpi-card' + (accent ? ' kpi-accent-' + accent : '') }, [
        Dom.el('div', { class: 'kpi-label' }, [label]),
        Dom.el('div', { class: 'kpi-value' }, [value])
      ]);
    }
    function dashboardOverview(c, rp) {
      var wrap = Dom.el('div', { class: 'mb-3' });
      var efMonths = Calc.emergencyFundMonths(c);
      var efTarget = (c.emergencyFund || {}).targetMonths || 6;
      var savingsRate = Calc.savingsRate(c);
      var nwGoalPct = Calc.netWorthGoalProgress(c);
      var targetRetireAge = Calc.num((c.retirement || {}).retirementAge);

      wrap.appendChild(Dom.el('div', { class: 'section-title', style: 'margin-top:0' }, ['📊 Dashboard Overview']));

      wrap.appendChild(Dom.el('div', { style: 'font-weight:700;font-size:12px;margin-bottom:6px' }, ['Where You Are Today']));
      wrap.appendChild(Dom.el('div', { class: 'grid grid-kpi mb-3' }, [
        kpiTile('Net Worth', Dom.fmtMoney(Calc.netWorth(c)), 'violet'),
        kpiTile('Monthly Income', Dom.fmtMoney(Calc.monthlyIncome(c)), 'green'),
        kpiTile('Monthly Expenses', Dom.fmtMoney(Calc.monthlyExpenses(c)), 'orange'),
        kpiTile('Savings Rate', Dom.fmtPct(savingsRate), savingsRate >= 20 ? 'green' : 'red'),
        kpiTile('Death Coverage', Dom.fmtMoney(Calc.totalDeathOnlyCoverage(c)), 'red'),
        kpiTile('Investment Assets', Dom.fmtMoney(Calc.investmentAssetsTotal(c)), 'burgundy'),
        kpiTile('Emergency Fund', efMonths.toFixed(1) + ' mo', efMonths >= efTarget ? 'green' : 'red')
      ]));
      wrap.appendChild(Dom.el('div', { class: 'card mb-3' }, [
        Dom.el('div', { class: 'chart-wrap' }, [Dom.el('canvas', { id: 'propIncomeExpenseChart' })])
      ]));

      wrap.appendChild(Dom.el('div', { style: 'font-weight:700;font-size:12px;margin-bottom:6px' }, ['Where You’re Headed']));
      wrap.appendChild(Dom.el('div', { class: 'grid grid-kpi mb-3' }, [
        kpiTile('Target Retirement Age', targetRetireAge || '—', 'indigo'),
        kpiTile('Required Portfolio', Dom.fmtMoney(rp.requiredPortfolio), 'blue'),
        kpiTile('Projected Assets', Dom.fmtMoney(rp.projectedAssets), 'burgundy'),
        kpiTile('Retirement Readiness', rp.successProbability.toFixed(0) + '%', rp.successProbability >= 100 ? 'green' : 'yellow'),
        kpiTile('Net Worth Goal Progress', Dom.fmtPct(nwGoalPct), nwGoalPct >= 100 ? 'green' : 'yellow')
      ]));
      wrap.appendChild(Dom.el('div', { class: 'card mb-3' }, [
        Dom.el('div', { class: 'chart-wrap' }, [Dom.el('canvas', { id: 'propRetirementChart' })])
      ]));

      wrap.appendChild(Dom.el('div', { style: 'font-weight:700;font-size:12px;margin-bottom:2px' }, ['Gaps to Note']));
      var gapRows = [];
      var coverageGap = Calc.coverageGap(c);
      if (coverageGap > 0) gapRows.push(propRow('Protection Gap', Dom.fmtMoney(coverageGap)));
      if (rp.retirementGap > 0) gapRows.push(propRow('Retirement Gap (at age ' + targetRetireAge + ')', Dom.fmtMoney(rp.retirementGap)));
      if (savingsRate < 20) gapRows.push(propRow('Savings Rate', Dom.fmtPct(savingsRate) + ' vs 20%+ target'));
      if (efMonths < efTarget) gapRows.push(propRow('Emergency Fund', efMonths.toFixed(1) + ' vs ' + efTarget + ' month target'));
      var hasDollarGap = coverageGap > 0 || rp.retirementGap > 0 || efMonths < efTarget;
      if (!gapRows.length) gapRows.push(Dom.el('div', { class: 'text-secondary' }, ['No material gaps identified — current plan is well on track.']));
      wrap.appendChild(Dom.el('div', { class: 'mb-3' }, gapRows));
      if (hasDollarGap) {
        wrap.appendChild(Dom.el('div', { class: 'card mb-3' }, [
          Dom.el('div', { class: 'chart-wrap' }, [Dom.el('canvas', { id: 'propGapsChart' })])
        ]));
      }

      return wrap;
    }

    // Free-text commentary the advisor can personalise per client — e.g. a
    // greeting, context for why these recommendations were made, or a
    // reminder of what was discussed in the meeting. The editing textarea
    // itself is excluded from the printed PDF (no-print); a plain
    // print-only block right below it renders the same text as normal
    // document copy, with line breaks preserved.
    function notesSection(c) {
      var wrap = Dom.el('div', { class: 'mb-3' });
      var notes = c.proposalNotes || '';
      wrap.appendChild(Dom.el('div', { class: 'no-print' }, [
        Fields.textInput('proposalNotes', 'Notes to Client (appears in the printed proposal, below the title)', { multiline: true, rows: 4, placeholder: 'e.g. a personal greeting, context from your meeting, or anything else you’d like to say directly to the client…' })
      ]));
      if (notes.trim()) {
        wrap.appendChild(Dom.el('div', { class: 'print-only', style: 'font-size:12px;line-height:1.6;white-space:pre-line;margin-bottom:8px' }, [notes]));
      }
      return wrap;
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
        Dom.el('div', { style: 'font-weight:700;font-size:12px' }, [value])
      ]);
    }

    draw();
    return Store.subscribe('*', Dom.debounce(function () { Dom.withFocusPreserved(container, draw); }, 30));
  }
  return { title: 'Summary', render: render };
})();
