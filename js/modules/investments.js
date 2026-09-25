/* ============================================================
   investments.js — Investment Planning module
   ============================================================ */

var ModuleInvestments = (function () {
  var hideFeesAndBonuses = {}; // plan id -> bool, persists column visibility across re-renders
  var INVESTMENT_TYPES = ['Investment Policy (ILP)', 'Unit Trust', 'ETF', 'Shares', 'Bonds', 'Gold', 'Crypto', 'REIT', 'Endowment', 'Other'];

  function render(container) {
    function draw() {
      var c = Store.getAll();
      container.innerHTML = '';
      container.appendChild(Dom.el('div', { class: 'page-header' }, [
        Dom.el('h1', {}, ['Investment Planning']),
        Dom.el('div', { class: 'sub' }, ['Each plan projects independently, then rolls up into Dashboard, Net Worth, and Retirement.'])
      ]));

      var currentAge = Calc.ageFromDob((c.personal || {}).dob) || (c.retirement || {}).currentAge;
      container.appendChild(Dom.el('div', { class: 'grid grid-kpi mb-3' }, [
        kpiMini('Current Investment Value', Dom.fmtMoney(Calc.investmentValueAtAge(c, currentAge)), 'Today\u2019s value, not a future projection'),
        kpiMini('Current Annual Dividend', Dom.fmtMoney(Calc.totalAnnualDividendAtAge(c, currentAge))),
        kpiMini('Current Monthly Dividend', Dom.fmtMoney(Calc.totalMonthlyDividendAtAge(c, currentAge)))
      ]));

      (c.investments || []).forEach(function (plan, idx) { container.appendChild(planCard(plan, idx, Calc.ageFromDob((c.personal || {}).dob) || (c.retirement || {}).currentAge)); });

      container.appendChild(Dom.el('button', {
        class: 'btn btn-secondary mt-3', onclick: function () {
          var arr = Store.get('investments') || [];
          arr.push({
            id: Dom.uid('inv'), name: 'New Investment Plan', assetType: 'Unit Trust', monthlyPremium: 500, startAge: 35, stopAge: 60,
            dividendYield: 3, welcomeBonus: 0, loyaltyBonus: 0, fees: 1, feesEndAge: 60, expectedReturn: 5,
            inflation: 2.5, projectionAge: 65
          });
          Store.set('investments', arr);
        }
      }, ['+ Add Investment Plan']));
    }

    function planCard(plan, idx, currentAge) {
      var base = 'investments.' + idx + '.';

      var card = Dom.el('div', { class: 'card mb-3 compact-fields' });
      card.appendChild(Dom.el('div', { class: 'policy-head' }, [
        Dom.el('div', {}, [
          Dom.el('div', { style: 'font-size:13px;font-weight:700' }, [plan.name]),
          Dom.el('div', { class: 'text-tertiary' }, [plan.assetType || 'Unit Trust'])
        ]),
        Dom.el('button', { class: 'btn btn-ghost btn-sm', onclick: function () { var arr = Store.get('investments'); arr.splice(idx, 1); Store.set('investments', arr); } }, ['Remove'])
      ]));

      var f1 = Dom.el('div', { class: 'input-row compact-row' }, [
        Fields.textInput(base + 'name', 'Plan Name'),
        Fields.selectInput(base + 'assetType', 'Type', INVESTMENT_TYPES),
        Fields.numberInput(base + 'startAge', 'Start Age')
      ]);
      card.appendChild(f1);

      card.appendChild(Dom.el('div', { class: 'input-row compact-row mt-2' }, [
        Fields.moneyInput(base + 'monthlyPremium', 'Monthly Premium'),
        Fields.numberInput(base + 'stopAge', 'Stop Contributing Age'),
        Fields.numberInput(base + 'dividendYield', 'Dividend Yield %', { step: '0.1' })
      ]));
      var f3 = Dom.el('div', { class: 'input-row compact-row mt-2' }, [
        Fields.moneyInput(base + 'welcomeBonus', 'Welcome Bonus'),
        Fields.moneyInput(base + 'loyaltyBonus', 'Loyalty Bonus'),
        Fields.numberInput(base + 'expectedReturn', 'Expected Return %', { step: '0.1' })
      ]);
      var f4 = Dom.el('div', { class: 'input-row compact-row mt-2' }, [
        Fields.numberInput(base + 'fees', 'Fees %', { step: '0.1' }),
        Fields.numberInput(base + 'feesEndAge', 'Fees End Age'),
        Fields.numberInput(base + 'inflation', 'Inflation %', { step: '0.1' })
      ]);
      var f5 = Dom.el('div', { class: 'input-row compact-row mt-2' }, [
        Fields.numberInput(base + 'dividendSwitchAge', 'Switch to Dividend Fund at Age'),
        Fields.numberInput(base + 'postSwitchDividendYield', 'Dividend Fund Yield %', { step: '0.1' })
      ]);
      card.appendChild(f3); card.appendChild(f4); card.appendChild(f5);
      card.appendChild(Dom.el('div', { class: 'text-tertiary mt-2', style: 'line-height:1.5' }, [
        '"Stop Contributing Age" is when premiums stop; the balance keeps compounding until "Expected Withdrawal Age" even with no further contributions. "Fees End Age" lets a fee that tapers off (e.g. an initial advisory charge) stop being deducted before the plan matures \u2014 leave it equal to Stop Contributing Age if fees apply for as long as you\u2019re contributing. "Switch to Dividend Fund at Age" is optional: leave blank to keep using Dividend Yield throughout. If set, the fund value at that age is whatever this same projection already produces from premiums paid, stop age, and expected return \u2014 nothing separate to reconcile \u2014 and dividends from that age onward use "Dividend Fund Yield" instead.'
      ]));

      var f6 = Dom.el('div', { class: 'input-row compact-row mt-2' }, [
        Fields.numberInput(base + 'projectionAge', 'Expected Withdrawal Age'),
        Fields.moneyInput(base + 'currentValue', 'Current Investment Value (if plan is already running)'),
        Fields.numberInput(base + 'currentValueAge', 'As of Age')
      ]);
      card.appendChild(f6);
      card.appendChild(Dom.el('div', { class: 'text-tertiary mt-2', style: 'line-height:1.5' }, [
        '"Current Investment Value" is optional, for a plan that\u2019s already been running: enter today\u2019s real account value and the age it was observed, and the projection is grounded to that actual figure at that age instead of trusting a recomputation from scratch since Start Age.'
      ]));

      card.appendChild(Dom.el('div', { style: 'font-weight:700;font-size:13.5px;margin-top:16px;margin-bottom:8px' }, ['Annual Projection Table']));
      card.appendChild(projectionTable(plan, currentAge));

      return card;
    }

    // Year-by-year table for every plan, regardless of product: Year, Age,
    // Premium in Cash (what the client actually pays, gross), Investment
    // Inflow (what actually reaches the fund after any upfront charge),
    // Bonuses, Fees, Investment Value, Dividend Amount, and Net Amount
    // (dividend received minus cash paid that year). Bonuses/Fees are
    // hideable. GWA4/GFA call their own dedicated engines directly (richer
    // product mechanics); every other plan uses investmentPlanProjection,
    // which now exposes feeAmount/totalBonus as explicit dollar figures
    // too, so the same table shape works for both without approximation.
    function projectionTable(plan, currentAge) {
      var startAge = Calc.num(plan.startAge);
      var genericRows = Calc.investmentPlanProjection(plan, plan.projectionAge);
      var startFrom = currentAge != null ? Math.max(startAge, currentAge) : startAge;
      genericRows = genericRows.filter(function (r) { return r.age >= startFrom; });
      var rawRows = genericRows.map(function (r) {
        return { year: r.age - startAge, age: r.age, premiumPaid: r.premiumPaid, feeAmount: r.feeAmount, totalBonus: r.totalBonus, accountValue: r.accumulatedValue, annualDividend: r.annualDividend, investmentInflow: r.premiumPaid, switchedToDividendFund: r.switchedToDividendFund };
      });

      var hidden = !!hideFeesAndBonuses[plan.id];
      var wrap = Dom.el('div', {});
      if (currentAge != null && currentAge > startAge) {
        wrap.appendChild(Dom.el('div', { class: 'text-tertiary mb-2' }, [
          'Table starts from today\u2019s age (' + currentAge + '), not the plan\u2019s original Start Age (' + startAge + ') \u2014 the Investment Value at age ' + currentAge + ' still reflects everything paid in since Start Age.'
        ]));
      }
      wrap.appendChild(Dom.el('div', { class: 'flex justify-end mb-2' }, [
        Dom.el('button', {
          class: 'btn btn-ghost btn-sm',
          onclick: function () { hideFeesAndBonuses[plan.id] = !hidden; Dom.withFocusPreserved(container, draw); }
        }, [hidden ? 'Show Fees & Bonuses' : 'Hide Fees & Bonuses'])
      ]));

      var headers = ['Year', 'Age', 'Premium in Cash', 'Investment Inflow'];
      if (!hidden) headers.push('Bonuses', 'Fees');
      headers.push('Investment Value', 'Dividend Amount', 'Net Amount');

      var tableWrap = Dom.el('div', { class: 'table-scroll' });
      var table = Dom.el('table', { class: 'data-table' });
      table.appendChild(Dom.el('thead', {}, [Dom.el('tr', {}, headers.map(function (h) { return Dom.el('th', {}, [h]); }))]));
      var tbody = Dom.el('tbody');
      // The generic model already adds each year's premium AFTER growth
      // is applied to the PRIOR balance — so its very first row (prior
      // balance = 0) already shows the initial premium+bonus with no
      // growth yet applied, the same "instant of inception" moment. This
      // model's milestones (Stop Contributing Age, Fees End Age) are all
      // defined by AGE, not a year counter, so simply relabelling this
      // first row "0" (instead of adding a separate one) doesn't risk
      // the kind of milestone misalignment GWA4's fixed "Policy Year"
      // numbering would.
      rawRows.forEach(function (r) {
        var premiumInCash = r.premiumPaid || 0;
        var feeAmount = r.feeAmount || 0;
        var investmentInflow = r.investmentInflow != null ? r.investmentInflow : premiumInCash;
        var totalBonus = r.totalBonus || 0;
        var dividend = r.annualDividend || 0;
        var netAmount = dividend - premiumInCash;
        var cells = [
          Dom.el('td', {}, [String(r.year)]),
          Dom.el('td', {}, [String(r.age) + (r.switchedToDividendFund ? ' \ud83d\udcb0' : '')]),
          Dom.el('td', {}, [premiumInCash > 0 ? Dom.fmtMoney(premiumInCash) : '\u2014']),
          Dom.el('td', {}, [investmentInflow > 0 ? Dom.fmtMoney(investmentInflow) : '\u2014'])
        ];
        if (!hidden) {
          cells.push(Dom.el('td', { style: totalBonus > 0 ? 'color:var(--good)' : '' }, [totalBonus > 0 ? '+' + Dom.fmtMoney(totalBonus) : '\u2014']));
          cells.push(Dom.el('td', { style: feeAmount > 0 ? 'color:var(--burgundy)' : '' }, [feeAmount > 0 ? '\u2212' + Dom.fmtMoney(feeAmount) : '\u2014']));
        }
        cells.push(Dom.el('td', { style: 'font-weight:700' }, [Dom.fmtMoney(r.accountValue)]));
        cells.push(Dom.el('td', {}, [dividend > 0 ? Dom.fmtMoney(dividend) : '\u2014']));
        cells.push(Dom.el('td', { style: netAmount < 0 ? 'color:var(--bad)' : netAmount > 0 ? 'color:var(--good)' : '' }, [(netAmount >= 0 ? '+' : '\u2212') + Dom.fmtMoney(Math.abs(netAmount))]));
        tbody.appendChild(Dom.el('tr', { style: r.switchedToDividendFund ? 'background:var(--good-soft)' : '' }, cells));
      });
      table.appendChild(tbody);
      tableWrap.appendChild(table);
      wrap.appendChild(tableWrap);
      return wrap;
    }

    function kpiMini(label, value, caption) {
      var children = [Dom.el('div', { class: 'kpi-label' }, [label]), Dom.el('div', { class: 'kpi-value' }, [value])];
      if (caption) children.push(Dom.el('div', { class: 'text-tertiary mt-1' }, [caption]));
      return Dom.el('div', { class: 'card kpi-card' }, children);
    }

    draw();
    return Store.subscribe('*', Dom.debounce(function () { Dom.withFocusPreserved(container, draw); }, 30));
  }

  return { title: 'Investment Planning', render: render };
})();
