/* ============================================================
   roadmap.js — Cash Flow Roadmap: a year-by-year savings ledger
   from now to life expectancy. Distinct from Retirement Planning
   (which compares a required lump sum against projected assets at
   one point in time) — this tracks an actual running cash balance
   year by year, crediting income (until Retirement Age, then
   switching to retirement payouts), deducting inflation-adjusted
   expenses every year, and applying one-off life-event drawdowns
   exactly in the year they happen.
   ============================================================ */

var ModuleRoadmap = (function () {
  function render(container) {
    function draw() {
      var c = Store.getAll();
      var rm = c.roadmap || {};
      var rows = Calc.roadmapProjection(c);
      container.innerHTML = '';
      container.appendChild(Dom.el('div', { class: 'page-header' }, [
        Dom.el('h1', {}, ['🗺️ Cash Flow Roadmap']),
        Dom.el('div', { class: 'sub' }, ['A year-by-year running savings balance \u2014 income credited, expenses and life events deducted, growing with interest \u2014 from now to life expectancy.'])
      ]));

      // ---- Assumptions ----
      container.appendChild(Dom.el('div', { class: 'section-title', style: 'margin-top:0' }, ['\u2699\uFE0F Assumptions']));
      var assumeCard = Dom.el('div', { class: 'card mb-3' });
      assumeCard.appendChild(Dom.el('div', { class: 'input-row compact-row narrow-row' }, [
        Fields.numberInput('roadmap.interestRate', 'Interest Rate % p.a.', { step: '0.01' }),
        Fields.numberInput('roadmap.inflationRate', 'Expense Inflation % p.a.', { step: '0.1' }),
        Fields.numberInput('cashflow.incomeGrowthRate', 'Income Growth % p.a.', { step: '0.1' })
      ]));
      assumeCard.appendChild(Dom.el('div', { class: 'text-tertiary mt-2' }, [
        'Interest Rate defaults to 0.05% (a savings/current account rate, not an investment return \u2014 for investment growth assumptions, see Retirement Planning\u2019s Expected Return). Expense Inflation defaults to 2%/year. Income Growth (e.g. salary increments) grows annual income year over year until Retirement Age, then switches to the Retirement Payout below \u2014 leave at 0 to assume flat income.'
      ]));
      container.appendChild(assumeCard);

      // ---- Does desired retirement income match projected expenses? ----
      // Two separate numbers exist elsewhere in the app that SHOULD
      // roughly agree, but nothing previously checked that they
      // actually do: Retirement Planning's "Desired Monthly Income"
      // (a manually-typed aspiration, inflated using ITS OWN inflation
      // assumption) versus this roadmap's own projection of what
      // current Cashflow expenses actually grow to by retirement age
      // (using the Expense Inflation assumption above, and correctly
      // reflecting any Expenses That Stop). A big gap between the two
      // usually means the stated desired income doesn't actually match
      // the client's real spending pattern.
      var retirementAgeForCheck = Calc.num((c.retirement || {}).retirementAge);
      var rowAtRetirement = rows.filter(function (r) { return r.age === retirementAgeForCheck; })[0];
      if (rowAtRetirement) {
        var projectedExpensesMonthly = rowAtRetirement.expensesDeducted / 12;
        var desiredIncomeMonthly = Calc.retirementProjection(c).futureMonthlyNeed;
        var gap = desiredIncomeMonthly - projectedExpensesMonthly;
        var gapPct = projectedExpensesMonthly > 0 ? (gap / projectedExpensesMonthly) * 100 : 0;
        var isCloseMatch = Math.abs(gapPct) <= 10;
        container.appendChild(Dom.el('div', { class: 'section-title' }, ['\u2696\ufe0f Does Desired Income Match Projected Expenses?']));
        var checkCard = Dom.el('div', { class: 'card mb-3' });
        checkCard.appendChild(Dom.el('div', { class: 'grid grid-kpi mb-2' }, [
          Dom.el('div', { class: 'card kpi-card' }, [
            Dom.el('div', { class: 'kpi-label' }, ['Projected Expenses at Retirement (age ' + retirementAgeForCheck + ')']),
            Dom.el('div', { class: 'kpi-value' }, [Dom.fmtMoney(projectedExpensesMonthly) + '/mo']),
            Dom.el('div', { class: 'text-tertiary mt-1' }, ['From Cashflow, grown at ' + Calc.num(rm.inflationRate || 2) + '%/yr, net of any Expenses That Stop by then'])
          ]),
          Dom.el('div', { class: 'card kpi-card' }, [
            Dom.el('div', { class: 'kpi-label' }, ['Desired Monthly Income (from Retirement Planning)']),
            Dom.el('div', { class: 'kpi-value' }, [Dom.fmtMoney(desiredIncomeMonthly) + '/mo']),
            Dom.el('div', { class: 'text-tertiary mt-1' }, ['Today\u2019s figure inflated to age ' + retirementAgeForCheck + ' at Retirement Planning\u2019s own Inflation % assumption'])
          ]),
          Dom.el('div', { class: 'card kpi-card' }, [
            Dom.el('div', { class: 'kpi-label' }, ['Gap']),
            Dom.el('div', { class: 'kpi-value', style: isCloseMatch ? 'color:var(--good)' : 'color:var(--bad)' }, [(gap >= 0 ? '+' : '\u2212') + Dom.fmtMoney(Math.abs(gap)) + '/mo']),
            Dom.el('div', { class: 'text-tertiary mt-1' }, [(gapPct >= 0 ? '+' : '') + gapPct.toFixed(0) + '% vs projected expenses'])
          ])
        ]));
        checkCard.appendChild(Dom.el('div', { class: isCloseMatch ? 'text-secondary' : 'text-secondary', style: 'font-weight:600;color:' + (isCloseMatch ? 'var(--good)' : 'var(--bad)') }, [
          isCloseMatch
            ? '\u2713 Roughly aligned \u2014 desired income is within 10% of projected expenses.'
            : (gap > 0
              ? '\u26a0\ufe0f Desired income is ' + Math.abs(gapPct).toFixed(0) + '% HIGHER than projected expenses \u2014 either the client wants a genuinely higher lifestyle in retirement than today, or Desired Monthly Income may be overstated.'
              : '\u26a0\ufe0f Desired income is ' + Math.abs(gapPct).toFixed(0) + '% LOWER than projected expenses \u2014 the stated retirement lifestyle may not actually cover what current spending, grown forward, suggests will be needed.')
        ]));
        container.appendChild(checkCard);
      }

      // ---- Retirement payout override ----
      var payoutSuggestion = Calc.roadmapRetirementPayoutSuggestion(c);
      var payoutOverride = rm.retirementPayoutOverride;
      var payoutActive = payoutOverride != null && payoutOverride !== '';
      container.appendChild(Dom.el('div', { class: 'section-title' }, ['\ud83d\udcb0 Retirement Payout (monthly, from Retirement Age onward)']));
      var payoutCard = Dom.el('div', { class: 'card mb-3' });
      payoutCard.appendChild(Dom.el('div', { class: 'input-row compact-row narrow-row' }, [
        Fields.moneyInput('roadmap.retirementPayoutOverride', 'Monthly Retirement Payout')
      ]));
      payoutCard.appendChild(Dom.el('div', { class: 'text-tertiary mt-2' }, [
        'Auto-suggested from CPF Tab\u2019s CPF LIFE estimate + Investment Planning\u2019s projected dividend income AT Retirement Age (not today\u2019s dividend figure, since investments typically grow substantially by then) + rental/other passive income (currently ' + Dom.fmtMoney(payoutSuggestion) + '/month) \u2014 edit freely, e.g. to model a different CPF LIFE plan or exclude income that won\u2019t actually continue. ',
        Dom.el('a', {
          href: '#', style: 'color:var(--accent);cursor:pointer',
          onclick: function (e) { e.preventDefault(); Store.set('roadmap.retirementPayoutOverride', Math.round(payoutSuggestion * 100) / 100); }
        }, ['Use this suggestion'])
      ]));
      if (payoutActive) {
        payoutCard.appendChild(Dom.el('div', { class: 'text-secondary mt-2', style: 'font-weight:600' }, ['\u2713 Currently using ' + Dom.fmtMoney(Calc.num(payoutOverride)) + '/month']));
      }
      container.appendChild(payoutCard);

      // ---- Life events ----
      container.appendChild(Dom.el('div', { class: 'section-title' }, ['\ud83c\udfe1 Life Events (one-off, recurring, or pay-in/payout)']));
      var eventsCard = Dom.el('div', { class: 'card mb-3' });
      var events = rm.lifeEvents || [];
      if (events.length === 0) {
        eventsCard.appendChild(Dom.el('div', { class: 'text-tertiary mb-2' }, ['None yet. Covers three patterns: a one-off lump sum (home purchase, a child\u2019s education) \u2014 leave Duration at 1 year; a recurring outflow for a fixed term (a car loan repayment, insurance premiums for 20 years) \u2014 set Duration to the number of years; or a pay-in-then-payout product (a retirement/endowment plan: pay in for X years, then receive $Y/year for Z years from a later age) \u2014 add it as TWO events sharing a name: one Outflow for the pay-in phase, one Inflow (starting at the payout age) for the payout phase.']));
      }
      events.forEach(function (ev, idx) {
        var row = Dom.el('div', { class: 'input-row compact-row mb-2', style: 'align-items:end' }, [
          Fields.textInput('roadmap.lifeEvents.' + idx + '.name', 'Event Name'),
          Fields.numberInput('roadmap.lifeEvents.' + idx + '.age', 'Starts At Age'),
          Fields.moneyInput('roadmap.lifeEvents.' + idx + '.amount', 'Amount Per Year'),
          Fields.numberInput('roadmap.lifeEvents.' + idx + '.durationYears', 'Duration (years)'),
          Fields.selectInput('roadmap.lifeEvents.' + idx + '.direction', 'Direction', ['Outflow', 'Inflow'])
        ]);
        row.appendChild(Dom.el('button', {
          class: 'btn btn-ghost btn-sm',
          onclick: function () { var arr = Store.get('roadmap.lifeEvents'); arr.splice(idx, 1); Store.set('roadmap.lifeEvents', arr); }
        }, ['Remove']));
        eventsCard.appendChild(row);
        var duration = ev.durationYears != null && ev.durationYears !== '' ? Calc.num(ev.durationYears) : 1;
        var endAge = Calc.num(ev.age) + Math.max(1, duration) - 1;
        eventsCard.appendChild(Dom.el('div', { class: 'text-tertiary mb-3', style: 'margin-top:-8px' }, [
          duration <= 1
            ? ('One-off ' + ((ev.direction || '').toLowerCase() === 'inflow' ? 'inflow' : 'outflow') + ' at age ' + Calc.num(ev.age) + '.')
            : (((ev.direction || '').toLowerCase() === 'inflow' ? 'Inflow' : 'Outflow') + ' of ' + Dom.fmtMoney(Calc.num(ev.amount)) + '/year from age ' + Calc.num(ev.age) + ' to ' + endAge + ' (' + duration + ' years).')
        ]));
      });
      eventsCard.appendChild(Dom.el('button', {
        class: 'btn btn-secondary btn-sm',
        onclick: function () {
          var arr = Store.get('roadmap.lifeEvents') || [];
          arr.push({ name: 'New Event', age: Calc.ageFromDob((c.personal || {}).dob) || 40, amount: 0, durationYears: 1, direction: 'Outflow' });
          Store.set('roadmap.lifeEvents', arr);
        }
      }, ['+ Add Life Event']));
      container.appendChild(eventsCard);

      // ---- Expenses that stop (mortgage paid off, insurance term ending) ----
      var expenseStops = rm.expenseStops || [];
      var stopsCollapsed = !!rm.expenseStopsCollapsed;
      var stopsTitleRow = Dom.el('div', { class: 'flex justify-between items-center', style: 'margin-top:28px;margin-bottom:12px' }, [
        Dom.el('div', { class: 'section-title', style: 'margin:0' }, ['\ud83d\uded1 Expenses That Stop' + (expenseStops.length ? ' (' + expenseStops.length + ' selected)' : '')]),
        Dom.el('button', {
          class: 'btn btn-ghost btn-sm',
          onclick: function () { Store.set('roadmap.expenseStopsCollapsed', !stopsCollapsed); }
        }, [stopsCollapsed ? 'Show' : 'Hide'])
      ]);
      container.appendChild(stopsTitleRow);

      if (stopsCollapsed) {
        var collapsedCard = Dom.el('div', { class: 'card mb-3' });
        collapsedCard.appendChild(Dom.el('div', { class: 'text-tertiary' }, [
          expenseStops.length
            ? (expenseStops.length + ' expense' + (expenseStops.length === 1 ? '' : 's') + ' set to stop: ' + expenseStops.map(function (es) { return es.name + ' (age ' + Calc.num(es.endAge) + ')'; }).join(', '))
            : 'None selected.'
        ]));
        container.appendChild(collapsedCard);
      } else {
        var stopsCard = Dom.el('div', { class: 'card mb-3' });
        stopsCard.appendChild(Dom.el('div', { class: 'text-tertiary mb-3' }, [
          'Not every expense in Cashflow runs forever \u2014 a mortgage gets paid off, an insurance term ends. Tick any that should stop at a given age below, rather than retyping each one \u2014 this permanently reduces the ongoing Expenses Deducted figure from that age onward, rather than it continuing to grow with inflation as if that cost never stopped.'
        ]));

        // Build a flat list of every existing Cashflow item, each tagged
        // with a stable sourceId (category.item) so a checkbox can be
        // matched back to its expenseStops entry reliably, even if the
        // item's name is later edited on Cashflow.
        var allCashflowItems = [];
        (c.cashflowCategories || []).forEach(function (cat) {
          (cat.items || []).forEach(function (item) {
            allCashflowItems.push({ sourceId: cat.id + '.' + item.id, name: item.name, categoryName: cat.name, monthlyAmount: Calc.itemMonthly(item) });
          });
        });

        if (allCashflowItems.length === 0) {
          stopsCard.appendChild(Dom.el('div', { class: 'text-tertiary mb-2' }, ['No expense items found on Cashflow yet \u2014 add some there first, or use the custom entry below.']));
        } else {
          var checklist = Dom.el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:2px 16px' });
          allCashflowItems.forEach(function (item) {
            var stopIdx = expenseStops.findIndex(function (es) { return es.sourceId === item.sourceId; });
            var isChecked = stopIdx > -1;
            var checkboxRow = Dom.el('div', { style: 'padding:4px 2px;border-bottom:1px solid var(--border)' }, [
              Dom.el('div', { class: 'flex items-center gap-2' }, [
                Dom.el('input', {
                  type: 'checkbox', checked: isChecked ? 'checked' : null,
                  onchange: function (e) {
                    var arr = Store.get('roadmap.expenseStops') || [];
                    if (e.target.checked) {
                      arr.push({ sourceId: item.sourceId, name: item.name, monthlyAmount: item.monthlyAmount, endAge: (Calc.ageFromDob((c.personal || {}).dob) || 40) + 10 });
                    } else {
                      arr = arr.filter(function (es) { return es.sourceId !== item.sourceId; });
                    }
                    Store.set('roadmap.expenseStops', arr);
                  }
                }),
                Dom.el('div', { style: 'flex:1;min-width:0' }, [
                  Dom.el('span', { style: 'font-weight:600;font-size:12px' }, [item.name]),
                  Dom.el('span', { class: 'text-tertiary', style: 'font-size:10.5px' }, [' \u2014 ' + item.categoryName + ' \u00b7 ' + Dom.fmtMoney(item.monthlyAmount) + '/mo'])
                ])
              ])
            ]);
            if (isChecked) {
              checkboxRow.appendChild(Dom.el('div', { style: 'display:flex;align-items:center;gap:6px;margin:2px 0 2px 24px' }, [
                Dom.el('span', { class: 'text-tertiary', style: 'font-size:10.5px' }, ['Stops at age']),
                Dom.el('div', { style: 'width:70px' }, [Fields.numberInput('roadmap.expenseStops.' + stopIdx + '.endAge', '')])
              ]));
            }
            checklist.appendChild(checkboxRow);
          });
          stopsCard.appendChild(checklist);
        }
        container.appendChild(stopsCard);

        // ---- Custom entries, for anything not tracked as a Cashflow item ----
        var customStops = expenseStops.filter(function (es) { return !es.sourceId; });
        if (customStops.length) {
          var customCard = Dom.el('div', { class: 'card mb-3' });
          customCard.appendChild(Dom.el('div', { class: 'text-tertiary mb-2' }, ['Custom entries (not linked to a Cashflow item):']));
          customStops.forEach(function (es) {
            var idx = expenseStops.indexOf(es);
            var row = Dom.el('div', { class: 'input-row compact-row mb-2', style: 'align-items:end' }, [
              Fields.textInput('roadmap.expenseStops.' + idx + '.name', 'Expense Name'),
              Fields.moneyInput('roadmap.expenseStops.' + idx + '.monthlyAmount', 'Monthly Amount (today\u2019s $)'),
              Fields.numberInput('roadmap.expenseStops.' + idx + '.endAge', 'Stops At Age')
            ]);
            row.appendChild(Dom.el('button', {
              class: 'btn btn-ghost btn-sm',
              onclick: function () { var arr = Store.get('roadmap.expenseStops'); arr.splice(idx, 1); Store.set('roadmap.expenseStops', arr); }
            }, ['Remove']));
            customCard.appendChild(row);
          });
          container.appendChild(customCard);
        }
        container.appendChild(Dom.el('button', {
          class: 'btn btn-secondary btn-sm mb-3',
          onclick: function () {
            var arr = Store.get('roadmap.expenseStops') || [];
            arr.push({ name: 'Custom Expense', monthlyAmount: 0, endAge: (Calc.ageFromDob((c.personal || {}).dob) || 40) + 10 });
            Store.set('roadmap.expenseStops', arr);
          }
        }, ['+ Add Custom Expense (not on Cashflow)']));
      }

      // ---- The roadmap table ----
      container.appendChild(Dom.el('div', { class: 'section-title' }, ['\ud83d\udcc5 Year-by-Year Roadmap']));
      var retirementAge = Calc.num((c.retirement || {}).retirementAge);
      var tableCard = Dom.el('div', { class: 'card' });
      if (rows.length === 0) {
        tableCard.appendChild(Dom.el('div', { class: 'text-tertiary' }, ['Set Current Age, Retirement Age, and Life Expectancy on Retirement Planning first.']));
      } else {
        var tableWrap = Dom.el('div', { class: 'table-scroll' });
        var table = Dom.el('table', { class: 'data-table' });
        table.appendChild(Dom.el('thead', {}, [Dom.el('tr', {}, [
          'Year', 'Age', 'Savings Balance', 'Interest', 'Income Credited', 'Retirement Payout', 'Expenses Deducted', 'Life Event'
        ].map(function (h) { return Dom.el('th', {}, [h]); }))]));
        var tbody = Dom.el('tbody');
        rows.forEach(function (r) {
          var isNegative = r.balance < 0;
          var eventLabel = r.events.length ? r.events.map(function (ev) {
            var sign = (ev.direction || '').toLowerCase() === 'inflow' ? '+' : '\u2212';
            return ev.name + ' (' + sign + Dom.fmtMoney(Calc.num(ev.amount)) + ')';
          }).join(', ') : '\u2014';
          var eventColor = r.eventNet > 0 ? 'color:var(--good);font-weight:700' : r.eventNet < 0 ? 'color:var(--burgundy);font-weight:700' : '';
          var isTransitionYear = r.age === retirementAge;
          tbody.appendChild(Dom.el('tr', { style: isTransitionYear ? 'background:var(--accent-soft)' : '' }, [
            Dom.el('td', {}, [String(r.year)]),
            Dom.el('td', { style: 'font-weight:600' }, [String(r.age) + (isTransitionYear ? ' \u2192 Retires' : '')]),
            Dom.el('td', { style: 'font-weight:700;' + (isNegative ? 'color:var(--bad)' : '') }, [Dom.fmtMoney(r.balance)]),
            Dom.el('td', {}, [Dom.fmtMoney(r.interest)]),
            Dom.el('td', {}, [r.incomeCredited > 0 ? Dom.fmtMoney(r.incomeCredited) : '\u2014']),
            Dom.el('td', {}, [r.retirementPayoutCredited > 0 ? Dom.fmtMoney(r.retirementPayoutCredited) : '\u2014']),
            Dom.el('td', { style: 'color:var(--burgundy)' }, [
              '\u2212' + Dom.fmtMoney(r.expensesDeducted),
              r.stoppedExpenses.length ? Dom.el('div', { style: 'font-size:10.5px;color:var(--good);font-weight:700' }, ['\u2713 ' + r.stoppedExpenses.map(function (es) { return es.name; }).join(', ') + ' stopped']) : null
            ].filter(Boolean)),
            Dom.el('td', { style: eventColor }, [eventLabel])
          ]));
        });
        table.appendChild(tbody); tableWrap.appendChild(table); tableCard.appendChild(tableWrap);
        tableCard.appendChild(Dom.el('div', { class: 'text-tertiary mt-3' }, [
          'Negative balances shown in red \u2014 a warning that the plan as modelled runs out of savings in that year. Expenses Deducted and any Life Event drawdown are shown in burgundy. The highlighted row marks the year the client retires (income stops, Retirement Payout starts).'
        ]));
      }
      container.appendChild(tableCard);
    }

    draw();
    return Store.subscribe('*', Dom.debounce(function () { Dom.withFocusPreserved(container, draw); }, 30));
  }
  return { title: 'Cash Flow Roadmap', render: render };
})();
