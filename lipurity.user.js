// The release-please block markers below wrap the whole metadata block: any
// semver-looking string inside it gets bumped on release. Keep @version as
// the ONLY version-like value in the header (no versioned @require URLs).
// x-release-please-start-version
// ==UserScript==
// @name         Litter Invalidator Purity (LI Purity)
// @namespace    https://github.com/RoFz/lipurity
// @version      0.1.0
// @description  Cleans up your professional network feed: hide sponsored posts, suggested content, people/course/job recommendations and other injected modules via independent toggles, with an optional full-width feed when the right column is hidden.
// @author       Rodrigo Ferraz
// @homepage     https://github.com/RoFz/lipurity
// @homepageURL  https://github.com/RoFz/lipurity
// @supportURL   https://github.com/RoFz/lipurity/issues
// @downloadURL  https://raw.githubusercontent.com/RoFz/lipurity/main/lipurity.user.js
// @updateURL    https://raw.githubusercontent.com/RoFz/lipurity/main/lipurity.user.js
// @match        https://www.linkedin.com/*
// @run-at       document-idle
// @grant        none
// @noframes
// @license      MIT
// ==/UserScript==

// x-release-please-end

(function () {
  'use strict';

  /* -------------------------------------------------------------------------
   * Why this works (verified against the live feed, June 2026):
   *  - Every feed post is wrapped in  div[role="listitem"]  inside  [role="list"].
   *  - The ad/recommendation marker is plain readable text inside a childless
   *    element:  <span>Promoted</span>  /  <span>Suggested</span>.
   *  - The site's CSS class names are hashed and change between builds
   *    (e.g. "_6a6de872"), so we NEVER match on classes. We match on the ARIA
   *    role (stable accessibility semantics) + the label text.
   * ---------------------------------------------------------------------- */

  // ---- Configuration -------------------------------------------------------

  // Labels to detect, per language. The KEY is the internal category; the
  // VALUE is the exact visible text the site renders in that locale.
  // English is verified live. Add your locale's exact strings here if your
  // UI is not in English (the value must match character-for-character).
  const LABELS = {
    Promoted: ['Promoted'],
    Suggested: ['Suggested'],
    PeopleYouMayKnow: ['People you may know'],
    RecommendedForYou: ['Recommended for you'],
    // Not yet observed live in the DOM (modules appear sporadically); assumed
    // to follow the same header-label pattern as Suggested/Recommended.
    // The string below is the literal on-screen text of that module's header.
    PopularCourse: ['Popular course on LinkedIn Learning'],
    // Both apostrophe variants: the site typically renders U+2019 (’), but an
    // exact match would silently miss if a straight quote ever ships.
    TopApplicantJobs: [
      'You’re a top applicant for these jobs',
      "You're a top applicant for these jobs",
    ],
  };

  // "<name> follows this Page" / "<a> and <b> follow this Page" header line.
  // The names are profile links, so the text is split across child elements;
  // this category is matched with a regex on the smallest containing element
  // rather than an exact-text label.
  const FOLLOWS_PAGE_CATEGORY = 'FollowsPage';
  const FOLLOWS_PAGE_RX = /follows? this Page\s*$/;
  // Only trust the phrase when it sits in the header strip at the top of the
  // card; an organic post whose BODY happens to say "... follows this Page"
  // must not be hidden.
  const FOLLOWS_PAGE_MAX_OFFSET_PX = 100;

  // The whole right rail (puzzles, follow recommendations, the ad box).
  // Verified live: it is  aside[aria-label="Aside"]  while the left profile
  // column is a separate  aside[aria-label="Sidebar"] . A geometry fallback
  // covers builds/locales where the aria-label differs.
  const RIGHT_RAIL_CATEGORY = 'RightRail';
  const RIGHT_RAIL_SELECTOR = 'aside[aria-label="Aside"]';

  // Optionally stretch the feed into the freed space when the rail is hidden.
  // Verified live: the page is a 24px-column CSS grid; the left sidebar spans
  // cols 1-5, the feed section 6-17, the rail 18 to the end. Re-spanning the
  // section's grid-column-end to -1 and unfixing the inner widths makes the
  // posts (and their media) fill the full remaining width.
  // This is a separate toggle (StretchFeed) because the site's own layout has
  // viewport-driven feed width tiers; with the stretch off, hiding the rail
  // leaves the native widths untouched.
  const STRETCH_OPTION = 'StretchFeed';
  const STRETCH_CLASS = 'lfp-stretch';
  const STRETCH_CSS = `
    html.${STRETCH_CLASS} section[aria-label="Primary content"]{
      grid-column-end:-1 !important;width:auto !important}
    html.${STRETCH_CLASS} section[aria-label="Primary content"] [role="list"]{
      width:100% !important}`;

  const CATEGORIES = [...Object.keys(LABELS), FOLLOWS_PAGE_CATEGORY, RIGHT_RAIL_CATEGORY];
  const DISPLAY_NAMES = {
    Promoted: 'Promoted',
    Suggested: 'Suggested',
    PeopleYouMayKnow: 'People you may know',
    RecommendedForYou: 'Recommended for you',
    PopularCourse: 'Popular course (Learning)',
    TopApplicantJobs: 'Top applicant jobs',
    FollowsPage: '"Follows this Page"',
    RightRail: 'Right column',
    StretchFeed: 'Stretch feed into freed space',
  };

  const STORAGE_KEY = 'lfp_settings_v1';
  const SWEEP_DEBOUNCE_MS = 150;

  // Flatten label -> category lookup, e.g. { "Promoted": "Promoted", ... }
  const LABEL_TO_CATEGORY = {};
  for (const [category, words] of Object.entries(LABELS)) {
    for (const w of words) LABEL_TO_CATEGORY[w] = category;
  }
  const ALL_LABELS = new Set(Object.keys(LABEL_TO_CATEGORY));

  // ---- Settings persistence (portable: no GM_* API required) ---------------

  const defaults = { panelCollapsed: false };
  for (const c of CATEGORIES) defaults[c] = true;
  defaults[STRETCH_OPTION] = true;

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? Object.assign({}, defaults, JSON.parse(raw)) : Object.assign({}, defaults);
    } catch (e) {
      return Object.assign({}, defaults);
    }
  }
  function saveSettings() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (e) {}
  }

  const settings = loadSettings();
  let hiddenCount = {};

  // ---- Detection -----------------------------------------------------------

  // Determine which categories a post card belongs to. Returns an array of
  // category strings (empty for organic posts). A card can match more than one
  // category at once (e.g. a sponsored post shown because a connection follows
  // the advertiser's Page).
  // Exact labels: we look for a CHILDLESS element whose trimmed text is EXACTLY
  // a known label, which avoids false positives from body text like
  // "I was promoted to ...".
  function detectCategories(card) {
    const found = [];
    const candidates = card.querySelectorAll('span, p, a');

    for (const el of candidates) {
      if (el.children.length !== 0) continue;
      const t = el.textContent.trim();
      const cat = LABEL_TO_CATEGORY[t];
      if (cat && !found.includes(cat)) found.push(cat);
    }

    // "follows this Page": regex on the smallest element containing the
    // phrase, restricted to the card's header strip.
    const cardTop = card.getBoundingClientRect().top;
    for (const el of candidates) {
      if (!FOLLOWS_PAGE_RX.test(el.textContent || '')) continue;
      // skip wrappers: only the innermost element containing the phrase counts
      let smallest = true;
      for (const child of el.children) {
        if (FOLLOWS_PAGE_RX.test(child.textContent || '')) { smallest = false; break; }
      }
      if (!smallest) continue;
      const offset = el.getBoundingClientRect().top - cardTop;
      if (offset >= 0 && offset <= FOLLOWS_PAGE_MAX_OFFSET_PX) {
        found.push(FOLLOWS_PAGE_CATEGORY);
        break;
      }
    }

    return found;
  }

  // A post card sits under wrapper divs; the element that actually
  // participates in the feed's flex layout is the topmost box-generating
  // ancestor between the card and the [role="list"] container (intermediate
  // wrappers are display:contents). The list has an 8px flex gap, and a
  // zero-height wrapper still counts as a flex item, so hiding only the inner
  // card would leak an 8px blank gap per hidden post (verified live: 7 hidden
  // posts left a 64px blank band at the top of the feed).
  function feedFlexItem(card) {
    const list = card.closest('[role="list"]');
    if (!list) return card;
    let n = card, item = card;
    while (n.parentElement && n.parentElement !== list) {
      n = n.parentElement;
      if (getComputedStyle(n).display !== 'contents') item = n;
    }
    return item;
  }

  // Locate the right rail. Once hidden its geometry collapses to 0, so a
  // node we already marked is found via the marker attribute first.
  function findRightRail() {
    let rail = document.querySelector('[data-lfp-rail]');
    if (rail) return rail;
    rail = document.querySelector(RIGHT_RAIL_SELECTOR);
    if (rail) return rail;
    // fallback: a visible aside sitting in the right third of the viewport
    for (const a of document.querySelectorAll('aside')) {
      const r = a.getBoundingClientRect();
      if (r.width > 0 && r.left > window.innerWidth * 0.6) return a;
    }
    return null;
  }

  // ---- Sweep ---------------------------------------------------------------

  function sweep() {
    const counts = {};
    for (const c of CATEGORIES) counts[c] = 0;
    const cards = document.querySelectorAll('div[role="listitem"]');
    for (const card of cards) {
      // Skip nested listitems: each person inside a "People you may know" /
      // "Recommended for you" module is itself a role="listitem". They match
      // no label, resolve to the same flex item as the module, and would
      // restore the wrapper the module hide just collapsed.
      if (card.parentElement && card.parentElement.closest('div[role="listitem"]')) continue;
      const matched = detectCategories(card);
      // hide if ANY matched category is enabled; attribute the hide to the
      // first enabled one for the panel counters
      const hideAs = matched.find(c => settings[c]);

      const target = feedFlexItem(card);
      if (hideAs) {
        if (target.style.display !== 'none') target.style.display = 'none';
        target.dataset.lfpHidden = hideAs;       // remember WE hid it, and why
        counts[hideAs]++;
      } else if (target.dataset.lfpHidden) {
        // We previously hid this node (toggle turned off, or node reused by the
        // virtualized feed for a different post). Restore only our own hides.
        target.style.display = '';
        delete target.dataset.lfpHidden;
      }
    }

    // Right rail: a single fixed element, not a feed card. Hiding it also
    // stretches the feed into the freed space via the root stretch class.
    const rail = findRightRail();
    if (rail) {
      if (settings[RIGHT_RAIL_CATEGORY]) {
        rail.setAttribute('data-lfp-rail', '');
        if (rail.style.display !== 'none') rail.style.display = 'none';
        document.documentElement.classList.toggle(STRETCH_CLASS, !!settings[STRETCH_OPTION]);
        counts[RIGHT_RAIL_CATEGORY] = 1;
      } else if (rail.hasAttribute('data-lfp-rail')) {
        rail.style.display = '';
        rail.removeAttribute('data-lfp-rail');
        document.documentElement.classList.remove(STRETCH_CLASS);
      }
    }

    hiddenCount = counts;
    updatePanelCounts();
  }

  // Debounced sweep driven by feed mutations (infinite scroll / virtualization).
  let sweepTimer = null;
  function scheduleSweep() {
    if (sweepTimer) return;
    sweepTimer = setTimeout(() => { sweepTimer = null; sweep(); }, SWEEP_DEBOUNCE_MS);
  }

  function startObserver() {
    const observer = new MutationObserver(scheduleSweep);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ---- Control panel UI ----------------------------------------------------

  let panelEls = {};

  // Built with DOM methods (no innerHTML) so it works under the site's
  // Trusted Types CSP, both in-page (@grant none) and in an isolated world.
  const PANEL_CSS = `
    #lfp-panel{position:fixed;bottom:16px;left:16px;z-index:99999;
      font:13px/1.4 -apple-system,system-ui,sans-serif;color:#1d2226;
      background:#fff;border:1px solid #d0d5dd;border-radius:10px;
      box-shadow:0 6px 24px rgba(0,0,0,.16);width:248px;overflow:hidden}
    #lfp-panel .lfp-head{display:flex;align-items:center;justify-content:space-between;
      padding:8px 10px;background:#0a66c2;color:#fff;cursor:pointer;user-select:none}
    #lfp-panel .lfp-head b{font-weight:600;font-size:12.5px}
    #lfp-panel .lfp-body{padding:8px 10px}
    #lfp-panel label{display:flex;align-items:center;justify-content:space-between;
      gap:8px;padding:5px 0;cursor:pointer}
    #lfp-panel .lfp-cnt{color:#5f6b7a;font-variant-numeric:tabular-nums;font-size:12px}
    #lfp-panel input{width:16px;height:16px;accent-color:#0a66c2;cursor:pointer}
    #lfp-panel .lfp-name{display:flex;align-items:center;gap:8px;flex:1}
    #lfp-panel .lfp-foot{border-top:1px solid #eef0f2;padding-top:6px;margin-top:4px;
      color:#8a94a0;font-size:11px;text-align:center}
    #lfp-panel.lfp-collapsed .lfp-body{display:none}
    #lfp-panel .lfp-chev{transition:transform .15s}
    #lfp-panel.lfp-collapsed .lfp-chev{transform:rotate(180deg)}`;

  function el(tag, props, children) {
    const node = document.createElement(tag);
    if (props) Object.assign(node, props);
    if (children) for (const c of children) node.appendChild(c);
    return node;
  }

  function buildRow(cat, opts) {
    const cb = el('input', { type: 'checkbox' });
    cb.checked = !!settings[cat];
    cb.addEventListener('change', () => {
      settings[cat] = cb.checked;
      saveSettings();
      sweep();
    });
    const prefix = (opts && opts.noPrefix) ? ' ' : ' Hide ';
    const name = el('span', { className: 'lfp-name' }, [cb, document.createTextNode(prefix + (DISPLAY_NAMES[cat] || cat))]);
    const kids = [name];
    if (!(opts && opts.noCount)) {
      const cnt = el('span', { className: 'lfp-cnt', textContent: '0' });
      panelEls.cnt[cat] = cnt;
      kids.push(cnt);
    }
    return el('label', null, kids);
  }

  function buildPanel() {
    const style = el('style', { textContent: PANEL_CSS + STRETCH_CSS });
    document.head.appendChild(style);

    panelEls.cnt = {};
    const chev = el('span', { className: 'lfp-chev', textContent: '▾' });
    const head = el('div', { className: 'lfp-head' }, [el('b', { textContent: 'LI Purity' }), chev]);
    const body = el('div', { className: 'lfp-body' }, [
      ...CATEGORIES.map(c => buildRow(c)),
      buildRow(STRETCH_OPTION, { noPrefix: true, noCount: true }),
      el('div', { className: 'lfp-foot', textContent: 'hidden this view' }),
    ]);
    const panel = el('div', { id: 'lfp-panel' }, [head, body]);

    if (settings.panelCollapsed) panel.classList.add('lfp-collapsed');
    head.addEventListener('click', () => {
      panel.classList.toggle('lfp-collapsed');
      settings.panelCollapsed = panel.classList.contains('lfp-collapsed');
      saveSettings();
    });

    document.body.appendChild(panel);
    panelEls.panel = panel;
  }

  function updatePanelCounts() {
    if (!panelEls.cnt) return;
    for (const c of CATEGORIES) {
      if (panelEls.cnt[c]) panelEls.cnt[c].textContent = hiddenCount[c] || 0;
    }
  }

  // ---- Init ----------------------------------------------------------------

  function init() {
    if (document.getElementById('lfp-panel')) return; // guard against double-inject
    buildPanel();
    startObserver();
    sweep();
  }

  if (document.body) init();
  else window.addEventListener('DOMContentLoaded', init);
})();
