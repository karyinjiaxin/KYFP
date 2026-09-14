/* ============================================================
   hospitalPlans.js — Hospital Plan Premium Financing

   Includes the InsurerRates data module inline (merged from what
   was previously a separate js/data/insurerRates.js file) so this
   page can never go blank from a separate new file/script-tag
   being missed during a deploy — everything it needs ships in
   this one file.

   Premium data source: Great Eastern "GREAT SupremeHealth and
   GREAT TotalCare 2 — Benefit Schedule and Premium Rates", for
   cover start dates from 1 April 2026 (GSH P Plus/P Prime/A
   Plus/B Plus, GTC2 P Prime/A/B, and the dedicated GSH P Prime +
   GTC P Prime table); and Great Eastern "Premium Rates" (Premium
   Revisions for GREAT TotalCare Plans, effective 1 Nov 2025) for
   the legacy GTC P Signature / P Optimum / A / B rider rates. All
   figures are annual premiums in SGD, inclusive of GST, for
   Singapore Citizens/PRs, standard lives — both documents supplied
   directly by the user.

   Bands: ages sharing an identical published rate are stored once
   with an [fromAge, toAge] range rather than repeated per year,
   matching the source tables' own step structure.
   ============================================================ */

var InsurerRates = (function () {

  function lookupBand(bands, age) {
    for (var i = 0; i < bands.length; i++) {
      if (age >= bands[i][0] && age <= bands[i][1]) return bands[i];
    }
    return bands[bands.length - 1]; // beyond table range -> use last (100+) band
  }

  // ---------- GREAT SUPREMEHEALTH (main plan, MediSave + Cash) ----------
  // [fromAge, toAge, premium, cashOutlay] — cash outlay is the portion
  // above the CPF Additional Withdrawal Limit that must be paid in cash;
  // (premium - cashOutlay) is the MediSave-payable portion.
  var GSH = {
    'P Plus': [
      [1, 3, 344.44, 44.44], [4, 20, 312.83, 12.83], [21, 25, 391.31, 91.31], [26, 30, 456.71, 156.71],
      [31, 35, 631.11, 331.11], [36, 40, 680.16, 380.16], [41, 45, 1293.83, 693.83], [46, 50, 1357.05, 757.05],
      [51, 55, 2106.97, 1506.97], [56, 60, 2698.84, 2098.84], [61, 63, 3962.15, 3362.15], [64, 65, 3989.40, 3389.40],
      [66, 68, 5555.73, 4955.73], [69, 70, 6003.72, 5403.72], [71, 73, 6754.73, 5854.73], [74, 75, 8373.38, 7473.38],
      [76, 78, 9620.34, 8720.34], [79, 80, 11607.41, 10707.41], [81, 83, 12414.01, 11514.01], [84, 85, 13120.33, 12220.33],
      [86, 88, 13186.82, 12286.82], [89, 90, 13329.61, 12429.61], [91, 93, 13473.49, 12573.49], [94, 95, 13590.12, 12690.12],
      [96, 98, 13711.11, 12811.11], [99, 200, 13799.40, 12899.40]
    ],
    'P Prime': [
      [1, 3, 192.93, 0], [4, 20, 174.40, 0], [21, 25, 219.09, 0], [26, 30, 255.06, 0],
      [31, 35, 352.07, 52.07], [36, 40, 379.32, 79.32], [41, 45, 721.58, 121.58], [46, 50, 757.55, 157.55],
      [51, 55, 1176.11, 576.11], [56, 60, 1506.38, 906.38], [61, 63, 2210.52, 1610.52], [64, 65, 2225.78, 1625.78],
      [66, 68, 3099.96, 2499.96], [69, 70, 3350.66, 2750.66], [71, 73, 3769.22, 2869.22], [74, 75, 4672.83, 3772.83],
      [76, 78, 5368.25, 4468.25], [79, 80, 6477.87, 5577.87], [81, 83, 6928.04, 6028.04], [84, 85, 7321.53, 6421.53],
      [86, 88, 7358.59, 6458.59], [89, 90, 7438.16, 6538.16], [91, 93, 7518.82, 6618.82], [94, 95, 7584.22, 6684.22],
      [96, 98, 7651.80, 6751.80], [99, 200, 7700.85, 6800.85]
    ],
    'A Plus': [
      [1, 3, 87.20, 0], [4, 20, 85.02, 0], [21, 25, 103.55, 0], [26, 30, 103.55, 0],
      [31, 35, 134.07, 0], [36, 40, 152.60, 0], [41, 45, 258.33, 0], [46, 50, 280.13, 0],
      [51, 55, 384.77, 0], [56, 60, 536.28, 0], [61, 63, 694.33, 94.33], [64, 65, 882.90, 282.90],
      [66, 68, 1159.76, 559.76], [69, 70, 1464.96, 864.96], [71, 73, 1660.07, 760.07], [74, 75, 2097.16, 1197.16],
      [76, 78, 2461.22, 1561.22], [79, 80, 2871.06, 1971.06], [81, 83, 2968.07, 2068.07], [84, 85, 3272.18, 2372.18],
      [86, 88, 3664.58, 2764.58], [89, 90, 3804.10, 2904.10], [91, 93, 4062.43, 3162.43], [94, 95, 4351.28, 3451.28],
      [96, 98, 4822.16, 3922.16], [99, 200, 5164.42, 4264.42]
    ],
    'B Plus': [
      [1, 3, 61.04, 0], [4, 20, 61.04, 0], [21, 25, 77.39, 0], [26, 30, 77.39, 0],
      [31, 35, 92.65, 0], [36, 40, 104.64, 0], [41, 45, 165.68, 0], [46, 50, 175.49, 0],
      [51, 55, 289.94, 0], [56, 60, 344.44, 0], [61, 63, 455.62, 0], [64, 65, 587.51, 0],
      [66, 68, 758.64, 158.64], [69, 70, 989.72, 389.72], [71, 73, 1189.19, 289.19], [74, 75, 1400.65, 500.65],
      [76, 78, 1644.81, 744.81], [79, 80, 1935.84, 1035.84], [81, 83, 2140.76, 1240.76], [84, 85, 2307.53, 1407.53],
      [86, 88, 2469.94, 1569.94], [89, 90, 2675.95, 1775.95], [91, 93, 2863.43, 1963.43], [94, 95, 3108.68, 2208.68],
      [96, 98, 3348.48, 2448.48], [99, 200, 3602.45, 2702.45]
    ]
  };

  // ---------- GREAT TOTALCARE riders (fully cash-payable) ----------
  // Legacy GTC (P Signature / P Optimum / A / B): "Effective 1-Nov-2025" column
  var GTC = {
    'P Signature': [
      [1, 3, 1686.23], [4, 5, 1452.97], [6, 20, 1452.97], [21, 25, 1529.27], [26, 30, 1541.26],
      [31, 35, 1612.11], [36, 40, 1784.33], [41, 45, 2599.65], [46, 50, 2925.56], [51, 55, 4025.37],
      [56, 60, 5548.10], [61, 63, 7814.21], [64, 65, 8608.82], [66, 68, 10405.14], [69, 70, 11259.70],
      [71, 73, 12782.43], [74, 75, 14290.99], [76, 78, 15118.30], [79, 80, 15979.40], [81, 83, 16877.56],
      [84, 85, 17398.58], [86, 88, 18700.04], [89, 90, 20198.79], [91, 93, 20644.60], [94, 95, 21319.31],
      [96, 98, 21888.29], [99, 200, 22648.02]
    ],
    'P Optimum (renewal only)': [
      [1, 3, 391.31], [4, 5, 391.31], [6, 20, 356.43], [21, 25, 361.88], [26, 30, 361.88],
      [31, 35, 409.84], [36, 40, 494.86], [41, 45, 607.13], [46, 50, 770.63], [51, 55, 1059.48],
      [56, 60, 1420.27], [61, 63, 1689.50], [64, 65, 1927.12], [66, 68, 2210.52], [69, 70, 2487.38],
      [71, 73, 2791.49], [74, 75, 3118.49], [76, 78, 3477.10], [79, 80, 3857.51], [81, 83, 4264.08],
      [84, 85, 4633.59], [86, 88, 4886.47], [89, 90, 5229.82], [91, 93, 5458.72], [94, 95, 5649.47],
      [96, 98, 5768.28], [99, 200, 5871.83]
    ],
    'A': [
      [1, 3, 236.53], [4, 5, 153.69], [6, 20, 153.69], [21, 25, 176.58], [26, 30, 176.58],
      [31, 35, 218.00], [36, 40, 256.15], [41, 45, 335.72], [46, 50, 419.65], [51, 55, 568.98],
      [56, 60, 786.98], [61, 63, 981.00], [64, 65, 1145.59], [66, 68, 1323.26], [69, 70, 1515.10],
      [71, 73, 1710.21], [74, 75, 1933.66], [76, 78, 2130.95], [79, 80, 2342.41], [81, 83, 2547.33],
      [84, 85, 2772.96], [86, 88, 2938.64], [89, 90, 2944.09], [91, 93, 2989.87], [94, 95, 3059.63],
      [96, 98, 3122.85], [99, 200, 3134.84]
    ],
    'B': [
      [1, 3, 150.42], [4, 5, 150.42], [6, 20, 123.17], [21, 25, 128.62], [26, 30, 128.62],
      [31, 35, 149.33], [36, 40, 177.67], [41, 45, 232.17], [46, 50, 289.94], [51, 55, 392.40],
      [56, 60, 541.73], [61, 63, 680.16], [64, 65, 791.34], [66, 68, 914.51], [69, 70, 1046.40],
      [71, 73, 1180.47], [74, 75, 1331.98], [76, 78, 1470.41], [79, 80, 1615.38], [81, 83, 1759.26],
      [84, 85, 1905.32], [86, 88, 2016.50], [89, 90, 2129.86], [91, 93, 2234.50], [94, 95, 2305.35],
      [96, 98, 2353.31], [99, 200, 2375.11]
    ],
    'P Prime': [ // dedicated rider for GSH P Prime, from the same-name combined table
      [1, 3, 503.58], [4, 20, 464.34], [21, 25, 446.90], [26, 30, 468.70], [31, 35, 547.18],
      [36, 40, 586.42], [41, 45, 878.54], [46, 50, 1034.41], [51, 55, 1621.92], [56, 60, 2133.13],
      [61, 63, 2782.77], [64, 65, 3001.86], [66, 68, 3761.59], [69, 70, 4151.81], [71, 73, 4665.20],
      [74, 75, 5481.61], [76, 78, 6204.28], [79, 80, 7187.46], [81, 83, 7808.76], [84, 85, 8364.66],
      [86, 88, 8611.00], [89, 90, 8959.80], [91, 93, 9209.41], [94, 95, 9416.51], [96, 98, 9560.39],
      [99, 200, 9680.29]
    ]
  };

  // GREAT TOTALCARE 2 riders (newer product line, fully cash-payable)
  var GTC2 = {
    'P Prime': [
      [1, 3, 977.73], [4, 5, 842.57], [6, 20, 842.57], [21, 25, 887.26], [26, 30, 893.80],
      [31, 35, 935.22], [36, 40, 1034.41], [41, 45, 1507.47], [46, 50, 1697.13], [51, 55, 2334.78],
      [56, 60, 3217.68], [61, 63, 4532.22], [64, 65, 4993.29], [66, 68, 6035.33], [69, 70, 6530.19],
      [71, 73, 7414.18], [74, 75, 8288.36], [76, 78, 8769.05], [79, 80, 9268.27], [81, 83, 9789.29],
      [84, 85, 10091.22], [86, 88, 10845.50], [89, 90, 11715.32], [91, 93, 11973.65], [94, 95, 12364.96],
      [96, 98, 12695.23], [99, 200, 13135.59]
    ],
    'A': [
      [1, 3, 422.92], [4, 5, 371.69], [6, 20, 371.69], [21, 25, 357.52], [26, 30, 374.96],
      [31, 35, 438.18], [36, 40, 468.70], [41, 45, 703.05], [46, 50, 827.31], [51, 55, 1297.10],
      [56, 60, 1706.94], [61, 63, 2225.78], [64, 65, 2401.27], [66, 68, 3009.49], [69, 70, 3321.23],
      [71, 73, 3732.16], [74, 75, 4385.07], [76, 78, 4963.86], [79, 80, 5749.75], [81, 83, 6246.79],
      [84, 85, 6691.51], [86, 88, 6888.80], [89, 90, 7167.84], [91, 93, 7220.16], [94, 95, 7382.57],
      [96, 98, 7494.84], [99, 200, 7589.67]
    ],
    'B': [
      [1, 3, 118.81], [4, 5, 77.39], [6, 20, 77.39], [21, 25, 88.29], [26, 30, 88.29],
      [31, 35, 109.00], [36, 40, 128.62], [41, 45, 167.86], [46, 50, 210.37], [51, 55, 284.49],
      [56, 60, 393.49], [61, 63, 490.50], [64, 65, 573.34], [66, 68, 661.63], [69, 70, 757.55],
      [71, 73, 855.65], [74, 75, 966.83], [76, 78, 1066.02], [79, 80, 1171.75], [81, 83, 1274.21],
      [84, 85, 1386.48], [86, 88, 1469.32], [89, 90, 1472.59], [91, 93, 1495.48], [94, 95, 1530.36],
      [96, 98, 1561.97], [99, 200, 1567.42]
    ]
  };

  // Which riders are offered against each GSH plan tier, and which rider
  // family (GTC vs GTC2) each belongs to.
  var RIDER_OPTIONS = {
    'P Plus': [
      { label: 'N/A', family: null, key: null },
      { label: 'GTC P Signature (renewal only)', family: 'GTC', key: 'P Signature' },
      { label: 'GTC P Optimum (renewal only)', family: 'GTC', key: 'P Optimum (renewal only)' }
      // NOTE: advisor confirmed GSH P Plus should also pair with "GTC 2 P"
      // — but the GTC2 rate table in this file only has 'P Prime', 'A',
      // and 'B' keys, not a standalone 'P'. Rather than guess at real
      // premium figures for a product this file has no rate data for,
      // this option is left out until the actual GTC 2 P rate table
      // (distinct from GTC2 P Prime, which is a different product) is
      // provided.
    ],
    'P Prime': [{ label: 'N/A', family: null, key: null }, { label: 'GTC P Prime', family: 'GTC', key: 'P Prime' }, { label: 'GTC2 P Prime', family: 'GTC2', key: 'P Prime' }],
    'A Plus': [{ label: 'N/A', family: null, key: null }, { label: 'GTC A (renewal only)', family: 'GTC', key: 'A' }, { label: 'GTC2 A', family: 'GTC2', key: 'A' }],
    'B Plus': [{ label: 'N/A', family: null, key: null }, { label: 'GTC B', family: 'GTC', key: 'B' }, { label: 'GTC2 B', family: 'GTC2', key: 'B' }]
  };

  // MediShield Life base premium — a SEPARATE layer from the "Additional
  // Private Insurance Coverage" above, fully payable by MediSave (not
  // subject to the Additional Withdrawal Limit at all). The total premium
  // for an Integrated Shield Plan is this PLUS the additional private
  // coverage premium. Source: same GSH Premiums Table, "MediShield Life
  // Premiums" column, accurate as of 1 October 2025 per the document.
  var MEDISHIELD_LIFE = [
    [1, 20, 200], [21, 30, 295], [31, 40, 503], [41, 50, 637], [51, 60, 903],
    [61, 65, 1131], [66, 70, 1326], [71, 73, 1643], [74, 75, 1816], [76, 78, 2027],
    [79, 80, 2187], [81, 83, 2303], [84, 85, 2616], [86, 90, 2785], [91, 200, 2826]
  ];
  function medishieldLifePremium(age) {
    return lookupBand(MEDISHIELD_LIFE, age)[2];
  }

  function gshRate(plan, age) {
    var band = lookupBand(GSH[plan] || GSH['P Plus'], age);
    var mshl = medishieldLifePremium(age);
    // mshl is fully MediSave-payable and NOT subject to the AWL; only the
    // "additional private coverage" portion (band[2]) has its own
    // cash/MediSave split via the AWL (band[3] = cash outlay for that
    // portion only).
    return {
      premium: mshl + band[2],
      cash: band[3],
      medisave: mshl + (band[2] - band[3]),
      medishieldLife: mshl,
      additionalPrivate: band[2],
      additionalPrivateCash: band[3]
    };
  }
  function riderRate(family, key, age) {
    if (!family || !key) return 0;
    var table = family === 'GTC2' ? GTC2 : GTC;
    var band = lookupBand(table[key] || [[1, 200, 0]], age);
    return band[2];
  }

  return {
    GSH_PLANS: ['P Plus', 'P Prime', 'A Plus', 'B Plus'],
    RIDER_OPTIONS: RIDER_OPTIONS,
    gshRate: gshRate,
    riderRate: riderRate
  };
})();

