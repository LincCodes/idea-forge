/* Idea Forge — catalog app. Vanilla JS, no dependencies. */
(function () {
  'use strict';

  const KIND_LABEL = { games: 'Game', apps: 'App', websites: 'Website' };
  const PAGE = 48;

  /* ------------------------------------------------------------------ state */
  const state = {
    tab: 'games',
    q: '',
    category: '',
    stack: '',
    tags: new Set(),
    favOnly: false,
    unbuiltOnly: false,
    sort: 'relevance',
    shown: PAGE,
    focused: -1,
    favs: new Set(JSON.parse(localStorage.getItem('if.favs') || '[]')),
    built: new Set(JSON.parse(localStorage.getItem('if.built') || '[]')),
    results: []
  };

  /* -------------------------------------------------------------- load data */
  /* games.js is loaded statically in index.html so the first tab can paint
     immediately. apps.js and websites.js (~400KB together) are fetched and
     expanded afterwards, off the critical path. */
  const RAW = window.RAW || {};
  const DATA = { games: [], apps: [], websites: [] };
  let ALL = [];

  function isLoaded(kind) { return !!RAW[kind]; }

  function ingest(kind) {
    DATA[kind] = IdeaForge.build(RAW[kind], kind);
    ALL = [...DATA.games, ...DATA.apps, ...DATA.websites];
    DATA[kind].forEach((it, i) => it.index = i);
    return DATA[kind].length;
  }

  function loadKind(kind) {
    if (isLoaded(kind)) return Promise.resolve(ingest(kind));
    return new Promise(resolve => {
      const s = document.createElement('script');
      s.src = 'data/' + kind + '.js';
      s.async = true;
      s.onload = () => resolve(ingest(kind));
      s.onerror = () => { console.warn('Could not load', kind); resolve(0); };
      document.head.appendChild(s);
    });
  }

  const KIND_OF_TAB = { games: 'games', apps: 'apps', websites: 'websites' };
  const LABEL_PLURAL = { games: 'games', apps: 'apps', websites: 'websites' };

  /* ------------------------------------------------------------------ utils */
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const save = () => {
    localStorage.setItem('if.favs', JSON.stringify([...state.favs]));
    localStorage.setItem('if.built', JSON.stringify([...state.built]));
  };
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 1900);
  }
  function copyText(text, label) {
    const done = () => toast(label || 'Copied');
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, () => fallback());
    } else fallback();
    function fallback() {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('Copy failed'); }
      document.body.removeChild(ta);
    }
  }
  function download(name, text, type) {
    const blob = new Blob([text], { type: type || 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('Downloaded ' + name);
  }
  function highlight(text, q) {
    const safe = esc(text);
    if (!q || q.length < 2) return safe;
    const rx = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
    return safe.replace(rx, '<mark>$1</mark>');
  }
  const sortKey = it => (it.stack + ' · ' + it.category);

  /* ------------------------------------------------------------- filtering */
  function currentPool() { return state.tab === 'all' ? ALL : DATA[state.tab]; }

  function compute() {
    const q = state.q.trim().toLowerCase();
    const terms = q.split(/\s+/).filter(Boolean);
    let out = currentPool().filter(it => {
      if (state.category && it.category !== state.category) return false;
      if (state.stack && it.stack !== state.stack) return false;
      if (state.favOnly && !state.favs.has(it.id)) return false;
      if (state.unbuiltOnly && state.built.has(it.id)) return false;
      if (state.tags.size && ![...state.tags].every(t => it.tags.includes(t))) return false;
      if (terms.length && !terms.every(t => it.searchText.includes(t))) return false;
      return true;
    });

    if (state.sort === 'az') out.sort((a, b) => a.title.localeCompare(b.title));
    else if (state.sort === 'za') out.sort((a, b) => b.title.localeCompare(a.title));
    else if (state.sort === 'stack') out.sort((a, b) => sortKey(a).localeCompare(sortKey(b)) || a.title.localeCompare(b.title));
    else if (state.sort === 'category') out.sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
    else if (q) out.sort((a, b) => score(b, terms, q) - score(a, terms, q));

    state.results = out;
    state.shown = PAGE;
  }
  function score(it, terms, q) {
    let s = 0;
    const t = it.title.toLowerCase();
    if (t.includes(q)) s += 40;
    if (t.startsWith(q)) s += 25;
    terms.forEach(term => {
      if (t.includes(term)) s += 12;
      if (it.tags.join(' ').toLowerCase().includes(term)) s += 8;
      if (it.category.toLowerCase().includes(term)) s += 6;
      if (it.hook.toLowerCase().includes(term)) s += 4;
      if (it.searchText.includes(term)) s += 2;
    });
    if (state.favs.has(it.id)) s += 1;
    return s;
  }

  /* --------------------------------------------------------------- filters UI */
  /* Idempotent: re-run after each data file arrives, so categories and tags from
     apps/websites appear as soon as they load. Selections are preserved. */
  function buildFilterOptions() {
    const pool = ALL;
    const cats = [...new Set(pool.map(i => i.category))].sort();
    const stacks = [...new Set(pool.map(i => i.stack))].sort();
    const tags = {};
    pool.forEach(i => i.tags.forEach(t => tags[t] = (tags[t] || 0) + 1));
    const topTags = Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 60);

    $('#filterCategory').innerHTML = '<option value="">All categories</option>' +
      cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    $('#filterStack').innerHTML = '<option value="">All stacks</option>' +
      stacks.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    $('#tagbar').innerHTML = topTags.map(([t, n]) =>
      `<button class="tag-chip" data-tag="${esc(t)}">${esc(t)} <span class="muted">${n}</span></button>`).join('');

    if (cats.includes(state.category)) $('#filterCategory').value = state.category;
    if (stacks.includes(state.stack)) $('#filterStack').value = state.stack;
    [...state.tags].forEach(t => {
      const c = document.querySelector(`.tag-chip[data-tag="${CSS.escape(t)}"]`);
      if (c) c.classList.add('is-on');
    });
  }

  /* ------------------------------------------------------------------ render */
  function renderCounts() {
    const n = k => isLoaded(k) ? DATA[k].length.toLocaleString() : '…';
    $('#tabCountGames').textContent = n('games');
    $('#tabCountApps').textContent = n('apps');
    $('#tabCountWebsites').textContent = n('websites');
    $('#tabCountAll').textContent = ALL.length ? ALL.length.toLocaleString() : '…';
    $('#brandSub').textContent = ALL.length === 1500
      ? '1500 buildable ideas'
      : ALL.length + ' of 1500 loaded…';
  }

  function cardHTML(it, q) {
    const fav = state.favs.has(it.id), built = state.built.has(it.id);
    return `<article class="card${built ? ' is-built' : ''}" data-id="${it.id}" tabindex="0" role="button" aria-label="${esc(it.title)}">
      <div class="card-actions">
        <button class="icon-btn fav${fav ? ' is-on' : ''}" data-act="fav" title="Favourite" aria-label="Favourite">${fav ? '★' : '☆'}</button>
        <button class="icon-btn speak" data-act="speak" title="Read aloud" aria-label="Read aloud">🔊</button>
        <button class="icon-btn" data-act="copy" title="Copy details" aria-label="Copy details">⧉</button>
      </div>
      <div class="card-top">
        <span class="card-id">${it.id.toUpperCase()}</span>
        <h3>${highlight(it.title, q)}</h3>
      </div>
      <span class="badge">${esc(KIND_LABEL[it.kind] || it.kind)} · ${esc(it.category)}</span>
      <p class="tagline">${highlight(it.hook, q)}</p>
      <div class="chips">
        <span class="chip stack">${esc(it.stack)}</span>
        <span class="chip ctrl">${esc(it.controls)}</span>
        ${it.tags.slice(0, 4).map(t => `<span class="chip">${esc(t)}</span>`).join('')}
      </div>
    </article>`;
  }

  function render(reset) {
    const grid = $('#results');
    const kind = KIND_OF_TAB[state.tab];
    if (kind && !isLoaded(kind)) {
      $('#boot').hidden = false;
      $('#bootMsg').textContent = 'Loading ' + LABEL_PLURAL[kind] + '…';
      grid.innerHTML = '';
      $('#resultCount').textContent = 'Loading…';
      $('#empty').hidden = true;
      return;
    }
    $('#boot').hidden = true;

    const q = state.q.trim();
    if (reset) grid.innerHTML = '';
    const slice = state.results.slice(reset ? 0 : grid.children.length, state.shown);
    grid.insertAdjacentHTML('beforeend', slice.map(it => cardHTML(it, q)).join(''));
    $('#resultCount').textContent = state.results.length.toLocaleString() +
      ' idea' + (state.results.length === 1 ? '' : 's') +
      (state.results.length > state.shown ? ` · showing ${state.shown}` : '');
    $('#empty').hidden = state.results.length !== 0;
    $('#btnClearSearch').hidden = !state.q;
    if (state.focused >= 0 && state.focused < grid.children.length) {
      const el = grid.children[state.focused];
      $$('.card.is-focused').forEach(c => c.classList.remove('is-focused'));
      el.classList.add('is-focused');
    }
  }

  function refresh(reset) {
    compute(); renderCounts();
    if (reset) state.focused = -1;
    render(true);
    syncHash();
  }

  /* ------------------------------------------------------------------ panel */
  let openItem = null;
  let pendingDetail = null;
  function openDetail(id, push) {
    const it = ALL.find(x => x.id === id);
    if (!it) {
      /* a deep link can arrive before its data file has been fetched */
      if (DATA.games.length && DATA.apps.length && DATA.websites.length) toast('Idea not found');
      else pendingDetail = { id, push };
      return;
    }
    openItem = it;
    $('#panelCat').textContent = (KIND_LABEL[it.kind] || it.kind) + ' · ' + it.category + ' · ' + it.stack;
    $('#panelTitle').textContent = it.title;
    $('#panelHook').textContent = it.hook;
    $('#btnFav').textContent = state.favs.has(it.id) ? '★' : '☆';
    $('#btnFav').classList.toggle('is-on', state.favs.has(it.id));
    $('#btnBuilt').textContent = state.built.has(it.id) ? '✓' : '◻';
    $('#btnBuilt').classList.toggle('is-on', state.built.has(it.id));

    const sec = (label, body, id) =>
      `<section class="sec" data-sec="${id}"><h4>${label}<button class="copy-sec" data-copy="${id}">copy</button></h4>${body}</section>`;

    $('#panelBody').innerHTML = [
      sec('Hook', `<p>${esc(it.hook)}</p>`, 'hook'),
      sec('Core loop', `<p>${esc(it.loop)}</p>`, 'loop'),
      sec('The twist — what makes it different', `<p>${esc(it.twist)}</p>`, 'twist'),
      sec('Why it\'s addictive', `<p>${esc(it.whyAddictive)}</p>`, 'why'),
      sec('Levels & endlessness', `<p>${esc(it.infiniteDesign)}</p>`, 'levels'),
      sec('Controls', `<p>${esc(it.controlsDetail)}</p>`, 'controls'),
      sec('Art direction', `<p>${esc(it.artDirection)}</p>`, 'art'),
      sec('First 60 seconds', `<p>${esc(it.firstMinute)}</p>`, 'first'),
      sec('Session length & difficulty curve', `<p>${esc(it.sessionShape)}</p>`, 'session'),
      sec('Long-term depth', `<p>${esc(it.depth)}</p>`, 'depth'),
      sec('Prototype plan — ' + it.stack, `<ol class="steps">${it.prototype.map(p => `<li>${esc(p)}</li>`).join('')}</ol>`, 'proto'),
      sec('Retention hooks', `<ul>${it.retention.map(r => `<li>${esc(r)}</li>`).join('')}</ul>`, 'retention'),
      sec('Monetisation', `<p>${esc(it.monetisation)}</p>`, 'money'),
      sec('Pitfalls to avoid', `<ul>${it.pitfalls.map(r => `<li>${esc(r)}</li>`).join('')}</ul>`, 'pitfalls'),
      sec('Prior-art note', `<p>${esc(it.priorArt)}</p>`, 'prior'),
      sec('Tags', `<div class="chips">${it.tags.map(t => `<span class="chip">${esc(t)}</span>`).join('')}</div>`, 'tags')
    ].join('');

    $('#overlay').hidden = false;
    document.body.style.overflow = 'hidden';
    $('#panel').scrollTop = 0;
    if (push !== false) location.hash = '#/' + it.kind + '/' + it.id;
    $('#btnClose').focus();
  }
  function closeDetail() {
    $('#overlay').hidden = true;
    document.body.style.overflow = '';
    openItem = null;
    tts.stop();
    if (location.hash.startsWith('#/')) safeReplaceHash('');
  }

  /* -------------------------------------------------------------------- TTS */
  const tts = (function () {
    const synth = window.speechSynthesis;
    let queue = [], i = 0, current = null, paused = false, supported = !!synth;
    const rateEl = () => parseFloat($('#rate').value) || 1;
    const voiceEl = () => { const v = $('#voice').value; return synth.getVoices().find(x => x.name === v) || null; };

    function hud(on, label) {
      $('#ttsHud').hidden = !on;
      if (label) $('#ttsLabel').textContent = label;
      $('#btnPause').hidden = !on; $('#btnResume').hidden = !on || !paused; $('#btnStop').hidden = !on;
    }
    function mark(el) {
      $$('.sec.speaking').forEach(s => s.classList.remove('speaking'));
      if (el) el.classList.add('speaking');
    }
    function speakNext() {
      if (i >= queue.length) return stop(true);
      const step = queue[i++];
      current = step;
      const u = new SpeechSynthesisUtterance(step.text);
      u.rate = rateEl(); u.pitch = 1;
      const v = voiceEl(); if (v) u.voice = v;
      u.onstart = () => {
        hud(true, step.label);
        const el = document.querySelector(`[data-sec="${step.id}"]`);
        mark(el); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      };
      u.onend = () => { if (!paused) speakNext(); };
      u.onerror = () => { if (!paused) speakNext(); };
      synth.speak(u);
    }
    function start(steps) {
      if (!supported) return toast('Speech synthesis not supported in this browser');
      synth.cancel(); queue = steps; i = 0; paused = false; speakNext();
    }
    function stop(silent) {
      if (supported) synth.cancel();
      queue = []; i = 0; paused = false; current = null; mark(null); hud(false);
      if (!silent) toast('Stopped');
    }
    return {
      supported,
      readItem(it) {
        const steps = [
          { id: 'hook', label: it.title, text: it.title + '. ' + it.category + '. ' + it.hook },
          { id: 'loop', label: 'Core loop', text: 'Core loop. ' + it.loop },
          { id: 'twist', label: 'The twist', text: 'The twist. ' + it.twist },
          { id: 'why', label: 'Why it works', text: 'Why it works. ' + it.whyAddictive },
          { id: 'levels', label: 'Levels', text: 'Levels and endlessness. ' + it.infiniteDesign },
          { id: 'controls', label: 'Controls', text: 'Controls. ' + it.controlsDetail },
          { id: 'art', label: 'Art direction', text: 'Art direction. ' + it.artDirection },
          { id: 'session', label: 'Session', text: 'Session and difficulty. ' + it.sessionShape },
          { id: 'depth', label: 'Depth', text: 'Long term depth. ' + it.depth },
          { id: 'retention', label: 'Retention', text: 'Retention hooks. ' + it.retention.join(' ') },
          { id: 'pitfalls', label: 'Pitfalls', text: 'Pitfalls. ' + it.pitfalls.join(' ') }
        ];
        start(steps);
        toast('Reading aloud — press ⏹ to stop');
      },
      readList(items) {
        start(items.map(it => ({
          id: 'x', label: it.title,
          text: it.title + '. ' + it.category + '. ' + it.hook + ' Core loop: ' + it.loop
        })));
        toast('Reading ' + items.length + ' ideas. Press ⏹ to stop.');
      },
      pause() { if (supported) { synth.pause(); paused = true; $('#btnResume').hidden = false; } },
      resume() { if (supported) { synth.resume(); paused = false; $('#btnResume').hidden = true; } },
      stop, isSpeaking: () => supported && synth.speaking
    };
  })();

  function loadVoices() {
    if (!window.speechSynthesis) return;
    const sel = $('#voice');
    const fill = () => {
      const vs = speechSynthesis.getVoices();
      if (!vs.length) return;
      const pref = vs.filter(v => /en/i.test(v.lang));
      const list = pref.length ? pref : vs;
      sel.innerHTML = '<option value="">Default voice</option>' +
        list.map(v => `<option value="${esc(v.name)}">${esc(v.name)} (${esc(v.lang)})</option>`).join('');
    };
    fill(); speechSynthesis.onvoiceschanged = fill;
  }

  /* ----------------------------------------------------------------- export */
  function toCSV(items) {
    const cols = ['id', 'kind', 'title', 'category', 'stack', 'controls', 'art', 'hook', 'loop',
      'twist', 'levels', 'spark', 'tags', 'whyAddictive', 'infiniteDesign', 'depth',
      'artDirection', 'firstMinute', 'sessionShape', 'monetisation', 'priorArt'];
    const cell = v => '"' + String(v).replace(/"/g, '""') + '"';
    return [cols.join(','), ...items.map(it => cols.map(c =>
      cell(c === 'tags' ? it.tags.join('; ') : (c === 'kind' ? (KIND_LABEL[it.kind] || it.kind) : it[c]))).join(','))].join('\n');
  }
  function toJSON(items) {
    return JSON.stringify(items.map(it => ({
      id: it.id, kind: it.kind, title: it.title, category: it.category, stack: it.stack,
      controls: it.controls, art: it.art, hook: it.hook, loop: it.loop, twist: it.twist,
      levels: it.levels, spark: it.spark, tags: it.tags, whyAddictive: it.whyAddictive,
      levelsAndEndlessness: it.infiniteDesign, depth: it.depth, artDirection: it.artDirection,
      firstMinute: it.firstMinute, sessionAndDifficulty: it.sessionShape,
      prototypePlan: it.prototype, retention: it.retention, monetisation: it.monetisation,
      pitfalls: it.pitfalls, priorArt: it.priorArt
    })), null, 2);
  }
  function toMarkdown(items) {
    return ['# Idea Forge export', '', items.length + ' ideas.', '', '---', '']
      .concat(items.map(IdeaForge.toMarkdown)).join('\n\n');
  }
  function toTXT(items) { return items.map(it => it.plain).join('\n\n' + '='.repeat(70) + '\n\n'); }

  function doExport(kind, scope) {
    const items = scope === 'fav'
      ? ALL.filter(i => state.favs.has(i.id))
      : scope === 'all' ? ALL : state.results;
    if (!items.length) return toast('Nothing to export');
    const stamp = new Date().toISOString().slice(0, 10);
    if (kind === 'json') download(`idea-forge-${scope}-${stamp}.json`, toJSON(items), 'application/json');
    if (kind === 'csv') download(`idea-forge-${scope}-${stamp}.csv`, toCSV(items), 'text/csv');
    if (kind === 'md') download(`idea-forge-${scope}-${stamp}.md`, toMarkdown(items), 'text/markdown');
    if (kind === 'txt') download(`idea-forge-${scope}-${stamp}.txt`, toTXT(items));
    $('#exportOverlay').hidden = true;
  }

  /* ------------------------------------------------------------------ stats */
  function showStats() {
    const counts = k => {
      const pool = k === 'all' ? ALL : DATA[k];
      const by = {};
      pool.forEach(i => { by[i.stack] = (by[i.stack] || 0) + 1; });
      return by;
    };
    const builtPct = n => Math.round(100 * [...state.built].filter(id => ALL.find(a => a.id === id)).length / (n || 1));
    const block = (label, n, pool) => `<div class="stat"><b>${n}</b><span>${label}</span></div>`;
    const stackRows = (pool) => Object.entries(pool).map(([s, n]) => `<tr><td>${esc(s)}</td><td>${n}</td></tr>`).join('');
    const total = ALL.length;
    $('#statsBody').innerHTML = `
      <div class="statgrid">
        ${block('Games', DATA.games.length)}
        ${block('Apps', DATA.apps.length)}
        ${block('Websites', DATA.websites.length)}
        ${block('Total ideas', total)}
        ${block('Favourites', state.favs.size)}
        ${block('Marked built', state.built.size)}
      </div>
      <h4>Build stacks</h4>
      <table class="keys"><tbody>${stackRows(counts('all'))}</tbody></table>
      <h4 style="margin-top:18px">Progress</h4>
      <p class="muted">You have marked ${state.built.size} of ${total} ideas as prototyped (${builtPct(total)}%).</p>
      <div class="bar"><i style="width:${builtPct(total)}%"></i></div>
      <p class="muted">Favourites are saved in this browser. Use Export to keep a copy.</p>`;
    $('#statsOverlay').hidden = false;
  }

  /* ------------------------------------------------------------------- hash */
  function safeReplaceHash(hash) {
    try { history.replaceState(null, '', location.pathname + location.search + hash); }
    catch (e) { /* file:// or sandboxed contexts can refuse this; not fatal */ }
  }

  function syncHash() {
    if (location.hash.startsWith('#/')) return;
    const parts = ['tab=' + state.tab];
    if (state.q) parts.push('q=' + encodeURIComponent(state.q));
    if (state.category) parts.push('c=' + encodeURIComponent(state.category));
    if (state.stack) parts.push('s=' + encodeURIComponent(state.stack));
    if (state.tags.size) parts.push('t=' + encodeURIComponent([...state.tags].join(',')));
    if (state.sort !== 'relevance') parts.push('o=' + state.sort);
    safeReplaceHash('#' + parts.join('&'));
  }
  function readHash() {
    const h = location.hash.slice(1);
    if (!h) return false;
    if (h.startsWith('/')) {
      const [, kind, id] = h.split('/');
      if (kind) state.tab = kind === 'apps' || kind === 'websites' ? kind : 'games';
      syncTabs();
      if (id) setTimeout(() => openDetail(id, false), 60);
      return true;
    }
    const p = new URLSearchParams(h);
    if (p.get('tab')) state.tab = p.get('tab');
    if (p.get('q')) state.q = p.get('q');
    if (p.get('c')) state.category = p.get('c');
    if (p.get('s')) state.stack = p.get('s');
    if (p.get('t')) p.get('t').split(',').filter(Boolean).forEach(t => state.tags.add(t));
    if (p.get('o')) state.sort = p.get('o');
    return true;
  }

  function syncTabs() {
    $$('.tab').forEach(t => {
      const on = t.dataset.tab === state.tab;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  /* ---------------------------------------------------------------- events */
  function wire() {
    let deb;
    $('#search').addEventListener('input', e => {
      clearTimeout(deb);
      deb = setTimeout(() => { state.q = e.target.value; refresh(); }, 130);
    });
    $('#btnClearSearch').addEventListener('click', () => {
      $('#search').value = ''; state.q = ''; refresh(); $('#search').focus();
    });
    $$('.tab').forEach(t => t.addEventListener('click', () => {
      state.tab = t.dataset.tab; syncTabs(); refresh();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }));
    $('#sort').addEventListener('change', e => { state.sort = e.target.value; refresh(); });
    $('#filterCategory').addEventListener('change', e => { state.category = e.target.value; refresh(); });
    $('#filterStack').addEventListener('change', e => { state.stack = e.target.value; refresh(); });
    $('#favOnly').addEventListener('change', e => { state.favOnly = e.target.checked; refresh(); });
    $('#unbuiltOnly').addEventListener('change', e => { state.unbuiltOnly = e.target.checked; refresh(); });
    const reset = () => {
      state.q = ''; state.category = ''; state.stack = ''; state.tags.clear();
      state.favOnly = false; state.unbuiltOnly = false; state.sort = 'relevance';
      $('#search').value = ''; $('#filterCategory').value = ''; $('#filterStack').value = '';
      $('#favOnly').checked = false; $('#unbuiltOnly').checked = false; $('#sort').value = 'relevance';
      $$('.tag-chip.is-on').forEach(c => c.classList.remove('is-on'));
      refresh();
    };
    $('#btnClearFilters').addEventListener('click', reset);
    $('#btnEmptyReset').addEventListener('click', reset);

    $('#tagbar').addEventListener('click', e => {
      const chip = e.target.closest('.tag-chip'); if (!chip) return;
      const t = chip.dataset.tag;
      state.tags.has(t) ? state.tags.delete(t) : state.tags.add(t);
      chip.classList.toggle('is-on');
      refresh();
    });

    $('#results').addEventListener('click', e => {
      const card = e.target.closest('.card'); if (!card) return;
      const it = ALL.find(x => x.id === card.dataset.id);
      const act = e.target.closest('[data-act]');
      if (act) {
        e.stopPropagation();
        if (act.dataset.act === 'fav') { toggleFav(it.id); act.textContent = state.favs.has(it.id) ? '★' : '☆'; act.classList.toggle('is-on', state.favs.has(it.id)); }
        if (act.dataset.act === 'copy') copyText(it.plain, 'Copied: ' + it.title);
        if (act.dataset.act === 'speak') tts.readItem(it);
        return;
      }
      openDetail(it.id);
    });
    $('#results').addEventListener('keydown', e => {
      const card = e.target.closest('.card'); if (!card) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(card.dataset.id); }
    });

    const io = new IntersectionObserver(entries => {
      if (entries.some(x => x.isIntersecting) && state.results.length > state.shown) {
        state.shown += PAGE; render(false);
      }
    }, { rootMargin: '600px' });
    io.observe($('#sentinel'));

    $('#btnClose').addEventListener('click', closeDetail);
    $('#overlay').addEventListener('click', e => { if (e.target.id === 'overlay') closeDetail(); });
    $('#btnFav').addEventListener('click', () => {
      if (!openItem) return; toggleFav(openItem.id);
      $('#btnFav').textContent = state.favs.has(openItem.id) ? '★' : '☆';
      $('#btnFav').classList.toggle('is-on', state.favs.has(openItem.id));
    });
    $('#btnBuilt').addEventListener('click', () => {
      if (!openItem) return; toggleBuilt(openItem.id);
      $('#btnBuilt').textContent = state.built.has(openItem.id) ? '✓' : '◻';
      $('#btnBuilt').classList.toggle('is-on', state.built.has(openItem.id));
    });
    $('#btnShare').addEventListener('click', () => {
      if (!openItem) return;
      copyText(location.origin + location.pathname + '#/' + openItem.kind + '/' + openItem.id, 'Link copied');
    });
    $('#btnCopyItem').addEventListener('click', () => openItem && copyText(openItem.plain, 'Full details copied'));
    $('#btnCopyMd').addEventListener('click', () => openItem && copyText(IdeaForge.toMarkdown(openItem), 'Markdown copied'));
    $('#btnCopyJson').addEventListener('click', () => openItem && copyText(JSON.stringify(openItem, null, 2), 'JSON copied'));
    $('#btnReadItem').addEventListener('click', () => openItem && tts.readItem(openItem));
    $('#panelBody').addEventListener('click', e => {
      const b = e.target.closest('.copy-sec'); if (!b || !openItem) return;
      const id = b.dataset.copy;
      const map = {
        hook: openItem.hook, loop: openItem.loop, twist: openItem.twist, why: openItem.whyAddictive,
        levels: openItem.infiniteDesign, controls: openItem.controlsDetail, art: openItem.artDirection,
        first: openItem.firstMinute, session: openItem.sessionShape, depth: openItem.depth,
        proto: openItem.prototype.map((p, i) => (i + 1) + '. ' + p).join('\n'),
        retention: openItem.retention.map(r => '- ' + r).join('\n'),
        money: openItem.monetisation, pitfalls: openItem.pitfalls.map(r => '- ' + r).join('\n'),
        prior: openItem.priorArt, tags: openItem.tags.join(', ')
      };
      copyText(map[id] || '', 'Section copied');
    });

    $('#btnReadResults').addEventListener('click', () => {
      const items = state.results.slice(0, 40);
      if (!items.length) return toast('Nothing to read');
      tts.readList(items);
    });
    $('#btnPause').addEventListener('click', tts.pause);
    $('#btnResume').addEventListener('click', tts.resume);
    $('#btnStop').addEventListener('click', () => tts.stop());
    $('#hudStop').addEventListener('click', () => tts.stop());

    $('#btnRandom').addEventListener('click', randomIdea);
    $('#btnTheme').addEventListener('click', toggleTheme);
    $('#btnStats').addEventListener('click', showStats);
    $('#btnStatsClose').addEventListener('click', () => $('#statsOverlay').hidden = true);
    $('#statsOverlay').addEventListener('click', e => { if (e.target.id === 'statsOverlay') $('#statsOverlay').hidden = true; });
    $('#btnExport').addEventListener('click', () => $('#exportOverlay').hidden = false);
    $('#btnExportClose').addEventListener('click', () => $('#exportOverlay').hidden = true);
    $('#exportOverlay').addEventListener('click', e => {
      if (e.target.id === 'exportOverlay') $('#exportOverlay').hidden = true;
      const b = e.target.closest('[data-export]');
      if (b) { const [k, s] = b.dataset.export.split(':'); doExport(k, s); }
    });
    $('#btnShortcuts').addEventListener('click', () => $('#helpOverlay').hidden = false);
    $('#btnAbout').addEventListener('click', () => { $('#helpOverlay').hidden = false; });
    $('#btnHelpClose').addEventListener('click', () => $('#helpOverlay').hidden = true);
    $('#helpOverlay').addEventListener('click', e => { if (e.target.id === 'helpOverlay') $('#helpOverlay').hidden = true; });

    document.addEventListener('keydown', e => {
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
      if (e.key === 'Escape') {
        if (!$('#helpOverlay').hidden) return $('#helpOverlay').hidden = true;
        if (!$('#statsOverlay').hidden) return $('#statsOverlay').hidden = true;
        if (!$('#exportOverlay').hidden) return $('#exportOverlay').hidden = true;
        if (!$('#overlay').hidden) return closeDetail();
        if (state.q) { $('#search').value = ''; state.q = ''; refresh(); }
        return;
      }
      if (typing) return;
      const k = e.key.toLowerCase();
      if (e.key === '/') { e.preventDefault(); $('#search').focus(); return; }
      if (k === 'j' || k === 'k') {
        const n = $('#results').children.length; if (!n) return;
        state.focused = k === 'j' ? Math.min(state.focused + 1, n - 1) : Math.max(state.focused - 1, 0);
        render(false);
        const el = $('#results').children[state.focused];
        if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        return;
      }
      if (k === 'enter' && state.focused >= 0) {
        const el = $('#results').children[state.focused];
        if (el) openDetail(el.dataset.id);
        return;
      }
      const foc = state.focused >= 0 ? ALL.find(x => x.id === ($('#results').children[state.focused] || {}).dataset?.id) : openItem;
      if (!foc) return;
      if (k === 's') tts.readItem(foc);
      if (k === 'c') copyText(foc.plain, 'Copied: ' + foc.title);
      if (k === 'f') { toggleFav(foc.id); render(false); toast((state.favs.has(foc.id) ? '★ ' : '☆ ') + foc.title); }
      if (k === 'b') { toggleBuilt(foc.id); render(false); toast((state.built.has(foc.id) ? 'Built: ' : 'Unbuilt: ') + foc.title); }
      if (k === 'r') randomIdea();
      if (k === 't') toggleTheme();
      if (['1', '2', '3', '4'].includes(e.key)) {
        state.tab = ['games', 'apps', 'websites', 'all'][+e.key - 1]; syncTabs(); refresh();
      }
    });
  }

  function toggleFav(id) {
    state.favs.has(id) ? state.favs.delete(id) : state.favs.add(id); save();
    if (state.favOnly) refresh();
  }
  function toggleBuilt(id) {
    state.built.has(id) ? state.built.delete(id) : state.built.add(id); save();
    if (state.unbuiltOnly) refresh();
  }
  function randomIdea() {
    const pool = state.results.length ? state.results : currentPool();
    if (!pool.length) return toast('No ideas in this filter');
    openDetail(pool[Math.floor(Math.random() * pool.length)].id);
  }
  function toggleTheme() {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('if.theme', next);
  }

  /* ------------------------------------------------------------------- boot */
  function afterLoad(kind) {
    buildFilterOptions();
    renderCounts();
    if (pendingDetail) { const p = pendingDetail; pendingDetail = null; openDetail(p.id, p.push); }
    if (state.tab === kind || state.tab === 'all') refresh();
  }

  function boot() {
    const theme = localStorage.getItem('if.theme');
    if (theme) document.documentElement.dataset.theme = theme;

    /* first paint: games only, which is all that is in the critical path */
    ingest('games');
    buildFilterOptions();
    readHash();
    syncTabs();
    $('#sort').value = state.sort;
    wire();
    loadVoices();
    refresh();

    /* the other two files (~400KB) load after first paint, then expand */
    loadKind('apps').then(afterLoad.bind(null, 'apps'))
      .then(() => loadKind('websites'))
      .then(afterLoad.bind(null, 'websites'))
      .catch(e => console.warn('Background load failed', e));

    window.addEventListener('hashchange', () => { if (location.hash.startsWith('#/')) readHash(); });
    window.addEventListener('load', () => {
      if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
        navigator.serviceWorker.register('sw.js').catch(() => { });
      }
    });
    console.log('%cIdea Forge ready', 'color:#3ddbd9',
      { games: DATA.games.length, apps: DATA.apps.length, websites: DATA.websites.length });
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
