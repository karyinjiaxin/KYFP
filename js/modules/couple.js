/* ============================================================
   couple.js — Couple Planning: a READ-ONLY combined view of two
   linked, independently-stored clients. Neither client's own data
   is ever written to from here — this only reads both and adds
   the results together for a household picture. Editing always
   happens on each partner's own pages; use "Switch to Partner" to
   go do that, or Settings > Saved Clients to load either one on
   its own in a future, separate meeting.
   ============================================================ */

var ModuleCouple = (function () {
  function render(container) {
    function draw() {
      var c = Store.getAll();
      container.innerHTML = '';
      container.appendChild(Dom.el('div', { class: 'page-header' }, [
        Dom.el('h1', {}, ['\ud83d\udc91 Couple Planning']),
        Dom.el('div', { class: 'sub' }, ['A combined household view when meeting a linked couple together \u2014 each partner\u2019s own data stays fully separate and editable on their own.'])
      ]));

      var partnerId = (c.personal || {}).partnerClientId;
      var savedClients = Store.listSavedClients();
      var partnerEntry = (partnerId && savedClients) ? savedClients.filter(function (e) { return e.id === partnerId; })[0] : null;

      if (!partnerEntry) {
        container.appendChild(Dom.el('div', { class: 'card empty-state' }, [
          Dom.el('div', { style: 'font-size:13.5px;font-weight:700;margin-bottom:8px' }, ['No partner linked yet']),
          Dom.el('div', { class: 'text-secondary', style: 'margin-bottom:16px' }, [
            'Combined household planning needs two linked clients. Go to Client Profile to add this client\u2019s partner \u2014 each stays a fully separate, independently-saved client (loadable on its own if you meet them separately later); this page just adds both together for when you\u2019re meeting them as a couple.'
          ]),
          Dom.el('button', { class: 'btn btn-primary', onclick: function () { window.location.hash = 'profile'; } }, ['Go to Client Profile'])
        ]));
        return;
      }

      var partnerData = partnerEntry.data;
      var currentName = (c.personal || {}).name || 'This client';
      var partnerName = (partnerData.personal || {}).name || partnerEntry.label || 'Partner';

      container.appendChild(Dom.el('div', { class: 'card mb-3', style: 'background:var(--accent-soft)' }, [
        Dom.el('div', { class: 'flex justify-between items-center' }, [
          Dom.el('div', {}, [
            Dom.el('div', { style: 'font-weight:700;font-size:12.5px' }, ['\ud83d\udc65 ' + currentName + ' + ' + partnerName]),
            Dom.el('div', { class: 'text-secondary mt-1' }, [
              'Read-only combined view \u2014 nothing here is editable or saved. ' + partnerName + '\u2019s figures reflect their last-saved snapshot (' + new Date(partnerEntry.savedAt).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' }) + '); save ' + currentName + ' regularly too, so both sides of this combined view stay current.'
            ])
          ]),
          Dom.el('button', {
            class: 'btn btn-secondary btn-sm',
            onclick: function () { Store.quickSave(); Store.loadSavedClient(partnerId); window.location.hash = 'profile'; }
          }, ['Switch to ' + partnerName])
        ])
      ]));

      // ---- Combined Net Worth ----
      var nw = Calc.combinedNetWorth(c, partnerData);
      container.appendChild(Dom.el('div', { class: 'section-title', style: 'margin-top:0' }, ['\ud83c\udfe0 Combined Net Worth']));
      container.appendChild(Dom.el('div', { class: 'grid grid-kpi mb-3' }, [
        kpiMini('Combined Net Worth', Dom.fmtMoney(nw.netWorth), null, 'violet'),
        kpiMini(currentName + '\u2019s Net Worth', Dom.fmtMoney(nw.assetsA - nw.liabA), null, 'blue'),
        kpiMini(partnerName + '\u2019s Net Worth', Dom.fmtMoney(nw.assetsB - nw.liabB), null, 'pink'),
        kpiMini('Combined Total Assets', Dom.fmtMoney(nw.totalAssets), null, 'green'),
        kpiMini('Combined Total Liabilities', Dom.fmtMoney(nw.totalLiabilities), null, 'red')
      ]));

      // ---- Combined Retirement Projection ----
      var rp = Calc.combinedRetirementProjection(c, partnerData);
      container.appendChild(Dom.el('div', { class: 'section-title' }, ['\ud83d\udcc8 Combined Retirement Projection']));
      container.appendChild(Dom.el('div', { class: 'text-secondary mb-2' }, [
        'Each partner\u2019s own Required Portfolio and Projected Assets (from their own Retirement Planning inputs \u2014 desired income, expected return, current age, etc.) are simply added together. If one partner\u2019s "Desired Monthly Income" already represents the FULL household lifestyle (with the other left at S$0), the combined total will still come out correctly \u2014 the math doesn\u2019t assume either convention specifically.'
      ]));
      container.appendChild(Dom.el('div', { class: 'grid grid-kpi mb-3' }, [
        kpiMini('Combined Required Portfolio', Dom.fmtMoney(rp.requiredPortfolio), 'Future dollars, at each partner\u2019s own retirement age', 'blue'),
        kpiMini('Combined Projected Assets', Dom.fmtMoney(rp.projectedAssets), null, 'burgundy'),
        kpiMini('Combined Retirement Gap', Dom.fmtMoney(rp.retirementGap), rp.retirementGap > 0 ? 'A projected shortfall' : 'Negative means a projected surplus', rp.retirementGap > 0 ? 'red' : 'green'),
        kpiMini('Combined Readiness', rp.successProbability.toFixed(0) + '%', 'Combined Projected \u00f7 Combined Required', rp.successProbability >= 100 ? 'green' : 'yellow')
      ]));

      var breakdownCard = Dom.el('div', { class: 'card mb-3' });
      breakdownCard.appendChild(Dom.el('div', { class: 'card-title' }, ['Individual Contributions to the Combined Figures']));
      var tableWrap = Dom.el('div', { class: 'table-scroll' });
      var table = Dom.el('table', { class: 'data-table' });
      table.appendChild(Dom.el('thead', {}, [Dom.el('tr', {}, ['', currentName, partnerName, 'Combined'].map(function (h) { return Dom.el('th', {}, [h]); }))]));
      var tbody = Dom.el('tbody');
      [
        ['Required Portfolio', rp.rpA.requiredPortfolio, rp.rpB.requiredPortfolio, rp.requiredPortfolio],
        ['Projected Assets', rp.rpA.projectedAssets, rp.rpB.projectedAssets, rp.projectedAssets],
        ['Retirement Gap', rp.rpA.retirementGap, rp.rpB.retirementGap, rp.retirementGap]
      ].forEach(function (row) {
        tbody.appendChild(Dom.el('tr', {}, [
          Dom.el('td', { style: 'font-weight:600' }, [row[0]]),
          Dom.el('td', {}, [Dom.fmtMoney(row[1])]),
          Dom.el('td', {}, [Dom.fmtMoney(row[2])]),
          Dom.el('td', { style: 'font-weight:700' }, [Dom.fmtMoney(row[3])])
        ]));
      });
      table.appendChild(tbody); tableWrap.appendChild(table); breakdownCard.appendChild(tableWrap);
      container.appendChild(breakdownCard);

      // ---- Combined Cash Flow Roadmap ----
      var roadmapRows = Calc.combinedRoadmapProjection(c, partnerData);
      container.appendChild(Dom.el('div', { class: 'section-title' }, ['🗺️ Combined Cash Flow Roadmap']));
      container.appendChild(Dom.el('div', { class: 'text-secondary mb-2' }, [
        'Each partner’s own year-by-year Cash Flow Roadmap (their own balance, income, expenses, life events) added together by calendar year — not by age, since partners are rarely the same age. A year only one partner’s roadmap covers still shows, using just that partner’s own figures for it.'
      ]));
      if (roadmapRows.length === 0) {
        container.appendChild(Dom.el('div', { class: 'card mb-3 empty-state' }, ['Set Current Age, Retirement Age and Life Expectancy on both partners’ Retirement Planning first.']));
      } else {
        var lowestRow = roadmapRows.reduce(function (min, r) { return r.balance < min.balance ? r : min; }, roadmapRows[0]);
        container.appendChild(Dom.el('div', { class: 'grid grid-kpi mb-3' }, [
          kpiMini('Lowest Combined Balance', Dom.fmtMoney(lowestRow.balance), 'Year ' + lowestRow.year + ' (' + lowestRow.ages.join(', ') + ')', lowestRow.balance < 0 ? 'red' : 'green'),
          kpiMini('Ends At', Dom.fmtMoney(roadmapRows[roadmapRows.length - 1].balance), 'Year ' + roadmapRows[roadmapRows.length - 1].year, roadmapRows[roadmapRows.length - 1].balance < 0 ? 'red' : 'green')
        ]));
        var roadmapCard = Dom.el('div', { class: 'card' });
        var roadmapTableWrap = Dom.el('div', { class: 'table-scroll' });
        var roadmapTable = Dom.el('table', { class: 'data-table' });
        roadmapTable.appendChild(Dom.el('thead', {}, [Dom.el('tr', {}, ['Year', 'Ages', 'Combined Balance', 'Income Credited', 'Expenses Deducted', 'Life Event Net'].map(function (h) { return Dom.el('th', {}, [h]); }))]));
        var roadmapBody = Dom.el('tbody');
        roadmapRows.forEach(function (r) {
          var isNegative = r.balance < 0;
          var eventColor = r.eventNet > 0 ? 'color:var(--good);font-weight:700' : r.eventNet < 0 ? 'color:var(--burgundy);font-weight:700' : '';
          roadmapBody.appendChild(Dom.el('tr', {}, [
            Dom.el('td', {}, [String(r.year)]),
            Dom.el('td', { class: 'text-tertiary' }, [r.ages.join(', ')]),
            Dom.el('td', { style: 'font-weight:700;' + (isNegative ? 'color:var(--bad)' : '') }, [Dom.fmtMoney(r.balance)]),
            Dom.el('td', {}, [r.incomeCredited + r.retirementPayoutCredited > 0 ? Dom.fmtMoney(r.incomeCredited + r.retirementPayoutCredited) : '—']),
            Dom.el('td', { style: 'color:var(--burgundy)' }, ['−' + Dom.fmtMoney(r.expensesDeducted)]),
            Dom.el('td', { style: eventColor }, [r.eventNet !== 0 ? Dom.fmtMoney(r.eventNet) : '—'])
          ]));
        });
        roadmapTable.appendChild(roadmapBody); roadmapTableWrap.appendChild(roadmapTable); roadmapCard.appendChild(roadmapTableWrap);
        container.appendChild(roadmapCard);
      }

      container.appendChild(Dom.el('div', { class: 'text-tertiary' }, [
        'To edit either partner\u2019s own numbers, use "Switch to ' + partnerName + '" above, or load either client independently anytime via Settings \u2192 Saved Clients \u2014 nothing about this combined view links or merges their underlying data.'
      ]));
    }

    function kpiMini(label, value, caption, accent) {
      var children = [Dom.el('div', { class: 'kpi-label' }, [label]), Dom.el('div', { class: 'kpi-value' }, [value])];
      if (caption) children.push(Dom.el('div', { class: 'text-tertiary mt-1' }, [caption]));
      return Dom.el('div', { class: 'card kpi-card' + (accent ? ' kpi-accent-' + accent : '') }, children);
    }

    draw();
    return Store.subscribe('*', Dom.debounce(function () { Dom.withFocusPreserved(container, draw); }, 30));
  }
  return { title: 'Couple Planning', render: render };
})();
