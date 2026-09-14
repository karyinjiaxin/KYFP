/* ============================================================
   investments.js — Investment Planning module
   ============================================================ */

var ModuleInvestments = (function () {
  var openTables = {}; // plan id -> bool, persists expand state across re-renders
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
            id: Dom.uid('inv'), name: 'New Investment Plan', assetType: 'Unit Trust', insurerProduct: 'None', monthlyPremium: 500, startAge: 35, stopAge: 60,
            dividendYield: 3, welcomeBonus: 0, loyaltyBonus: 0, fees: 1, feesEndAge: 60, expectedReturn: 5,
            inflation: 2.5, projectionAge: 65
          });
          Store.set('investments', arr);
        }
      }, ['+ Add Investment Plan']));
    }

    function planCard(plan, idx, currentAge) {
      var base = 'investments.' + idx + '.';
      var isOpen = !!openTables[plan.id];

      var card = Dom.el('div', { class: 'card mb-3' });
      card.appendChild(Dom.el('div', { class: 'policy-head' }, [
        Dom.el('div', {}, [
          Dom.el('div', { style: 'font-size:16px;font-weight:700' }, [plan.name]),
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

      // ---- Insurer Product: real GWA4/GFA fee & bonus mechanics ----
      var insurerProduct = plan.insurerProduct || 'None';
      card.appendChild(Dom.el('div', { class: 'input-row compact-row mt-2' }, [
        (function () {
          var field = Fields.selectInput(base + 'insurerProduct', 'Insurer Product', ['None', 'GWA4', 'GFA']);
          var select = field.querySelector('select');
          // Without this, selecting GWA4 leaves gwa4Choice unset, so its
          // OWN dropdown displays "Choice 5" (its first option, shown by
          // default when no option matches an empty stored value) while
          // the calculation silently assumes "Choice 10" — the exact
          // displayed-vs-calculated mismatch this app has hit before.
          // Writing the real default in immediately keeps both in sync.
          if (select) select.addEventListener('change', function (e) {
            if (e.target.value === 'GWA4' && !Store.get(base + 'gwa4Choice')) Store.set(base + 'gwa4Choice', 'Choice 10');
          });
          return field;
        })()
      ]));

      if (insurerProduct === 'GWA4') {
        if (!plan.gwa4Choice) Store.set(base + 'gwa4Choice', 'Choice 10');
        var choice = plan.gwa4Choice || 'Choice 10';
        var choiceYears = choice === 'Choice 5' ? 5 : choice === 'Choice 15' ? 15 : 10;
        card.appendChild(Dom.el('div', { class: 'input-row compact-row mt-2' }, [
          Fields.selectInput(base + 'gwa4Choice', 'GWA4 Plan', ['Choice 5', 'Choice 10', 'Choice 15']),
          Fields.moneyInput(base + 'monthlyPremium', 'Monthly Premium'),
          Fields.numberInput(base + 'gwa4PremiumYears', 'Pay Premiums For (years)')
        ]));
        card.appendChild(Dom.el('div', { class: 'input-row compact-row mt-2' }, [
          Fields.numberInput(base + 'stopAge', 'Project To Age'),
          Fields.numberInput(base + 'expectedReturn', 'Expected Fund Return %', { step: '0.1' }),
          Fields.numberInput(base + 'dividendYield', 'Dividend Yield % (if fund distributes)', { step: '0.1' })
        ]));
        card.appendChild(Dom.el('div', { class: 'text-tertiary mt-2', style: 'line-height:1.5' }, [
          'GREAT Wealth Advantage 4 \u2014 real product mechanics applied automatically: 100% of premium invested from day one, Welcome Bonus (up to 55% depending on plan/premium), Policy Fee (2.5%\u20131.5% early years, dropping to 0.7%), Loyalty Bonus (0.30%/year of account value from year ' + choiceYears + '), Premium Bonus (2%/year from shortly after), and the full surrender charge schedule. "Pay Premiums For" defaults to the full projection if left blank \u2014 set it to ' + choiceYears + ' to model premiums stopping at the ' + choice + ' term while the whole-of-life policy keeps compounding beyond it. Not modelled: Insurance Charge (cost of insurance), which needs mortality tables this app doesn\u2019t have \u2014 a minor drag near minimum sum assured, understated for a larger protection component. Source: Great Eastern\u2019s GWA4 Product Information Pack, 28 Jun 2024.'
        ]));
      } else if (insurerProduct === 'GFA') {
        card.appendChild(Dom.el('div', { class: 'input-row compact-row mt-2' }, [
          Fields.moneyInput(base + 'lumpSum', 'Lump Sum Amount'),
          Fields.numberInput(base + 'stopAge', 'Project To Age'),
          Fields.numberInput(base + 'expectedReturn', 'Expected Fund Return %', { step: '0.1' })
        ]));
        card.appendChild(Dom.el('div', { class: 'input-row compact-row mt-2' }, [
          Fields.numberInput(base + 'dividendYield', 'Dividend Yield % (if fund distributes)', { step: '0.1' })
        ]));
        card.appendChild(Dom.el('div', { class: 'text-tertiary mt-2', style: 'line-height:1.5' }, [
          'GREAT Flexi Advantage \u2014 a single Premium Charge is deducted upfront (3.0% under age 76, 2.5% from 76), then the balance compounds at Expected Fund Return with no ongoing Policy Fee, Insurance Charge, Fund Switch Fee, or surrender charge (all "Not Applicable" per GFA\u2019s own Product Information Pack) \u2014 Fund Management Charge is already factored into the unit price, not a separate deduction. Source: Great Eastern\u2019s GFA Product Information Pack, 1 Apr 2026.'
        ]));
      } else {
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
      }

      var f6 = Dom.el('div', { class: 'input-row compact-row mt-2' }, [
        Fields.numberInput(base + 'projectionAge', 'Expected Withdrawal Age'),
        Fields.moneyInput(base + 'currentValue', 'Current Investment Value (if plan is already running)'),
        Fields.numberInput(base + 'currentValueAge', 'As of Age')
      ]);
      card.appendChild(f6);
      card.appendChild(Dom.el('div', { class: 'text-tertiary mt-2', style: 'line-height:1.5' }, [
        '"Current Investment Value" is optional, for a plan that\u2019s already been running: enter today\u2019s real account value and the age it was observed, and the projection is grounded to that actual figure at that age instead of trusting a recomputation from scratch since Start Age.'
      ]));

      var toggleHeader = Dom.el('div', {
        class: 'collapsible-header mt-3', onclick: function () {
          openTables[plan.id] = !openTables[plan.id];
          Dom.withFocusPreserved(container, draw);
        }
      }, [
        Dom.el('div', { style: 'font-weight:700;font-size:13.5px' }, ['Annual Projection Table']),
        Dom.el('svg', { class: 'chevron' + (isOpen ? ' open' : ''), width: '18', height: '18', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', html: '<path d="M6 9l6 6 6-6"/>' })
      ]);
      card.appendChild(toggleHeader);

      var body = Dom.el('div', { class: 'collapsible-body' + (isOpen ? ' open' : ''), style: 'margin-top:10px' });
      if (isOpen) body.appendChild(projectionTable(plan, currentAge));
      card.appendChild(body);

      return card;
    }

    function projectionTable(plan, currentAge) {
      if (plan.insurerProduct === 'GWA4' || plan.insurerProduct === 'GFA') {
        return detailedProductTable(plan, currentAge);
      }
      var rows = Calc.investmentPlanProjection(plan, plan.projectionAge);
      var startFrom = currentAge != null ? Math.max(Calc.num(plan.startAge), currentAge) : Calc.num(plan.startAge);
      rows = rows.filter(function (r) { return r.age >= startFrom; });
      var wrap = Dom.el('div', {});
      if (currentAge != null && currentAge > Calc.num(plan.startAge)) {
        wrap.appendChild(Dom.el('div', { class: 'text-tertiary mb-2' }, [
          'Table starts from today\u2019s age (' + currentAge + '), not the plan\u2019s original Start Age (' + plan.startAge + ') \u2014 the Accumulated Value at age ' + currentAge + ' still reflects everything paid in since Start Age.'
        ]));
      }
      var tableWrap = Dom.el('div', { class: 'table-scroll' });
      var table = Dom.el('table', { class: 'data-table' });
      table.appendChild(Dom.el('thead', {}, [
        Dom.el('tr', {}, ['Age', 'Premium Paid', 'Accumulated Value', 'Annual Dividend', 'Monthly Dividend', 'ROI', 'Net Cashflow'].map(function (h) { return Dom.el('th', {}, [h]); }))
      ]));
      var tbody = Dom.el('tbody');
      rows.forEach(function (r) {
        tbody.appendChild(Dom.el('tr', { style: r.switchedToDividendFund ? 'background:var(--good-soft)' : '' }, [
          Dom.el('td', {}, [String(r.age) + (r.switchedToDividendFund ? ' \ud83d\udcb0' : '')]),
          Dom.el('td', {}, [Dom.fmtMoney(r.premiumPaid)]),
          Dom.el('td', {}, [Dom.fmtMoney(r.accumulatedValue)]),
          Dom.el('td', {}, [Dom.fmtMoney(r.annualDividend)]),
          Dom.el('td', {}, [Dom.fmtMoney(r.monthlyDividend)]),
          Dom.el('td', {}, [Dom.fmtPct(r.roi)]),
          Dom.el('td', {}, [Dom.fmtMoney(r.netCashflow)])
        ]));
      });
      table.appendChild(tbody);
      tableWrap.appendChild(table);
      wrap.appendChild(tableWrap);
      return wrap;
    }

    // Detailed year-by-year table for GWA4/GFA plans: Year, Age,
    // Investment Inflow (what actually gets invested), Bonuses, Fees,
    // Investment Value, Dividend Amount, Premium in Cash (what the
    // client actually pays, gross), and Net Amount (dividend received
    // minus cash paid that year). Calls the dedicated product engines
    // directly rather than the generic investmentPlanProjection wrapper,
    // since that collapses bonuses/fees into the account value without
    // exposing them as separate figures.
    function detailedProductTable(plan, currentAge) {
      var startAge = Calc.num(plan.startAge);
      var endAge = Calc.num(plan.stopAge) || startAge;
      var years = Math.max(1, endAge - startAge + 1);
      var isGWA4 = plan.insurerProduct === 'GWA4';
      var rawRows;
      if (isGWA4) {
        var annualPremium = Calc.num(plan.monthlyPremium) * 12;
        var premiumYears = plan.gwa4PremiumYears != null && plan.gwa4PremiumYears !== '' ? Calc.num(plan.gwa4PremiumYears) : years;
        rawRows = Calc.gwa4Projection(annualPremium, plan.gwa4Choice || 'Choice 10', Calc.num(plan.expectedReturn), years, premiumYears, Calc.num(plan.dividendYield));
      } else {
        rawRows = Calc.gfaProjection(Calc.num(plan.lumpSum), startAge, Calc.num(plan.expectedReturn), years, Calc.num(plan.dividendYield));
      }

      var hidden = !!hideFeesAndBonuses[plan.id];
      var wrap = Dom.el('div', {});
      wrap.appendChild(Dom.el('div', { class: 'flex justify-between items-center mb-2' }, [
        Dom.el('div', { class: 'text-tertiary' }, [
          'Premium in Cash is what\u2019s actually paid; Investment Inflow is what reaches the fund after any upfront charge (GFA only \u2014 GWA4 invests 100% of premium, so the two match there).'
        ]),
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
      rawRows.forEach(function (r) {
        var premiumInCash = r.premiumPaid || 0;
        var feeAmount = r.feeAmount || 0;
        // For GFA, the fee is an upfront deduction FROM the premium
        // before it's invested, so Investment Inflow = cash paid minus
        // that charge. For GWA4, the Policy Fee is deducted ONGOING from
        // the whole account value, not from that year's premium itself
        // — so the full premium reaches the fund, and Investment Inflow
        // equals Premium in Cash.
        var investmentInflow = isGWA4 ? premiumInCash : premiumInCash - feeAmount;
        var totalBonus = r.totalBonus || 0;
        var dividend = r.annualDividend || 0;
        var netAmount = dividend - premiumInCash;
        var age = startAge + r.year - 1;
        var cells = [
          Dom.el('td', {}, [String(r.year)]),
          Dom.el('td', {}, [String(age)]),
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
        tbody.appendChild(Dom.el('tr', {}, cells));
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
