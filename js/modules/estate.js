/* ============================================================
   estate.js — Estate Planning module
   ============================================================ */

var ModuleEstate = (function () {
  function render(container) {
    function draw() {
      var c = Store.getAll();
      var e = c.estate || {};
      container.innerHTML = '';
      container.appendChild(Dom.el('div', { class: 'page-header' }, [
        Dom.el('h1', {}, ['Estate Planning']),
        Dom.el('div', { class: 'sub' }, ['Wills, LPA status and distribution intentions, alongside the estate size from Net Worth.'])
      ]));

      container.appendChild(Dom.el('div', { class: 'grid grid-kpi mb-3' }, [
        kpiMini('Estate Size (Net Worth)', Dom.fmtMoney(Calc.netWorth(c))),
        kpiMini('Will Status', e.hasWill || 'Not set'),
        kpiMini('LPA Status', e.hasLPA || 'Not set')
      ]));

      var card = Dom.el('div', { class: 'card' }, [Dom.el('div', { class: 'section-title', style: 'margin-top:0' }, ['⚖️ Estate Details'])]);
      card.appendChild(Dom.el('div', { class: 'input-row' }, [
        Fields.selectInput('estate.hasWill', 'Has Will?', ['Yes', 'No', 'In Progress']),
        Fields.textInput('estate.willLastUpdated', 'Will Last Updated (DD/MM/YYYY)', { placeholder: 'e.g. 01/03/2024' }),
        Fields.selectInput('estate.hasLPA', 'Has LPA?', ['Yes', 'No', 'In Progress'])
      ]));
      card.appendChild(Dom.el('div', { class: 'input-row mt-2' }, [
        Fields.textInput('estate.executors', 'Executor(s)'),
        Fields.textInput('estate.trustees', 'Trustee(s)')
      ]));
      card.appendChild(Dom.el('div', { class: 'mt-2' }, [Fields.textInput('estate.notes', 'Notes', { multiline: true, rows: 4 })]));
      container.appendChild(card);

      container.appendChild(Dom.el('div', { class: 'section-title' }, ['👨‍👩‍👧 Dependants']));
      var wrap = Dom.el('div', { class: 'table-scroll' });
      var table = Dom.el('table', { class: 'data-table' });
      table.appendChild(Dom.el('thead', {}, [Dom.el('tr', {}, ['Name', 'Relation', 'Age'].map(function (h) { return Dom.el('th', {}, [h]); }))]));
      var tbody = Dom.el('tbody');
      (c.dependants || []).forEach(function (d) {
        tbody.appendChild(Dom.el('tr', {}, [Dom.el('td', {}, [d.name]), Dom.el('td', {}, [d.relation]), Dom.el('td', {}, [String(d.age)])]));
      });
      table.appendChild(tbody); wrap.appendChild(table); container.appendChild(wrap);
    }
    function kpiMini(label, value) {
      return Dom.el('div', { class: 'card kpi-card' }, [Dom.el('div', { class: 'kpi-label' }, [label]), Dom.el('div', { class: 'kpi-value' }, [value])]);
    }
    draw();
    return Store.subscribe('*', Dom.debounce(function () { Dom.withFocusPreserved(container, draw); }, 30));
  }
  return { title: 'Estate Planning', render: render };
})();
