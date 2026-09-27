/* DP-Archives Admin Panel
   Password gate + projects CRUD + site settings + export.
   This is a static-site gate: it keeps the panel unlisted and lightly
   protected. For real auth, migrate to Supabase/Next.js (see tutorial s.12). */

// ======== SETTINGS ========
var ADMIN_PASSWORD_HASH = '7add4b5cb8a533318fbbbbb80dfb49bf208cba1e0f3408c3b7e453fb3ab74c4e';
// dp-admin-2026  <- default password. To change it, open admin.html in a browser,
// press F12 -> Console, run: (await crypto.subtle.digest('SHA-256', new TextEncoder().encode('YOUR-NEW-PASSWORD'))).hex
// ...actually simpler: run this in the console:
//   crypto.subtle.digest('SHA-256', new TextEncoder().encode('Your_New_Password')).then(b=>console.log([...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')))
// then paste the printed hash here and update the tutorial.
var SESSION_KEY = 'dp_admin_session';
// =========================

var esc = function (s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
};

function sha256Hex(str) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(function (buf) {
    return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  });
}

// ---- state (deep copies so editing is cancel-able) ----
var projects = (window.DP_PROJECTS || []).map(function (p) { return Object.assign({}, p, { tech: (p.tech || []).slice() }); });
var site = Object.assign({}, window.DP_SITE || {});
var editingSlug = null; // null = closed, 'NEW' = new project

// ---- helpers ----
function $(id) { return document.getElementById(id); }
function toast(msg) {
  var t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._h);
  t._h = setTimeout(function () { t.classList.add('hidden'); }, 2600);
}

// ---- auth ----
function unlock() {
  sessionStorage.setItem(SESSION_KEY, '1');
  $('loginView').classList.add('hidden');
  $('panelView').classList.remove('hidden');
  renderAll();
}
function lock() {
  sessionStorage.removeItem(SESSION_KEY);
  location.reload();
}

$('loginForm').addEventListener('submit', function (e) {
  e.preventDefault();
  sha256Hex($('pw').value).then(function (hex) {
    if (hex === ADMIN_PASSWORD_HASH) { unlock(); }
    else { $('loginErr').classList.remove('hidden'); $('pw').select(); }
  });
});
$('lockBtn').addEventListener('click', lock);

if (sessionStorage.getItem(SESSION_KEY) === '1') unlock();

// ---- stats ----
function renderStats() {
  var live = projects.filter(function (p) { return p.status === 'Live'; }).length;
  var feat = projects.filter(function (p) { return p.featured; }).length;
  var cats = new Set(projects.map(function (p) { return p.category; })).size;
  var cells = [
    ['Total Projects', projects.length],
    ['Live', live],
    ['Featured', feat],
    ['Categories', cats]
  ];
  $('stats').innerHTML = cells.map(function (c) {
    return '<div class="rounded-xl border border-white/10 p-4"><p class="text-2xl font-semibold">' + c[1] + '</p><p class="text-xs text-zinc-500 mt-1">' + esc(c[0]) + '</p></div>';
  }).join('');
}

// ---- table ----
function renderTable() {
  $('projCount').textContent = '(' + projects.length + ')';
  $('projTable').innerHTML = projects.map(function (p, i) {
    var feat = p.featured
      ? '<span class="badge text-amber-400 border-amber-400/30">Featured</span>'
      : '<span class="text-zinc-600">—</span>';
    return '<tr class="row border-b border-white/5 last:border-0">' +
      '<td class="px-4 py-3"><a class="font-medium text-indigo-300 hover:text-indigo-200" href="project.html?p=' + encodeURIComponent(p.slug) + '" target="_blank" rel="noopener">' + esc(p.name) + '</a><p class="text-xs text-zinc-500 mono">/' + esc(p.slug) + '</p></td>' +
      '<td class="px-4 py-3 hidden sm:table-cell text-zinc-400">' + esc(p.category) + '</td>' +
      '<td class="px-4 py-3 hidden sm:table-cell"><span class="badge ' + (p.status === 'Live' ? 'text-emerald-400 border-emerald-400/30' : 'text-zinc-400') + '">' + esc(p.status) + '</span></td>' +
      '<td class="px-4 py-3">' + feat + '</td>' +
      '<td class="px-4 py-3 text-right whitespace-nowrap">' +
        '<button class="btn btn-ghost text-xs" data-edit="' + i + '" aria-label="Edit ' + esc(p.name) + '">Edit</button> ' +
        '<button class="btn btn-danger text-xs" data-del="' + i + '" aria-label="Delete ' + esc(p.name) + '">Delete</button>' +
      '</td></tr>';
  }).join('') || '<tr><td colspan="5" class="px-4 py-10 text-center text-zinc-500">No projects yet — click “+ Add Project”.</td></tr>';
}

$('projTable').addEventListener('click', function (e) {
  var edit = e.target.getAttribute('data-edit');
  var del = e.target.getAttribute('data-del');
  if (edit !== null) openModal(projects[Number(edit)].slug);
  if (del !== null) {
    var p = projects[Number(del)];
    if (confirm('Delete “' + p.name + '”? This only affects the site after you publish.')) {
      projects.splice(Number(del), 1);
      renderAll();
      toast('Project deleted — remember to publish');
    }
  }
});

