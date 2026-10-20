/* ============================================================
   housePurchase.js — House Purchase Planning
   Walks through the costs and financing of buying a property in
   Singapore (HDB BTO/Resale, Condo New Launch/Resale, Landed),
   then feeds the computed mortgage and one-off costs into Net
   Worth's Mortgage Details (which already feeds CPF), Cashflow,
   and the Cash Flow Roadmap — single source of truth, same pattern
   as the app's other auto-managed fields.
   ============================================================ */

var ModuleHousePurchase = (function () {
  var PROPERTY_TYPES = [
    ['HDB_BTO', 'HDB (BTO)'],
    ['HDB_RESALE', 'HDB Resale'],
    ['CONDO_NEW', 'Condo (New Launch)'],
    ['CONDO_RESALE', 'Condo Resale'],
    ['LANDED', 'Landed']
  ];
  var BUYER_PROFILES = [
    ['SC_1ST', 'Singapore Citizen — 1st property (0% ABSD)'],
    ['SC_2ND', 'Singapore Citizen — 2nd property (20% ABSD)'],
    ['SC_3RD_PLUS', 'Singapore Citizen — 3rd+ property (30% ABSD)'],
    ['PR_1ST', 'PR — 1st property (5% ABSD)'],
    ['PR_2ND_PLUS', 'PR — 2nd+ property (30% ABSD)'],
    ['FOREIGNER', 'Foreigner (60% ABSD)'],
    ['ENTITY', 'Entity/Corporate (65% ABSD)']
  ];
  var IS_HDB = { HDB_BTO: true, HDB_RESALE: true };
  var IS_RESALE = { HDB_RESALE: true, CONDO_RESALE: true, LANDED: true };
  var NEW_LAUNCH_SCHEDULE = [
    ['Booking (Option Fee, on signing OTP)', 5],
    ['On signing Sale & Purchase Agreement (within 8 weeks)', 15],
    ['Foundation complete', 10],
    ['Reinforced concrete framework complete', 10],
    ['Partition walls complete', 5],
    ['Roofing/ceiling complete', 5],
    ['Door & window frames, electrical wiring, plumbing', 5],
    ['Car park, roads & drains complete', 5],
    ['Temporary Occupation Permit (TOP)', 25],
    ['Certificate of Statutory Completion (CSC), ~12 months after TOP', 15]
  ];

  // Fields.selectInput only supports plain-string options (value === the
  // text shown) — this instead shows a friendly label while storing the
  // short code, same binding mechanics (data-path + onchange + Store.set).
  function labeledSelect(path, label, pairs) {
    var wrap = Dom.el('div', { class: 'field' });
    if (label) wrap.appendChild(Dom.el('label', { class: 'field-label' }, [label]));
    var current = Store.get(path);
    var select = Dom.el('select', { 'data-path': path, onchange: function (e) { Store.set(path, e.target.value); } });
    pairs.forEach(function (pair) {
      var o = Dom.el('option', { value: pair[0] }, [pair[1]]);
      if (pair[0] === current) o.setAttribute('selected', 'selected');
      select.appendChild(o);
    });
    wrap.appendChild(select);
    return wrap;
  }

  function render(container) {
    function draw() {
      var c = Store.getAll();
      var hp = c.housePurchase || {};
      var type = hp.propertyType || 'HDB_RESALE';
      var s = Calc.housePurchaseSummary(c);

      container.innerHTML = '';
      container.appendChild(Dom.el('div', { class: 'page-header' }, [
        Dom.el('h1', {}, ['House Purchase']),
        Dom.el('div', { class: 'sub' }, ['Model the full cost and financing of a property purchase — mortgage and one-off costs feed Net Worth’s Mortgage Details (which feeds CPF), Cashflow, and the Cash Flow Roadmap automatically once a Purchase Price is entered.'])
      ]));

      if (s.price > 0) {
        container.appendChild(Dom.el('div', { class: 'grid grid-kpi mb-3' }, [
          kpiMini('Total Upfront Cash Needed', Dom.fmtMoney(s.totalUpfrontCash), 'Downpayment (cash) + fees/duties − grants'),
          kpiMini('Downpayment (CPF)', Dom.fmtMoney(s.downpaymentCpf)),
          kpiMini('Loan Amount', Dom.fmtMoney(s.loanAmount), s.loanRules.ltvPct + '% LTV'),
          kpiMini('Monthly Mortgage', Dom.fmtMoney(s.monthlyMortgage), Dom.fmtMoney(s.monthlyCpf) + ' CPF + ' + Dom.fmtMoney(s.monthlyCash) + ' cash')
        ]));
      }

      // ---- Property & Purchase ----
      container.appendChild(Dom.el('div', { class: 'section-title', style: 'margin-top:0' }, ['🏠 Property & Purchase']));
      var topCard = Dom.el('div', { class: 'card mb-3' });
      topCard.appendChild(Dom.el('div', { class: 'input-row' }, [
        labeledSelect('housePurchase.propertyType', 'Property Type', PROPERTY_TYPES),
        Fields.textInput('housePurchase.purchaseYear', 'Year of Purchase', { type: 'number', placeholder: String(new Date().getFullYear()) }),
        Fields.moneyInput('housePurchase.purchasePrice', 'Purchase Price')
      ]));
      topCard.appendChild(Dom.el('div', { class: 'text-tertiary mt-2' }, [typeDescription(type)]));
      container.appendChild(topCard);

      if (type === 'CONDO_NEW') {
        container.appendChild(Dom.el('div', { class: 'section-title' }, ['📅 Progressive Payment Schedule (reference)']));
        var schedCard = Dom.el('div', { class: 'card mb-3' });
        schedCard.appendChild(Dom.el('div', { class: 'text-tertiary mb-2' }, [
          'Under the standard Progressive Payment Scheme, payment is staged across construction milestones rather than paid in full upfront. Shown for information only — the sync below assumes the full loan/downpayment is in place by TOP (a simplification).'
        ]));
        var tbl = Dom.el('table', { class: 'data-table' });
        var thead = Dom.el('thead', {}, [Dom.el('tr', {}, [Dom.el('th', {}, ['Milestone']), Dom.el('th', {}, ['% of Price']), Dom.el('th', {}, ['Amount'])])]);
        var tbody = Dom.el('tbody');
        NEW_LAUNCH_SCHEDULE.forEach(function (row) {
          tbody.appendChild(Dom.el('tr', {}, [Dom.el('td', {}, [row[0]]), Dom.el('td', {}, [row[1] + '%']), Dom.el('td', {}, [Dom.fmtMoney(s.price * row[1] / 100)])]));
        });
        tbl.appendChild(thead); tbl.appendChild(tbody);
        schedCard.appendChild(tbl);
        container.appendChild(schedCard);
      }

      // ---- Transaction Costs ----
      container.appendChild(Dom.el('div', { class: 'section-title' }, ['📋 Transaction Steps & Costs']));
      var costCard = Dom.el('div', { class: 'card mb-3' });

      if (IS_RESALE[type]) {
        costCard.appendChild(Dom.el('div', { style: 'font-weight:700;font-size:13px;margin-bottom:8px' }, ['Option & Valuation']));
        var row1 = Dom.el('div', { class: 'input-row' }, [
          Fields.moneyInput('housePurchase.optionFee', type === 'HDB_RESALE' ? 'Option Fee (OTP, to seller)' : 'Option Fee (1% deposit, to seller)'),
          Fields.moneyInput('housePurchase.exerciseFee', type === 'HDB_RESALE' ? 'Exercise Fee (to seller)' : 'Exercise Fee (4% balance deposit)')
        ]);
        if (type === 'HDB_RESALE') {
          row1.appendChild(Fields.moneyInput('housePurchase.valuationFee', 'HDB Valuation Fee'));
          row1.appendChild(Fields.moneyInput('housePurchase.cov', 'Cash Over Valuation (COV), if any'));
        }
        costCard.appendChild(row1);
        costCard.appendChild(Dom.el('div', { class: 'text-tertiary mt-1 mb-3' }, [
          type === 'HDB_RESALE'
            ? 'OTP: option fee (S$1–S$1,000, negotiable) granted by the seller for a 2–3 week option period. Exercising the option pays the Exercise Fee (balance deposit, up to S$5,000, negotiable) to the seller. HDB Valuation is a paid request for the flat’s valuation report. COV = amount paid above valuation, in cash only (not financed by loan/CPF).'
            : 'Option Fee: typically 1% of the purchase price, paid to grant the Option to Purchase (1–2 week option period). Exercise Fee: a further 4% paid to exercise the option (5% total deposit), with the balance due at completion (8–10 weeks later).'
        ]));
      }

      costCard.appendChild(Dom.el('div', { style: 'font-weight:700;font-size:13px;margin-bottom:8px' }, ['Stamp Duty']));
      costCard.appendChild(Dom.el('div', { class: 'input-row mb-2' }, [
        labeledSelect('housePurchase.buyerProfile', 'Buyer Profile (for ABSD)', BUYER_PROFILES),
        Fields.moneyInput('housePurchase.absdOverride', 'ABSD Override (optional)')
      ]));
      costCard.appendChild(bsdBreakdownTable(s));
      costCard.appendChild(Dom.el('div', { class: 'flex justify-between items-center mt-2 mb-3', style: 'padding:8px 0;border-top:1px solid var(--border)' }, [
        Dom.el('div', { class: 'text-secondary' }, ['Additional Buyer’s Stamp Duty (ABSD)']),
        Dom.el('div', { style: 'font-weight:700' }, [Dom.fmtMoney(s.absd)])
      ]));

      costCard.appendChild(Dom.el('div', { style: 'font-weight:700;font-size:13px;margin-bottom:8px' }, ['Legal, Agent, Renovation & Furnishing']));
      costCard.appendChild(Dom.el('div', { class: 'input-row' }, [
        Fields.moneyInput('housePurchase.legalFees', 'Lawyer’s / Conveyancing Fees'),
        Fields.moneyInput('housePurchase.agentFee', 'Agent Fee (if any)'),
        Fields.moneyInput('housePurchase.renoCost', 'Renovation Cost')
      ]));
      costCard.appendChild(Dom.el('div', { class: 'input-row mt-2' }, [
        Fields.moneyInput('housePurchase.furnishingCost', 'Furnishing Cost')
      ]));

      if (type === 'HDB_RESALE') {
        costCard.appendChild(Dom.el('div', { style: 'font-weight:700;font-size:13px;margin:16px 0 8px' }, ['HDB Housing Grants (if eligible)']));
        costCard.appendChild(Dom.el('div', { class: 'input-row' }, [
          Fields.moneyInput('housePurchase.grantFamily', 'Family Grant'),
          Fields.moneyInput('housePurchase.grantEhg', 'Enhanced CPF Housing Grant (EHG)')
        ]));
        costCard.appendChild(Dom.el('div', { class: 'input-row mt-2' }, [
          Fields.moneyInput('housePurchase.grantSingles', 'Singles Grant'),
          Fields.moneyInput('housePurchase.grantProximity', 'Proximity Housing Grant')
        ]));
        costCard.appendChild(Dom.el('div', { class: 'text-tertiary mt-1' }, [
          'Grants are eligibility-based (citizenship, income ceiling, first-timer status, flat type) — enter amounts manually once eligibility is confirmed; check cpf.gov.sg/hdb.gov.sg for current eligibility. Grants reduce the cash needed, never below S$0.'
        ]));
      }
      container.appendChild(costCard);

      // ---- Financing ----
      container.appendChild(Dom.el('div', { class: 'section-title' }, ['🏦 Financing']));
      var loanCard = Dom.el('div', { class: 'card mb-3' });
      var loanOptions = IS_HDB[type] ? ['HDB', 'Bank'] : ['Bank'];
      loanCard.appendChild(Dom.el('div', { class: 'input-row' }, [
        Fields.selectInput('housePurchase.loanType', 'Loan Type', loanOptions),
        Fields.numberInput('housePurchase.interestRate', 'Interest Rate % p.a.', { step: '0.01', placeholder: (hp.loanType === 'Bank' ? '3.5' : '2.6') }),
        Fields.numberInput('housePurchase.loanTenureYears', 'Loan Tenure (yrs)', { placeholder: '25' })
      ]));
      loanCard.appendChild(Dom.el('div', { class: 'text-tertiary mt-1 mb-3' }, [
        'HDB Concessionary Loan: 80% LTV (20% downpayment, can be fully CPF), rate = CPF OA rate + 0.1% (currently ~2.6%). Bank Loan: 75% LTV (25% downpayment), at least 5% of the price must be cash (rest CPF or cash), rate varies by package.'
      ]));

      loanCard.appendChild(Dom.el('div', { style: 'font-weight:700;font-size:13px;margin-bottom:8px' }, ['Downpayment (' + Dom.fmtMoney(s.downpaymentAmount) + ' total, ' + s.downpaymentPct + '%)']));
      loanCard.appendChild(Dom.el('div', { class: 'input-row' }, [
        Fields.numberInput('housePurchase.downpaymentCashPct', 'Cash Portion of Downpayment %', { step: '1', placeholder: s.loanRules.minCashPct })
      ]));
      loanCard.appendChild(Dom.el('div', { class: 'text-tertiary mt-1 mb-3' }, [
        'Minimum cash required for this loan type: ' + s.loanRules.minCashPct + '% of price (' + Dom.fmtMoney(s.minCashAmount) + '). Currently: ' + Dom.fmtMoney(s.downpaymentCash) + ' cash + ' + Dom.fmtMoney(s.downpaymentCpf) + ' CPF.'
      ]));

      loanCard.appendChild(Dom.el('div', { style: 'font-weight:700;font-size:13px;margin-bottom:8px' }, ['Monthly Mortgage (' + Dom.fmtMoney(s.monthlyMortgage) + ')']));
      loanCard.appendChild(Dom.el('div', { class: 'input-row' }, [
        Fields.numberInput('housePurchase.monthlyCpfPct', 'Paid via CPF OA %', { step: '1', placeholder: '100' })
      ]));
      loanCard.appendChild(Dom.el('div', { class: 'text-tertiary mt-1' }, [
        'Currently: ' + Dom.fmtMoney(s.monthlyCpf) + '/mo from CPF OA, ' + Dom.fmtMoney(s.monthlyCash) + '/mo cash.'
      ]));
      container.appendChild(loanCard);

      // ---- Sync status ----
      container.appendChild(Dom.el('div', { class: 'section-title' }, ['🔄 Synced To']));
      var syncCard = Dom.el('div', { class: 'card mb-3' });
      if (s.price > 0) {
        syncCard.appendChild(Dom.el('div', { class: 'text-secondary', style: 'line-height:1.7' }, [
          '✓ Net Worth → Mortgage Details: Monthly Payment (Cash) = ' + Dom.fmtMoney(s.monthlyCash) + ', Monthly Payment (CPF/OA) = ' + Dom.fmtMoney(s.monthlyCpf) + ', Loan Tenure = ' + s.tenureYears + ' yrs, Interest Rate = ' + s.interestRate + '%.',
          Dom.el('br'),
          '✓ CPF → Monthly OA Deduction for Mortgage (via the existing Net Worth → CPF link).',
          Dom.el('br'),
          '✓ Cashflow → a "Mortgage (Cash) — House Purchase" line item under Home, kept in sync automatically.',
          Dom.el('br'),
          '✓ Cash Flow Roadmap → a one-off "House Purchase — Upfront Cash" event of ' + Dom.fmtMoney(s.totalUpfrontCash) + ' at age ' + (housePurchaseAge(c) != null ? housePurchaseAge(c) : '—') + ' (Year ' + (hp.purchaseYear || '—') + ').'
        ]));
        syncCard.appendChild(Dom.el('div', { class: 'text-tertiary mt-2' }, [
          'These are overwritten automatically whenever this page changes — edit mortgage/cashflow figures here, not directly on those pages, to avoid them drifting out of sync.'
        ]));
      } else {
        syncCard.appendChild(Dom.el('div', { class: 'text-tertiary' }, ['Enter a Purchase Price above to activate syncing into Net Worth, CPF, Cashflow and the Roadmap.']));
      }
      container.appendChild(syncCard);
    }

    function typeDescription(type) {
      switch (type) {
        case 'HDB_BTO': return 'Build-To-Order flat bought directly from HDB at a subsidised, fixed price. No OTP/valuation/COV — price is fixed at booking. Payment is a small Option Fee at booking, then the bulk is paid at key collection (HDB’s Deferred Payment Scheme), not progressively during construction.';
        case 'HDB_RESALE': return 'Resale flat bought directly from an existing owner on the open market, via the HDB Resale Portal. Price is negotiated (may be above/below HDB’s valuation — any amount above is Cash Over Valuation, paid in cash).';
        case 'CONDO_NEW': return 'Uncompleted private condo unit bought directly from the developer. Price is fixed by the developer; payment follows the Progressive Payment Scheme, staged against construction milestones (see schedule below).';
        case 'CONDO_RESALE': return 'Completed private condo unit bought from an existing owner. Price is negotiated directly between buyer and seller.';
        case 'LANDED': return 'Completed landed property (terrace/semi-D/bungalow) bought from an existing owner. Same process as a condo resale; landed property is generally restricted to Singapore Citizens (PRs/foreigners need Land Dealings Approval Unit approval, with limited exceptions).';
        default: return '';
      }
    }

    function bsdBreakdownTable(s) {
      var rows = Calc.buyersStampDutyBreakdown(s.price);
      var tbl = Dom.el('table', { class: 'data-table mb-2' });
      var thead = Dom.el('thead', {}, [Dom.el('tr', {}, [Dom.el('th', {}, ['Price Tier']), Dom.el('th', {}, ['Rate']), Dom.el('th', {}, ['Amount'])])]);
      var tbody = Dom.el('tbody');
      rows.forEach(function (r) {
        tbody.appendChild(Dom.el('tr', {}, [
          Dom.el('td', {}, [Dom.fmtMoney(r.from) + ' – ' + Dom.fmtMoney(r.to)]),
          Dom.el('td', {}, [(r.rate * 100).toFixed(0) + '%']),
          Dom.el('td', {}, [Dom.fmtMoney(r.amount)])
        ]));
      });
      tbody.appendChild(Dom.el('tr', {}, [
        Dom.el('td', { style: 'font-weight:700' }, ['Total BSD']),
        Dom.el('td', {}, ['']),
        Dom.el('td', { style: 'font-weight:700' }, [Dom.fmtMoney(s.bsd)])
      ]));
      tbl.appendChild(thead); tbl.appendChild(tbody);
      return tbl;
    }

    function kpiMini(label, value, caption) {
      var children = [Dom.el('div', { class: 'kpi-label' }, [label]), Dom.el('div', { class: 'kpi-value' }, [value])];
      if (caption) children.push(Dom.el('div', { class: 'text-tertiary mt-1' }, [caption]));
      return Dom.el('div', { class: 'card kpi-card' }, children);
    }

    draw();
    return Store.subscribe('*', Dom.debounce(function () { Dom.withFocusPreserved(container, draw); }, 30));
  }

  // Age the client reaches in the Year of Purchase — used to place the
  // Roadmap's one-off upfront-cash event at the right point in time.
  function housePurchaseAge(c) {
    var hp = c.housePurchase || {};
    var purchaseYear = Calc.num(hp.purchaseYear);
    if (!purchaseYear) return null;
    var currentAge = Calc.ageFromDob((c.personal || {}).dob) || Calc.num((c.retirement || {}).currentAge);
    if (!currentAge) return null;
    var currentYear = new Date().getFullYear();
    return currentAge + (purchaseYear - currentYear);
  }

  return { title: 'House Purchase', render: render, housePurchaseAge: housePurchaseAge };
})();
