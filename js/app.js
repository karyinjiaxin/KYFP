/* ============================================================
   app.js — bootstrap
   ============================================================ */

var App = (function () {
  var THEME_KEY = 'wealthPlatform.theme';

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
    // re-render current route so charts pick up new theme colors
    if (Router.current()) { try { window.dispatchEvent(new Event('hashchange')); } catch (e) {} }
  }

  function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
    setTheme(saved || 'light');
  }

  function updateTopbar() {
    var c = Store.getAll();
    var name = (c.personal || {}).name || 'Client';
    var initials = name.split(' ').map(function (n) { return n[0]; }).slice(0, 2).join('').toUpperCase();
    document.getElementById('topClientInitials').textContent = initials || '—';
    document.getElementById('topClientName').textContent = name;
    document.getElementById('topClientMeta').textContent = (c.personal || {}).occupation || '';
  }

  // Retirement Planning's "Current Age" is derived from Client Profile's
  // date of birth wherever one is set, rather than a separately-typed
  // number that can drift out of sync. This keeps the underlying stored
  // value (which every retirement/CPF calculation reads directly) in
  // sync with the profile, not just what's displayed on one page.
  function syncCurrentAgeFromDob() {
    var dob = Store.get('personal.dob');
    var age = Calc.ageFromDob(dob);
    if (age !== null && Store.get('retirement.currentAge') !== age) {
      Store.set('retirement.currentAge', age);
    }
  }

  // Keeps any cashflow line item tagged autoCpf: true in sync with the
  // client's employment status, salary, and age — so switching Employment
  // Status on Client Profile (or editing salary) automatically updates the
  // CPF Contribution amount that feeds Bank Account Buckets' Leftover,
  // rather than requiring a manual edit that can drift out of date.
  function syncAutoCpf() {
    var cats = Store.get('cashflowCategories');
    if (!Array.isArray(cats)) return;
    var computed = Math.round(Calc.autoCpfContribution(Store.getAll()) * 100) / 100;
    var changed = false;
    var next = JSON.parse(JSON.stringify(cats));
    next.forEach(function (cat) {
      (cat.items || []).forEach(function (item) {
        if (item.autoCpf) {
          if (item.cost !== computed || item.frequency !== 'Monthly') {
            item.cost = computed;
            item.frequency = 'Monthly';
            changed = true;
          }
        }
      });
    });
    if (changed) Store.set('cashflowCategories', next);
  }

  // Keeps income.bonus in sync with income.bonusMonths × Salary whenever
  // Cashflow's "Bonus (No. of Months)" field (a Singapore-common way to
  // state a bonus, e.g. "2 months AWS") has a value — income.bonus itself
  // stays the one figure every other calculation (Monthly Income, Income
  // Tax, etc.) actually reads, so nothing downstream needs to know which
  // of the two Bonus fields produced it. Left alone whenever Months is 0,
  // where income.bonus is typed directly into the Lump Sum field instead.
  function syncBonusFromMonths() {
    var income = Store.get('income');
    if (!income || !Calc.num(income.bonusMonths)) return;
    var computed = Math.round(Calc.num(income.bonusMonths) * Calc.num(income.salary) * 100) / 100;
    if (income.bonus !== computed) Store.set('income.bonus', computed);
  }

  // Keeps any cashflow line item tagged autoIncomeTax: true in sync with
  // the client's income, reliefs, and parenthood rebate — same pattern
  // as syncAutoCpf above, using the same Calc.estimatedNetIncomeTax the
  // Tax Planning page itself displays, so the two can never disagree.
  // Net income tax is an annual figure; the monthly line item shows it
  // spread evenly across the year rather than as one annual lump —
  // consistent with every other Cashflow item being monthly.
  function syncAutoIncomeTax() {
    var cats = Store.get('cashflowCategories');
    if (!Array.isArray(cats)) return;
    var computed = Math.round((Calc.estimatedNetIncomeTax(Store.getAll()) / 12) * 100) / 100;
    var changed = false;
    var next = JSON.parse(JSON.stringify(cats));
    next.forEach(function (cat) {
      (cat.items || []).forEach(function (item) {
        if (item.autoIncomeTax) {
          if (item.cost !== computed || item.frequency !== 'Monthly') {
            item.cost = computed;
            item.frequency = 'Monthly';
            changed = true;
          }
        }
      });
    });
    if (changed) Store.set('cashflowCategories', next);
  }

  // Keeps Cash Flow Roadmap's "Expenses That Stop" automatically populated
  // for two cases an advisor shouldn't have to notice and configure by
  // hand: the auto-synced Income Tax item (which no longer applies once
  // the client stops earning employment income) stops at Retirement Age;
  // and any Cashflow item loaded from Insurance Coverage via "Load
  // Premiums from Insurance" (tracked by insurancePolicyId) stops once
  // its policy's own Start Age + Premium Term is reached — a Limited
  // Premium policy really does stop billing then, a Whole-of-Life one
  // (Payment Term left at 0, or Start Age unset) never auto-stops since
  // there's no real end to derive. Entries are tagged `auto` and always
  // kept in sync, same as autoCpf/autoIncomeTax items themselves — not
  // meant to be hand-edited, since the real stop age lives on the source
  // (Retirement Age or the policy's own Premium Term), not here.
  function syncAutoExpenseStops() {
    var c = Store.getAll();
    var cats = c.cashflowCategories;
    if (!Array.isArray(cats)) return;
    var insurance = c.insurance || [];
    var retirementAge = Calc.num((c.retirement || {}).retirementAge) || 65;
    var stops = Store.get('roadmap.expenseStops') || [];
    var next = stops.map(function (es) { return Object.assign({}, es); });
    var changed = false;
    var validSourceIds = { incomeTax: {}, insurancePremium: {}, cpfTopUp: {}, srsContribution: {}, cpfContribution: {} };

    // Tags that stop at Retirement Age for the same reason Income Tax
    // does: all four (the mandatory CPF deduction, CPF voluntary top-up,
    // SRS contribution, and Income Tax itself) are funded out of working
    // income, so none of them keep going once that income does not —
    // "if stop work or retire, match the SRS and CPF contribution stop
    // age to end at the same time" as the client's own target Retirement
    // Age, not a separately guessed one.
    var retirementAgeStopTags = { autoIncomeTax: 'incomeTax', autoCpfTopUp: 'cpfTopUp', autoSrsContribution: 'srsContribution', autoCpf: 'cpfContribution' };

    cats.forEach(function (cat) {
      (cat.items || []).forEach(function (item) {
        var sourceId = cat.id + '.' + item.id;
        var monthlyAmount = Math.round(Calc.itemMonthly(item) * 100) / 100;

        Object.keys(retirementAgeStopTags).forEach(function (tag) {
          if (!item[tag]) return;
          var auto = retirementAgeStopTags[tag];
          validSourceIds[auto][sourceId] = true;
          var existing = next.filter(function (es) { return es.sourceId === sourceId && es.auto === auto; })[0];
          if (!existing) {
            next.push({ sourceId: sourceId, name: item.name, monthlyAmount: monthlyAmount, endAge: retirementAge, auto: auto });
            changed = true;
          } else if (existing.endAge !== retirementAge || existing.monthlyAmount !== monthlyAmount) {
            existing.endAge = retirementAge; existing.monthlyAmount = monthlyAmount;
            changed = true;
          }
        });

        if (item.insurancePolicyId) {
          var policy = insurance.filter(function (p) { return p.id === item.insurancePolicyId; })[0];
          var startAge = policy ? Calc.num(policy.startAge) : 0;
          var term = policy ? Calc.num(policy.paymentTerm) : 0;
          if (policy && startAge && term) {
            validSourceIds.insurancePremium[sourceId] = true;
            var endAge = startAge + term;
            var existingPrem = next.filter(function (es) { return es.sourceId === sourceId && es.auto === 'insurancePremium'; })[0];
            if (!existingPrem) {
              next.push({ sourceId: sourceId, name: item.name, monthlyAmount: monthlyAmount, endAge: endAge, auto: 'insurancePremium' });
              changed = true;
            } else if (existingPrem.endAge !== endAge || existingPrem.monthlyAmount !== monthlyAmount) {
              existingPrem.endAge = endAge; existingPrem.monthlyAmount = monthlyAmount;
              changed = true;
            }
          }
        }
      });
    });

    // Drop an auto entry whose source no longer qualifies — the item was
    // deleted, un-tagged, unlinked from its policy, or the policy became
    // Whole-of-Life (Payment Term cleared back to 0).
    var filtered = next.filter(function (es) {
      if (validSourceIds[es.auto]) return !!validSourceIds[es.auto][es.sourceId];
      return true;
    });
    if (filtered.length !== next.length) { next = filtered; changed = true; }

    if (changed) Store.set('roadmap.expenseStops', next);
  }

  // Keeps Tax Planning's "CPF Relief" and "Earned Income Relief" figures
  // correct automatically — both are legally tied to actual CPF
  // contributions and earned income, so leaving them as independently
  // typed numbers let them silently drift out of sync with the real
  // employment status / salary (e.g. switching to Self-Employed changes
  // the real CPF relief basis from OA/SA/MA to MediSave-only, but a
  // manually-typed number wouldn't know that).
  function syncAutoReliefs() {
    var c = Store.getAll();
    var reliefs = (c.tax || {}).reliefs;
    if (!reliefs) return;
    var status = (c.personal || {}).employmentStatus;
    var autoEarned = Math.round(Calc.autoEarnedIncomeRelief(c) * 100) / 100;
    if (reliefs.earnedIncome !== autoEarned) Store.set('tax.reliefs.earnedIncome', autoEarned);
    // CPF Relief only auto-syncs for Full/Part-Time Employed — Self-Employed
    // and Unemployed keep it as a manually fillable field (self-employed
    // relief follows separate MediSave-based rules), so don't clobber
    // whatever the advisor typed there.
    if (status !== 'Self-Employed' && status !== 'Unemployed') {
      var autoCpf = Math.round(Calc.autoCpfContribution(c) * 12 * 100) / 100;
      if (reliefs.cpfRelief !== autoCpf) Store.set('tax.reliefs.cpfRelief', autoCpf);
    }
  }

  // Links CPF's voluntary top-ups and Tax Planning's SRS Contribution
  // Relief to both Cashflow and each other, instead of three independently
  // typed numbers that can silently drift apart:
  //  1) CPF's "Voluntary Contribution to SA" is the real-world way an
  //     RSTU cash top-up is entered — that's specifically what earns CPF
  //     Cash Top-up Relief (the general Voluntary Contribution Scheme —
  //     "to All Accounts" / "to MA" — doesn't), so it auto-populates Tax
  //     Planning's CPF Cash Top-up Relief, capped at S$8,000 (the self
  //     cap; this app doesn't separately track a family top-up, so the
  //     further S$8,000 family cap isn't modelled here).
  //  2) The full CPF top-up (All Accounts + SA + MA combined — real cash
  //     leaving the client either way, relief-eligible or not) and the
  //     SRS contribution (Tax Planning's own relief field, which IS the
  //     contribution amount) each get their own auto-managed Cashflow
  //     line item in the "Investment" category, same create-when-active/
  //     remove-when-zero pattern as House Purchase's mortgage item below.
  var syncingCpfTopUpLinks = false;
  function syncCpfTopUpLinks() {
    if (syncingCpfTopUpLinks) return;
    syncingCpfTopUpLinks = true;
    try { syncCpfTopUpLinksImpl(); } finally { syncingCpfTopUpLinks = false; }
  }
  function syncCpfTopUpLinksImpl() {
    var c = Store.getAll();
    var cpfData = c.cpf || {};

    // 1) CPF "to SA" -> Tax Planning's CPF Cash Top-up Relief
    var reliefTarget = Math.round(Math.min(Calc.num(cpfData.voluntarySA), 8000) * 100) / 100;
    if (Calc.num((c.tax || {}).reliefs && c.tax.reliefs.cpfCashTopUp) !== reliefTarget) {
      Store.set('tax.reliefs.cpfCashTopUp', reliefTarget);
    }

    // 2) Cashflow auto items, in the "investment" category
    var cats = Store.get('cashflowCategories');
    if (!Array.isArray(cats)) return;
    var nextCats = JSON.parse(JSON.stringify(cats));
    var investCat = nextCats.filter(function (cat) { return cat.id === 'investment'; })[0];
    var catsChanged = false;

    function syncAutoItem(tag, label, targetMonthly) {
      var existingItem = null;
      nextCats.forEach(function (cat) { (cat.items || []).forEach(function (item) { if (item[tag]) existingItem = item; }); });
      if (targetMonthly > 0) {
        var rounded = Math.round(targetMonthly * 100) / 100;
        if (existingItem) {
          if (existingItem.cost !== rounded || existingItem.frequency !== 'Monthly') {
            existingItem.cost = rounded; existingItem.frequency = 'Monthly'; catsChanged = true;
          }
        } else {
          if (!investCat) { investCat = { id: 'investment', name: 'Investment', bucket: 'Savings', items: [] }; nextCats.push(investCat); }
          var newItem = { id: Dom.uid('item'), name: label, cost: rounded, frequency: 'Monthly' };
          newItem[tag] = true;
          investCat.items.push(newItem);
          catsChanged = true;
        }
      } else if (existingItem) {
        nextCats.forEach(function (cat) { cat.items = (cat.items || []).filter(function (item) { return !item[tag]; }); });
        catsChanged = true;
      }
    }

    var cpfTopUpAnnual = Calc.num(cpfData.voluntaryAllAccounts) + Calc.num(cpfData.voluntarySA) + Calc.num(cpfData.voluntaryMA);
    syncAutoItem('autoCpfTopUp', 'CPF Top-up', cpfTopUpAnnual / 12);
    syncAutoItem('autoSrsContribution', 'SRS Contribution', Calc.num(((c.tax || {}).reliefs || {}).srs) / 12);

    if (catsChanged) Store.set('cashflowCategories', nextCats);
  }

  // Keeps the CPF page's "Monthly OA Deduction for Mortgage" in sync with
  // Net Worth's Mortgage Details, so it's one source of truth rather than
  // two numbers that can silently disagree.
  function syncMortgageCpfDeduction() {
    var monthlyCPF = Store.get('liabilities.mortgageDetails.monthlyCPF');
    if (monthlyCPF != null && Store.get('cpf.monthlyMortgageDeduction') !== monthlyCPF) {
      Store.set('cpf.monthlyMortgageDeduction', monthlyCPF);
    }
  }

  // House Purchase Planning drives three other pages from one computed
  // summary, same "single source of truth" pattern as the syncs above —
  // only while a Purchase Price is actually entered (an unused House
  // Purchase page should touch nothing elsewhere):
  //  1) Net Worth's Mortgage Details (which already feeds CPF via
  //     syncMortgageCpfDeduction above).
  //  2) A dedicated, auto-managed Cashflow line item (same autoCpf/
  //     autoIncomeTax pattern) for the monthly CASH portion of the
  //     mortgage — kept separate from any pre-existing manual
  //     "Mortgage/Rent" entry rather than merging into it, since that
  //     entry might represent a different, unrelated situation (e.g.
  //     current rent before this purchase happens).
  //  3) A one-off Roadmap life event for the total upfront cash needed
  //     (downpayment cash + duties/fees − grants), placed at the
  //     client's age in the stated Year of Purchase.
  // Each piece is found by a stable marker (autoHousePurchase / source:
  // 'housePurchase') and updated in place rather than appended again on
  // every recompute, and is removed if the Purchase Price is cleared.
  // Reentrancy guard: this function makes several sequential Store.set
  // calls (mortgageDetails has 4 fields alone), and each one synchronously
  // re-triggers the broad '*' bundle below — including this same function
  // — before the earlier calls in this same pass have all landed. Without
  // the guard, that reentrant call sees a still-partially-updated state,
  // decides something still needs writing, and writes again, re-triggering
  // another reentrant call before ITS writes land either — an exponential
  // cascade that blows the call stack. The guard makes a re-entrant call
  // during an in-progress pass a no-op; the in-progress pass still runs
  // to completion and leaves everything consistent on its own.
  var syncingHousePurchase = false;
  function syncHousePurchase() {
    if (syncingHousePurchase) return;
    syncingHousePurchase = true;
    try {
      syncHousePurchaseImpl();
    } finally {
      syncingHousePurchase = false;
    }
  }
  function syncHousePurchaseImpl() {
    var c = Store.getAll();
    var hp = c.housePurchase || {};
    // "Include in Plan" lets the advisor temporarily take this scenario
    // out of Net Worth/CPF/Cashflow/Roadmap — e.g. to show "with vs
    // without this purchase" — without losing every field entered, the
    // way the old "Clear All" button did. Defaults true (unset !== false)
    // so existing clients with fields already entered keep syncing.
    var active = Calc.num(hp.purchasePrice) > 0 && hp.includeInPlan !== false;
    var s = active ? Calc.housePurchaseSummary(c) : null;
    var purchaseAge = active && ModuleHousePurchase ? ModuleHousePurchase.housePurchaseAge(c) : null;

    // Interest Rate, Loan Tenure, Cash Portion of Downpayment % and
    // Monthly Mortgage Paid via CPF OA ($) are plain editable fields
    // that fall back to a sensible
    // default whenever left blank — but a blank numeric field on screen
    // just displays "0", not the default actually being used, which reads
    // as a free, instant, 0-year loan funded entirely in cash. Writing the
    // real default in once (the first time a purchase becomes active)
    // makes the field show the true number; it's then a normal editable
    // field from there on, same "auto-fill once" pattern as Net Worth's
    // investment asset auto-fill.
    if (active) {
      if (hp.interestRate == null || hp.interestRate === '') Store.set('housePurchase.interestRate', s.interestRate);
      if (!Calc.num(hp.loanTenureYears)) Store.set('housePurchase.loanTenureYears', s.tenureYears);
      if (hp.downpaymentCashPct == null || hp.downpaymentCashPct === '') Store.set('housePurchase.downpaymentCashPct', s.downpaymentCashPct);
      if (hp.monthlyCpfAmount == null || hp.monthlyCpfAmount === '') Store.set('housePurchase.monthlyCpfAmount', s.monthlyCpf);
    }

    // 1) Mortgage Details -> CPF (via syncMortgageCpfDeduction)
    // Cleared (not just left unwritten) when inactive — either no Purchase
    // Price yet, or deliberately toggled off via "Include in Plan" — so a
    // scenario the advisor excludes doesn't leave a stale mortgage behind
    // that CPF/Net Worth would otherwise keep counting.
    var md = c.liabilities && c.liabilities.mortgageDetails;
    if (active) {
      if (!md || md.monthlyCash !== s.monthlyCash || md.monthlyCPF !== s.monthlyCpf ||
        md.tenureYears !== s.tenureYears || md.interestRate !== s.interestRate) {
        Store.set('liabilities.mortgageDetails.monthlyCash', s.monthlyCash);
        Store.set('liabilities.mortgageDetails.monthlyCPF', s.monthlyCpf);
        Store.set('liabilities.mortgageDetails.tenureYears', s.tenureYears);
        Store.set('liabilities.mortgageDetails.interestRate', s.interestRate);
      }
    } else if (md && (Calc.num(md.monthlyCash) || Calc.num(md.monthlyCPF) || Calc.num(md.tenureYears) || Calc.num(md.interestRate))) {
      Store.set('liabilities.mortgageDetails.monthlyCash', 0);
      Store.set('liabilities.mortgageDetails.monthlyCPF', 0);
      Store.set('liabilities.mortgageDetails.tenureYears', 0);
      Store.set('liabilities.mortgageDetails.interestRate', 0);
    }

    // 1b) One-time CPF OA downpayment -> CPF's own "Future Home Purchase At
    // Age" / "Est. Downpayment From OA" fields, which cpfProjectionFull
    // already withdraws from the OA balance at that exact age — previously
    // unconnected to this page, so the downpayment's CPF portion never
    // showed up as reducing the CPF projection at all. Cleared when
    // inactive for the same reason as Mortgage Details above.
    var cpfData = c.cpf || {};
    if (active && purchaseAge != null) {
      if (cpfData.homePurchaseAge !== purchaseAge || cpfData.homePurchaseDownpaymentOA !== s.downpaymentCpf) {
        Store.set('cpf.homePurchaseAge', purchaseAge);
        Store.set('cpf.homePurchaseDownpaymentOA', s.downpaymentCpf);
      }
    } else if (!active && (cpfData.homePurchaseAge != null && cpfData.homePurchaseAge !== '' || Calc.num(cpfData.homePurchaseDownpaymentOA))) {
      Store.set('cpf.homePurchaseAge', '');
      Store.set('cpf.homePurchaseDownpaymentOA', 0);
    }

    // 2) Cashflow auto item
    var cats = Store.get('cashflowCategories');
    if (Array.isArray(cats)) {
      var nextCats = JSON.parse(JSON.stringify(cats));
      var homeCat = nextCats.filter(function (cat) { return cat.id === 'home'; })[0];
      var existingItem = null;
      nextCats.forEach(function (cat) { (cat.items || []).forEach(function (item) { if (item.autoHousePurchase) existingItem = item; }); });
      var catsChanged = false;
      if (active) {
        var targetCost = Math.round(s.monthlyCash * 100) / 100;
        if (existingItem) {
          if (existingItem.cost !== targetCost || existingItem.frequency !== 'Monthly') {
            existingItem.cost = targetCost; existingItem.frequency = 'Monthly'; catsChanged = true;
          }
        } else {
          if (!homeCat) { homeCat = { id: 'home', name: 'Home', bucket: 'Bills', items: [] }; nextCats.push(homeCat); }
          homeCat.items.push({ id: Dom.uid('item'), name: 'Mortgage (House Purchase)', cost: targetCost, frequency: 'Monthly', autoHousePurchase: true });
          catsChanged = true;
        }
      } else if (existingItem) {
        nextCats.forEach(function (cat) { cat.items = (cat.items || []).filter(function (item) { return !item.autoHousePurchase; }); });
        catsChanged = true;
      }
      if (catsChanged) Store.set('cashflowCategories', nextCats);
    }

    // 3) Roadmap one-off life event
    var events = Store.get('roadmap.lifeEvents');
    if (!Array.isArray(events)) events = [];
    var nextEvents = JSON.parse(JSON.stringify(events));
    var existingEvent = nextEvents.filter(function (ev) { return ev.source === 'housePurchase'; })[0];
    var eventsChanged = false;
    if (active) {
      var amount = Math.round(s.totalUpfrontCash * 100) / 100;
      if (purchaseAge != null) {
        if (existingEvent) {
          if (existingEvent.age !== purchaseAge || existingEvent.amount !== amount) {
            existingEvent.age = purchaseAge; existingEvent.amount = amount; existingEvent.direction = 'Outflow'; existingEvent.durationYears = 1; eventsChanged = true;
          }
        } else {
          nextEvents.push({ name: 'House Purchase — Upfront Cash', age: purchaseAge, amount: amount, direction: 'Outflow', durationYears: 1, source: 'housePurchase' });
          eventsChanged = true;
        }
      }
    } else if (existingEvent) {
      nextEvents = nextEvents.filter(function (ev) { return ev.source !== 'housePurchase'; });
      eventsChanged = true;
    }
    if (eventsChanged) Store.set('roadmap.lifeEvents', nextEvents);
  }

  // Decoupling / property-share transfer (House Purchase > Decoupling
  // section) — same two-piece sync as House Purchase above, just for a
  // one-off transaction with this client in either role:
  //  1) A one-time CPF OA withdrawal (Buying: funding this client's own
  //     share of the cash/CPF split) or refund (Selling: the CPF
  //     originally used for the sold share, plus accrued interest),
  //     landed into CPF's own fields that cpfProjectionFull already
  //     reads at that exact age.
  //  2) A one-off Roadmap life event for the cash side of the same
  //     transaction — an outflow for the buying spouse, an inflow for
  //     the selling spouse.
  // Rental income from the property, once this client is sole owner, is
  // just entered directly into Cashflow's existing Rental Income field —
  // no separate synced field needed, since that's already the one place
  // this app tracks rental income.
  var syncingDecoupling = false;
  function syncDecoupling() {
    if (syncingDecoupling) return;
    syncingDecoupling = true;
    try {
      syncDecouplingImpl();
    } finally {
      syncingDecoupling = false;
    }
  }
  function syncDecouplingImpl() {
    var c = Store.getAll();
    var s = Calc.decouplingSummary(c);
    var txAge = s.active && ModuleHousePurchase ? ModuleHousePurchase.decouplingAge(c) : null;

    // 1) CPF one-time OA withdrawal/refund
    var cpfData = c.cpf || {};
    if (s.active && txAge != null) {
      var targetWithdrawal = s.role === 'Buying' ? s.cpfPortion : 0;
      var targetRefund = s.role === 'Selling' ? s.cpfRefund : 0;
      if (cpfData.decouplingAge !== txAge || cpfData.decouplingOAWithdrawal !== targetWithdrawal || cpfData.decouplingOARefund !== targetRefund) {
        Store.set('cpf.decouplingAge', txAge);
        Store.set('cpf.decouplingOAWithdrawal', targetWithdrawal);
        Store.set('cpf.decouplingOARefund', targetRefund);
      }
    } else if (cpfData.decouplingAge != null || Calc.num(cpfData.decouplingOAWithdrawal) || Calc.num(cpfData.decouplingOARefund)) {
      Store.set('cpf.decouplingAge', '');
      Store.set('cpf.decouplingOAWithdrawal', 0);
      Store.set('cpf.decouplingOARefund', 0);
    }

    // 2) Roadmap one-off life event
    var events = Store.get('roadmap.lifeEvents');
    if (!Array.isArray(events)) events = [];
    var nextEvents = JSON.parse(JSON.stringify(events));
    var existingEvent = nextEvents.filter(function (ev) { return ev.source === 'decoupling'; })[0];
    var eventsChanged = false;
    if (s.active && txAge != null) {
      var amount = s.role === 'Buying' ? s.cashPortion : s.netCashToSeller;
      var direction = s.role === 'Buying' ? 'Outflow' : 'Inflow';
      var name = s.role === 'Buying' ? 'Property Share Purchase — Lump Sum' : 'Property Share Sale — Net Proceeds';
      if (existingEvent) {
        if (existingEvent.age !== txAge || existingEvent.amount !== amount || existingEvent.direction !== direction || existingEvent.name !== name) {
          existingEvent.age = txAge; existingEvent.amount = amount; existingEvent.direction = direction; existingEvent.durationYears = 1; existingEvent.name = name; eventsChanged = true;
        }
      } else {
        nextEvents.push({ name: name, age: txAge, amount: amount, direction: direction, durationYears: 1, source: 'decoupling' });
        eventsChanged = true;
      }
    } else if (existingEvent) {
      nextEvents = nextEvents.filter(function (ev) { return ev.source !== 'decoupling'; });
      eventsChanged = true;
    }
    if (eventsChanged) Store.set('roadmap.lifeEvents', nextEvents);

    // 3) New combined refinance loan -> Mortgage Details (same fields the
    // main House Purchase page writes) — only when financing the buyout
    // via a new loan, and only while the main House Purchase page isn't
    // ALSO actively managing those same fields for an unrelated purchase,
    // to avoid the two sync functions fighting over the same fields.
    var mainPurchaseActive = Calc.num((c.housePurchase || {}).purchasePrice) > 0;
    if (s.active && s.role === 'Buying' && s.financeMode === 'Loan' && !mainPurchaseActive) {
      var md = c.liabilities && c.liabilities.mortgageDetails;
      if (!md || md.monthlyCash !== s.newMonthlyCash || md.monthlyCPF !== s.newMonthlyCpf ||
        md.tenureYears !== s.loanTenureYears || md.interestRate !== s.loanInterestRate) {
        Store.set('liabilities.mortgageDetails.monthlyCash', s.newMonthlyCash);
        Store.set('liabilities.mortgageDetails.monthlyCPF', s.newMonthlyCpf);
        Store.set('liabilities.mortgageDetails.tenureYears', s.loanTenureYears);
        Store.set('liabilities.mortgageDetails.interestRate', s.loanInterestRate);
      }
    }
  }

  // Auto-fills Net Worth's Unit Trusts/ETFs/Stocks/Crypto from matching
  // Investment Planning plans (by Type) — but only while the field is
  // still at its untouched default (0), so a value the advisor typed in
  // manually is never silently overwritten. Setting a field back to 0
  // re-enables auto-fill for it.
  var ASSET_TYPE_MAP = { unitTrusts: 'Unit Trust', etfs: 'ETF', stocks: 'Shares', crypto: 'Crypto' };
  function syncInvestmentAssets() {
    var c = Store.getAll();
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
    Object.keys(ASSET_TYPE_MAP).forEach(function (field) {
      var suggested = Math.round((byType[ASSET_TYPE_MAP[field]] || 0) * 100) / 100;
      var current = Calc.num((c.assets || {})[field]);
      if (current === 0 && suggested > 0) Store.set('assets.' + field, suggested);
    });
  }

  // "Current Investment Value" grounds the projection to a real account
  // balance, but ONLY at the exact age given in "As of Age" — if that age
  // is left blank, the whole figure is silently ignored and the
  // projection just keeps compounding from $0/Start Age instead, with
  // nothing on screen hinting why. Auto-filling "As of Age" to the
  // client's current age the moment a Current Value is entered (while it's
  // still blank) means the grounding always actually takes effect; still
  // fully editable afterward for a value observed at a different age.
  var syncingInvestmentCurrentValueAge = false;
  function syncInvestmentCurrentValueAge() {
    if (syncingInvestmentCurrentValueAge) return;
    syncingInvestmentCurrentValueAge = true;
    try {
      var c = Store.getAll();
      var currentAge = Calc.ageFromDob((c.personal || {}).dob) || Calc.num((c.retirement || {}).currentAge);
      if (!currentAge) return;
      var arr = Store.get('investments') || [];
      var changed = false;
      arr.forEach(function (plan) {
        var hasValue = Calc.num(plan.currentValue) > 0;
        var hasAge = plan.currentValueAge != null && plan.currentValueAge !== '';
        if (hasValue && !hasAge) { plan.currentValueAge = currentAge; changed = true; }
      });
      if (changed) Store.set('investments', arr);
    } finally {
      syncingInvestmentCurrentValueAge = false;
    }
  }

  // CPF's "Retirement Sum Growth Assumption %" defaults to 3.5%/year
  // (matching the confirmed 2026->2027 BRS increase) — auto-filled
  // visibly here rather than silently applied only internally when left
  // blank, so what's shown in the field always matches what's actually
  // used in the projection. Editable from there at any time.
  function syncRetirementSumGrowthDefault() {
    var c = Store.getAll();
    var cpf = c.cpf || {};
    // Also checks the value hasn't already been set to the target,
    // not just the manual-flag — Store.set() always fires notify() even
    // when writing an unchanged value, and a '*' subscriber calling
    // Store.set() again unconditionally on every notify() is exactly the
    // shape of an infinite loop. This makes repeat calls a genuine no-op.
    if (!cpf.retirementSumGrowthManuallySet && cpf.retirementSumGrowthRate !== 3.5) {
      Store.set('cpf.retirementSumGrowthRate', 3.5);
    }
  }

  // Retirement Planning's "gap-closing scenario" fields (Years to Invest,
  // Return Assumed %) default internally to Retirement Age minus Current
  // Age, and the main Expected Return — but if left as raw empty/0
  // fields, they'd visually show 0 while the caption below correctly
  // says otherwise, the same mismatch fixed elsewhere. This writes the
  // real default in visibly, once, so the field always matches the math.
  function syncGapClosingDefaults() {
    var c = Store.getAll();
    var r = c.retirement || {};
    if (!r.gapClosingYearsManuallySet) {
      var years = Math.max(0, Calc.num(r.retirementAge) - Calc.num(r.currentAge));
      if (r.gapClosingYears !== years) Store.set('retirement.gapClosingYears', years);
    }
    if (!r.gapClosingReturnManuallySet) {
      var expReturn = Calc.num(r.expectedReturn);
      if (r.gapClosingReturn !== expReturn) Store.set('retirement.gapClosingReturn', expReturn);
    }
  }

  // Printing used to always jump to the Proposals page and print that
  // alone. This lets the advisor pick any combination of pages — each
  // selected page is rendered into a dedicated print-only container (one
  // per page, separated by a page break) so multiple tabs can go out in a
  // single PDF/printout without disturbing whatever page is on screen.
  function openPrintTabPicker() {
    var routes = Router.listRoutes().filter(function (r) { return typeof r.module.render === 'function'; });
    var overlay = Dom.el('div', { class: 'modal-overlay' });
    var checks = routes.map(function (r) {
      return { key: r.key, title: r.title, module: r.module, cb: Dom.el('input', { type: 'checkbox', checked: r.key === 'proposals' ? 'checked' : null }) };
    });
    var list = Dom.el('div', { style: 'max-height:360px;overflow-y:auto;text-align:left;margin:4px 0 16px;border:1px solid var(--border);border-radius:8px;padding:4px 12px' });
    checks.forEach(function (item) {
      list.appendChild(Dom.el('label', { style: 'display:flex;align-items:center;gap:10px;padding:7px 2px;cursor:pointer;font-size:12px' }, [item.cb, item.title]));
    });
    var box = Dom.el('div', { class: 'modal-box' }, [
      Dom.el('div', { class: 'modal-message' }, ['Choose which tabs to include in the printout:']),
      list,
      Dom.el('div', { class: 'modal-actions' }, [
        Dom.el('button', { class: 'btn btn-ghost', onclick: function () { overlay.remove(); } }, ['Cancel']),
        Dom.el('button', {
          class: 'btn btn-primary',
          onclick: function () {
            var selected = checks.filter(function (item) { return item.cb.checked; });
            if (!selected.length) { Dom.modalAlert('Select at least one tab to print.'); return; }
            overlay.remove();
            printSelectedTabs(selected);
          }
        }, ['Print'])
      ])
    ]);
    overlay.appendChild(box);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }

  function printSelectedTabs(selected) {
    var root = document.createElement('div');
    root.className = 'print-multi-root';
    var unsubs = [];
    selected.forEach(function (item) {
      var page = Dom.el('div', { class: 'print-page' });
      // Proposals already renders its own centered document title + "Prepared
      // for <client>" subtitle as the first thing on the page — stacking the
      // generic page-title heading on top of that just duplicated it and
      // left an ugly gap before the real title. Every other page has no
      // title of its own, so it still gets the generic heading.
      if (item.key !== 'proposals') {
        page.appendChild(Dom.el('div', { class: 'print-page-title' }, [item.title]));
      }
      var body = Dom.el('div');
      page.appendChild(body);
      root.appendChild(page);
      try {
        var maybeUnsub = item.module.render(body);
        if (typeof maybeUnsub === 'function') unsubs.push(maybeUnsub);
      } catch (err) {
        body.appendChild(Dom.el('div', { class: 'text-secondary' }, ['Couldn’t load this page: ' + (err && err.message ? err.message : err)]));
        console.error('Print: page "' + item.key + '" failed to render:', err);
      }
    });
    document.body.appendChild(root);
    document.body.classList.add('printing-multi');

    var cleaned = false;
    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      unsubs.forEach(function (unsub) { try { unsub(); } catch (e) {} });
      document.body.classList.remove('printing-multi');
      if (root.parentNode) root.parentNode.removeChild(root);
      window.removeEventListener('afterprint', cleanup);
    }
    window.addEventListener('afterprint', cleanup);
    // Fallback in case 'afterprint' doesn't fire (some mobile browsers) —
    // long enough that it never races a print dialog still open.
    setTimeout(cleanup, 60000);

    // Let the freshly-rendered pages (and any chart canvases drawn via
    // requestAnimationFrame inside each module) paint before printing.
    requestAnimationFrame(function () { setTimeout(function () { window.print(); }, 250); });
  }

  // Shows which deploy is actually live, right where it's visible at a
  // glance — js/core/version.js's placeholder ("dev") means this is a
  // local/dev checkout that never went through the GitHub Pages deploy
  // workflow, which stamps the real commit + timestamp in on every push.
  function initBuildStamp() {
    var el = document.getElementById('buildStamp');
    if (!el) return;
    var v = (typeof APP_VERSION !== 'undefined') ? APP_VERSION : { sha: 'dev', time: '' };
    el.textContent = v.sha === 'dev' ? 'dev build' : ('Build ' + v.sha + (v.time ? ' · ' + v.time : ''));
  }

  function init() {
    initBuildStamp();
    Store.init(SampleClient);
    initTheme();
    // Resize every live chart right before printing — print CSS forces a
    // real 2/3-column grid (see styles.css), and Chart.js's own
    // ResizeObserver isn't reliably catching that layout change across
    // browsers on its own. The leader-lines donut also swaps to Chart.js's
    // own built-in legend for the print snapshot (see
    // Charts.usePrintSafeLegend's own comment for why), swapping back once
    // printing is done.
    window.addEventListener('beforeprint', function () { Charts.resizeAll(); Charts.usePrintSafeLegend(); });
    window.addEventListener('afterprint', function () { Charts.restoreNormalLegend(); });
    syncCurrentAgeFromDob();
    syncAutoCpf();
    syncAutoIncomeTax();
    syncAutoExpenseStops();
    syncBonusFromMonths();
    syncAutoReliefs();
    syncCpfTopUpLinks();
    syncMortgageCpfDeduction();
    syncInvestmentAssets();
    syncInvestmentCurrentValueAge();
    syncRetirementSumGrowthDefault();
    syncGapClosingDefaults();
    syncHousePurchase();
    syncDecoupling();
    // Each sync function is also wired to its own specific path(s) below
    // for fast, targeted reaction during normal editing — but ALL of
    // them also need to re-run on a broad '*' reset (New Client, Switch
    // to Partner, Load Saved Client, Import JSON all replace the whole
    // client via notify('*')), which none of the narrow subscriptions
    // below would otherwise catch: notify('*') does not match a listener
    // subscribed to a specific path, only the reverse. Without this,
    // switching clients would silently leave every one of these synced
    // values stuck on the PREVIOUS client's numbers.
    Store.subscribe('*', function () {
      syncCurrentAgeFromDob();
      syncAutoCpf();
      syncAutoIncomeTax();
      syncAutoExpenseStops();
      syncBonusFromMonths();
      syncAutoReliefs();
      syncCpfTopUpLinks();
      syncMortgageCpfDeduction();
      syncInvestmentAssets();
      syncInvestmentCurrentValueAge();
      syncRetirementSumGrowthDefault();
      syncGapClosingDefaults();
      syncHousePurchase();
      syncDecoupling();
    });
    Store.subscribe('housePurchase', syncHousePurchase);
    Store.subscribe('housePurchase', syncDecoupling);
    Store.subscribe('personal.dob', syncHousePurchase);
    Store.subscribe('personal.dob', syncDecoupling);
    Store.subscribe('personal.dob', syncCurrentAgeFromDob);
    Store.subscribe('personal.employmentStatus', syncAutoCpf);
    Store.subscribe('personal.dob', syncAutoCpf);
    Store.subscribe('income.salary', syncAutoCpf);
    Store.subscribe('personal.employmentStatus', syncAutoIncomeTax);
    Store.subscribe('personal.dob', syncAutoIncomeTax);
    Store.subscribe('income.salary', syncAutoIncomeTax);
    Store.subscribe('income.bonus', syncAutoIncomeTax);
    Store.subscribe('income.businessIncome', syncAutoIncomeTax);
    Store.subscribe('tax.reliefs', syncAutoIncomeTax);
    Store.subscribe('tax.parenthoodTaxRebate', syncAutoIncomeTax);
    Store.subscribe('dependants', syncAutoIncomeTax);
    Store.subscribe('personal.employmentStatus', syncAutoReliefs);
    Store.subscribe('personal.dob', syncAutoReliefs);
    Store.subscribe('income.salary', syncAutoReliefs);
    Store.subscribe('income.bonus', syncAutoReliefs);
    Store.subscribe('income.businessIncome', syncAutoReliefs);
    Store.subscribe('liabilities.mortgageDetails.monthlyCPF', syncMortgageCpfDeduction);
    // Runs on load, and whenever Investment Planning or the client's DOB
    // changes — NOT subscribed to the asset fields themselves, since that
    // created a self-referential trigger (editing a field could retrigger
    // this same sync mid-edit). A field auto-fills the first time it's
    // seen at S$0; from then on it's fully the advisor's to edit, with
    // any further re-sync only via the explicit "Reload from Investment
    // Planning" button on the Net Worth page.
    Store.subscribe('investments', syncInvestmentAssets);
    Store.subscribe('personal.dob', syncInvestmentAssets);
    Store.subscribe('investments', syncInvestmentCurrentValueAge);
    Store.subscribe('personal.dob', syncInvestmentCurrentValueAge);

    Sidebar.init(document.getElementById('sidebar'));

    // Defensive: a single missing/failed-to-load module (e.g. one file
    // out of sync with the rest during a partial deployment) used to
    // throw a ReferenceError here and halt EVERYTHING after it in
    // init() — meaning one broken page could take down all 19 others
    // too. Accessing modules via window.ModuleX (a property lookup) 
    // rather than the bare identifier (which throws if never declared)
    // lets a missing module be skipped with a warning instead, so the
    // rest of the app keeps working even if one page can't.
    function registerModule(key, moduleGlobalName) {
      var mod = window[moduleGlobalName];
      if (mod) { Router.register(key, mod); }
      else { console.warn('Module "' + moduleGlobalName + '" not found \u2014 the "' + key + '" page will be unavailable. Its file may be missing or out of sync with the rest of the app.'); }
    }

    registerModule('dashboard', 'ModuleDashboard');
    registerModule('houseplan', 'ModuleHousePurchase');
    registerModule('couple', 'ModuleCouple');
    registerModule('roadmap', 'ModuleRoadmap');
    registerModule('cashflow', 'ModuleCashflow');
    registerModule('buckets', 'ModuleBuckets');
    registerModule('networth', 'ModuleNetWorth');
    registerModule('insurance', 'ModuleInsurance');
    registerModule('hospital', 'ModuleHospitalPlans');
    registerModule('retirement', 'ModuleRetirement');
    registerModule('investments', 'ModuleInvestments');
    registerModule('dividends', 'ModuleDividends');
    registerModule('cpf', 'ModuleCpf');
    registerModule('tax', 'ModuleTax');
    registerModule('estate', 'ModuleEstate');
    registerModule('ratios', 'ModuleRatios');
    registerModule('goals', 'ModuleGoals');
    registerModule('profile', 'ModuleProfile');
    registerModule('sessionnotes', 'ModuleSessionNotes');
    registerModule('meetingnotes', 'ModuleMeetingNotes');
    registerModule('proposals', 'ModuleProposals');
    registerModule('settings', 'ModuleSettings');

    Router.init(document.getElementById('content'));

    updateTopbar();
    Store.subscribe('*', updateTopbar);

    // Defensive: a single missing button (e.g. one file out of sync with
    // the rest) used to throw and halt ALL of init() partway through,
    // silently breaking every button/feature registered after it too.
    // This lets each button attach independently, so one missing element
    // doesn't take the rest of the app down with it.
    function onClick(id, handler) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', handler);
      else console.warn('Button #' + id + ' not found in the page \u2014 its file version may be out of sync with the JS.');
    }

    onClick('themeToggle', function () {
      var current = document.documentElement.getAttribute('data-theme');
      setTheme(current === 'dark' ? 'light' : 'dark');
    });
    onClick('printBtn', openPrintTabPicker);

    onClick('quickSaveBtn', function () {
      Store.quickSave();
      var label = document.getElementById('quickSaveLabel');
      if (label) {
        label.textContent = 'Saved ✓';
        setTimeout(function () { label.textContent = 'Save'; }, 1600);
      }
    });

    onClick('newClientBtn', function () {
      Dom.modalConfirm('Save the client currently open, then start a fresh blank client?', function () {
        try {
          Store.quickSave();
          Store.reset(BlankClient);
          window.location.hash = 'profile';
          // Explicit, hard-to-miss visual confirmation — a silent hash
          // change alone isn't obviously "something happened" if the new
          // (blank) page looks similar to what was already on screen.
          var banner = document.createElement('div');
          banner.textContent = '\u2713 New client started \u2014 fill in their details below';
          banner.style.cssText = 'position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:9999;' +
            'background:var(--good,#1C9166);color:#fff;padding:10px 20px;border-radius:10px;font-weight:600;' +
            'font-size:11.5px;box-shadow:0 4px 16px rgba(0,0,0,0.2);';
          document.body.appendChild(banner);
          setTimeout(function () { banner.remove(); }, 3000);
        } catch (err) {
          Dom.modalAlert('New Client couldn\u2019t start: ' + (err && err.message ? err.message : err) + '\n\nYour current client has not been changed.');
        }
      }, { confirmLabel: 'Start New Client' });
    });
  }

  return { init: init, setTheme: setTheme };
})();

