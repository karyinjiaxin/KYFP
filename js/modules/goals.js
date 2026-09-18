/* ============================================================
   goals.js — Goals & Milestones module
   ============================================================ */

var ModuleGoals = (function () {
  var CATEGORIES = ['Children Education', 'Property', 'Wedding', 'Travel', 'Business', 'Retirement', 'Other'];

  function render(container) {
    function draw() {
      var c = Store.getAll();
      container.innerHTML = '';
      container.appendChild(Dom.el('div', { class: 'page-header' }, [
        Dom.el('h1', {}, ['Goals & Milestones']),
        Dom.el('div', { class: 'sub' }, ['Track multiple goals; required monthly savings recalculates as targets and timelines change.'])
      ]));

      var grid = Dom.el('div', { class: 'grid grid-2' });
      (c.goals || []).forEach(function (g, idx) { grid.appendChild(goalCard(g, idx)); });
      container.appendChild(grid);

      container.appendChild(Dom.el('button', {
        class: 'btn btn-secondary mt-3', onclick: function () {
          var arr = Store.get('goals') || [];
          arr.push({ id: Dom.uid('goal'), name: 'New Goal', category: 'Other', targetAmount: 50000, currentAmount: 0, yearsLeft: 5, expectedReturn: 4 });
          Store.set('goals', arr);
        }
      }, ['+ Add Goal']));
    }

    function goalCard(g, idx) {
      var base = 'goals.' + idx + '.';
      var progress = Calc.goalProgress(g);
      var monthlyRequired = Calc.goalMonthlyRequired(g);
      var card = Dom.el('div', { class: 'card' });
      card.appendChild(Dom.el('div', { class: 'policy-head' }, [
        Dom.el('div', {}, [Dom.el('div', { class: 'policy-title' }, [g.name]), Dom.el('div', { class: 'policy-sub' }, [g.category])]),
        Dom.el('button', { class: 'btn btn-ghost btn-sm', onclick: function () { var arr = Store.get('goals'); arr.splice(idx, 1); Store.set('goals', arr); } }, ['Remove'])
      ]));
      card.appendChild(Dom.el('div', { class: 'progress-track mb-3' }, [Dom.el('div', { class: 'progress-fill', style: 'width:' + progress + '%' })]));
      card.appendChild(Dom.el('div', { class: 'grid grid-3', style: 'margin-bottom:14px' }, [
        miniStat('Progress', Dom.fmtPct(progress)),
        miniStat('Years Left', String(g.yearsLeft)),
        miniStat('Monthly Required', Dom.fmtMoney(monthlyRequired))
      ]));
      card.appendChild(Dom.el('div', { class: 'input-row' }, [
        Fields.textInput(base + 'name', 'Goal Name'),
        Fields.selectInput(base + 'category', 'Category', CATEGORIES)
      ]));
      card.appendChild(Dom.el('div', { class: 'input-row mt-2' }, [
        Fields.moneyInput(base + 'targetAmount', 'Target Amount'),
        Fields.moneyInput(base + 'currentAmount', 'Current Amount')
      ]));
      card.appendChild(Dom.el('div', { class: 'input-row mt-2' }, [
        Fields.numberInput(base + 'yearsLeft', 'Years Left', { step: '0.5' }),
        Fields.numberInput(base + 'expectedReturn', 'Expected Return %', { step: '0.1' })
      ]));
      return card;
    }
    function miniStat(label, value) {
      return Dom.el('div', { class: 'mini-stat' }, [Dom.el('div', { class: 'l' }, [label]), Dom.el('div', { class: 'v' }, [value])]);
    }
    draw();
    return Store.subscribe('*', Dom.debounce(function () { Dom.withFocusPreserved(container, draw); }, 30));
  }
  return { title: 'Goals & Milestones', render: render };
})();
