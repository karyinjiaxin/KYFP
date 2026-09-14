/* ============================================================
   tax.js — Tax Planning module (Singapore resident rates, YA2026)
   Reliefs and caps sourced from iras.gov.sg/taxes/individual-income-tax
   /basics-of-individual-income-tax/tax-reliefs-rebates-and-deductions
   ============================================================ */

var ModuleTax = (function () {
  function render(container) {
    function draw() {
      var c = Store.getAll();
      var annualIncome = Calc.monthlyIncome(c) * 12;
      var qcr = Calc.qualifyingChildRelief(c);
      var reliefsInfo = Calc.totalTaxReliefs(c);
      var chargeable = Math.max(0, annualIncome - reliefsInfo.capped);
      var tax = SG.estimateIncomeTax(chargeable);
      var effRate = SG.effectiveRate(chargeable);
      var parenthoodRebate = Calc.num((c.tax || {}).parenthoodTaxRebate);
      var netTaxPayable = Math.max(0, tax - parenthoodRebate);

      container.innerHTML = '';
      container.appendChild(Dom.el('div', { class: 'page-header' }, [
        Dom.el('h1', {}, ['Tax Planning']),
        Dom.el('div', { class: 'sub' }, ['Applies current Singapore resident progressive tax rates to income from Cashflow, net of reliefs.'])
      ]));

      container.appendChild(Dom.el('div', { class: 'grid grid-kpi mb-3' }, [
        kpiMini('Annual Income', Dom.fmtMoney(annualIncome)),
        kpiMini('Total Reliefs', Dom.fmtMoney(reliefsInfo.capped), reliefsInfo.wasCapped ? 'Capped at S$80,000' : null, 'flat'),
        kpiMini('Chargeable Income', Dom.fmtMoney(chargeable)),
        kpiMini('Gross Tax Payable', Dom.fmtMoney(tax)),
        kpiMini('Net Tax Payable', Dom.fmtMoney(netTaxPayable), parenthoodRebate > 0 ? ('After S$' + parenthoodRebate.toLocaleString() + ' Parenthood Tax Rebate') : null, 'flat'),
        kpiMini('Effective Rate', Dom.fmtPct(effRate))
      ]));

      var reliefCard = Dom.el('div', { class: 'card mb-3' }, [Dom.el('div', { class: 'section-title', style: 'margin-top:0' }, ['🧾 Reliefs'])]);

      var status = (c.personal || {}).employmentStatus;
      reliefCard.appendChild(autoReliefField('Earned Income Relief', reliefsInfo.earnedIncome,
        'Auto-computed: lesser of your earned income (salary + bonus + business income) or the age-based cap — under 55: S$1,000 · 55–59: S$6,000 · 60 and above: S$8,000.'));

      if (status === 'Self-Employed' || status === 'Unemployed') {
        reliefCard.appendChild(reliefField('tax.reliefs.cpfRelief', 'CPF Relief',
          'Employment Status is "' + (status || 'not set') + '" \u2014 self-employed CPF relief follows separate MediSave-based rules, so this is left as a fillable field rather than auto-computed. Enter your own CPF Relief claim here if applicable.'));
      } else {
        reliefCard.appendChild(autoReliefField('CPF Relief', reliefsInfo.cpfRelief,
          'Auto-computed from Cashflow → Investment → CPF Contribution, which follows your Employment Status ("' + (status || 'Full-Time Employed') + '") on Client Profile. Compulsory employee CPF contributions only.'));
      }

      reliefCard.appendChild(reliefField('tax.reliefs.spouseRelief', 'Spouse Relief',
        'S$2,000 if your spouse\u2019s annual income did not exceed S$8,000 and they lived with or were supported by you.'));

      reliefCard.appendChild(Dom.el('div', { class: 'flex justify-between items-center', style: 'padding:10px 0;border-bottom:1px solid var(--border)' }, [
        Dom.el('div', {}, [
          Dom.el('div', { style: 'font-weight:600;font-size:13.5px' }, ['Qualifying Child Relief (QCR)']),
          Dom.el('div', { class: 'text-tertiary', style: 'margin-top:2px' }, ['S$4,000 per child \u2014 auto-counted from ' + (c.dependants || []).filter(function (d) { return (d.relation || '').toLowerCase() === 'child'; }).length + ' child dependant(s) on Client Profile.'])
        ]),
        Dom.el('div', { class: 'badge badge-good' }, [Dom.fmtMoney(qcr)])
      ]));

      reliefCard.appendChild(reliefField('tax.reliefs.wmcr', "Working Mother's Child Relief (WMCR)",
        'For children born on/after 1 Jan 2024: fixed S$8,000 / S$10,000 / S$12,000 for 1st / 2nd / 3rd+ child. For children born earlier: 15% / 20% / 25% of the mother\u2019s earned income.'));
      reliefCard.appendChild(reliefField('tax.reliefs.parentRelief', 'Parent Relief',
        'Per dependant: S$9,000 if living with you, S$5,500 if not (S$14,000 / S$10,000 if the dependant is handicapped).'));
      reliefCard.appendChild(reliefField('tax.reliefs.grandparentCaregiver', 'Grandparent Caregiver Relief',
        'S$3,000 if a grandparent (incl. in-law) cared for your child and you are a working mother.'));
      reliefCard.appendChild(reliefField('tax.reliefs.cpfCashTopUp', 'CPF Cash Top-up Relief',
        'Up to S$8,000 for cash top-ups to your own CPF account, plus up to S$8,000 for top-ups to eligible family members\u2019 accounts (S$16,000 max combined).'));
      reliefCard.appendChild(reliefField('tax.reliefs.srs', 'SRS Contribution Relief',
        'Your Supplementary Retirement Scheme contributions for the year, relieved in the following YA.', true));
      reliefCard.appendChild(reliefField('tax.reliefs.others', 'Other Reliefs',
        'Anything not covered above (e.g. NSman Relief, Course Fees Relief, Life Insurance Relief) \u2014 enter the total here.'));      reliefCard.appendChild(Dom.el('div', { class: 'mt-3', style: 'padding-top:10px;border-top:1px solid var(--border-strong)' }, [
        Dom.el('div', { class: 'flex justify-between items-center' }, [
          Dom.el('div', { style: 'font-weight:700;font-size:13.5px' }, ['Total Reliefs (before cap)']),
          Dom.el('div', { style: 'font-weight:700' }, [Dom.fmtMoney(reliefsInfo.uncapped)])
        ]),
        reliefsInfo.wasCapped ? Dom.el('div', { class: 'text-secondary mt-2' }, [
          'IRAS caps total personal reliefs at S$80,000 per Year of Assessment \u2014 the amount above that isn\u2019t deductible.'
        ]) : null
      ]));

      container.appendChild(reliefCard);

      container.appendChild(Dom.el('div', { class: 'section-title' }, ['💵 Rebates (reduce tax payable directly, not chargeable income)']));
      var rebateCard = Dom.el('div', { class: 'card mb-3' });
      rebateCard.appendChild(Dom.el('div', { class: 'input-row', style: 'align-items:end' }, [
        Fields.moneyInput('tax.parenthoodTaxRebate', 'Parenthood Tax Rebate')
      ]));
      rebateCard.appendChild(Dom.el('div', { class: 'text-tertiary mt-1', style: 'line-height:1.4' }, [
        'S$5,000 / S$10,000 / S$20,000 for the 1st / 2nd / 3rd-and-subsequent child (Singapore Citizen, qualifying conditions apply), shared between parents as agreed. Unlike a relief, this comes off the tax bill itself, after tax on chargeable income is calculated \u2014 shown separately in Net Tax Payable above.'
      ]));
      container.appendChild(rebateCard);

      container.appendChild(Dom.el('div', { class: 'text-tertiary mb-3', style: 'line-height:1.5' }, [
        'Relief amounts and the S$80,000 overall cap are from IRAS (iras.gov.sg) Tax Reliefs, Rebates and Deductions, Year of Assessment 2026. Qualifying conditions apply to every relief above \u2014 these figures are the maximum caps, not automatic entitlements. Estimates only, not a substitute for formal tax advice.'
      ]));

      container.appendChild(Dom.el('div', { class: 'section-title' }, ['📶 Progressive Tax Brackets Applied']));
      var wrap = Dom.el('div', { class: 'table-scroll' });
      var table = Dom.el('table', { class: 'data-table' });
      table.appendChild(Dom.el('thead', {}, [Dom.el('tr', {}, ['Chargeable Income', 'Rate', 'Gross Tax Payable'].map(function (h) { return Dom.el('th', {}, [h]); }))]));
      var tbody = Dom.el('tbody');
      var lower = 0, cumulativeTax = 0;
      SG.TAX_BRACKETS.forEach(function (b, i) {
        var bandWidth = b.upTo === Infinity ? null : b.upTo - lower;
        var bandTax = b.upTo === Infinity ? null : bandWidth * b.rate;
        if (bandTax !== null) cumulativeTax += bandTax;
        var rowInRange = chargeable > lower;

        // Official IRAS format (per iras.gov.sg Sample Income Tax
        // calculations): each bracket after the first shows TWO rows —
        // "First $X" as a running cumulative subtotal marker (no rate,
        // just the running total so far), then "Next $Y @ rate%" for the
        // increment itself — not a single flat "Next" list.
        if (i > 0) {
          tbody.appendChild(Dom.el('tr', { style: rowInRange ? 'background:var(--accent-soft)' : '', class: 'text-secondary' }, [
            Dom.el('td', {}, ['First S$' + lower.toLocaleString()]),
            Dom.el('td', {}, ['\u2014']),
            Dom.el('td', {}, [Dom.fmtMoney(cumulativeTax - (bandTax || 0))])
          ]));
        }
        tbody.appendChild(Dom.el('tr', { style: rowInRange ? 'background:var(--accent-soft)' : '' }, [
          Dom.el('td', {}, [i === 0 ? ('First S$' + b.upTo.toLocaleString()) : (b.upTo === Infinity ? ('In excess of S$' + lower.toLocaleString()) : ('Next S$' + bandWidth.toLocaleString()))]),
          Dom.el('td', {}, [Dom.fmtPct(b.rate * 100)]),
          Dom.el('td', {}, [bandTax !== null ? Dom.fmtMoney(bandTax) : '\u2014'])
        ]));
        lower = b.upTo;
      });
      table.appendChild(tbody); wrap.appendChild(table); container.appendChild(wrap);
      container.appendChild(Dom.el('div', { class: 'text-tertiary mt-3' }, [
        'Highlighted rows are the bands your chargeable income of ' + Dom.fmtMoney(chargeable) + ' actually falls into or through. Format and rates: IRAS Individual Income Tax rates and Sample Income Tax calculations, resident rates from YA2024 onwards. ',
        Dom.el('a', { href: 'https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/tax-residency-and-tax-rates/individual-income-tax-rates', target: '_blank', rel: 'noopener' }, ['iras.gov.sg'])
      ]));
    }

    function reliefField(path, label, caption) {
      return Dom.el('div', { style: 'padding:10px 0;border-bottom:1px solid var(--border)' }, [
        Dom.el('div', { class: 'input-row', style: 'align-items:end' }, [
          Fields.moneyInput(path, label)
        ]),
        Dom.el('div', { class: 'text-tertiary mt-1', style: 'line-height:1.4' }, [caption])
      ]);
    }

    function autoReliefField(label, value, caption) {
      return Dom.el('div', { style: 'padding:10px 0;border-bottom:1px solid var(--border)' }, [
        Dom.el('div', { class: 'flex justify-between items-center' }, [
          Dom.el('div', { class: 'field-label', style: 'margin-bottom:0' }, [label]),
          Dom.el('div', { class: 'badge badge-good' }, [Dom.fmtMoney(value)])
        ]),
        Dom.el('div', { class: 'text-tertiary mt-1', style: 'line-height:1.4' }, [caption])
      ]);
    }

    function kpiMini(label, value, delta, dir) {
      var children = [Dom.el('div', { class: 'kpi-label' }, [label]), Dom.el('div', { class: 'kpi-value' }, [value])];
      if (delta) children.push(Dom.el('div', { class: 'kpi-delta ' + (dir || 'flat') }, [delta]));
      return Dom.el('div', { class: 'card kpi-card' }, children);
    }
    draw();
    return Store.subscribe('*', Dom.debounce(function () { Dom.withFocusPreserved(container, draw); }, 30));
  }
  return { title: 'Tax Planning', render: render };
})();
