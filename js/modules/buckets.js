/* ============================================================
   buckets.js — Bank Account Buckets module
   Automates the "3 bucket" allocation (Bills / Savings / Fun)
   straight from Cashflow's income and expense categories — no
   separate data entry, everything here is derived + goal inputs.
   ============================================================ */

var ModuleBuckets = (function () {
  var BUCKET_COLOR = { Bills: 'var(--ink-700)', Savings: 'var(--good)', Fun: 'var(--brass-500)' };
  var BUCKET_SOFT = { Bills: 'rgba(30,63,102,0.10)', Savings: 'var(--good-soft)', Fun: 'var(--accent-soft)' };

  function iconCircle(emoji, bg, size) {
    size = size || 64;
    return Dom.el('div', {
      style: 'width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + bg + ';' +
        'display:flex;align-items:center;justify-content:center;font-size:' + Math.round(size * 0.5) + 'px;margin:0 auto;line-height:1'
    }, [emoji]);
  }

  // Compact axis-label formatter (S$1.2M / S$350K) — full "S$1,234,567"
  // labels are too wide to read cleanly on a chart's Y-axis.
  function compactMoney(v) {
    var n = Number(v) || 0;
    var sign = n < 0 ? '-' : '';
    var abs = Math.abs(n);
    if (abs >= 1000000) return sign + 'S$' + (abs / 1000000).toFixed(1) + 'M';
    if (abs >= 1000) return sign + 'S$' + Math.round(abs / 1000) + 'K';
    return sign + 'S$' + abs;
  }

  function render(container) {
    function draw() {
      var c = Store.getAll();
      var bt = Calc.bucketTotals(c);
      var nwGoalPct = Calc.netWorthGoalProgress(c);
      var savingsRateActual = Calc.savingsRate(c);
      var savingsRateGoal = Calc.num((c.budgetGoals || {}).savingsRateGoal);

      container.innerHTML = '';
      container.appendChild(Dom.el('div', { class: 'page-header' }, [
        Dom.el('h1', {}, ['Bank Account Buckets']),
        Dom.el('div', { class: 'sub' }, ['Automated 3-bucket allocation — pulled straight from Cashflow, nothing to enter here.'])
      ]));

      // "Money flow" hero: faucet -> monthly income, mirroring the classic 3-bucket spreadsheet visual
      container.appendChild(Dom.el('div', { class: 'card mb-3', style: 'text-align:center;padding:28px 20px' }, [
        iconCircle('🚰', 'var(--accent-soft)', 56),
        Dom.el('div', { class: 'kpi-label mt-2' }, ['Monthly Income']),
        Dom.el('div', { class: 'kpi-value', style: 'font-size:32px' }, [Dom.fmtMoney(bt.income)]),
        Dom.el('div', { class: 'text-tertiary mt-2' }, ['flows into 3 buckets every month ↓'])
      ]));

      container.appendChild(Dom.el('div', { class: 'grid grid-kpi mb-3' }, [
        kpiMini('Bucket 1 — Bills', Dom.fmtMoney(bt.bills)),
        kpiMini('Bucket 2 — Savings', Dom.fmtMoney(bt.savings)),
        kpiMini('Bucket 3 — Fun', Dom.fmtMoney(bt.fun)),
        kpiMini('Leftover', Dom.fmtMoney(bt.leftover))
      ]));

      // Three bucket cards side by side, mirroring the classic bank-bucket spreadsheet layout
      var bucketGrid = Dom.el('div', { class: 'grid mb-3', style: 'grid-template-columns:repeat(3,1fr)' });
      bucketGrid.appendChild(bucketCard('Bank Account 1: Bills', bt.bills, bt.groups.Bills, BUCKET_COLOR.Bills, BUCKET_SOFT.Bills));
      bucketGrid.appendChild(bucketCard('Bank Account 2: Savings', bt.savings, bt.groups.Savings, BUCKET_COLOR.Savings, BUCKET_SOFT.Savings));
      bucketGrid.appendChild(bucketCard('Bank Account 3: Fun', bt.fun, bt.groups.Fun, BUCKET_COLOR.Fun, BUCKET_SOFT.Fun));
      container.appendChild(bucketGrid);

      if (bt.leftover !== 0) {
        container.appendChild(Dom.el('div', { class: 'card mb-3', style: 'text-align:center;border:2px solid var(--bad);background:var(--bad-soft)' }, [
          Dom.el('div', { class: 'kpi-label', style: 'color:var(--bad);font-weight:700' }, ['\u26a0\ufe0f Leftover After All 3 Buckets']),
          Dom.el('div', { class: 'kpi-value', style: 'color:var(--bad)' }, [Dom.fmtMoney(bt.leftover)]),
          Dom.el('div', { class: 'mt-2', style: 'color:var(--bad);font-weight:700' }, [
            bt.leftover < 0
              ? 'Spending across all buckets exceeds income — review Cashflow expenses.'
              : 'Unassigned income — consider directing this toward Savings or a Goal.'
          ])
        ]));
      }

      container.appendChild(Dom.el('div', { class: 'section-title' }, ['🪣 Bucket Allocation']));
      container.appendChild(Dom.el('div', { class: 'card' }, [Dom.el('div', { class: 'chart-wrap' }, [Dom.el('canvas', { id: 'bucketAllocChart' })])]));

      // Goals: Net Worth Goal + Savings Rate Goal
      container.appendChild(Dom.el('div', { class: 'section-title' }, ['🎯 Goals']));
      var goalsCard = Dom.el('div', { class: 'card mb-3' });
      goalsCard.appendChild(Dom.el('div', { class: 'input-row' }, [
        Fields.moneyInput('budgetGoals.netWorthGoal', 'Net Worth Goal'),
        Fields.numberInput('budgetGoals.savingsRateGoal', 'Savings Rate Goal %', { step: '1' })
      ]));
      var currentRP = Calc.retirementProjection(c).requiredPortfolio;
      var currentGoal = Calc.num((c.budgetGoals || {}).netWorthGoal);
      var goalMatchesRP = Math.abs(currentGoal - currentRP) < 1;
      goalsCard.appendChild(Dom.el('div', { class: 'mt-3 pt-3 flex justify-between items-center', style: 'border-top:1px solid var(--border)' }, [
        Dom.el('div', { style: 'font-size:12px' }, [
          Dom.el('span', { class: 'text-secondary' }, ['Retirement Planning\u2019s Required Portfolio: ']),
          Dom.el('b', {}, [Dom.fmtMoney(currentRP)]),
          goalMatchesRP ? Dom.el('span', { class: 'badge badge-good', style: 'margin-left:8px;font-size:10px' }, ['Matches']) : null
        ]),
        goalMatchesRP ? null : Dom.el('button', {
          class: 'btn btn-secondary btn-sm', onclick: function () { Store.set('budgetGoals.netWorthGoal', Math.round(currentRP)); }
        }, ['Match This'])
      ]));
      goalsCard.appendChild(Dom.el('div', { class: 'text-tertiary mt-2', style: 'line-height:1.5' }, [
        'Net Worth Goal above is a separate, freely-editable target \u2014 it does NOT automatically track Retirement Planning\u2019s Required Portfolio (e.g. if the client wants a legacy/inheritance goal beyond pure retirement funding, or a rounder number for a client conversation). If you change any Retirement Planning input, this won\u2019t move on its own \u2014 use "Match This" above whenever you want them aligned again.'
      ]));
      container.appendChild(goalsCard);

      // ---- Interactive Net Worth Goal helper: makes the abstract lump
      // sum concrete by breaking it into "years of desired retirement
      // income", pulled straight from Retirement Planning. ----
      var helper = Calc.netWorthGoalHelper(c);
      var helperCard = Dom.el('div', { class: 'card mb-3' });
      helperCard.appendChild(Dom.el('div', { class: 'card-title' }, ['What Does This Goal Actually Mean?']));
      helperCard.appendChild(Dom.el('div', { class: 'text-secondary mb-3', style: 'line-height:1.6' }, [
        'You told Retirement Planning you want ', Dom.el('b', {}, [Dom.fmtMoney(helper.monthlyIncome) + '/month']),
        ' \u2014 which, inflated to age ', Dom.el('b', {}, [String(helper.retireAge)]), ', is about ', Dom.el('b', {}, [Dom.fmtMoney(helper.annualIncome) + '/year']),
        ' in that first year of retirement, and keeps inflating every year after that. This is the same "Required Portfolio" figure from Retirement Planning \u2014 ',
        Dom.el('b', { style: 'color:var(--accent)' }, [Dom.fmtMoney(helper.suggestedGoal)]),
        ' \u2014 which is less than simply adding up every year\u2019s withdrawal, because the portfolio keeps earning returns while it\u2019s being drawn down. The chart below shows both: the bars are each year\u2019s spending need, and the line is how the portfolio balance actually declines (growing, then shrinking) from age ',
        Dom.el('b', {}, [String(helper.retireAge)]), ' to age ', Dom.el('b', {}, [String(helper.lifeExpectancy)]), '.'
      ]));
      helperCard.appendChild(Dom.el('div', { class: 'chart-wrap', style: 'height:180px' }, [Dom.el('canvas', { id: 'goalHelperChart' })]));
      helperCard.appendChild(Dom.el('button', {
        class: 'btn btn-secondary btn-sm mt-3', onclick: function () { Store.set('budgetGoals.netWorthGoal', Math.round(helper.suggestedGoal)); }
      }, ['Use ' + Dom.fmtMoney(helper.suggestedGoal) + ' as Net Worth Goal']));
      container.appendChild(helperCard);

      container.appendChild(Dom.el('div', { class: 'grid grid-2' }, [
        goalProgressCard('Net Worth Goal', Calc.netWorth(c), Calc.num((c.budgetGoals || {}).netWorthGoal), nwGoalPct),
        savingsRateCard(savingsRateGoal, savingsRateActual)
      ]));

      requestAnimationFrame(function () {
        var t = Charts.themeColors();
        Charts.render(document.getElementById('bucketAllocChart'), {
          type: 'doughnut',
          data: {
            labels: ['Bills', 'Savings', 'Fun'],
            datasets: [{ data: [bt.bills, bt.savings, bt.fun], backgroundColor: [t.ink, t.palette[2], t.brass] }]
          },
          options: Object.assign({ scales: { x: false, y: false } }, Charts.leaderLineDonutOptions(t.text))
        });

        // One bar per retirement year (spending need, inflated forward),
        // with a line showing the portfolio balance actually declining
        // (still earning returns while being drawn down) — this is what
        // explains why the goal is smaller than simply adding up every
        // year's withdrawal.
        if (helper.years > 0) {
          var ages = [], bars = [];
          for (var i = 0; i < helper.yearlyIncomes.length; i++) {
            ages.push(helper.retireAge + i);
            bars.push(helper.yearlyIncomes[i]);
          }
          Charts.render(document.getElementById('goalHelperChart'), {
            type: 'bar',
            data: {
              labels: ages,
              datasets: [
                { type: 'bar', label: 'That Year\u2019s Income (inflated)', data: bars, backgroundColor: t.palette[0] },
                { type: 'line', label: 'Portfolio Balance', data: helper.balanceTrack, borderColor: t.palette[3], backgroundColor: 'transparent', yAxisID: 'y1', tension: 0.2 }
              ]
            },
            options: {
              scales: {
                y: { ticks: { stepSize: 100000, callback: compactMoney } },
                y1: { position: 'right', grid: { display: false }, ticks: { stepSize: 100000, callback: compactMoney } }
              }
            }
          });
        }
      });
    }

    function bucketCard(title, total, items, color, softBg) {
      var card = Dom.el('div', { class: 'card' });
      card.appendChild(iconCircle('🪣', softBg, 96));
      card.appendChild(Dom.el('div', { style: 'font-weight:700;font-size:14px;margin:14px 0 2px;text-align:center' }, [title]));
      card.appendChild(Dom.el('div', { style: 'font-family:var(--font-serif);font-size:22px;font-weight:700;color:' + color + ';margin-bottom:12px;text-align:center' }, [Dom.fmtMoney(total)]));
      var list = Dom.el('div');
      var nonZero = items.filter(function (x) { return x.value > 0; });
      if (nonZero.length === 0) {
        list.appendChild(Dom.el('div', { class: 'text-tertiary' }, ['No categories in this bucket yet.']));
      } else {
        nonZero.forEach(function (item) {
          list.appendChild(Dom.el('div', { class: 'flex justify-between', style: 'padding:5px 0;border-bottom:1px solid var(--border);font-size:13px' }, [
            Dom.el('div', { class: 'text-secondary' }, [item.label]),
            Dom.el('div', { style: 'font-weight:600' }, [Dom.fmtMoney(item.value)])
          ]));
        });
      }
      card.appendChild(list);
      return card;
    }

    function goalProgressCard(label, current, goal, pct) {
      return Dom.el('div', { class: 'card' }, [
        Dom.el('div', { class: 'flex justify-between items-center mb-3' }, [
          Dom.el('div', { style: 'font-weight:700;font-size:14px' }, [label]),
          Dom.el('div', { class: 'badge ' + (pct >= 100 ? 'badge-good' : pct >= 50 ? 'badge-warn' : 'badge-bad') }, [Dom.fmtPct(pct)])
        ]),
        Dom.el('div', { class: 'progress-track mb-2' }, [Dom.el('div', { class: 'progress-fill', style: 'width:' + Dom.clamp(pct, 0, 100) + '%' })]),
        Dom.el('div', { class: 'flex justify-between', style: 'font-size:12.5px' }, [
          Dom.el('div', { class: 'text-secondary' }, ['Current: ' + Dom.fmtMoney(current)]),
          Dom.el('div', { class: 'text-secondary' }, ['Goal: ' + Dom.fmtMoney(goal)])
        ])
      ]);
    }

    function savingsRateCard(goalPct, actualPct) {
      var achieved = goalPct > 0 ? Dom.clamp((actualPct / goalPct) * 100, 0, 999) : 100;
      return Dom.el('div', { class: 'card' }, [
        Dom.el('div', { class: 'flex justify-between items-center mb-3' }, [
          Dom.el('div', { style: 'font-weight:700;font-size:14px' }, ['Savings Rate: Goal vs Actual']),
          Dom.el('div', { class: 'badge ' + (actualPct >= goalPct ? 'badge-good' : actualPct >= goalPct * 0.6 ? 'badge-warn' : 'badge-bad') }, [Dom.fmtPct(actualPct)])
        ]),
        Dom.el('div', { class: 'chart-wrap', style: 'height:140px' }, [Dom.el('canvas', { id: 'savingsRateChart' })])
      ]);
    }

    function kpiMini(label, value) {
      return Dom.el('div', { class: 'card kpi-card' }, [Dom.el('div', { class: 'kpi-label' }, [label]), Dom.el('div', { class: 'kpi-value' }, [value])]);
    }

    draw();

    // second animation frame for the savings-rate mini chart (needs its canvas to exist)
    var unsub = Store.subscribe('*', Dom.debounce(function () { Dom.withFocusPreserved(container, draw); drawSavingsChart(); }, 30));
    requestAnimationFrame(drawSavingsChart);
    function drawSavingsChart() {
      var c = Store.getAll();
      var goalPct = Calc.num((c.budgetGoals || {}).savingsRateGoal);
      var actualPct = Calc.savingsRate(c);
      var canvas = document.getElementById('savingsRateChart');
      if (!canvas) return;
      var t = Charts.themeColors();
      Charts.render(canvas, {
        type: 'bar',
        data: { labels: ['Goal', 'Actual'], datasets: [{ data: [goalPct, actualPct], backgroundColor: [t.palette[1], t.palette[0]] }] },
        options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { ticks: { callback: function (v) { return v + '%'; } } } } }
      });
    }

    return unsub;
  }

  return { title: 'Bank Account Buckets', render: render };
})();
