/* ============================================================
   meetingNotes.js
   ============================================================ */

var ModuleMeetingNotes = (function () {
  function render(container) {
    function draw() {
      var c = Store.getAll();
      container.innerHTML = '';
      container.appendChild(Dom.el('div', { class: 'page-header' }, [
        Dom.el('h1', {}, ['Meeting Notes']),
        Dom.el('div', { class: 'sub' }, ['Structured record of formal meetings, e.g. annual reviews.'])
      ]));

      var addCard = Dom.el('div', { class: 'card mb-3' });
      var titleInput = Dom.el('input', { type: 'text', placeholder: 'Meeting title', style: 'margin-bottom:8px' });
      var textarea = Dom.el('textarea', { rows: 3, placeholder: 'Meeting summary…', style: 'width:100%' });
      addCard.appendChild(titleInput);
      addCard.appendChild(textarea);
      addCard.appendChild(Dom.el('button', {
        class: 'btn btn-primary mt-2', onclick: function () {
          if (!textarea.value.trim()) return;
          var arr = Store.get('meetingNotes') || [];
          arr.unshift({ id: Dom.uid('mn'), date: new Date().toISOString().slice(0, 10), title: titleInput.value.trim() || 'Meeting', text: textarea.value.trim() });
          Store.set('meetingNotes', arr);
        }
      }, ['Add Meeting Note']));
      container.appendChild(addCard);

      (c.meetingNotes || []).forEach(function (n, idx) {
        container.appendChild(Dom.el('div', { class: 'note-item' }, [
          Dom.el('div', { class: 'flex justify-between items-center' }, [
            Dom.el('div', {}, [Dom.el('div', { style: 'font-weight:700;font-size:14px' }, [n.title]), Dom.el('div', { class: 'note-date' }, [n.date])]),
            Dom.el('button', { class: 'btn btn-ghost btn-sm', onclick: function () { var arr = Store.get('meetingNotes'); arr.splice(idx, 1); Store.set('meetingNotes', arr); } }, ['Delete'])
          ]),
          Dom.el('div', { style: 'font-size:13.5px;margin-top:6px' }, [n.text])
        ]));
      });
      if (!(c.meetingNotes || []).length) container.appendChild(Dom.el('div', { class: 'empty-state' }, ['No meeting notes yet.']));
    }
    draw();
    return Store.subscribe('*', Dom.debounce(function () { Dom.withFocusPreserved(container, draw); }, 30));
  }
  return { title: 'Meeting Notes', render: render };
})();
