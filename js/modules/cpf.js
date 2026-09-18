/* ============================================================
   cpf.js — CPF module (Singapore)
   ============================================================ */

var ModuleCpf = (function () {
  var showAdditionsState = { value: false };
  function render(container) {
    function draw() {
      var c = Store.getAll();
      var age = Calc.ageFromDob((c.personal || {}).dob) || (c.retirement || {}).currentAge || 38;
      var status = (c.personal || {}).employmentStatus || 'Full-Time Employed';
      var contrib = Calc.cpfContributionBreakdown(c, age);
      var cpfData = c.cpf || {};

      container.innerHTML = '';
      container.appendChild(Dom.el('div', { class: 'page-header' }, [
        Dom.el('h1', {}, ['CPF']),
        Dom.el('div', { class: 'sub' }, ['Ordinary, Special/Retirement and Medisave account balances, and current contribution mechanics.'])
      ]));

      container.appendChild(Dom.el('div', { class: 'grid grid-kpi mb-3' }, [
        kpiMini('Ordinary Account', Dom.fmtMoney(cpfData.oa)),
        kpiMini('Special Account', Dom.fmtMoney(cpfData.sa)),
        kpiMini('Medisave Account', Dom.fmtMoney(cpfData.ma)),
        kpiMini('Retirement Account', Dom.fmtMoney(cpfData.ra)),
        kpiMini('Total CPF Balance', Dom.fmtMoney(Calc.num(cpfData.oa) + Calc.num(cpfData.sa) + Calc.num(cpfData.ma) + Calc.num(cpfData.ra)))
      ]));

      var grid = Dom.el('div', { class: 'grid grid-2' });
      var balCard = Dom.el('div', { class: 'card' }, [Dom.el('div', { class: 'section-title', style: 'margin-top:0' }, ['💳 Account Balances'])]);
      balCard.appendChild(Dom.el('div', { class: 'input-row' }, [
        Fields.moneyInput('cpf.oa', 'Ordinary Account (OA)'),
        Fields.moneyInput('cpf.sa', 'Special Account (SA)'),
        Fields.moneyInput('cpf.ma', 'Medisave Account (MA)'),
        Fields.moneyInput('cpf.ra', 'Retirement Account (RA)')
      ]));
      balCard.appendChild(Dom.el('div', { class: 'input-row mt-2' }, [
        Fields.moneyInput('cpf.monthlyMortgageDeduction', 'Monthly OA Deduction for Mortgage'),
        Fields.numberInput('cpf.mortgageDeductionEndAge', 'Mortgage Fully Paid By Age'),
        Fields.numberInput('cpf.stopWorkAge', 'Stop Work Age (no more CPF contribution)'),
        Fields.selectInput('cpf.retirementSumTier', 'Retirement Sum at 55', ['BRS', 'FRS', 'ERS']),
        (function () {
          var field = Fields.numberInput('cpf.retirementSumGrowthRate', 'Retirement Sum Growth Assumption %', { step: '0.1' });
          var input = field.querySelector('input');
          if (input) input.addEventListener('input', function () {
            if (!Store.get('cpf.retirementSumGrowthManuallySet')) Store.set('cpf.retirementSumGrowthManuallySet', true);
          });
          return field;
        })()
      ]));
      balCard.appendChild(Dom.el('div', { class: 'input-row mt-2' }, [
        Fields.numberInput('cpf.homePurchaseAge', 'Future Home Purchase At Age'),
        Fields.moneyInput('cpf.homePurchaseDownpaymentOA', 'Est. Downpayment From OA')
      ]));
      balCard.appendChild(Dom.el('div', { class: 'text-tertiary mt-2', style: 'line-height:1.5' }, [
        'Mortgage Fully Paid By Age: the OA deduction above stops from this age onward (leave blank/0 if the mortgage runs indefinitely in this projection). Stop Work Age: mandatory CPF contributions stop from this age (voluntary contributions below can still continue). Retirement Sum at 55: which target \u2014 Basic (BRS), Full (FRS) or Enhanced (ERS) \u2014 SA converts into the Retirement Account up to, at age 55. Retirement Sum Growth Assumption: auto-filled at 3.5%/year (matching the actual confirmed 2026\u21922027 BRS increase of 3.54%) for how fast BRS/FRS/ERS are assumed to keep rising beyond 2027, the last officially announced year \u2014 edit freely for a more or less conservative projection. Future Home Purchase: models a one-time lump-sum withdrawal from OA at the specified age (e.g. for a downpayment) \u2014 leave blank/0 for no planned purchase; marked \ud83c\udfe0 in the yearly table below.'
      ]));
      grid.appendChild(balCard);

      var contribCard = Dom.el('div', { class: 'card' }, [
        Dom.el('div', { class: 'section-title', style: 'margin-top:0' }, ['💵 Monthly Contribution (estimated)']),
        row('Employment Status (from Client Profile)', status)
      ]);
      if (contrib.medisaveOnly) {
        var standardAlloc = SG.allocationForAge(age);
        var voluntaryAllAccounts = Calc.num(cpfData.voluntaryAllAccounts);
        var breakdownOA = (voluntaryAllAccounts * standardAlloc.oa) / 12;
        var breakdownSA = (voluntaryAllAccounts * standardAlloc.sa + Calc.num(cpfData.voluntarySA)) / 12;
        var breakdownMA = (voluntaryAllAccounts * standardAlloc.ma + Calc.num(cpfData.voluntaryMA)) / 12;
        contribCard.appendChild(row('Basis', 'Input from Additional Yearly Contributions below'));
        contribCard.appendChild(row('\u2192 to Ordinary Account (OA)', Dom.fmtMoney(breakdownOA)));
        contribCard.appendChild(row('\u2192 to Special Account (SA)', Dom.fmtMoney(breakdownSA)));
        contribCard.appendChild(row('\u2192 to Medisave Account (MA)', Dom.fmtMoney(breakdownMA)));
      } else if (status === 'Unemployed') {
        contribCard.appendChild(row('Basis', 'No income — no CPF contribution'));
      } else {
        contribCard.appendChild(row('Age band', age + ' yrs (' + (contrib.rates.employee * 100).toFixed(1) + '% EE / ' + (contrib.rates.employer * 100).toFixed(1) + '% ER)'));
        contribCard.appendChild(row('Ordinary Wage base (capped at S$' + SG.OW_CEILING.toLocaleString() + ')', Dom.fmtMoney(contrib.wageBase)));
        contribCard.appendChild(row('Employee Contribution', Dom.fmtMoney(contrib.employee)));
        contribCard.appendChild(row('Employer Contribution', Dom.fmtMoney(contrib.employer)));
      }
      contribCard.appendChild(row('Total Monthly Contribution', Dom.fmtMoney(contrib.medisaveOnly ? Calc.autoCpfContribution(c) : contrib.total)));
      grid.appendChild(contribCard);
      container.appendChild(grid);

      // ---- Additional yearly contributions (fillable) ----
      container.appendChild(Dom.el('div', { class: 'section-title' }, ['➕ Additional Yearly Contributions (Voluntary)']));
      var addCard = Dom.el('div', { class: 'card mb-3' });
      addCard.appendChild(Dom.el('div', { class: 'input-row' }, [
        Fields.moneyInput('cpf.voluntaryAllAccounts', 'Voluntary Contribution to All Accounts (yearly)'),
        Fields.moneyInput('cpf.voluntarySA', 'Voluntary Contribution to SA (yearly)'),
        Fields.moneyInput('cpf.voluntaryMA', 'Voluntary Contribution to MA (yearly)')
      ]));
      addCard.appendChild(Dom.el('div', { class: 'input-row mt-2' }, [
        Fields.numberInput('cpf.voluntaryEndAge', 'Stop Voluntary Contributions By Age')
      ]));
      addCard.appendChild(Dom.el('div', { class: 'text-tertiary mt-2', style: 'line-height:1.5' }, [
        '"All Accounts" splits into OA/SA/MA using the standard age-based allocation percentages for age ' + age + ' (' + (SG.allocationForAge(age).oa * 100).toFixed(0) + '% / ' + (SG.allocationForAge(age).sa * 100).toFixed(0) + '% / ' + (SG.allocationForAge(age).ma * 100).toFixed(0) + '%) \u2014 the same rates CPF Board uses for the Voluntary Contribution Scheme. This field and "to SA" count toward the S$' + Calc.CPF_ANNUAL_LIMIT.toLocaleString() + ' CPF Annual Limit alongside any mandatory contribution, and get scaled down automatically if they\u2019d exceed it. "To MA" is capped by the Basic Healthcare Sum instead, not the Annual Limit (per IRAS). "Stop Voluntary Contributions By Age" is independent of Stop Work Age \u2014 leave it blank/0 for voluntary contributions to continue indefinitely (e.g. a client who keeps topping up after retiring), or set it for a client who only plans a set number of years of top-ups. For self-employed clients, these three fields ARE the entire CPF contribution \u2014 there\u2019s no separate mandatory estimate. CPF Cash Top-up Relief on Tax Planning is capped separately at S$8,000 (self) + S$8,000 (family) and doesn\u2019t automatically sync to these fields.'
      ]));
      container.appendChild(addCard);

      container.appendChild(Dom.el('div', { class: 'text-tertiary mb-3' }, ['Estimates based on published CPF contribution and allocation rates; actual amounts depend on wage components and CPF Board rules in effect. Self-employed persons are not required to contribute to Ordinary or Special Account — only MediSave, once net trade income exceeds S$6,000/year.']));

      // ---- Projection to Age 99 ----
      var proj = Calc.cpfProjectionFull(c);
      container.appendChild(Dom.el('div', { class: 'section-title' }, ['📅 Projection to Age 99']));
      if (age >= 99 || !proj.length) {
        container.appendChild(Dom.el('div', { class: 'card empty-state' }, ['No further projection \u2014 client is already at or beyond age 99.']));
      } else {
        var transitionRow = proj.filter(function (r) { return r.transitioned55; })[0];
        var last = proj[proj.length - 1];
        var tier = cpfData.retirementSumTier || 'FRS';
        var yearAt55 = new Date().getFullYear() + (55 - age);
        var growthOverride = cpfData.retirementSumGrowthRate != null && cpfData.retirementSumGrowthRate !== '' ? Calc.num(cpfData.retirementSumGrowthRate) / 100 : null;
        var sumInfo = Calc.retirementSumForYear(tier, yearAt55, growthOverride);

        container.appendChild(Dom.el('div', { class: 'grid grid-kpi mb-3' }, [
          kpiMini('Projected Total @ 55', transitionRow ? Dom.fmtMoney(transitionRow.total) : '\u2014'),
          kpiMini('Projected Total @ 65', projAtAge(proj, 65) ? Dom.fmtMoney(projAtAge(proj, 65).total) : '\u2014'),
          kpiMini('Projected Total @ 99', Dom.fmtMoney(last.total)),
          kpiMini((tier === 'BRS' ? 'Basic' : tier === 'ERS' ? 'Enhanced' : 'Full') + ' Retirement Sum @ ' + yearAt55, Dom.fmtMoney(sumInfo.amount), sumInfo.isOfficial ? 'Officially announced by CPF Board' : 'Estimated at ~3.5%/yr from 2027\u2019s announced figure \u2014 not yet officially set')
        ]));

        if (transitionRow) {
          container.appendChild(Dom.el('div', { class: 'card mb-3', style: 'background:var(--accent-soft)' }, [
            Dom.el('div', { class: 'card-title' }, [
              'At Age 55: SA closes \u2192 Retirement Account formed at S$' + Math.round(transitionRow.ra).toLocaleString() + ' (' + tier + ') \u00b7 OA S$' + Math.round(transitionRow.oa).toLocaleString() + ' \u00b7 MA S$' + Math.round(transitionRow.ma).toLocaleString()
            ]),
            Dom.el('div', { class: 'text-secondary' }, [
              'SA (then OA, only if SA alone falls short) forms the Retirement Account up to the selected ' + tier + ' target of S$' + Math.round(sumInfo.amount).toLocaleString() + ' for the ' + yearAt55 + ' cohort. Any OA left over after that stays as OA. From 55 onward, OA, RA and MA all keep earning interest (OA 2.5% p.a., RA/MA 4% p.a. floor rates) through to age 99 \u2014 not the +1%/+2% extra interest on smaller combined balances.'
            ])
          ]));
        }

        container.appendChild(Dom.el('div', { class: 'card mb-3' }, [Dom.el('div', { class: 'chart-wrap tall' }, [Dom.el('canvas', { id: 'cpf99Chart' })])]));
        container.appendChild(Dom.el('div', { class: 'section-title' }, ['📋 Yearly Contribution Breakdown']));
        container.appendChild(Dom.el('div', { class: 'text-tertiary mb-2' }, [
          'From 55 to 65, RA growth is split into two columns so it\u2019s never a mystery: "+RA (interest)" is base + bonus interest on the balance itself; "+RA (contrib/overflow)" is new contributions still arriving (if the client hasn\u2019t reached Stop Work Age yet) PLUS MediSave contributions that overflow into RA because MA is already at its cap \u2014 that second source is often the bigger of the two for someone still working with a large MA balance, which is why RA can grow well beyond what 4% interest alone would suggest. "+OA/+SA/+MA" show contributions only, not interest.'
        ]));
        container.appendChild(yearlyBreakdownTable(proj));
        container.appendChild(Dom.el('div', { class: 'text-tertiary mt-3', style: 'line-height:1.5' }, [
          'Assumes today\u2019s income, employment status, and contribution rates stay unchanged until Stop Work Age, growing at current CPF floor rates PLUS the official extra interest (+1% on the first S$60,000 of combined balances below 55; +2% on the first S$30,000 and +1% on the next S$30,000 from 55, OA capped at S$20,000 of that \u2014 extra interest earned on OA is credited to SA/RA, not OA itself). MediSave is capped at the Basic Healthcare Sum, which CPF Board only officially confirms one year ahead (S$79,000 for 2026) \u2014 years beyond that use an estimated ~4.5%/year rise, locking for life once the client turns 65. If MA appears flat starting right around 65, that\u2019s because it happened to reach that locked cap around then (common for a long, steady contribution history) \u2014 not an automatic rule tied to age 65 itself; a client with a shorter contribution runway would see MA keep growing past 65 until it genuinely reaches the cap, whenever that happens to be. The Retirement Account compounds from 55 to 65, then CPF LIFE starts: per CPF Board, the RA balance is used to fund the annuity premium at that point, not left sitting as an ongoing personal balance \u2014 so RA correctly shows S$0 from 65 onward here, not a frozen leftover figure. From 65, the client\u2019s CPF-derived income is the CPF LIFE monthly payout (a separate estimate shown on Retirement Planning), not a continuing RA balance; anything that would otherwise still flow into RA after 65 (contributions, MediSave overflow) is credited to OA instead. Rows marked * hit the MediSave cap that year, with the excess flowing to SA/RA instead. The S$' + Calc.CPF_ANNUAL_LIMIT.toLocaleString() + ' CPF Annual Limit is enforced on mandatory contributions plus voluntary to All Accounts/SA. Treat as a rough directional estimate, not a guarantee \u2014 for an official payout estimate, use the CPF LIFE Estimator at cpf.gov.sg.'
        ]));
      }

      requestAnimationFrame(function () {
        var t = Charts.themeColors();
        if (age < 99 && proj.length) {
          Charts.render(document.getElementById('cpf99Chart'), {
            type: 'line',
            data: {
              labels: proj.map(function (r) { return r.age; }),
              datasets: [
                { label: 'OA', data: proj.map(function (r) { return r.oa; }), borderColor: '#2563EB', borderWidth: 3, backgroundColor: 'transparent', tension: 0.2 },
                { label: 'SA', data: proj.map(function (r) { return r.sa; }), borderColor: '#F97316', borderWidth: 3, backgroundColor: 'transparent', tension: 0.2 },
                { label: 'MA', data: proj.map(function (r) { return r.ma; }), borderColor: '#16A34A', borderWidth: 3, backgroundColor: 'transparent', tension: 0.2 }
              ]
            }
          });
        }
      });
    }

    function projAtAge(proj, targetAge) {
      var match = proj.filter(function (r) { return r.age === targetAge; });
      return match.length ? match[0] : null;
    }

    function yearlyBreakdownTable(proj) {
      var showAdditions = showAdditionsState.value;
      var wrap = Dom.el('div', {});
      wrap.appendChild(Dom.el('button', {
        class: 'btn btn-secondary btn-sm mb-2', onclick: function () { showAdditionsState.value = !showAdditionsState.value; draw(); }
      }, [showAdditions ? '\u2212 Hide +OA/+SA/+RA/+MA columns' : '+ Show +OA/+SA/+RA/+MA columns']));
      var tableWrap = Dom.el('div', { class: 'table-scroll' });
      var table = Dom.el('table', { class: 'data-table' });
      var currentYear = new Date().getFullYear();
      var headers = ['Year', 'Age', 'OA', 'SA', 'RA', 'MA', 'Total'];
      if (showAdditions) headers = headers.concat(['+OA', '+SA', '+RA (interest)', '+RA (contrib/overflow)', '+MA']);
      table.appendChild(Dom.el('thead', {}, [Dom.el('tr', {}, headers.map(function (h) { return Dom.el('th', {}, [h]); }))]));
      var tbody = Dom.el('tbody');
      proj.forEach(function (r, i) {
        if (i === 0) return; // skip the starting snapshot row, only show years with actual contributions
        // r.age is the age reached AFTER this year's contribution + growth
        // (e.g. proj[1].age = currentAge+1). The contribution itself
        // happens during the year that starts at currentAge — display
        // that starting age so the table reads as starting "now", not
        // one year ahead.
        // The transition row is a point-in-time EVENT (SA closing,
        // RA forming) that happens exactly when the client turns 55 —
        // shown at that arrival age, not the "-1" convention used for
        // ordinary yearly contribution rows.
        // The 55 transition (SA closing into RA) used to display at its
        // "arrival" age (55) rather than the standard "-1" convention,
        // which skipped age 54 in the table entirely (54's row is the
        // SAME underlying calculation step as the transition) and showed
        // 55 twice. Using the standard convention here means the
        // transition row is labelled 54 instead of 55 — but every age
        // shows exactly once, with no gaps.
        // Age 55 (SA closing into RA) gets its own explicit row via
        // displayAgeOverride, pushed separately from the transition row
        // itself, so neither is silently skipped. From the transition
        // onward, rows switch to an "age arrived at" convention
        // (isPostTransition) rather than "age at start of year", since
        // the transition is naturally indexed by the age it happens AT —
        // keeping the whole tail of the table on one consistent
        // convention avoids any further collisions or gaps.
        var isPointInTimeEvent = r.homePurchaseWithdrawal && r.homePurchaseWithdrawal > 0;
        var displayAge = r.displayAgeOverride != null ? r.displayAgeOverride
          : (isPointInTimeEvent || r.isPostTransition) ? r.age : r.age - 1;
        var yearLabel = currentYear + (displayAge - proj[0].age);
        var cells = [
          Dom.el('td', {}, [String(yearLabel)]),
          Dom.el('td', {}, [String(displayAge) + (r.bhsCapped ? ' *' : '') + (r.transitioned55 ? ' \u2192RA' : '') + (r.homePurchaseWithdrawal ? ' \ud83c\udfe0 \u2212' + Dom.fmtMoney(r.homePurchaseWithdrawal) : '')]),
          Dom.el('td', {}, [Dom.fmtMoney(r.oa)]),
          Dom.el('td', {}, [Dom.fmtMoney(r.sa)]),
          Dom.el('td', {}, [Dom.fmtMoney(r.ra)]),
          Dom.el('td', {}, [Dom.fmtMoney(r.ma)]),
          Dom.el('td', {}, [Dom.fmtMoney(r.total)])
        ];
        if (showAdditions) {
          cells.push(Dom.el('td', {}, [Dom.fmtMoney(r.addedOA)]));
          cells.push(Dom.el('td', {}, [Dom.fmtMoney(r.addedSA)]));
          cells.push(Dom.el('td', {}, [r.transitioned55 ? Dom.fmtMoney(r.addedRA) : Dom.fmtMoney(r.addedRAInterest || 0)]));
          cells.push(Dom.el('td', {}, [r.transitioned55 ? '\u2014' : Dom.fmtMoney(r.addedRAContribOverflow || 0)]));
          cells.push(Dom.el('td', {}, [Dom.fmtMoney(r.addedMA)]));
        }
        tbody.appendChild(Dom.el('tr', { style: r.transitioned55 ? 'background:var(--accent-soft)' : '' }, cells));
      });
      table.appendChild(tbody); tableWrap.appendChild(table); wrap.appendChild(tableWrap);
      return wrap;
    }

    function row(label, value) {
      return Dom.el('div', { class: 'flex justify-between items-center', style: 'padding:8px 0;border-bottom:1px solid var(--border)' }, [
        Dom.el('div', { class: 'text-secondary' }, [label]),
        Dom.el('div', { style: 'font-weight:700;font-size:14px' }, [value])
      ]);
    }
    function kpiMini(label, value, caption) {
      var children = [Dom.el('div', { class: 'kpi-label' }, [label]), Dom.el('div', { class: 'kpi-value' }, [value])];
      if (caption) children.push(Dom.el('div', { class: 'text-tertiary mt-1', style: 'line-height:1.3' }, [caption]));
      return Dom.el('div', { class: 'card kpi-card' }, children);
    }
    draw();
    return Store.subscribe('*', Dom.debounce(function () { Dom.withFocusPreserved(container, draw); }, 30));
  }
  return { title: 'CPF', render: render };
})();