// Resolves true once a session exists (or immediately, in local-only
// mode). Resolves false after a fresh sign-in, having already replaced
// #content with the login screen and triggered a reload — the caller
// must stop and not touch the DOM.
function ensureAuthenticated() {
  var sb = Auth.getClient();
  if (!sb) return Promise.resolve(true); // local-only mode — no login required
  return Auth.getSession().then(function (session) {
    if (session) return true;
    return Auth.renderLoginScreen(document.body).then(function () {
      window.location.reload();
      return false;
    });
  });
}

document.addEventListener('DOMContentLoaded', function () {
  ensureAuthenticated().then(function (authenticated) {
    if (!authenticated) return; // login screen shown, or a reload is already in flight
    return Sync.pullBeforeInit().then(startApp);
  }).catch(function (err) { startApp(); console.error('Auth/sync bootstrap failed, continuing local-only', err); });
});

function startApp() {
  try {
    App.init();
    if (Sync.enabled()) Sync.startWatching();
    var signOutBtn = document.getElementById('signOutBtn');
    if (signOutBtn) {
      if (Sync.enabled()) {
        signOutBtn.style.display = '';
        signOutBtn.addEventListener('click', Auth.signOut);
      }
    }
  } catch (err) {
    // If ANY single line in init() throws (e.g. one mismatched file with
    // a missing element id), the whole app previously failed silently —
    // everything after that line simply never ran, with no visible sign
    // of what broke. Show the real error instead, since "nothing on the
    // page works" with no explanation is the hardest failure to diagnose.
    console.error('App failed to start:', err);
    var box = document.createElement('div');
    box.style.cssText = 'position:fixed;top:70px;left:0;right:0;bottom:0;background:#F8F4F5;z-index:99999;padding:40px;font-family:sans-serif;overflow:auto;';
    box.innerHTML = '<div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #D6484A;border-radius:12px;padding:24px;">' +
      '<div style="font-weight:700;font-size:16px;margin-bottom:12px;color:#D6484A;">The app failed to start</div>' +
      '<div style="font-size:12.5px;margin-bottom:12px;">' + (err && err.message ? err.message : String(err)) + '</div>' +
      '<div style="font-size:11.5px;color:#555;line-height:1.6;margin-bottom:16px;">This usually means the files are out of sync \u2014 e.g. an old index.html paired with newer JS files, or vice versa.</div>' +
      '<div style="font-size:11.5px;color:#2B0A1C;background:#F8F4F5;border-radius:8px;padding:12px;line-height:1.6;">' +
      '<b>Check the build marker at the top-right of the screen, above this box.</b><br>' +
      'If it doesn\u2019t say the build you were just given, this confirms stale files \u2014 not a code issue. Fully delete the old extracted folder (not just overwrite it \u2014 some zip tools skip existing files instead of replacing them), extract the zip fresh into a brand-new empty folder, and open index.html from there in a new browser tab.' +
      '</div></div>';
    document.body.appendChild(box);
  }
}
