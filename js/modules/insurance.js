/* ============================================================
   insurance.js — Insurance Coverage module
   ============================================================ */

var ModuleInsurance = (function () {
  var TYPES = ['Life', 'CI', 'ECI', 'Hospital', 'PA', 'Disability'];

  function render(container) {
    // Transient review-before-save state for the Import panel — not
    // Store-backed on purpose, so nothing is written until the advisor
    // explicitly hits "Import". Survives re-draws (closure-scoped to this
    // render() call, same lifetime as `container`) but resets on navigating
    // away and back, same as any other in-progress, unsaved form.
    var importRawText = '';
    var pendingImport = null; // null = no review table shown yet; [] = parsed but nothing matched

    function draw() {
      var c = Store.getAll();
      container.innerHTML = '';
      container.appendChild(Dom.el('div', { class: 'page-header' }, [
        Dom.el('h1', {}, ['Insurance Coverage']),
        Dom.el('div', { class: 'sub' }, ['Policy-level detail feeds the coverage gap, protection ratio, and Proposal automatically.'])
      ]));

      // ---- Quick-input coverage: faster than keying full policies ----
      container.appendChild(Dom.el('div', { class: 'section-title', style: 'margin-top:0' }, ['⚡ Quick Coverage Entry']));
      var quickCard = Dom.el('div', { class: 'card mb-3' });
      quickCard.appendChild(Dom.el('div', { class: 'text-secondary mb-3' }, [
        'For a fast estimate without keying every individual policy \u2014 these amounts add directly into the coverage totals below, alongside any policies listed further down.'
      ]));
      var quickFieldRows = [
        ['deathTpd', 'Death / TPD'], ['terminalIllness', 'Terminal Illness'], ['earlyStageCI', 'Early Stage CI'],
        ['lateStageCI', 'Late Stage CI'], ['incomeProtection', 'Income Protection'], ['longTermCare', 'Long Term Care'],
        ['accidentalDeath', 'Accidental Death'], ['accidentalMedicalReimbursement', 'Accidental Medical Reimbursement'],
        ['annualHospitalClaimableLimit', 'Annual Hospital Claimable Limit']
      ];
      for (var qi = 0; qi < quickFieldRows.length; qi += 3) {
        var qrow = Dom.el('div', { class: 'input-row mt-2' });
        quickFieldRows.slice(qi, qi + 3).forEach(function (f) {
          qrow.appendChild(Fields.moneyInput('insuranceQuickCoverage.' + f[0], f[1]));
        });
        quickCard.appendChild(qrow);
      }
      container.appendChild(quickCard);

      container.appendChild(Dom.el('div', { class: 'section-title' }, ['📥 Import Policies']));
      container.appendChild(importPanel());

      container.appendChild(Dom.el('div', { class: 'section-title' }, ['📄 Individual Policies']));
      var policyGrid = Dom.el('div', { class: 'grid grid-2' });
      (c.insurance || []).forEach(function (p, idx) { policyGrid.appendChild(policyCard(p, idx)); });
      container.appendChild(policyGrid);

      container.appendChild(Dom.el('div', { class: 'section-title' }, ['🔎 Need Analysis']));
      var needCard = Dom.el('div', { class: 'card' }, [
        Dom.el('div', { style: 'font-weight:700;font-size:13.5px;margin-bottom:2px' }, ['Death & Total Permanent Disability (TPD)']),
        row('Recommended Coverage (9x annual income + liabilities)', Dom.fmtMoney(Calc.recommendedDeathTpdCoverage(c))),
        row('Current Death Coverage Held', Dom.fmtMoney(Calc.deathTpdCoverageHeld(c))),
        row('Death/TPD Gap', Dom.fmtMoney(Calc.deathTpdGap(c))),
        Dom.el('div', { style: 'font-weight:700;font-size:13.5px;margin:16px 0 2px' }, ['Critical Illness (CI)']),
        row('Recommended Coverage (4x annual income)', Dom.fmtMoney(Calc.recommendedCICoverage(c))),
        row('Current CI + ECI Coverage Held', Dom.fmtMoney(Calc.ciCoverageHeld(c))),
        row('CI Gap', Dom.fmtMoney(Calc.ciGap(c))),
        Dom.el('div', { class: 'text-tertiary mt-3', style: 'line-height:1.5' }, [
          'Benchmarks: Life Insurance Association of Singapore 2022 Protection Gap Study (~9x annual income for Death/TPD, ~4x for Critical Illness), as adopted into the MAS/MoneySense Basic Financial Planning Guide (Oct 2023). General rules of thumb, not personalised advice — actual needs vary by dependants, debts and lifestyle.'
        ])
      ]);
      container.appendChild(needCard);

      container.appendChild(Dom.el('div', { class: 'section-title' }, ['🛡️ Coverage by Type: Existing vs Recommended']));
      var typeGrid = Dom.el('div', { class: 'grid grid-3 mb-3' });
      typeGrid.appendChild(coverageTypePie('Death / TPD', Calc.deathTpdCoverageHeld(c), Calc.recommendedDeathTpdCoverage(c), 'deathTpdChart'));
      typeGrid.appendChild(coverageTypePie('Critical Illness (Early + Late)', Calc.ciCoverageHeld(c), Calc.recommendedCICoverage(c), 'ciChart'));
      typeGrid.appendChild(coverageTypePie('Income Protection', Calc.incomeProtectionHeld(c), Calc.recommendedIncomeProtection(c), 'incomeProtectionChart', '/mo'));
      typeGrid.appendChild(coverageTypePie('Long Term Care', Calc.longTermCareHeld(c), Calc.recommendedLongTermCare(c), 'longTermCareChart', '/mo'));
      container.appendChild(typeGrid);
      container.appendChild(Dom.el('div', { class: 'card mb-3', style: 'font-size:11.5px;line-height:1.6' }, [
        Dom.el('div', { style: 'font-weight:700;margin-bottom:4px' }, ['Benchmark sources']),
        Dom.el('div', {}, ['Death/TPD (~9x annual income + liabilities) and Critical Illness (~4x annual income): Life Insurance Association of Singapore 2022 Protection Gap Study, adopted into the MAS/MoneySense Basic Financial Planning Guide. ',
          Dom.el('a', { href: 'https://www.lia.org.sg', target: '_blank', rel: 'noopener' }, ['lia.org.sg'])
        ]),
        Dom.el('div', { class: 'mt-1' }, ['Income Protection (up to 75% of gross monthly income): common Singapore insurer underwriting cap for Disability Income / Income Protection products \u2014 varies by insurer, confirm the specific product\u2019s limit.']),
        Dom.el('div', { class: 'mt-1' }, ['Long Term Care (S$6,000/month): rounded up from private nursing home costs, which run roughly S$5,500/month on average (private facilities can range S$2,000\u2013S$5,500+; home care / live-in helper roughly S$800\u2013S$1,200/month) \u2014 a cost-based reference, not an income multiple, since care costs don\u2019t scale with income the way Death/TPD or CI do. Source: Agency for Integrated Care (AIC) guidelines and industry cost surveys, 2025\u20132026. ',
          Dom.el('a', { href: 'https://www.aic.sg', target: '_blank', rel: 'noopener' }, ['aic.sg'])
        ]),
        Dom.el('div', { class: 'mt-1' }, ['CI and ECI are combined against one benchmark since LIA doesn\u2019t publish a separate figure for early-stage cover.'])
      ]));

      requestAnimationFrame(function () {
        drawCoverageTypePie(c, 'deathTpdChart', Calc.deathTpdCoverageHeld(c), Calc.recommendedDeathTpdCoverage(c));
        drawCoverageTypePie(c, 'ciChart', Calc.ciCoverageHeld(c), Calc.recommendedCICoverage(c));
        drawCoverageTypePie(c, 'incomeProtectionChart', Calc.incomeProtectionHeld(c), Calc.recommendedIncomeProtection(c));
        drawCoverageTypePie(c, 'longTermCareChart', Calc.longTermCareHeld(c), Calc.recommendedLongTermCare(c));
      });
    }

    function coverageTypePie(label, existing, recommended, canvasId, unitSuffix) {
      var pct = recommended > 0 ? Math.min(999, (existing / recommended) * 100) : 100;
      return Dom.el('div', { class: 'card' }, [
        Dom.el('div', { class: 'flex justify-between items-center mb-2' }, [
          Dom.el('div', { style: 'font-weight:700;font-size:13px' }, [label]),
          Dom.el('div', { class: 'badge ' + (pct >= 100 ? 'badge-good' : pct >= 50 ? 'badge-warn' : 'badge-bad') }, [pct.toFixed(0) + '%'])
        ]),
        Dom.el('div', { class: 'chart-wrap', style: 'height:160px' }, [Dom.el('canvas', { id: canvasId })]),
        Dom.el('div', { class: 'flex justify-between mt-2', style: 'font-size:11.5px' }, [
          Dom.el('div', { class: 'text-secondary' }, ['Existing: ' + Dom.fmtMoney(existing) + (unitSuffix || '')]),
          Dom.el('div', { class: 'text-secondary' }, ['Rec.: ' + Dom.fmtMoney(recommended) + (unitSuffix || '')])
        ])
      ]);
    }

    function drawCoverageTypePie(c, canvasId, existing, recommended) {
      var t = Charts.themeColors();
      var gap = Math.max(0, recommended - existing);
      var overCovered = existing > recommended;
      Charts.render(document.getElementById(canvasId), {
        type: 'pie',
        data: {
          labels: overCovered ? ['Existing Coverage'] : ['Existing Coverage', 'Gap to Recommended'],
          datasets: [{ data: overCovered ? [existing] : [existing, gap], backgroundColor: overCovered ? [t.good || t.palette[2]] : [t.palette[0], t.palette[3]] }]
        },
        options: { scales: { x: false, y: false } }
      });
    }

    function row(label, value) {
      return Dom.el('div', { class: 'flex justify-between items-center', style: 'padding:8px 0;border-bottom:1px solid var(--border)' }, [
        Dom.el('div', { class: 'text-secondary' }, [label]),
        Dom.el('div', { style: 'font-weight:700;font-size:14px' }, [value])
      ]);
    }

    function policyCard(p, idx) {
      var base = 'insurance.' + idx + '.';
      var annualPremium = Calc.policyAnnualPremium(p);
      var card = Dom.el('div', { class: 'policy-card' });
      card.appendChild(Dom.el('div', { class: 'policy-head' }, [
        Dom.el('div', {}, [
          Dom.el('div', { class: 'policy-title' }, [p.policyName || 'Policy']),
          Dom.el('div', { class: 'policy-sub' }, [p.company + ' · ' + p.type])
        ]),
        Dom.el('button', { class: 'btn btn-ghost btn-sm', onclick: function () { var arr = Store.get('insurance'); arr.splice(idx, 1); Store.set('insurance', arr); } }, ['Remove'])
      ]));

      if (p.ocrReviewed === false) {
        card.appendChild(Dom.el('div', {
          class: 'mb-2', style: 'padding:8px 12px;border-radius:8px;font-size:12px;font-weight:600;background:var(--warn-soft);color:var(--warn);display:flex;justify-content:space-between;align-items:center;gap:8px'
        }, [
          Dom.el('div', {}, ['⚠ Auto-filled by OCR from the attached screenshot — verify every field below, especially Policy No. and coverage amounts, before relying on this.']),
          Dom.el('button', { class: 'btn btn-ghost btn-sm', style: 'flex:none', onclick: function () { Store.set(base + 'ocrReviewed', true); } }, ['✓ Reviewed'])
        ]));
      }

      var isLife = p.type === 'Life';
      var statsRow = isLife
        ? Dom.el('div', { class: 'grid grid-3', style: 'margin-bottom:14px' }, [
            miniStat('Annual Premium', Dom.fmtMoney(annualPremium)),
            miniStat('Death / TPD', Dom.fmtMoney(Math.max(Calc.num(p.coverage), Calc.num(p.coverageTpd)))),
            miniStat('CI Rider', Dom.fmtMoney(p.coverageCi))
          ])
        : Dom.el('div', { class: 'grid grid-3', style: 'margin-bottom:14px' }, [
            miniStat('Annual Premium', Dom.fmtMoney(annualPremium)),
            miniStat('Coverage', Dom.fmtMoney(p.coverage)),
            miniStat('Cash Value', Dom.fmtMoney(p.cashValue))
          ]);
      card.appendChild(statsRow);

      var formRow1 = Dom.el('div', { class: 'input-row' }, [
        Fields.textInput(base + 'company', 'Company'),
        Fields.textInput(base + 'policyName', 'Policy Name'),
        Fields.selectInput(base + 'type', 'Type', TYPES)
      ]);
      var formRow1b = Dom.el('div', { class: 'input-row mt-2' }, [
        maskedPolicyNoInput(base + 'policyNo')
      ]);
      var formRow2 = Dom.el('div', { class: 'input-row mt-2' }, [
        Fields.moneyInput(base + 'premium', 'Premium'),
        Fields.selectInput(base + 'premiumFrequency', 'Frequency', ['Monthly', 'Annually']),
        isLife ? Fields.moneyInput(base + 'coverage', 'Death Coverage') : Fields.moneyInput(base + 'coverage', 'Coverage')
      ]);
      var formRow3 = Dom.el('div', { class: 'input-row mt-2' }, [
        Fields.numberInput(base + 'startAge', 'Start Age'),
        Fields.numberInput(base + 'endAge', 'End Age'),
        Fields.numberInput(base + 'paymentTerm', 'Payment Term (yrs)')
      ]);
      var formRow4 = Dom.el('div', { class: 'input-row mt-2' }, [
        Fields.moneyInput(base + 'cashValue', 'Cash Value'),
        Fields.numberInput(base + 'dividend', 'Dividend Rate %', { step: '0.1' })
      ]);
      card.appendChild(formRow1); card.appendChild(formRow1b); card.appendChild(formRow2); card.appendChild(formRow3); card.appendChild(formRow4);
      card.appendChild(screenshotAttachment(base, p));
      if (isLife) {
        card.appendChild(Dom.el('div', { class: 'input-row mt-2' }, [
          Fields.moneyInput(base + 'coverageTpd', 'TPD Coverage'),
          Fields.moneyInput(base + 'coverageCiAllStage', 'All-Stage CI Coverage'),
          Fields.moneyInput(base + 'coverageCi', 'Late-Stage CI Coverage (rider)')
        ]));
        card.appendChild(Dom.el('div', { class: 'text-tertiary mt-1' }, [
          'One Life plan can bundle Death, TPD and a CI rider under a single premium — leave TPD blank/0 if it simply matches Death Coverage. Death and TPD count toward the Death/TPD need as whichever is higher (not added together); Late-Stage CI Coverage counts toward the Critical Illness need. All-Stage CI is tracked for reference but not yet counted in the needs calculation.'
        ]));
      }
      if (p.type === 'Hospital') {
        card.appendChild(Dom.el('div', { class: 'input-row mt-2' }, [
          Fields.selectInput(base + 'wardClass', 'Ward Class', ['Private Hospital', 'Govt A Ward', 'Govt B Ward'])
        ]));
      }
      return card;
    }

    // Shows only the last 4 characters when not focused (e.g.
    // "••••••1234") — the full number is still stored and editable, just
    // not left visible on screen (over a shoulder, a screen-share) by
    // default. Not a real text input from Fields.js since it needs this
    // focus/blur-driven mask swap, which no other field does.
    function maskValue(v) {
      var s = String(v || '');
      if (s.length <= 4) return s;
      return '•'.repeat(s.length - 4) + s.slice(-4);
    }
    function maskedPolicyNoInput(path) {
      var wrap = Dom.el('div', { class: 'field' });
      wrap.appendChild(Dom.el('label', { class: 'field-label' }, ['Policy No.']));
      var input = Dom.el('input', {
        type: 'text', inputmode: 'text', autocomplete: 'off', 'data-path': path,
        value: maskValue(Store.get(path)),
        onfocus: function (e) { e.target.value = Store.get(path) || ''; },
        oninput: function (e) {
          var val = e.target.value;
          Dom.scheduleCommit(path, function () { Store.set(path, val); }, 350);
        },
        onblur: function (e) { e.target.value = maskValue(e.target.value); }
      });
      wrap.appendChild(input);
      return wrap;
    }

    // Downscales to keep localStorage/Supabase sync payloads reasonable —
    // a raw phone-camera screenshot can be several MB; nothing here needs
    // more than enough resolution to read the policy back off it.
    function resizeImageFile(file, maxDim, quality, cb) {
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          var canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          cb(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    }

    // Dedicated to feeding Tesseract, not to storing/displaying — a real
    // multi-column policy table screenshotted at normal screen resolution
    // (e.g. 1298×332px for a 13-column table) packs each row's text into
    // ~15-20px of height, well under what OCR needs to read it reliably.
    // Unlike resizeImageFile (which only ever shrinks), this always scales
    // UP small/dense images, and saves as lossless PNG instead of JPEG —
    // JPEG's chroma-subsampling blur is exactly the kind of noise that
    // turns thin table text into garbage ("A I I ee emt men"-type OCR
    // output). Separate from the dataUrl saved as the review row's
    // screenshot thumbnail, which stays small for storage/display.
    function prepareImageForOcr(file, cb) {
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var longest = Math.max(img.width, img.height);
          var target = Math.min(3400, Math.max(1800, longest * 2));
          var scale = target / longest;
          var canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          var ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          cb(canvas.toDataURL('image/png'));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    }

    function openImageLightbox(dataUrl) {
      var overlay = Dom.el('div', { class: 'modal-overlay', onclick: function (e) { if (e.target === overlay) overlay.remove(); } });
      overlay.appendChild(Dom.el('img', { src: dataUrl, style: 'max-width:92vw;max-height:92vh;border-radius:8px;box-shadow:var(--shadow-lg);display:block;margin:auto' }));
      document.body.appendChild(overlay);
    }

    // Just a reference image kept alongside an existing policy card (e.g.
    // a screenshot of the insurer's policy summary) so the advisor can
    // glance at the source while keying fields in by hand — no OCR runs
    // here. Reading a screenshot to auto-fill a NEW policy is a separate
    // entry point: see ocrAddButton() below.
    function screenshotAttachment(base, p) {
      var wrap = Dom.el('div', { class: 'mt-2' });
      wrap.appendChild(Dom.el('div', { class: 'field-label', style: 'margin-bottom:6px' }, ['Policy Summary Screenshot (reference only, not auto-filled)']));
      if (p.screenshot) {
        var row = Dom.el('div', { class: 'flex items-center gap-2' }, [
          Dom.el('img', {
            src: p.screenshot, style: 'width:72px;height:72px;object-fit:cover;border-radius:8px;border:1px solid var(--border);cursor:pointer',
            onclick: function () { openImageLightbox(p.screenshot); }
          }),
          Dom.el('button', { class: 'btn btn-ghost btn-sm', onclick: function () { Store.set(base + 'screenshot', ''); } }, ['Remove'])
        ]);
        wrap.appendChild(row);
      } else {
        var fileInput = Dom.el('input', {
          type: 'file', accept: 'image/*', style: 'display:none',
          onchange: function (e) {
            var file = e.target.files[0];
            if (!file) return;
            resizeImageFile(file, 1000, 0.75, function (dataUrl) { Store.set(base + 'screenshot', dataUrl); });
          }
        });
        wrap.appendChild(fileInput);
        wrap.appendChild(Dom.el('button', { class: 'btn btn-secondary btn-sm', onclick: function () { fileInput.click(); } }, ['📷 Attach Screenshot']));
      }
      return wrap;
    }

    function addPolicyManually() {
      var arr = Store.get('insurance') || [];
      arr.push({ id: Dom.uid('pol'), company: 'New Insurer', policyName: 'New Policy', policyNo: '', type: 'Life', premium: 0, premiumFrequency: 'Monthly', coverage: 0, coverageTpd: 0, coverageCiAllStage: 0, coverageCi: 0, startAge: 30, endAge: 99, paymentTerm: 20, cashValue: 0, dividend: 0, screenshot: '' });
      Store.set('insurance', arr);
    }

    // Turns one parsed guess into a review-row object (adds the `include`
    // checkbox state and a fresh id) for the pending-import table.
    function toReviewRow(g, screenshot) {
      return {
        include: true, screenshot: screenshot || '',
        company: g.company || 'New Insurer', policyName: g.policyName || 'New Policy', policyNo: g.policyNo || '',
        type: g.type || 'Life', premium: g.premium || 0, premiumFrequency: g.premiumFrequency || 'Annually',
        paymentTerm: g.paymentTerm || 0, coverage: g.coverage || 0,
        coverageTpd: g.coverageTpd || 0, coverageCiAllStage: g.coverageCiAllStage || 0, coverageCi: g.coverageCi || 0,
        cashValue: g.cashValue || 0
      };
    }

    function runImportParse(text) {
      pendingImport = OCR.guessMultiple(text).map(function (g) { return toReviewRow(g, ''); });
      if (!pendingImport.length) pendingImport = [toReviewRow({}, '')];
      draw();
    }

    // Paste text (from a copied spreadsheet/PDF table) OR paste/drop a
    // screenshot right onto the box — an image runs through OCR first,
    // then both paths feed the same multi-policy text parser, surfaced in
    // the review table below for the advisor to check/edit before any of
    // it is written to the client's record.
    function importPanel() {
      var wrap = Dom.el('div', { class: 'card mb-3', style: 'border:2px dashed var(--border-strong);background:var(--accent-soft)' });
      wrap.appendChild(Dom.el('div', { class: 'flex justify-between items-center mb-2', style: 'flex-wrap:wrap;gap:8px' }, [
        Dom.el('div', {}, [
          Dom.el('div', { style: 'font-weight:700;font-size:13.5px' }, ['Import Policies']),
          Dom.el('div', { class: 'text-tertiary' }, ['Paste text, or paste/drop a screenshot below. You’ll review every row before it’s saved.'])
        ]),
        Dom.el('div', { class: 'flex gap-2' }, [
          Dom.el('button', { class: 'btn btn-secondary btn-sm', onclick: function () { screenshotInput.click(); } }, ['📷 Screenshot']),
          Dom.el('button', { class: 'btn btn-secondary btn-sm', onclick: function () { addPolicyManually(); } }, ['+ Add Manually']),
          Dom.el('button', {
            class: 'btn btn-primary btn-sm', onclick: function () {
              if (!importRawText.trim()) { Dom.modalAlert('Paste some text, or a screenshot, into the box first.'); return; }
              runImportParse(importRawText);
            }
          }, ['✨ Review & Import'])
        ])
      ]));

      var screenshotInput = Dom.el('input', {
        type: 'file', accept: 'image/*', style: 'display:none',
        onchange: function (e) { var file = e.target.files[0]; if (file) handleImageFile(file); }
      });
      wrap.appendChild(screenshotInput);

      var statusLine = Dom.el('div', { class: 'text-tertiary mb-1', style: 'display:none' });
      wrap.appendChild(statusLine);

      function handleImageFile(file) {
        if (!OCR.available()) { Dom.modalAlert('OCR isn’t available right now (offline, or the library failed to load) — paste the policy text directly instead.'); return; }
        statusLine.style.display = '';
        statusLine.textContent = 'Reading screenshot…';
        // Two versions of the same image: a smaller JPEG for the review
        // row's thumbnail (display/storage), and a separately upscaled,
        // lossless-PNG version just for Tesseract to read off of — see
        // prepareImageForOcr().
        resizeImageFile(file, 1800, 0.9, function (dataUrl) {
          prepareImageForOcr(file, function (ocrDataUrl) {
            OCR.extractPoliciesFromImage(ocrDataUrl, function (pct) { statusLine.textContent = 'Reading screenshot… ' + pct + '%'; })
              .then(function (result) {
                pendingImport = result.guesses.map(function (g) { return toReviewRow(g, dataUrl); });
                if (!pendingImport.length) pendingImport = [toReviewRow({}, dataUrl)];
                draw();
              })
              .catch(function (err) { Dom.modalAlert('Could not read that screenshot: ' + (err && err.message ? err.message : err)); })
              .finally(function () { statusLine.style.display = 'none'; });
          });
        });
      }

      var textarea = Dom.el('textarea', {
        rows: 4, placeholder: 'Paste a policy summary here (text copied from a spreadsheet/PDF works best) — or paste (Ctrl/⌘+V) or drop a screenshot right here.\n\nMost reliable: type one value per line in order (see tip below), blank line between policies.',
        style: 'width:100%;resize:vertical;font-family:var(--font-ui);font-size:12.5px;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg-elevated);color:var(--text-primary)',
        oninput: function (e) { importRawText = e.target.value; },
        onpaste: function (e) {
          // Copying a cell range out of Excel/Google Sheets often puts an
          // image representation of the selection in the clipboard
          // ALONGSIDE the plain text — if any clipboard item merely being
          // an image were enough to hijack the paste, pasting that kind of
          // copy would silently discard the far-more-reliable text and run
          // OCR on the image instead, with the text box staying empty.
          // Text always wins when it's present; only fall back to the
          // image/OCR path when there's genuinely no text to use.
          var items = (e.clipboardData && e.clipboardData.items) || [];
          var hasText = false;
          for (var i = 0; i < items.length; i++) {
            if (items[i].type === 'text/plain') { hasText = true; break; }
          }
          if (hasText) return; // let the default text paste happen; oninput picks it up
          for (var j = 0; j < items.length; j++) {
            if (items[j].type.indexOf('image') === 0) {
              e.preventDefault();
              handleImageFile(items[j].getAsFile());
              return;
            }
          }
        },
        ondragover: function (e) { e.preventDefault(); },
        ondrop: function (e) {
          e.preventDefault();
          var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
          if (file && file.type.indexOf('image') === 0) handleImageFile(file);
        }
      });
      textarea.value = importRawText;
      wrap.appendChild(textarea);
      wrap.appendChild(Dom.el('div', { class: 'text-tertiary mt-1', style: 'font-size:11.5px' }, [
        'Tip — most reliable input: one value per line, in this exact order, blank line between policies — ' +
        'Insurer, Policy Name, Policy No., Premium, Frequency (Monthly/Annually), Premium Term, Death Coverage, TPD Coverage, ' +
        'All-Stage CI, Late-Stage CI, and optionally Projected Coverage @65 and Projected Surr Value @65. Type 0 for any ' +
        'field that doesn’t apply (don’t leave it blank) — a blank line is read as the gap between policies.'
      ]));

      if (pendingImport && pendingImport.length) wrap.appendChild(importReviewTable());
      return wrap;
    }

    function importReviewTable() {
      var box = Dom.el('div', { class: 'mt-3' });
      box.appendChild(Dom.el('div', { class: 'text-secondary mb-2' }, [pendingImport.length + ' polic' + (pendingImport.length === 1 ? 'y' : 'ies') + ' found — uncheck any you don’t want, fix anything that looks wrong, then import.']));
      var tableWrap = Dom.el('div', { class: 'table-scroll' });
      var table = Dom.el('table', { class: 'data-table' });
      table.appendChild(Dom.el('thead', {}, [Dom.el('tr', {}, [
        '', 'Company', 'Policy Name', 'Policy No.', 'Type', 'Premium', 'Frequency', 'Death Coverage', 'TPD Coverage', 'All-Stage CI', 'Late-Stage CI', 'Cash Value'
      ].map(function (h) { return Dom.el('th', {}, [h]); }))]));
      var tbody = Dom.el('tbody');
      pendingImport.forEach(function (row, i) {
        tbody.appendChild(Dom.el('tr', {}, [
          Dom.el('td', {}, [Dom.el('input', { type: 'checkbox', checked: row.include ? 'checked' : null, onchange: function (e) { row.include = e.target.checked; } })]),
          Dom.el('td', {}, [reviewCell(row, i, 'company')]),
          Dom.el('td', {}, [reviewCell(row, i, 'policyName')]),
          Dom.el('td', {}, [reviewCell(row, i, 'policyNo')]),
          Dom.el('td', {}, [reviewTypeCell(row, i)]),
          Dom.el('td', {}, [reviewCell(row, i, 'premium', true)]),
          Dom.el('td', {}, [reviewFrequencyCell(row, i)]),
          Dom.el('td', {}, [reviewCell(row, i, 'coverage', true)]),
          Dom.el('td', {}, [reviewCell(row, i, 'coverageTpd', true)]),
          Dom.el('td', {}, [reviewCell(row, i, 'coverageCiAllStage', true)]),
          Dom.el('td', {}, [reviewCell(row, i, 'coverageCi', true)]),
          Dom.el('td', {}, [reviewCell(row, i, 'cashValue', true)])
        ]));
      });
      table.appendChild(tbody); tableWrap.appendChild(table); box.appendChild(tableWrap);

      box.appendChild(Dom.el('div', { class: 'flex gap-2 mt-2' }, [
        Dom.el('button', {
          class: 'btn btn-primary btn-sm', onclick: function () {
            var toAdd = pendingImport.filter(function (r) { return r.include; });
            if (!toAdd.length) { Dom.modalAlert('Nothing checked to import.'); return; }
            var arr = Store.get('insurance') || [];
            toAdd.forEach(function (r) {
              arr.push({
                id: Dom.uid('pol'), company: r.company, policyName: r.policyName, policyNo: r.policyNo,
                type: r.type, premium: Calc.num(r.premium), premiumFrequency: r.premiumFrequency || 'Annually',
                coverage: Calc.num(r.coverage), coverageTpd: Calc.num(r.coverageTpd),
                coverageCiAllStage: Calc.num(r.coverageCiAllStage), coverageCi: Calc.num(r.coverageCi),
                // Left blank (0) rather than guessed — real policies start
                // at all kinds of ages and premium terms, so a plausible-
                // looking default (e.g. 30 / 20yrs) is more likely to go
                // unnoticed and uncorrected than an obviously-empty field.
                startAge: 0, endAge: 99, paymentTerm: Calc.num(r.paymentTerm), cashValue: Calc.num(r.cashValue), dividend: 0,
                screenshot: r.screenshot, ocrReviewed: false
              });
            });
            Store.set('insurance', arr);
            pendingImport = null; importRawText = '';
            draw();
          }
        }, ['Import ' + pendingImport.filter(function (r) { return r.include; }).length + ' Selected']),
        Dom.el('button', { class: 'btn btn-ghost btn-sm', onclick: function () { pendingImport = null; draw(); } }, ['Cancel'])
      ]));
      return box;
    }

    function reviewCell(row, i, field, isMoney) {
      return Dom.el('input', {
        type: 'text', value: isMoney ? String(row[field] || 0) : (row[field] || ''), style: 'width:100%;min-width:' + (isMoney ? '80px' : '110px'),
        oninput: function (e) { row[field] = isMoney ? Calc.num(e.target.value) : e.target.value; }
      });
    }
    function reviewTypeCell(row, i) {
      var sel = Dom.el('select', { onchange: function (e) { row.type = e.target.value; } });
      TYPES.forEach(function (t) {
        var o = Dom.el('option', { value: t }, [t]);
        if (t === row.type) o.setAttribute('selected', 'selected');
        sel.appendChild(o);
      });
      return sel;
    }
    function reviewFrequencyCell(row, i) {
      var sel = Dom.el('select', { onchange: function (e) { row.premiumFrequency = e.target.value; } });
      ['Monthly', 'Annually'].forEach(function (f) {
        var o = Dom.el('option', { value: f }, [f]);
        if (f === row.premiumFrequency) o.setAttribute('selected', 'selected');
        sel.appendChild(o);
      });
      return sel;
    }

    function miniStat(label, value) {
      return Dom.el('div', { class: 'mini-stat' }, [Dom.el('div', { class: 'l' }, [label]), Dom.el('div', { class: 'v' }, [value])]);
    }
    function kpiMini(label, value) {
      return Dom.el('div', { class: 'card kpi-card' }, [Dom.el('div', { class: 'kpi-label' }, [label]), Dom.el('div', { class: 'kpi-value' }, [value])]);
    }

    draw();
    return Store.subscribe('*', Dom.debounce(function () { Dom.withFocusPreserved(container, draw); }, 30));
  }

  return { title: 'Insurance Coverage', render: render };
})();
