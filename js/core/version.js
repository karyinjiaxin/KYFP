/* ============================================================
   version.js — build identity, so the live site can show which
   deploy it's running. DEPLOY_SHA/DEPLOY_TIME below are placeholders
   checked into git; the GitHub Pages deploy workflow overwrites them
   with the real commit and timestamp on every deploy (see
   .github/workflows/deploy-pages.yml), so what you see on-screen
   always matches what's actually live — no DevTools needed.
   ============================================================ */
var APP_VERSION = { sha: 'dev', time: '' };
