/* ============================================================
   charts.js — thin Chart.js wrapper, theme aware, fails gracefully
   if Chart.js CDN didn't load (e.g. offline preview).
   ============================================================ */

var Charts = (function () {
  var instances = {};
  var pluginRegistered = false;
  var leaderLinesRegistered = false;

  function available() { return typeof Chart !== 'undefined'; }

  // The datalabels plugin (chartjs-plugin-datalabels) is registered once,
  // globally, with labels OFF by default — otherwise every bar/line chart
  // in the app would suddenly grow numbers on top of every point. Charts
  // that want labels (the Cashflow bar chart) opt in explicitly per-chart
  // via options.plugins.datalabels.display = true.
  function ensurePlugin() {
    if (!available()) return;
    if (!pluginRegistered && typeof ChartDataLabels !== 'undefined') {
      Chart.register(ChartDataLabels);
      Chart.defaults.set('plugins.datalabels', { display: false });
      pluginRegistered = true;
    }
    if (!leaderLinesRegistered) {
      Chart.register(LeaderLinesPlugin);
      leaderLinesRegistered = true;
    }
  }

  // Custom plugin drawing genuine leader lines from each doughnut slice out
  // to an external label — the actual spreadsheet-donut look (a short line
  // out from the slice, an elbow, then the category name + %), not just an
  // outside-anchored text label. Chart.js/datalabels doesn't draw connector
  // lines on its own, so this is hand-drawn on the canvas after the chart
  // itself renders.
  var LeaderLinesPlugin = {
    id: 'leaderLines',
    afterDraw: function (chart, args, opts) {
      if (!opts || opts.enabled === false) return;
      var meta = chart.getDatasetMeta(0);
      if (!meta || !meta.data || !meta.data.length) return;
      var dataset = chart.data.datasets[0];
      var data = dataset.data;
      var total = data.reduce(function (a, b) { return a + (Number(b) || 0); }, 0);
      if (total <= 0) return;

      var ctx = chart.ctx;
      var lineColor = opts.lineColor || 'rgba(0,0,0,0.3)';
      var textColor = opts.textColor || '#333';
      var subColor = opts.subColor || '#888';
      var fontFamily = opts.fontFamily || 'sans-serif';
      var elbowLen = opts.elbowLength || 14;
      var horizLen = opts.horizLength || 20;
      var minPct = opts.minPercent != null ? opts.minPercent : 0.3;
      // Two label lines (name + %) need this much vertical room each —
      // two slices landing at similar angles (e.g. two small adjacent
      // categories near the top of the donut) previously got label
      // anchor points close enough together to overlap, since each
      // label's position was placed purely from its own slice's angle
      // with no awareness of any other label nearby.
      var minGap = opts.minLabelGap || 28;

      // Pass 1: each visible slice's natural (unadjusted) anchor points.
      var entries = [];
      meta.data.forEach(function (arc, i) {
        var value = Number(data[i]) || 0;
        var pct = (value / total) * 100;
        if (pct < minPct) return; // skip near-zero slices, too crowded/meaningless to label
        var props = arc.getProps(['startAngle', 'endAngle', 'outerRadius', 'x', 'y'], true);
        var mid = (props.startAngle + props.endAngle) / 2;
        var cos = Math.cos(mid), sin = Math.sin(mid);
        var cx = props.x, cy = props.y, r = props.outerRadius;
        var p1 = { x: cx + cos * r, y: cy + sin * r };
        var p2 = { x: cx + cos * (r + elbowLen), y: cy + sin * (r + elbowLen) };
        var isRight = cos >= -0.02;
        entries.push({
          i: i, pct: pct, label: (chart.data.labels && chart.data.labels[i]) || '',
          p1: p1, p2: p2, isRight: isRight,
          x: p2.x + (isRight ? horizLen : -horizLen), y: p2.y
        });
      });

      // Pass 2: resolve vertical collisions independently on each side
      // (left-side and right-side labels never compete with each other
      // for space) by sorting top-to-bottom and pushing any label that's
      // closer than minGap to the one above it further down, then
      // sweeping bottom-to-top the same way so a late push doesn't leave
      // an earlier pair newly too close together.
      ['left', 'right'].forEach(function (side) {
        var group = entries.filter(function (e) { return (side === 'right') === e.isRight; });
        group.sort(function (a, b) { return a.y - b.y; });
        for (var pass = 0; pass < 2; pass++) {
          for (var k = 1; k < group.length; k++) {
            if (group[k].y - group[k - 1].y < minGap) group[k].y = group[k - 1].y + minGap;
          }
          group.reverse();
          for (var k2 = 1; k2 < group.length; k2++) {
            if (group[k2 - 1].y - group[k2].y < minGap) group[k2].y = group[k2 - 1].y - minGap;
          }
          group.reverse();
        }
      });

      ctx.save();
      entries.forEach(function (e) {
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(e.p1.x, e.p1.y);
        ctx.lineTo(e.p2.x, e.p2.y);
        ctx.lineTo(e.x, e.y);
        ctx.stroke();

        ctx.fillStyle = lineColor;
        ctx.beginPath();
        ctx.arc(e.p1.x, e.p1.y, 2, 0, Math.PI * 2);
        ctx.fill();

        var tx = e.x + (e.isRight ? 5 : -5);
        ctx.textAlign = e.isRight ? 'left' : 'right';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = textColor;
        ctx.font = '600 11px ' + fontFamily;
        ctx.fillText(e.label, tx, e.y - 2);
        ctx.fillStyle = subColor;
        ctx.font = '10px ' + fontFamily;
        ctx.fillText(e.pct.toFixed(1) + '%', tx, e.y + 11);
      });
      ctx.restore();
    }
  };

  // Ready-to-spread options for a leader-line-labelled doughnut: hides the
  // legend (the lines + labels replace it), shrinks the doughnut slightly,
  // and pads the canvas so external labels have room without clipping.
  function leaderLineDonutOptions(textColor) {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      cutout: '52%',
      layout: { padding: { top: 26, bottom: 26, left: 90, right: 90 } },
      plugins: {
        legend: { display: false },
        leaderLines: {
          enabled: true,
          lineColor: dark ? 'rgba(255,255,255,0.32)' : 'rgba(20,37,38,0.32)',
          textColor: textColor,
          subColor: dark ? '#8FA6A4' : '#7C908E'
        }
      }
    };
  }

  // Validated categorical palette (CVD-safe adjacent pairs, contrast-checked
  // in both light and dark mode) — replaces the previous 6-color ad hoc
  // set so chart series are reliably distinguishable, including for
  // colorblind viewers. Order is the safety mechanism — keep it as-is.
  var PALETTE_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
  var PALETTE_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];

  function themeColors() {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      text: dark ? '#C2A0AB' : '#74565F',
      grid: dark ? 'rgba(255,255,255,0.07)' : 'rgba(43,10,28,0.08)',
      brass: dark ? '#B13A63' : '#8E1D42',
      brassSoft: dark ? 'rgba(177,58,99,0.24)' : 'rgba(142,29,66,0.18)',
      ink: dark ? '#F6E9ED' : '#230A16',
      palette: dark ? PALETTE_DARK : PALETTE_LIGHT
    };
  }

  // Enough distinct colors for ANY category count — a fixed list (the
  // theme palette plus a handful of extras) ran out for a client with
  // more categories than the list was long enough for, leaving later
  // slices with no backgroundColor at all (Chart.js draws those
  // transparent, reading as "a color is missing" on the donut). Evenly
  // spaced HSL hues always produce exactly as many distinct colors as
  // asked for, with no risk of running out or two slices accidentally
  // sharing an identical color.
  var EXTRA_PALETTE = ['#E0A458', '#6FA394', '#B98BB0', '#8B7EC8', '#5B8FA8'];
  function categoryColors(n, basePalette) {
    var base = (basePalette || PALETTE_LIGHT).concat(EXTRA_PALETTE);
    var colors = [];
    for (var i = 0; i < n; i++) {
      if (i < base.length) { colors.push(base[i]); continue; }
      var hue = Math.round((360 * i) / n);
      colors.push('hsl(' + hue + ', 62%, 52%)');
    }
    return colors;
  }

  function destroy(canvasId) {
    if (instances[canvasId]) { instances[canvasId].destroy(); delete instances[canvasId]; }
  }

  // Chart.js's own ResizeObserver (via responsive:true) is meant to catch
  // a layout change like print's own grid-column override and redraw at
  // the new size, but that isn't reliable enough across browsers for
  // print specifically — several charts were still drawn at their old,
  // wider on-screen size in the printout (one chart per row instead of
  // two/three side by side matching the print CSS). Called explicitly on
  // 'beforeprint' instead of relying on that observer alone.
  function resizeAll() {
    Object.keys(instances).forEach(function (id) {
      try {
        var chart = instances[id];
        var original = chart.options.animation;
        chart.options.animation = false;
        chart.resize();
        chart.options.animation = original;
      } catch (e) {}
    });
  }

  // The leader-lines donut (pulled-out labels connected by a hand-drawn
  // line, used so the legend can be hidden) only has room to position
  // those labels reliably at the width it's normally shown on screen.
  // Printing forces it into a narrower column (see the chart-row-2/
  // chart-row-3 print CSS), and at that width the collision-avoidance
  // math has to push labels further to avoid overlapping each other —
  // far enough, on a small enough circle, that a label can end up
  // sitting next to a DIFFERENT slice than the one its leader line
  // actually traces back to, reading as mismatched at a glance even
  // though the line itself is technically still correct (confirmed by
  // hovering the arc on screen, where the tooltip always shows the true
  // value — this was never a data bug). Rather than trying to make that
  // custom geometry robust at every possible width, print swaps to
  // Chart.js's own built-in legend (a plain swatch + text pairing Chart.js
  // manages natively, so it can't ever attach to the wrong slice) for the
  // print snapshot specifically, then swaps back once printing is done so
  // the normal pulled-out-label look returns on screen.
  var printLegendSwap = [];
  function usePrintSafeLegend() {
    printLegendSwap = [];
    Object.keys(instances).forEach(function (id) {
      var chart = instances[id];
      var plugins = chart.options && chart.options.plugins;
      if (!plugins || !plugins.leaderLines) return;
      printLegendSwap.push({ chart: chart, legendDisplay: plugins.legend ? plugins.legend.display : undefined, leaderLinesEnabled: plugins.leaderLines.enabled });
      plugins.leaderLines.enabled = false;
      plugins.legend = plugins.legend || {};
      plugins.legend.display = true;
      chart.update('none');
    });
  }
  function restoreNormalLegend() {
    printLegendSwap.forEach(function (entry) {
      var plugins = entry.chart.options && entry.chart.options.plugins;
      if (!plugins) return;
      plugins.leaderLines.enabled = entry.leaderLinesEnabled;
      if (plugins.legend) plugins.legend.display = entry.legendDisplay;
      try { entry.chart.update('none'); } catch (e) {}
    });
    printLegendSwap = [];
  }

  function render(canvas, config) {
    if (!available() || !canvas) {
      if (canvas) {
        canvas.parentElement.innerHTML = '<div class="empty-state" style="padding:20px"><div class="text-tertiary">Chart library unavailable offline — data shown in tables above.</div></div>';
      }
      return null;
    }
    ensurePlugin();
    destroy(canvas.id);
    var t = themeColors();
    config.options = config.options || {};
    config.options.plugins = config.options.plugins || {};
    config.options.plugins.legend = Object.assign({ labels: { color: t.text, font: { size: 11.5 }, boxWidth: 10, usePointStyle: true } }, config.options.plugins.legend || {});
    // Pie/doughnut callers opt out of x/y axis styling by passing
    // `scales: { x: false, y: false }` (they have no cartesian axes at
    // all) — but leaving the literal `false` sitting in the scale config
    // handed to `new Chart(...)` is exactly what was producing "Invalid
    // scale configuration for scale: x/y" in the console: Chart.js wants
    // the key absent entirely, not set to `false`. Delete it instead of
    // just skipping our own default styling for it.
    config.options.scales = config.options.scales || {};
    ['x', 'y'].forEach(function (ax) {
      if (config.options.scales[ax] === false) {
        delete config.options.scales[ax];
      } else {
        config.options.scales[ax] = Object.assign({
          ticks: { color: t.text, font: { size: 11 } },
          grid: { color: t.grid, drawBorder: false }
        }, config.options.scales[ax] || {});
      }
    });
    config.options.responsive = true;
    config.options.maintainAspectRatio = false;
    var chart = new Chart(canvas.getContext('2d'), config);
    instances[canvas.id] = chart;
    return chart;
  }


  // The five Dashboard charts' configs (data + options, no canvas) — a
  // single source of truth so Dashboard and the Summary report's "Show
  // all Dashboard graphs" section can never drift apart from each other.
  // Each caller renders these into its OWN canvas id (two pages can show
  // the same chart at once in a multi-tab printout, so ids can't collide).
  function dashboardConfigs(c) {
    var t = themeColors();
    var cats = c.cashflowCategories || [];
    var colors = categoryColors(cats.length, t.palette);

    var spendDonut = {
      type: 'doughnut',
      data: {
        labels: cats.map(function (cat) { return cat.name; }),
        datasets: [{ data: cats.map(Calc.categoryAnnualTotal), backgroundColor: colors }]
      },
      options: Object.assign({ scales: { x: false, y: false } }, leaderLineDonutOptions(t.text))
    };

    // With fewer than 2 history points a line chart just draws a dot, so
    // show today's figures as a simple bar instead; the line chart takes
    // over once there's a real trend to show.
    var hist = Calc.netWorthHistorySeries(c);
    var nwHistory = hist.length < 2 ? {
      type: 'bar',
      data: {
        labels: ['Assets', 'Net Worth', 'Liabilities'],
        datasets: [{
          data: [Calc.totalAssets(c), Calc.netWorth(c), Calc.totalLiabilities(c)],
          backgroundColor: [t.palette[1], t.palette[2], t.palette[3]]
        }]
      },
      options: { plugins: { legend: { display: false } } }
    } : {
      type: 'line',
      data: {
        labels: hist.map(function (h) { return h.month; }),
        datasets: [
          { label: 'Assets', data: hist.map(function (h) { return h.assets; }), borderColor: t.palette[1], backgroundColor: 'rgba(97,28,60,0.14)', fill: true, tension: 0.3 },
          { label: 'Net Worth', data: hist.map(function (h) { return h.netWorth; }), borderColor: t.brass, backgroundColor: t.brassSoft, fill: true, tension: 0.3 },
          { label: 'Liabilities', data: hist.map(function (h) { return -h.liabilities; }), borderColor: t.palette[3], backgroundColor: 'rgba(214,72,74,0.15)', fill: true, tension: 0.3 }
        ]
      }
    };

    var savingsGoal = Calc.num((c.budgetGoals || {}).savingsRateGoal);
    var savingsActual = Calc.savingsRate(c);
    var savingsRateChart = {
      type: 'bar',
      data: { labels: ['Goal', 'Actual'], datasets: [{ data: [savingsGoal, savingsActual], backgroundColor: [t.palette[1], t.palette[0]] }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: function (v) { return v + '%'; } } } } }
    };

    var nwGoal = Calc.num((c.budgetGoals || {}).netWorthGoal);
    var nwCurrent = Calc.netWorth(c);
    var nwGoalChart = {
      type: 'bar',
      data: { labels: ['Goal', 'Current'], datasets: [{ data: [nwGoal, nwCurrent], backgroundColor: [t.palette[1], t.brass] }] },
      options: { indexAxis: 'y', plugins: { legend: { display: false } } }
    };

    var invLabels = [], invValues = [];
    (c.investments || []).forEach(function (plan) {
      var rows = Calc.investmentPlanProjection(plan, plan.projectionAge);
      rows.forEach(function (r, idx) {
        if (!invLabels[idx]) invLabels[idx] = 'Age ' + r.age;
        invValues[idx] = (invValues[idx] || 0) + r.accumulatedValue;
      });
    });
    var trend = Calc.linearTrendline(invValues);
    var investTrend = {
      type: 'bar',
      data: {
        labels: invLabels,
        datasets: [
          { type: 'bar', label: 'Balance', data: invValues, backgroundColor: t.brass },
          { type: 'line', label: 'Trend', data: trend, borderColor: t.palette[1], borderDash: [5, 4], pointRadius: 0, fill: false }
        ]
      },
      options: { plugins: { legend: { display: false } } }
    };

    return { spendDonut: spendDonut, nwHistory: nwHistory, savingsRate: savingsRateChart, nwGoal: nwGoalChart, investTrend: investTrend };
  }

  return {
    render: render, destroy: destroy, resizeAll: resizeAll, themeColors: themeColors, available: available,
    leaderLineDonutOptions: leaderLineDonutOptions, dashboardConfigs: dashboardConfigs, categoryColors: categoryColors,
    usePrintSafeLegend: usePrintSafeLegend, restoreNormalLegend: restoreNormalLegend
  };
})();
