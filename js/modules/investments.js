/* ============================================================
   investments.js — Wealth Accumulation Planning module
   ============================================================ */

var ModuleInvestments = (function () {
  var hideFeesAndBonuses = {}; // plan id -> bool, persists column visibility across re-renders
  var INVESTMENT_TYPES = ['Investment Policy (ILP)', 'Unit Trust', 'ETF', 'Shares', 'Bonds', 'Gold', 'Crypto', 'REIT', 'Endowment', 'Other'];

  function render(container) {
    // Transient review-before-save import state — not Store-backed, same
    // "nothing written until Import is clicked" pattern as Insurance
    // Planning's import panel. Resets on navigating away and back.
    var importRawText = '';
    var pendingImport = null;

    function draw() {
      var c = Store.getAll();
      container.innerHTML = '';
      container.appendChild(Dom.el('div', { class: 'page-header' }, [
        Dom.el('h1', {}, ['Wealth Accumulation Planning']),
        Dom.el('div', { class: 'sub' }, ['Each plan projects independently, then rolls up into Dashboard, Net Worth, and Retirement.'])
      ]));

      var currentAge = Calc.ageFromDob((c.personal || {}).dob) || (c.retirement || {}).currentAge;
      container.appendChild(Dom.el('div', { class: 'grid grid-kpi mb-3' }, [
        kpiMini('Current Investment Value', Dom.fmtMoney(Calc.investmentValueAtAge(c, currentAge)), 'Today\u2019s value, not a future projection', 'burgundy'),
        kpiMini('Current Annual Dividend', Dom.fmtMoney(Calc.totalAnnualDividendAtAge(c, currentAge)), null, 'green'),
        kpiMini('Current Monthly Dividend', Dom.fmtMoney(Calc.totalMonthlyDividendAtAge(c, currentAge)), null, 'pink')
      ]));

      container.appendChild(Dom.el('div', { class: 'section-title' }, ['📥 Import Plans']));
      container.appendChild(importPanel());

      (c.investments || []).forEach(function (plan, idx) { container.appendChild(planCard(plan, idx, Calc.ageFromDob((c.personal || {}).dob) || (c.retirement || {}).currentAge)); });

      container.appendChild(Dom.el('div', { class: 'flex gap-2 mt-3' }, [
        Dom.el('button', {
          class: 'btn btn-secondary', onclick: function () {
            var arr = Store.get('investments') || [];
            arr.push({
              id: Dom.uid('inv'), name: 'New Investment Plan', assetType: 'Unit Trust', monthlyPremium: 500, startAge: 35, stopAge: 60,
              dividendYield: 3, welcomeBonus: 0, loyaltyBonus: 0, fees: 1, feesEndAge: 60, expectedReturn: 5,
              inflation: 2, projectionAge: 65
            });
            Store.set('investments', arr);
          }
        }, ['+ Add Investment Plan']),
        Dom.el('button', {
          class: 'btn btn-secondary', onclick: function () {
            var arr = Store.get('investments') || [];
            arr.push({
              id: Dom.uid('inv'), name: 'New Endowment Plan', assetType: 'Endowment', monthlyPremium: 500, startAge: 35, stopAge: 55,
              dividendYield: 3, welcomeBonus: 0, loyaltyBonus: 0, fees: 0, feesEndAge: 0, expectedReturn: 4,
              inflation: 2, projectionAge: 65
            });
            Store.set('investments', arr);
          }
        }, ['+ Add Endowment Plan'])
      ]));
    }

    function planCard(plan, idx, currentAge) {
      var base = 'investments.' + idx + '.';

      var card = Dom.el('div', { class: 'card mb-3 compact-fields' });
      card.appendChild(Dom.el('div', { class: 'policy-head' }, [
        Dom.el('div', {}, [
          Dom.el('div', { style: 'font-size:11.5px;font-weight:700' }, [plan.name]),
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

      // Endowment plans don't carry a welcome/loyalty bonus or a separate
      // advisory fee the way an ILP/Unit Trust might \u2014 those rows are left
      // out entirely rather than shown with fields that'd just stay at 0,
      // which would read as "this plan genuinely has none" when really the
      // concept doesn't apply to it at all.
      var isEndowment = plan.assetType === 'Endowment';
      card.appendChild(Dom.el('div', { class: 'input-row compact-row mt-2' }, [
        Fields.moneyInput(base + 'monthlyPremium', 'Monthly Premium'),
        Fields.numberInput(base + 'stopAge', 'Stop Contributing Age'),
        Fields.numberInput(base + 'dividendYield', 'Dividend Yield %', { step: '0.1' })
      ]));
      if (isEndowment) {
        card.appendChild(Dom.el('div', { class: 'input-row compact-row mt-2' }, [
          Fields.numberInput(base + 'expectedReturn', 'Expected Return %', { step: '0.1' }),
          Fields.numberInput(base + 'inflation', 'Inflation %', { step: '0.1' })
        ]));
      } else {
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
        card.appendChild(f3); card.appendChild(f4);
      }
      var f5 = Dom.el('div', { class: 'input-row compact-row mt-2' }, [
        Fields.numberInput(base + 'dividendSwitchAge', 'Switch to Dividend Fund at Age'),
        Fields.numberInput(base + 'postSwitchDividendYield', 'Dividend Fund Yield %', { step: '0.1' })
      ]);
      card.appendChild(f5);
      card.appendChild(Dom.el('div', { class: 'text-tertiary mt-2', style: 'line-height:1.5' }, [
        isEndowment
          ? '"Stop Contributing Age" is when premiums stop; the balance keeps compounding until "Expected Withdrawal Age" even with no further contributions. "Switch to Dividend Fund at Age" is optional: leave blank to keep using Dividend Yield throughout.'
          : '"Stop Contributing Age" is when premiums stop; the balance keeps compounding until "Expected Withdrawal Age" even with no further contributions. "Fees End Age" lets a fee that tapers off (e.g. an initial advisory charge) stop being deducted before the plan matures \u2014 leave it equal to Stop Contributing Age if fees apply for as long as you\u2019re contributing. "Switch to Dividend Fund at Age" is optional: leave blank to keep using Dividend Yield throughout. If set, the fund value at that age is whatever this same projection already produces from premiums paid, stop age, and expected return \u2014 nothing separate to reconcile \u2014 and dividends from that age onward use "Dividend Fund Yield" instead.'
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
      card.appendChild(Dom.el('div', { class: 'mt-2' }, [
        Fields.textInput(base + 'notes', 'Remarks')
      ]));

      if (!isEndowment) {
        var tableCollapsed = !!plan.projectionTableCollapsed;
        card.appendChild(Dom.el('div', {
          class: 'collapsible-header', style: 'margin-top:16px;margin-bottom:8px',
          onclick: function () {
            var arr = Store.get('investments');
            arr[idx].projectionTableCollapsed = !tableCollapsed;
            Store.set('investments', arr);
          }
        }, [
          Dom.el('div', { class: 'flex items-center gap-2' }, [
            Dom.el('svg', { class: 'chevron' + (tableCollapsed ? '' : ' open'), width: '16', height: '16', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', html: '<path d="M6 9l6 6 6-6"/>' }),
            Dom.el('span', { style: 'font-weight:700;font-size:12px' }, ['Annual Projection Table'])
          ])
        ]));
        if (!tableCollapsed) card.appendChild(projectionTable(plan, currentAge, isEndowment));
      }

      return card;
    }

    // Turns one parsed guess (OCR.parseWealthAccumulationText's shape:
    // company/name/policyNo/monthlyPremium/currentValue/dividendYield/
    // notes) into a review-row object. Fields this import can't know
    // (Start Age, Stop Contributing Age, Expected Return, etc.) use the
    // same sensible defaults as "+ Add Endowment Plan" — reviewed and
    // editable in the table below before anything is saved, same as
    // Insurance Planning's own import.
    function toReviewRow(g) {
      return {
        include: true,
        name: g.name || 'New Plan', company: g.company || '', policyNo: g.policyNo || '',
        monthlyPremium: g.monthlyPremium || 0, currentValue: g.currentValue || 0,
        dividendYield: g.dividendYield != null ? g.dividendYield : 3,
        notes: g.notes || ''
      };
    }

    function runImportParse(text) {
      var guesses = OCR.parseWealthAccumulationText(text);
      if (!guesses) {
        Dom.modalAlert('Couldn’t find a recognizable header row in that paste — make sure the header row (Plan Name, Monthly/Annual Premium or Invested Amount, …) is included.');
        return;
      }
      pendingImport = guesses.map(toReviewRow);
      if (!pendingImport.length) pendingImport = [toReviewRow({})];
      draw();
    }

    function importPanel() {
      var wrap = Dom.el('div', { class: 'card mb-3', style: 'border:2px dashed var(--border-strong);background:var(--accent-soft)' });
      wrap.appendChild(Dom.el('div', { class: 'flex justify-between items-center mb-2', style: 'flex-wrap:wrap;gap:8px' }, [
        Dom.el('div', {}, [
          Dom.el('div', { style: 'font-weight:700;font-size:12px' }, ['Import Plans']),
          Dom.el('div', { class: 'text-tertiary' }, ['Paste a table copied from Excel/Sheets below — handles both "Regular Investment/Endowment" (Monthly/Annual Premium) and "Single Investment/Endowment" (Invested Amount) sheets, even pasted together. You’ll review every row before it’s saved.'])
        ]),
        Dom.el('button', {
          class: 'btn btn-primary btn-sm', onclick: function () {
            if (!importRawText.trim()) { Dom.modalAlert('Paste a table into the box first.'); return; }
            runImportParse(importRawText);
          }
        }, ['✨ Review & Import'])
      ]));
      var textarea = Dom.el('textarea', {
        rows: 4, placeholder: 'Paste a plan summary table here (copied from Excel/Sheets/a PDF works best).',
        style: 'width:100%;resize:vertical;font-family:var(--font-ui);font-size:11px;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg-elevated);color:var(--text-primary)',
        oninput: function (e) { importRawText = e.target.value; }
      });
      textarea.value = importRawText;
      wrap.appendChild(textarea);
      if (pendingImport && pendingImport.length) wrap.appendChild(importReviewTable());
      return wrap;
    }

    function importReviewTable() {
      var box = Dom.el('div', { class: 'mt-3' });
      box.appendChild(Dom.el('div', { class: 'text-secondary mb-2' }, [pendingImport.length + ' plan' + (pendingImport.length === 1 ? '' : 's') + ' found — uncheck any you don’t want, fix anything that looks wrong, then import.']));
      var tableWrap = Dom.el('div', { class: 'table-scroll' });
      var table = Dom.el('table', { class: 'data-table' });
      table.appendChild(Dom.el('thead', {}, [Dom.el('tr', {}, ['', 'Company', 'Plan Name', 'Policy No.', 'Monthly Premium', 'Current Value', 'Dividend Yield %', 'Remarks'].map(function (h) { return Dom.el('th', {}, [h]); }))]));
      var tbody = Dom.el('tbody');
      pendingImport.forEach(function (row, i) {
        function cell(field, isMoney) {
          var input = Dom.el('input', {
            type: 'text', value: String(row[field] != null ? row[field] : ''),
            oninput: function (e) { row[field] = isMoney ? (Calc.num(e.target.value) || 0) : e.target.value; }
          });
          return input;
        }
        tbody.appendChild(Dom.el('tr', { style: row.include ? '' : 'opacity:0.4' }, [
          Dom.el('td', {}, [Dom.el('input', { type: 'checkbox', checked: row.include ? 'checked' : null, onchange: function (e) { row.include = e.target.checked; draw(); } })]),
          Dom.el('td', {}, [cell('company')]),
          Dom.el('td', {}, [cell('name')]),
          Dom.el('td', {}, [cell('policyNo')]),
          Dom.el('td', {}, [cell('monthlyPremium', true)]),
          Dom.el('td', {}, [cell('currentValue', true)]),
          Dom.el('td', {}, [cell('dividendYield', true)]),
          Dom.el('td', {}, [cell('notes')])
        ]));
      });
      table.appendChild(tbody); tableWrap.appendChild(table); box.appendChild(tableWrap);
      box.appendChild(Dom.el('div', { class: 'flex gap-2 mt-3' }, [
        Dom.el('button', {
          class: 'btn btn-primary btn-sm', onclick: function () {
            var arr = Store.get('investments') || [];
            var c2 = Store.getAll();
            // Not knowable from the sheet itself, so defaulted to today's
            // age rather than 0 — a 0 Start Age would make the projection
            // table run from age 0, which is never actually right and
            // just means more rows to scroll past before fixing it.
            var defaultStartAge = Calc.ageFromDob((c2.personal || {}).dob) || Calc.num((c2.retirement || {}).currentAge) || 35;
            pendingImport.filter(function (r) { return r.include; }).forEach(function (r) {
              arr.push({
                id: Dom.uid('inv'), name: r.name, assetType: 'Endowment',
                monthlyPremium: Calc.num(r.monthlyPremium), startAge: defaultStartAge, stopAge: defaultStartAge + 10,
                dividendYield: Calc.num(r.dividendYield), welcomeBonus: 0, loyaltyBonus: 0, fees: 0, feesEndAge: 0,
                expectedReturn: Calc.num(r.dividendYield) || 4, inflation: 2, projectionAge: 65,
                currentValue: Calc.num(r.currentValue), currentValueAge: Calc.num(r.currentValue) ? defaultStartAge : 0,
                notes: [r.company, r.policyNo ? 'Policy No. ' + r.policyNo : '', r.notes].filter(Boolean).join(' — ')
              });
            });
            Store.set('investments', arr);
            pendingImport = null; importRawText = '';
            draw();
          }
        }, ['Import ' + pendingImport.filter(function (r) { return r.include; }).length + ' Selected']),
        Dom.el('button', { class: 'btn btn-ghost btn-sm', onclick: function () { pendingImport = null; draw(); } }, ['Cancel'])
      ]));
      return box;
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
    function projectionTable(plan, currentAge, isEndowment) {
      var startAge = Calc.num(plan.startAge);
      var genericRows = Calc.investmentPlanProjection(plan, plan.projectionAge);
      var startFrom = currentAge != null ? Math.max(startAge, currentAge) : startAge;
      genericRows = genericRows.filter(function (r) { return r.age >= startFrom; });
      var rawRows = genericRows.map(function (r) {
        return { year: r.age - startAge, age: r.age, premiumPaid: r.premiumPaid, feeAmount: r.feeAmount, totalBonus: r.totalBonus, accountValue: r.accumulatedValue, annualDividend: r.annualDividend, investmentInflow: r.premiumPaid, switchedToDividendFund: r.switchedToDividendFund };
      });

      // Endowment plans never have bonuses/fees at all (no inputs for
      // them above), so those columns stay hidden permanently \u2014 no toggle
      // needed since there's nothing to ever show.
      var hidden = isEndowment || !!hideFeesAndBonuses[plan.id];
      var wrap = Dom.el('div', {});
      if (currentAge != null && currentAge > startAge) {
        wrap.appendChild(Dom.el('div', { class: 'text-tertiary mb-2' }, [
          'Table starts from today\u2019s age (' + currentAge + '), not the plan\u2019s original Start Age (' + startAge + ') \u2014 the Investment Value at age ' + currentAge + ' still reflects everything paid in since Start Age.'
        ]));
      }
      if (!isEndowment) {
        wrap.appendChild(Dom.el('div', { class: 'flex justify-end mb-2' }, [
          Dom.el('button', {
            class: 'btn btn-ghost btn-sm',
            onclick: function () { hideFeesAndBonuses[plan.id] = !hidden; Dom.withFocusPreserved(container, draw); }
          }, [hidden ? 'Show Fees & Bonuses' : 'Hide Fees & Bonuses'])
        ]));
      }

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

    function kpiMini(label, value, caption, accent) {
      var children = [Dom.el('div', { class: 'kpi-label' }, [label]), Dom.el('div', { class: 'kpi-value' }, [value])];
      if (caption) children.push(Dom.el('div', { class: 'text-tertiary mt-1' }, [caption]));
      return Dom.el('div', { class: 'card kpi-card' + (accent ? ' kpi-accent-' + accent : '') }, children);
    }

    draw();
    return Store.subscribe('*', Dom.debounce(function () { Dom.withFocusPreserved(container, draw); }, 30));
  }

  return { title: 'Wealth Accumulation Planning', render: render };
})();