/* ---- ModuleHospitalPlans: the actual page renderer ----
   GSH (main plan) + GTC/GTC2 (rider) premiums use InsurerRates
   above. GSH premium is MediSave + Cash (split per the CPF
   Additional Withdrawal Limit, taken directly from GE's own
   table); GTC/GTC2 riders are fully cash-payable. */

var ModuleHospitalPlans = (function () {
  var openPlans = {};
  var PROJECT_FROM_OPTIONS = ["Today's Age", 'Age 55', 'Age 60', 'Age 65'];
  var GSH_DEFAULT_COVERAGE = { 'P Plus': 1500000, 'P Prime': 1500000, 'A Plus': 1200000, 'B Plus': 500000 };

  function render(container) {
    function draw() {
      var c = Store.getAll();
      var todaysAge = Calc.ageFromDob((c.personal || {}).dob) || (c.retirement || {}).currentAge || 35;

      container.innerHTML = '';
      container.appendChild(Dom.el('div', { class: 'page-header' }, [
        Dom.el('h1', {}, ['Hospital Plan Premiums']),
        Dom.el('div', { class: 'sub' }, [((c.personal || {}).name || 'Client') + " \u00b7 today's age " + todaysAge])
      ]));
      container.appendChild(Dom.el('div', { class: 'card mb-3', style: 'background:var(--accent-soft);border-color:var(--accent)' }, [
        Dom.el('div', { class: 'text-tertiary', style: 'line-height:1.5' }, [
          '\u2139 Illustration only, not financial advice. GREAT SupremeHealth and GREAT TotalCare/TotalCare 2 premiums are Great Eastern\u2019s own published rates (effective 1 April 2026 for GSH/GTC2, 1 November 2025 for legacy GTC), inclusive of GST, for standard lives. Actual premiums depend on underwriting, any loadings, and rate revisions after this date \u2014 confirm current rates with Great Eastern before presenting to a client.'
        ])
      ]));

      var hospitalPolicies = (c.hospitalPlans || []).map(function (p, idx) { return { p: p, idx: idx }; });

      if (hospitalPolicies.length === 0) {
        // Always show a plan to fill in — no click needed to see the
        // calculator, and adding one here never touches Insurance Coverage.
        addDefaultHospitalPlan();
        return;
      }
      // Only one plan is shown at a time — if more than one somehow
      // exists (e.g. from before this was simplified), only the first
      // is displayed.
      container.appendChild(planCard(hospitalPolicies[0].p, hospitalPolicies[0].idx, todaysAge));
    }

    function addDefaultHospitalPlan() {
      var arr = Store.get('hospitalPlans') || [];
      arr.push({
        id: Dom.uid('hosp'), company: 'Great Eastern', policyName: 'GREAT SupremeHealth',
        coverage: 1500000, endAge: 99,
        insurer: 'Great Eastern', gshPlan: 'P Plus', riderFamily: null, riderKey: null, paymentMode: 'MediSave + Cash',
        projectFrom: "Today's Age", funding: { mode: 'Regular', amount: 0, growthRate: 5, dividendRate: 4 }
      });
      Store.set('hospitalPlans', arr);
    }

    function projectionRange(policy, todaysAge) {
      var from = policy.projectFrom === "Today's Age" ? todaysAge : Calc.num((policy.projectFrom || '').replace('Age ', ''));
      var to = Calc.num(policy.endAge) || 99;
      if (from > to) from = to;
      return { from: from, to: to };
    }

    function geProjection(policy, fromAge, toAge) {
      var rows = [];
      var cumCash = 0, cumMedisave = 0, cumGshCash = 0, cumGtcCash = 0;
      var isFullCash = policy.paymentMode === 'Full Cash Only (Foreigners)';
      for (var age = fromAge; age <= toAge; age++) {
        var gsh = InsurerRates.gshRate(policy.gshPlan, age);
        var riderPremium = InsurerRates.riderRate(policy.riderFamily, policy.riderKey, age);
        // Foreigners generally can't use MediSave (it's for Singapore
        // Citizens/PRs) — folding the MediSave portion into cash instead
        // of showing it as a payable-by-MediSave amount gives an
        // accurate "what will this actually cost me in cash" view.
        var gshCash = gsh.cash + (isFullCash ? gsh.medisave : 0);
        var gtcCash = riderPremium; // rider is fully cash-payable, no MediSave component at all
        var cash = gshCash + gtcCash;
        var medisave = isFullCash ? 0 : gsh.medisave;
        cumCash += cash;
        cumGshCash += gshCash;
        cumGtcCash += gtcCash;
        cumMedisave += medisave;
        rows.push({
          age: age, totalPremium: gsh.premium + riderPremium, cash: cash, medisave: medisave,
          gshCash: gshCash, gtcCash: gtcCash, cumCash: cumCash, cumMedisave: cumMedisave,
          cumGshCash: cumGshCash, cumGtcCash: cumGtcCash
        });
      }
      return rows;
    }

    function planCard(p, idx, todaysAge) {
      var base = 'hospitalPlans.' + idx + '.';
      var range = projectionRange(p, todaysAge);
      var proj = geProjection(p, range.from, range.to);
      var last = proj[proj.length - 1] || { cumCash: 0, cumMedisave: 0 };
      var todayRow = geProjection(p, todaysAge, todaysAge)[0] || { cash: 0, medisave: 0 };
      var isOpen = !!openPlans[p.id || idx];

      var card = Dom.el('div', { class: 'card mb-3' });
      card.appendChild(Dom.el('div', { class: 'policy-head' }, [
        Dom.el('div', {}, [
          Dom.el('div', { class: 'policy-title' }, ['GREAT SupremeHealth ' + p.gshPlan + (p.riderFamily ? ' + ' + (p.riderFamily === 'GTC2' ? 'GTC2 ' : 'GTC ') + p.riderKey : '')]),
          Dom.el('div', { class: 'policy-sub' }, [p.insurer || 'Great Eastern'])
        ])
      ]));

      // ---- Client / Plan / Rider selectors ----
      card.appendChild(Dom.el('div', { class: 'input-row mb-3' }, [
        Fields.selectInput(base + 'insurer', 'Insurer', ['Great Eastern']),
        Fields.selectInput(base + 'gshPlan', 'Plan (GSH)', InsurerRates.GSH_PLANS),
        riderSelect(p, idx)
      ]));
      card.appendChild(Dom.el('div', { class: 'input-row mb-3' }, [
        Fields.selectInput(base + 'paymentMode', 'Payment Method', ['MediSave + Cash', 'Full Cash Only (Foreigners)'])
      ]));
      card.appendChild(Dom.el('div', { class: 'text-tertiary mb-3', style: 'margin-top:-8px' }, [
        'Foreigners generally can\u2019t use MediSave (Singapore Citizens/PRs only) \u2014 switch to Full Cash Only to see the whole premium as an out-of-pocket cash cost instead.'
      ]));
      card.appendChild(Dom.el('div', { class: 'input-row mb-3' }, [
        Dom.el('div', { class: 'field' }, [
          Dom.el('label', { class: 'field-label' }, ["Today's Age"]),
          Dom.el('div', { style: 'padding:8px 12px;border-radius:10px;background:var(--accent-soft);font-size:12.5px;font-weight:600' }, [String(todaysAge) + ' (from Client Profile)'])
        ]),
        Fields.numberInput(base + 'endAge', 'Coverage To Age'),
        Fields.moneyInput(base + 'coverage', 'Annual Limit')
      ]));

      // ---- Today's premium ----
      card.appendChild(Dom.el('div', { class: 'grid grid-3', style: 'margin-bottom:12px' }, [
        heroStat("Today's Premium (Age " + todaysAge + ")", Dom.fmtMoney(todayRow.cash + todayRow.medisave), 'GSH cash ' + Dom.fmtMoney(todayRow.gshCash) + ' + GTC cash ' + Dom.fmtMoney(todayRow.gtcCash) + ' + MediSave ' + Dom.fmtMoney(todayRow.medisave)),
        heroStat('Total MediSave Premiums', Dom.fmtMoney(last.cumMedisave), range.from + '\u2013' + range.to + ' cumulative, GSH only'),
        heroStat('Total Cash Premiums (GSH + GTC)', Dom.fmtMoney(last.cumCash), range.from + '\u2013' + range.to + ' cumulative')
      ]));
      card.appendChild(Dom.el('div', { class: 'grid grid-2', style: 'margin-bottom:16px' }, [
        heroStat('\u2014 of which GSH Cash', Dom.fmtMoney(last.cumGshCash), 'GREAT SupremeHealth, above the CPF Additional Withdrawal Limit'),
        heroStat('\u2014 of which GTC Cash', Dom.fmtMoney(last.cumGtcCash), (p.riderKey ? (p.riderFamily === 'GTC2' ? 'GTC2 ' : 'GTC ') + p.riderKey : 'No rider selected') + ', fully cash-payable (no MediSave)')
      ]));

      card.appendChild(Dom.el('div', { class: 'input-row mb-3' }, [
        Fields.selectInput(base + 'projectFrom', 'Project Total Premiums From', PROJECT_FROM_OPTIONS)
      ]));

      var toggleHeader = Dom.el('div', {
        class: 'collapsible-header', onclick: function () {
          openPlans[p.id || idx] = !isOpen;
          Dom.withFocusPreserved(container, draw);
        }
      }, [
        Dom.el('div', { style: 'font-weight:700;font-size:13.5px' }, ['Annual Premium Projection']),
        Dom.el('svg', { class: 'chevron' + (isOpen ? ' open' : ''), width: '18', height: '18', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', html: '<path d="M6 9l6 6 6-6"/>' })
      ]);
      card.appendChild(toggleHeader);
      var body = Dom.el('div', { class: 'collapsible-body' + (isOpen ? ' open' : ''), style: 'margin-top:12px' });
      if (isOpen) {
        body.appendChild(Dom.el('div', { class: 'chart-wrap tall mb-3' }, [Dom.el('canvas', { id: 'hospChart' + idx })]));
        body.appendChild(projectionTable(proj));
        body.appendChild(fundingCalculator(p, idx, proj, todaysAge));
      }
      card.appendChild(body);

      if (isOpen) {
        requestAnimationFrame(function () {
          var t = Charts.themeColors();
          Charts.render(document.getElementById('hospChart' + idx), {
            type: 'bar',
            data: {
              labels: proj.map(function (r) { return r.age; }),
              datasets: [
                { label: 'Cash', data: proj.map(function (r) { return r.cash; }), backgroundColor: t.palette[0] },
                { label: 'MediSave', data: proj.map(function (r) { return r.medisave; }), backgroundColor: t.palette[2] }
              ]
            },
            options: { scales: { x: { stacked: true }, y: { stacked: true } } }
          });
          drawFundingChart(p, idx, proj, todaysAge);
        });
      }

      return card;
    }

    function riderSelect(p, idx) {
      var base = 'hospitalPlans.' + idx + '.';
      var options = InsurerRates.RIDER_OPTIONS[p.gshPlan] || InsurerRates.RIDER_OPTIONS['P Plus'];
      var wrap = Dom.el('div', { class: 'field' });
      wrap.appendChild(Dom.el('label', { class: 'field-label' }, ['Rider']));
      var current = p.riderFamily && p.riderKey ? (p.riderFamily + '|' + p.riderKey) : 'N/A';
      var select = Dom.el('select', {
        onchange: function (e) {
          var arr = Store.get('hospitalPlans');
          if (e.target.value === 'N/A') { arr[idx].riderFamily = null; arr[idx].riderKey = null; }
          else { var parts = e.target.value.split('|'); arr[idx].riderFamily = parts[0]; arr[idx].riderKey = parts[1]; }
          Store.set('hospitalPlans', arr);
        }
      });
      options.forEach(function (opt) {
        var value = opt.family ? (opt.family + '|' + opt.key) : 'N/A';
        var o = Dom.el('option', { value: value }, [opt.label]);
        if (value === current) o.setAttribute('selected', 'selected');
        select.appendChild(o);
      });
      wrap.appendChild(select);
      return wrap;
    }

    function projectionTable(proj) {
      var wrap = Dom.el('div', { class: 'table-scroll' });
      var table = Dom.el('table', { class: 'data-table compact-table' });
      table.appendChild(Dom.el('thead', {}, [Dom.el('tr', {}, ['Age', 'GSH Cash', 'GTC Cash', 'Total Cash', 'MediSave', 'Total', 'Cum. GSH Cash', 'Cum. GTC Cash', 'Cum. MediSave'].map(function (h) { return Dom.el('th', {}, [h]); }))]));
      var tbody = Dom.el('tbody');
      proj.forEach(function (r) {
        tbody.appendChild(Dom.el('tr', {}, [
          Dom.el('td', {}, [String(r.age)]),
          Dom.el('td', {}, [Dom.fmtMoney(r.gshCash)]),
          Dom.el('td', {}, [Dom.fmtMoney(r.gtcCash)]),
          Dom.el('td', {}, [Dom.fmtMoney(r.cash)]),
          Dom.el('td', {}, [Dom.fmtMoney(r.medisave)]),
          Dom.el('td', {}, [Dom.fmtMoney(r.totalPremium)]),
          Dom.el('td', {}, [Dom.fmtMoney(r.cumGshCash)]),
          Dom.el('td', {}, [Dom.fmtMoney(r.cumGtcCash)]),
          Dom.el('td', {}, [Dom.fmtMoney(r.cumMedisave)])
        ]));
      });
      table.appendChild(tbody); wrap.appendChild(table);
      return wrap;
    }

    // ---- Funding calculator: an investment meant to generate dividends
    // to offset the cash premium outflow (mirrors the "Investment
    // Calculator" panel from the reference screenshot). ----
    function fundingCalculator(p, idx, proj, todaysAge) {
      var base = 'hospitalPlans.' + idx + '.funding.';
      var funding = p.funding || { mode: 'Regular', amount: 0, growthRate: 5, dividendRate: 4 };
      var wrap = Dom.el('div', { class: 'card mt-3', style: 'background:var(--bg)' });
      wrap.appendChild(Dom.el('div', { style: 'font-weight:700;font-size:13.5px;margin-bottom:2px' }, ['Funding: Investment to Offset Cash Premiums']));
      wrap.appendChild(Dom.el('div', { class: 'text-tertiary mb-3' }, ['Fund dividends to service the cash portion of premiums above.']));
      wrap.appendChild(Dom.el('div', { class: 'input-row mb-3' }, [
        Fields.selectInput(base + 'mode', 'Mode', ['Lump Sum', 'Regular']),
        Fields.moneyInput(base + 'amount', (funding.mode === 'Lump Sum' || funding.mode === 'lumpSum') ? 'Lump Sum Amount' : 'Annual Investment'),
        Fields.numberInput(base + 'growthRate', 'Growth Rate %', { step: '0.5' }),
        Fields.numberInput(base + 'dividendRate', 'Dividend Rate %', { step: '0.5' })
      ]));

      var fundRows = fundingProjection(funding, todaysAge, proj);
      var year1 = fundRows[0] || { dividend: 0 };
      var premiumYear1 = (proj[0] || { cash: 0 }).cash;
      var deficit = premiumYear1 - year1.dividend;
      wrap.appendChild(Dom.el('div', { class: 'card', style: 'background:' + (deficit > 0 ? 'var(--bad-soft)' : 'var(--good-soft)') + ';padding:12px 16px' }, [
        Dom.el('div', { style: 'font-size:13px' }, [
          'Year-1 dividend: ', Dom.el('b', {}, [Dom.fmtMoney(year1.dividend)]), ' vs cash premium: ', Dom.el('b', {}, [Dom.fmtMoney(premiumYear1)]),
          ' \u2014 ', deficit > 0 ? ('Deficit ' + Dom.fmtMoney(deficit)) : ('Surplus ' + Dom.fmtMoney(-deficit))
        ])
      ]));
      wrap.appendChild(Dom.el('div', { class: 'chart-wrap mt-3' }, [Dom.el('canvas', { id: 'fundChart' + idx })]));
      return wrap;
    }

    function fundingProjection(funding, todaysAge, proj) {
      var growth = Calc.num(funding.growthRate) / 100;
      var divRate = Calc.num(funding.dividendRate) / 100;
      var amount = Calc.num(funding.amount);
      var fundValue = (funding.mode === 'Lump Sum' || funding.mode === 'lumpSum') ? amount : 0;
      var rows = [];
      proj.forEach(function (r, i) {
        if ((funding.mode === 'Regular' || funding.mode === 'regular')) fundValue += amount;
        fundValue = fundValue * (1 + growth);
        var dividend = fundValue * divRate;
        rows.push({ age: r.age, fundValue: fundValue, dividend: dividend });
      });
      return rows;
    }

    function drawFundingChart(p, idx, proj, todaysAge) {
      var funding = p.funding || { mode: 'Regular', amount: 0, growthRate: 5, dividendRate: 4 };
      var rows = fundingProjection(funding, todaysAge, proj);
      var t = Charts.themeColors();
      Charts.render(document.getElementById('fundChart' + idx), {
        type: 'line',
        data: {
          labels: rows.map(function (r) { return r.age; }),
          datasets: [
            { label: 'Fund Dividend', data: rows.map(function (r) { return r.dividend; }), borderColor: t.palette[2], backgroundColor: 'transparent', tension: 0.2 },
            { label: 'Cash Premium', data: proj.map(function (r) { return r.cash; }), borderColor: t.palette[3], backgroundColor: 'transparent', tension: 0.2, borderDash: [6, 4] }
          ]
        }
      });
    }

    function heroStat(label, value, sub) {
      return Dom.el('div', { class: 'card', style: 'background:var(--bg)' }, [
        Dom.el('div', { class: 'kpi-label' }, [label]),
        Dom.el('div', { class: 'kpi-value', style: 'font-size:17px' }, [value]),
        Dom.el('div', { class: 'text-tertiary mt-1' }, [sub])
      ]);
    }

    draw();
    return Store.subscribe('*', Dom.debounce(function () { Dom.withFocusPreserved(container, draw); }, 30));
  }

  return { title: 'Hospital Plan Premiums', render: render };
})();