// ---- settings form ----
function fillCfg() {
  $('cfgTagline').value = site.tagline || '';
  $('cfgAbout').value = site.about || '';
  $('cfgFeedback').value = site.feedbackUrl || '';
  $('cfgCopyright').value = site.copyright || '';
  $('cfgStatus').value = site.statusLabel || '';
}
$('saveCfgBtn').addEventListener('click', function () {
  site.tagline = $('cfgTagline').value.trim();
  site.about = $('cfgAbout').value.trim();
  site.feedbackUrl = $('cfgFeedback').value.trim();
  site.copyright = $('cfgCopyright').value.trim();
  site.statusLabel = $('cfgStatus').value.trim();
  toast('Settings saved — remember to publish');
});

// ---- modal ----
function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function openModal(slug) {
  editingSlug = slug || 'NEW';
  var p = slug ? projects.find(function (x) { return x.slug === slug; }) : null;
  $('modalTitle').textContent = p ? 'Edit: ' + p.name : 'Add New Project';
  $('fSlug').value = p ? p.slug : '';
  $('fName').value = p ? p.name : '';
  $('fTagline').value = p ? p.tagline : '';
  $('fDesc').value = p ? p.description : '';
  $('fCategory').value = p ? p.category : '';
  $('fStatus').value = p ? p.status : 'Live';
  $('fTech').value = p ? (p.tech || []).join(', ') : '';
  $('fUrl').value = p ? p.url : '';
  $('fGithub').value = p ? p.github : '';
  $('fUpdated').value = p ? p.updated : new Date().toISOString().slice(0, 10);
  $('fAccent').value = p && p.accent ? p.accent : '#60a5fa';
  $('fFeatured').checked = p ? !!p.featured : false;
  $('formErr').classList.add('hidden');
  var cats = new Set(projects.map(function (x) { return x.category; }));
  $('catList').innerHTML = Array.from(cats).map(function (c) { return '<option value="' + esc(c) + '">'; }).join('');
  $('modal').classList.remove('hidden');
  $('fName').focus();
}
function closeModal() {
  editingSlug = null;
  $('modal').classList.add('hidden');
}
$('addBtn').addEventListener('click', function () { openModal(null); });
$('modalClose').addEventListener('click', closeModal);
$('cancelBtn').addEventListener('click', closeModal);
$('modal').addEventListener('click', function (e) { if (e.target === $('modal')) closeModal(); });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('modal').classList.contains('hidden')) closeModal(); });
$('fName').addEventListener('input', function () {
  if (editingSlug === 'NEW') $('fSlug').value = slugify($('fName').value);
});

$('projForm').addEventListener('submit', function (e) {
  e.preventDefault();
  var slug = slugify($('fSlug').value);
  if (!slug) { $('formErr').textContent = 'Slug is required.'; $('formErr').classList.remove('hidden'); return; }
  var dupe = projects.find(function (x) { return x.slug === slug && x.slug !== editingSlug; });
  if (dupe) { $('formErr').textContent = 'Slug “' + slug + '” is already used by another project.'; $('formErr').classList.remove('hidden'); return; }
  var data = {
    slug: slug,
    name: $('fName').value.trim(),
    tagline: $('fTagline').value.trim(),
    description: $('fDesc').value.trim(),
    category: $('fCategory').value.trim() || 'Projects',
    status: $('fStatus').value,
    tech: $('fTech').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean),
    featured: $('fFeatured').checked,
    updated: $('fUpdated').value || new Date().toISOString().slice(0, 10),
    url: $('fUrl').value.trim(),
    github: $('fGithub').value.trim(),
    accent: $('fAccent').value
  };
  if (editingSlug !== 'NEW') {
    var idx = projects.findIndex(function (x) { return x.slug === editingSlug; });
    projects[idx] = data;
    toast('Project updated — remember to publish');
  } else {
    projects.push(data);
    toast('Project added — remember to publish');
  }
  closeModal();
  renderAll();
});

// ---- export ----
function jsVar(name, value) {
  return 'window.' + name + ' = ' + JSON.stringify(value, null, 2) + ';\n';
}
function projectsJs() {
  return '// DP-Archives — project data (generated by Admin Panel)\n' + jsVar('DP_PROJECTS', projects);
}
function siteConfigJs() {
  return '// DP-Archives — site configuration (generated by Admin Panel)\n' + jsVar('DP_SITE', site);
}
function download(name, text) {
  var blob = new Blob([text], { type: 'text/javascript' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
$('exportBtn').addEventListener('click', function () {
  download('projects.js', projectsJs());
  setTimeout(function () { download('site-config.js', siteConfigJs()); }, 300);
  toast('Downloading projects.js + site-config.js');
});
$('copyBtn').addEventListener('click', function () {
  navigator.clipboard.writeText(projectsJs()).then(function () { toast('projects.js copied to clipboard'); });
});

function renderAll() {
  renderStats();
  renderTable();
  fillCfg();
}
