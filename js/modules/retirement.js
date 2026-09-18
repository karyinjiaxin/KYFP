/* ============================================================
   retirement.js
   ============================================================ */

var ModuleRetirement = (function () {
  // Attaches a listener to a field (as returned by Fields.*Input) that
  // marks a companion flag true the moment the advisor types into it —
  // used to distinguish "this was auto-filled with a default" from "the
  // advisor genuinely set this value", since the value alone (e.g. 0)
  // can't tell those two cases apart on its own.
  function markManuallySet(field, flagPath) {
    var input = field.querySelector('input');
    if (input) input.addEventListener('input', function () {
      if (!Store.get(flagPath)) Store.set(flagPath, true);
    });
    return field;
  }

  function render(container) {
    function draw() {
      var c = Store.getAll();
      var rp = Calc.retirementProjection(c);
      container.innerHTML = '';
      container.appendChild(Dom.el('div', { class: 'page-header' }, [
        Dom.el('h1', {}, ['Retirement Planning']),
        Dom.el('div', { class: 'sub' }, ['Draws on Cashflow surplus, CPF, and Investment Planning to project retirement readiness.'])
      ]));

      container.appendChild(Dom.el('div', { class: 'card mb-3', style: 'background:var(--accent-soft);border-color:var(--accent)' }, [
        Dom.el('div', { class: 'card-title' }, ['\u2139 Future value, not today\u2019s dollars']),
        Dom.el('div', { class: 'text-secondary' }, [
          'Every dollar figure below \u2014 Required Portfolio, Projected Assets, Retirement Gap \u2014 is expressed in future (nominal) dollars AT your retirement age, not in today\u2019s purchasing power. Inflation is already built in: your desired monthly income is inflated forward to retirement age before the required portfolio is worked out, and your assets are projected forward using the expected return above. So "S$2.5M required" means S$2.5M in the pocket the year you retire, which will buy less than S$2.5M does today.'
        ])
      ]));

      var inputsCard = Dom.el('div', { class: 'card' }, [Dom.el('div', { class: 'section-title', style: 'margin-top:0' }, ['⚙️ Inputs'])]);
      var currentAgeComputed = Calc.ageFromDob((c.personal || {}).dob);
      var row1;
      if (currentAgeComputed !== null) {
        row1 = Dom.el('div', { class: 'input-row compact-row narrow-row' }, [
          Dom.el('div', { class: 'field' }, [
            Dom.el('label', { class: 'field-label' }, ['Current Age']),
            Dom.el('div', { style: 'padding:9px 12px;border-radius:10px;background:var(--accent-soft);font-size:14px;font-weight:600' }, [String(currentAgeComputed) + ' (from Client Profile)'])
          ]),
          Fields.numberInput('retirement.retirementAge', 'Retirement Age'),
          Fields.numberInput('retirement.lifeExpectancy', 'Life Expectancy')
        ]);
      } else {
        row1 = Dom.el('div', { class: 'input-row compact-row narrow-row' }, [
          Fields.numberInput('retirement.currentAge', 'Current Age (set a date of birth in Client Profile to auto-fill this)'),
          Fields.numberInput('retirement.retirementAge', 'Retirement Age'),
          Fields.numberInput('retirement.lifeExpectancy', 'Life Expectancy')
        ]);
      }
      var row2 = Dom.el('div', { class: 'input-row compact-row narrow-row mt-2' }, [
        Fields.moneyInput('retirement.desiredMonthlyIncome', 'Desired Monthly Income (Today\u2019s Dollar)'),
        Fields.numberInput('retirement.inflation', 'Inflation %', { step: '0.1' })
      ]);
      var row2b = Dom.el('div', { class: 'input-row compact-row narrow-row mt-2' }, [
        Dom.el('div', { class: 'field' }, [
          Dom.el('label', { class: 'field-label' }, ['Projected Desired Monthly Income (Future Dollar)']),
          Dom.el('div', { style: 'padding:9px 12px;border-radius:10px;background:var(--accent-soft);font-size:14px;font-weight:600' }, [Dom.fmtMoney(Calc.projectedDesiredMonthlyIncome(c))])
        ]),
        Fields.moneyInput('retirement.cpfLifePayout', 'CPF LIFE Payout (monthly, future dollars, reference only)')
      ]);
      var cpfLifeEstimate = Calc.estimatedCpfLifePayout(c);
      var cpfLifeEstimateNote = Dom.el('div', { class: 'text-tertiary mt-1' }, [
        'Rough estimate from CPF Tab\u2019s projected Retirement Account at age 55 (before further growth): ' + Dom.fmtMoney(cpfLifeEstimate) + '/month (Standard Plan, adjusted for gender from Client Profile \u2014 female runs ~8% lower than male for the same RA balance, reflecting longer life expectancy \u2014 based on CPF Board\u2019s own published examples, \u00b115-20% at best) \u2014 ',
        Dom.el('a', {
          href: '#', style: 'color:var(--accent);cursor:pointer',
          onclick: function (e) { e.preventDefault(); Store.set('retirement.cpfLifePayout', Math.round(cpfLifeEstimate)); }
        }, ['Use this estimate']),
        '. Not an official CPF LIFE quote \u2014 for a precise figure, use the official CPF LIFE Estimator at cpf.gov.sg.'
      ]);
      var basisNote = Dom.el('div', { class: 'text-tertiary mt-1 mb-2', style: 'line-height:1.5' }, [
        'Enter your desired income in today\u2019s purchasing power \u2014 it\u2019s automatically inflated forward (at the rate above) to what that lifestyle will actually cost in the year you retire, shown alongside. Required Portfolio below is the FULL desired income need (not reduced by CPF LIFE or passive income) \u2014 CPF is already counted inside Projected Assets, so netting it out here too would credit it twice. CPF LIFE Payout is kept here for reference only.'
      ]);
      var row3 = Dom.el('div', { class: 'input-row compact-row narrow-row mt-2', style: 'max-width:220px' }, [
        Fields.numberInput('retirement.expectedReturn', 'Expected Return %', { step: '0.1' })
      ]);
      inputsCard.appendChild(row1); inputsCard.appendChild(row2); inputsCard.appendChild(row2b); inputsCard.appendChild(cpfLifeEstimateNote); inputsCard.appendChild(basisNote); inputsCard.appendChild(row3);
      container.appendChild(inputsCard);

      container.appendChild(Dom.el('div', { class: 'grid grid-kpi mt-3 mb-3' }, [
        kpiMini('Required Portfolio', Dom.fmtMoney(rp.requiredPortfolio), 'What\u2019s needed at retirement age to fund the full desired income (inflated forward) for the rest of life expectancy \u2014 gross, not reduced by CPF LIFE or passive income (those are already counted inside Projected Assets)'),
        kpiMini('Projected Assets', Dom.fmtMoney(rp.projectedAssets), 'Client\u2019s existing total portfolio (liquid + investments + full CPF balance), compounded at Expected Return, plus ongoing monthly investment \u2014 see breakdown below'),
        kpiMini('Retirement Gap', Dom.fmtMoney(rp.retirementGap), 'Required Portfolio minus Projected Assets (future dollars) \u2014 negative means a projected surplus, not a gap'),
        kpiMini('Years Remaining', rp.yearsToRetirement + ' yrs', 'Retirement Age minus Current Age'),
        kpiMini('Success Probability', rp.successProbability.toFixed(0) + '%', 'Projected Assets \u00f7 Required Portfolio \u2014 a simple ratio, not a Monte Carlo simulation, so treat it as directional')
      ]));

      // ---- How Required Portfolio is actually calculated, step by step ----
      var yearsInRetirement = Math.max(0, Calc.num((c.retirement || {}).lifeExpectancy) - Calc.num((c.retirement || {}).retirementAge));
      var inflationPct = Calc.num((c.retirement || {}).inflation);
      var expectedReturnPct = Calc.num((c.retirement || {}).expectedReturn);
      // Fisher equation: the correct way to derive a real (inflation-
      // adjusted) rate from a nominal one, rather than the simpler but
      // less accurate "nominal minus inflation" shortcut.
      var realReturnPct = Math.max(0.1, ((1 + expectedReturnPct / 100) / (1 + inflationPct / 100) - 1) * 100);
      var projectedFutureIncome = Calc.projectedDesiredMonthlyIncome(c);
      container.appendChild(Dom.el('div', { class: 'card mb-3' }, [
        Dom.el('div', { class: 'card-title' }, ['How Required Portfolio Is Calculated']),
        row('1. Desired Monthly Income (today\u2019s dollars)', Dom.fmtMoney((c.retirement || {}).desiredMonthlyIncome)),
        row('2. \u00d7 inflated forward ' + rp.yearsToRetirement + ' years @ ' + inflationPct + '%', Dom.fmtMoney(projectedFutureIncome) + '/mo at retirement'),
        row('3. Years the income needs to last (Life Expectancy \u2212 Retirement Age)', yearsInRetirement + ' years'),
        row('4. Real return used to discount (Fisher equation: (1+Expected Return)\u00f7(1+Inflation) \u2212 1)', realReturnPct.toFixed(2) + '%'),
        row('5. Required Portfolio = Step 2 as a ' + yearsInRetirement + '-year annuity, discounted at Step 4\u2019s rate', Dom.fmtMoney(rp.requiredPortfolio)),
        Dom.el('div', { class: 'text-tertiary mt-2', style: 'line-height:1.5' }, [
          'This is the standard "present value of an annuity" formula \u2014 it answers "how big a lump sum, invested and drawn down every month for ' + yearsInRetirement + ' years while still earning a real return, produces exactly the Step 2 income each month, ending at zero by life expectancy?" That\u2019s smaller than simply multiplying Step 2 \u00d7 12 \u00d7 ' + yearsInRetirement + ' years, because the portfolio keeps earning returns while it\u2019s being drawn down.'
        ])
      ]));

      // ---- How Projected Assets is calculated: existing client portfolio ----
      var monthlySurplusComputed = Calc.monthlySurplus(c);
      container.appendChild(Dom.el('div', { class: 'card mb-3' }, [
        Dom.el('div', { class: 'card-title' }, ['How Projected Assets Is Calculated']),
        Dom.el('div', { class: 'text-tertiary mb-2' }, [
          'These figures come from data entered on OTHER pages, not this one \u2014 Net Worth (liquid assets, investments), CPF (account balances), and Cashflow (income minus expenses). If you\u2019re expecting S$0 here for a new client, check that those three pages are also cleared \u2014 nothing typed on Retirement Planning itself drives Step 1 or the default in Step 2.'
        ]),
        row('1. Existing portfolio today (liquid + investments + full CPF balance), compounded at Expected Return for ' + rp.yearsToRetirement + ' years', Dom.fmtMoney(rp.fvLumpSum)),
        Dom.el('div', { class: 'input-row compact-row narrow-row', style: 'align-items:end;padding:6px 0' }, [
          Dom.el('div', { class: 'text-secondary', style: 'grid-column:span 2;align-self:center' }, ['2. + monthly amount invested, every month until retirement, compounding the same way']),
          Fields.moneyInput('retirement.monthlyInvestmentOverride', 'Monthly Amount Invested')
        ]),
        Dom.el('div', { class: 'text-tertiary', style: 'padding:0 0 4px' }, [
          'Defaults to S$0, so Projected Assets first shows the client\u2019s do-nothing baseline \u2014 what they\u2019ll have if they invest nothing further. Cashflow\u2019s current Monthly Surplus is ' + Dom.fmtMoney(monthlySurplusComputed) + ' \u2014 ',
          Dom.el('a', {
            href: '#', style: 'color:var(--accent);cursor:pointer',
            onclick: function (e) {
              e.preventDefault();
              Store.set('retirement.monthlyInvestmentOverride', Math.round(Math.max(0, monthlySurplusComputed) * 100) / 100);
            }
          }, ['use this to see the "if I invest my full surplus" scenario instead'])
        ]),
        row('= Projected Assets', Dom.fmtMoney(rp.projectedAssets)),
        Dom.el('div', { class: 'text-tertiary mt-2', style: 'line-height:1.5' }, [
          'Uses the client\u2019s existing total portfolio as-is (today\u2019s liquid assets + investments + full CPF balance) \u2014 no separate CPF LIFE calculation here.'
        ])
      ]));

      // ---- #11: Gap framed as an action, not an intimidating dollar figure,
      // with its OWN dedicated Expected Return / years inputs so this
      // "what would it take to close the gap" scenario can be explored
      // independently of the main assumptions above. ----
      var gapReturnPct = (c.retirement || {}).gapClosingReturn != null && (c.retirement || {}).gapClosingReturn !== ''
        ? Calc.num((c.retirement || {}).gapClosingReturn) : Calc.num((c.retirement || {}).expectedReturn);
      var gapYears = (c.retirement || {}).gapClosingYears != null && (c.retirement || {}).gapClosingYears !== ''
        ? Calc.num((c.retirement || {}).gapClosingYears) : rp.yearsToRetirement;
      var extraMonthly = Calc.additionalMonthlyForGap(rp.retirementGap, gapReturnPct, gapYears);
      container.appendChild(Dom.el('div', { class: 'card mb-3', style: 'background:' + (rp.retirementGap > 0 ? 'var(--bad-soft)' : 'var(--good-soft)') }, [
        Dom.el('div', { class: 'card-title' }, ['Where You\u2019re Headed vs Where You Want to Be']),
        Dom.el('div', { style: 'font-size:13.5px;line-height:1.7' }, [
          rp.retirementGap > 0
            ? Dom.el('span', {}, [
                'At the current savings rate, this client is tracking toward ', Dom.el('b', {}, [Dom.fmtMoney(rp.projectedAssets)]),
                ' by retirement. To reach the lifestyle described (', Dom.fmtMoney(rp.requiredPortfolio), '), the target is roughly ',
                Dom.el('b', {}, [Dom.fmtMoney(rp.requiredPortfolio)]), '. That translates into investing approximately ',
                Dom.el('b', { style: 'color:var(--accent)' }, [Dom.fmtMoney(extraMonthly) + '/month']),
                ' more from now until retirement \u2014 not an intimidating ', Dom.fmtMoney(rp.retirementGap), ' "shortfall".'
              ])
            : Dom.el('span', {}, [
                'At the current savings rate, this client is tracking toward ', Dom.el('b', {}, [Dom.fmtMoney(rp.projectedAssets)]),
                ' by retirement \u2014 already ahead of the ', Dom.fmtMoney(rp.requiredPortfolio), ' target for the lifestyle described.'
              ])
        ]),
        rp.retirementGap > 0 ? Dom.el('div', { class: 'text-secondary mt-2 pt-2', style: 'line-height:1.6;border-top:1px solid var(--border)' }, [
          Dom.el('div', { style: 'font-weight:700;margin-bottom:6px' }, ['How ' + Dom.fmtMoney(extraMonthly) + '/month was derived']),
          Dom.el('div', { class: 'input-row compact-row narrow-row mb-2' }, [
            markManuallySet(Fields.numberInput('retirement.gapClosingYears', 'Years to Invest', { step: '1' }), 'retirement.gapClosingYearsManuallySet'),
            markManuallySet(Fields.numberInput('retirement.gapClosingReturn', 'Return Assumed %', { step: '0.1' }), 'retirement.gapClosingReturnManuallySet')
          ]),
          Dom.el('div', {}, ['\u2022 Gap to close (future dollars, at retirement age): ', Dom.el('b', {}, [Dom.fmtMoney(rp.retirementGap)])]),
          Dom.el('div', {}, ['\u2022 Years to invest: ', Dom.el('b', {}, [gapYears + ' years']), ' (defaults to Retirement Age \u2212 Current Age; override above)']),
          Dom.el('div', {}, ['\u2022 Return assumed while investing: ', Dom.el('b', {}, [gapReturnPct + '%']), ' (defaults to the main Expected Return above; override above for a different "what if" scenario)']),
          Dom.el('div', { class: 'mt-1' }, ['The gap is treated as the future value of a monthly investment made every month for that many years at that return \u2014 solved backwards for the monthly payment, the same math as "how much do I need to invest monthly to reach $X in Y years at Z% return". Change either field above (independent of the rest of the page) to test a different scenario for closing this specific gap.'])
        ]) : null
      ]));

      container.appendChild(Dom.el('div', { class: 'card mb-3' }, [
        Dom.el('div', { class: 'card-title' }, ['\ud83c\udfaf Readiness (projected AT retirement)']),
        Dom.el('div', { class: 'progress-track' }, [Dom.el('div', { class: 'progress-fill', style: 'width:' + Dom.clamp(rp.successProbability, 0, 100) + '%' })]),
        Dom.el('div', { class: 'text-secondary mt-2' }, [
          rp.retirementGap > 0
            ? ('Projected shortfall of ' + Dom.fmtMoney(rp.retirementGap) + ' at retirement age ' + (c.retirement || {}).retirementAge + '.')
            : 'On track to meet the required portfolio at the target retirement age.'
        ]),
        Dom.el('div', { class: 'text-tertiary mt-2' }, [
          'This looks FORWARD to retirement age \u2014 it credits every year still remaining to grow assets and add contributions (Steps 1 + 2 above). It can read very differently from "Retirement Funded" further down the page, which is a snapshot of TODAY only, with no future growth or contributions counted, and excluding the home and MediSave. Both are correct; they\u2019re just answering different questions ("will I get there eventually" vs "how far along am I right now").'
        ])
      ]));

      // ---- #10: Milestones anchored to funding %, not arbitrary ages ----
      var milestones = Calc.retirementMilestones(c);
      if (milestones.length) {
        container.appendChild(Dom.el('div', { class: 'section-title' }, ['\ud83c\udfc1 Milestones on the Way']));
        container.appendChild(Dom.el('div', { class: 'text-secondary mb-2' }, [
          'Anchored to round funding percentages of the goal (25% / 50% / 75% / 100%) rather than even age gaps \u2014 "you\u2019re halfway funded" is usually an easier story for a client than an arbitrary age and dollar figure. The age shown for each is when the projection (current investable assets + monthly contributions, both grown at Expected Return) actually crosses that percentage.'
        ]));
        var milestoneRow = Dom.el('div', { class: 'grid', style: 'grid-template-columns:repeat(' + milestones.length + ',1fr);gap:12px' });
        milestones.forEach(function (m) {
          var badgeClass = m.pct >= 100 ? 'badge-good' : m.pct >= 50 ? 'badge-warn' : 'badge-bad';
          var displayAge = Math.round(m.age);
          var borderColor = m.pct >= 100 ? 'var(--good)' : m.pct >= 50 ? 'var(--warn)' : 'var(--brass-500)';
          milestoneRow.appendChild(Dom.el('div', { class: 'card', style: 'text-align:center;padding:14px 10px;border-top:3px solid ' + borderColor }, [
            Dom.el('div', { class: 'text-tertiary', style: 'font-weight:700;text-transform:uppercase' }, [m.isToday ? 'Today (age ' + Math.round(m.age) + ')' : m.isRetirement ? '\ud83c\udfc6 Retirement (age ' + Math.round(m.age) + ')' : 'Age ' + displayAge]),
            Dom.el('div', { style: 'font-family:var(--font-serif);font-size:20px;font-weight:800;margin:6px 0;color:' + borderColor }, [Math.round(m.pct) + '%']),
            Dom.el('div', { style: 'font-size:12.5px;font-weight:600;margin-bottom:4px' }, [Dom.fmtMoney(m.value)]),
            Dom.el('div', { class: 'badge ' + badgeClass, style: 'font-size:9.5px' }, [m.label])
          ]));
        });
        container.appendChild(Dom.el('div', { class: 'mb-3' }, [milestoneRow]));
      }

      // ---- #12: Net worth vs retirement-funded assets ----
      var split = Calc.retirementAssetSplit(c);
      container.appendChild(Dom.el('div', { class: 'section-title' }, ['\ud83c\udfe0 Net Worth vs Retirement-Funded Assets']));
      container.appendChild(Dom.el('div', { class: 'text-secondary mb-2', style: 'line-height:1.6' }, [
        'The point of this section: not every dollar of net worth can actually pay for retirement. A paid-off home is worth a lot, but the client can\u2019t spend it on groceries without selling or borrowing against it. So before asking "is this client on track for retirement", we first strip OUT the net worth that isn\u2019t realistically available to fund retirement income \u2014 the home, and MediSave (which by law can only be spent on approved healthcare, never on daily living costs) \u2014 leaving only what\u2019s genuinely available to generate a retirement paycheque. That smaller number is compared against the goal below.'
      ]));
      container.appendChild(Dom.el('div', { class: 'card mb-3' }, [
        row('Net Worth (everything the client owns, minus debts)', Dom.fmtMoney(split.netWorth)),
        row('\u2212 Home / Lifestyle Assets (net equity \u2014 can\u2019t easily spend a house)', Dom.fmtMoney(split.homeLifestyle)),
        row('\u2212 MediSave (legally healthcare-only, can\u2019t fund daily retirement spending)', Dom.fmtMoney(split.medisave)),
        row('= Income-Producing Retirement Assets (what\u2019s actually available today)', Dom.fmtMoney(split.incomeProducing)),
        row('Retirement Asset Goal (in today\u2019s dollars)', Dom.fmtMoney(split.retirementGoalPV)),
        Dom.el('div', { class: 'text-tertiary', style: 'padding:2px 0 4px' }, [
          'This goal is the same "Required Portfolio" figure explained above (' + Dom.fmtMoney(split.retirementGoal) + ' in future dollars, at retirement age), just converted into today\u2019s dollars so it\u2019s a fair comparison against what the client has TODAY (rather than comparing today\u2019s money against a future number, which would understate progress). Simple analogy: needing $2.5M in 30 years is a lot like needing roughly $900K today, if that $900K is left to grow untouched at the Expected Return rate until then \u2014 same destination, just expressed in today\u2019s terms instead of future terms.'
        ]),
        Dom.el('div', { class: 'mt-3' }, [
          Dom.el('div', { class: 'flex justify-between items-center mb-2' }, [
            Dom.el('div', { style: 'font-weight:700;font-size:13px' }, ['\ud83d\udcca Retirement Funded (snapshot TODAY)']),
            Dom.el('div', { class: 'badge ' + (split.fundedPct >= 100 ? 'badge-good' : split.fundedPct >= 50 ? 'badge-warn' : 'badge-bad') }, [Dom.fmtPct(split.fundedPct)])
          ]),
          Dom.el('div', { class: 'progress-track' }, [Dom.el('div', { class: 'progress-fill', style: 'width:' + Dom.clamp(split.fundedPct, 0, 100) + '%' })])
        ]),
        Dom.el('div', { class: 'text-tertiary mt-3', style: 'line-height:1.5' }, [
          'Compares today\u2019s income-producing assets directly against the future-dollar retirement goal \u2014 a simplified, directional read (not present-value-adjusted) that\u2019s meant to be easy to explain, not an exact figure. A large home doesn\u2019t generate retirement income unless downsized or leveraged, so it\u2019s shown separately here rather than folded into "on track".'
        ])
      ]));

      container.appendChild(Dom.el('div', { class: 'section-title' }, ['\ud83d\udcc8 Projected Assets vs Required Portfolio']));
      container.appendChild(Dom.el('div', { class: 'card' }, [
        Dom.el('div', { class: 'chart-wrap tall' }, [Dom.el('canvas', { id: 'retirementChart' })]),
        Dom.el('div', { class: 'text-tertiary mt-3', style: 'line-height:1.5' }, [
          'Solid line: actual projected asset growth (today\u2019s assets + monthly surplus, compounding at the expected return above). ',
          'Dashed line ("steady pace"): a straight-line reference from today\u2019s assets to the Required Portfolio figure — the balance you\u2019d need at each age if closing the gap at a perfectly even pace. If the solid line sits above the dashed one, the client is ahead of the pace they need; below it, they\u2019re behind.'
        ])
      ]));

      requestAnimationFrame(function () {
        var t = Charts.themeColors();
        var projectedPoints = Calc.retirementAssetTrajectory(c);
        var pacePoints = Calc.requiredPortfolioPace(c);
        Charts.render(document.getElementById('retirementChart'), {
          type: 'line',
          data: {
            labels: projectedPoints.map(function (p) { return p.age; }),
            datasets: [
              { label: 'Projected Assets', data: projectedPoints.map(function (p) { return p.value; }), borderColor: '#1A555D', borderWidth: 3, backgroundColor: 'transparent', tension: 0.3 },
              { label: 'Required Portfolio (steady pace)', data: pacePoints.map(function (p) { return p.value; }), borderColor: '#F26B4D', borderWidth: 3, borderDash: [8, 5], backgroundColor: 'transparent', tension: 0 }
            ]
          }
        });
      });
    }
    function kpiMini(label, value, caption) {
      var children = [Dom.el('div', { class: 'kpi-label' }, [label]), Dom.el('div', { class: 'kpi-value' }, [value])];
      if (caption) children.push(Dom.el('div', { class: 'text-tertiary mt-1', style: 'line-height:1.4' }, [caption]));
      return Dom.el('div', { class: 'card kpi-card' }, children);
    }
    function row(label, value) {
      return Dom.el('div', { class: 'flex justify-between items-center', style: 'padding:7px 0;border-bottom:1px solid var(--border)' }, [
        Dom.el('div', { class: 'text-secondary' }, [label]),
        Dom.el('div', { style: 'font-weight:700;font-size:13.5px' }, [value])
      ]);
    }
    draw();
    return Store.subscribe('*', Dom.debounce(function () { Dom.withFocusPreserved(container, draw); }, 30));
  }
  return { title: 'Retirement Planning', render: render };
})();
