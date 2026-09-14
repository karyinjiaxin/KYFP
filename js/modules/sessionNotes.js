/* ============================================================
   sessionNotes.js
   ============================================================ */

var ModuleSessionNotes = (function () {
  function render(container) {
    function draw() {
      var c = Store.getAll();
      container.innerHTML = '';
      container.appendChild(Dom.el('div', { class: 'page-header' }, [
        Dom.el('h1', {}, ['Session Notes']),
        Dom.el('div', { class: 'sub' }, ['Quick free-form notes captured during a client conversation.'])
      ]));

      var addCard = Dom.el('div', { class: 'card mb-3' });
      var textarea = Dom.el('textarea', { rows: 3, placeholder: 'Type a note…', style: 'width:100%' });
      addCard.appendChild(textarea);
      addCard.appendChild(Dom.el('button', {
        class: 'btn btn-primary mt-2', onclick: function () {
          if (!textarea.value.trim()) return;
          var arr = Store.get('sessionNotes') || [];
          arr.unshift({ id: Dom.uid('sn'), date: new Date().toISOString().slice(0, 10), text: textarea.value.trim() });
          Store.set('sessionNotes', arr);
        }
      }, ['Add Note']));
      container.appendChild(addCard);

      (c.sessionNotes || []).forEach(function (n, idx) {
        container.appendChild(Dom.el('div', { class: 'note-item' }, [
          Dom.el('div', { class: 'flex justify-between items-center' }, [
            Dom.el('div', { class: 'note-date' }, [n.date]),
            Dom.el('button', { class: 'btn btn-ghost btn-sm', onclick: function () { var arr = Store.get('sessionNotes'); arr.splice(idx, 1); Store.set('sessionNotes', arr); } }, ['Delete'])
          ]),
          Dom.el('div', { style: 'font-size:13.5px;margin-top:4px' }, [n.text])
        ]));
      });
      if (!(c.sessionNotes || []).length) container.appendChild(Dom.el('div', { class: 'empty-state' }, ['No session notes yet.']));
    }
    draw();
    return Store.subscribe('*', Dom.debounce(function () { Dom.withFocusPreserved(container, draw); }, 30));
  }
  return { title: 'Session Notes', render: render };
})();
