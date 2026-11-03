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

  return { available: available, guessFields: guessFields, extractPolicyFromImage: extractPolicyFromImage };
})();
