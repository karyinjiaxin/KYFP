/* ============================================================
   insurance.js — Insurance Coverage module
   ============================================================ */

var ModuleInsurance = (function () {
  var TYPES = ['Life', 'CI', 'ECI', 'Hospital', 'PA', 'Disability'];

  function render(container) {
    function draw() {
      var c = Store.getAll();
      container.innerHTML = '';
      container.appendChild(Dom.el('div', { class: 'page-header' }, [
        Dom.el('h1', {}, ['Insurance Coverage']),
        Dom.el('div', { class: 'sub' }, ['Policy-level detail feeds the coverage gap, protection ratio, and Proposal automatically.'])
      ]));

      // ---- Quick-input coverage: faster than keying full policies ----
      container.appendChild(Dom.el('div', { class: 'section-title', style: 'margin-top:0' }, ['⚡ Quick Coverage Entry']));
      var quickCard = Dom.el('div', { class: 'card mb-3' });
      quickCard.appendChild(Dom.el('div', { class: 'text-secondary mb-3' }, [
        'For a fast estimate without keying every individual policy \u2014 these amounts add directly into the coverage totals below, alongside any policies listed further down.'
      ]));
      var quickFieldRows = [
        ['deathTpd', 'Death / TPD'], ['terminalIllness', 'Terminal Illness'], ['earlyStageCI', 'Early Stage CI'],
        ['lateStageCI', 'Late Stage CI'], ['incomeProtection', 'Income Protection'], ['longTermCare', 'Long Term Care'],
        ['accidentalDeath', 'Accidental Death'], ['accidentalMedicalReimbursement', 'Accidental Medical Reimbursement'],
        ['annualHospitalClaimableLimit', 'Annual Hospital Claimable Limit']
      ];
      for (var qi = 0; qi < quickFieldRows.length; qi += 3) {
        var qrow = Dom.el('div', { class: 'input-row mt-2' });
        quickFieldRows.slice(qi, qi + 3).forEach(function (f) {
          qrow.appendChild(Fields.moneyInput('insuranceQuickCoverage.' + f[0], f[1]));
        });
        quickCard.appendChild(qrow);
      }
      container.appendChild(quickCard);

      container.appendChild(Dom.el('div', { class: 'section-title' }, ['📄 Individual Policies']));
      var policyGrid = Dom.el('div', { class: 'grid grid-2' });
      (c.insurance || []).forEach(function (p, idx) { policyGrid.appendChild(policyCard(p, idx)); });
      container.appendChild(policyGrid);

      container.appendChild(Dom.el('button', {
        class: 'btn btn-secondary mt-3', onclick: function () {
          var arr = Store.get('insurance') || [];
          arr.push({ id: Dom.uid('pol'), company: 'New Insurer', policyName: 'New Policy', type: 'Life', premium: 0, premiumFrequency: 'Monthly', coverage: 0, startAge: 30, endAge: 99, paymentTerm: 20, cashValue: 0, dividend: 0 });
          Store.set('insurance', arr);
        }
      }, ['+ Add Policy']));

      container.appendChild(Dom.el('div', { class: 'section-title' }, ['🔎 Need Analysis']));
      var needCard = Dom.el('div', { class: 'card' }, [
        Dom.el('div', { style: 'font-weight:700;font-size:13.5px;margin-bottom:2px' }, ['Death & Total Permanent Disability (TPD)']),
        row('Recommended Coverage (9x annual income + liabilities)', Dom.fmtMoney(Calc.recommendedDeathTpdCoverage(c))),
        row('Current Death Coverage Held', Dom.fmtMoney(Calc.deathTpdCoverageHeld(c))),
        row('Death/TPD Gap', Dom.fmtMoney(Calc.deathTpdGap(c))),
        Dom.el('div', { style: 'font-weight:700;font-size:13.5px;margin:16px 0 2px' }, ['Critical Illness (CI)']),
        row('Recommended Coverage (4x annual income)', Dom.fmtMoney(Calc.recommendedCICoverage(c))),
        row('Current CI + ECI Coverage Held', Dom.fmtMoney(Calc.ciCoverageHeld(c))),
        row('CI Gap', Dom.fmtMoney(Calc.ciGap(c))),
        Dom.el('div', { class: 'text-tertiary mt-3', style: 'line-height:1.5' }, [
          'Benchmarks: Life Insurance Association of Singapore 2022 Protection Gap Study (~9x annual income for Death/TPD, ~4x for Critical Illness), as adopted into the MAS/MoneySense Basic Financial Planning Guide (Oct 2023). General rules of thumb, not personalised advice — actual needs vary by dependants, debts and lifestyle.'
        ])
      ]);
      container.appendChild(needCard);

      container.appendChild(Dom.el('div', { class: 'section-title' }, ['🛡️ Coverage by Type: Existing vs Recommended']));
      var typeGrid = Dom.el('div', { class: 'grid grid-3 mb-3' });
      typeGrid.appendChild(coverageTypePie('Death / TPD', Calc.deathTpdCoverageHeld(c), Calc.recommendedDeathTpdCoverage(c), 'deathTpdChart'));
      typeGrid.appendChild(coverageTypePie('Critical Illness (Early + Late)', Calc.ciCoverageHeld(c), Calc.recommendedCICoverage(c), 'ciChart'));
      typeGrid.appendChild(coverageTypePie('Income Protection', Calc.incomeProtectionHeld(c), Calc.recommendedIncomeProtection(c), 'incomeProtectionChart', '/mo'));
      typeGrid.appendChild(coverageTypePie('Long Term Care', Calc.longTermCareHeld(c), Calc.recommendedLongTermCare(c), 'longTermCareChart', '/mo'));
      container.appendChild(typeGrid);
      container.appendChild(Dom.el('div', { class: 'card mb-3', style: 'font-size:11.5px;line-height:1.6' }, [
        Dom.el('div', { style: 'font-weight:700;margin-bottom:4px' }, ['Benchmark sources']),
        Dom.el('div', {}, ['Death/TPD (~9x annual income + liabilities) and Critical Illness (~4x annual income): Life Insurance Association of Singapore 2022 Protection Gap Study, adopted into the MAS/MoneySense Basic Financial Planning Guide. ',
          Dom.el('a', { href: 'https://www.lia.org.sg', target: '_blank', rel: 'noopener' }, ['lia.org.sg'])
        ]),
        Dom.el('div', { class: 'mt-1' }, ['Income Protection (up to 75% of gross monthly income): common Singapore insurer underwriting cap for Disability Income / Income Protection products \u2014 varies by insurer, confirm the specific product\u2019s limit.']),
        Dom.el('div', { class: 'mt-1' }, ['Long Term Care (S$6,000/month): rounded up from private nursing home costs, which run roughly S$5,500/month on average (private facilities can range S$2,000\u2013S$5,500+; home care / live-in helper roughly S$800\u2013S$1,200/month) \u2014 a cost-based reference, not an income multiple, since care costs don\u2019t scale with income the way Death/TPD or CI do. Source: Agency for Integrated Care (AIC) guidelines and industry cost surveys, 2025\u20132026. ',
          Dom.el('a', { href: 'https://www.aic.sg', target: '_blank', rel: 'noopener' }, ['aic.sg'])
        ]),
        Dom.el('div', { class: 'mt-1' }, ['CI and ECI are combined against one benchmark since LIA doesn\u2019t publish a separate figure for early-stage cover.'])
      ]));

      requestAnimationFrame(function () {
        drawCoverageTypePie(c, 'deathTpdChart', Calc.deathTpdCoverageHeld(c), Calc.recommendedDeathTpdCoverage(c));
        drawCoverageTypePie(c, 'ciChart', Calc.ciCoverageHeld(c), Calc.recommendedCICoverage(c));
        drawCoverageTypePie(c, 'incomeProtectionChart', Calc.incomeProtectionHeld(c), Calc.recommendedIncomeProtection(c));
        drawCoverageTypePie(c, 'longTermCareChart', Calc.longTermCareHeld(c), Calc.recommendedLongTermCare(c));
      });
    }

    function coverageTypePie(label, existing, recommended, canvasId, unitSuffix) {
      var pct = recommended > 0 ? Math.min(999, (existing / recommended) * 100) : 100;
      return Dom.el('div', { class: 'card' }, [
        Dom.el('div', { class: 'flex justify-between items-center mb-2' }, [
          Dom.el('div', { style: 'font-weight:700;font-size:13px' }, [label]),
          Dom.el('div', { class: 'badge ' + (pct >= 100 ? 'badge-good' : pct >= 50 ? 'badge-warn' : 'badge-bad') }, [pct.toFixed(0) + '%'])
        ]),
        Dom.el('div', { class: 'chart-wrap', style: 'height:160px' }, [Dom.el('canvas', { id: canvasId })]),
        Dom.el('div', { class: 'flex justify-between mt-2', style: 'font-size:11.5px' }, [
          Dom.el('div', { class: 'text-secondary' }, ['Existing: ' + Dom.fmtMoney(existing) + (unitSuffix || '')]),
          Dom.el('div', { class: 'text-secondary' }, ['Rec.: ' + Dom.fmtMoney(recommended) + (unitSuffix || '')])
        ])
      ]);
    }

    function drawCoverageTypePie(c, canvasId, existing, recommended) {
      var t = Charts.themeColors();
      var gap = Math.max(0, recommended - existing);
      var overCovered = existing > recommended;
      Charts.render(document.getElementById(canvasId), {
        type: 'pie',
        data: {
          labels: overCovered ? ['Existing Coverage'] : ['Existing Coverage', 'Gap to Recommended'],
          datasets: [{ data: overCovered ? [existing] : [existing, gap], backgroundColor: overCovered ? [t.good || t.palette[2]] : [t.palette[0], t.palette[3]] }]
        },
        options: { scales: { x: false, y: false } }
      });
    }

    function row(label, value) {
      return Dom.el('div', { class: 'flex justify-between items-center', style: 'padding:8px 0;border-bottom:1px solid var(--border)' }, [
        Dom.el('div', { class: 'text-secondary' }, [label]),
        Dom.el('div', { style: 'font-weight:700;font-size:14px' }, [value])
      ]);
    }

    function policyCard(p, idx) {
      var base = 'insurance.' + idx + '.';
      var annualPremium = Calc.policyAnnualPremium(p);
      var card = Dom.el('div', { class: 'policy-card' });
      card.appendChild(Dom.el('div', { class: 'policy-head' }, [
        Dom.el('div', {}, [
          Dom.el('div', { class: 'policy-title' }, [p.policyName || 'Policy']),
          Dom.el('div', { class: 'policy-sub' }, [p.company + ' · ' + p.type])
        ]),
        Dom.el('button', { class: 'btn btn-ghost btn-sm', onclick: function () { var arr = Store.get('insurance'); arr.splice(idx, 1); Store.set('insurance', arr); } }, ['Remove'])
      ]));

      var statsRow = Dom.el('div', { class: 'grid grid-3', style: 'margin-bottom:14px' }, [
        miniStat('Annual Premium', Dom.fmtMoney(annualPremium)),
        miniStat('Coverage', Dom.fmtMoney(p.coverage)),
        miniStat('Cash Value', Dom.fmtMoney(p.cashValue))
      ]);
      card.appendChild(statsRow);

      var formRow1 = Dom.el('div', { class: 'input-row' }, [
        Fields.textInput(base + 'company', 'Company'),
        Fields.textInput(base + 'policyName', 'Policy Name'),
        Fields.selectInput(base + 'type', 'Type', TYPES)
      ]);
      var formRow2 = Dom.el('div', { class: 'input-row mt-2' }, [
        Fields.moneyInput(base + 'premium', 'Premium'),
        Fields.selectInput(base + 'premiumFrequency', 'Frequency', ['Monthly', 'Annually']),
        Fields.moneyInput(base + 'coverage', 'Coverage')
      ]);
      var formRow3 = Dom.el('div', { class: 'input-row mt-2' }, [
        Fields.numberInput(base + 'startAge', 'Start Age'),
        Fields.numberInput(base + 'endAge', 'End Age'),
        Fields.numberInput(base + 'paymentTerm', 'Payment Term (yrs)')
      ]);
      var formRow4 = Dom.el('div', { class: 'input-row mt-2' }, [
        Fields.moneyInput(base + 'cashValue', 'Cash Value'),
        Fields.numberInput(base + 'dividend', 'Dividend Rate %', { step: '0.1' })
      ]);
      card.appendChild(formRow1); card.appendChild(formRow2); card.appendChild(formRow3); card.appendChild(formRow4);
      if (p.type === 'Hospital') {
        card.appendChild(Dom.el('div', { class: 'input-row mt-2' }, [
          Fields.selectInput(base + 'wardClass', 'Ward Class', ['Private Hospital', 'Govt A Ward', 'Govt B Ward'])
        ]));
      }
      return card;
    }

    function miniStat(label, value) {
      return Dom.el('div', { class: 'mini-stat' }, [Dom.el('div', { class: 'l' }, [label]), Dom.el('div', { class: 'v' }, [value])]);
    }
    function kpiMini(label, value) {
      return Dom.el('div', { class: 'card kpi-card' }, [Dom.el('div', { class: 'kpi-label' }, [label]), Dom.el('div', { class: 'kpi-value' }, [value])]);
    }

    draw();
    return Store.subscribe('*', Dom.debounce(function () { Dom.withFocusPreserved(container, draw); }, 30));
  }

  return { title: 'Insurance Coverage', render: render };
})();
