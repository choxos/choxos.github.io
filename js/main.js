/* choxos.github.io: renders data/*.json, draws the topic network, runs the toy shell. */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => (n == null ? '' : Number(n).toLocaleString('en-US'));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const load = f => fetch(`data/${f}.json`).then(r => (r.ok ? r.json() : null)).catch(() => null);
  const ext = 'target="_blank" rel="noopener"';

  const LANG_COLORS = {
    R: '#198CE7', Python: '#3572A5', JavaScript: '#f1e05a', TypeScript: '#3178c6', HTML: '#e34c26',
    TeX: '#3D6117', Julia: '#a270ba', Shell: '#89e051', CSS: '#563d7c', 'Jupyter Notebook': '#DA5B0B',
    Stan: '#b2011d', 'C++': '#f34b7d', Fortran: '#4d41b1', Swift: '#F05138', Dart: '#00B4AB',
  };
  const PALETTE = ['--cyan', '--amber', '--green', '--purple', '--red', '--orange'];

  const state = { stats: null, pubs: [], repos: [], pkgs: [], posts: [] };

  /* ------------------------------------------------------------ theme */
  const themeBtn = $('#theme-toggle');
  const currentTheme = () => document.documentElement.dataset.theme ||
    (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('theme', t); } catch (e) { /* private mode */ }
    $('meta[name="theme-color"]').content = t === 'light' ? '#f6f3ea' : '#0b0d0c';
    themeBtn.textContent = t === 'light' ? 'light' : 'dark';
    net.recolor();
  }
  themeBtn.addEventListener('click', () => setTheme(currentTheme() === 'light' ? 'dark' : 'light'));

  /* ------------------------------------------------------------ hero typing */
  (function typeWhoami() {
    const el = $('#typed');
    if (reduceMotion || !el) return;
    const text = el.textContent;
    el.textContent = '';
    let i = 0;
    const tick = () => { el.textContent = text.slice(0, ++i); if (i < text.length) setTimeout(tick, 90 + Math.random() * 90); };
    setTimeout(tick, 500);
  })();

  $$('[data-uptime]').forEach(el => { el.textContent = new Date().getFullYear() - 2009; });

  /* ------------------------------------------------------------ stats */
  function renderStats() {
    const s = state.stats;
    const set = (k, v) => $$(`[data-stat="${k}"]`).forEach(el => { el.textContent = v; });
    if (s) {
      set('citations', fmt(s.citations)); set('h', s.h_index); set('i10', s.i10_index);
      set('works', s.works); set('first', s.first_author); set('updated', s.updated);
    }
    if (state.pkgs.length) {
      set('cran', state.pkgs.filter(p => p.cran).length);
      set('dev', state.pkgs.filter(p => !p.cran).length);
    }
    if (state.repoTotal) set('repos', state.repoTotal);
  }

  /* ------------------------------------------------------------ packages */
  function hexSVG(name) {
    const size = Math.min(15, 92 / name.length);
    return `<svg class="hex" viewBox="0 0 78 90" aria-hidden="true">
      <polygon points="39,3 75,23.8 75,66.2 39,87 3,66.2 3,23.8" style="fill:color-mix(in srgb,var(--c) 13%,var(--bg-1));stroke:var(--c);stroke-width:3"/>
      <polygon points="39,12 67,28 67,62 39,78 11,62 11,28" style="fill:none;stroke:var(--c);stroke-width:.8;opacity:.45"/>
      <text x="39" y="49" text-anchor="middle" style="fill:var(--fg);font-size:${size}px">${esc(name)}</text>
      <text x="39" y="66" text-anchor="middle" style="fill:var(--c);font-size:7px;letter-spacing:.1em">R PKG</text>
    </svg>`;
  }
  function renderPackages() {
    const grid = $('#pkg-grid');
    if (!state.pkgs.length) { grid.innerHTML = '<p class="empty">Package data unavailable. See <a href="https://cran.r-project.org/web/checks/check_results_a.sofimahmudi_at_gmail.com.html">CRAN</a>.</p>'; return; }
    const pkgs = [...state.pkgs].sort((a, b) => (b.cran - a.cran) || ((b.downloads || 0) - (a.downloads || 0)));
    grid.innerHTML = pkgs.map((p, i) => `
      <article class="pkg" style="--c:var(${PALETTE[i % PALETTE.length]})">
        ${hexSVG(p.name)}
        <div>
          <div class="pkg-top">
            <a class="pkg-name" href="${esc(p.site || p.repo)}" ${ext}>${esc(p.name)}</a>
            ${p.cran ? `<span class="badge cran">CRAN ${esc(p.version)}</span>` : `<span class="badge dev">dev ${esc(p.version)}</span>`}
          </div>
          <p class="pkg-title">${esc(p.title)}</p>
          <p class="pkg-meta">${p.cran ? `<span>↓ ${fmt(p.downloads)} downloads</span><span>on CRAN since ${esc(p.published)}</span>` : '<span>remotes::install_github("choxos/' + esc(p.name) + '")</span>'}</p>
          <p class="pkg-links">
            ${p.site ? `<a href="${esc(p.site)}" ${ext}>docs</a>` : ''}
            ${p.cran_url ? `<a href="${esc(p.cran_url)}" ${ext}>cran</a>` : ''}
            ${p.repo ? `<a href="${esc(p.repo)}" ${ext}>source</a>` : ''}
          </p>
        </div>
      </article>`).join('');
    const cran = pkgs.filter(p => p.cran).map(p => `<span class="c-str">"${esc(p.name)}"</span>`);
    if (cran.length) $('#install-code').innerHTML = `<span class="c-prompt">&gt;</span>install.packages(c(${cran.join(', ')}))`;
  }

  /* ------------------------------------------------------------ repos */
  const repoState = { q: '', lang: 'all', sort: 'updated', all: false };
  function renderRepoChips() {
    const counts = {};
    state.repos.forEach(r => { const l = r.language || 'other'; counts[l] = (counts[l] || 0) + 1; });
    const langs = Object.entries(counts).sort((a, b) => (a[0] === 'other') - (b[0] === 'other') || b[1] - a[1]).map(([l]) => l);
    $('#repo-langs').innerHTML = ['all', ...langs].map(l => `
      <button class="chip" type="button" data-lang="${esc(l)}" aria-pressed="${l === repoState.lang}">
        ${l === 'all' ? '' : `<span class="dot" style="background:${LANG_COLORS[l] || 'var(--muted)'}"></span>`}${esc(l)}${l === 'all' ? '' : ` <span class="muted">${counts[l]}</span>`}
      </button>`).join('');
  }
  function renderRepos() {
    const q = repoState.q.toLowerCase();
    let rows = state.repos.filter(r =>
      (repoState.lang === 'all' || (r.language || 'other') === repoState.lang) &&
      (!q || `${r.name} ${r.description} ${r.topics.join(' ')}`.toLowerCase().includes(q)));
    rows = rows.sort(repoState.sort === 'stars'
      ? (a, b) => b.stars - a.stars || b.updated.localeCompare(a.updated)
      : (a, b) => b.updated.localeCompare(a.updated));
    const limit = repoState.all || q ? rows.length : 14;
    const list = $('#repo-list');
    list.innerHTML = rows.length ? rows.slice(0, limit).map(r => `
      <div class="ls-row">
        <span class="ls-date">${esc(r.updated)}</span>
        <span class="ls-name"><a href="${esc(r.url)}" ${ext}>${esc(r.name)}</a></span>
        <span class="ls-desc">${esc(r.description) || '<span class="muted">(no description)</span>'}${r.topics.length ? `<span class="topics">${r.topics.slice(0, 6).map(t => '#' + esc(t)).join(' ')}</span>` : ''}</span>
        <span class="ls-meta">
          ${r.language ? `<span><i class="lang-dot" style="background:${LANG_COLORS[r.language] || 'var(--muted)'}"></i>${esc(r.language)}</span>` : ''}
          ${r.stars ? `<span class="star">★ ${r.stars}</span>` : ''}
          ${r.homepage ? `<a href="${esc(r.homepage)}" ${ext}>site ↗</a>` : ''}
        </span>
      </div>`).join('') : `<p class="empty">grep: no match for "${esc(repoState.q)}"</p>`;
    const more = $('#repo-more');
    more.hidden = rows.length <= limit && !repoState.all || rows.length <= 14 || !!q;
    more.textContent = repoState.all ? '| head -n 14' : `| cat  # show ${rows.length - limit} more`;
  }
  $('#repo-q').addEventListener('input', e => { repoState.q = e.target.value.trim(); renderRepos(); });
  $('#repo-langs').addEventListener('click', e => {
    const b = e.target.closest('[data-lang]'); if (!b) return;
    repoState.lang = b.dataset.lang;
    $$('#repo-langs .chip').forEach(c => c.setAttribute('aria-pressed', c === b));
    renderRepos();
  });
  $$('[data-sort]').forEach(b => b.addEventListener('click', () => {
    repoState.sort = b.dataset.sort;
    $$('[data-sort]').forEach(c => c.setAttribute('aria-pressed', c === b));
    renderRepos();
  }));
  $('#repo-more').addEventListener('click', () => { repoState.all = !repoState.all; renderRepos(); });

  /* ------------------------------------------------------------ publications */
  const pubState = { q: '', mode: 'all', year: null, all: false };
  function highlight(text, q) {
    if (!q) return esc(text);
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    return i < 0 ? esc(text) : esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
  }
  function authorLabel(p) {
    // OpenAlex truncates consortium author lists at 100, so position is unknown there.
    if (p.n_authors >= 100) return '<span class="tag cons">GBD collaborator</span>';
    if (p.pos == null) return '';
    if (p.pos === 0) return '<span class="tag first">first author</span>';
    if (p.pos === p.n_authors - 1) return '<span class="tag first">senior author</span>';
    return `<span>author ${p.pos + 1} of ${p.n_authors}</span>`;
  }
  const TYPE_TAG = { preprint: '<span class="tag pre">preprint</span>', review: '<span class="tag pre">review</span>', 'conference-abstract': '<span class="tag pre">abstract</span>' };
  function filteredPubs() {
    const q = pubState.q.toLowerCase();
    return state.pubs.filter(p =>
      (pubState.mode !== 'first' || p.pos === 0) &&
      (pubState.mode !== 'cited' || p.cites >= 20) &&
      (pubState.mode !== 'preprint' || p.type === 'preprint') &&
      (pubState.year == null || p.year === pubState.year) &&
      (!q || `${p.title} ${p.venue} ${p.authors.join(' ')}`.toLowerCase().includes(q)));
  }
  function renderPubs() {
    const rows = filteredPubs();
    const limit = pubState.all || pubState.q || pubState.year ? rows.length : 12;
    $('#pub-count').textContent = `${rows.length} of ${state.pubs.length} records${pubState.year ? ` · year == ${pubState.year}` : ''}`;
    $('#pub-list').innerHTML = rows.slice(0, limit).map(p => `
      <li>
        <span class="y">${p.year}</span>
        <div>
          <p class="pt">${p.url ? `<a href="${esc(p.url)}" ${ext}>${highlight(p.title, pubState.q)}</a>` : highlight(p.title, pubState.q)}</p>
          <p class="pm">
            ${p.venue ? `<i>${esc(p.venue)}</i>` : ''}
            ${authorLabel(p)}
            ${p.cites ? `<span class="cites">cited ${fmt(p.cites)}×</span>` : ''}
            ${TYPE_TAG[p.type] || ''}
            ${p.oa ? '<span class="tag oa">open access</span>' : ''}
          </p>
        </div>
      </li>`).join('') || `<li><span class="y">404</span><div><p class="pt muted">grep: no match</p></div></li>`;
    const more = $('#pub-more');
    more.hidden = rows.length <= 12 || !!pubState.q || !!pubState.year;
    more.textContent = pubState.all ? '| head -n 12' : `| cat  # show all ${rows.length}`;
  }
  function renderSpark() {
    const byYear = {};
    state.pubs.forEach(p => { byYear[p.year] = (byYear[p.year] || 0) + 1; });
    const years = Object.keys(byYear).map(Number).sort((a, b) => a - b);
    if (!years.length) return;
    const all = []; for (let y = years[0]; y <= years[years.length - 1]; y++) all.push(y);
    const max = Math.max(...Object.values(byYear));
    $('#spark').innerHTML = all.map(y => {
      const n = byYear[y] || 0, h = n ? Math.max(4, (n / max) * 82) : 0;
      return `<button class="bar" type="button" data-year="${y}" aria-pressed="${pubState.year === y}" aria-label="${y}: ${n} papers"><i style="height:${h}%"></i><b style="bottom:calc(${h}% + 2px)">${n || ''}</b><em>${String(y).slice(2)}</em></button>`;
    }).join('');
  }
  $('#spark').addEventListener('click', e => {
    const b = e.target.closest('.bar'); if (!b) return;
    const y = Number(b.dataset.year);
    pubState.year = pubState.year === y ? null : y;
    $$('#spark .bar').forEach(x => x.setAttribute('aria-pressed', Number(x.dataset.year) === pubState.year));
    renderPubs();
  });
  $('#pub-q').addEventListener('input', e => { pubState.q = e.target.value.trim(); renderPubs(); });
  $$('[data-pf]').forEach(b => b.addEventListener('click', () => {
    pubState.mode = b.dataset.pf;
    $$('[data-pf]').forEach(c => c.setAttribute('aria-pressed', c === b));
    renderPubs();
  }));
  $('#pub-more').addEventListener('click', () => { pubState.all = !pubState.all; renderPubs(); });

  // tabs
  const tabs = $$('[role="tab"]');
  function selectTab(t) {
    tabs.forEach(x => {
      const on = x === t;
      x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1;
      $('#' + x.getAttribute('aria-controls')).hidden = !on;
    });
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => selectTab(t));
    t.addEventListener('keydown', e => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (d) { const n = tabs[(i + d + tabs.length) % tabs.length]; selectTab(n); n.focus(); }
    });
  });

  /* ------------------------------------------------------------ writing */
  function renderPosts() {
    const list = $('#post-list');
    if (!state.posts.length) { list.innerHTML = '<li><a href="https://choxos.medium.com">Read on Medium ↗</a></li>'; return; }
    list.innerHTML = state.posts.map(p => {
      const m = p.title.match(/^\[([^\]]+)\]\s*(.*)$/);
      return `<li><a href="${esc(p.url)}" ${ext}>
        <span class="p-date">${esc(p.date)}</span>
        <span class="p-title">${m ? `<span class="p-kind">[${esc(m[1])}]</span>${esc(m[2])}` : esc(p.title)}</span>
        <span class="p-tags">${p.tags.slice(0, 3).map(t => '#' + esc(t)).join(' ')}</span>
      </a></li>`;
    }).join('');
  }

  /* ------------------------------------------------------------ network (fig. 1) */
  const TOPICS = [
    ['meta-analysis', /meta-?analy|pooled|forest plot|metanalysis/i, 'm'],
    ['NMA', /network meta|\bnma\b|netmeta|multinma|nmaviz/i, 'm'],
    ['ITC', /indirect (treatment )?comparison|\bitc\b|\bmaic\b|\bstc\b|matching-adjusted|population-adjusted|\bpaic|unanchored|anchored/i, 'm'],
    ['ML-NMR', /ml-nmr|multilevel network|ml-umr|mlumr|meta-regression/i, 'm'],
    ['Bayesian', /bayes|\bstan\b|pymc|jags|mcmc|hierarchical/i, 'm'],
    ['causal / TTE', /target trial|\btte\b|causal|\bdag|estimand|trial emulation/i, 'm'],
    ['R', /lang:R\b|r-package|rstats|\bshiny\b|\bcran\b|ggplot|\bR package/i, 't'],
    ['AI / LLM', /\bllm|claude|language model|artificial intelligence|\brag\b|agent|\bgpt/i, 't'],
    ['GNU/Linux', /linux|ubuntu|system requirements/i, 't'],
    ['viz & teaching', /visuali|interactive|\b3d\b|atlas|webgl|animation|textbook|education|lesson|manim|fractal/i, 't'],
    ['meta-research', /meta-?research|metascience|bibliometric|scientometric|authorship|gender|research waste/i, 'r'],
    ['transparency', /transparen|reproducib|data not shown|open.science|preprint|peer review/i, 'r'],
    ['FAIR data', /\bfair\b|data availability|key resources|\brrid|metadata|dataset/i, 'r'],
    ['integrity', /retract|misconduct|integrity|citations?\b|\bdoi/i, 'r'],
    ['Cochrane', /cochrane/i, 'r'],
    ['dentistry', /dental|dentist|\boral\b|teeth|tooth|caries|orofacial|periodont|zirconia|maxillofacial|dmft|toothache/i, 'c'],
    ['GBD & QCI', /global burden|\bgbd\b|quality of care index|\bqci\b|burden of/i, 'c'],
    ['COVID-19', /covid|coronavirus|sars-cov/i, 'c'],
    ['pain & migraine', /\bpain|migraine|osteoarthritis|responder/i, 'c'],
  ];
  const GROUP_COLOR = { m: '--amber', t: '--purple', r: '--cyan', c: '--green' };
  const LABEL_FONT = '600 11.5px "JetBrains Mono", ui-monospace, monospace';

  const net = (() => {
    const canvas = $('#net');
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, dpr = 1, nodes = [], edges = [], colors = {}, running = false, visible = true;
    let drag = null, hover = null, energy = 1, raf = 0;

    function recolor() {
      colors = { fg: css('--fg'), fg2: css('--fg-2'), muted: css('--muted'), line: css('--line-2'), bg: css('--bg-1') };
      Object.entries(GROUP_COLOR).forEach(([g, v]) => { colors[g] = css(v); });
      draw();
    }
    function resize() {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = r.width; H = r.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      nodes.forEach(n => { n.x = Math.min(Math.max(n.x, 20), W - 20); n.y = Math.min(Math.max(n.y, 20), H - 20); });
      kick();
    }
    function build(docs) {
      const hits = TOPICS.map(([, re]) => docs.map(d => re.test(d)));
      nodes = TOPICS.map(([label, , g], i) => {
        const n = hits[i].filter(Boolean).length;
        const a = (i / TOPICS.length) * Math.PI * 2;
        ctx.font = LABEL_FONT;
        return { label, g, n, lw: ctx.measureText(label).width, r: 5 + Math.sqrt(n) * 2.3, x: W / 2 + Math.cos(a) * W * .3, y: H / 2 + Math.sin(a) * H * .3, vx: 0, vy: 0 };
      }).filter(n => n.n > 0);
      const idx = TOPICS.map(([label]) => nodes.findIndex(n => n.label === label));
      edges = [];
      for (let i = 0; i < TOPICS.length; i++) for (let j = i + 1; j < TOPICS.length; j++) {
        if (idx[i] < 0 || idx[j] < 0) continue;
        let w = 0; for (let k = 0; k < docs.length; k++) if (hits[i][k] && hits[j][k]) w++;
        if (w) edges.push({ a: nodes[idx[i]], b: nodes[idx[j]], w });
      }
      const keep = new Set();
      nodes.forEach(n => edges.filter(e => e.a === n || e.b === n).sort((x, y) => y.w - x.w).slice(0, 3).forEach(e => keep.add(e)));
      edges = edges.filter(e => keep.has(e));
      if (reduceMotion) for (let s = 0; s < 400; s++) step();
      kick();
    }
    function step() {
      const k = Math.min(W, H) * .9;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          let dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy + .01;
          const d = Math.sqrt(d2), f = (k * 9) / d2, min = a.r + b.r + 34;
          const push = d < min ? (min - d) * .08 : 0;
          // Keep labels (drawn to the right of each node) from sitting on their neighbors.
          const left = dx > 0 ? a : b, span = left.r + left.lw + 12 + (left === a ? b.r : a.r);
          if (Math.abs(dy) < 18 && Math.abs(dx) < span) { const p = (18 - Math.abs(dy)) * .06, sy = dy < 0 ? -1 : 1; a.vy -= sy * p; b.vy += sy * p; }
          dx /= d; dy /= d;
          a.vx -= dx * (f + push); a.vy -= dy * (f + push);
          b.vx += dx * (f + push); b.vy += dy * (f + push);
        }
      }
      const maxW = Math.max(1, ...edges.map(e => e.w));
      edges.forEach(e => {
        const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y, d = Math.hypot(dx, dy) || 1;
        const rest = Math.min(W, H) * (.42 - .22 * (e.w / maxW));
        const f = (d - rest) * .0025 * (0.4 + e.w / maxW);
        e.a.vx += dx / d * f; e.a.vy += dy / d * f; e.b.vx -= dx / d * f; e.b.vy -= dy / d * f;
      });
      energy = 0;
      nodes.forEach(n => {
        n.vx += (W / 2 - n.x) * .006; n.vy += (H / 2 - n.y) * .012;
        if (n === drag) { n.vx = n.vy = 0; return; }
        n.vx *= .82; n.vy *= .82;
        n.x += n.vx; n.y += n.vy;
        const pad = n.r + 6;
        n.x = Math.min(Math.max(n.x, pad), W - n.r - n.lw - 12); n.y = Math.min(Math.max(n.y, pad), H - pad);
        energy += n.vx * n.vx + n.vy * n.vy;
      });
    }
    function neighbors(n) { const s = new Set([n]); edges.forEach(e => { if (e.a === n) s.add(e.b); if (e.b === n) s.add(e.a); }); return s; }
    function draw() {
      if (!W) return;
      ctx.clearRect(0, 0, W, H);
      const focus = hover || drag, near = focus ? neighbors(focus) : null;
      const maxW = Math.max(1, ...edges.map(e => e.w));
      edges.forEach(e => {
        const on = !near || (near.has(e.a) && near.has(e.b) && (e.a === focus || e.b === focus));
        ctx.globalAlpha = on ? (focus ? .9 : .18 + .45 * e.w / maxW) : .05;
        ctx.strokeStyle = on && focus ? colors[focus.g] : colors.muted;
        ctx.lineWidth = .6 + 5 * (e.w / maxW);
        ctx.beginPath(); ctx.moveTo(e.a.x, e.a.y); ctx.lineTo(e.b.x, e.b.y); ctx.stroke();
      });
      ctx.globalAlpha = 1;
      ctx.font = LABEL_FONT;
      ctx.textBaseline = 'middle';
      nodes.forEach(n => {
        const dim = near && !near.has(n);
        ctx.globalAlpha = dim ? .18 : 1;
        ctx.fillStyle = colors.bg; ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 2.5, 0, 7); ctx.fill();
        ctx.fillStyle = colors[n.g]; ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 7); ctx.fill();
        const label = n === focus ? `${n.label}  n=${n.n}` : n.label;
        const tx = n.x + n.r + 5, right = tx + ctx.measureText(label).width > W - 4;
        ctx.textAlign = right ? 'right' : 'left';
        const lx = right ? n.x - n.r - 5 : tx;
        ctx.lineWidth = 4; ctx.strokeStyle = colors.bg; ctx.lineJoin = 'round'; ctx.strokeText(label, lx, n.y);
        ctx.fillStyle = n === focus ? colors.fg : colors.fg2;
        ctx.fillText(label, lx, n.y);
      });
      ctx.globalAlpha = 1;
    }
    function loop() {
      step(); draw();
      if (drag || energy > .02) raf = requestAnimationFrame(loop); else running = false;
    }
    function kick() {
      if (!visible) return;
      if (reduceMotion && !drag) { draw(); return; }
      if (!running) { running = true; raf = requestAnimationFrame(loop); }
    }
    function at(e) {
      const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      let best = null, bd = 1e9;
      nodes.forEach(n => { const d = Math.hypot(n.x - x, n.y - y); if (d < n.r + 12 && d < bd) { bd = d; best = n; } });
      return { x, y, n: best };
    }
    canvas.addEventListener('pointerdown', e => {
      const p = at(e); if (!p.n) return;
      drag = p.n; canvas.setPointerCapture(e.pointerId); kick();
    });
    canvas.addEventListener('pointermove', e => {
      const p = at(e);
      if (drag) { drag.x = p.x; drag.y = p.y; kick(); return; }
      if (hover !== p.n) { hover = p.n; canvas.style.cursor = p.n ? 'grab' : 'default'; draw(); }
    });
    const release = () => { drag = null; kick(); };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('pointerleave', () => { if (!drag && hover) { hover = null; draw(); } });
    $('#net-shake').addEventListener('click', () => {
      nodes.forEach(n => { n.vx += (Math.random() - .5) * 40; n.vy += (Math.random() - .5) * 40; });
      if (reduceMotion) { for (let s = 0; s < 400; s++) step(); draw(); } else kick();
    });
    new ResizeObserver(resize).observe(canvas);
    matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { recolor(); themeBtn.textContent = currentTheme(); });
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) kick(); else { cancelAnimationFrame(raf); running = false; } }).observe(canvas);
    recolor();
    return { build, recolor };
  })();

  /* ------------------------------------------------------------ tmux bar, keys, clock */
  const winLinks = $$('#tmux-wins a');
  const sections = winLinks.map(a => $(a.getAttribute('href')));
  const spy = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const i = sections.indexOf(en.target);
      winLinks.forEach((a, j) => a.classList.toggle('on', i === j));
      const a = winLinks[i], bar = $('#tmux-wins');
      bar.scrollTo({ left: a.offsetLeft - bar.clientWidth / 2 + a.clientWidth / 2, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach(s => s && spy.observe(s));

  const clock = $('#clock');
  const tick = () => { clock.textContent = new Intl.DateTimeFormat('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Toronto' }).format(new Date()) + ' YYZ'; };
  tick(); setInterval(tick, 20000);

  const keysDlg = $('#keys');
  let lastFocus = null;
  function openDlg(d, focusEl) { lastFocus = document.activeElement; d.hidden = false; (focusEl || d).focus?.(); }
  function closeDlg(d) { d.hidden = true; lastFocus?.focus?.(); }
  keysDlg.addEventListener('click', e => { if (e.target === keysDlg) closeDlg(keysDlg); });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (!term.hidden) closeDlg(term); if (!keysDlg.hidden) closeDlg(keysDlg); return; }
    const typing = e.target.closest('input, textarea, [contenteditable]');
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === '`' || e.key === '~') { e.preventDefault(); openTerm(); }
    else if (e.key === '?') { e.preventDefault(); keysDlg.hidden ? openDlg(keysDlg, keysDlg.querySelector('.keys-inner')) : closeDlg(keysDlg); }
    else if (/^[0-8]$/.test(e.key)) { winLinks[+e.key].click(); }
    else if (e.key === '/') { e.preventDefault(); selectTab($('#t-papers')); $('#papers').scrollIntoView(); $('#pub-q').focus({ preventScroll: true }); }
    else if (e.key === 't') { setTheme(currentTheme() === 'light' ? 'dark' : 'light'); }
  });
  $('.keys-inner').tabIndex = -1;

  /* ------------------------------------------------------------ copy, print */
  $$('.copy').forEach(b => b.addEventListener('click', async () => {
    const text = b.dataset.copy || $('#' + b.dataset.copyFrom).textContent.replace(/^>\s*/, '');
    try { await navigator.clipboard.writeText(text); b.textContent = 'copied'; b.classList.add('ok'); }
    catch (e) { b.textContent = 'press ⌘C'; }
    setTimeout(() => { b.textContent = 'copy'; b.classList.remove('ok'); }, 1600);
  }));
  $('#print-cv').addEventListener('click', () => window.print());
  addEventListener('beforeprint', () => { pubState.all = true; pubState.q = ''; pubState.year = null; pubState.mode = 'all'; renderPubs(); });

  /* ------------------------------------------------------------ reveal on scroll */
  function reveal() {
    if (reduceMotion) return;
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px' });
    $$('.sec-head, .readme, .principles, .play, .console, .gitlog .c, .file, .stats, .pkg').forEach(el => {
      if (el.getBoundingClientRect().top > innerHeight) { el.classList.add('reveal'); io.observe(el); }
    });
  }

  /* ------------------------------------------------------------ the shell */
  const term = $('#term'), out = $('#term-out'), input = $('#term-in');
  const hist = []; let hi = 0; let greeted = false;
  const SECTIONS = { about: 'about', packages: 'packages', pkgs: 'packages', playground: 'playground', www: 'playground', repos: 'projects', projects: 'projects', papers: 'papers', pubs: 'papers', resume: 'resume', cv: 'resume', writing: 'writing', blog: 'writing', contact: 'contact', '~': 'top', '..': 'top', '/': 'top' };
  const print = (html, cls = '') => { const d = document.createElement('div'); if (cls) d.className = cls; d.innerHTML = html; out.appendChild(d); out.scrollTop = out.scrollHeight; };
  const link = (href, text) => `<a href="${esc(href)}" ${ext}>${esc(text || href)}</a>`;

  const COMMANDS = {
    help: () => `<span class="t-acc">available commands</span>
  whoami            who is this
  neofetch          system summary
  cat README.md     the short bio
  ls [dir]          list sections, or ls packages | repos | playground
  cd &lt;section&gt;      jump to a section (about, packages, repos, papers, resume, writing, contact)
  cran              R packages with CRAN versions and downloads
  grep &lt;words&gt;      search publications
  repos [words]     search repositories
  open &lt;name&gt;       open a package, repo, or app in a new tab
  stats             citation metrics from OpenAlex
  mail              how to reach me
  theme [dark|light], history, date, echo, clear, exit
<span class="t-dim">tab completes · ↑↓ history · esc closes</span>`,
    whoami: () => 'Ahmad Sofi-Mahmudi: DDS, MSc (HRM, McMaster). Research Associate, Comparative Effectiveness @ Cytel.\nWrites R packages for evidence synthesis and tools for research integrity. Toronto, Canada.',
    neofetch: () => {
      const s = state.stats || {};
      const tooth = $('.tooth').textContent.split('\n');
      const info = [
        '<span class="t-acc">ahmad</span>@<span class="t-acc">choxos</span>', '-------------',
        `<span class="t-acc">OS</span>: GNU/Linux, since 2010`, `<span class="t-acc">Host</span>: Cytel · Comparative Effectiveness`,
        `<span class="t-acc">Kernel</span>: DDS 2019 · MSc HRM 2024`, `<span class="t-acc">Packages</span>: ${state.pkgs.filter(p => p.cran).length} (cran), ${state.repoTotal} (git)`,
        `<span class="t-acc">Shell</span>: R · Stan · Python · Julia`, `<span class="t-acc">Citations</span>: ${fmt(s.citations)} · h ${s.h_index ?? ''}`,
        `<span class="t-acc">Locale</span>: ku · fa · en_CA · fr`, '',
      ];
      return tooth.map((l, i) => `<span class="t-acc">${esc(l.padEnd(23))}</span>${info[i] || ''}`).join('\n');
    },
    cat: a => /readme|about/i.test(a.join(' ')) ? $$('.readme > p:not(.md-h)').map(p => p.textContent.trim()).join('\n\n') : `cat: ${esc(a.join(' ') || '')}: No such file. Try <span class="t-acc">cat README.md</span>`,
    ls: a => {
      const d = (a[0] || '').replace(/\/$/, '');
      if (/^(packages|pkgs|r-pkgs)$/.test(d)) return COMMANDS.cran();
      if (/^(repos|projects)$/.test(d)) return COMMANDS.repos([]);
      if (/^(playground|www)$/.test(d)) return $$('.play').map(p => `${link(p.href, $('.play-name', p).textContent.padEnd(22))} <span class="t-dim">${esc($('.play-kind', p).textContent)}</span>`).join('\n');
      return '<span class="t-acc">about/  packages/  playground/  repos/  papers/  resume/  writing/  contact/</span>  README.md  DESCRIPTION  NEWS.md';
    },
    cd: a => {
      const id = SECTIONS[(a[0] || '~').replace(/\/$/, '')];
      if (!id) return `<span class="t-err">cd: no such file or directory: ${esc(a[0])}</span>`;
      closeDlg(term); $('#' + id).scrollIntoView(); return '';
    },
    cran: () => state.pkgs.map(p => `${link(p.site || p.repo, p.name.padEnd(15))} ${(p.cran ? 'CRAN ' + p.version : 'dev ' + p.version).padEnd(11)} ${p.cran ? ('↓' + fmt(p.downloads)).padStart(7) : '       '}  <span class="t-dim">${esc(p.title)}</span>`).join('\n') || 'no data',
    grep: a => {
      const q = a.join(' ').replace(/^["']|["']$/g, '').toLowerCase();
      if (!q) return 'usage: grep &lt;words&gt;';
      const hits = state.pubs.filter(p => `${p.title} ${p.venue}`.toLowerCase().includes(q));
      return hits.length ? hits.slice(0, 12).map(p => `<span class="t-acc">${p.year}</span> ${p.url ? link(p.url, p.title) : esc(p.title)}`).join('\n') + (hits.length > 12 ? `\n<span class="t-dim">… ${hits.length - 12} more. Try the filter in the papers section.</span>` : '') : `<span class="t-dim">(no matches for "${esc(q)}")</span>`;
    },
    repos: a => {
      const q = a.join(' ').toLowerCase();
      const hits = state.repos.filter(r => !q || `${r.name} ${r.description} ${r.topics.join(' ')}`.toLowerCase().includes(q));
      return hits.slice(0, 15).map(r => `${link(r.url, r.name.padEnd(24))} <span class="t-dim">${esc((r.description || '').slice(0, 70))}</span>`).join('\n') + (hits.length > 15 ? `\n<span class="t-dim">… ${hits.length - 15} more</span>` : '') || '<span class="t-dim">(nothing)</span>';
    },
    open: a => {
      const q = (a[0] || '').toLowerCase();
      if (!q) return 'usage: open &lt;name&gt;';
      const p = state.pkgs.find(x => x.name.toLowerCase() === q);
      const play = $$('.play').find(x => $('.play-name', x).textContent.toLowerCase().replace(/\s+/g, '') === q.replace(/\s+/g, ''));
      const r = state.repos.find(x => x.name.toLowerCase() === q);
      const url = p ? (p.site || p.repo) : play ? play.href : r ? (r.homepage || r.url) : null;
      if (!url) return `<span class="t-err">open: ${esc(q)}: not found</span>`;
      window.open(url, '_blank', 'noopener');
      return `<span class="t-ok">opening</span> ${link(url)}`;
    },
    stats: () => { const s = state.stats; return s ? `citations  ${fmt(s.citations)}\nh-index    ${s.h_index}\ni10-index  ${s.i10_index}\npapers     ${s.works} (${s.first_author} first-authored)\n<span class="t-dim">source: OpenAlex, ${esc(s.updated)}</span>` : 'no data'; },
    mail: () => `${link('mailto:a.sofimahmudi@gmail.com', 'a.sofimahmudi@gmail.com')}\n${link('https://github.com/choxos', 'github.com/choxos')} · ${link('https://orcid.org/0000-0001-6829-0823', 'orcid')} · ${link('https://www.linkedin.com/in/asofimahmudi/', 'linkedin')}`,
    theme: a => { const t = a[0] === 'light' || a[0] === 'dark' ? a[0] : currentTheme() === 'light' ? 'dark' : 'light'; setTheme(t); return `theme: ${t}`; },
    history: () => hist.map((h, i) => `${String(i + 1).padStart(4)}  ${esc(h)}`).join('\n'),
    date: () => new Date().toString(),
    echo: a => esc(a.join(' ')),
    clear: () => { out.innerHTML = ''; return ''; },
    exit: () => { closeDlg(term); return ''; },
    pwd: () => '/home/ahmad',
    uname: () => 'GNU/Linux choxos 6.x #1 SMP x86_64 GNU/Linux',
    sudo: () => '<span class="t-err">ahmad is not in the sudoers file. This incident will be reported to Reviewer 2.</span>',
    rm: () => '<span class="t-err">rm: refusing. Research waste is high enough already.</span>',
    vim: () => 'You are now trapped in vim. Just kidding: type <span class="t-acc">exit</span>.',
    emacs: () => 'emacs: a fine operating system. This site prefers vanilla JS.',
    r: () => 'R version 4.x: try <span class="t-acc">cran</span>, then install.packages("mlumr") in your own console.',
    man: () => 'AHMAD(1)\n\nNAME\n    ahmad: turns evidence synthesis methods into software\n\nSYNOPSIS\n    ahmad [--maic] [--nma] [--meta-research] &lt;question&gt;\n\nBUGS\n    Occasionally translates books into Persian at 3 a.m.',
  };
  COMMANDS.ll = COMMANDS.ls; COMMANDS.pubs = COMMANDS.grep; COMMANDS.R = COMMANDS.r; COMMANDS.Rscript = COMMANDS.r;
  COMMANDS.contact = COMMANDS.mail; COMMANDS.q = COMMANDS.exit; COMMANDS.quit = COMMANDS.exit;

  function run(line) {
    print(`<span class="ps1">ahmad@choxos</span>:<span class="ps-path">~</span>$ <span class="t-cmd">${esc(line)}</span>`);
    if (!line.trim()) return;
    hist.push(line); hi = hist.length;
    const [cmd, ...args] = line.trim().split(/\s+/);
    const fn = COMMANDS[cmd] || COMMANDS[cmd.toLowerCase()];
    const res = fn ? fn(args) : `<span class="t-err">${esc(cmd)}: command not found.</span> Type <span class="t-acc">help</span>.`;
    if (res) print(res);
  }
  function openTerm() {
    openDlg(term, input);
    if (!greeted) {
      greeted = true;
      print(`<span class="t-dim">Last login: ${new Date().toDateString()} on ttys001</span>\nWelcome to <span class="t-acc">choxos.github.io</span>. Type <span class="t-acc">help</span> to see what this shell can do.`);
    }
    setTimeout(() => input.focus(), 30);
  }
  $('#open-term').addEventListener('click', openTerm);
  $('#term-close').addEventListener('click', () => closeDlg(term));
  term.addEventListener('click', e => { if (e.target === term) closeDlg(term); });
  $('#term-form').addEventListener('submit', e => { e.preventDefault(); run(input.value); input.value = ''; });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowUp') { e.preventDefault(); if (hi > 0) input.value = hist[--hi]; }
    else if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.min(hist.length, hi + 1); input.value = hist[hi] || ''; }
    else if (e.key === 'Tab') {
      e.preventDefault();
      const parts = input.value.split(' '), last = parts.pop();
      const pool = parts.length ? [...Object.keys(SECTIONS), ...state.pkgs.map(p => p.name), 'README.md'] : Object.keys(COMMANDS);
      const m = pool.filter(c => c.startsWith(last));
      if (m.length === 1) input.value = [...parts, m[0]].join(' ') + ' ';
      else if (m.length > 1) print(m.join('  '), 't-dim');
    }
  });

  /* ------------------------------------------------------------ boot */
  themeBtn.textContent = currentTheme();
  Promise.all(['stats', 'publications', 'projects', 'rpackages', 'articles'].map(load)).then(([stats, pubs, repos, pkgs, posts]) => {
    Object.assign(state, { stats, pubs: pubs || [], repoTotal: (repos || []).length, repos: (repos || []).filter(r => r.description), pkgs: pkgs || [], posts: posts || [] });
    renderStats(); renderPackages(); renderRepoChips(); renderRepos(); renderSpark(); renderPubs(); renderPosts();
    $$('[data-stars]').forEach(el => { const r = state.repos.find(x => x.name === el.dataset.stars); if (r && r.stars >= 3) el.textContent = `★ ${r.stars}`; });
    net.build([
      ...state.pubs.map(p => `${p.title} ${p.venue}`),
      ...state.repos.map(r => `${r.name} ${r.description} ${r.topics.join(' ')} lang:${r.language}`),
      ...state.posts.map(p => `${p.title} ${p.tags.join(' ')}`),
    ]);
    // Async content shifted the layout; land deep links where they point.
    if (location.hash.length > 1) document.getElementById(location.hash.slice(1))?.scrollIntoView();
    reveal();
  });
})();
