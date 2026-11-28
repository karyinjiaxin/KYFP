/* ============================================================
   scenarios.js — Scenario Planning module
   A client-facing, step-through walkthrough: starts from a "do
   nothing — work until retirement" baseline, then layers in
   whatever scenarios the advisor and client want to explore
   together (buying a house, retiring early, a sabbatical, or any
   other custom life event), one at a time, cumulatively. Finishes
   with recommendations addressing the shortfall the last scenario
   shown leaves.

   Scenario steps are stored per-client (so the work isn't lost
   switching pages) under c.scenarioPlanning.steps, but this is
   INERT data — no other page reads it. Each step's effect is
   computed on an in-memory clone of the client record, mirroring
   exactly what the real House Purchase/Roadmap sync logic would do
   for real data (see app.js's syncHousePurchaseImpl and
   Calc.roadmapProjection's lifeEvents handling), so the advisor can
   freely explore "what if" scenarios without any risk to the
   client's actual saved plan.
   ============================================================ */

var ModuleScenarios = (function () {
  var STEP_TYPES = [
    { key: 'housePurchase', label: 'House Purchase' },
    { key: 'earlyRetirement', label: 'Change Retirement Age' },
    { key: 'lifeEvent', label: 'Life Event (sabbatical, bonus, custom…)' }
  ];
  var STEP_TYPE_LABEL = {};
  STEP_TYPES.forEach(function (t) { STEP_TYPE_LABEL[t.key] = t.label; });

  function defaultParamsFor(type, c) {
    var currentAge = Calc.ageFromDob((c.personal || {}).dob) || Calc.num((c.retirement || {}).currentAge) || 30;
    var retirementAge = Calc.num((c.retirement || {}).retirementAge) || 55;
    if (type === 'housePurchase') {
      var hp = c.housePurchase || {};
      return {
        purchasePrice: Calc.num(hp.purchasePrice) || 800000,
        downpaymentCashPct: hp.downpaymentCashPct != null && hp.downpaymentCashPct !== '' ? hp.downpaymentCashPct : 5,
        loanTenureYears: Calc.num(hp.loanTenureYears) || 25,
        interestRate: hp.interestRate != null && hp.interestRate !== '' ? hp.interestRate : 2.6,
        purchaseYear: Calc.num(hp.purchaseYear) || (new Date().getFullYear() + 1)
      };
    }
    if (type === 'earlyRetirement') {
      return { retirementAge: Math.max(30, retirementAge - 5) };
    }
    return { startAge: currentAge + 5, durationYears: 1, incomeEffect: 'None', incomeReducePct: 0, direction: 'Outflow', amount: 0 };
  }

  // ---- Pure, in-memory scenario math (never touches Store) ----

  // Same clean slate Calc.roadmapProjection's own opts.baseline produces —
  // no life events, no house purchase — but also zeroes out the
  // mortgage/CPF side-effects a REAL active House Purchase would already
  // have synced into this client's actual data, since the scenario
  // walkthrough always starts from "as if none of this had happened yet"
  // regardless of what's really been entered elsewhere.
  function buildBaselineClient(c) {
    var working = JSON.parse(JSON.stringify(c));
    working.roadmap = Object.assign({}, working.roadmap, { lifeEvents: [] });
    working.housePurchase = Object.assign({}, working.housePurchase, { includeInPlan: false });
    working.cashflowCategories = (working.cashflowCategories || []).map(function (cat) {
      return Object.assign({}, cat, { items: (cat.items || []).filter(function (item) { return !item.autoHousePurchase; }) });
    });
    working.liabilities = Object.assign({}, working.liabilities, {
      mortgageDetails: Object.assign({}, (working.liabilities || {}).mortgageDetails, { monthlyCash: 0, monthlyCPF: 0, tenureYears: 0, interestRate: 0 })
    });
    working.cpf = Object.assign({}, working.cpf, { homePurchaseAge: '', homePurchaseDownpaymentOA: 0 });
    return working;
  }

  // Mirrors app.js's syncHousePurchaseImpl, but writes onto the in-memory
  // clone instead of Store — same three effects (mortgage liability,
  // cashflow mortgage item, roadmap upfront-cash life event, CPF OA
  // downpayment), computed from this step's OWN params rather than the
  // real House Purchase page, so a hypothetical scenario never depends on
  // (or alters) what's actually entered there.
  function applyHousePurchaseStep(working, step) {
    var p = step.params || {};
    working.housePurchase = Object.assign({}, working.housePurchase, {
      includeInPlan: true,
      purchasePrice: Calc.num(p.purchasePrice),
      downpaymentCashPct: p.downpaymentCashPct,
      loanTenureYears: p.loanTenureYears,
      interestRate: p.interestRate,
      purchaseYear: p.purchaseYear
    });
    var s = Calc.housePurchaseSummary(working);
    var purchaseAge = window.ModuleHousePurchase ? window.ModuleHousePurchase.housePurchaseAge(working) : null;
    working.liabilities = Object.assign({}, working.liabilities, {
      mortgageDetails: { monthlyCash: s.monthlyCash, monthlyCPF: s.monthlyCpf, tenureYears: s.tenureYears, interestRate: s.interestRate }
    });
    var cats = (working.cashflowCategories || []).map(function (cat) { return Object.assign({}, cat, { items: (cat.items || []).slice() }); });
    var homeCat = cats.filter(function (cat) { return cat.id === 'home'; })[0];
    if (!homeCat) { homeCat = { id: 'home', name: 'Home', bucket: 'Bills', items: [] }; cats.push(homeCat); }
    homeCat.items.push({ id: Dom.uid('item'), name: (step.label || 'House Purchase') + ' — Mortgage', cost: Math.round(s.monthlyCash * 100) / 100, frequency: 'Monthly', autoHousePurchase: true });
    working.cashflowCategories = cats;
    if (purchaseAge != null) {
      var events = (working.roadmap.lifeEvents || []).slice();
      events.push({ name: (step.label || 'House Purchase') + ' — Upfront Cash', age: purchaseAge, amount: Math.round(s.totalUpfrontCash * 100) / 100, direction: 'Outflow', durationYears: 1 });
      working.roadmap = Object.assign({}, working.roadmap, { lifeEvents: events });
      working.cpf = Object.assign({}, working.cpf, { homePurchaseAge: purchaseAge, homePurchaseDownpaymentOA: Math.round(s.downpaymentCpf * 100) / 100 });
    }
    return working;
  }

  function applyStep(working, step) {
    if (step.type === 'housePurchase') return applyHousePurchaseStep(working, step);
    if (step.type === 'earlyRetirement') {
      working.retirement = Object.assign({}, working.retirement, { retirementAge: Calc.num((step.params || {}).retirementAge) });
      return working;
    }
    // lifeEvent — same shape Cash Flow Roadmap's own Life Events use
    // (name/age/amount/durationYears/direction/incomeEffect/incomeReducePct),
    // so it's handled by exactly the same engine code, just on the clone.
    var p = step.params || {};
    var events = (working.roadmap.lifeEvents || []).slice();
    events.push({
      name: step.label || 'Life Event',
      age: Calc.num(p.startAge),
      amount: Calc.num(p.amount) || 0,
      durationYears: Math.max(1, Calc.num(p.durationYears) || 1),
      direction: p.direction || 'Outflow',
      incomeEffect: p.incomeEffect && p.incomeEffect !== 'None' ? p.incomeEffect : '',
      incomeReducePct: Calc.num(p.incomeReducePct)
    });
    working.roadmap = Object.assign({}, working.roadmap, { lifeEvents: events });
    return working;
  }

  // Builds the ordered list of walkthrough "views": Baseline, then one
  // view per enabled step (each cumulative on the one before it), then a
  // final Recommendations view built off the fully-stacked scenario.
  function buildViews(c, enabledSteps) {
    var baseClient = buildBaselineClient(c);
    var baselineRows = Calc.roadmapProjection(baseClient);
    var views = [{ kind: 'baseline', title: 'Baseline — Do Nothing, Work Until Retirement', client: baseClient, rows: baselineRows, prevRows: null }];
    var working = baseClient;
    var prevRows = baselineRows;
    enabledSteps.forEach(function (step) {
      working = applyStep(JSON.parse(JSON.stringify(working)), step);
      var rows = Calc.roadmapProjection(working);
      views.push({ kind: 'step', step: step, title: step.label || ('+ ' + (STEP_TYPE_LABEL[step.type] || 'Scenario')), client: working, rows: rows, prevRows: prevRows });
      prevRows = rows;
    });
    views.push({ kind: 'recommendations', title: '✨ How Our Tools Can Help', client: working, rows: prevRows, prevRows: null });
    return views;
  }

  // ---- UI ----

  function render(container) {
    var viewIndex = 0; // which walkthrough card is showing — local to this page visit, resets when navigating away and back

    function kpiTile(label, value, accent) {
      return Dom.el('div', { class: 'card kpi-card' + (accent ? ' kpi-accent-' + accent : '') }, [
        Dom.el('div', { class: 'kpi-label' }, [label]),
        Dom.el('div', { class: 'kpi-value' }, [value])
      ]);
    }

    function stepTypeFields(step, idx) {
      var base = 'scenarioPlanning.steps.' + idx + '.params.';
      if (step.type === 'housePurchase') {
        return Dom.el('div', {}, [
          Dom.el('div', { class: 'input-row compact-row mt-2' }, [
            Fields.moneyInput(base + 'purchasePrice', 'Purchase Price'),
            Fields.numberInput(base + 'purchaseYear', 'Year of Purchase'),
            Fields.numberInput(base + 'downpaymentCashPct', 'Cash Downpayment %', { step: '0.5' })
          ]),
          Dom.el('div', { class: 'input-row compact-row mt-2' }, [
            Fields.numberInput(base + 'loanTenureYears', 'Loan Tenure (years)'),
            Fields.numberInput(base + 'interestRate', 'Interest Rate %', { step: '0.1' })
          ])
        ]);
      }
      if (step.type === 'earlyRetirement') {
        return Dom.el('div', { class: 'input-row compact-row mt-2' }, [
          Fields.numberInput(base + 'retirementAge', 'New Retirement Age')
        ]);
      }
      // lifeEvent
      var incomeEffect = (step.params || {}).incomeEffect || 'None';
      var wrap = Dom.el('div', {});
      wrap.appendChild(Dom.el('div', { class: 'input-row compact-row mt-2' }, [
        Fields.numberInput(base + 'startAge', 'Starts At Age'),
        Fields.numberInput(base + 'durationYears', 'Duration (years)'),
        Fields.selectInput(base + 'incomeEffect', 'Income During This Period', ['None', 'Stop Work', 'Reduce Pay'])
      ]));
      if (incomeEffect === 'Reduce Pay') {
        wrap.appendChild(Dom.el('div', { class: 'input-row compact-row mt-2' }, [
          Fields.numberInput(base + 'incomeReducePct', 'Reduce Pay By %', { step: '1' })
        ]));
      }
      wrap.appendChild(Dom.el('div', { class: 'input-row compact-row mt-2' }, [
        Fields.selectInput(base + 'direction', 'Cash Effect', ['Outflow', 'Inflow']),
        Fields.moneyInput(base + 'amount', 'Amount Per Year')
      ]));
      wrap.appendChild(Dom.el('div', { class: 'text-tertiary mt-2' }, [
        'Use this for a sabbatical (Stop Work for the Duration), a career break with reduced pay, a one-off windfall/expense (Duration 1 year), or any other custom cash flow change — whatever the client wants to explore.'
      ]));
      return wrap;
    }

    function stepCard(step, idx) {
      var card = Dom.el('div', { class: 'card mb-2 compact-fields' });
      card.appendChild(Dom.el('div', { class: 'flex items-center justify-between gap-2 mb-2' }, [
        Dom.el('div', { class: 'flex items-center gap-2' }, [
          Dom.el('label', { style: 'display:flex;align-items:center;gap:6px;cursor:pointer' }, [
            Dom.el('input', {
              type: 'checkbox', checked: step.enabled !== false ? 'checked' : null,
              onchange: function (e) {
                var arr = Store.get('scenarioPlanning.steps');
                arr[idx].enabled = e.target.checked;
                Store.set('scenarioPlanning.steps', arr);
              }
            }),
            Dom.el('span', { class: 'text-tertiary', style: 'font-size:10.5px;font-weight:700;text-transform:uppercase' }, [STEP_TYPE_LABEL[step.type] || step.type])
          ])
        ]),
        Dom.el('button', {
          class: 'btn btn-ghost btn-sm', onclick: function () {
            var arr = Store.get('scenarioPlanning.steps'); arr.splice(idx, 1); Store.set('scenarioPlanning.steps', arr);
          }
        }, ['Remove'])
      ]));
      card.appendChild(Fields.textInput('scenarioPlanning.steps.' + idx + '.label', 'Scenario Name', { placeholder: STEP_TYPE_LABEL[step.type] }));
      card.appendChild(stepTypeFields(step, idx));
      return card;
    }

    function stepsEditor(steps) {
      var wrap = Dom.el('div', {});
      steps.forEach(function (step, idx) { wrap.appendChild(stepCard(step, idx)); });
      var addRow = Dom.el('div', { class: 'flex gap-2 mt-2 mb-3' });
      STEP_TYPES.forEach(function (t) {
        addRow.appendChild(Dom.el('button', {
          class: 'btn btn-secondary btn-sm', onclick: function () {
            var c = Store.getAll();
            var arr = Store.get('scenarioPlanning.steps') || [];
            arr.push({ id: Dom.uid('scn'), enabled: true, type: t.key, label: '', params: defaultParamsFor(t.key, c) });
            Store.set('scenarioPlanning.steps', arr);
          }
        }, ['+ ' + t.label]));
      });
      wrap.appendChild(addRow);
      return wrap;
    }

    function describeDelta(view) {
      if (view.kind === 'baseline') {
        return 'If nothing changes and the client simply continues working until their planned retirement age, with no home purchase and no other life events.';
      }
      if (view.kind === 'recommendations') return null;
      var step = view.step;
      if (step.type === 'housePurchase') {
        var p = step.params || {};
        return 'Adds a home purchase of ' + Dom.fmtMoney(Calc.num(p.purchasePrice)) + ' in ' + Calc.num(p.purchaseYear) + ', on top of everything shown so far.';
      }
      if (step.type === 'earlyRetirement') {
        return 'Changes the retirement age to ' + Calc.num((step.params || {}).retirementAge) + ', on top of everything shown so far.';
      }
      var lp = step.params || {};
      var effect = lp.incomeEffect === 'Stop Work' ? 'stops work entirely'
        : lp.incomeEffect === 'Reduce Pay' ? ('reduces pay by ' + Calc.num(lp.incomeReducePct) + '%')
          : ((lp.direction === 'Inflow' ? 'an inflow of ' : 'an outflow of ') + Dom.fmtMoney(Calc.num(lp.amount)) + '/year');
      return 'From age ' + Calc.num(lp.startAge) + ' for ' + Math.max(1, Calc.num(lp.durationYears) || 1) + ' year(s), ' + effect + ', on top of everything shown so far.';
    }

    function walkthroughCard(views) {
      var view = views[viewIndex];
      var wrap = Dom.el('div', { class: 'card' });
      wrap.appendChild(Dom.el('div', { class: 'flex items-center justify-between mb-2' }, [
        Dom.el('div', { class: 'text-tertiary', style: 'font-size:11px;font-weight:700' }, ['STEP ' + (viewIndex + 1) + ' OF ' + views.length]),
        Dom.el('div', { class: 'flex gap-2' }, [
          Dom.el('button', { class: 'btn btn-secondary btn-sm', disabled: viewIndex === 0 ? 'disabled' : null, onclick: function () { viewIndex = Math.max(0, viewIndex - 1); draw(); } }, ['← Back']),
          Dom.el('button', { class: 'btn btn-primary btn-sm', disabled: viewIndex === views.length - 1 ? 'disabled' : null, onclick: function () { viewIndex = Math.min(views.length - 1, viewIndex + 1); draw(); } }, ['Next →'])
        ])
      ]));
      wrap.appendChild(Dom.el('div', { style: 'font-size:14px;font-weight:700;margin-bottom:4px' }, [view.title]));
      var delta = describeDelta(view);
      if (delta) wrap.appendChild(Dom.el('div', { class: 'text-secondary mb-3', style: 'line-height:1.5' }, [delta]));

      if (view.kind === 'recommendations') {
        var recs = AI.getRecommendations(view.client);
        wrap.appendChild(Dom.el('div', { class: 'text-secondary mb-2' }, ['Based on the fully-stacked scenario just shown, here’s how our tools and recommendations can help close any remaining gap:']));
        var aiPanel = Dom.el('div', { class: 'ai-panel' });
        recs.forEach(function (r) {
          aiPanel.appendChild(Dom.el('div', { class: 'ai-rec' }, [
            Dom.el('div', { class: 'ai-dot ' + r.severity }),
            Dom.el('div', {}, [
              Dom.el('div', { style: 'font-weight:700;font-size:12px' }, [r.title]),
              Dom.el('div', { class: 'text-secondary', style: 'margin-top:2px' }, [r.detail])
            ])
          ]));
        });
        wrap.appendChild(aiPanel);
        return wrap;
      }

      var rows = view.rows;
      var retirementAge = Calc.num((view.client.retirement || {}).retirementAge);
      var atRetirement = rows.filter(function (r) { return r.age === retirementAge; })[0] || rows[rows.length - 1];
      var lowest = rows.reduce(function (min, r) { return r.balance < min.balance ? r : min; }, rows[0] || { balance: 0, age: 0 });
      var rp = Calc.retirementProjection(view.client);
      wrap.appendChild(Dom.el('div', { class: 'grid grid-kpi mb-3' }, [
        kpiTile('Balance at Retirement', Dom.fmtMoney(atRetirement ? atRetirement.balance : 0), 'blue'),
        kpiTile('Lowest Balance (age ' + (lowest ? lowest.age : '—') + ')', Dom.fmtMoney(lowest ? lowest.balance : 0), (lowest && lowest.balance < 0) ? 'red' : 'green'),
        kpiTile('Required Portfolio', Dom.fmtMoney(rp.requiredPortfolio), 'violet'),
        kpiTile('Success Probability', rp.successProbability.toFixed(0) + '%', rp.successProbability >= 70 ? 'green' : 'red')
      ]));

      wrap.appendChild(Dom.el('div', { class: 'card-title' }, ['Savings Balance Over Time']));
      wrap.appendChild(Dom.el('div', { class: 'chart-wrap tall' }, [Dom.el('canvas', { id: 'scenarioWalkthroughChart' })]));

      requestAnimationFrame(function () {
        var canvas = document.getElementById('scenarioWalkthroughChart');
        if (!canvas) return;
        var t = Charts.themeColors();
        var datasets = [{ label: view.title, data: rows.map(function (r) { return r.balance; }), borderColor: t.palette[3], backgroundColor: 'transparent', tension: 0.2 }];
        if (view.prevRows) {
          datasets.unshift({ label: 'Previous step', data: view.prevRows.map(function (r) { return r.balance; }), borderColor: t.palette[1], backgroundColor: 'transparent', tension: 0.2, borderDash: [6, 4] });
        }
        Charts.render(canvas, { type: 'line', data: { labels: rows.map(function (r) { return r.age; }), datasets: datasets } });
      });

      return wrap;
    }

    function draw() {
      var c = Store.getAll();
      container.innerHTML = '';
      container.appendChild(Dom.el('div', { class: 'page-header' }, [
        Dom.el('h1', {}, ['Scenario Planning']),
        Dom.el('div', { class: 'sub' }, ['Show the client how their cash flow roadmap plays out — starting from doing nothing, then layering in the choices they’re actually weighing. None of this touches their real Roadmap, House Purchase or Retirement data.'])
      ]));

      var steps = Store.get('scenarioPlanning.steps') || [];
      container.appendChild(Dom.el('div', { class: 'section-title', style: 'margin-top:0' }, ['🧱 Scenario Steps']));
      if (steps.length === 0) {
        container.appendChild(Dom.el('div', { class: 'card empty-state mb-2' }, ['No scenarios added yet — add one below based on what the client wants to explore.']));
      }
      container.appendChild(stepsEditor(steps));

      var enabledSteps = steps.filter(function (s) { return s.enabled !== false; });
      var views = buildViews(c, enabledSteps);
      if (viewIndex > views.length - 1) viewIndex = views.length - 1;
      if (viewIndex < 0) viewIndex = 0;

      container.appendChild(Dom.el('div', { class: 'section-title' }, ['🎬 Walkthrough']));
      container.appendChild(walkthroughCard(views));
    }

    draw();
    return Store.subscribe('*', Dom.debounce(function () { Dom.withFocusPreserved(container, draw); }, 30));
  }

  return { title: 'Scenario Planning', render: render };
})();
