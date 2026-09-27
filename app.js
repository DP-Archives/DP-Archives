/* DP-Archives — shared front-end logic */
(function () {
  'use strict';

  var PROJECTS = window.DP_PROJECTS || [];
  var SITE = Object.assign({
    name: 'DP-Archives',
    role: 'Digital Headquarters',
    tagline: 'Central hub for my websites, tools, experiments and digital projects.',
    about: "I'm a builder. This headquarters consolidates every website, tool and experiment released under one roof. Visitors get a clean, fast way to discover and open each project.",
    feedbackUrl: '',
    copyright: '© 2026 DP-Archives — Built with curiosity',
    statusLabel: 'SYSTEM STATUS: OPERATIONAL'
  }, window.DP_SITE || {});


  /* ---------- helpers ---------- */
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const fmtDate = (iso) => new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  }).format(new Date(iso));

  const dot = (status) => {
    const colour = status === 'Live' ? 'bg-emerald-400'
      : status === 'Beta' ? 'bg-amber-400'
      : 'bg-zinc-500';
    return `<span class="w-2 h-2 rounded-full ${colour}" aria-hidden="true"></span>`;
  };

  const STATUS_TEXT = { Live: 'text-emerald-300', Beta: 'text-amber-300' };
  const statusColour = (s) => STATUS_TEXT[s] || 'text-zinc-300';

  /* ---------- homepage (index.html) ---------- */
  const featuredEl = document.getElementById('featured');
  const gridEl = document.getElementById('grid');

  if (featuredEl && gridEl) {
    const searchInput = document.getElementById('search');
    const categorySelect = document.getElementById('category');
    const emptyEl = document.getElementById('empty');
    const metaEl = document.getElementById('resultMeta');

    // categories
    [...new Set(PROJECTS.map((p) => p.category))].sort().forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      categorySelect.appendChild(opt);
    });

    const card = (p, large) => `
      <a href="project.html?p=${encodeURIComponent(p.slug)}"
         class="card group p-[1px] rounded-2xl bg-gradient-to-b from-white/15 to-white/5 hover:from-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
         aria-label="${esc(p.name)} — ${esc(p.status)}. Open project details.">
        <span class="flex flex-col h-full rounded-[15px] bg-zinc-950/70 border border-white/5 ${large ? 'p-6' : 'p-5'}">
          <span class="flex items-start justify-between gap-3">
            <span class="min-w-0">
              <span class="block font-semibold tracking-tight truncate group-hover:text-white transition-colors">${esc(p.name)}</span>
              <span class="block text-sm text-zinc-400 mt-1 line-clamp-2">${esc(p.tagline)}</span>
            </span>
            <span class="flex items-center gap-1.5 shrink-0 mt-0.5 text-[11px] font-mono ${statusColour(p.status)}">
              ${dot(p.status)}${esc(p.status)}
            </span>
          </span>
          <span class="mt-4 flex flex-wrap gap-1.5">
            ${p.tech.map((t) => `<span class="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-300 truncate max-w-full">${esc(t)}</span>`).join('')}
          </span>
          <span class="mt-auto pt-4 flex items-center justify-between text-xs text-zinc-500">
            <span>${esc(p.category)} — Updated ${fmtDate(p.updated)}</span>
            <span class="text-zinc-400 group-hover:text-white transition-colors" aria-hidden="true">→</span>
          </span>
        </span>
      </a>`;

    const render = () => {
      const q = searchInput.value.trim().toLowerCase();
      const cat = categorySelect.value;
      const filtered = PROJECTS.filter((p) =>
        (cat === 'all' || p.category === cat) &&
        (p.name.toLowerCase().includes(q) ||
         p.tagline.toLowerCase().includes(q) ||
         p.category.toLowerCase().includes(q) ||
         p.tech.some((t) => t.toLowerCase().includes(q)))
      );

      featuredEl.innerHTML = filtered.filter((p) => p.featured).map((p) => card(p, true)).join('');
      gridEl.innerHTML = filtered.filter((p) => !p.featured).map((p) => card(p, false)).join('');

      const isEmpty = filtered.length === 0;
      emptyEl.classList.toggle('hidden', !isEmpty);
      metaEl.textContent = isEmpty
        ? ''
        : `${filtered.length} project${filtered.length === 1 ? '' : 's'} — ${filtered.filter((p) => p.featured).length} featured`;

      // sync URL (deep-linkable state)
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (cat !== 'all') params.set('category', cat);
      history.replaceState(null, '', params.toString() ? `?${params}` : location.pathname);
    };

    // restore state from URL
    const params = new URLSearchParams(location.search);
    if (params.get('q')) searchInput.value = params.get('q');
    if (params.get('category')) categorySelect.value = params.get('category');

    searchInput.addEventListener('input', render);
    categorySelect.addEventListener('change', render);
    document.getElementById('clearFilters').addEventListener('click', () => {
      searchInput.value = '';
      categorySelect.value = 'all';
      searchInput.focus();
      render();
    });

    // site text from config (guarded: a missing element must never stop rendering)
    const taglineEl = document.getElementById('siteTagline');
    if (taglineEl) taglineEl.textContent = SITE.tagline;
    const aboutEl = document.getElementById('siteAbout');
    if (aboutEl) aboutEl.textContent = SITE.about;
    const yearEl = document.getElementById('siteCopyright');
    if (yearEl) yearEl.textContent = SITE.copyright;
    const statusEl = document.getElementById('siteStatus');
    if (statusEl) statusEl.textContent = SITE.statusLabel;
    const fb = document.getElementById('siteFeedback');
    if (fb) {
      if (SITE.feedbackUrl) {
        fb.href = SITE.feedbackUrl;
      } else {
        fb.remove();
      }
    }

    render();
  }


  /* ---------- details page (project.html) ---------- */
  const detailRoot = document.getElementById('detail');
  if (detailRoot) {
    const slug = new URLSearchParams(location.search).get('p');
    const project = PROJECTS.find((p) => p.slug === slug);

    if (!project) {
      detailRoot.innerHTML = `
        <div class="py-24 text-center">
          <p class="font-mono text-xs text-zinc-500 mb-3">404 — PROJECT NOT FOUND</p>
          <h1 class="text-3xl font-semibold">This project doesn&rsquo;t exist.</h1>
          <p class="text-zinc-400 mt-3">The link may be outdated or the project was removed.</p>
          <a href="index.html#projects" class="inline-block mt-6 px-5 py-3 rounded-xl bg-white text-black font-medium hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 transition-colors">Browse All Projects</a>
        </div>`;
      document.title = 'Project not found — DP-Archives';
      return;
    }

    document.title = `${project.name} — DP-Archives`;

    const buttons = [
      project.url ? `<a href="${esc(project.url)}" target="_blank" rel="noopener noreferrer" class="px-5 py-3 rounded-xl bg-white text-black font-medium hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 transition-colors">Open Website <span aria-hidden="true">↗</span></a>` : '',
      project.github ? `<a href="${esc(project.github)}" target="_blank" rel="noopener noreferrer" class="px-5 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 transition-colors">View Source <span aria-hidden="true">↗</span></a>` : ''
    ].filter(Boolean).join('');

    const related = PROJECTS
      .filter((p) => p.slug !== project.slug && p.category === project.category)
      .slice(0, 3);
    const relatedHtml = related.length ? `
      <section class="max-w-[1200px] mx-auto px-6 pb-24">
        <h2 class="text-xl font-semibold mb-4">More in ${esc(project.category)}</h2>
        <div class="grid sm:grid-cols-3 gap-4">
          ${related.map((r) => `
            <a href="project.html?p=${encodeURIComponent(r.slug)}" class="card group p-[1px] rounded-2xl bg-gradient-to-b from-white/15 to-white/5 hover:from-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70">
              <span class="flex flex-col rounded-[15px] bg-zinc-950/70 border border-white/5 p-5">
                <span class="flex items-center justify-between gap-2">
                  <span class="font-semibold truncate group-hover:text-white transition-colors">${esc(r.name)}</span>
                  <span class="text-[11px] font-mono ${statusColour(r.status)}">${esc(r.status)}</span>
                </span>
                <span class="text-sm text-zinc-400 mt-1 line-clamp-2">${esc(r.tagline)}</span>
              </span>
            </a>`).join('')}
        </div>
      </section>` : '';

    detailRoot.innerHTML = `
      <section class="max-w-[1200px] mx-auto px-6 pt-12 pb-10">
        <nav aria-label="Breadcrumb" class="mb-8">
          <a href="index.html#projects" class="text-sm text-zinc-400 hover:text-white rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 transition-colors">&larr; Back to Ecosystem</a>
        </nav>
        <div class="flex items-start gap-5 flex-wrap">
          <span class="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0" style="background:${esc(project.accent)}1f;border:1px solid ${esc(project.accent)}3d">
            <span class="text-2xl font-bold" style="color:${esc(project.accent)}" aria-hidden="true">${esc(project.name.charAt(0))}</span>
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-3 flex-wrap">
              <h1 class="text-3xl md:text-4xl font-bold tracking-tight">${esc(project.name)}</h1>
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono ${statusColour(project.status)}">
                ${dot(project.status)}${esc(project.status)}
              </span>
            </div>
            <p class="text-lg text-zinc-300 mt-2">${esc(project.tagline)}</p>
          </div>
        </div>
        <div class="mt-8 flex gap-3 flex-wrap">${buttons}</div>
      </section>

      <section class="max-w-[1200px] mx-auto px-6 pb-16 grid lg:grid-cols-[1.6fr_1fr] gap-8 items-start">
        <div>
          <h2 class="text-sm font-mono text-zinc-500 mb-3">OVERVIEW</h2>
          <p class="text-zinc-200 leading-relaxed">${esc(project.description)}</p>
        </div>
        <aside class="p-[1px] rounded-2xl bg-gradient-to-b from-white/15 to-white/5">
          <div class="rounded-[15px] bg-zinc-950/70 border border-white/5 p-6 text-sm">
            <h2 class="text-sm font-mono text-zinc-500 mb-4">DETAILS</h2>
            <dl class="space-y-3">
              <div class="flex justify-between gap-4"><dt class="text-zinc-500">Category</dt><dd>${esc(project.category)}</dd></div>
              <div class="flex justify-between gap-4"><dt class="text-zinc-500">Status</dt><dd class="${statusColour(project.status)}">${esc(project.status)}</dd></div>
              <div class="flex justify-between gap-4"><dt class="text-zinc-500">Updated</dt><dd>${fmtDate(project.updated)}</dd></div>
              <div class="pt-2 border-t border-white/5">
                <dt class="text-zinc-500 mb-2">Stack</dt>
                <dd class="flex flex-wrap gap-1.5">
                  ${project.tech.map((t) => `<span class="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-300">${esc(t)}</span>`).join('')}
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </section>
      ${relatedHtml}`;
  }
})();
