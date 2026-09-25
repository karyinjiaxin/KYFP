/* ============================================================
   cashflow.js — Cashflow module
   Income stays flat (Salary/Bonus/Rental/Business/Investment).
   Expenses are Category -> line Items, each item billed on its
   own frequency (Monthly/Quarterly/Annually/Weekly). Every
   category carries a Bucket tag (Bills/Savings/Fun) which is
   exactly what Bank Account Buckets reads — change it here and
   that page updates immediately, no separate data entry.
   ============================================================ */

var ModuleCashflow = (function () {
  var INCOME_FIELDS = [
    ['salary', 'Salary (monthly)'], ['bonus', 'Bonus (annual)'], ['rentalIncome', 'Rental Income (monthly)'],
    ['businessIncome', 'Business Income (monthly)'], ['investmentIncome', 'Investment Income (annual)']
  ];
  var FREQUENCIES = ['Monthly', 'Quarterly', 'Annually', 'Weekly'];
  var BUCKETS = ['Bills', 'Savings', 'Fun'];
  var openCats = {}; // category id -> expanded bool, persists across re-renders

  function hexToRgba(hex, alpha) {
    hex = String(hex).replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(function (ch) { return ch + ch; }).join('');
    var r = parseInt(hex.substring(0, 2), 16), g = parseInt(hex.substring(2, 4), 16), b = parseInt(hex.substring(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function render(container) {
    function draw() {
      var c = Store.getAll();
      var cats = c.cashflowCategories || [];
      var t = Charts.themeColors();
      var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      // Same colour sequence used for the donut/bar charts below, so each
      // category's header band visually matches its slice/bar down there.
      var categoryColors = t.palette.concat(['#E0A458', '#6FA394', '#B98BB0', '#8B7EC8']);

      container.innerHTML = '';
      container.appendChild(Dom.el('div', { class: 'page-header' }, [
        Dom.el('h1', {}, ['Cashflow']),
        Dom.el('div', { class: 'sub' }, ['Every category below feeds Dashboard, Bank Account Buckets, and Retirement projections instantly.'])
      ]));

      container.appendChild(Dom.el('div', { class: 'grid grid-kpi mb-3' }, [
        kpiMini('Monthly Income', Dom.fmtMoney(Calc.monthlyIncome(c))),
        kpiMini('Monthly Expenses', Dom.fmtMoney(Calc.monthlyExpenses(c))),
        kpiMini('Monthly Surplus', Dom.fmtMoney(Calc.monthlySurplus(c))),
        kpiMini('Savings Rate', Dom.fmtPct(Calc.savingsRate(c)), 'Savings-bucket categories + unallocated Leftover, \u00f7 income'),
        kpiMini('Cashflow Ratio', Dom.fmtPct(Calc.cashflowRatio(c)), 'All categorized spending (Bills + Savings + Fun combined) \u00f7 income \u2014 the rest is unallocated Leftover')
      ]));

      container.appendChild(Dom.el('div', { class: 'section-title', style: 'margin-top:0' }, ['💰 Inflow']));
      var incomeCard = Dom.el('div', { class: 'card mb-3' });
      var incomeRow = Dom.el('div', { class: 'input-row' });
      INCOME_FIELDS.forEach(function (f) { incomeRow.appendChild(Fields.moneyInput('income.' + f[0], f[1])); });
      incomeCard.appendChild(incomeRow);
      incomeCard.appendChild(Dom.el('div', { class: 'mt-3 pt-3', style: 'border-top:1px solid var(--border)' }, [
        Dom.el('div', { class: 'flex justify-between items-center' }, [
          Dom.el('div', { style: 'font-weight:700;font-size:13px' }, ['Total Annual Income (excl. Investment Income)']),
          Dom.el('div', { style: 'font-weight:700;font-size:16px' }, [Dom.fmtMoney(Calc.annualIncomeExclInvestment(c))])
        ])
      ]));
      incomeCard.appendChild(Dom.el('div', { class: 'text-tertiary mt-2', style: 'line-height:1.5' }, [
        'Monthly Income = Salary + (Bonus \u00f7 12) + Rental Income + Business Income + (Investment Income \u00f7 12). Each field\u2019s label states whether it\u2019s entered as a monthly or annual figure.'
      ]));
      container.appendChild(incomeCard);

      container.appendChild(Dom.el('div', { class: 'section-title' }, ['💸 Outflow']));

      var lumpSumValue = Calc.num((c.cashflow || {}).lumpSumMonthlyExpenses);
      var lumpSumCard = Dom.el('div', { class: 'card mb-3', style: lumpSumValue > 0 ? 'border-color:var(--accent)' : '' });
      lumpSumCard.appendChild(Dom.el('div', {}, [
        Dom.el('div', { style: 'font-weight:700;font-size:13px' }, ['No time to break expenses down by category?']),
        Dom.el('div', { class: 'text-tertiary mt-1' }, [
          'Enter one lump sum instead — it fully overrides the category breakdown below for every calculation that uses Monthly Expenses (Savings Rate, Cashflow Ratio, Retirement Planning, etc). Category-specific views like Spending Breakdown and Bucket Allocation won\u2019t reflect it, since there\u2019s no per-category detail to show. Set it back to S$0 to return to using the categories below.'
        ])
      ]));
      lumpSumCard.appendChild(Dom.el('div', { class: 'input-row compact-row mt-3', style: 'max-width:260px' }, [
        Fields.moneyInput('cashflow.lumpSumMonthlyExpenses', 'Lump Sum Monthly Expenses')
      ]));
      if (lumpSumValue > 0) {
        lumpSumCard.appendChild(Dom.el('div', { class: 'text-secondary mt-2', style: 'font-weight:600' }, [
          '✓ Active — the category breakdown below is currently ignored for all calculations.'
        ]));
      }
      container.appendChild(lumpSumCard);

      cats.forEach(function (cat, idx) { container.appendChild(categoryCard(cat, idx, categoryColors[idx % categoryColors.length])); });

      container.appendChild(Dom.el('button', {
        class: 'btn btn-secondary mt-2 mb-3', onclick: function () {
          var arr = Store.get('cashflowCategories') || [];
          arr.push({ id: Dom.uid('cat'), name: '', bucket: 'Bills', items: [{ id: Dom.uid('item'), name: '', cost: 0, frequency: 'Monthly' }] });
          var newIdx = arr.length - 1;
          Store.set('cashflowCategories', arr);
          Fields.focusAndSelect('cashflowCategories.' + newIdx + '.name');
        }
      }, ['+ Add Category']));

      container.appendChild(Dom.el('div', { class: 'section-title' }, ['📊 Spending Breakdown (colours match the categories above)']));
      var chartGrid = Dom.el('div', { class: 'grid grid-2' });
      chartGrid.appendChild(Dom.el('div', { class: 'card' }, [
        Dom.el('div', { class: 'card-title' }, ['By Category (Annual)']),
        Dom.el('div', { class: 'chart-wrap tall' }, [Dom.el('canvas', { id: 'cfDonutChart' })])
      ]));
      chartGrid.appendChild(Dom.el('div', { class: 'card' }, [
        Dom.el('div', { class: 'card-title' }, ['By Category (Monthly)']),
        Dom.el('div', { class: 'chart-wrap tall' }, [Dom.el('canvas', { id: 'cfBarChart' })])
      ]));
      container.appendChild(chartGrid);

      requestAnimationFrame(function () {
        var t = Charts.themeColors();
        var labels = cats.map(function (cat) { return cat.name; });
        var annualVals = cats.map(Calc.categoryAnnualTotal);
        var monthlyVals = cats.map(Calc.categoryMonthlyTotal);
        var colors = t.palette.concat(['#E0A458', '#6FA394', '#B98BB0', '#8B7EC8']);

        Charts.render(document.getElementById('cfDonutChart'), {
          type: 'doughnut',
          data: { labels: labels, datasets: [{ data: annualVals, backgroundColor: colors }] },
          options: Object.assign({ scales: { x: false, y: false } }, Charts.leaderLineDonutOptions(t.text))
        });
        Charts.render(document.getElementById('cfBarChart'), {
          type: 'bar',
          data: { labels: labels, datasets: [{ label: 'Monthly', data: monthlyVals, backgroundColor: colors }] },
          options: {
            indexAxis: 'y',
            plugins: {
              legend: { display: false },
              datalabels: {
                display: true, color: t.text, anchor: 'end', align: 'end', font: { size: 10.5, weight: '600' },
                formatter: function (v) { return Dom.fmtMoney(v); }
              }
            }
          }
        });
      });
    }

    function categoryCard(cat, catIdx, color) {
      var base = 'cashflowCategories.' + catIdx + '.';
      var isOpen = openCats[cat.id] !== false; // default expanded
      var monthlyTotal = Calc.categoryMonthlyTotal(cat);
      var annualTotal = Calc.categoryAnnualTotal(cat);
      var headerBg = hexToRgba(color, document.documentElement.getAttribute('data-theme') === 'dark' ? 0.28 : 0.16);

      var card = Dom.el('div', { class: 'card mb-3', style: 'padding:0;overflow:hidden;border-color:' + hexToRgba(color, 0.4) });
      var addItemBtn = Dom.el('button', {
        class: 'icon-btn', title: 'Add item to ' + cat.name,
        style: 'width:28px;height:28px;border-radius:50%;color:' + color + ';border-color:' + color + ';background:var(--bg-elevated)',
        onclick: function (e) {
          e.stopPropagation();
          openCats[cat.id] = true;
          var arr = Store.get('cashflowCategories');
          arr[catIdx].items.push({ id: Dom.uid('item'), name: '', cost: 0, frequency: 'Monthly' });
          var newIdx = arr[catIdx].items.length - 1;
          Store.set('cashflowCategories', arr);
          Fields.focusAndSelect('cashflowCategories.' + catIdx + '.items.' + newIdx + '.name');
        }
      }, ['+']);

      var header = Dom.el('div', {
        class: 'collapsible-header', style: 'background:' + headerBg + ';padding:16px 20px;border-left:4px solid ' + color, onclick: function () {
          openCats[cat.id] = !isOpen;
          Dom.withFocusPreserved(container, draw);
        }
      }, [
        Dom.el('div', { class: 'flex items-center gap-3' }, [
          Dom.el('svg', { class: 'chevron' + (isOpen ? ' open' : ''), width: '18', height: '18', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', html: '<path d="M6 9l6 6 6-6"/>' }),
          Dom.el('div', {}, [
            Dom.el('div', { style: 'font-weight:700;font-size:16px' }, [cat.name || '(untitled category)']),
            Dom.el('div', { class: 'text-secondary' }, [cat.bucket + ' bucket · ' + ((cat.items || []).length) + ' item' + ((cat.items || []).length === 1 ? '' : 's')])
          ])
        ]),
        Dom.el('div', { class: 'flex items-center gap-3' }, [
          Dom.el('div', { style: 'text-align:right' }, [
            Dom.el('div', { style: 'font-weight:700;font-size:16px;color:' + color }, [Dom.fmtMoney(monthlyTotal) + ' / mo']),
            Dom.el('div', { class: 'text-secondary' }, [Dom.fmtMoney(annualTotal) + ' / yr'])
          ]),
          addItemBtn
        ])
      ]);
      card.appendChild(header);

      var body = Dom.el('div', { class: 'collapsible-body' + (isOpen ? ' open' : ''), style: 'padding:' + (isOpen ? '16px 20px 18px' : '0 20px') });
      if (isOpen) {
        var catMeta = Dom.el('div', { class: 'input-row mb-3', onclick: function (e) { e.stopPropagation(); } }, [
          Fields.textInput(base + 'name', 'Category Name', { placeholder: 'Category name' }),
          Fields.selectInput(base + 'bucket', 'Bucket (feeds Bank Account Buckets)', BUCKETS)
        ]);
        body.appendChild(catMeta);

        (cat.items || []).forEach(function (item, itemIdx) {
          body.appendChild(itemRow(cat, catIdx, item, itemIdx));
        });

        body.appendChild(Dom.el('button', {
          class: 'btn btn-secondary btn-sm mt-2', onclick: function (e) {
            e.stopPropagation();
            var arr = Store.get('cashflowCategories');
            arr[catIdx].items.push({ id: Dom.uid('item'), name: '', cost: 0, frequency: 'Monthly' });
            var newIdx = arr[catIdx].items.length - 1;
            Store.set('cashflowCategories', arr);
            Fields.focusAndSelect('cashflowCategories.' + catIdx + '.items.' + newIdx + '.name');
          }
        }, ['+ Add Item to ' + (cat.name || 'this category')]));

        body.appendChild(Dom.el('button', {
          class: 'btn btn-ghost btn-sm mt-2', style: 'margin-left:8px', onclick: function (e) {
            e.stopPropagation();
            var arr = Store.get('cashflowCategories');
            arr.splice(catIdx, 1);
            Store.set('cashflowCategories', arr);
          }
        }, ['Remove Category']));
      }
      card.appendChild(body);
      return card;
    }

    function itemRow(cat, catIdx, item, itemIdx) {
      var base = 'cashflowCategories.' + catIdx + '.items.' + itemIdx + '.';
      if (item.autoCpf) {
        return Dom.el('div', {
          class: 'input-row compact-row mb-2', style: 'align-items:end;padding-bottom:8px;margin-bottom:8px;border-bottom:1px solid var(--border)',
          onclick: function (e) { e.stopPropagation(); }
        }, [
          Dom.el('div', { class: 'field' }, [
            Dom.el('label', { class: 'field-label' }, ['Item']),
            Dom.el('div', { style: 'padding:6px 9px;font-size:12.5px;font-weight:600' }, [item.name, ' ', Dom.el('span', { class: 'badge badge-good', style: 'font-size:9.5px;padding:1px 7px;margin-left:4px' }, ['AUTO'])])
          ]),
          Dom.el('div', { class: 'field' }, [
            Dom.el('label', { class: 'field-label' }, ['Cost / mo']),
            Dom.el('div', { style: 'padding:6px 9px;font-size:12.5px;font-weight:600' }, [Dom.fmtMoney(item.cost)])
          ]),
          Dom.el('div', { class: 'field' }, [
            Dom.el('label', { class: 'field-label' }, ['Source']),
            Dom.el('div', { class: 'text-tertiary', style: 'padding:6px 9px' }, ['Client Profile: Employment Status'])
          ])
        ]);
      }
      var row = Dom.el('div', {
        class: 'input-row compact-row mb-2', style: 'align-items:end;padding-bottom:8px;margin-bottom:8px;border-bottom:1px solid var(--border)',
        onclick: function (e) { e.stopPropagation(); }
      }, [
        Fields.textInput(base + 'name', 'Item', { placeholder: 'Item name' }),
        Fields.moneyInput(base + 'cost', 'Cost'),
        Fields.selectInput(base + 'frequency', 'Frequency', FREQUENCIES)
      ]);
      row.appendChild(Dom.el('button', {
        class: 'btn btn-ghost btn-sm', style: 'font-size:11.5px;padding:5px 9px', onclick: function (e) {
          e.stopPropagation();
          var arr = Store.get('cashflowCategories');
          arr[catIdx].items.splice(itemIdx, 1);
          if (arr[catIdx].items.length === 0) arr[catIdx].items.push({ id: Dom.uid('item'), name: '', cost: 0, frequency: 'Monthly' });
          Store.set('cashflowCategories', arr);
        }
      }, ['Remove']));
      return row;
    }

    function kpiMini(label, value, caption) {
      var children = [Dom.el('div', { class: 'kpi-label' }, [label]), Dom.el('div', { class: 'kpi-value' }, [value])];
      if (caption) children.push(Dom.el('div', { class: 'text-tertiary mt-1', style: 'line-height:1.3' }, [caption]));
      return Dom.el('div', { class: 'card kpi-card' }, children);
    }

    draw();
    return Store.subscribe('*', Dom.debounce(function () { Dom.withFocusPreserved(container, draw); }, 30));
  }

  return { title: 'Cashflow', render: render };
})();
