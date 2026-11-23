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
      container.appendChild(Dom.el('div', { class: 'page-header flex justify-between items-center' }, [
        Dom.el('div', {}, [
          Dom.el('h1', {}, ['House Purchase']),
          Dom.el('div', { class: 'sub' }, ['Model the full cost and financing of a property purchase — mortgage and one-off costs feed Net Worth’s Mortgage Details (which feeds CPF), Cashflow, and the Cash Flow Roadmap automatically once a Purchase Price is entered.'])
        ]),
        s.price > 0 ? Dom.el('button', {
          class: 'btn btn-secondary', onclick: function () {
            Dom.modalConfirm(
              'Clear every House Purchase field on this page, for a fresh simulation? This also removes the mortgage figures it synced into Net Worth’s Mortgage Details, CPF’s Future Home Purchase fields, the auto Cashflow mortgage item, and the Roadmap’s upfront-cash event. Nothing else on the client is touched. This cannot be undone.',
              function () { clearAll(); },
              { confirmLabel: 'Clear All', danger: true }
            );
          }
        }, ['Clear All']) : null
      ].filter(Boolean)));

      if (s.price > 0) {
        container.appendChild(Dom.el('div', { class: 'grid grid-kpi mb-3' }, [
          kpiMini('Total Upfront Cash Needed', Dom.fmtMoney(s.totalUpfrontCash), 'Downpayment (cash) + fees/duties − grants', 'orange'),
          kpiMini('Downpayment (CPF)', Dom.fmtMoney(s.downpaymentCpf), null, 'blue'),
          kpiMini('Loan Amount', Dom.fmtMoney(s.loanAmount), s.loanRules.ltvPct + '% LTV' + (s.loanExceedsEligibility ? ' — ⚠ may exceed TDSR/MSR eligibility' : ''), s.loanExceedsEligibility ? 'red' : 'teal'),
          kpiMini('Monthly Mortgage', Dom.fmtMoney(s.monthlyMortgage), Dom.fmtMoney(s.monthlyCpf) + ' CPF + ' + Dom.fmtMoney(s.monthlyCash) + ' cash', 'violet')
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
        costCard.appendChild(Dom.el('div', { style: 'font-weight:700;font-size:11.5px;margin-bottom:8px' }, ['Option & Valuation']));
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

      costCard.appendChild(Dom.el('div', { style: 'font-weight:700;font-size:11.5px;margin-bottom:8px' }, ['Stamp Duty']));
      costCard.appendChild(Dom.el('div', { class: 'input-row mb-2' }, [
        labeledSelect('housePurchase.buyerProfile', 'Buyer Profile (for ABSD)', BUYER_PROFILES),
        Fields.moneyInput('housePurchase.absdOverride', 'ABSD Override (optional)')
      ]));
      costCard.appendChild(bsdBreakdownTable(s));
      costCard.appendChild(Dom.el('div', { class: 'flex justify-between items-center mt-2 mb-3', style: 'padding:8px 0;border-top:1px solid var(--border)' }, [
        Dom.el('div', { class: 'text-secondary' }, ['Additional Buyer’s Stamp Duty (ABSD)']),
        Dom.el('div', { style: 'font-weight:700' }, [Dom.fmtMoney(s.absd)])
      ]));

      costCard.appendChild(Dom.el('div', { style: 'font-weight:700;font-size:11.5px;margin-bottom:8px' }, ['Legal, Agent, Renovation & Furnishing']));
      costCard.appendChild(Dom.el('div', { class: 'input-row' }, [
        Fields.moneyInput('housePurchase.legalFees', 'Lawyer’s / Conveyancing Fees'),
        Fields.moneyInput('housePurchase.agentFee', 'Agent Fee (if any)'),
        Fields.moneyInput('housePurchase.renoCost', 'Renovation Cost')
      ]));
      costCard.appendChild(Dom.el('div', { class: 'input-row mt-2' }, [
        Fields.moneyInput('housePurchase.furnishingCost', 'Furnishing Cost')
      ]));

      if (type === 'HDB_RESALE') {
        costCard.appendChild(Dom.el('div', { style: 'font-weight:700;font-size:11.5px;margin:16px 0 8px' }, ['HDB Housing Grants (if eligible)']));
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
        'Both loan types are 75% LTV (25% downpayment) since HDB lowered its limit from 80% to 75% on 20 Aug 2024, matching the bank-loan cap. They still differ on cash: HDB Concessionary Loan (rate = CPF OA rate + 0.1%, currently ~2.6%) can have its downpayment paid entirely from CPF OA. Bank Loan requires at least 5% of the price in cash; rate varies by package.'
      ]));

      loanCard.appendChild(Dom.el('div', { style: 'font-weight:700;font-size:11.5px;margin-bottom:8px' }, ['Downpayment (' + Dom.fmtMoney(s.downpaymentAmount) + ' total, ' + s.downpaymentPct + '%)']));
      loanCard.appendChild(Dom.el('div', { class: 'input-row' }, [
        Fields.numberInput('housePurchase.downpaymentCashPct', 'Cash Portion of Downpayment %', { step: '1', placeholder: s.loanRules.minCashPct })
      ]));
      loanCard.appendChild(Dom.el('div', { class: 'text-tertiary mt-1 mb-3' }, [
        'Minimum cash required for this loan type: ' + s.loanRules.minCashPct + '% of price (' + Dom.fmtMoney(s.minCashAmount) + '). Currently: ' + Dom.fmtMoney(s.downpaymentCash) + ' cash + ' + Dom.fmtMoney(s.downpaymentCpf) + ' CPF.'
      ]));

      loanCard.appendChild(Dom.el('div', { style: 'font-weight:700;font-size:11.5px;margin-bottom:8px' }, ['Monthly Mortgage (' + Dom.fmtMoney(s.monthlyMortgage) + ')']));
      loanCard.appendChild(Dom.el('div', { class: 'input-row' }, [
        Fields.moneyInput('housePurchase.monthlyCpfAmount', 'Paid via CPF OA ($/mo)'),
        Dom.el('div', { class: 'field' }, [
          Dom.el('label', { class: 'field-label' }, ['Paid via Cash ($/mo)']),
          Dom.el('div', { class: 'input-prefix' }, [Dom.el('span', {}, ['S$']), Dom.el('input', { type: 'text', value: Dom.fmtMoney(s.monthlyCash).replace('S$', ''), disabled: true })])
        ])
      ]));
      loanCard.appendChild(Dom.el('div', { class: 'text-tertiary mt-1' }, [
        'Cash is whatever of the Monthly Mortgage isn’t covered by the CPF OA amount entered — it fills in automatically and can’t be edited directly. Currently: ' + Dom.fmtMoney(s.monthlyCpf) + '/mo from CPF OA, ' + Dom.fmtMoney(s.monthlyCash) + '/mo cash.'
      ]));
      container.appendChild(loanCard);

      // ---- Loan Eligibility (TDSR/MSR) ----
      container.appendChild(Dom.el('div', { class: 'section-title' }, ['⚖️ Loan Eligibility (TDSR / MSR)']));
      var eligCard = Dom.el('div', { class: 'card mb-3' });
      var elig = s.eligibility;
      eligCard.appendChild(Dom.el('div', { class: 'input-row' }, [
        Fields.moneyInput('housePurchase.otherMonthlyDebt', 'Other Monthly Debt Obligations (car/personal loans, etc.)')
      ]));
      eligCard.appendChild(Dom.el('div', { class: 'text-tertiary mt-1 mb-3' }, [
        'TDSR: all monthly debt (incl. this mortgage) capped at 55% of gross monthly income — applies to bank loans only, not a direct HDB Loan. MSR: this mortgage alone capped at 30% of gross monthly income — applies only to HDB/EC, whichever loan type. Both are assessed at a stress-tested interest rate (' + elig.stressRate + '% for this loan type), not the actual rate above — the stress rate only affects how much you can borrow, not what you’ll actually pay.'
      ]));
      eligCard.appendChild(Dom.el('div', { class: 'grid grid-3' }, [
        kpiMini('Gross Monthly Income', Dom.fmtMoney(elig.grossMonthlyIncome), null, 'green'),
        kpiMini('MSR Cap (30%)', elig.msrCap != null ? Dom.fmtMoney(elig.msrCap) + '/mo' : 'N/A (not HDB/EC)', null, 'yellow'),
        kpiMini('TDSR Cap (55%)', elig.tdsrCap != null ? Dom.fmtMoney(elig.tdsrCap) + '/mo' : 'N/A (HDB Loan)', null, 'cyan')
      ]));
      eligCard.appendChild(Dom.el('div', { class: 'flex justify-between items-center mt-3', style: 'padding:10px 0;border-top:1px solid var(--border)' }, [
        Dom.el('div', { class: 'text-secondary' }, ['Maximum Loan Amount (at ' + elig.stressRate + '% stress rate, ' + s.tenureYears + ' yrs)']),
        Dom.el('div', { style: 'font-weight:700;font-size:13.5px' }, [Dom.fmtMoney(elig.maxLoanAmount)])
      ]));
      if (s.price > 0) {
        eligCard.appendChild(Dom.el('div', {
          class: 'mt-2', style: 'padding:10px 12px;border-radius:8px;font-size:11px;font-weight:600;' +
            (s.loanExceedsEligibility ? 'background:var(--bad-soft);color:var(--bad)' : 'background:var(--good-soft);color:var(--good)')
        }, [
          s.loanExceedsEligibility
            ? '⚠ Loan Amount needed (' + Dom.fmtMoney(s.loanAmount) + ') exceeds what this income likely qualifies for. Consider a larger cash downpayment, a longer tenure, a lower purchase price, or reducing other debt.'
            : '✓ Loan Amount needed (' + Dom.fmtMoney(s.loanAmount) + ') is within what this income likely qualifies for.'
        ]));
      }
      container.appendChild(eligCard);

      // ---- Sync status ----
      container.appendChild(Dom.el('div', { class: 'section-title' }, ['🔄 Synced To']));
      var syncCard = Dom.el('div', { class: 'card mb-3' });
      if (s.price > 0) {
        syncCard.appendChild(Dom.el('div', { class: 'text-secondary', style: 'line-height:1.7' }, [
          '✓ Net Worth → Mortgage Details: Monthly Payment (Cash) = ' + Dom.fmtMoney(s.monthlyCash) + ', Monthly Payment (CPF/OA) = ' + Dom.fmtMoney(s.monthlyCpf) + ', Loan Tenure = ' + s.tenureYears + ' yrs, Interest Rate = ' + s.interestRate + '%.',
          Dom.el('br'),
          '✓ CPF → Monthly OA Deduction for Mortgage (via the existing Net Worth → CPF link).',
          Dom.el('br'),
          '✓ CPF → Future Home Purchase At Age = ' + (housePurchaseAge(c) != null ? housePurchaseAge(c) : '—') + ', Est. Downpayment From OA = ' + Dom.fmtMoney(s.downpaymentCpf) + ' (one-time OA withdrawal in the CPF projection).',
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

      // ---- Decoupling / Transfer of Property Share ----
      renderDecoupling(container, c);
    }

    function renderDecoupling(container, c) {
      var d = ((c.housePurchase || {}).decoupling) || {};
      var role = d.role === 'Buying' ? 'Buying' : 'Selling';
      var ds = Calc.decouplingSummary(c);
      var txAge = decouplingAge(c);

      container.appendChild(Dom.el('div', { class: 'section-title' }, ['🔁 Decoupling — Transfer of Property Share']));
      var card = Dom.el('div', { class: 'card mb-3' });
      card.appendChild(Dom.el('div', { class: 'text-tertiary mb-2' }, [
        'Models one spouse selling their ownership share of the CURRENT property to the other — a common way to free up one spouse to buy a second property without ABSD, since they then own none. Each spouse is their own separate client file in this app, so run this once per spouse’s own file, with the role set to what actually happens to THEM: the selling spouse picks "Selling" on their own file, the buying spouse picks "Buying" on theirs. Once the selling spouse is property-free, use this page’s own Property & Purchase fields above, on THEIR file, to plan their subsequent property — already fully supported.'
      ]));
      card.appendChild(Dom.el('div', { class: 'input-row' }, [
        Fields.selectInput('housePurchase.decoupling.role', 'My Role in This Transaction', ['Selling', 'Buying']),
        Fields.moneyInput('housePurchase.decoupling.currentPropertyValue', 'Current Property Market Value'),
        Fields.numberInput('housePurchase.decoupling.transferSharePct', 'Share Being Transferred (%)', { step: '1', placeholder: '50' })
      ]));
      card.appendChild(Dom.el('div', { class: 'input-row mt-2' }, [
        Fields.textInput('housePurchase.decoupling.transactionYear', 'Year of Transaction', { type: 'number', placeholder: String(new Date().getFullYear()) })
      ]));

      if (ds.active) {
        card.appendChild(Dom.el('div', { class: 'grid grid-kpi mt-3 mb-2' }, [
          kpiMini('Transfer Value (Lump Sum)', Dom.fmtMoney(ds.transferValue), 'Payable by the buying spouse to the selling spouse', 'blue'),
          kpiMini('Stamp Duty (BSD) Payable', Dom.fmtMoney(ds.bsd), 'Payable by the buying spouse to IRAS', 'orange'),
          kpiMini('Total Buyer Outlay', Dom.fmtMoney(ds.totalBuyerOutlay), 'Transfer Value + BSD', 'violet')
        ]));

        if (role === 'Buying') {
          card.appendChild(Dom.el('div', { style: 'font-weight:700;font-size:11.5px;margin:12px 0 8px' }, ['Financing the Outlay (' + Dom.fmtMoney(ds.totalBuyerOutlay) + ' total)']));
          card.appendChild(Dom.el('div', { class: 'input-row mb-2' }, [
            Fields.selectInput('housePurchase.decoupling.financeMode', 'Financing', ['CashCpf', 'Loan'])
          ]));

          if (ds.financeMode === 'Loan') {
            card.appendChild(Dom.el('div', { class: 'text-tertiary mb-2' }, [
              'Banks require the buying spouse to fully REFINANCE the property in their sole name — one new, bigger loan that pays off whatever’s left on the existing mortgage AND funds the buyout, not two separate loan facilities on the same property.'
            ]));
            card.appendChild(Dom.el('div', { class: 'input-row' }, [
              Fields.moneyInput('housePurchase.decoupling.existingLoanBalance', 'Existing Mortgage Balance (to be paid off)'),
              Fields.numberInput('housePurchase.decoupling.ltvPct', 'LTV Limit on New Loan (%)', { step: '1', placeholder: '75' })
            ]));
            card.appendChild(Dom.el('div', { class: 'text-tertiary mt-1 mb-2' }, [
              'Total Needed (existing balance + transfer value + BSD): ' + Dom.fmtMoney(ds.totalNeeded) + '. Max Loan at ' + ds.ltvPct + '% LTV: ' + Dom.fmtMoney(ds.maxLoanAmount) + '. A refinance after decoupling often gets a LOWER LTV than a fresh purchase in practice — check with the bank; the % above is editable.'
            ]));
            card.appendChild(Dom.el('div', { class: 'input-row' }, [
              Fields.moneyInput('housePurchase.decoupling.loanAmount', 'New Loan Amount'),
              Fields.numberInput('housePurchase.decoupling.loanInterestRate', 'Interest Rate % p.a.', { step: '0.01', placeholder: '3.5' }),
              Fields.numberInput('housePurchase.decoupling.loanTenureYears', 'Loan Tenure (yrs)', { placeholder: '25' })
            ]));
            if (ds.loanExceedsLtv) {
              card.appendChild(Dom.el('div', { class: 'mt-1', style: 'color:var(--bad);font-weight:600;font-size:11px' }, ['⚠ New Loan Amount exceeds the LTV limit above.']));
            }
            card.appendChild(Dom.el('div', { style: 'font-weight:700;font-size:11.5px;margin:12px 0 8px' }, ['New Monthly Mortgage (' + Dom.fmtMoney(ds.newMonthlyMortgage) + ')']));
            card.appendChild(Dom.el('div', { class: 'input-row' }, [
              Fields.moneyInput('housePurchase.decoupling.monthlyCpfAmount', 'Paid via CPF OA ($/mo)'),
              Dom.el('div', { class: 'field' }, [
                Dom.el('label', { class: 'field-label' }, ['Paid via Cash ($/mo)']),
                Dom.el('div', { class: 'input-prefix' }, [Dom.el('span', {}, ['S$']), Dom.el('input', { type: 'text', value: Dom.fmtMoney(ds.newMonthlyCash).replace('S$', ''), disabled: true })])
              ])
            ]));
            card.appendChild(Dom.el('div', { class: 'text-tertiary mt-1 mb-2' }, [
              'This replaces the old mortgage on Net Worth → Mortgage Details entirely, same as a fresh House Purchase would.'
            ]));
          }

          card.appendChild(Dom.el('div', { style: 'font-weight:700;font-size:11.5px;margin:12px 0 8px' }, [(ds.financeMode === 'Loan' ? 'Remaining Shortfall ' : 'Upfront Cash/CPF ') + '(' + Dom.fmtMoney(ds.shortfall) + ')']));
          card.appendChild(Dom.el('div', { class: 'input-row' }, [
            Fields.numberInput('housePurchase.decoupling.cashPortionPct', 'Cash Portion %', { step: '1', placeholder: '0' })
          ]));
          card.appendChild(Dom.el('div', { class: 'text-tertiary mt-1 mb-2' }, [
            'Currently: ' + Dom.fmtMoney(ds.cashPortion) + ' cash + ' + Dom.fmtMoney(ds.cpfPortion) + ' from CPF OA. Defaults to fully CPF-funded.'
          ]));
          card.appendChild(Dom.el('div', { class: 'text-secondary' }, [
            'Rental income once sole owner: enter it directly on Cashflow → Income → Rental Income — the same field the rest of the app already reads everywhere (Dashboard, Retirement, Roadmap).'
          ]));
        } else {
          card.appendChild(Dom.el('div', { style: 'font-weight:700;font-size:11.5px;margin:12px 0 8px' }, ['CPF Refund (from CPF Board, incl. accrued interest)']));
          card.appendChild(Dom.el('div', { class: 'input-row' }, [
            Fields.moneyInput('housePurchase.decoupling.cpfRefundAmount', 'CPF Refund Amount')
          ]));
          card.appendChild(Dom.el('div', { class: 'text-tertiary mt-1' }, [
            'Request this exact figure from CPF Board before the transaction — it’s the OA/SA originally used for the share being sold, plus accrued interest, and is clawed back from the sale proceeds automatically. Net cash to you: ' + Dom.fmtMoney(ds.netCashToSeller) + ' (' + Dom.fmtMoney(ds.transferValue) + ' transfer value − ' + Dom.fmtMoney(ds.cpfRefund) + ' CPF refund).'
          ]));
        }

        card.appendChild(Dom.el('div', { class: 'mt-3 pt-2', style: 'border-top:1px solid var(--border)' }, [
          Dom.el('div', { class: 'text-secondary', style: 'line-height:1.7' }, [
            role === 'Buying'
              ? ('✓ CPF → a one-time OA withdrawal of ' + Dom.fmtMoney(ds.cpfPortion) + ' at age ' + (txAge != null ? txAge : '—') + '.')
              : ('✓ CPF → a one-time OA refund credit of ' + Dom.fmtMoney(ds.cpfRefund) + ' at age ' + (txAge != null ? txAge : '—') + '.'),
            Dom.el('br'),
            '✓ Cash Flow Roadmap → a one-off "' + (role === 'Buying' ? 'Property Share Purchase — Lump Sum' : 'Property Share Sale — Net Proceeds') + '" ' + (role === 'Buying' ? 'outflow' : 'inflow') + ' of ' + Dom.fmtMoney(role === 'Buying' ? ds.cashPortion : ds.netCashToSeller) + ' at age ' + (txAge != null ? txAge : '—') + '.',
            (role === 'Buying' && ds.financeMode === 'Loan') ? Dom.el('br') : null,
            (role === 'Buying' && ds.financeMode === 'Loan') ? ('✓ Net Worth → Mortgage Details: Monthly Payment (Cash) = ' + Dom.fmtMoney(ds.newMonthlyCash) + ', Monthly Payment (CPF/OA) = ' + Dom.fmtMoney(ds.newMonthlyCpf) + ', Loan Tenure = ' + ds.loanTenureYears + ' yrs, Interest Rate = ' + ds.loanInterestRate + '% (only while no main House Purchase is also active on this file).') : null
          ].filter(Boolean))
        ]));
      } else {
        card.appendChild(Dom.el('div', { class: 'text-tertiary mt-2' }, ['Enter a Current Property Market Value and Share Being Transferred % above to activate this.']));
      }
      container.appendChild(card);
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

    function kpiMini(label, value, caption, accent) {
      var children = [Dom.el('div', { class: 'kpi-label' }, [label]), Dom.el('div', { class: 'kpi-value' }, [value])];
      if (caption) children.push(Dom.el('div', { class: 'text-tertiary mt-1' }, [caption]));
      return Dom.el('div', { class: 'card kpi-card' + (accent ? ' kpi-accent-' + accent : '') }, children);
    }

    // Clearing housePurchase alone (which the subscription in app.js
    // reacts to) already strips the auto Cashflow item and Roadmap event
    // it created, since those have an "inactive -> remove" branch. Net
    // Worth's Mortgage Details and CPF's Future Home Purchase fields
    // don't — this page always force-overwrites them while active, so
    // once cleared here they'd otherwise linger as stale, unexplained
    // figures nothing on screen still accounts for. Clearing them here,
    // explicitly, only on this one confirmed user action, avoids also
    // wiping them on every ordinary edit (e.g. an advisor who sets CPF's
    // Future Home Purchase fields directly, without using this page).
    function clearAll() {
      Store.set('housePurchase', {});
      Store.set('liabilities.mortgageDetails.monthlyCash', 0);
      Store.set('liabilities.mortgageDetails.monthlyCPF', 0);
      Store.set('liabilities.mortgageDetails.tenureYears', 0);
      Store.set('liabilities.mortgageDetails.interestRate', 0);
      Store.set('cpf.homePurchaseAge', '');
      Store.set('cpf.homePurchaseDownpaymentOA', 0);
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

  // Age the client reaches in the Decoupling section's stated Transaction
  // Year — same mechanic as housePurchaseAge above, for the separate
  // "Transfer of Property Share" event.
  function decouplingAge(c) {
    var d = ((c.housePurchase || {}).decoupling) || {};
    var transactionYear = Calc.num(d.transactionYear);
    if (!transactionYear) return null;
    var currentAge = Calc.ageFromDob((c.personal || {}).dob) || Calc.num((c.retirement || {}).currentAge);
    if (!currentAge) return null;
    var currentYear = new Date().getFullYear();
    return currentAge + (transactionYear - currentYear);
  }

  return { title: 'House Purchase', render: render, housePurchaseAge: housePurchaseAge, decouplingAge: decouplingAge };
})();
