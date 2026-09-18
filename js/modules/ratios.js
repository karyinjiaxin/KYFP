/* ============================================================
   ratios.js — Financial Ratios module, gauge display
   ============================================================ */

var ModuleRatios = (function () {
  var LABELS = {
    savingsRatio: 'Savings Ratio', debtRatio: 'Debt Ratio', liquidityRatio: 'Liquidity Ratio',
    protectionRatio: 'Protection Ratio', investmentRatio: 'Investment Ratio', netWorthRatio: 'Net Worth Ratio',
    retirementRatio: 'Retirement Ratio', passiveIncomeRatio: 'Passive Income Ratio'
  };

  function gaugeSvg(pct, colorVar) {
    pct = Dom.clamp(pct, 0, 100);
    var r = 54, circ = 2 * Math.PI * r;
    var offset = circ * (1 - pct / 100);
    return '<svg viewBox="0 0 140 140" width="140" height="140">' +
      '<circle cx="70" cy="70" r="' + r + '" fill="none" stroke="var(--border)" stroke-width="12"/>' +
      '<circle cx="70" cy="70" r="' + r + '" fill="none" stroke="' + colorVar + '" stroke-width="12" stroke-linecap="round" ' +
      'stroke-dasharray="' + circ + '" stroke-dashoffset="' + offset + '" transform="rotate(-90 70 70)" style="transition: stroke-dashoffset 0.5s ease"/>' +
      '<text x="70" y="76" text-anchor="middle" font-size="22" font-weight="700" fill="var(--text-primary)">' + pct.toFixed(0) + '%</text>' +
      '</svg>';
  }

  function render(container) {
    function draw() {
      var c = Store.getAll();
      var r = Calc.financialRatios(c);
      container.innerHTML = '';
      container.appendChild(Dom.el('div', { class: 'page-header' }, [
        Dom.el('h1', {}, ['Financial Ratios']),
        Dom.el('div', { class: 'sub' }, ['Eight benchmark ratios computed live from every module.'])
      ]));

      var grid = Dom.el('div', { class: 'grid grid-3' });
      Object.keys(LABELS).forEach(function (key) {
        var pct = r[key];
        var color = pct >= 70 ? 'var(--good)' : (pct >= 40 ? 'var(--warn)' : 'var(--bad)');
        var gaugeWrap = Dom.el('div', { class: 'card', style: 'display:flex;flex-direction:column;align-items:center;gap:10px' });
        gaugeWrap.appendChild(Dom.el('div', { html: gaugeSvg(pct, color) }));
        gaugeWrap.appendChild(Dom.el('div', { style: 'font-weight:700;font-size:13.5px' }, [LABELS[key]]));
        grid.appendChild(gaugeWrap);
      });
      container.appendChild(grid);

      container.appendChild(Dom.el('div', { class: 'text-tertiary mt-3' }, ['Ratios are normalised to a 0–100% scale against standard planning benchmarks (e.g. 6-month liquidity target, 10x income protection, required retirement portfolio).']));
    }
    draw();
    return Store.subscribe('*', Dom.debounce(function () { Dom.withFocusPreserved(container, draw); }, 30));
  }
  return { title: 'Financial Ratios', render: render };
})();
