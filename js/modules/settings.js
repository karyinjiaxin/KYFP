/* ============================================================
   settings.js
   ============================================================ */

var ModuleSettings = (function () {
  function render(container) {
    function draw() {
      var c = Store.getAll();
      container.innerHTML = '';
      container.appendChild(Dom.el('div', { class: 'page-header' }, [
        Dom.el('h1', {}, ['Settings']),
        Dom.el('div', { class: 'sub' }, ['Appearance and data management for this client file.'])
      ]));

      var appearanceCard = Dom.el('div', { class: 'card mb-3' }, [
        Dom.el('div', { class: 'section-title', style: 'margin-top:0' }, ['🎨 Appearance']),
        Dom.el('div', { class: 'flex items-center gap-3' }, [
          Dom.el('button', { class: 'btn btn-secondary', onclick: function () { App.setTheme('light'); } }, ['Light']),
          Dom.el('button', { class: 'btn btn-secondary', onclick: function () { App.setTheme('dark'); } }, ['Dark'])
        ])
      ]);
      container.appendChild(appearanceCard);

      var dataCard = Dom.el('div', { class: 'card mb-3' }, [
        Dom.el('div', { class: 'section-title', style: 'margin-top:0' }, ['🗄️ Data']),
        Dom.el('div', { class: 'flex gap-3', style: 'flex-wrap:wrap' }, [
          Dom.el('button', { class: 'btn btn-secondary', onclick: exportData }, ['Export Current Client (JSON)']),
          Dom.el('label', { class: 'btn btn-secondary', style: 'cursor:pointer' }, [
            'Import Current Client',
            Dom.el('input', { type: 'file', accept: '.json', style: 'display:none', onchange: importData })
          ]),
          Dom.el('button', { class: 'btn btn-ghost', onclick: resetData }, ['Reset to Sample Data'])
        ]),
        Dom.el('div', { class: 'text-tertiary mt-3', style: 'margin-bottom:14px' }, ['Data persists automatically to this browser\u2019s local storage \u2014 schema is flat JSON, ready to migrate to Supabase or Firebase later. IMPORTANT: local storage lives ONLY on this specific browser and device \u2014 it isn\u2019t backed up anywhere, isn\u2019t synced across devices, and can be cleared by clearing browsing data, using a different browser/device, or private/incognito mode. For anything you can\u2019t afford to lose, back up regularly using the button below.']),
        Dom.el('div', { class: 'flex gap-3', style: 'flex-wrap:wrap;border-top:1px solid var(--border);padding-top:14px' }, [
          Dom.el('button', { class: 'btn btn-primary', onclick: exportAllSavedClients }, ['\ud83d\udcbe Back Up ALL Saved Clients (JSON)']),
          Dom.el('label', { class: 'btn btn-secondary', style: 'cursor:pointer' }, [
            'Restore Saved Clients from Backup',
            Dom.el('input', { type: 'file', accept: '.json', style: 'display:none', onchange: importAllSavedClients })
          ])
        ]),
        Dom.el('div', { class: 'text-tertiary mt-2' }, ['Downloads every client in "Saved Clients" below as one file \u2014 the recommended way to protect against browser data loss. Restoring MERGES the backup in (existing clients are kept; only same-ID entries are overwritten), it does not wipe what\u2019s currently saved.'])
      ]);
      container.appendChild(dataCard);

      // ---- Saved Clients (the "hidden tab" — tucked in Settings, not the main sidebar) ----
      var savedClients = Store.listSavedClients();
      var clientsCard = Dom.el('div', { class: 'card mb-3' }, [
        Dom.el('div', { class: 'section-title', style: 'margin-top:0' }, ['👥 Saved Clients']),
        Dom.el('div', { class: 'text-secondary mb-3' }, ['Save a snapshot of the client currently open, so you can switch to a different client and come back to this one later. Snapshots are stored in this browser only.'])
      ]);
      clientsCard.appendChild(Dom.el('div', { class: 'flex gap-2 mb-3' }, [
        Dom.el('button', {
          class: 'btn btn-primary', onclick: function () {
            Dom.modalPrompt('Save current client as:', function (name) {
              Store.saveCurrentAsClient(name);
              Dom.withFocusPreserved(container, draw);
            }, { defaultValue: Store.get('personal.name') || 'Untitled Client' });
          }
        }, ['Save Current Client']),
        Dom.el('button', {
          class: 'btn btn-secondary', onclick: function () {
            Dom.modalConfirm('Start a new, blank client? If you haven\u2019t saved the client currently open, save it first \u2014 this replaces what\u2019s on screen.', function () {
              Store.reset(BlankClient);
            }, { confirmLabel: 'Start New Client' });
          }
        }, ['+ New Client'])
      ]));

      if (savedClients.length === 0) {
        clientsCard.appendChild(Dom.el('div', { class: 'text-tertiary' }, ['No saved clients yet.']));
      } else {
        savedClients.slice().reverse().forEach(function (entry) {
          var savedDate = new Date(entry.savedAt).toLocaleString('en-SG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
          clientsCard.appendChild(Dom.el('div', { class: 'flex justify-between items-center', style: 'padding:10px 0;border-bottom:1px solid var(--border)' }, [
            Dom.el('div', {}, [
              Dom.el('div', { style: 'font-weight:700;font-size:13.5px' }, [entry.label]),
              Dom.el('div', { class: 'text-tertiary' }, ['Saved ' + savedDate])
            ]),
            Dom.el('div', { class: 'flex gap-2' }, [
              Dom.el('button', {
                class: 'btn btn-secondary btn-sm', onclick: function () {
                  Dom.modalConfirm('Load "' + entry.label + '"? This replaces the client currently open (save it first if you want to keep it).', function () {
                    Store.loadSavedClient(entry.id);
                  }, { confirmLabel: 'Load' });
                }
              }, ['Load']),
              Dom.el('button', {
                class: 'btn btn-ghost btn-sm', onclick: function () {
                  Dom.modalConfirm('Delete saved client "' + entry.label + '"? This cannot be undone.', function () {
                    Store.deleteSavedClient(entry.id);
                    Dom.withFocusPreserved(container, draw);
                  }, { confirmLabel: 'Delete', danger: true });
                }
              }, ['Delete'])
            ])
          ]));
        });
      }
      container.appendChild(clientsCard);

      var aboutCard = Dom.el('div', { class: 'card' }, [
        Dom.el('div', { class: 'section-title', style: 'margin-top:0' }, ['ℹ️ About']),
        Dom.el('div', { class: 'text-secondary' }, [
          'Every module reads and writes the same client master object. Editing any field — income, a policy, an investment plan — recalculates Dashboard, Financial Ratios, Retirement, and the Proposal automatically.'
        ])
      ]);
      container.appendChild(aboutCard);
    }

    function exportData() {
      var blob = new Blob([Store.exportJSON()], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = ((Store.get('personal.name') || 'client').replace(/\s+/g, '_')) + '_data.json';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    function importData(e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try { Store.importJSON(reader.result); } catch (err) { Dom.modalAlert('Could not read that file \u2014 please check it is valid JSON exported from this app.'); }
      };
      reader.readAsText(file);
    }
    function exportAllSavedClients() {
      var list = Store.listSavedClients();
      if (list === null) { Dom.modalAlert('Saved clients data appears corrupted and could not be read \u2014 check the browser console for a possible recovery copy under a ".corrupted." key in local storage.'); return; }
      var blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'wealth_platform_saved_clients_backup_' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    function importAllSavedClients(e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var incoming;
        try { incoming = JSON.parse(reader.result); } catch (err) { Dom.modalAlert('Could not read that file \u2014 please check it\u2019s a valid backup exported from this app.'); return; }
        if (!Array.isArray(incoming)) { Dom.modalAlert('That file doesn\u2019t look like a saved-clients backup (expected a list of clients).'); return; }
        var existing = Store.listSavedClients();
        if (existing === null) { Dom.modalAlert('Current saved clients data appears corrupted \u2014 refusing to merge on top of it to avoid making recovery harder. Check the browser console first.'); return; }
        Dom.modalConfirm('Restore ' + incoming.length + ' client(s) from this backup? Existing clients with the same ID are overwritten; everything else currently saved is kept as-is.', function () {
          var byId = {};
          existing.forEach(function (entry) { byId[entry.id] = entry; });
          incoming.forEach(function (entry) { if (entry && entry.id) byId[entry.id] = entry; });
          var merged = Object.keys(byId).map(function (id) { return byId[id]; });
          try {
            if (!Store.replaceSavedClients(merged)) throw new Error('localStorage write failed');
            Dom.modalAlert('Restored. ' + merged.length + ' client(s) now saved in total.');
            Dom.withFocusPreserved(container, draw);
          } catch (err) {
            Dom.modalAlert('Restore failed: ' + (err && err.message ? err.message : err));
          }
        }, { confirmLabel: 'Restore' });
      };
      reader.readAsText(file);
    }
    function resetData() {
      Dom.modalConfirm('Reset all data to the sample client? This cannot be undone.', function () {
        Store.reset(SampleClient);
      }, { confirmLabel: 'Reset', danger: true });
    }

    draw();
    return Store.subscribe('*', Dom.debounce(function () { Dom.withFocusPreserved(container, draw); }, 30));
  }
  return { title: 'Settings', render: render };
})();
