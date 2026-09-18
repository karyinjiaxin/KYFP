/* ============================================================
   networth.js
   ============================================================ */

var ModuleNetWorth = (function () {
  // Sums each investment plan's TODAY value by its Type, for the
  // "suggested from Investment Planning" hints below — a plan tagged
  // "Unit Trust" suggests the Unit Trusts field, etc. Types without a
  // matching Net Worth field (Bonds, Gold, Investment Policy...) aren't
  // suggested anywhere, since there's no field for them.
  function investmentAssetsByType(c) {
    var currentAge = Calc.ageFromDob((c.personal || {}).dob) || Calc.num((c.retirement || {}).currentAge);
    var byType = {};
    (c.investments || []).forEach(function (plan) {
      var type = plan.assetType || 'Other';
      var rows = Calc.investmentPlanProjection(plan, Math.max(currentAge, Calc.num(plan.startAge)));
      var value = 0;
      if (rows.length) {
        var match = rows.filter(function (r) { return r.age <= currentAge; });
        value = (match.length ? match[match.length - 1] : rows[0]).accumulatedValue;
      }
      byType[type] = (byType[type] || 0) + value;
    });
    return byType;
  }
  var ASSET_TYPE_SUGGESTION = { 'unitTrusts': 'Unit Trust', 'etfs': 'ETF', 'stocks': 'Shares', 'crypto': 'Crypto' };

  var ASSET_FIELDS = [
    ['cash', 'Cash'], ['stocks', 'Stocks'], ['etfs', 'ETFs'],
    ['unitTrusts', 'Unit Trusts'], ['crypto', 'Crypto'], ['business', 'Business'], ['insuranceCashValue', 'Insurance Cash Value']
  ];
  var LIABILITY_FIELDS = [
    ['creditCards', 'Credit Cards'], ['carLoan', 'Car Loan'], ['personalLoan', 'Personal Loan']
  ];

  function render(container) {
    function draw() {
      var c = Store.getAll();
      container.innerHTML = '';
      container.appendChild(Dom.el('div', { class: 'page-header flex justify-between items-center' }, [
        Dom.el('div', {}, [
          Dom.el('h1', {}, ['Net Worth']),
          Dom.el('div', { class: 'sub' }, ['Assets and liabilities roll up into Net Worth across the whole platform.'])
        ]),
        Dom.el('button', {
          class: 'btn btn-secondary', onclick: function () {
            Store.set('netWorthHistory', Calc.recordNetWorthSnapshot(Store.getAll()));
          }
        }, ['Record This Month'])
      ]));

      container.appendChild(Dom.el('div', { class: 'grid grid-kpi mb-3' }, [
        kpiMini('Net Worth', Dom.fmtMoney(Calc.netWorth(c))),
        kpiMini('Total Assets', Dom.fmtMoney(Calc.totalAssets(c))),
        kpiMini('Liquid Assets', Dom.fmtMoney(Calc.liquidAssets(c))),
        kpiMini('Investment Assets', Dom.fmtMoney(Calc.investmentAssetsTotal(c)), 'Stocks + ETFs + Unit Trusts + Crypto + Investment Plans (today\u2019s value)'),
        kpiMini('Total Liabilities', Dom.fmtMoney(Calc.totalLiabilities(c))),
        kpiMini('Debt Ratio', Dom.fmtPct(Calc.debtRatio(c)))
      ]));

      var grid = Dom.el('div', { class: 'grid grid-2' });

      var assetsCard = Dom.el('div', { class: 'card' }, [
        Dom.el('div', { class: 'flex justify-between items-center' }, [
          Dom.el('div', { class: 'section-title', style: 'margin-top:0' }, ['💎 Assets']),
          Dom.el('button', {
            class: 'btn btn-secondary btn-sm', title: 'Force-refresh Unit Trusts/ETFs/Stocks/Crypto from Investment Planning, overriding whatever\u2019s currently there',
            onclick: function () {
              var latest = investmentAssetsByType(Store.getAll());
              Object.keys(ASSET_TYPE_SUGGESTION).forEach(function (field) {
                var computed = latest[ASSET_TYPE_SUGGESTION[field]];
                // Only overwrite fields that actually have a matching plan
                // in Investment Planning — leaves a manually-tracked
                // holding with no plan there untouched, instead of
                // silently zeroing it out.
                if (computed) Store.set('assets.' + field, Math.round(computed * 100) / 100);
              });
            }
          }, ['\u21bb Reload from Investment Planning'])
        ])
      ]);
      var investByType = investmentAssetsByType(c);
      var assetsRow = Dom.el('div', { class: 'input-row' }, [
        Dom.el('div', { class: 'field' }, [
          Dom.el('label', { class: 'field-label' }, ['CPF (from CPF tab)']),
          Dom.el('div', { style: 'padding:9px 12px;border-radius:10px;background:var(--accent-soft);font-size:14px;font-weight:600' }, [Dom.fmtMoney(Calc.totalCpfBalance(c))])
        ])
      ]);
      ASSET_FIELDS.forEach(function (f) {
        var fieldWrap = Dom.el('div', {});
        fieldWrap.appendChild(Fields.moneyInput('assets.' + f[0], f[1]));
        var suggestType = ASSET_TYPE_SUGGESTION[f[0]];
        var suggested = suggestType ? investByType[suggestType] : 0;
        var currentValue = Calc.num((c.assets || {})[f[0]]);
        if (suggested && currentValue > 0 && Math.abs(currentValue - suggested) < 1) {
          fieldWrap.appendChild(Dom.el('div', { class: 'text-tertiary mt-1' }, [
            '\u2713 Auto-filled from Investment Planning'
          ]));
        } else if (suggested && currentValue === 0) {
          fieldWrap.appendChild(Dom.el('div', { class: 'text-tertiary mt-1' }, [
            'Will auto-fill from Investment Planning (' + Dom.fmtMoney(suggested) + ') shortly'
          ]));
        } else if (suggested) {
          fieldWrap.appendChild(Dom.el('div', { class: 'text-tertiary mt-1' }, [
            'Investment Planning suggests ' + Dom.fmtMoney(suggested) + ' \u2014 ',
            Dom.el('a', {
              href: '#', style: 'color:var(--accent);cursor:pointer',
              onclick: function (e) { e.preventDefault(); Store.set('assets.' + f[0], Math.round(suggested)); }
            }, ['Match this'])
          ]));
        }
        assetsRow.appendChild(fieldWrap);
      });
      assetsCard.appendChild(assetsRow);
      assetsCard.appendChild(Dom.el('div', { class: 'text-tertiary mt-2' }, [
        'Unit Trusts / ETFs / Stocks / Crypto auto-fill from matching Investment Planning plans (by their Type) the first time each field is at S$0 \u2014 once you\u2019ve typed a value in, it\u2019s yours to edit freely and won\u2019t be silently overwritten. Set a field back to 0 to let it auto-fill again.'
      ]));
      assetsCard.appendChild(propertyList(c));
      grid.appendChild(assetsCard);

      var liabCard = Dom.el('div', { class: 'card' }, [Dom.el('div', { class: 'section-title', style: 'margin-top:0' }, ['📉 Liabilities'])]);
      var liabRow = Dom.el('div', { class: 'input-row' });
      LIABILITY_FIELDS.forEach(function (f) { liabRow.appendChild(Fields.moneyInput('liabilities.' + f[0], f[1])); });
      liabCard.appendChild(liabRow);
      liabCard.appendChild(mortgageDetails(c));
      grid.appendChild(liabCard);

      container.appendChild(grid);

      container.appendChild(Dom.el('div', { class: 'section-title' }, ['🥧 Asset Allocation']));
      var chartCard = Dom.el('div', { class: 'card' }, [Dom.el('div', { class: 'chart-wrap tall' }, [Dom.el('canvas', { id: 'nwAllocChart' })])]);
      container.appendChild(chartCard);

      requestAnimationFrame(function () {
        var t = Charts.themeColors();
        var a = c.assets || {};
        Charts.render(document.getElementById('nwAllocChart'), {
          type: 'doughnut',
          data: {
            labels: ['Cash', 'CPF', 'Stocks', 'ETFs', 'Unit Trusts', 'Crypto', 'Property (net)', 'Business', 'Insurance CV'],
            datasets: [{
              data: [Calc.num(a.cash), Calc.totalCpfBalance(c), Calc.num(a.stocks), Calc.num(a.etfs), Calc.num(a.unitTrusts), Calc.num(a.crypto), Calc.propertyValueTotal(c) - Calc.propertyLoanTotal(c), Calc.num(a.business), Calc.num(a.insuranceCashValue)],
              backgroundColor: t.palette.concat(['#E0A458', '#6FA394', '#B98BB0'])
            }]
          },
          options: Object.assign({ scales: { x: false, y: false } }, Charts.leaderLineDonutOptions(t.text))
        });
      });
    }

    function mortgageDetails(c) {
      var wrap = Dom.el('div', { class: 'mt-3' });
      wrap.appendChild(Dom.el('div', { class: 'card-title' }, ['Mortgage Details (payment planning only)']));
      wrap.appendChild(Dom.el('div', { class: 'input-row' }, [
        Fields.moneyInput('liabilities.mortgageDetails.monthlyCash', 'Monthly Payment (Cash)'),
        Fields.moneyInput('liabilities.mortgageDetails.monthlyCPF', 'Monthly Payment (CPF/OA)')
      ]));
      wrap.appendChild(Dom.el('div', { class: 'input-row mt-2' }, [
        Fields.numberInput('liabilities.mortgageDetails.tenureYears', 'Loan Tenure (yrs)'),
        Fields.numberInput('liabilities.mortgageDetails.interestRate', 'Interest Rate %', { step: '0.1' })
      ]));
      wrap.appendChild(Dom.el('div', { class: 'text-tertiary mt-2', style: 'line-height:1.5' }, [
        'The outstanding loan BALANCE is tracked once, under Assets \u2192 Property \u2192 Outstanding Loan for that property \u2014 not repeated here, to avoid double-counting the same debt. This section is just for payment/rate planning: the CPF/OA monthly payment above automatically feeds the "Monthly OA Deduction for Mortgage" on the CPF tab\u2019s Age 55 projection.'
      ]));
      return wrap;
    }

    function propertyList(c) {
      var wrap = Dom.el('div', { class: 'mt-3' });
      wrap.appendChild(Dom.el('div', { class: 'card-title' }, ['Property']));
      (c.assets.property || []).forEach(function (p, idx) {
        var row = Dom.el('div', { class: 'input-row', style: 'margin-bottom:8px;align-items:end' }, [
          Fields.textInput('assets.property.' + idx + '.name', 'Property Name'),
          Fields.moneyInput('assets.property.' + idx + '.value', 'Value'),
          Fields.moneyInput('assets.property.' + idx + '.loan', 'Outstanding Loan')
        ]);
        var delBtn = Dom.el('button', {
          class: 'btn btn-ghost btn-sm', onclick: function () {
            var arr = Store.get('assets.property'); arr.splice(idx, 1); Store.set('assets.property', arr);
          }
        }, ['Remove']);
        row.appendChild(delBtn);
        wrap.appendChild(row);
      });
      wrap.appendChild(Dom.el('button', {
        class: 'btn btn-secondary btn-sm', onclick: function () {
          var arr = Store.get('assets.property') || []; arr.push({ name: 'New Property', value: 0, loan: 0 }); Store.set('assets.property', arr);
        }
      }, ['+ Add Property']));
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

  return { title: 'Net Worth', render: render };
})();
