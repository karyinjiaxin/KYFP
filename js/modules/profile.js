/* ============================================================
   profile.js — Client Profile module
   ============================================================ */

var ModuleProfile = (function () {
  function render(container) {
    function draw() {
      var c = Store.getAll();
      container.innerHTML = '';
      container.appendChild(Dom.el('div', { class: 'page-header' }, [
        Dom.el('h1', {}, ['Client Profile']),
        Dom.el('div', { class: 'sub' }, ['Personal details and dependants — the identity layer of the client master record.'])
      ]));

      var card = Dom.el('div', { class: 'card' }, [Dom.el('div', { class: 'section-title', style: 'margin-top:0' }, ['👤 Personal Details'])]);
      card.appendChild(Dom.el('div', { class: 'input-row' }, [
        Fields.textInput('personal.name', 'Full Name'),
        Fields.textInput('personal.dob', 'Date of Birth (DD/MM/YYYY)', { placeholder: 'e.g. 15/05/1988' }),
        Fields.selectInput('personal.gender', 'Gender', ['Male', 'Female', 'Other'])
      ]));
      card.appendChild(Dom.el('div', { class: 'input-row mt-2' }, [
        Fields.selectInput('personal.maritalStatus', 'Marital Status', ['Single', 'Married', 'Divorced', 'Widowed']),
        Fields.textInput('personal.nationality', 'Nationality'),
        Fields.textInput('personal.occupation', 'Occupation')
      ]));
      card.appendChild(Dom.el('div', { class: 'input-row mt-2' }, [
        Fields.selectInput('personal.employmentStatus', 'Employment Status', ['Full-Time Employed', 'Part-Time Employed', 'Self-Employed', 'Unemployed'])
      ]));
      card.appendChild(Dom.el('div', { class: 'text-tertiary mt-2' }, [
        'Employment status drives the auto-calculated CPF Contribution line under Cashflow \u2192 Investment, which affects Bank Account Buckets.'
      ]));
      card.appendChild(Dom.el('div', { class: 'input-row mt-2' }, [
        Fields.textInput('personal.employer', 'Employer'),
        Fields.textInput('personal.email', 'Email', { type: 'email' }),
        Fields.textInput('personal.phone', 'Phone')
      ]));
      card.appendChild(Dom.el('div', { class: 'input-row mt-2' }, [
        Fields.textInput('personal.advisor', 'Advisor')
      ]));
      container.appendChild(card);

      container.appendChild(Dom.el('div', { class: 'section-title' }, ['👨‍👩‍👧 Dependants']));
      var linkedPartnerId = (c.personal || {}).partnerClientId;
      var allSavedForSync = linkedPartnerId ? Store.listSavedClients() : null;
      var linkedPartnerEntry = allSavedForSync ? allSavedForSync.filter(function (e) { return e.id === linkedPartnerId; })[0] : null;
      var linkedPartnerName = linkedPartnerEntry ? ((linkedPartnerEntry.data.personal || {}).name || linkedPartnerEntry.label) : null;

      var depWrap = Dom.el('div', { class: 'card' });
      (c.dependants || []).forEach(function (d, idx) {
        var row = Dom.el('div', { class: 'input-row mb-2', style: 'align-items:end' }, [
          Fields.textInput('dependants.' + idx + '.name', 'Name'),
          Fields.selectInput('dependants.' + idx + '.relation', 'Relation', ['Child', 'Spouse', 'Parent', 'Sibling', 'Other']),
          Fields.numberInput('dependants.' + idx + '.age', 'Age')
        ]);
        row.appendChild(Dom.el('button', { class: 'btn btn-ghost btn-sm', onclick: function () { var arr = Store.get('dependants'); arr.splice(idx, 1); Store.set('dependants', arr); } }, ['Remove']));
        depWrap.appendChild(row);

        // A child normally belongs to both parents — if a partner is
        // linked, offer to copy this one across rather than requiring
        // it to be typed in twice. Deliberately a one-click action, not
        // a silent ongoing background sync: it's far more predictable,
        // and avoids the class of infinite-loop bugs this app has hit
        // before with automatic cross-record syncing.
        if (d.relation === 'Child' && linkedPartnerEntry) {
          var partnerAlreadyHas = (linkedPartnerEntry.data.dependants || []).some(function (pd) {
            return (pd.name || '').trim().toLowerCase() === (d.name || '').trim().toLowerCase() && d.name;
          });
          depWrap.appendChild(Dom.el('div', { class: 'mb-3', style: 'margin-top:-8px' }, [
            partnerAlreadyHas
              ? Dom.el('span', { class: 'text-tertiary' }, ['✓ Already listed for ' + linkedPartnerName + ' too'])
              : Dom.el('a', {
                  href: '#', style: 'color:var(--accent);cursor:pointer;font-size:11.5px',
                  onclick: function (e) {
                    e.preventDefault();
                    var partnerData = JSON.parse(JSON.stringify(linkedPartnerEntry.data));
                    partnerData.dependants = partnerData.dependants || [];
                    partnerData.dependants.push({ name: d.name, relation: 'Child', age: d.age });
                    Store.updateSavedClientData(linkedPartnerId, partnerData);
                    Dom.withFocusPreserved(container, draw);
                  }
                }, ['+ Also add ' + (d.name || 'this child') + ' for ' + linkedPartnerName])
          ]));
        }
      });
      depWrap.appendChild(Dom.el('button', {
        class: 'btn btn-secondary btn-sm', onclick: function () {
          var arr = Store.get('dependants') || []; arr.push({ name: 'New Dependant', relation: 'Child', age: 0 }); Store.set('dependants', arr);
        }
      }, ['+ Add Dependant']));
      container.appendChild(depWrap);

      // ---- Partner / couple linking ----
      container.appendChild(Dom.el('div', { class: 'section-title' }, ['💑 Partner']));
      var partnerCard = Dom.el('div', { class: 'card' });
      var partnerId = (c.personal || {}).partnerClientId;
      var savedClients = Store.listSavedClients();
      var partnerEntry = partnerId ? savedClients.filter(function (e) { return e.id === partnerId; })[0] : null;

      if (partnerEntry) {
        partnerCard.appendChild(Dom.el('div', { class: 'flex justify-between items-center' }, [
          Dom.el('div', {}, [
            Dom.el('div', { style: 'font-weight:700;font-size:14px' }, [partnerEntry.label || (c.personal || {}).partnerName || 'Partner']),
            Dom.el('div', { class: 'text-tertiary mt-1' }, ['Linked partner \u2014 saved separately, switch anytime'])
          ]),
          Dom.el('div', { class: 'flex gap-2' }, [
            Dom.el('button', {
              class: 'btn btn-primary btn-sm',
              onclick: function () {
                Store.quickSave();
                Store.loadSavedClient(partnerId);
                window.location.hash = 'profile';
              }
            }, ['Switch to Partner']),
            Dom.el('button', {
              class: 'btn btn-ghost btn-sm',
              onclick: function () {
                Dom.modalConfirm('Unlink partner? This only removes the link \u2014 neither client\u2019s data is deleted.', function () {
                  Store.set('personal.partnerClientId', '');
                  Store.set('personal.partnerName', '');
                  // Also clear the reverse link on the partner's own record, if it still points back here.
                  var partnerData = JSON.parse(JSON.stringify(partnerEntry.data));
                  partnerData.personal = partnerData.personal || {};
                  partnerData.personal.partnerClientId = '';
                  partnerData.personal.partnerName = '';
                  Store.updateSavedClientData(partnerId, partnerData);
                }, { confirmLabel: 'Unlink', danger: true });
              }
            }, ['Unlink'])
          ])
        ]));
      } else {
        partnerCard.appendChild(Dom.el('div', { class: 'text-secondary mb-2' }, [
          'No partner linked yet. Adding one saves the current client, creates a new blank client for the partner, and links the two \u2014 each stays fully independent and loadable on its own (e.g. if you meet the partner separately in future), via Settings \u2192 Saved Clients or the button above once linked.'
        ]));
        partnerCard.appendChild(Dom.el('button', {
          class: 'btn btn-secondary btn-sm',
          onclick: function () {
            Dom.modalPrompt('Partner\u2019s name:', function (partnerName) {
              var currentName = Store.get('personal.name') || 'Untitled Client';

              // Save (or update) the current client so it has a stable id to link against.
              var currentId = Store.getCurrentClientId();
              var savedSelf;
              if (currentId && Store.listSavedClients().some(function (e) { return e.id === currentId; })) {
                Store.updateSavedClientData(currentId, Store.getAll());
                savedSelf = { id: currentId };
              } else {
                savedSelf = Store.saveCurrentAsClient(currentName);
              }

              // Build the partner as a new, independent client from the blank template.
              var partnerData = JSON.parse(JSON.stringify(BlankClient));
              partnerData.personal.name = partnerName;
              partnerData.personal.partnerClientId = savedSelf.id;
              partnerData.personal.partnerName = currentName;
              var savedPartner = Store.saveClientData(partnerName, partnerData);

              // Link the current (still-active) client back to the new partner, and re-save it.
              Store.set('personal.partnerClientId', savedPartner.id);
              Store.set('personal.partnerName', partnerName);
              Store.updateSavedClientData(savedSelf.id, Store.getAll());
            }, { placeholder: 'e.g. Sarah Tan' });
          }
        }, ['+ Add Partner']));
      }
      container.appendChild(partnerCard);
    }
    draw();
    return Store.subscribe('*', Dom.debounce(function () { Dom.withFocusPreserved(container, draw); }, 30));
  }
  return { title: 'Client Profile', render: render };
})();
