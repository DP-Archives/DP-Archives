/* =============================================================================
   DP-Archives — shared front-end logic
   Handles: theme · command palette · website preview engine · cards ·
            homepage archive · project details · quick-look dialog
   Rendered by: index.html, project.html, 404.html
   ============================================================================= */
(function () {
  'use strict';

  /* ------------------------------------------------------------ 1. data ---- */
  var PROJECTS = (window.DP_PROJECTS || []).filter(function (p) { return p && p.slug; });

  var SITE = Object.assign({
    name: 'DP-Archives',
    role: 'Digital Headquarters',
    tagline: 'Central hub for my websites, tools, experiments and digital projects.',
    about: "I'm a builder. This headquarters consolidates every website, tool and experiment released under one roof.",
    feedbackUrl: '',
    copyright: '\u00A9 2026 DP-Archives — Built with curiosity',
    statusLabel: 'SYSTEM STATUS: OPERATIONAL',
    heroStatus: 'Digital ecosystem online',
    email: '',
    socials: []
  }, window.DP_SITE || {});

  /* --------------------------------------------------------- 2. helpers ---- */
  var ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC_MAP[c]; });
  }

  function el(id) { return document.getElementById(id); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  }

  /* Normalises sloppy links ("https:///site.com" -> "https://site.com"). */
  function normalizeUrl(raw) {
    var u = String(raw || '').trim();
    if (!u) return '';
    if (/^(mailto:|tel:)/i.test(u)) return u;
    u = u.replace(/^https?:\/{2,}/i, '').replace(/^\/+/, '');
    if (!u) return '';
    return 'https://' + u;
  }

  function liveUrl(p) {
    var u = normalizeUrl(p.url);
    return /^https?:\/\//i.test(u) ? u : '';
  }

  function sourceUrl(p) {
    var u = normalizeUrl(p.github);
    return /^https?:\/\//i.test(u) ? u : '';
  }

  function hostOf(url) {
    try { return new URL(url).host.replace(/^www\./, ''); } catch (e) { return url; }
  }

  var STATUS = {
    'live': { tone: 'var(--ok)', label: 'Live', pulse: true, rank: 0 },
    'beta': { tone: 'var(--warn)', label: 'Beta', pulse: false, rank: 1 },
    'in development': { tone: 'var(--info)', label: 'In development', pulse: false, rank: 2 },
    'maintenance': { tone: 'var(--warn)', label: 'Maintenance', pulse: false, rank: 1 },
    'offline': { tone: 'var(--off)', label: 'Offline', pulse: false, rank: 3 },
    'archived': { tone: 'var(--off)', label: 'Archived', pulse: false, rank: 4 }
  };
  function statusMeta(status) {
    var k = String(status || '').toLowerCase();
    return STATUS[k] || { tone: 'var(--text-3)', label: status || 'Active', pulse: false, rank: 3 };
  }
  function statusChip(p) {
    var s = statusMeta(p.status);
    return '<span class="status" style="color:' + s.tone + '">' +
      '<span class="dot' + (s.pulse ? ' dot-pulse' : '') + '" style="--dot:' + s.tone + '"></span>' +
      esc(s.label) + '</span>';
  }

  function tech(p) { return Array.isArray(p.tech) ? p.tech.filter(Boolean) : []; }

  function accent(p) { return /^#[0-9a-f]{3,8}$/i.test(p.accent || '') ? p.accent : '#8b5cf6'; }

  function hexA(hex, alpha) {
    var h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h.slice(0, 6), 16);
    if (isNaN(n)) return 'rgba(139,92,246,' + alpha + ')';
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
  }

  function initials(p) {
    var parts = String(p.name || '?').replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms || 160);
    };
  }

  function bySlug(slug) {
    for (var i = 0; i < PROJECTS.length; i++) if (PROJECTS[i].slug === slug) return PROJECTS[i];
    return null;
  }

  function reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  var toastTimer;
  function toast(msg) {
    var t = el('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2800);
  }

  function copyText(text, okMsg) {
    var done = function () { toast(okMsg || 'Copied to clipboard'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { toast('Copy failed — select the URL manually'); });
    } else {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('Copy failed'); }
      document.body.removeChild(ta);
    }
  }

  function openExternal(url) {
    if (!url) return;
    window.open(url, '_blank', 'noopener');
  }
  /* ------------------------------------------------------- 3. favourites ---- */
  var FAV_KEY = 'dp_favorites';
  var FAVS = (function () {
    try {
      var raw = JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch (e) { return []; }
  })();

  function isFav(slug) { return FAVS.indexOf(slug) !== -1; }

  function toggleFav(slug) {
    var i = FAVS.indexOf(slug);
    if (i === -1) { FAVS.push(slug); toast('Saved to this browser'); }
    else { FAVS.splice(i, 1); toast('Removed from saved'); }
    try { localStorage.setItem(FAV_KEY, JSON.stringify(FAVS)); } catch (e) {}
    renderFavStates();
    if (el('grid')) renderArchive();
    return i === -1;
  }

  function renderFavStates() {
    qsa('[data-fav]').forEach(function (b) {
      var on = isFav(b.getAttribute('data-fav'));
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.title = on ? 'Remove from saved' : 'Save to this browser';
    });
  }

  var ICON = {
    star: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.6 2.6 5.3 5.9.86-4.25 4.14 1 5.9L12 17l-5.25 2.76 1-5.9L3.5 9.76l5.9-.86Z"/></svg>',
    external: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8M18 14v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4"/></svg>',
    eye: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
    arrow: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    code: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m8 6-6 6 6 6M16 6l6 6-6 6"/></svg>',
    copy: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>',
    play: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5 19 12 7 19.5Z"/></svg>'
  };

  /* ----------------------------------------------------------- 4. theme ---- */
  function currentTheme() { return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'; }

  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('dp_theme', t); } catch (e) {}
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'light' ? '#f4f4f8' : '#06060b');
    var btn = el('themeBtn');
    if (btn) btn.setAttribute('aria-label', t === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
  }

  function initTheme() {
    var mod = document.querySelector('[data-mod]');
    if (mod && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)) mod.textContent = '\u2318';
    var btn = el('themeBtn');
    if (btn) btn.addEventListener('click', function () {
      var next = currentTheme() === 'light' ? 'dark' : 'light';
      applyTheme(next);
      toast(next === 'light' ? 'Light theme on' : 'Dark theme on');
    });
    applyTheme(currentTheme());
  }
  /* ---------------------------------------------------------- 5. chrome ---- */
  /* Reveal-on-scroll uses one long-lived observer. Every render that injects
     `.reveal` markup MUST call initReveal() again for its own root: the
     IntersectionObserver only ever saw the nodes present at boot, so cards
     written into the grid later (search, filters, sort, favourites) would keep
     the `html.js .reveal{opacity:0}` rule and never become visible. */
  var revealObserver = null;
  function revealIO() {
    if (revealObserver) return revealObserver;
    revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); revealObserver.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    return revealObserver;
  }

  function initReveal(root) {
    var items = qsa('.reveal:not(.in)', root);
    if (!items.length) return;
    if (!('IntersectionObserver' in window) || reduced()) {
      items.forEach(function (i) { i.classList.add('in'); });
      return;
    }
    var io = revealIO();
    var vh = window.innerHeight || (document.documentElement && document.documentElement.clientHeight) || 0;
    items.forEach(function (i) {
      // Nodes already on screen (a re-render under the reader) are shown at
      // once, otherwise they would sit invisible until the next scroll.
      var r = i.getBoundingClientRect();
      if (vh && r.top < vh && r.bottom > 0) { i.classList.add('in'); return; }
      io.observe(i);
    });
  }

  function initSpotlight() {
    if (reduced()) return;
    document.addEventListener('pointermove', function (e) {
      var card = e.target.closest && e.target.closest('.spot');
      if (!card) return;
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });
  }

  function openSheet(open) {
    var sheet = el('mobileSheet');
    var menuBtn = el('menuBtn');
    if (!sheet) return;
    sheet.classList.toggle('open', open);
    if (menuBtn) menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.style.overflow = open ? 'hidden' : '';
  }

  function initChrome() {
    var header = document.querySelector('.site-header');
    var progress = el('progress');
    var navLinks = qsa('.nav-link');

    function onScroll() {
      if (progress) {
        var h = document.documentElement;
        var max = h.scrollHeight - h.clientHeight;
        progress.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
      }
      if (header) header.classList.toggle('is-stuck', window.scrollY > 8);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    if (navLinks.length && 'IntersectionObserver' in window) {
      var seen = {};
      var sections = navLinks.map(function (a) { return a.getAttribute('href'); })
        .filter(function (h) { return h && h.charAt(0) === '#'; })
        .map(function (h) { return el(h.slice(1)); })
        .filter(function (s) {
          if (!s || seen[s.id]) return false;
          seen[s.id] = 1;
          return true;
        });
      if (sections.length) {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) {
            if (!e.isIntersecting) return;
            navLinks.forEach(function (a) {
              a.classList.toggle('is-active', a.getAttribute('href') === '#' + e.target.id);
            });
          });
        }, { rootMargin: '-45% 0px -50% 0px' });
        sections.forEach(function (s) { io.observe(s); });
      }
    }

    var menuBtn = el('menuBtn');
    if (menuBtn) menuBtn.addEventListener('click', function () { openSheet(!el('mobileSheet').classList.contains('open')); });
    qsa('[data-close-sheet]').forEach(function (b) {
      b.addEventListener('click', function () { openSheet(false); });
    });
    qsa('[data-open-palette]').forEach(function (b) {
      b.addEventListener('click', function () { openSheet(false); openPalette(); });
    });

    var toTop = el('toTop');
    if (toTop) toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
    });

    /* keyboard: Ctrl/Cmd+K palette · "/" search · "?" help · "g t" top */
    var gPending = false;
    document.addEventListener('keydown', function (e) {
      if (String(e.key).toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        openPalette();
        return;
      }
      var tag = (e.target && e.target.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === '/') {
        var s = el('search');
        e.preventDefault();
        if (s) { s.focus(); s.select(); } else { openPalette(); }
      } else if (e.key === '?') {
        toast('Ctrl/\u2318 + K palette · / search · G then T top · \u2191\u2191\u2193\u2193\u2190\u2192\u2190\u2192BA');
      } else if (String(e.key).toLowerCase() === 'g') {
        gPending = true;
        setTimeout(function () { gPending = false; }, 1200);
      } else if (gPending && String(e.key).toLowerCase() === 't') {
        gPending = false;
        window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
      }
    });

    /* Konami easter egg */
    var seq = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
    var pos = 0;
    document.addEventListener('keydown', function (e) {
      var k = String(e.key || '').toLowerCase();
      pos = (k === seq[pos]) ? pos + 1 : (k === seq[0] ? 1 : 0);
      if (pos === seq.length) {
        pos = 0;
        document.body.classList.add('glitch');
        setTimeout(function () { document.body.classList.remove('glitch'); }, 1200);
        toast('ACCESS GRANTED · archive unlocked · v1.0');
      }
    });
  }
  /* -------------------------------------------- 6. website preview engine ---- */
  /* Screenshots come from key-free services, tried in order until one returns an
     image (custom image → Microlink → thum.io → WordPress mShots). A generated
     "artwork" tile always sits behind the <img>, so a slow or blocked service
     can never leave an empty hole in the layout. */

  var SHOT_W = 1440, SHOT_H = 900;
  var shots = { queue: [], active: 0, max: 3, timeout: 13000 };

  function shotSources(p) {
    var out = [];
    if (p.preview) out.push(normalizeUrl(p.preview));
    var url = liveUrl(p);
    if (url) {
      out.push('https://api.microlink.io/?url=' + encodeURIComponent(url) +
        '&screenshot=true&meta=false&embed=screenshot.url&viewport.width=' + SHOT_W + '&viewport.height=' + SHOT_H);
      out.push('https://image.thum.io/get/width/' + SHOT_W + '/crop/' + SHOT_H + '/noanimate/' + url);
      out.push('https://s.wordpress.com/mshots/v1/' + encodeURIComponent(url) + '?w=' + SHOT_W + '&h=' + SHOT_H);
    }
    return out;
  }

  function queueShot(img) {
    if (img.dataset.state) return;
    img.dataset.state = 'queued';
    shots.queue.push(img);
    pumpShots();
  }

  function pumpShots() {
    while (shots.active < shots.max && shots.queue.length) {
      var img = shots.queue.shift();
      if (!img.isConnected) continue;
      shots.active++;
      attemptShot(img, shotSources(bySlug(img.getAttribute('data-shot')) || {}), 0);
    }
  }

  function endShot() {
    shots.active = Math.max(0, shots.active - 1);
    pumpShots();
  }

  function attemptShot(img, sources, i) {
    if (!img.isConnected || img.dataset.state === 'done') { endShot(); return; }
    if (i >= sources.length) { failShot(img); endShot(); return; }
    var probe = new Image();
    var settled = false;
    var timer = setTimeout(function () {
      if (settled) return;
      settled = true;
      probe.src = '';
      attemptShot(img, sources, i + 1);
    }, shots.timeout);
    probe.referrerPolicy = 'no-referrer';
    probe.onload = function () {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      img.src = sources[i];
      img.dataset.state = 'done';
      img.classList.add('is-ready');
      endShot();
    };
    probe.onerror = function () {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      attemptShot(img, sources, i + 1);
    };
    probe.src = sources[i];
  }

  function failShot(img) {
    img.dataset.state = 'failed';
    var wrap = img.closest('[data-shot-wrap]');
    if (wrap) wrap.classList.add('is-failed');
  }

  function hydrateShots(root) {
    var imgs = qsa('img[data-shot]', root || document);
    if (!imgs.length) return;
    if (!('IntersectionObserver' in window)) { imgs.forEach(queueShot); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { io.unobserve(e.target); queueShot(e.target); }
      });
    }, { rootMargin: '360px 0px', threshold: 0.01 });
    imgs.forEach(function (i) { io.observe(i); });
  }

  function loadShotsNow(root) {
    qsa('img[data-shot]', root || document).forEach(queueShot);
  }
  /* ------------------------------------------------------------- 7. cards ---- */
  function frameHTML(p, o) {
    o = o || {};
    var a = accent(p), url = liveUrl(p);
    var canLook = !!url && o.quick !== false && !!o.quick;
    return '<div class="browser' + (o.flush ? ' browser-flush' : '') + '">' +
      '<div class="browser-bar">' +
        '<span class="browser-dots" aria-hidden="true"><i></i><i></i><i></i></span>' +
        '<span class="browser-url" title="' + esc(url || 'no public link yet') + '">' +
          esc(url ? hostOf(url) : 'internal build \u2014 no public link') +
          (o.path ? '<span class="opacity-70">' + esc(o.path) + '</span>' : '') +
        '</span>' +
        (url ? '<a class="btn btn-quiet btn-sm above" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer" title="Open website" aria-label="Open ' + esc(p.name) + ' in a new tab">' + ICON.external + '</a>' : '') +
      '</div>' +
      '<div class="browser-shot" data-shot-wrap>' +
        '<div class="artwork" style="--art-hi:' + hexA(a, .22) + ';--art:' + a + '">' +
          '<span class="artwork-mark">' + esc(initials(p)) + '</span>' +
        '</div>' +
        (url ? '<img data-shot="' + esc(p.slug) + '" alt="Website preview of ' + esc(p.name) + '" loading="lazy" decoding="async" referrerpolicy="no-referrer">' : '') +
        '<span class="shot-note" data-shot-note>' + (url ? 'Preview unavailable \u2014 open the site instead' : 'No public link yet') + '</span>' +
        (canLook ? '<button type="button" class="shot-overlay" data-look="' + esc(p.slug) + '" aria-label="Quick look at ' + esc(p.name) + '"><span class="shot-badge">' + ICON.eye + ' Quick look</span></button>' : '') +
      '</div>' +
    '</div>';
  }

  function chipsHTML(p, limit) {
    var t = tech(p);
    var shown = t.slice(0, limit || 4);
    var html = shown.map(function (x) {
      return '<button type="button" class="chip-xs above" data-tech="' + esc(x) + '" title="Show projects built with ' + esc(x) + '">' + esc(x) + '</button>';
    }).join('');
    if (t.length > shown.length) html += '<span class="chip-xs">+' + (t.length - shown.length) + '</span>';
    return html;
  }

  function cardHTML(p, o) {
    o = o || {};
    var a = accent(p), url = liveUrl(p), src = sourceUrl(p), big = !!o.big;
    var details = 'project.html?p=' + encodeURIComponent(p.slug);
    var style = '--accent:' + a + ';--accent-soft:' + hexA(a, .16) + ';--accent-ring:' + hexA(a, .45);

    return '<article class="card spot reveal' + (big ? ' lg:flex-row' : '') + '" style="' + style + '" data-d="' + ((o.delay || 0) % 6) + '">' +
      '<div class="' + (big ? 'lg:w-[52%] shrink-0 border-b lg:border-b-0 lg:border-r b-line' : 'hair-bot') + '">' +
        frameHTML(p, { flush: true, quick: true }) +
      '</div>' +
      '<div class="flex flex-1 flex-col ' + (big ? 'p-6 lg:p-7' : 'p-5') + '">' +
        '<div class="flex items-start gap-3">' +
          '<span class="tile ' + (big ? 'w-11 h-11 text-lg' : 'w-9 h-9 text-[13px]') + '" style="color:' + a + ';background:' + hexA(a, .14) + '" aria-hidden="true">' + esc(initials(p)) + '</span>' +
          '<div class="min-w-0 flex-1">' +
            '<h3 class="' + (big ? 'h3' : 'text-[15px] font-semibold') + ' truncate">' +
              '<a class="card-link card-title" href="' + details + '">' + esc(p.name) + '</a>' +
            '</h3>' +
            '<p class="mono text-[11px] t-dim mt-1">' + esc(p.category) + ' \u00B7 updated ' + fmtDate(p.updated) + '</p>' +
          '</div>' +
          '<span class="above">' + statusChip(p) + '</span>' +
        '</div>' +
        '<p class="text-sm t-soft mt-3 ' + (big ? '' : 'line-clamp-2') + '">' + esc(p.tagline) + '</p>' +
        (big ? '<p class="text-sm t-dim mt-3 leading-relaxed line-clamp-3">' + esc(p.description) + '</p>' : '') +
        (tech(p).length ? '<div class="mt-4 flex flex-wrap gap-1.5">' + chipsHTML(p, big ? 6 : 4) + '</div>' : '') +
        '<div class="mt-auto pt-5 flex items-center gap-2 above">' +
          '<a class="btn btn-ghost btn-sm" href="' + details + '">Details' + ICON.arrow + '</a>' +
          (url ? '<a class="btn btn-primary btn-sm" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">Live site' + ICON.external + '</a>' : '<span class="chip-xs">Private build</span>') +
          (src ? '<a class="btn btn-quiet btn-sm" href="' + esc(src) + '" target="_blank" rel="noopener noreferrer" title="Source code" aria-label="Source code for ' + esc(p.name) + '">' + ICON.code + '</a>' : '') +
          '<button type="button" class="fav btn btn-quiet btn-sm ml-auto" data-fav="' + esc(p.slug) + '" aria-pressed="false" aria-label="Save ' + esc(p.name) + ' to this browser">' + ICON.star + '</button>' +
        '</div>' +
      '</div>' +
    '</article>';
  }
  /* ------------------------------------------- 8. quick-look + live view ---- */
  function closeOnBackdrop(dlg) {
    if (!dlg) return;
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  }

  /* Loads the real website inside the browser frame — only on an explicit click,
     so no third-party page is ever fetched behind the visitor's back. */
  function mountLive(wrap, url, name) {
    if (!wrap || !url) return;
    var iframe = document.createElement('iframe');
    iframe.setAttribute('title', 'Live preview of ' + name);
    iframe.setAttribute('referrerpolicy', 'no-referrer');
    iframe.src = url;
    wrap.innerHTML = '';
    wrap.appendChild(iframe);
    var note = document.createElement('span');
    note.className = 'shot-note';
    note.textContent = 'Loading ' + hostOf(url) + '\u2026';
    wrap.appendChild(note);
    var loaded = false;
    iframe.addEventListener('load', function () {
      loaded = true;
      if (note.parentNode) note.parentNode.removeChild(note);
    });
    setTimeout(function () {
      if (loaded || !note.parentNode) return;
      note.textContent = hostOf(url) + ' blocks embedding \u2014 open it in a new tab instead';
    }, 8000);
  }

  function actionRow(p, opts) {
    var url = liveUrl(p), src = sourceUrl(p);
    var details = 'project.html?p=' + encodeURIComponent(p.slug);
    return '<div class="flex flex-wrap items-center gap-2">' +
      (url ? '<a class="btn btn-primary btn-sm" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">Open website' + ICON.external + '</a>' : '') +
      (opts && opts.live ? '<button type="button" class="btn btn-ghost btn-sm" data-live="' + esc(p.slug) + '">' + ICON.play + ' Live render</button>' : '') +
      (opts && opts.details === false ? '' : '<a class="btn btn-ghost btn-sm" href="' + details + '">Full details' + ICON.arrow + '</a>') +
      (src ? '<a class="btn btn-quiet btn-sm" href="' + esc(src) + '" target="_blank" rel="noopener noreferrer">Source' + ICON.code + '</a>' : '') +
      '<button type="button" class="btn btn-quiet btn-sm" data-copy="' + esc(details) + '">' + ICON.copy + ' Copy link</button>' +
      '<button type="button" class="fav btn btn-quiet btn-sm ml-auto" data-fav="' + esc(p.slug) + '" aria-pressed="false" aria-label="Save ' + esc(p.name) + '">' + ICON.star + '</button>' +
    '</div>';
  }

  function openQuickLook(slug) {
    var p = bySlug(slug), dlg = el('quickLook'), body = el('quickLookBody');
    if (!p || !dlg || !body) return;
    var a = accent(p), url = liveUrl(p);

    body.innerHTML =
      '<div class="p-4 sm:p-5 flex items-start gap-3 hair-bot">' +
        '<span class="tile w-11 h-11 text-lg" style="color:' + a + ';background:' + hexA(a, .14) + '" aria-hidden="true">' + esc(initials(p)) + '</span>' +
        '<div class="min-w-0 flex-1">' +
          '<div class="flex items-center gap-3 flex-wrap">' +
            '<h2 class="h3 truncate">' + esc(p.name) + '</h2>' + statusChip(p) +
          '</div>' +
          '<p class="t-soft text-sm mt-1 line-clamp-2">' + esc(p.tagline) + '</p>' +
        '</div>' +
        '<button type="button" class="btn btn-quiet btn-icon shrink-0" data-close-dlg aria-label="Close preview">' +
          '<svg class="icon-lg icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="p-4 sm:p-5" data-live-host>' + frameHTML(p, { quick: false }) + '</div>' +
      '<div class="px-4 sm:px-5 pb-5">' +
        '<p class="mono text-[11px] t-dim mb-3">' +
          (url ? 'Preview rendered from ' + esc(hostOf(url)) + ' \u00B7 click \u201CLive render\u201D to load the real page here.'
               : 'No public website link on file ' + esc('\u2014') + ' this build is not published yet.') +
        '</p>' +
        actionRow(p, { live: !!url, details: true }) +
      '</div>';

    if (!dlg.open) dlg.showModal();
    loadShotsNow(body);
  }
  /* -------------------------------------------------- 9. command palette ---- */
  var SECTIONS = [
    ['featured', 'Featured builds', 'Flagship projects'],
    ['projects', 'All projects', 'The full archive'],
    ['ecosystem', 'Ecosystem', 'Stats at a glance'],
    ['about', 'About me', 'Who builds all this'],
    ['contact', 'Contact', 'Get in touch']
  ];

  var PAL = { items: [], view: [], idx: 0 };

  function techNames() {
    var set = {};
    PROJECTS.forEach(function (p) { tech(p).forEach(function (t) { set[t] = (set[t] || 0) + 1; }); });
    return Object.keys(set).sort(function (a, b) { return set[b] - set[a] || a.localeCompare(b); });
  }

  function goSection(id) {
    var node = el(id);
    if (!node) { location.href = 'index.html#' + id; return; }
    node.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
  }

  function filterByTech(t) {
    if (el('grid')) {
      state.tech = t.toLowerCase();
      state.category = 'all';
      if (el('search')) el('search').value = t;
      renderArchive();
      goSection('projects');
    } else {
      location.href = 'index.html?tech=' + encodeURIComponent(t) + '#projects';
    }
  }

  function paletteItems() {
    var items = [];

    SECTIONS.forEach(function (s) {
      if (!el(s[0])) return;
      items.push({
        group: 'Sections', label: s[1], hint: s[2],
        text: (s[1] + ' ' + s[2]).toLowerCase(),
        run: function () { goSection(s[0]); }
      });
    });

    items.push({
      group: 'Actions', label: 'Toggle theme', hint: 'Switch between light and dark',
      text: 'toggle theme light dark appearance colour',
      run: function () {
        var next = currentTheme() === 'light' ? 'dark' : 'light';
        applyTheme(next);
        toast(next === 'light' ? 'Light theme on' : 'Dark theme on');
      }
    });
    items.push({
      group: 'Actions', label: 'Copy this page link', hint: 'Share the archive',
      text: 'copy link share url clipboard',
      run: function () { copyText(location.href, 'Page link copied'); }
    });
    var fb = normalizeUrl(SITE.feedbackUrl);
    if (fb) {
      items.push({
        group: 'Actions', label: 'Send feedback', hint: hostOf(fb),
        text: 'feedback contact message bug report',
        run: function () { openExternal(fb); }
      });
    }
    items.push({
      group: 'Actions', label: 'system.init()', hint: 'Run the easter egg',
      text: 'system init easter egg terminal konami fun',
      run: function () {
        document.body.classList.add('glitch');
        setTimeout(function () { document.body.classList.remove('glitch'); }, 1200);
        toast('ACCESS GRANTED \u00B7 archive unlocked \u00B7 v1.0');
      }
    });

    PROJECTS.forEach(function (p) {
      var url = liveUrl(p);
      items.push({
        group: 'Projects', label: p.name,
        hint: p.category + ' \u00B7 ' + statusMeta(p.status).label + (url ? ' \u00B7 ' + hostOf(url) : ''),
        badge: accent(p),
        text: [p.name, p.tagline, p.description, p.category, tech(p).join(' ')].join(' ').toLowerCase(),
        run: function () { location.href = 'project.html?p=' + encodeURIComponent(p.slug); }
      });
    });

    techNames().forEach(function (t) {
      items.push({
        group: 'Stack', label: t, hint: 'Filter the archive by this technology',
        text: ('stack tech technology ' + t).toLowerCase(),
        run: function () { filterByTech(t); }
      });
    });

    return items;
  }
  function paletteHighlight() {
    var list = el('paletteList');
    if (!list) return;
    qsa('[data-pal]', list).forEach(function (b) {
      var on = Number(b.getAttribute('data-pal')) === PAL.idx;
      b.classList.toggle('is-active', on);
      if (b.parentNode && b.parentNode.setAttribute) b.parentNode.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on && b.scrollIntoView) b.scrollIntoView({ block: 'nearest' });
    });
  }

  function paletteRender(query) {
    var list = el('paletteList'), count = el('paletteCount');
    if (!list) return;
    var q = String(query || '').trim().toLowerCase();
    var view;
    if (!q) {
      view = PAL.items.filter(function (i) { return i.group === 'Projects'; }).slice(0, 6)
        .concat(PAL.items.filter(function (i) { return i.group === 'Actions'; }))
        .concat(PAL.items.filter(function (i) { return i.group === 'Sections'; }));
    } else {
      view = PAL.items.filter(function (i) {
        return (i.label + ' ' + (i.text || '')).toLowerCase().indexOf(q) !== -1;
      }).slice(0, 40);
    }
    PAL.view = view;
    PAL.idx = 0;

    if (!view.length) {
      list.innerHTML = '<li class="px-4 py-10 text-center t-dim text-sm">No matches for \u201C' + esc(query) + '\u201D</li>';
      if (count) count.textContent = '';
      return;
    }

    var html = '', group = '';
    view.forEach(function (item, i) {
      if (item.group !== group) {
        html += '<li class="px-3 pt-3 pb-1 eyebrow" role="presentation">' + esc(item.group) + '</li>';
        group = item.group;
      }
      html += '<li role="option" id="pal-' + i + '" aria-selected="' + (i === 0 ? 'true' : 'false') + '">' +
        '<button type="button" class="pal-item" data-pal="' + i + '">' +
          (item.badge
            ? '<span class="tile w-7 h-7 text-[10px]" style="color:' + item.badge + ';background:' + hexA(item.badge, .14) + '" aria-hidden="true">' + esc(initials({ name: item.label })) + '</span>'
            : '<span class="tile w-7 h-7 t-dim" aria-hidden="true">' + ICON.arrow + '</span>') +
          '<span class="min-w-0 flex-1">' +
            '<span class="block truncate text-[13.5px] font-medium">' + esc(item.label) + '</span>' +
            (item.hint ? '<span class="block truncate text-[11px] mono t-dim mt-0.5">' + esc(item.hint) + '</span>' : '') +
          '</span>' +
          '<span class="kbd">\u21B5</span>' +
        '</button></li>';
    });
    list.innerHTML = html;
    if (count) count.textContent = view.length + ' result' + (view.length === 1 ? '' : 's');
    paletteHighlight();
  }

  function paletteMove(step) {
    if (!PAL.view.length) return;
    PAL.idx = (PAL.idx + step + PAL.view.length) % PAL.view.length;
    paletteHighlight();
  }

  function paletteRun(i) {
    var item = PAL.view[i];
    if (!item) return;
    closePalette();
    item.run();
  }

  function openPalette() {
    var dlg = el('palette'), input = el('paletteInput');
    if (!dlg || !input) return;
    PAL.items = paletteItems();
    input.value = '';
    paletteRender('');
    if (!dlg.open) dlg.showModal();
    setTimeout(function () { input.focus(); }, 40);
  }

  function closePalette() {
    var dlg = el('palette');
    if (dlg && dlg.open) dlg.close();
  }

  function initPalette() {
    var dlg = el('palette'), input = el('paletteInput'), list = el('paletteList'), btn = el('paletteBtn');
    if (btn) btn.addEventListener('click', openPalette);
    if (!dlg || !input || !list) return;
    closeOnBackdrop(dlg);
    input.addEventListener('input', debounce(function () { paletteRender(input.value); }, 90));
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); paletteMove(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); paletteMove(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); paletteRun(PAL.idx); }
    });
    list.addEventListener('click', function (e) {
      var b = e.target.closest('[data-pal]');
      if (b) paletteRun(Number(b.getAttribute('data-pal')));
    });
    list.addEventListener('pointermove', function (e) {
      var b = e.target.closest('[data-pal]');
      if (!b) return;
      var i = Number(b.getAttribute('data-pal'));
      if (i !== PAL.idx) { PAL.idx = i; paletteHighlight(); }
    });
  }
  /* -------------------------------------------------------- 10. homepage ---- */
  var state = { q: '', category: 'all', tech: '', sort: 'featured', saved: false };

  function ordered(list) {
    var out = list.slice();
    var byUpdated = function (a, b) { return String(b.updated || '').localeCompare(String(a.updated || '')); };
    if (state.sort === 'updated') out.sort(byUpdated);
    else if (state.sort === 'az') out.sort(function (a, b) { return a.name.localeCompare(b.name); });
    else if (state.sort === 'category') out.sort(function (a, b) { return String(a.category).localeCompare(String(b.category)) || a.name.localeCompare(b.name); });
    else out.sort(function (a, b) { return (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || byUpdated(a, b); });
    return out;
  }

  function matches(p) {
    if (state.saved && !isFav(p.slug)) return false;
    if (state.category === '__featured') { if (!p.featured) return false; }
    else if (state.category !== 'all' && p.category !== state.category) return false;
    var q = state.q.trim().toLowerCase();
    if (!q) return true;
    return [p.name, p.tagline, p.description, p.category, tech(p).join(' ')].join(' ').toLowerCase().indexOf(q) !== -1;
  }

  function categories() {
    var seen = {};
    PROJECTS.forEach(function (p) { if (p.category) seen[p.category] = (seen[p.category] || 0) + 1; });
    return Object.keys(seen).sort(function (a, b) { return seen[b] - seen[a] || a.localeCompare(b); });
  }

  function renderChips() {
    var host = el('catChips');
    if (!host) return;
    var chip = function (label, value, on, extra) {
      return '<button type="button" class="chip shrink-0" data-cat="' + esc(value) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
        esc(label) + (extra ? ' <span class="mono text-[10px] t-dim">' + esc(extra) + '</span>' : '') + '</button>';
    };
    var html =
      chip('All', 'all', state.category === 'all', String(PROJECTS.length)) +
      chip('Featured', '__featured', state.category === '__featured', String(PROJECTS.filter(function (p) { return p.featured; }).length)) +
      chip('\u2605 Saved', '__saved', !!state.saved, String(FAVS.length));

    if (state.tech) {
      html += '<button type="button" class="chip is-on shrink-0" data-cat="__all" aria-pressed="true">stack: ' + esc(state.tech) + ' \u2715</button>';
    } else {
      categories().forEach(function (c) { html += chip(c, c, false); });
    }
    host.innerHTML = html;

    var reset = el('resetFilters');
    if (reset) {
      var active = !!state.q || !!state.tech || state.saved || state.category !== 'all';
      reset.classList.toggle('hidden', !active);
    }
  }

  function syncUrl() {
    var params = new URLSearchParams();
    if (state.q.trim()) params.set('q', state.q.trim());
    if (state.tech) params.set('tech', state.tech);
    if (state.sort !== 'featured') params.set('sort', state.sort);
    if (state.category === '__featured') params.set('filter', 'featured');
    else if (state.saved) params.set('filter', 'saved');
    else if (state.category !== 'all') params.set('category', state.category);
    var qs = params.toString();
    history.replaceState(null, '', qs ? '?' + qs : location.pathname);
  }
  function renderArchive() {
    var grid = el('grid');
    if (!grid) return;
    var list = ordered(PROJECTS.filter(matches));

    var fGrid = el('featuredGrid');
    if (fGrid) {
      var feat = list.filter(function (p) { return p.featured; });
      fGrid.innerHTML = feat.map(function (p, i) { return cardHTML(p, { big: true, delay: i % 4 }); }).join('');
      var fe = el('featuredEmpty');
      if (fe) fe.classList.toggle('hidden', feat.length > 0);
      initReveal(fGrid);
      hydrateShots(fGrid);
    }

    grid.innerHTML = list.map(function (p, i) { return cardHTML(p, { delay: i % 5 }); }).join('');
    initReveal(grid);

    var empty = el('empty');
    if (empty) empty.classList.toggle('hidden', list.length > 0);

    var meta = el('resultMeta');
    if (meta) {
      var live = list.filter(function (p) { return !!liveUrl(p); }).length;
      var cats = {};
      list.forEach(function (p) { cats[p.category] = 1; });
      var catCount = Object.keys(cats).length;
      meta.textContent = !list.length ? '' :
        list.length + ' project' + (list.length === 1 ? '' : 's') + ' shown \u00B7 ' +
        live + ' with a live website \u00B7 ' + catCount + ' categor' + (catCount === 1 ? 'y' : 'ies');
    }

    var count = el('archiveCount');
    if (count) count.textContent = PROJECTS.length + ' total \u00B7 ' + PROJECTS.filter(function (p) { return p.featured; }).length + ' featured';

    renderChips();
    renderFavStates();
    hydrateShots(grid);
    syncUrl();
  }

  function resetFilters() {
    state.q = ''; state.category = 'all'; state.tech = ''; state.saved = false;
    var search = el('search');
    if (search) search.value = '';
    renderArchive();
    goSection('projects');
  }

  function initHome() {
    var search = el('search'), sort = el('sort');
    var params = new URLSearchParams(location.search);

    state.q = params.get('q') || '';
    state.tech = (params.get('tech') || '').toLowerCase();
    state.sort = params.get('sort') || 'featured';
    var filter = params.get('filter');
    if (filter === 'featured') state.category = '__featured';
    else if (filter === 'saved') state.saved = true;
    else state.category = params.get('category') || 'all';
    if (state.tech && !state.q) state.q = state.tech;

    if (search) {
      search.value = state.q;
      search.addEventListener('input', debounce(function () { state.q = search.value; renderArchive(); }, 140));
      search.addEventListener('search', function () { state.q = search.value; renderArchive(); });
    }
    if (sort) {
      sort.value = state.sort;
      sort.addEventListener('change', function () { state.sort = sort.value; renderArchive(); });
    }
    var resetBtn = el('resetFilters'), clearBtn = el('clearFilters');
    if (resetBtn) resetBtn.addEventListener('click', resetFilters);
    if (clearBtn) clearBtn.addEventListener('click', resetFilters);

    renderHero();
    renderMarquee();
    renderAbout();
    renderEcosystem();
    renderArchive();
    renderFavStates();
  }

  function renderHero() {
    var stats = el('heroStats');
    if (stats) {
      var live = PROJECTS.filter(function (p) { return !!liveUrl(p); }).length;
      var cells = [
        [PROJECTS.length, 'Projects'],
        [live, 'Live websites'],
        [techNames().length, 'Technologies'],
        [categories().length, 'Categories']
      ];
      stats.innerHTML = cells.map(function (c) {
        return '<div><dt class="stat-num">' + c[0] + '</dt>' +
          '<dd class="mono text-[10.5px] t-dim mt-2 uppercase tracking-[.16em]">' + esc(c[1]) + '</dd></div>';
      }).join('');
    }

    var host = el('heroStack');
    if (!host) return;
    var live = PROJECTS.filter(function (p) { return !!liveUrl(p); });
    var picks = (live.length ? live : PROJECTS).slice(0, 2);
    if (!picks.length) {
      host.innerHTML = '<div class="panel p-8 text-center t-dim text-sm">No projects yet \u2014 add the first one in the admin panel.</div>';
      return;
    }
    var main = picks[0], second = picks[1];

    host.innerHTML =
      '<div class="relative">' +
        '<div class="absolute -inset-8 rounded-[36px] pointer-events-none" style="background:radial-gradient(circle at 65% 25%,var(--accent-soft),transparent 62%)" aria-hidden="true"></div>' +
        '<div class="relative z-10 mx-auto w-full max-w-[540px] float-a">' + frameHTML(main, { quick: true }) + '</div>' +
        (second ? '<div class="absolute -bottom-10 right-0 w-[52%] max-w-[290px] z-20 hidden sm:block stack-2 float-b">' + frameHTML(second, { quick: true }) + '</div>' : '') +
        '<div class="panel absolute -left-3 top-8 z-20 px-5 py-4 hidden lg:block">' +
          '<p class="mono text-[10px] t-dim uppercase tracking-[.18em]">Archive</p>' +
          '<p class="stat-num mt-2">' + PROJECTS.length + '</p>' +
          '<p class="text-[11px] t-dim mt-1">projects indexed</p>' +
        '</div>' +
      '</div>';

    loadShotsNow(host);
  }

  function renderMarquee() {
    var host = el('techMarquee');
    if (!host) return;
    var names = techNames();
    if (!names.length) {
      host.innerHTML = '<span class="chip-xs">Add a tech stack to a project to build this strip</span>';
      return;
    }
    var items = names.map(function (t) {
      return '<button type="button" class="chip-xs above" data-tech="' + esc(t) + '">' + esc(t) + '</button>';
    }).join('');
    host.innerHTML = '<div class="flex gap-2.5 pr-2.5 shrink-0">' + items + '</div>' +
                     '<div class="flex gap-2.5 pr-2.5 shrink-0" aria-hidden="true">' + items + '</div>';
  }
  function renderAbout() {
    var host = el('focusChips');
    if (host) {
      host.innerHTML = categories().map(function (c) {
        return '<button type="button" class="chip" data-cat="' + esc(c) + '">' + esc(c) + '</button>';
      }).join('');
    }
    var cur = el('currentlyText');
    if (cur) {
      var latest = PROJECTS.map(function (p) { return p.updated; }).filter(Boolean).sort().pop();
      cur.textContent = 'Building, refining and shipping. ' + PROJECTS.filter(function (p) { return p.status === 'In Development'; }).length +
        ' build(s) in development, latest archive update ' + (latest ? fmtDate(latest) : '—') + '.';
    }
  }

  function barsHTML(map, order) {
    var keys = order || Object.keys(map);
    keys = keys.filter(function (k) { return map[k]; });
    if (!keys.length) return '<p class="t-dim text-sm">No data yet.</p>';
    var max = keys.reduce(function (m, k) { return Math.max(m, map[k]); }, 1);
    return keys.map(function (k) {
      return '<div>' +
        '<div class="flex items-center justify-between gap-3 text-[13px]">' +
          '<span class="truncate">' + esc(k) + '</span>' +
          '<span class="mono t-dim">' + map[k] + '</span>' +
        '</div>' +
        '<div class="bar mt-2"><i style="width:' + Math.round((map[k] / max) * 100) + '%"></i></div>' +
      '</div>';
    }).join('');
  }

  function renderEcosystem() {
    var cards = el('statCards');
    var byCat = {};
    PROJECTS.forEach(function (p) { byCat[p.category] = (byCat[p.category] || 0) + 1; });

    if (cards) {
      var cells = [
        [PROJECTS.length, 'Projects indexed', 'Everything in the archive'],
        [PROJECTS.filter(function (p) { return !!liveUrl(p); }).length, 'Live websites', 'Public and reachable'],
        [PROJECTS.filter(function (p) { return p.featured; }).length, 'Featured builds', 'Flagged as flagship'],
        [techNames().length, 'Technologies', 'Across every stack']
      ];
      cards.innerHTML = cells.map(function (c, i) {
        return '<div class="panel spot p-6 reveal" data-d="' + (i % 4) + '">' +
          '<p class="stat-num">' + c[0] + '</p>' +
          '<p class="mt-3 text-sm font-medium">' + esc(c[1]) + '</p>' +
          '<p class="mono text-[11px] t-dim mt-1">' + esc(c[2]) + '</p>' +
        '</div>';
      }).join('');
      initReveal(cards);
    }

    var catHost = el('catBars');
    if (catHost) catHost.innerHTML = barsHTML(byCat, categories());

    var statusHost = el('statusBars');
    if (statusHost) {
      var byStatus = {};
      PROJECTS.forEach(function (p) { byStatus[statusMeta(p.status).label] = (byStatus[statusMeta(p.status).label] || 0) + 1; });
      var order = Object.keys(byStatus).sort(function (a, b) { return byStatus[b] - byStatus[a]; });
      statusHost.innerHTML = barsHTML(byStatus, order);
    }

    var last = el('lastUpdated');
    if (last) {
      var dates = PROJECTS.map(function (p) { return p.updated; }).filter(Boolean).sort();
      last.textContent = dates.length ? 'Last archive update \u00B7 ' + fmtDate(dates[dates.length - 1]) : '';
    }
  }
  /* --------------------------------------------------- 11. detail page ---- */
  function renderNotFound(root, slug) {
    document.title = 'Project not found — DP-Archives';
    root.innerHTML =
      '<div class="mx-auto max-w-[1240px] px-5 sm:px-8 py-24 text-center">' +
        '<p class="eyebrow">404 — project not found</p>' +
        '<h1 class="h1 mt-6">No entry for that project.</h1>' +
        '<p class="lede mt-5 max-w-lg mx-auto">' +
          (slug ? 'The slug \u201C' + esc(slug) + '\u201D is not in the archive.' : 'No project was requested.') +
          ' It may have been renamed or removed.' +
        '</p>' +
        '<div class="mt-8 flex flex-wrap justify-center gap-3">' +
          '<a class="btn btn-primary btn-lg" href="index.html#projects">Browse the archive</a>' +
          '<button type="button" class="btn btn-ghost btn-lg" data-open-palette>Search projects</button>' +
        '</div>' +
      '</div>';
  }

  function factsHTML(p) {
    var url = liveUrl(p);
    var rows = [
      ['Category', esc(p.category || '—')],
      ['Status', statusChip(p)],
      ['Updated', '<span class="mono text-[12px]">' + esc(fmtDate(p.updated)) + '</span>'],
      ['Live at', url
        ? '<a class="link-u mono text-[12px]" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(hostOf(url)) + '</a>'
        : '<span class="t-dim">not published</span>']
    ];
    return '<dl class="space-y-4 text-sm">' + rows.map(function (r) {
      return '<div class="flex items-start justify-between gap-4"><dt class="t-dim">' + r[0] + '</dt>' +
        '<dd class="text-right">' + r[1] + '</dd></div>';
    }).join('') + '</dl>';
  }

  function initDetail() {
    var root = el('detail');
    if (!root) return;
    var slug = new URLSearchParams(location.search).get('p');
    var p = bySlug(slug);
    if (!p) { renderNotFound(root, slug); return; }

    var a = accent(p), url = liveUrl(p);
    var idx = PROJECTS.indexOf(p);
    var prev = PROJECTS[(idx - 1 + PROJECTS.length) % PROJECTS.length];
    var next = PROJECTS[(idx + 1) % PROJECTS.length];
    var related = PROJECTS.filter(function (x) { return x.slug !== p.slug && x.category === p.category; }).slice(0, 3);
    if (related.length < 3) {
      PROJECTS.forEach(function (x) {
        if (related.length < 3 && x.slug !== p.slug && related.indexOf(x) === -1) related.push(x);
      });
    }

    document.title = p.name + ' — DP-Archives';
    var desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', (p.tagline || p.name) + ' — ' + String(p.description || '').slice(0, 140));
    var ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', p.name + ' — DP-Archives');
    var ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', p.tagline || '');
    var ogImg = document.querySelector('meta[property="og:image"]');
    if (ogImg && url) {
      ogImg.setAttribute('content', 'https://api.microlink.io/?url=' + encodeURIComponent(url) + '&screenshot=true&meta=false&embed=screenshot.url');
    }

    var path = '';
    try { path = url ? new URL(url).pathname : ''; } catch (e) { path = ''; }

    root.innerHTML = detailHead(p, a, url, path) + detailBody(p, related, prev, next);
    initReveal(root);
    hydrateShots(root);
    renderFavStates();
  }
  function detailHead(p, a, url, path) {
    return '<div class="mx-auto max-w-[1240px] px-5 sm:px-8" style="--accent:' + a + ';--accent-soft:' + hexA(a, .16) + ';--accent-ring:' + hexA(a, .45) + '">' +
      '<nav class="flex flex-wrap items-center justify-between gap-3 mb-9" aria-label="Project navigation">' +
        '<a href="index.html#projects" class="btn btn-quiet btn-sm">' +
          '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 18l-6-6 6-6"/></svg> Back to the archive' +
        '</a>' +
        '<div class="flex items-center gap-2">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-copy="' + esc(location.href) + '">' + ICON.copy + ' Copy link</button>' +
          '<button type="button" class="fav btn btn-ghost btn-sm" data-fav="' + esc(p.slug) + '" aria-pressed="false" aria-label="Save ' + esc(p.name) + '">' + ICON.star + ' Save</button>' +
        '</div>' +
      '</nav>' +

      '<header class="grid lg:grid-cols-[1.35fr_.65fr] gap-10 xl:gap-14 items-start">' +
        '<div>' +
          '<div class="flex items-center gap-3 flex-wrap">' +
            '<p class="eyebrow">' + esc(p.category || 'Project') + '</p>' +
            '<span class="t-dim" aria-hidden="true">/</span>' +
            statusChip(p) +
          '</div>' +
          '<div class="mt-6 flex items-center gap-4">' +
            '<span class="tile tile-lg" style="color:' + a + ';background:' + hexA(a, .14) + '" aria-hidden="true">' + esc(initials(p)) + '</span>' +
            '<h1 class="h1" style="font-size:clamp(32px,5vw,58px)">' + esc(p.name) + '</h1>' +
          '</div>' +
          '<p class="lede mt-5 max-w-2xl">' + esc(p.tagline) + '</p>' +
          '<div class="mt-8">' + actionRow(p, { live: !!url, details: false }) + '</div>' +
        '</div>' +
        '<aside class="panel p-6 w-full">' +
          '<h2 class="eyebrow">At a glance</h2>' +
          '<div class="mt-5">' + factsHTML(p) + '</div>' +
        '</aside>' +
      '</header>' +

      '<section class="mt-14">' +
        '<div class="flex flex-wrap items-end justify-between gap-3 mb-4">' +
          '<h2 class="eyebrow">Website preview</h2>' +
          '<p class="mono text-[11px] t-dim">' +
            (url ? 'Screenshot of ' + esc(hostOf(url)) + ' \u00B7 \u201CLive render\u201D loads the real page in place'
                 : 'No public website on file for this build yet') +
          '</p>' +
        '</div>' +
        '<div data-live-host>' + frameHTML(p, { quick: false, path: path }) + '</div>' +
      '</section>' +
    '</div>';
  }
  function detailBody(p, related, prev, next) {
    var stack = tech(p);
    var features = Array.isArray(p.features) ? p.features.filter(Boolean) : [];
    var src = sourceUrl(p);

    return '<div class="mx-auto max-w-[1240px] px-5 sm:px-8" style="--accent:' + accent(p) + '">' +
      '<section class="mt-16 grid lg:grid-cols-[1.4fr_.6fr] gap-10 xl:gap-14 items-start">' +
        '<div>' +
          '<h2 class="eyebrow">Overview</h2>' +
          '<p class="mt-4 text-[17px] leading-relaxed t-soft">' + esc(p.description || 'No description recorded yet.') + '</p>' +
          (features.length
            ? '<h2 class="eyebrow mt-10">Highlights</h2>' +
              '<ul class="mt-4 grid sm:grid-cols-2 gap-3">' + features.map(function (f) {
                return '<li class="panel p-4 flex items-start gap-3 text-sm t-soft">' +
                  '<span class="dot mt-1.5" style="--dot:' + accent(p) + '"></span><span>' + esc(f) + '</span></li>';
              }).join('') + '</ul>'
            : '') +
        '</div>' +
        '<aside class="panel p-6">' +
          '<h2 class="eyebrow">Build details</h2>' +
          '<div class="mt-5 space-y-4 text-sm">' +
            '<div class="flex items-start justify-between gap-4"><span class="t-dim">Index</span><span class="mono text-[12px]">' +
              (PROJECTS.indexOf(p) + 1) + ' / ' + PROJECTS.length + '</span></div>' +
            '<div class="flex items-start justify-between gap-4"><span class="t-dim">Links</span><span class="mono text-[12px]">' +
              (liveUrl(p) ? 'website' : 'none') + (src ? ' + source' : '') + '</span></div>' +
            (p.created
              ? '<div class="flex items-start justify-between gap-4"><span class="t-dim">Started</span><span class="mono text-[12px]">' + esc(fmtDate(p.created)) + '</span></div>'
              : '') +
          '</div>' +
          '<h3 class="eyebrow mt-8">Stack</h3>' +
          '<div class="mt-4 flex flex-wrap gap-1.5">' +
            (stack.length
              ? stack.map(function (t) { return '<button type="button" class="chip-xs" data-tech="' + esc(t) + '">' + esc(t) + '</button>'; }).join('')
              : '<span class="t-dim text-sm">Not recorded yet</span>') +
          '</div>' +
        '</aside>' +
      '</section>' +

      (related.length
        ? '<section class="mt-20">' +
            '<div class="flex flex-wrap items-end justify-between gap-3 mb-6">' +
              '<div><p class="eyebrow">Keep exploring</p>' +
              '<h2 class="h2 mt-3" style="font-size:clamp(22px,2vw,30px)">More from the archive</h2></div>' +
              '<a class="btn btn-ghost btn-sm" href="index.html#projects">All projects' + ICON.arrow + '</a>' +
            '</div>' +
            '<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">' +
              related.map(function (r, i) { return cardHTML(r, { delay: i % 2 }); }).join('') +
            '</div>' +
          '</section>'
        : '') +

      '<nav class="mt-16 grid sm:grid-cols-2 gap-4" aria-label="Previous and next project">' +
        '<a class="panel spot block p-5" href="project.html?p=' + encodeURIComponent(prev.slug) + '">' +
          '<span class="eyebrow">Previous</span>' +
          '<span class="mt-2 font-semibold flex items-center gap-2">' +
            '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>' + esc(prev.name) +
          '</span>' +
        '</a>' +
        '<a class="panel spot block p-5" href="project.html?p=' + encodeURIComponent(next.slug) + '">' +
          '<span class="eyebrow">Next</span>' +
          '<span class="mt-2 font-semibold flex items-center gap-2 sm:justify-end">' + esc(next.name) + ICON.arrow + '</span>' +
        '</a>' +
      '</nav>' +
    '</div>';
  }
  /* ----------------------------------------------- 12. 404 suggestions ---- */
  function initSuggest() {
    var host = el('suggest');
    if (!host) return;
    var picks = PROJECTS.filter(function (p) { return p.featured; });
    if (picks.length < 3) {
      PROJECTS.forEach(function (p) { if (picks.length < 3 && picks.indexOf(p) === -1) picks.push(p); });
    }
    picks = picks.slice(0, 3);
    if (!picks.length) {
      host.innerHTML = '<p class="t-dim text-sm">The archive is empty right now.</p>';
      return;
    }
    host.innerHTML = picks.map(function (p, i) { return cardHTML(p, { delay: i % 3 }); }).join('');
    initReveal(host);
    hydrateShots(host);
  }

  /* --------------------------------------------------- 13. shared text ---- */
  function initSiteText() {
    var set = function (id, text) { var n = el(id); if (n && text) n.textContent = text; };
    set('heroTagline', SITE.tagline);
    set('heroStatus', SITE.heroStatus);
    set('siteAbout', SITE.about);
    set('siteCopyright', SITE.copyright);
    set('siteStatus', SITE.statusLabel);
    set('footerTagline', SITE.tagline);

    var socials = (Array.isArray(SITE.socials) ? SITE.socials : [])
      .filter(function (s) { return s && s.url; })
      .map(function (s) { return { label: s.label || hostOf(s.url), url: normalizeUrl(s.url) }; });

    if (SITE.email && !socials.some(function (s) { return /^mailto:/i.test(s.url); })) {
      socials.push({ label: 'Email me', url: 'mailto:' + String(SITE.email).replace(/^mailto:/i, '') });
    }
    var fb = normalizeUrl(SITE.feedbackUrl);
    if (fb && !socials.some(function (s) { return s.url === fb; })) {
      socials.push({ label: 'Feedback', url: fb });
    }

    var row = el('socialRow');
    if (row) {
      row.innerHTML = socials.length
        ? socials.map(function (s) {
            return '<a class="btn btn-ghost" href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.label) + ICON.external + '</a>';
          }).join('')
        : '<p class="t-dim text-sm">Contact links can be added from the admin panel (site settings \u2192 feedback URL, or edit <span class="mono">site-config.js</span>).</p>';
    }

    var frow = el('footerSocials');
    if (frow) {
      frow.innerHTML = socials.length
        ? socials.map(function (s) {
            return '<li><a class="link-u" href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.label) + '</a></li>';
          }).join('')
        : '<li><a class="link-u" href="index.html#contact">Contact</a></li><li><a class="link-u" href="index.html#projects">Archive</a></li>';
    }

    var fbBtn = el('siteFeedback');
    if (fbBtn) {
      if (socials.length) fbBtn.href = socials[0].url;
      else fbBtn.parentNode.removeChild(fbBtn);
    }
  }

  /* ---------------------------------------------- 14. delegated events ---- */
  function initGlobalActions() {
    closeOnBackdrop(el('quickLook'));

    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;

      var look = t.closest('[data-look]');
      if (look) { e.preventDefault(); openQuickLook(look.getAttribute('data-look')); return; }

      var fav = t.closest('[data-fav]');
      if (fav) { e.preventDefault(); toggleFav(fav.getAttribute('data-fav')); return; }

      var techBtn = t.closest('[data-tech]');
      if (techBtn) { e.preventDefault(); filterByTech(techBtn.getAttribute('data-tech')); return; }

      var catBtn = t.closest('[data-cat]');
      if (catBtn) {
        e.preventDefault();
        var v = catBtn.getAttribute('data-cat');
        var outside = !catBtn.closest('#projects');
        if (v === '__saved') { state.saved = true; state.category = 'all'; }
        else if (v === '__featured') { state.saved = false; state.category = '__featured'; }
        else if (v === '__all') {
          state.saved = false; state.category = 'all'; state.tech = ''; state.q = '';
          if (el('search')) el('search').value = '';
        } else if (v === 'all') { state.saved = false; state.category = 'all'; }
        else { state.saved = false; state.category = v; }
        renderArchive();
        if (outside) goSection('projects');
        return;
      }

      var copyBtn = t.closest('[data-copy]');
      if (copyBtn) {
        var raw = copyBtn.getAttribute('data-copy');
        copyText(/^(https?:|mailto:)/i.test(raw) ? raw : new URL(raw, location.href).href, 'Link copied');
        return;
      }

      var liveBtn = t.closest('[data-live]');
      if (liveBtn) {
        var p = bySlug(liveBtn.getAttribute('data-live'));
        var host = liveBtn.closest('[data-live-host]') || document;
        var wrap = host.querySelector('.browser-shot');
        if (p && wrap) {
          mountLive(wrap, liveUrl(p), p.name);
          liveBtn.disabled = true;
          liveBtn.classList.add('opacity-50');
          liveBtn.innerHTML = ICON.play + ' Live page loaded';
        }
        return;
      }

      var closeBtn = t.closest('[data-close-dlg]');
      if (closeBtn) {
        var dlg = closeBtn.closest('dialog');
        if (dlg) dlg.close();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') openSheet(false);
    });
  }

  /* --------------------------------------------------------------- boot ---- */
  initTheme();
  initSiteText();
  initGlobalActions();
  initPalette();
  initChrome();
  if (el('grid')) initHome();
  if (el('detail')) initDetail();
  if (el('suggest')) initSuggest();
  renderFavStates();
  initReveal();
  initSpotlight();
})();
