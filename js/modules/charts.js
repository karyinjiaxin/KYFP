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

      ctx.save();
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
        var p3 = { x: p2.x + (isRight ? horizLen : -horizLen), y: p2.y };

        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.stroke();

        ctx.fillStyle = lineColor;
        ctx.beginPath();
        ctx.arc(p1.x, p1.y, 2, 0, Math.PI * 2);
        ctx.fill();

        var label = (chart.data.labels && chart.data.labels[i]) || '';
        var tx = p3.x + (isRight ? 5 : -5);
        ctx.textAlign = isRight ? 'left' : 'right';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = textColor;
        ctx.font = '600 11px ' + fontFamily;
        ctx.fillText(label, tx, p3.y - 2);
        ctx.fillStyle = subColor;
        ctx.font = '10px ' + fontFamily;
        ctx.fillText(pct.toFixed(1) + '%', tx, p3.y + 11);
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

  function themeColors() {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      text: dark ? '#A0B7B5' : '#57706F',
      grid: dark ? 'rgba(255,255,255,0.07)' : 'rgba(13,52,58,0.07)',
      brass: dark ? '#F58868' : '#F26B4D',
      ink: dark ? '#EDF4F3' : '#142526',
      palette: ['#F26B4D', '#1A555D', '#1C9166', '#D6484A', '#7C6FB0', '#3E8FB1']
    };
  }

  function destroy(canvasId) {
    if (instances[canvasId]) { instances[canvasId].destroy(); delete instances[canvasId]; }
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
    config.options.scales = config.options.scales || {};
    ['x', 'y'].forEach(function (ax) {
      if (config.options.scales[ax] !== false) {
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

  return { render: render, destroy: destroy, themeColors: themeColors, available: available, leaderLineDonutOptions: leaderLineDonutOptions };
})();
