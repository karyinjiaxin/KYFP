/* ============================================================
   sidebar.js — expandable left navigation
   ============================================================ */

var Sidebar = (function () {
  var NAV = [
    { section: 'Overview', items: [
      { key: 'dashboard', label: 'Dashboard', ic: 'grid' },
      { key: 'profile', label: 'Client Profile', ic: 'user' },
      { key: 'couple', label: 'Couple Planning', ic: 'couple' },
      { key: 'cashflow', label: 'Cashflow', ic: 'arrows' },
      { key: 'buckets', label: 'Bank Account Buckets', ic: 'bucket' },
      { key: 'networth', label: 'Net Worth', ic: 'bar' }
    ]},
    { section: 'Planning', items: [
      { key: 'insurance', label: 'Insurance Coverage', ic: 'shield' },
      { key: 'hospital', label: 'Hospital Plan Premiums', ic: 'cross' },
      { key: 'retirement', label: 'Retirement Planning', ic: 'sun' },
      { key: 'roadmap', label: 'Cash Flow Roadmap', ic: 'roadmap' },
      { key: 'investments', label: 'Investment Planning', ic: 'trend' },
      { key: 'dividends', label: 'Insurance + Dividends', ic: 'coin' },
      { key: 'cpf', label: 'CPF', ic: 'building' },
      { key: 'tax', label: 'Tax Planning', ic: 'doc' },
      { key: 'estate', label: 'Estate Planning', ic: 'scroll' },
      { key: 'ratios', label: 'Financial Ratios', ic: 'gauge' },
      { key: 'goals', label: 'Goals & Milestones', ic: 'flag' }
    ]},
    { section: 'Client', items: [
      { key: 'sessionnotes', label: 'Session Notes', ic: 'note' },
      { key: 'meetingnotes', label: 'Meeting Notes', ic: 'cal' },
      { key: 'proposals', label: 'Proposals', ic: 'file' },
      { key: 'settings', label: 'Settings', ic: 'gear' }
    ]}
  ];

  var ICONS = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    arrows: '<path d="M7 7h11M7 7l4-4M7 7l4 4M17 17H6M17 17l-4 4M17 17l-4-4"/>',
    bar: '<path d="M4 20V10M12 20V4M20 20v-7"/>',
    shield: '<path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3z"/>',
    cross: '<path d="M12 4v16M4 12h16"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    trend: '<path d="M4 16l5-5 4 4 7-7M20 8h-4M20 8v4"/>',
    coin: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10a2.5 2.5 0 012.5-1h.5a2 2 0 010 4h-1a2 2 0 000 4h.5a2.5 2.5 0 002.5-1"/>',
    building: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1"/>',
    doc: '<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h5"/>',
    scroll: '<path d="M6 4h11a2 2 0 012 2v13a1 1 0 01-1.6.8L15 18H6a2 2 0 01-2-2V6a2 2 0 012-2z"/><path d="M8 9h7M8 13h5"/>',
    gauge: '<path d="M4 14a8 8 0 1116 0"/><path d="M12 14l3-4"/><circle cx="12" cy="14" r="1"/>',
    flag: '<path d="M5 3v18M5 4h11l-2 4 2 4H5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    note: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    file: '<path d="M6 2h9l5 5v15H6z"/><path d="M9 13h6M9 17h6"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.2a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.2a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.2a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.2a1.7 1.7 0 00-1.5 1z"/>',
    bucket: '<path d="M4 8h16l-1.7 11.2a2 2 0 01-2 1.8H7.7a2 2 0 01-2-1.8L4 8z"/><path d="M2 8h20M8 8V6a4 4 0 018 0v2"/>',
    couple: '<circle cx="8.5" cy="8" r="3"/><circle cx="16" cy="9" r="2.5"/><path d="M2.5 21c0-3.5 3-5.5 6-5.5s6 2 6 5.5"/><path d="M14 21c0-2.5 1.8-4.2 4-4.2s4.5 1.5 4.5 4.2"/>',
    roadmap: '<path d="M3 20l6-16 4 10 3-6 5 12"/><circle cx="9" cy="4" r="1.5"/><circle cx="20" cy="20" r="1.5"/>'
  };

  function iconSvg(name) {
    return '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || ICONS.grid) + '</svg>';
  }

  var rootEl = null;

  function build() {
    rootEl.innerHTML = '';
    rootEl.appendChild(Dom.el('div', { class: 'sidebar-brand' }, [
      Dom.el('div', { class: 'mark' }, ['W']),
      Dom.el('div', { class: 'word' }, ['Wealth Advisory'])
    ]));

    NAV.forEach(function (group) {
      var sec = Dom.el('div', { class: 'sidebar-section' });
      sec.appendChild(Dom.el('div', { class: 'section-label' }, [group.section]));
      group.items.forEach(function (item) {
        var navItem = Dom.el('a', {
          href: '#' + item.key, class: 'nav-item', 'data-key': item.key,
          html: iconSvg(item.ic) + '<span>' + item.label + '</span>'
        });
        sec.appendChild(navItem);
      });
      rootEl.appendChild(sec);
    });

    var toggleBtn = Dom.el('button', {
      class: 'sidebar-toggle',
      html: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 4l-6 8 6 8M15 4l6 8-6 8"/></svg><span>Collapse</span>',
      onclick: function () {
        rootEl.classList.toggle('collapsed');
      }
    });
    rootEl.appendChild(toggleBtn);
  }

  return {
    init: function (el) { rootEl = el; build(); },
    setActive: function (key) {
      Dom.qsa('.nav-item', rootEl).forEach(function (n) {
        n.classList.toggle('active', n.getAttribute('data-key') === key);
      });
    }
  };
})();
