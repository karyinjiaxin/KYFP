/* ============================================================
   ocr.js — in-browser screenshot reading for Insurance Coverage
   Runs entirely client-side via Tesseract.js (no server, no API
   key, no cost) — reads the raw text off a policy-summary
   screenshot and best-guesses a handful of fields from it with
   pattern matching. This is NOT a real document-understanding
   model: it works reasonably for one clean, typed policy summary
   per screenshot, and is unreliable for photos, scans, or a single
   image containing a whole multi-row table of several policies.
   Every guessed field is meant to be reviewed/corrected by the
   advisor, never trusted blindly — see insurance.js's OCR review
   banner.
   ============================================================ */

var OCR = (function () {
  function available() { return typeof Tesseract !== 'undefined'; }

  var KNOWN_INSURERS = [
    'Great Eastern', 'AIA', 'Prudential', 'NTUC Income', 'Income', 'Manulife',
    'Tokio Marine', 'HSBC Life', 'Singlife', 'FWD', 'China Life', 'Etiqa',
    'Sompo', 'Aviva', 'AXA'
  ];
  var TYPE_KEYWORDS = [
    { type: 'Hospital', re: /hospital|shield|medisave|supremehealth|ward/i },
    { type: 'CI', re: /critical illness|\bci\b/i },
    { type: 'Disability', re: /disability|income protection|loss of income/i },
    { type: 'PA', re: /personal accident|\bpa\b|accident(al)? death/i },
    { type: 'ECI', re: /early[\s-]?stage/i }
    // default: 'Life'
  ];

  function firstMoneyNear(text, keywordRe) {
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      if (keywordRe.test(lines[i])) {
        var m = lines[i].match(/\$?\s?([\d][\d,]*\.?\d*)/g);
        if (m && m.length) {
          // keyword line often also contains the keyword's own digits (e.g.
          // "P Plus") — take the largest-looking number as the likely amount.
          var nums = m.map(function (s) { return Number(s.replace(/[^\d.]/g, '')); }).filter(function (n) { return n > 0; });
          if (nums.length) return Math.max.apply(null, nums);
        }
      }
    }
    return null;
  }

  function guessFields(rawText) {
    var text = rawText || '';
    var lines = text.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);

    var company = null;
    for (var i = 0; i < KNOWN_INSURERS.length; i++) {
      if (new RegExp(KNOWN_INSURERS[i], 'i').test(text)) { company = KNOWN_INSURERS[i]; break; }
    }

    // Policy No.: this app's own export format wraps it in parentheses
    // right under the plan name (e.g. "(0201472789)"); otherwise look for
    // an explicit "Policy No" label, then fall back to any standalone
    // alphanumeric token 6–12 chars long that looks like an ID, not a
    // dollar amount or a date.
    var policyNo = null;
    var parenMatch = text.match(/\(([A-Z]?\d{6,12})\)/);
    if (parenMatch) policyNo = parenMatch[1];
    if (!policyNo) {
      var labelMatch = text.match(/policy\s*(no|number)\.?\s*[:#]?\s*([A-Z0-9\-]{5,15})/i);
      if (labelMatch) policyNo = labelMatch[2];
    }
    if (!policyNo) {
      var tokenMatch = text.match(/\b[A-Z]?\d{6,12}\b/);
      if (tokenMatch) policyNo = tokenMatch[0];
    }

    var premium = firstMoneyNear(text, /premium/i);
    var coverage = firstMoneyNear(text, /death coverage|sum assured|total coverage|coverage/i);
    // Tables OCR into separate header/value lines, so the keyword-proximity
    // match above often misses — fall back to the largest dollar figure
    // anywhere in the text, which is very often the coverage amount
    // (premiums are almost always smaller), as long as it isn't the one
    // already claimed as the premium guess.
    if (coverage === null) {
      var allAmounts = (text.match(/\$\s?[\d][\d,]*\.?\d*/g) || [])
        .map(function (s) { return Number(s.replace(/[^\d.]/g, '')); })
        .filter(function (n) { return n > 0 && n !== premium; });
      if (allAmounts.length) coverage = Math.max.apply(null, allAmounts);
    }

    var type = 'Life';
    for (var t = 0; t < TYPE_KEYWORDS.length; t++) {
      if (TYPE_KEYWORDS[t].re.test(text)) { type = TYPE_KEYWORDS[t].type; break; }
    }

    // Policy name: best-effort — the first substantial line that isn't
    // just the insurer's own name or a lone number/date.
    var policyName = null;
    for (var j = 0; j < lines.length; j++) {
      var l = lines[j];
      if (l.length < 4) continue;
      if (company && l.toLowerCase() === company.toLowerCase()) continue;
      if (/^[\d\s\/\-,.$]+$/.test(l)) continue;
      policyName = l;
      break;
    }

    return {
      company: company, policyName: policyName, policyNo: policyNo,
      premium: premium, coverage: coverage, type: type
    };
  }

  // onProgress(pct 0-100) is optional. Returns a Promise<{raw, guess}>.
  function extractPolicyFromImage(dataUrl, onProgress) {
    if (!available()) return Promise.reject(new Error('OCR library unavailable (offline, or the CDN script failed to load)'));
    return Tesseract.recognize(dataUrl, 'eng', {
      logger: function (m) {
        if (onProgress && m.status === 'recognizing text' && typeof m.progress === 'number') onProgress(Math.round(m.progress * 100));
      }
    }).then(function (result) {
      var raw = (result && result.data && result.data.text) || '';
      return { raw: raw, guess: guessFields(raw) };
    });
  }

  // Splits text covering SEVERAL policies (e.g. a pasted multi-row policy
  // summary table, where each policy's block is headed by its insurer's
  // name on its own line — the common shape for this kind of document)
  // into one chunk per policy. A line that is (trimmed, case-insensitively)
  // just a known insurer's name starts a new chunk; everything else stays
  // in the current one. Falls back to treating the whole text as a single
  // policy when no such boundary is found.
  function splitIntoPolicyBlocks(text) {
    var lines = (text || '').split('\n');
    var blocks = [];
    var current = [];
    lines.forEach(function (line) {
      var trimmed = line.trim();
      var isInsurerHeading = trimmed.length > 0 && KNOWN_INSURERS.some(function (ins) { return trimmed.toLowerCase() === ins.toLowerCase(); });
      if (isInsurerHeading && current.length > 0) {
        blocks.push(current.join('\n'));
        current = [line];
      } else {
        current.push(line);
      }
    });
    if (current.length) blocks.push(current.join('\n'));
    return blocks.length ? blocks : [text || ''];
  }

  // Best-effort multi-policy read: pasted text (from copying a spreadsheet
  // or PDF table directly) parses far more reliably than OCR'd text ever
  // can, since it keeps every character exactly as typed — no guessing at
  // smudged digits or jumbled table cells. Returns one guess object per
  // detected policy, dropping any block where nothing useful was found.
  function guessMultiple(text) {
    return splitIntoPolicyBlocks(text)
      .map(function (block) { return guessFields(block); })
      .filter(function (g) { return g.company || g.policyName || g.policyNo; });
  }

  // ---------- Table reconstruction from word positions ----------
  // A genuine multi-row table (header row + one row per policy) loses all
  // column alignment once Tesseract flattens it to plain text — "Total
  // Death Coverage" and its "$170,000.00" end up on unrelated lines. This
  // rebuilds the table from each word's bounding box instead: cluster
  // words into visual rows by Y-position, find the header row, derive
  // column X-ranges from it, then assign every other row's words to the
  // nearest column. Spreadsheet cells with wrapped text (a plan name
  // spanning 2-3 lines) also split into extra "rows" with content only in
  // the Plan Name column — those get folded back into the data row they
  // visually belong to. Still best-effort: skewed photos, merged/touching
  // columns, and misread digits will still produce a wrong row sometimes —
  // this is why every row lands in the editable review table, not straight
  // into the client's record.
  var HEADER_KEYWORDS = /plan|premium|coverage|death|tpd|\bci\b|critical|surr|yield|remarks|year|term|name/i;
  var COLUMN_ALIASES = [
    { re: /plan\s*name|policy\s*name/i, field: 'policyName' },
    { re: /annual\s*premium/i, field: 'premium' },
    { re: /monthly\s*premium/i, field: 'premiumMonthly' },
    { re: /premium\s*term/i, field: 'paymentTerm' },
    { re: /total\s*death\s*coverage|^death(\s*\/?\s*tpd)?\s*coverage/i, field: 'coverage' },
    { re: /total\s*tpd\s*coverage|^tpd\s*coverage/i, field: 'coverageTpd' },
    { re: /all\s*stage\s*ci/i, field: 'coverageCiAllStage' },
    { re: /critical\s*illness\s*coverage/i, field: 'coverageCi' },
    { re: /surr(ender)?\s*value/i, field: 'cashValue' },
    { re: /yield/i, field: 'dividend' }
  ];

  function clusterRows(words) {
    var sorted = words.slice().sort(function (a, b) { return a.bbox.y0 - b.bbox.y0; });
    var avgHeight = sorted.reduce(function (s, w) { return s + (w.bbox.y1 - w.bbox.y0); }, 0) / (sorted.length || 1);
    var tolerance = Math.max(4, avgHeight * 0.6);
    var rows = [];
    sorted.forEach(function (w) {
      var cy = (w.bbox.y0 + w.bbox.y1) / 2;
      var row = rows.filter(function (r) { return Math.abs(r.cy - cy) < tolerance; })[0];
      if (row) { row.words.push(w); row.cy = (row.cy * (row.words.length - 1) + cy) / row.words.length; }
      else rows.push({ cy: cy, words: [w] });
    });
    rows.forEach(function (r) { r.words.sort(function (a, b) { return a.bbox.x0 - b.bbox.x0; }); });
    rows.sort(function (a, b) { return a.cy - b.cy; });
    return rows;
  }

  // Splits a row's words into column clusters by gap size, using the
  // row's OWN median inter-word gap as the baseline rather than a fixed
  // multiple of one word's width — a within-column word gap (e.g. "Total"
  // to "Death") and a between-column gap (e.g. "Coverage" to the next
  // column's first word) are usually clearly different sizes, but the
  // absolute pixel values vary a lot with image resolution/zoom, so only
  // a gap meaningfully larger than this row's typical gap counts as a
  // column boundary.
  function groupIntoColumns(rowWords) {
    if (!rowWords.length) return [];
    if (rowWords.length === 1) return [{ text: rowWords[0].text, x0: rowWords[0].bbox.x0, x1: rowWords[0].bbox.x1 }];
    var gaps = [];
    for (var g = 1; g < rowWords.length; g++) gaps.push(Math.max(0, rowWords[g].bbox.x0 - rowWords[g - 1].bbox.x1));
    var sortedGaps = gaps.slice().sort(function (a, b) { return a - b; });
    var median = sortedGaps[Math.floor(sortedGaps.length / 2)];
    var threshold = Math.max(14, median * 2.5);

    var cols = [];
    var cur = [rowWords[0]];
    for (var i = 1; i < rowWords.length; i++) {
      if (gaps[i - 1] > threshold) { cols.push(cur); cur = [rowWords[i]]; }
      else cur.push(rowWords[i]);
    }
    cols.push(cur);
    return cols.map(function (c) {
      return {
        text: c.map(function (w) { return w.text; }).join(' '),
        x0: Math.min.apply(null, c.map(function (w) { return w.bbox.x0; })),
        x1: Math.max.apply(null, c.map(function (w) { return w.bbox.x1; }))
      };
    });
  }

  function matchColumnField(headerText) {
    for (var i = 0; i < COLUMN_ALIASES.length; i++) if (COLUMN_ALIASES[i].re.test(headerText)) return COLUMN_ALIASES[i].field;
    return null;
  }

  // A data row's cell text is usually wider than the header label above it
  // (e.g. a long plan name dwarfs the two-word "Plan Name" header) — using
  // each column's own label width as its catchment area would let that
  // overflow text drift into the next column over. Instead, give each
  // column reach halfway to its neighbors on each side (and unbounded at
  // the two table edges), so every data-row word falls into exactly one
  // column by simple containment.
  function expandColumnBoundaries(cols) {
    var sorted = cols.slice().sort(function (a, b) { return a.x0 - b.x0; });
    return sorted.map(function (col, i) {
      var left = i === 0 ? -Infinity : (sorted[i - 1].x1 + col.x0) / 2;
      var right = i === sorted.length - 1 ? Infinity : (col.x1 + sorted[i + 1].x0) / 2;
      return { x0: left, x1: right, field: col.field, text: col.text };
    });
  }

  // A plan name is unbounded-length free text sitting right next to money
  // columns, so even with expanded column boundaries, an unusually long
  // one (e.g. "Supreme Early Multiplier 15") still occasionally drifts a
  // word or two into the neighboring money column. Money columns only
  // ever legitimately contain currency-shaped tokens (digits, $, commas,
  // a decimal point, or a bare "-" for "none") — a word that isn't
  // currency-shaped is almost certainly overflow from Plan Name, so it's
  // rejected from a money column and tried against the remaining columns
  // instead (ultimately landing back in Plan Name, its real column).
  var MONEY_FIELDS = ['premium', 'premiumMonthly', 'coverage', 'coverageTpd', 'coverageCiAllStage', 'coverageCi', 'cashValue', 'dividend'];
  var CURRENCY_TOKEN = /^\$$|^-$|^[$]?[\d][\d,]*\.?\d*$/;

  function assignRowToColumns(rowWords, columns) {
    var cells = {};
    rowWords.forEach(function (w) {
      var cx = (w.bbox.x0 + w.bbox.x1) / 2;
      var ranked = columns.slice().sort(function (a, b) {
        var da = cx < a.x0 ? a.x0 - cx : cx > a.x1 ? cx - a.x1 : 0;
        var db = cx < b.x0 ? b.x0 - cx : cx > b.x1 ? cx - b.x1 : 0;
        return da - db;
      });
      var best = ranked[0];
      if (best && MONEY_FIELDS.indexOf(best.field) !== -1 && !CURRENCY_TOKEN.test(w.text) && ranked[1]) best = ranked[1];
      if (!best) return;
      cells[best.field] = (cells[best.field] ? cells[best.field] + ' ' : '') + w.text;
    });
    return cells;
  }

  function numFromCell(s) {
    if (!s) return null;
    var m = String(s).match(/[\d][\d,]*\.?\d*/);
    return m ? Number(m[0].replace(/,/g, '')) : null;
  }

  // Returns an array of row-guess objects (same shape as guessFields()'s
  // return value), or null if no header row with enough recognizable
  // columns was found — the caller falls back to splitIntoPolicyBlocks().
  function reconstructTable(words) {
    if (!words || words.length < 8) return null;
    var rows = clusterRows(words);
    var headerIdx = -1, headerScore = 0;
    rows.forEach(function (r, i) {
      var score = r.words.filter(function (w) { return HEADER_KEYWORDS.test(w.text); }).length;
      if (score > headerScore) { headerScore = score; headerIdx = i; }
    });
    if (headerIdx === -1 || headerScore < 3) return null; // doesn't look like a table

    // Keep EVERY header column, including ones that don't map to a known
    // field (e.g. "No", "Year") — this is what stops a row-number or date
    // from drifting into the nearest *matched* column (almost always Plan
    // Name, since that column tends to sit leftmost) just because there's
    // nowhere else for it to go.
    var allHeaderCols = expandColumnBoundaries(
      groupIntoColumns(rows[headerIdx].words)
        .map(function (c, idx) { return { x0: c.x0, x1: c.x1, field: matchColumnField(c.text) || ('_unmapped' + idx), text: c.text }; })
    );
    var matchedCount = allHeaderCols.filter(function (c) { return c.field.indexOf('_unmapped') !== 0; }).length;
    if (matchedCount < 2) return null;

    var dataRows = rows.slice(headerIdx + 1).map(function (r) { return assignRowToColumns(r.words, allHeaderCols); });

    // A row with a numeric value in at least one coverage/premium column is
    // a real policy row; a row with only `policyName` text is a wrapped
    // continuation of the plan-name cell above/below it (common — insurers'
    // plan names rarely fit on one line) and gets folded into whichever
    // anchor row it's visually closest to, before or after.
    var NUMERIC_FIELDS = ['premium', 'premiumMonthly', 'coverage', 'coverageTpd', 'coverageCiAllStage', 'coverageCi'];
    function isAnchor(cells) { return NUMERIC_FIELDS.some(function (f) { return numFromCell(cells[f]) !== null; }); }

    var anchorIndices = [];
    dataRows.forEach(function (cells, i) { if (isAnchor(cells)) anchorIndices.push(i); });
    var merged = anchorIndices.map(function (ai) {
      var copy = {}; Object.keys(dataRows[ai]).forEach(function (k) { copy[k] = dataRows[ai][k]; }); return copy;
    });
    dataRows.forEach(function (cells, i) {
      if (isAnchor(cells) || !cells.policyName || !anchorIndices.length) return;
      var nearestAnchor = anchorIndices[0];
      anchorIndices.forEach(function (ai) { if (Math.abs(ai - i) < Math.abs(nearestAnchor - i)) nearestAnchor = ai; });
      var mi = anchorIndices.indexOf(nearestAnchor);
      var existing = merged[mi].policyName || '';
      merged[mi].policyName = i < nearestAnchor ? (cells.policyName + ' ' + existing).trim() : (existing + ' ' + cells.policyName).trim();
    });

    return merged.map(function (cells) {
      var rawName = cells.policyName || null;
      var company = null;
      for (var i = 0; i < KNOWN_INSURERS.length; i++) {
        if (rawName && new RegExp(KNOWN_INSURERS[i], 'i').test(rawName)) { company = KNOWN_INSURERS[i]; break; }
      }
      // Policy No. rides along inside the plan-name cell, e.g. "Great
      // Eastern Smart Protect (RP) (0071920043)" — pull it and the
      // company name back out so Plan Name is left clean ("Smart
      // Protect (RP)"), matching how this app's own policy fields split
      // company / policy name / policy no. into three separate inputs.
      var policyNo = null, policyName = rawName;
      if (rawName) {
        var pn = rawName.match(/\(([A-Z]?\d{6,12})\)/);
        if (pn) { policyNo = pn[1]; policyName = policyName.replace(pn[0], ''); }
        if (company) policyName = policyName.replace(new RegExp(company, 'i'), '');
        policyName = policyName.replace(/\s{2,}/g, ' ').trim();
      }
      // A Monthly Premium cell present means the policy is actually paid
      // monthly (the Annual Premium column, when also shown, is just that
      // monthly amount × 12 for reference) — only fall back to the Annual
      // column, as an annually-paid policy, when Monthly is blank.
      var premiumMonthly = numFromCell(cells.premiumMonthly);
      var premiumAnnual = numFromCell(cells.premium);
      var premiumFrequency = premiumMonthly !== null ? 'Monthly' : 'Annually';
      var premium = premiumMonthly !== null ? premiumMonthly : premiumAnnual;
      var paymentTermMatch = (cells.paymentTerm || '').match(/(\d+)\s*year/i);
      var paymentTerm = paymentTermMatch ? Number(paymentTermMatch[1]) : 0;
      var coverage = numFromCell(cells.coverage);
      var coverageTpd = numFromCell(cells.coverageTpd);
      var coverageCi = numFromCell(cells.coverageCi) !== null ? numFromCell(cells.coverageCi) : numFromCell(cells.coverageCiAllStage);
      var type = coverageCi !== null && coverage === null ? 'CI' : 'Life';
      return {
        company: company, policyName: policyName, policyNo: policyNo || null,
        premium: premium, premiumFrequency: premiumFrequency, paymentTerm: paymentTerm,
        coverage: coverage, coverageTpd: coverageTpd, coverageCi: coverageCi, type: type
      };
    }).filter(function (g) { return g.policyName || g.coverage !== null; });
  }

  // onProgress(pct 0-100) is optional. Returns a Promise<{raw, guesses}> —
  // `guesses` is the multi-row result (table reconstruction when the image
  // looks tabular, else the text-block fallback), always an array even for
  // a single detected policy.
  function extractPoliciesFromImage(dataUrl, onProgress) {
    if (!available()) return Promise.reject(new Error('OCR library unavailable (offline, or the CDN script failed to load)'));
    return Tesseract.recognize(dataUrl, 'eng', {
      logger: function (m) {
        if (onProgress && m.status === 'recognizing text' && typeof m.progress === 'number') onProgress(Math.round(m.progress * 100));
      }
    }).then(function (result) {
      var data = result && result.data || {};
      var raw = data.text || '';
      var words = collectWords(data);
      var tableGuesses = words.length ? reconstructTable(words) : null;
      var guesses = tableGuesses && tableGuesses.length ? tableGuesses : guessMultiple(raw);
      return { raw: raw, guesses: guesses.length ? guesses : [guessFields(raw)] };
    });
  }

  // Tesseract.js nests word boxes under data.words directly in some
  // versions, and under data.blocks[].paragraphs[].lines[].words[] in
  // others depending on build/config — read whichever is present.
  function collectWords(data) {
    if (Array.isArray(data.words) && data.words.length) return data.words;
    var out = [];
    (data.blocks || []).forEach(function (b) {
      (b.paragraphs || []).forEach(function (p) {
        (p.lines || []).forEach(function (l) {
          (l.words || []).forEach(function (w) { out.push(w); });
        });
      });
    });
    return out;
  }

  // Backward-compatible single-policy helper (still used for the
  // per-policy "Attach Screenshot" flow, which never deals with tables).
  function extractPolicyFromImage(dataUrl, onProgress) {
    return extractPoliciesFromImage(dataUrl, onProgress).then(function (result) {
      return { raw: result.raw, guess: result.guesses[0] };
    });
  }

  return {
    available: available, guessFields: guessFields, guessMultiple: guessMultiple,
    splitIntoPolicyBlocks: splitIntoPolicyBlocks, extractPolicyFromImage: extractPolicyFromImage,
    extractPoliciesFromImage: extractPoliciesFromImage, reconstructTable: reconstructTable
  };
})();
