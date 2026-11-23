(() => {
const D = JSON.parse(document.getElementById('atlas-data').textContent);
const P = D.papers, TOP = D.topics;
const NAME = D.proj.name, PUBS = D.proj.pubs;   // the project (e.g. CAMELS, Quijote)
const LIST = D.proj.list_label || `${NAME} publications page`;   // what the paper list is
// tag axis labels: [label, plural in lower case]; lo(axis) is the label in lower case
const AXL = Object.assign({ suite: ['Suite', 'suites'], data: ['Data', 'data'], method: ['Method', 'methods'] }, D.proj.axis_labels || {});
const lo = axis => AXL[axis][0].toLowerCase();
// ---------- LaTeX in titles and abstracts -> readable Unicode text ----------
// Math ($...$, \(...\)) gets symbols and sub/superscripts; text outside math loses font commands and
// grouping braces ({\sc SimBIG} -> SimBIG). The original title is kept for BibTeX (p.tRaw).
const TEX_SYM = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η',
  theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ',
  tau: 'τ', upsilon: 'υ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω', Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ',
  Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  sim: '∼', simeq: '≃', approx: '≈', times: '×', pm: '±', mp: '∓', cdot: '·', le: '≤', leq: '≤', leqslant: '≤',
  ge: '≥', geq: '≥', geqslant: '≥', lesssim: '≲', gtrsim: '≳', ll: '≪', gg: '≫', ne: '≠', neq: '≠', equiv: '≡',
  propto: '∝', infty: '∞', in: '∈', ell: 'ℓ', odot: '⊙', star: '⋆', ast: '∗', circ: '∘', sum: 'Σ', prod: 'Π',
  nabla: '∇', partial: '∂', parallel: '∥', perp: '⊥', bot: '⊥', top: '⊤', rightarrow: '→', to: '→', leftarrow: '←',
  langle: '⟨', rangle: '⟩', sqrt: '√', prime: '′', AA: 'Å', Msun: 'M⊙', dots: '…', ldots: '…', cdots: '⋯',
  log: 'log', ln: 'ln', exp: 'exp', max: 'max', min: 'min', lim: 'lim', sin: 'sin', cos: 'cos' };
const TEX_DROP = /^(rm|it|bf|sc|sf|tt|cal|scriptsize|footnotesize|small|large|Large|normalsize|displaystyle|textstyle|left|right|big|Big|bigg|Bigg|smash|mathrm|mathit|mathbf|mathsf|mathtt|mathcal|mathbb|mathscr|mathfrak|boldsymbol|bm|text|textrm|textit|textbf|texttt|textsc|textsf|emph|operatorname|hat|tilde|bar|vec|dot|ddot|widehat|widetilde|overline|underline|url|href|mbox|hbox)$/;
const SUP = Object.fromEntries([...'0123456789+-−=()ni'].map((c, i) => [c, '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁻⁼⁽⁾ⁿⁱ'[i]]));
const SUB = Object.fromEntries([...'0123456789+-=()aehijklmnoprstuvx'].map((c, i) => [c, '₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ'[i]]));
const texCmds = s => s
  .replace(/\\([%&#_$])/g, '$1').replace(/\\[{}]/g, m => m[1] === '{' ? '\u0001' : '\u0002')   // escaped characters
  .replace(/\\[,;:! ]/g, ' ')                                                                    // spacing
  .replace(/\\([A-Za-z]+)\s*/g, (m, c) => TEX_SYM[c] !== undefined ? TEX_SYM[c] + (/\s$/.test(m) ? ' ' : '')
    : TEX_DROP.test(c) ? '' : c);                                       // unknown (author) macros keep their name
const texScripts = s => s.replace(/([_^])\s*(\{([^{}]*)\}|[^\s{}\\])/g, (m, op, g, inner) => {
  const x = (inner !== undefined ? inner : g).trim(), map = op === '^' ? SUP : SUB;
  return [...x].every(c => map[c]) ? [...x].map(c => map[c]).join('') : (op === '^' ? '^' + x : x);
});
const unnest = s => {   // drop grouping braces except the ones right after ^ or _ ({\rm m} became {m}: _{{m}} -> _{m})
  for (let prev = null; prev !== s;) { prev = s; s = s.replace(/(^|[^_^\s]|\s)\{([^{}]*)\}/g, (m, pre, x) => /[_^]\s*$/.test(pre) ? m : pre + x); }
  return s;
};
const tex = s => String(s || '').replace(/\$([^$]*)\$|\\\((.*?)\\\)/g, (m, a, b) => '\u0003' + (a !== undefined ? a : b) + '\u0004')
  .split(/(\u0003[^\u0004]*\u0004)/).map(part => part[0] === '\u0003'
    ? texScripts(unnest(texCmds(part.slice(1, -1)))).replace(/[{}]/g, '').replace(/~/g, ' ')
    : texCmds(part).replace(/[{}]/g, ''))
  .join('').replace(/---/g, '—').replace(/--/g, '–').replace(/\u0001/g, '{').replace(/\u0002/g, '}').replace(/\s+/g, ' ').trim();
P.forEach((p, i) => { p.i = i; p.tRaw = p.t; p.t = tex(p.t); p.ab = tex(p.ab); p.citers = []; });
P.forEach(p => p.r.forEach(j => P[j].citers.push(p.i)));
// self-citation: the citing and cited paper share at least one author (other than the owner of a person's atlas,
// D.proj.owner, who is an author of every paper)
const OWNER = D.proj.owner ? D.authors.indexOf(D.proj.owner) : -1;
const shares = (i, j) => P[i].au.some(a => a !== OWNER && P[j].au.includes(a));
P.forEach(p => { p.citersInd = p.citers.filter(i => !shares(i, p.i)); });
const citeCount = p => S.selfc ? p.citers.length : p.citersInd.length;
const citeNote = () => S.selfc ? `${P.reduce((s, p) => s + p.r.length, 0)} citation links between ${NAME} papers · drag to rotate`
  : `${P.reduce((s, p) => s + p.citersInd.length, 0)} of ${P.reduce((s, p) => s + p.r.length, 0)} citation links shown (papers without shared authors) · drag to rotate`;
const AU = D.authors.map((name, i) => ({ i, name, papers: [] }));
P.forEach(p => p.au.forEach(a => AU[a].papers.push(p.i)));
AU.forEach(a => {
  const c = new Array(TOP.length).fill(0); a.papers.forEach(j => c[P[j].k]++);
  a.tc = c; a.topic = c.indexOf(Math.max(...c)); a.lc = a.name.toLowerCase();
});
// search index: accent- and case-insensitive; titles/authors/IDs rank above abstracts/tags/journal
const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9.]+/g, ' ').trim();
P.forEach(p => {
  p.hay = ' ' + norm(p.t + ' ' + p.id + ' ' + p.au.map(a => AU[a].name).join(' ')) + ' ';
  p.hayLo = ' ' + norm((p.ab || '') + ' ' + (p.tg ? [...p.tg.s, ...p.tg.d, ...p.tg.m].join(' ') : '') + ' ' + (p.v || '')) + ' ';
  p.words = [...new Set((p.hay + p.hayLo).split(' ').filter(w => w.length >= 3))];
});
AU.forEach(a => { a.norm = norm(a.name); });
function lev(a, b, max) {   // edit distance, giving up once it exceeds max
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < best) best = cur[j];
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}
function tokScore(p, tk) {   // 3: title/author/ID, 2: abstract/tags/journal, 1: near-miss (typo), 0: no match
  if (p.hay.includes(tk)) return 3;
  if (p.hayLo.includes(tk)) return 2;
  if (tk.length < 4) return 0;
  const max = tk.length >= 7 ? 2 : 1;
  for (const w of p.words) if (Math.abs(w.length - tk.length) <= max && lev(tk, w, max) <= max) return 1;
  return 0;
}
// co-author pairs; a paper with more than D.proj.coauthor_max authors (a large collaboration) counts only its first
// coauthor_max authors, plus the owner of a person's atlas (as in build_atlas.network_authors)
const EM = new Map();
const CO_MAX = D.proj.coauthor_max || Infinity, nBig = P.filter(p => p.au.length > CO_MAX).length;
const coAu = p => p.au.length <= CO_MAX ? p.au : [...p.au.slice(0, CO_MAX), ...(p.au.indexOf(OWNER) >= CO_MAX ? [OWNER] : [])];
P.forEach(p => { const au = coAu(p); for (let x = 0; x < au.length; x++) for (let y = x + 1; y < au.length; y++) {
  const a = Math.min(au[x], au[y]), b = Math.max(au[x], au[y]), key = a * 10000 + b;
  if (!EM.has(key)) EM.set(key, { s: a, t: b, papers: [] }); EM.get(key).papers.push(p.i);
} });
const CE = []; P.forEach(p => p.r.forEach(j => CE.push({ s: p.i, t: j, self: shares(p.i, j) })));
const years = [...new Set(P.map(p => p.y))].sort();

// ---------- state ----------
const S = { view: 'topics', sel: null, hover: null, q: '', y0: years[0], y1: years[years.length - 1], on: new Set(TOP.map((_, k) => k)), selfc: true, newOnly: false, colorBy: 'topic', dim: 2, tag: { s: '', d: '', m: '' }, nTop: { topics: 25, citations: 25, coauthors: 25 } };
const $ = id => document.getElementById(id);
const safeUrl = u => /^https?:\/\//i.test(String(u || '')) ? String(u) : '';   // links must be http(s)
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
let C = {};
const readColors = () => { C = { surface: css('--surface'), ink: css('--ink'), ink2: css('--ink-2'), muted: css('--muted'), edge: css('--edge'), edgeHi: css('--edge-hi'), accent: css('--accent'), t: TOP.map((_, k) => css('--t' + k)), seq0: css('--seq0'), seq1: css('--seq1') }; };

// ---------- color by topic / year / method / suite ----------
// The palette has NCOLORS colours (--t0 ... --t9) plus grey (--t10) for "Other / none" and unassigned papers.
const NCOLORS = 10, GREY = 10, RARE_SUITE_MIN = 5;
function cbSeries(axis) {   // tag values in config order, one colour each; the rest share grey "Other"
  const ax = axis === 'method' ? 'm' : 's', cnt = tg => P.filter(p => p.tg && p.tg[ax].includes(tg)).length;
  let names = (D.tagaxes[axis] || []).filter(tg => cnt(tg) > 0), small = [];
  if (axis === 'suite') { small = names.filter(tg => cnt(tg) < RARE_SUITE_MIN); names = names.filter(tg => cnt(tg) >= RARE_SUITE_MIN); }
  // "No ML" is the absence of a method: it is drawn in the neutral grey, so the methods stand out
  const neutral = axis === 'method' ? names.filter(tg => tg === 'No ML') : [];
  names = names.filter(tg => !neutral.includes(tg));
  if (names.length > NCOLORS) {   // more tags than colours: the least used go to "Other" (filters still list them)
    const keep = new Set(names.slice().sort((a, b) => cnt(b) - cnt(a)).slice(0, NCOLORS));
    small = small.concat(names.filter(tg => !keep.has(tg)));
    names = names.filter(tg => keep.has(tg));
  }
  const slot = tg => { const i = names.indexOf(tg); return i >= 0 ? i : GREY; };
  return { names, small, neutral, slot, ax };
}
const CB = { method: cbSeries('method'), suite: cbSeries('suite') };
const yMin = Math.min(...P.map(p => p.y)), yMax = Math.max(...P.map(p => p.y));
AU.forEach(a => {
  a.y0 = Math.min(...a.papers.map(j => P[j].y));
  ['method', 'suite'].forEach(axis => {   // an author's most frequent tag
    const c = {}; a.papers.forEach(j => (P[j].tg ? P[j].tg[CB[axis].ax] : []).forEach(tg => { c[tg] = (c[tg] || 0) + 1; }));
    a['cb_' + axis] = Object.keys(c).sort((x, y) => c[y] - c[x])[0] || null;
  });
});
function mix(h0, h1, f) {
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), a = p(h0), b = p(h1);
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * f).toString(16).padStart(2, '0')).join('');
}
function colorOf(n, isP) {   // {fill, ring} for a node in the current color mode
  const by = S.colorBy;
  if (isP) {
    const p = P[n.id];
    if (by === 'year') return { fill: mix(C.seq0, C.seq1, (p.y - yMin) / Math.max(1, yMax - yMin)) };
    if (by === 'method' || by === 'suite') {
      const tg = p.tg ? p.tg[CB[by].ax] : [];
      if (!tg.length) return { fill: C.t[10] };
      return { fill: C.t[CB[by].slot(tg[0])], ring: tg.length > 1 ? C.t[CB[by].slot(tg[1])] : null };
    }
    return { fill: C.t[p.k] };
  }
  const a = AU[n.id];
  if (by === 'year') return { fill: mix(C.seq0, C.seq1, (a.y0 - yMin) / Math.max(1, yMax - yMin)) };
  if (by === 'method' || by === 'suite') return { fill: a['cb_' + by] ? C.t[CB[by].slot(a['cb_' + by])] : C.t[10] };
  return { fill: C.t[a.topic] };
}
// the colour legend (Color by year / method / suite), bottom-left of the map; it can be collapsed to a chip,
// remembered in this browser
let keyOpen = true;
try { keyOpen = localStorage.getItem('atlasKeyOpen') !== '0'; } catch (e) {}
$('cbkey').addEventListener('click', e => {
  if (!e.target.closest('.keytoggle')) return;
  keyOpen = !keyOpen; try { localStorage.setItem('atlasKeyOpen', keyOpen ? '1' : '0'); } catch (err) {}
  colorKey(); const t = $('cbkey').querySelector('.keytoggle'); if (t) t.focus();
});
function colorKey() {
  const k = $('cbkey'), by = S.colorBy;
  if (by === 'topic' || FLAT[S.view]) { k.hidden = true; return; }
  const title = { year: 'Year', method: AXL.method[0], suite: AXL.suite[0] }[by];
  k.classList.toggle('closed', !keyOpen); k.hidden = false;
  if (!keyOpen) { k.innerHTML = `<button class="keytoggle" type="button" aria-expanded="false" title="Show the legend">Legend ▴</button>`; return; }
  const head = `<div class="keyhead"><span>${title}</span><button class="keytoggle" type="button" aria-expanded="true" aria-label="Hide the legend" title="Hide the legend">–</button></div>`;
  if (by === 'year') {
    k.innerHTML = head + `<div class="ramp"></div><div class="ends"><span>${yMin}</span><span>${yMax}</span></div><div class="hint">${S.view === 'coauthors' ? `Year of first ${NAME} paper` : 'Year of first appearance'}</div>`;
  } else {
    const s = CB[by];
    const grey = [...s.neutral, ...(s.small.length ? ['other'] : []), 'no tag'].join(' / ');   // e.g. "No ML / no tag"
    k.innerHTML = head + s.names.map(tg => `<div class="row"><i style="background:var(--t${s.slot(tg)})"></i>${esc(tg)}</div>`).join('') +
      `<div class="row"${s.small.length ? ` title="${esc('Other: ' + s.small.join(', '))}"` : ''}><i style="background:var(--t10)"></i>${esc(grey[0].toUpperCase() + grey.slice(1))}</div>` +
      `<div class="hint">${S.view === 'coauthors' ? 'Each author’s most frequent ' + by : 'First ' + by + ' tag; a ring shows a second one'}</div>`;
  }
}

const PLAY = { on: false, timer: 0, upto: null, flash: null, total: 20000 };   // Play: ~20 s for the whole history
// ---------- filters ----------
let pOn = [], aOn = [], nShown = 0;
function applyFilters() {
  const qn = norm(S.q), toks = qn.split(' ').filter(Boolean);
  const tagOk = p => ['s', 'd', 'm'].every(ax => !S.tag[ax] || (p.tg && p.tg[ax].includes(S.tag[ax])));
  S.score = {};
  const qOk = p => {   // every search word must match somewhere
    if (!toks.length) return true;
    let s = 0;
    for (const tk of toks) { const v = tokScore(p, tk); if (!v) return false; s += v; }
    S.score[p.i] = s; return true;
  };
  // every filter except the search text (years, topics, tags, "New", the play animation)
  const base = P.map(p => p.y >= S.y0 && p.y <= S.y1 && S.on.has(p.k) && tagOk(p) && (!S.newOnly || p.nw) && (PLAY.upto === null || p.rank <= PLAY.upto));
  pOn = P.map((p, i) => base[i] && qOk(p));
  // a search that matches author names shows those authors, but only if one of their papers passes the
  // other filters; otherwise an author is shown when one of their shown papers is
  const nameHit = qn ? AU.filter(a => a.norm.includes(qn)) : [];
  aOn = AU.map(a => nameHit.length ? a.norm.includes(qn) && a.papers.some(j => base[j]) : a.papers.some(j => pOn[j]));
  nShown = pOn.filter(Boolean).length;
  const qc = $('qcount'); if (qc) qc.textContent = toks.length ? `${nShown} match${nShown === 1 ? '' : 'es'}` : '';
}

// ---------- layouts (world coords) ----------
const L = {};
// centre on the mean and return a framing radius from the bulk (90th percentile), so far islands don't shrink the view
function centre3d(nodes) {
  const N = nodes.length, c = ['x3', 'y3', 'z3'].map(k => nodes.reduce((s, n) => s + n[k], 0) / N);
  nodes.forEach(n => { n.x3 -= c[0]; n.y3 -= c[1]; n.z3 -= c[2]; });
  const ds = nodes.map(n => Math.hypot(n.x3, n.y3, n.z3)).sort((a, b) => a - b);
  return Math.max(1, ds[Math.floor(0.9 * (N - 1))]);
}
const med = a => { const s = a.slice().sort((u, v) => u - v); return s[s.length >> 1]; };
// label each topic at its densest spot (the member with the most same-topic papers nearby),
// not at the median, which can fall inside another topic; "Unassigned" gets no label
function topicLabels(nodes, keys) {
  const xs = nodes.map(n => keys.map(k => n[k]));
  const span = Math.max(...keys.map((_, d) => Math.max(...xs.map(v => v[d])) - Math.min(...xs.map(v => v[d]))));
  const s2 = 2 * Math.pow(0.07 * span, 2);
  return TOP.map((name, k) => {
    if (/^Unassigned/.test(name)) return null;
    const mem = nodes.map((n, i) => i).filter(i => P[nodes[i].id].k === k);
    if (!mem.length) return null;
    let best = mem[0], bs = -1;
    for (const i of mem) {
      let s = 0;
      for (const j of mem) { let d2 = 0; keys.forEach((_, d) => { d2 += (xs[i][d] - xs[j][d]) ** 2; }); s += Math.exp(-d2 / s2); }
      if (s > bs) { bs = s; best = i; }
    }
    const l = { k, name }; keys.forEach((key, d) => { l[key] = xs[best][d]; });
    return l;
  }).filter(Boolean);
}
// turn a 2D layout so its long (principal) axis runs along the canvas's long side; display only
function alignWide(nodes) {
  const n = nodes.length; if (n < 3) return nodes;
  const mx = nodes.reduce((s, v) => s + v.x, 0) / n, my = nodes.reduce((s, v) => s + v.y, 0) / n;
  let sxx = 0, syy = 0, sxy = 0;
  nodes.forEach(v => { const dx = v.x - mx, dy = v.y - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; });
  const th = 0.5 * Math.atan2(2 * sxy, sxx - syy) - (H > W * 1.1 ? Math.PI / 2 : 0);
  const c = Math.cos(-th), s = Math.sin(-th);
  nodes.forEach(v => { const dx = v.x - mx, dy = v.y - my; v.x = dx * c - dy * s; v.y = dx * s + dy * c; });
  return nodes;
}
// dot radius: logarithmic in the count, capped, so a few very large values don't dwarf the rest
const dotR = (v, a) => Math.min(16, 3 + a * Math.log1p(Math.max(0, v)));
function topicLayout() {
  if (S.dim === 2) {
    const nodes = P.map(p => ({ id: p.i, kind: 'p', x: p.x * 420, y: -p.yy * 420, r: dotR(p.c, 2.2) }));
    alignWide(nodes);
    return { nodes, links: [], labels: topicLabels(nodes, ['x', 'y']), is3d: false, glow: true };
  }
  const nodes = P.map(p => ({ id: p.i, kind: 'p', x3: p.p3[0] * 420, y3: -p.p3[1] * 420, z3: p.p3[2] * 420, r: dotR(p.c, 2.2) }));
  const R = centre3d(nodes);
  return { nodes, links: [], labels: topicLabels(nodes, ['x3', 'y3', 'z3']), R, is3d: true, glow: true };
}

// Network positions are computed by the Python build script and shipped with the data.
function citationLayout() {
  const d2 = S.dim === 2;
  const nodes = P.map(p => ({ id: p.i, kind: 'p', r: dotR(citeCount(p), 2.6),
    ...(d2 ? { x: p.c2[0], y: p.c2[1] } : { x3: p.c3[0], y3: p.c3[1], z3: p.c3[2] }) }));
  const links = CE.map(e => ({ source: nodes[e.s], target: nodes[e.t], s: e.s, t: e.t, w: 0.45, self: e.self }));
  if (!d2) return { nodes, links, labels: [], R: centre3d(nodes), is3d: true };
  // papers with no citation link in either direction (their reference lists are in neither ADS nor Semantic
  // Scholar: theses, very recent papers) would float around the network: put them in a tidy grid below it,
  // grouped by topic, with a caption (drawn in render)
  const unlinked = nodes.filter(n => !P[n.id].r.length && !P[n.id].citers.length);
  const linked = nodes.filter(n => P[n.id].r.length || P[n.id].citers.length);
  alignWide(linked.length >= 3 ? linked : nodes);
  let grid = null;
  if (unlinked.length && linked.length) {
    const xs = linked.map(n => n.x), ys = linked.map(n => n.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), bw = x1 - x0, bh = Math.max(...ys) - Math.min(...ys);
    const sp = bw / 28, cols = Math.min(unlinked.length, 26), rows = Math.ceil(unlinked.length / cols);
    const gx = (x0 + x1) / 2 - (cols - 1) * sp / 2, gy = Math.max(...ys) + 0.10 * bh + sp;
    unlinked.sort((a, b) => P[a.id].k - P[b.id].k || P[b.id].y - P[a.id].y)
      .forEach((n, i) => { n.x = gx + (i % cols) * sp; n.y = gy + Math.floor(i / cols) * sp; });
    grid = { x: gx + (cols - 1) * sp / 2, y: gy - sp * 0.9, ids: unlinked.map(n => n.id), rows };   // x: centre
  }
  return { nodes, links, labels: [], is3d: false, unlinked: grid };
}
function coauthorLayout() {   // all authors
  const d2 = S.dim === 2, pos = (d2 ? D.co2d : D.co)['1'], keep = AU.filter(a => pos[a.i]);
  const nodes = keep.map(a => ({ id: a.i, kind: 'a', r: dotR(a.papers.length - 1, 3.0),
    ...(d2 ? { x: pos[a.i][0], y: pos[a.i][1] } : { x3: pos[a.i][0], y3: pos[a.i][1], z3: pos[a.i][2] }) }));
  const byId = new Map(nodes.map(n => [n.id, n]));
  const links = [...EM.values()].filter(e => byId.has(e.s) && byId.has(e.t)).map(e => ({
    source: byId.get(e.s), target: byId.get(e.t), s: e.s, t: e.t, papers: e.papers,
    w: e.papers.reduce((s, j) => s + 1 / (P[j].au.length - 1), 0) }));  // Newman collaboration strength
  if (d2) alignWide(nodes);
  return d2 ? { nodes, links, labels: [], is3d: false } : { nodes, links, labels: [], R: centre3d(nodes), is3d: true };
}
// camera for the 3D view
const CAM = { yaw: 0.6, pitch: -0.25, spin: !matchMedia('(prefers-reduced-motion: reduce)').matches, pv: [0, 0, 0], snap: true };
// Rotation centre: the selected node; for a selection of the other kind, the mean of its related nodes
// (an author's papers in the paper views, a paper's authors in the co-author view); else the graph centre.
function pivotTarget(lay) {
  if (!S.sel || !lay.nodes.length) return [0, 0, 0];
  const isP = lay.nodes[0].kind === 'p', ids = new Set();
  if (S.sel.kind === (isP ? 'p' : 'a')) ids.add(S.sel.i);
  else if (S.sel.kind === 'a') AU[S.sel.i].papers.forEach(j => ids.add(j));
  else P[S.sel.i].au.forEach(a => ids.add(a));
  const ns = lay.nodes.filter(n => ids.has(n.id));
  if (!ns.length) return [0, 0, 0];
  return ['x3', 'y3', 'z3'].map(k => ns.reduce((s, n) => s + n[k], 0) / ns.length);
}
function project(lay) {
  // glide the rotation centre toward its target (instantly on view switch or with reduced motion)
  const tg = pivotTarget(lay), pv = CAM.pv, inst = CAM.snap || matchMedia('(prefers-reduced-motion: reduce)').matches;
  let moving = false;
  for (let i = 0; i < 3; i++) { const d = tg[i] - pv[i]; if (inst || Math.abs(d) < 0.05) pv[i] = tg[i]; else { pv[i] += d * 0.15; moving = true; } }
  CAM.snap = false; if (moving) draw();
  const cy = Math.cos(CAM.yaw), sy_ = Math.sin(CAM.yaw), cp = Math.cos(CAM.pitch), sp = Math.sin(CAM.pitch), Dc = lay.R * 3;
  for (const n of lay.nodes.concat(lay.labels)) {
    const X = n.x3 - pv[0], Y = n.y3 - pv[1], Z = n.z3 - pv[2];
    const x1 = X * cy + Z * sy_, z1 = -X * sy_ + Z * cy;
    const y2 = Y * cp - z1 * sp, z2 = Y * sp + z1 * cp, f = Dc / Math.max(Dc + z2, Dc * 0.3);
    n.x = x1 * f; n.y = y2 * f; n.s = Math.min(f, 2); n.dz = z2; n.fog = Math.max(0.35, Math.min(1, 0.45 + 0.55 * (1 - (z2 + lay.R) / (2 * lay.R))));
  }
}
const layout = () => {
  const key = S.view + '-' + S.dim + 'd';
  if (!L[key]) L[key] = S.view === 'topics' ? topicLayout() : S.view === 'citations' ? citationLayout() : coauthorLayout();
  return L[key];
};

// ---------- canvas ----------
const cv = $('cv'), ctx = cv.getContext('2d'), stage = $('stage');
let W = 0, H = 0, raf = 0;
// ---------- zoom & pan (own small implementation: screen = (x, y) + k * world) ----------
const T = { k: 1, x: 0, y: 0, applyX(v) { return this.x + this.k * v; }, applyY(v) { return this.y + this.k * v; } };
const ZMIN = 0.05, ZMAX = 40;
let zAnim = 0, zTarget = null, userMoved = false, fitK = 1;   // userMoved: stop auto-fitting once the user zooms or pans   // zTarget: where a running zoom animation will end
// every zoom/pan goes through here: note the time, so the islands are scaled from their cached image while
// moving and redrawn sharply once the movement stops (see drawIslands)
let islMoved = 0, islTimer = 0;
function setView2(k, x, y) {
  T.k = k; T.x = x; T.y = y; hideTip(); draw();
  islMoved = performance.now(); clearTimeout(islTimer); islTimer = setTimeout(draw, ISL_SETTLE + 30);
}
function animateTo(k, x, y, ms) {
  cancelAnimationFrame(zAnim);
  zTarget = null;
  if (!ms || matchMedia('(prefers-reduced-motion: reduce)').matches) return setView2(k, x, y);
  zTarget = { k, x, y };
  const k0 = T.k, x0 = T.x, y0 = T.y, t0 = performance.now();
  const step = now => {
    const u = Math.min(1, (now - t0) / ms), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    setView2(k0 + (k - k0) * e, x0 + (x - x0) * e, y0 + (y - y0) * e);
    if (u < 1) zAnim = requestAnimationFrame(step); else zTarget = null;
  };
  zAnim = requestAnimationFrame(step);
}
function zoomAt(f, px, py, ms) {   // zoom by factor f keeping screen point (px, py) fixed
  const b = zTarget || T;            // build on an unfinished animation's end point, so quick clicks add up
  const k = Math.max(ZMIN, Math.min(ZMAX, b.k * f)), r = k / b.k;
  animateTo(k, px - (px - b.x) * r, py - (py - b.y) * r, ms);
}
cv.addEventListener('wheel', e => {
  e.preventDefault(); userMoved = true;
  const r = cv.getBoundingClientRect();
  zoomAt(Math.pow(2, -e.deltaY * (e.deltaMode ? 0.05 : 0.002)), e.clientX - r.left, e.clientY - r.top);
}, { passive: false });
const pointers = new Map();   // two-finger pinch zoom
let pinch = null;
cv.addEventListener('pointerdown', e => { pointers.set(e.pointerId, [e.clientX, e.clientY]); if (pointers.size === 2) pinch = null; });
cv.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, [e.clientX, e.clientY]);
  if (pointers.size !== 2) return;
  const [a, b] = [...pointers.values()], r = cv.getBoundingClientRect();
  const d = Math.hypot(a[0] - b[0], a[1] - b[1]), mx = (a[0] + b[0]) / 2 - r.left, my = (a[1] + b[1]) / 2 - r.top;
  if (pinch) { userMoved = true; zoomAt(d / pinch.d, mx, my); }
  pinch = { d };
});
const dropPointer = e => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null; };
cv.addEventListener('pointerup', dropPointer); cv.addEventListener('pointercancel', dropPointer);
function resize() {
  const r = stage.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  W = r.width; H = r.height; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw();
}
function fit(animate, all) {   // all: frame every dot (fit button); otherwise the central 98%
  if (FLAT[S.view]) return;
  const done = k => { fitK = k; return k; };
  const lay = layout(), { nodes } = lay; if (!nodes.length || !W) return;
  const reduce0 = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (lay.is3d) {
    animateTo(done(Math.min(W - 40, H - 40) / (2 * lay.R * (all ? 1.6 : 1.15))), W / 2, H / 2, animate && !reduce0 ? 450 : 0); return;
  }
  const q = (a, f) => { const s = a.slice().sort((u, v) => u - v); return s[Math.min(s.length - 1, Math.max(0, Math.round(f * (s.length - 1))))]; };
  const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y), lo = all ? 0 : 0.01, hi = all ? 1 : 0.99;
  const x0 = q(xs, lo), x1 = q(xs, hi), y0 = q(ys, lo), y1 = q(ys, hi);
  const k = done(Math.min((W - 180) / (x1 - x0 || 1), (H - 90) / (y1 - y0 || 1)));   // margins leave room for labels
  animateTo(k, W / 2 - k * (x0 + x1) / 2, H / 2 - k * (y0 + y1) / 2, animate && !reduce0 ? 450 : 0);
}
// x of a centred label of width w so the whole name stays on a canvas W wide; an anchor that is already off
// screen (an island panned away) is left alone, so its name does not pile up at the edge
const keepOnScreen = (x, w, W) => (x < 0 || x > W) ? x : Math.min(W - 6 - w / 2, Math.max(6 + w / 2, x));
const draw = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); };

// which nodes/edges are emphasised by the current selection or hover
function focusSets() {
  const f = S.hover || S.sel; if (!f) return null;
  const papers = new Set(), authors = new Set();
  if (f.kind === 'p') { papers.add(f.i); P[f.i].au.forEach(a => authors.add(a));
    if (S.view === 'citations') { P[f.i].r.forEach(j => papers.add(j)); P[f.i].citers.forEach(j => papers.add(j)); }
    if (S.view === 'topics' && P[f.i].sim) P[f.i].sim.l.forEach(([j]) => papers.add(j)); }
  else { authors.add(f.i); AU[f.i].papers.forEach(j => papers.add(j));
    if (S.view === 'coauthors') AU[f.i].papers.forEach(j => P[j].au.forEach(a => authors.add(a))); }
  return { f, papers, authors };
}
const FLAT = { table: 1, trends: 1 };   // views without the map canvas
// ---------- atlas islands: per-topic density regions drawn as vector contours, cached ----------
// Each topic's papers are smoothed into a density field on a fine grid; its level sets (traced with marching
// squares and rounded off) are filled and outlined like a topographic map, at the screen's full resolution.
// The image covers the view plus a margin, so panning only shifts it; zoom or filter changes redraw it.
// Redrawing every frame would be too slow: while zooming or panning (and ISL_SETTLE ms after) the cached
// image is scaled instead, and redrawn at most every ISL_PLAY ms, as during the history animation.
const ISL = { key: '', content: '', img: null, tx: 0, ty: 0, k: 1, m: 0, t: 0, dpr: 1 }, ISL_SETTLE = 150, ISL_PLAY = 300;
const ISL_LEVELS = [40, 80, 130, 195];   // density levels (a lone paper peaks at 107): coast, then higher ground
// closed contour rings of the grid field F (gw x gh, zero on its border) at level lev, in grid units
function contourRings(F, gw, gh, lev) {
  const pt = new Map(), seg = new Map(), segs = [];
  const at = key => {            // where the level crosses grid edge `key` (horizontal: even, vertical: odd)
    let p = pt.get(key); if (p) return p;
    const c = key >> 1, i = c % gw, j = (c - i) / gw, a = F[c];
    if (key & 1) { const b = F[c + gw]; p = [i, j + (lev - a) / (b - a)]; }
    else { const b = F[c + 1]; p = [i + (lev - a) / (b - a), j]; }
    pt.set(key, p); return p;
  };
  const add = (e1, e2) => { const s = segs.length; segs.push([e1, e2]);
    for (const e of [e1, e2]) { const l = seg.get(e); if (l) l.push(s); else seg.set(e, [s]); } };
  for (let j = 0; j < gh - 1; j++) for (let i = 0; i < gw - 1; i++) {
    const c = j * gw + i, v0 = F[c], v1 = F[c + 1], v2 = F[c + gw + 1], v3 = F[c + gw];
    const code = (v0 >= lev) << 3 | (v1 >= lev) << 2 | (v2 >= lev) << 1 | (v3 >= lev);
    if (code === 0 || code === 15) continue;
    const T = 2 * c, B = 2 * (c + gw), L = 2 * c + 1, R = 2 * (c + 1) + 1;   // the cell's four edges
    const mid = (v0 + v1 + v2 + v3) / 4 >= lev;
    switch (code) {
      case 1: case 14: add(L, B); break;
      case 2: case 13: add(B, R); break;
      case 3: case 12: add(L, R); break;
      case 4: case 11: add(T, R); break;
      case 6: case 9: add(T, B); break;
      case 7: case 8: add(L, T); break;
      case 5: if (mid) { add(L, T); add(B, R); } else { add(T, R); add(L, B); } break;
      case 10: if (mid) { add(T, R); add(L, B); } else { add(L, T); add(B, R); } break;
    }
  }
  const used = new Uint8Array(segs.length), rings = [];
  for (let s0 = 0; s0 < segs.length; s0++) {
    if (used[s0]) continue;
    const ring = []; let s = s0, e = segs[s0][0];
    while (!used[s]) {
      used[s] = 1; ring.push(at(e));
      e = segs[s][0] === e ? segs[s][1] : segs[s][0];
      const nx = seg.get(e); s = nx[0] === s ? nx[1] : nx[0];
      if (s === undefined) break;
    }
    if (ring.length > 2) rings.push(ring);
  }
  return rings;
}
// one pass of Chaikin corner cutting on a closed ring: rounds off the grid's small kinks
const chaikin = r => { const o = []; for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length];
  o.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]); } return o; };
function drawIslands(nodes, on, sx, sy, dim) {
  const dpr = window.devicePixelRatio || 1, m = 200;        // margin (screen px) around the view
  const sig = Math.max(9, Math.min(40, 17 * Math.sqrt(T.k / Math.max(fitK, 1e-6))));   // kernel size follows zoom
  const size = Math.round(W) + 'x' + Math.round(H) + '@' + dpr, content = [size, pOn.join(''), C.t.join()].join('|');
  const now = performance.now();
  // the soft glow under each coast doubles the drawing time: left out of the quick redraws while zooming or playing
  const glow = !PLAY.on && now - islMoved >= ISL_SETTLE;
  const key = [content, T.k.toFixed(4), sig.toFixed(1), glow].join('|');
  const panned = Math.abs(T.x - ISL.tx) > m * 0.8 || Math.abs(T.y - ISL.ty) > m * 0.8;
  const cached = ISL.img && ISL.content.startsWith(size + '|');
  // zooming or panning: scale the cached image, but refresh it every ISL_PLAY ms during a long zoom
  const moving = cached && ISL.content === content && now - islMoved < ISL_SETTLE && now - ISL.t < ISL_PLAY;
  const playing = cached && PLAY.on && now - ISL.t < ISL_PLAY;                      // history animation
  if ((ISL.key !== key || panned) && !moving && !playing) {
    ISL.key = key; ISL.content = content; ISL.tx = T.x; ISL.ty = T.y; ISL.k = T.k; ISL.m = m; ISL.t = now; ISL.dpr = dpr;
    const vw = W + 2 * m, vh = H + 2 * m;
    const off = ISL.img && ISL.img.width === Math.ceil(vw * dpr) && ISL.img.height === Math.ceil(vh * dpr)
      ? ISL.img : document.createElement('canvas');
    off.width = Math.ceil(vw * dpr); off.height = Math.ceil(vh * dpr);       // (also clears it)
    const oc = off.getContext('2d'); oc.setTransform(dpr, 0, 0, dpr, m * dpr, m * dpr); oc.lineJoin = 'round';
    // dark mode: fainter outlines and fill (bright contours look busy on a dark background)
    const dark = (s => (parseInt(s.slice(1, 3), 16) + parseInt(s.slice(3, 5), 16) + parseInt(s.slice(5, 7), 16)) / 3 < 100)(C.surface);
    const LF = dark ? 0.6 : 1, FF = dark ? 0.85 : 1;
    const g = 3, s = 1.16 * sig, s2 = 2 * s * s, reach = 3 * s, rc = Math.ceil(reach / g);   // grid cell (px), Gaussian width
    for (let k = 0; k < TOP.length; k++) {
      if (/^Unassigned/.test(TOP[k])) continue;
      const pts = [];
      for (const n of nodes) if (on(n) && P[n.id].k === k) { const x = sx(n), y = sy(n);
        if (x > -m - reach && y > -m - reach && x < W + m + reach && y < H + m + reach) pts.push([x, y]); }
      if (!pts.length) continue;
      // the topic's own grid: its bounding box plus the kernel's reach and an empty border, clipped to the image
      const x0 = Math.max(-m, Math.min(...pts.map(p => p[0])) - reach) - g, y0 = Math.max(-m, Math.min(...pts.map(p => p[1])) - reach) - g;
      const x1 = Math.min(W + m, Math.max(...pts.map(p => p[0])) + reach) + g, y1 = Math.min(H + m, Math.max(...pts.map(p => p[1])) + reach) + g;
      const gw = Math.ceil((x1 - x0) / g) + 1, gh = Math.ceil((y1 - y0) / g) + 1, F = new Float32Array(gw * gh);
      const kx = new Float32Array(2 * rc + 3);   // the Gaussian is separable: one row and one column of weights
      for (const [px, py] of pts) {
        const ci = (px - x0) / g, cj = (py - y0) / g;
        const i0 = Math.max(1, Math.floor(ci - rc)), i1 = Math.min(gw - 2, Math.ceil(ci + rc));
        for (let i = i0; i <= i1; i++) { const dx = (i - ci) * g; kx[i - i0] = Math.exp(-dx * dx / s2); }
        for (let j = Math.max(1, Math.floor(cj - rc)); j <= Math.min(gh - 2, Math.ceil(cj + rc)); j++) {
          const dy = (j - cj) * g, wy = 107 * Math.exp(-dy * dy / s2), row = j * gw;
          for (let i = i0; i <= i1; i++) F[row + i] += wy * kx[i - i0];
        }
      }
      const rgb = [1, 3, 5].map(i => parseInt(C.t[k].slice(i, i + 2), 16)).join(',');
      ISL_LEVELS.forEach((lev, li) => {
        const rings = contourRings(F, gw, gh, lev); if (!rings.length) return;
        const path = new Path2D();
        for (const r0 of rings) { const r = chaikin(chaikin(r0));
          path.moveTo(x0 + r[0][0] * g, y0 + r[0][1] * g);
          for (let q = 1; q < r.length; q++) path.lineTo(x0 + r[q][0] * g, y0 + r[q][1] * g);
          path.closePath(); }
        oc.save();
        if (li === 0 && glow) { oc.shadowColor = `rgba(${rgb},${dark ? 0.35 : 0.28})`; oc.shadowBlur = 14 * dpr; oc.shadowOffsetY = 2 * dpr; }
        oc.fillStyle = `rgba(${rgb},${FF * (li === 0 ? 0.12 : 0.075)})`; oc.fill(path, 'evenodd');
        oc.restore();
        oc.strokeStyle = `rgba(${rgb},${LF * (li === 0 ? 0.75 : 0.32 - 0.05 * li)})`;
        oc.lineWidth = li === 0 ? 1.3 : 0.8; oc.stroke(path);
      });
    }
    ISL.img = off;
  }
  // the image was drawn at zoom ISL.k with offset (ISL.tx, ISL.ty); map it to the current zoom and offset
  const r = T.k / ISL.k;
  ctx.save(); ctx.globalAlpha = dim ? 0.45 : 1; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.translate(T.x - r * ISL.tx, T.y - r * ISL.ty); ctx.scale(r, r);
  ctx.drawImage(ISL.img, -ISL.m, -ISL.m, ISL.img.width / ISL.dpr, ISL.img.height / ISL.dpr); ctx.restore();
}
function render() {
  if (FLAT[S.view]) return;
  readColors();
  const lay = layout(), { nodes, links, labels } = lay;
  if (lay.is3d) project(lay);
  const rad = n => n.r * (n.s || 1);
  ctx.clearRect(0, 0, W, H); ctx.fillStyle = C.surface; ctx.fillRect(0, 0, W, H);
  const F = focusSets(), isP = S.view !== 'coauthors';
  const on = n => isP ? pOn[n.id] : aOn[n.id];
  const hot = n => !F || (isP ? F.papers.has(n.id) : F.authors.has(n.id));
  const sx = n => T.applyX(n.x), sy = n => T.applyY(n.y);
  // edges
  if (links.length) {
    // thin hairlines; opacity/width follow collaboration strength and depth, drawn in 10 buckets
    const NB = 10, paths = Array.from({ length: NB }, () => new Path2D());
    for (const l of links) { const a = l.source, b = l.target; if (!on(a) || !on(b) || (l.papers && !l.papers.some(j => pOn[j])) || (l.self && !S.selfc)) continue;
      const v = (0.05 + 0.55 * Math.min(1, l.w)) * ((a.fog ?? 1) + (b.fog ?? 1)) / 2, q = Math.min(NB - 1, Math.floor(v / 0.06));
      paths[q].moveTo(sx(a), sy(a)); paths[q].lineTo(sx(b), sy(b)); }
    ctx.strokeStyle = C.edgeHi;
    paths.forEach((p, q) => { ctx.globalAlpha = (q + 0.5) * 0.06 * (F ? 0.35 : 1); ctx.lineWidth = 0.4 + q * 0.12; ctx.stroke(p); });
    ctx.globalAlpha = 1;
  }
  if (links.length) {
    if (F) {
      ctx.strokeStyle = C.edgeHi; ctx.fillStyle = C.edgeHi;
      for (const l of links) { const a = l.source, b = l.target;
        const lit = isP ? (F.f.kind === 'p' ? (l.s === F.f.i || l.t === F.f.i) : (F.papers.has(l.s) && F.papers.has(l.t)))
                        : (F.f.kind === 'a' ? (l.s === F.f.i || l.t === F.f.i) : (F.authors.has(l.s) && F.authors.has(l.t)));
        if (!lit || (l.self && !S.selfc)) continue;
        const x1 = sx(a), y1 = sy(a), x2 = sx(b), y2 = sy(b);
        ctx.lineWidth = isP ? 1.4 : Math.min(4, 0.8 + 0.6 * l.papers.length);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        if (isP) { // arrowhead at the cited paper
          const ang = Math.atan2(y2 - y1, x2 - x1), rr = rad(b) + 2, ax = x2 - Math.cos(ang) * rr, ay = y2 - Math.sin(ang) * rr;
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax - 7 * Math.cos(ang - 0.4), ay - 7 * Math.sin(ang - 0.4));
          ctx.lineTo(ax - 7 * Math.cos(ang + 0.4), ay - 7 * Math.sin(ang + 0.4)); ctx.closePath(); ctx.fill(); }
      }
    }
  }
  // 2D topic map colored by topic: draw each topic as an island (filled density region with a contour)
  const islands = lay.glow && !lay.is3d && S.colorBy === 'topic';
  if (islands) drawIslands(nodes, on, sx, sy, !!F);
  // otherwise: faint colored glow behind each paper so topic areas show at a glance
  if (lay.glow && !islands) {
    const gr = Math.max(18, Math.min(60, 26 * Math.sqrt(T.k)));
    for (const n of nodes) {
      if (!on(n)) continue;
      const x = sx(n), y = sy(n); if (x < -gr || y < -gr || x > W + gr || y > H + gr) continue;
      const g = ctx.createRadialGradient(x, y, 0, x, y, gr);
      g.addColorStop(0, colorOf(n, true).fill); g.addColorStop(1, 'transparent');
      ctx.globalAlpha = (F ? 0.05 : 0.15) * (lay.is3d ? n.fog : 1); ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, gr, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // nodes: dimmed first, then emphasised on top
  const order = nodes.slice().sort(lay.is3d
    ? (a, b) => (F ? (on(a) && hot(a)) - (on(b) && hot(b)) : 0) || b.dz - a.dz
    : (a, b) => (on(a) && hot(a)) - (on(b) && hot(b)) || b.r - a.r);
  for (const n of order) {
    const x = sx(n), y = sy(n); if (x < -30 || y < -30 || x > W + 30 || y > H + 30) continue;
    const col = colorOf(n, isP), lit = on(n) && hot(n);
    ctx.globalAlpha = (!on(n) ? 0.08 : lit ? 1 : 0.22) * (lay.is3d && lit && !F ? n.fog : 1);
    ctx.beginPath(); ctx.arc(x, y, rad(n), 0, 6.2832); ctx.fillStyle = col.fill; ctx.fill();
    if (col.ring) { ctx.lineWidth = 2; ctx.strokeStyle = col.ring; ctx.beginPath(); ctx.arc(x, y, rad(n) + 1.5, 0, 6.2832); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, rad(n), 0, 6.2832); }
    ctx.lineWidth = 1.5; ctx.strokeStyle = C.surface; ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // selection rings
  const ring = (n, w) => { ctx.beginPath(); ctx.arc(sx(n), sy(n), rad(n) + 3, 0, 6.2832); ctx.lineWidth = w; ctx.strokeStyle = C.ink; ctx.stroke(); };
  const byId = new Map(nodes.map(n => [n.id, n]));
  if (S.sel && (S.sel.kind === 'p') === isP && byId.has(S.sel.i)) ring(byId.get(S.sel.i), 2);
  if (S.hover && (S.hover.kind === 'p') === isP && byId.has(S.hover.i)) ring(byId.get(S.hover.i), 1.25);
  if (PLAY.flash !== null) {   // newest paper while playing (in the co-author view: its authors)
    const ids = isP ? [PLAY.flash] : P[PLAY.flash].au;
    ids.forEach(id => { const n = byId.get(id); if (!n) return;
      ctx.beginPath(); ctx.arc(sx(n), sy(n), rad(n) + 5, 0, 6.2832); ctx.lineWidth = 2.5; ctx.strokeStyle = C.accent; ctx.stroke(); });
  }
  // labels
  ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const boxes = [];
  const hits = b => boxes.some(o => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0);
  // place a label unless it collides with one already placed; `tries` lists vertical nudges to attempt
  // a name on the map; skipped if it would overlap one already drawn (unless forced: the selected item).
  // pill: on a translucent rounded background, readable over dense dots and lines (networks); otherwise a
  // thin halo (the topic-map region names)
  const label = (txt, x, y, font, align, tries, force, pill, inside) => {
    ctx.font = font; ctx.textAlign = align || 'center';
    const w = ctx.measureText(txt).width, h = 15;
    if (inside && align !== 'left') x = keepOnScreen(x, w, W);   // keep the whole name on screen
    for (const dy of tries || [0]) {
      const x0 = align === 'left' ? x : x - w / 2, b = { x0: x0 - 3, x1: x0 + w + 3, y0: y + dy - h / 2, y1: y + dy + h / 2 };
      if (!force && hits(b)) continue;
      boxes.push(b);
      if (pill) {
        ctx.save(); ctx.globalAlpha = 0.86; ctx.fillStyle = C.surface; ctx.beginPath();
        ctx.roundRect(x0 - 4, y + dy - h / 2 - 1, w + 8, h + 2, 4); ctx.fill(); ctx.restore();
      } else { ctx.lineWidth = 4; ctx.strokeStyle = C.surface; ctx.strokeText(txt, x, y + dy); }
      ctx.fillStyle = C.ink; ctx.fillText(txt, x, y + dy); return;
    }
  };
  const fB = css('--f-body');
  // on phones the topic names only fit once zoomed in a little
  if (S.view === 'topics' && !F && !(W < 600 && T.k < 2.5 * fitK)) {
    const regionStyle = !lay.is3d && S.colorBy === 'topic';   // atlas islands: names styled like map regions
    if (regionStyle) ctx.letterSpacing = '0.06em';
    labels.forEach(l => { if (S.on.has(l.k) && !(W < 600 && (T.applyX(l.x) < 0 || T.applyX(l.x) > W))) label(regionStyle ? l.name.toUpperCase() : l.name, T.applyX(l.x), T.applyY(l.y) - 24,
      (regionStyle ? '700 11px ' : '600 13px ') + fB, 'center', [0, -16, 16, -32, 32, -48, 48, -64, 64], false, false, true); });
    ctx.letterSpacing = '0px';
  }
  if (S.view === 'coauthors') {
    // at rest: the most prolific authors (10 at the starting zoom, more as you zoom in); overlapping labels are skipped
    const nLab = Math.min(80, Math.round(10 * Math.max(1, T.k / fitK) ** 2));
    let cand = nodes.filter(n => aOn[n.id] && (!F || F.authors.has(n.id)))
      .sort((a, b) => (F && b.id === F.f.i) - (F && a.id === F.f.i) || AU[b.id].papers.length - AU[a.id].papers.length);
    if (!F) cand = cand.slice(0, nLab);
    cand.forEach(n => label(AU[n.id].name, sx(n) + rad(n) + 4, sy(n), (F && F.f.kind === 'a' && F.f.i === n.id ? '600 ' : '500 ') + '11.5px ' + fB, 'left', [0, -12, 12], F && n.id === F.f.i, true));
  }
  if (S.view === 'citations' && lay.unlinked) {
    const n = lay.unlinked.ids.filter(i => pOn[i]).length;
    if (n) {   // centred over the grid; a shorter wording when the full one does not fit (phones)
      ctx.font = '500 11.5px ' + fB; ctx.textAlign = 'center'; ctx.fillStyle = C.muted;
      const what = `${n} paper${n === 1 ? '' : 's'} without reference data`;
      let txt = `${what} in ADS or Semantic Scholar (mostly theses and very recent papers)`;
      if (ctx.measureText(txt).width > W - 24) txt = what;
      const x = Math.min(W - 12 - ctx.measureText(txt).width / 2, Math.max(12 + ctx.measureText(txt).width / 2, T.applyX(lay.unlinked.x)));
      ctx.fillText(txt, x, T.applyY(lay.unlinked.y) - 6);
    }
  }
  if (S.view === 'citations' && F && F.f.kind === 'p') {
    const cand = nodes.filter(n => n.id === F.f.i || (T.k > 1.6 && F.papers.has(n.id))).sort((a, b) => (b.id === F.f.i) - (a.id === F.f.i));
    cand.forEach(n => { const t = P[n.id].t; label(t.length > 48 ? t.slice(0, 46) + '…' : t, sx(n) + rad(n) + 5, sy(n), '500 11.5px ' + fB, 'left', [0], n.id === F.f.i, true); });
  }
}

// ---------- hit testing, tooltip ----------
function pick(mx, my) {
  const { nodes } = layout(), isP = S.view !== 'coauthors'; let best = null, bd = 1e9;
  for (const n of nodes) { if (!(isP ? pOn[n.id] : aOn[n.id])) continue;
    const d = Math.hypot(T.applyX(n.x) - mx, T.applyY(n.y) - my); if (d < n.r * (n.s || 1) + 5 && d < bd) { bd = d; best = n; } }
  return best ? { kind: isP ? 'p' : 'a', i: best.id } : null;
}
const tip = $('tip');
function hideTip() { tip.hidden = true; }
function showTip(h, mx, my) {
  if (h.kind === 'p') { const p = P[h.i], a = p.au.map(x => AU[x].name);
    tip.innerHTML = `${esc(p.t)}${p.nw ? ' <span class="newb">New</span>' : ''}<small>${esc(TOP[p.k])}</small><small>${p.y} · ${esc(a[0] || '')}${a.length > 1 ? ' et al.' : ''} · ${p.cs === 2 ? 'citations unknown' : p.c + ' citations'}${S.view === 'citations' ? ` · cited by ${p.citers.length} ${NAME} papers, ${p.citersInd.length} without shared authors` : ''}</small>`; }
  else { const a = AU[h.i]; tip.innerHTML = `${esc(a.name)}<small>${a.papers.length} ${NAME} paper${a.papers.length > 1 ? 's' : ''}</small>`; }
  tip.hidden = false; const tw = tip.offsetWidth, th = tip.offsetHeight;
  tip.style.left = Math.min(W - tw - 8, mx + 14) + 'px'; tip.style.top = (my + th + 20 > H ? my - th - 12 : my + 14) + 'px';
}
cv.addEventListener('pointermove', e => {
  if (e.buttons) return; const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, h = pick(mx, my);
  const same = (h && S.hover && h.kind === S.hover.kind && h.i === S.hover.i) || (!h && !S.hover);
  S.hover = h; cv.classList.toggle('hovering', !!h); if (h) showTip(h, mx, my); else hideTip(); if (!same) draw();
});
cv.addEventListener('pointerleave', () => { S.hover = null; hideTip(); draw(); });
// 3D view: drag rotates (wheel/pinch zoom above), arrow keys rotate, gentle auto-spin
let rot = null, dragged = false;
cv.addEventListener('pointerdown', e => {
  dragged = false; if (e.button) return;
  rot = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY }; cv.setPointerCapture(e.pointerId);
});
cv.addEventListener('pointermove', e => {
  if (!rot || !e.buttons) return;
  if (pointers.size > 1) { rot.x = e.clientX; rot.y = e.clientY; dragged = true; return; }
  if (S.dim === 2) { cancelAnimationFrame(zAnim); zTarget = null; userMoved = true; T.x += e.clientX - rot.x; T.y += e.clientY - rot.y; }
  else { CAM.yaw += (e.clientX - rot.x) * 0.008; CAM.pitch = Math.max(-1.45, Math.min(1.45, CAM.pitch + (e.clientY - rot.y) * 0.008)); }
  rot.x = e.clientX; rot.y = e.clientY; if (Math.hypot(e.clientX - rot.x0, e.clientY - rot.y0) > 4) dragged = true;
  hideTip(); draw();
});
const endRot = () => { rot = null; };
cv.addEventListener('pointerup', endRot); cv.addEventListener('pointercancel', endRot);
cv.addEventListener('keydown', e => {
  const m = { ArrowLeft: [-0.12, 0], ArrowRight: [0.12, 0], ArrowUp: [0, -0.12], ArrowDown: [0, 0.12] }[e.key]; if (!m) return;
  e.preventDefault();
  if (S.dim === 2) { T.x -= m[0] * 300; T.y -= m[1] * 300; } else { CAM.yaw += m[0]; CAM.pitch = Math.max(-1.45, Math.min(1.45, CAM.pitch + m[1])); }
  draw();
});
// auto-rotation pauses after 20 s without interaction and while the canvas is off-screen (saves battery);
// any click, drag, scroll, key press or pointer movement over the map restarts it
const IDLE_MS = 20000;
let lastUse = performance.now(), onScreen = true;
['pointerdown', 'wheel', 'keydown'].forEach(ev => document.addEventListener(ev, () => { lastUse = performance.now(); }, { passive: true }));
cv.addEventListener('pointermove', () => { lastUse = performance.now(); }, { passive: true });
if ('IntersectionObserver' in window) new IntersectionObserver(es => { onScreen = es[0].isIntersecting; }).observe(stage);
(function spin() {
  if (CAM.spin && !rot && !S.hover && !document.hidden && !FLAT[S.view] && S.dim === 3 && onScreen && performance.now() - lastUse < IDLE_MS) { CAM.yaw += 0.0025; render(); }
  requestAnimationFrame(spin);
})();
cv.addEventListener('click', e => { if (dragged) { dragged = false; return; } const r = cv.getBoundingClientRect(); select(pick(e.clientX - r.left, e.clientY - r.top)); });

// ---------- panel ----------
const panel = $('panel');
const dot = k => `<i style="background:var(--t${k})"></i>`;
const pItem = (j, sh) => `<li><button data-p="${j}">${dot(P[j].k)}<span class="tt">${esc(P[j].t)}${P[j].nw ? ' <span class="newb">New</span>' : ''}</span><span class="num">${P[j].y}${sh ? ' · shared author' : ''}</span></button></li>`;
const VIEWS = ['topics', 'citations', 'coauthors', 'table', 'trends'];   // also guards the address: '#__proto__' is not a view
const VIEWINFO = {
  topics: ['Each dot is a paper, laid out in 3D. Papers with similar abstracts sit close together. Nearer papers look larger and brighter.', (D.nads ? 'Total citations (NASA ADS), on a log scale' : 'Total citations (Semantic Scholar), on a log scale'), 'Topic cluster'],
  citations: [`Each dot is a paper, laid out in 3D. A line means one ${NAME} paper cites another. Select a paper to see arrows pointing to the work it cites. Nearer papers look larger and brighter.`, `Citations from other ${NAME} papers, on a log scale`, 'Topic cluster'],
  trends: [`Papers per year, split by topic, ${lo('method')} or ${lo('suite')}. Hover a bar segment for its count; click it to list those papers in the table. The search box and filters apply here too.`, `Bar height: number of papers (a paper with several ${AXL.method[1]} or ${AXL.suite[1]} counts once in each)`, `Topic, ${lo('method')} or ${lo('suite')}: see the chart legend`],
  table: ['Every paper as a row of a table. Click a column header to sort; click a row (or select it with Tab and press Enter) to see its details. The search box and filters apply here too.', 'Not used', 'Topic shown by the colored dot'],
  coauthors: [`Each dot is an author, laid out in 3D. A line joins people who wrote a ${NAME} paper together. Darker lines mean a closer collaboration: each shared paper counts more when it has fewer authors, so links from 40-author papers stay faint.${nBig ? ` Papers with more than ${CO_MAX} authors (large collaborations) count only their first ${CO_MAX} authors${OWNER >= 0 ? ` and ${NAME}` : ''}.` : ''} Nearer authors look larger and brighter.`, `Number of ${NAME} papers, on a log scale`, 'Author’s most frequent topic'],
};
const USE_TXT = 'Drag to rotate (or use the arrow keys), scroll or pinch to zoom. Rotation pauses while you hover. Click a dot for details; your selection stays highlighted when you switch views.';
const USE2 = 'Drag to pan (or use the arrow keys), scroll or pinch to zoom. Click a dot for details; your selection stays highlighted when you switch views.';
// one-line summary per view; the full explanation opens under "How to read"
const SHORT = {
  topics: 'Each dot is a paper; papers with similar abstracts sit close together.',
  citations: `Each dot is a paper; lines show which ${NAME} papers cite which.`,
  coauthors: 'Each dot is an author; lines join people who wrote a paper together.',
  table: 'All papers in a sortable table.',
  trends: `Papers per year, by topic, ${lo('method')} or ${lo('suite')}.`,
};
const USE_TR = 'Hover a segment for its count; click it to see those papers in the table.';
const USE = { topics: USE_TXT, citations: USE_TXT, coauthors: USE_TXT, trends: USE_TR };
function overview() {
  let [what, size, color] = VIEWINFO[S.view];
  if (!FLAT[S.view] && S.colorBy !== 'topic') color = { year: S.view === 'coauthors' ? `Year of first ${NAME} paper` : 'Year of first appearance (light = early, dark = recent)', method: S.view === 'coauthors' ? `Most frequent ${lo('method')}` : `${AXL.method[0]} tag (ring: a second ${lo('method')})`, suite: S.view === 'coauthors' ? `Most frequent ${lo('suite')}` : `${AXL.suite[0]} tag (ring: a second ${lo('suite')})` }[S.colorBy];
  if (S.dim === 2) what = what.replace(', laid out in 3D', '').replace(/ Nearer (papers|authors) look larger and brighter\./, '');
  if (S.view === 'citations' && !S.selfc) size += `, not counting papers that share an author${OWNER >= 0 ? ` other than ${D.proj.owner}` : ''} (self-citations hidden)`;
  let list = '';
  if (FLAT[S.view]) {
    panel.innerHTML = `<details class="howto"${S.helpOpen ? ' open' : ''}><summary><span>${SHORT[S.view]}</span> <span class="more">ⓘ How to read</span></summary><p>${what}</p></details><p>${nShown} of ${P.length} papers shown.</p>`;
    panel.querySelector('.howto').addEventListener('toggle', e => { S.helpOpen = e.target.open; });
    return;
  }
  if (S.view === 'coauthors') {
    const all = AU.filter(a => aOn[a.i]).sort((a, b) => b.papers.length - a.papers.length || a.name.localeCompare(b.name));
    const top = all.slice(0, S.nTop[S.view]), left = all.length - top.length;
    list = `<div><h3>Most frequent authors <span style="text-transform:none;letter-spacing:0;font-weight:400">· ${top.length} of ${all.length}</span></h3><ul class="list">${top.map((a, r) => `<li><button data-a="${a.i}">${dot(a.topic)}<span class="tt">${r + 1}. ${esc(a.name)}</span><span class="num">${a.papers.length} paper${a.papers.length > 1 ? 's' : ''}</span></button></li>`).join('')}</ul>
      ${left > 0 ? `<div style="display:flex;gap:8px;margin-top:8px"><button class="ghost" data-more="25">Show ${Math.min(25, left)} more</button><button class="ghost" data-more="all">Show all ${all.length}</button></div>` : ''}</div>`;
  } else {
    const key = S.view === 'citations' ? citeCount : p => p.c;
    const all = P.filter(p => pOn[p.i]).sort((a, b) => key(b) - key(a) || b.d.localeCompare(a.d));
    const top = all.slice(0, S.nTop[S.view]), left = all.length - top.length;
    list = `<div><h3>${S.view === 'citations' ? (S.selfc ? `Most cited within ${NAME}` : `Most cited within ${NAME}, no self-citations`) : (D.nads ? 'Most cited overall (ADS)' : 'Most cited overall')} <span style="text-transform:none;letter-spacing:0;font-weight:400">· ${top.length} of ${all.length}</span></h3><ul class="list">${top.map((p, r) =>
      `<li><button data-p="${p.i}">${dot(p.k)}<span class="tt">${r + 1}. ${esc(p.t)}</span><span class="num">${key(p)}</span></button></li>`).join('')}</ul>
      ${left > 0 ? `<div style="display:flex;gap:8px;margin-top:8px"><button class="ghost" data-more="25">Show ${Math.min(25, left)} more</button><button class="ghost" data-more="all">Show all ${all.length}</button></div>` : ''}</div>`;
  }
  panel.innerHTML = `<details class="howto"${S.helpOpen ? ' open' : ''}><summary><span>${SHORT[S.view]}</span> <span class="more">ⓘ How to read</span></summary>
    <p>${what}</p>
    <div class="how"><div><b>Size</b><span>${size}</span></div><div><b>Color</b><span>${color}</span></div>
    <div><b>Use</b><span>${S.dim === 2 && !FLAT[S.view] ? USE2 : USE[S.view]}</span></div></div></details>${list}`;
  panel.querySelector('.howto').addEventListener('toggle', e => { S.helpOpen = e.target.open; });
}
function tagBlock(p) {
  if (!p.tg) return '<div><h3>Tags</h3><p>Not tagged yet.</p></div>';
  const row = (label, ax) => p.tg[ax].length ? `<div class="tagrow"><span class="tagax">${label}</span><span class="names">${p.tg[ax].map(t =>
    `<span class="tag${p.tg.u.includes(t) ? ' unsure' : ''}"${p.tg.u.includes(t) ? ' title="Uncertain: not clearly stated in the abstract"' : ''}>${esc(t)}${p.tg.u.includes(t) ? ' ?' : ''}</span>`).join('')}</span></div>` : '';
  return `<div><h3>Tags</h3>${row(AXL.suite[0], 's')}${row(AXL.data[0], 'd')}${row(AXL.method[0], 'm')}${p.tg.n ? `<p class="tagnote">${esc(p.tg.n)}</p>` : ''}</div>`;
}
const panelBar = () => `<div class="panelbar"><button class="ghost back" data-back>← Overview</button><button class="ghost" data-copy title="Copy a link to this paper or author">Copy link</button></div>`;
// pre-filled GitHub issues for corrections and missing papers
const REPO = D.proj.repo;
const newIssue = (title, body) => `${safeUrl(REPO)}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
function issueUrl(p) {
  const tg = p.tg ? `${lo('suite')}: ${p.tg.s.join(', ') || '–'}; ${lo('data')}: ${p.tg.d.join(', ') || '–'}; ${lo('method')}: ${p.tg.m.join(', ') || '–'}` : 'none';
  return newIssue(`Correction: ${p.t.slice(0, 80)}`, `**Paper:** ${p.t}\n**ID:** ${p.id}${p.url ? ` (${p.url})` : ''}\n**Current topic:** ${TOP[p.k]}\n**Current tags:** ${tg}\n\n` +
    `What is wrong?\n- [ ] Wrong topic\n- [ ] Wrong or missing tags\n- [ ] Missing or wrong citation links\n- [ ] Wrong date, authors or link\n- [ ] Other\n\nDetails (what should it be?):\n\n`);
}
const missingUrl = () => newIssue('Missing paper: ', `**Title:**\n**arXiv ID or DOI:**\n\nNote: ${D.proj.missing_note || `the atlas lists the papers on the ${LIST} (${PUBS}). If the paper is missing there too, it may need to be added to that page first.`}\n`);
// a paper's authors: the first AU_SHOWN, then a "+N more" button that lists the rest (for that paper)
const AU_SHOWN = 8; let auAll = -1;
const authorList = p => { const all = auAll === p.i || p.au.length <= AU_SHOWN + 1, list = all ? p.au : p.au.slice(0, AU_SHOWN);
  return `<div><h3>${p.au.length} author${p.au.length > 1 ? 's' : ''}</h3><div class="names">${list.map(a => `<button data-a="${a}">${esc(AU[a].name)}</button>`).join('')}${
    all ? '' : `<button class="more" data-allau="${p.i}" aria-label="Show all ${p.au.length} authors">+${p.au.length - AU_SHOWN} more</button>`}</div></div>`; };
function paperPanel(i) {
  const p = P[i];
  const venue = p.v && p.v !== p.lk ? `<span>${esc(p.v)}</span>` : '';
  panel.innerHTML = `${panelBar()}
    <div class="eyebrow">${dot(p.k)}${esc(TOP[p.k])}${p.nw ? ' <span class="newb">New</span>' : ''}</div>
    <h2>${esc(p.t)}</h2>
    <div class="meta">${safeUrl(p.url) ? `<a href="${esc(safeUrl(p.url))}" target="_blank" rel="noopener">${esc(p.lk)}</a>` : `<span>${esc(p.lk)}</span>`}<span>${p.dq ? esc(p.y) + ' (estimated from list position)' : esc(p.d)}</span>${venue}${p.bib ? `<a href="https://ui.adsabs.harvard.edu/abs/${encodeURIComponent(p.bib)}/abstract" target="_blank" rel="noopener">${p.c} citations (ADS)</a>` : `<span>${p.cs === 2 ? 'Citations unknown' : p.c + ' citations (Semantic Scholar)'}</span>`}</div>
    ${tagBlock(p)}
    <div><h3>Abstract</h3>${p.ab && p.abx ? `<p class="abstract">${esc(p.ab)} … <a href="https://ui.adsabs.harvard.edu/abs/${encodeURIComponent(p.bib)}/abstract" target="_blank" rel="noopener">Read the full abstract on ADS</a></p>` : p.ab ? `<p class="abstract">${esc(p.ab)}</p>` : '<p>No abstract available. Use the link above to read the full text.</p>'}</div>
    ${authorList(p)}
    ${p.sim && p.sim.l.length ? `<div><h3>Most similar papers <span style="text-transform:none;letter-spacing:0;font-weight:400">· by ${p.sim.k === 'e' ? 'abstract embedding (1 = identical)' : 'shared words (no embedding available)'}</span></h3><ul class="list">${p.sim.l.map(([j, s]) =>
      `<li><button data-p="${j}">${dot(P[j].k)}<span class="tt">${esc(P[j].t)}</span><span class="num">${s.toFixed(3)}</span></button></li>`).join('')}</ul></div>` : ''}
    <div><h3>${p.rm && !p.r.length ? 'Cites' : `Cites ${p.r.length} ${NAME} paper${p.r.length === 1 ? '' : 's'}`}</h3>${p.rm ? `<p class="tagnote">${p.r.length ? 'This list may be incomplete: ' : ''}The reference list of this ${p.lk && /thesis|project/i.test(p.lk) ? 'work' : 'paper'} is not yet available from ADS or Semantic Scholar${p.r.length ? '.' : `, so the ${NAME} papers it cites are unknown.`}</p>` : ''}${p.r.length ? `<ul class="list">${p.r.slice().sort((a, b) => P[b].d.localeCompare(P[a].d)).map(j => pItem(j, shares(j, p.i))).join('')}</ul>` : (p.rm ? '' : '<p>None found.</p>')}</div>
    <div><h3>Cited by ${p.citers.length} ${NAME} paper${p.citers.length === 1 ? '' : 's'}${p.citers.length ? `, ${p.citersInd.length} without shared authors` : ''}</h3>${p.citers.length ? `<ul class="list">${p.citers.slice().sort((a, b) => P[b].d.localeCompare(P[a].d)).map(j => pItem(j, shares(j, p.i))).join('')}</ul>` : '<p>None yet.</p>'}</div>
    <p class="reportlink"><a href="${esc(issueUrl(p))}" target="_blank" rel="noopener">Report a problem with this paper</a></p>`;
}
function authorPanel(i) {
  const a = AU[i], co = new Map();
  a.papers.forEach(j => P[j].au.forEach(b => { if (b !== i) co.set(b, (co.get(b) || 0) + 1); }));
  const top = [...co].sort((x, y) => y[1] - x[1] || AU[x[0]].name.localeCompare(AU[y[0]].name)).slice(0, 12);
  const bars = a.tc.map((c, k) => c ? `<i title="${esc(TOP[k])}: ${c}" style="flex:${c};background:var(--t${k})"></i>` : '').join('');
  const tl = a.tc.map((c, k) => c ? `<span>${dot(k)} ${esc(TOP[k])} <span class="num">${c}</span></span>` : '').filter(Boolean);
  panel.innerHTML = `${panelBar()}
    <div class="eyebrow">Author</div><h2>${esc(a.name)}</h2>
    <div class="meta"><span>${a.papers.length} ${NAME} paper${a.papers.length > 1 ? 's' : ''}</span><span>${co.size} co-authors</span></div>
    <div><h3>Topics</h3><div class="bars">${bars}</div><div class="how" style="margin-top:8px">${tl.map(t => `<div style="grid-template-columns:1fr;gap:0" class="eyebrow">${t}</div>`).join('')}</div></div>
    ${top.length ? `<div><h3>Frequent co-authors</h3><div class="names">${top.map(([b, n]) => `<button data-a="${b}">${esc(AU[b].name)} · ${n}</button>`).join('')}</div></div>` : ''}
    <div><h3>Papers</h3><ul class="list">${a.papers.slice().sort((x, y) => P[y].d.localeCompare(P[x].d)).map(pItem).join('')}</ul></div>`;
}
function renderPanel() { if (!S.sel) overview(); else if (S.sel.kind === 'p') paperPanel(S.sel.i); else authorPanel(S.sel.i); panel.scrollTop = 0; }
panel.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.allau !== undefined) {   // "+N more" authors: list them all, focus the first newly shown one
    const y = panel.scrollTop; auAll = +b.dataset.allau; renderPanel(); panel.scrollTop = y;
    const nb = panel.querySelectorAll('.names button[data-a]')[AU_SHOWN]; if (nb) nb.focus({ preventScroll: true }); return;
  }
  if (b.dataset.copy !== undefined) {
    track('atlas_copy_link', { kind: S.sel ? S.sel.kind : '' });
    const done = ok => { b.textContent = ok ? 'Copied ✓' : 'Copy failed'; setTimeout(() => { b.textContent = 'Copy link'; }, 1600); };
    const url = location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(() => done(true), () => done(false));
    else done(false);
    return;
  }
  if (b.dataset.more) {   // after re-rendering, focus the first newly shown paper (the button itself is gone)
    const y = panel.scrollTop, before = panel.querySelectorAll('ul.list button').length;
    S.nTop[S.view] = b.dataset.more === 'all' ? 1e9 : S.nTop[S.view] + 25; overview(); panel.scrollTop = y;
    const first = panel.querySelectorAll('ul.list button')[before]; if (first) first.focus({ preventScroll: true });
  }
  else if (b.dataset.back !== undefined) select(null);
  else if (b.dataset.p) select({ kind: 'p', i: +b.dataset.p });
  else if (b.dataset.a) select({ kind: 'a', i: +b.dataset.a });
});
// the side panel can be collapsed on wide screens (remembered in this browser); selecting something opens it
let panelOpen = true;
try { panelOpen = localStorage.getItem('atlasPanel') !== '0'; } catch (e) {}
function setPanel(open) {
  panelOpen = open; document.body.classList.toggle('nopanel', !open);
  const t = $('paneltab'); t.textContent = open ? '›' : '‹'; t.setAttribute('aria-expanded', open);
  t.title = t.ariaLabel = open ? 'Hide the side panel' : 'Show the side panel';
  try { localStorage.setItem('atlasPanel', open ? '1' : '0'); } catch (e) {}
}
$('paneltab').addEventListener('click', () => setPanel(!panelOpen));
setPanel(panelOpen);
function select(s) { if (s && !panelOpen && !narrow()) setPanel(true); S.sel = s; renderPanel(); draw(); if (S.view === 'table') markTableSelection(); tapCard(); writeHash(true); }
// narrow screens: the details panel is below the map, so show a small card on the map after a tap
const narrow = () => matchMedia('(max-width: 880px)').matches;
function tapCard() {
  const c = $('tapcard');
  if (!S.sel || !narrow() || FLAT[S.view]) { c.hidden = true; return; }
  $('tapcard-t').textContent = S.sel.kind === 'p' ? P[S.sel.i].t : AU[S.sel.i].name + ' · ' + AU[S.sel.i].papers.length + ' papers';
  c.hidden = false;
}
$('tapcard-go').addEventListener('click', () => { panel.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); });
$('tapcard-x').addEventListener('click', () => { $('tapcard').hidden = true; });

// ---------- table view (accessible alternative to the canvas views)
const tableMethods = p => (p.tg ? p.tg.m : []).filter(m => m !== 'No ML');
const COLS = [
  { k: 't', label: 'Title', v: p => p.t, show: p => esc(p.t) + (p.nw ? ' <span class="newb">New</span>' : ''), cls: 'tt', html: true },
  { k: 'a', label: 'First author', v: p => p.au.length ? AU[p.au[0]].name : '', show: p => { const n = p.au.length ? AU[p.au[0]].name : '';
      return `<span title="${esc(n)}${p.au.length > 1 ? ` + ${p.au.length - 1} more` : ''}">${esc(n)}</span>`; }, cls: 'sm one', html: true },
  { k: 'y', label: 'Year', v: p => p.d, show: p => p.dq ? p.y + '*' : p.y, cls: 'num' },
  { k: 'k', label: 'Topic', v: p => TOP[p.k], show: p => `<span title="${esc(TOP[p.k])}"><i style="background:var(--t${p.k})"></i>${esc((D.topicsShort || TOP)[p.k])}</span>`, cls: 'sm tp', html: true },
  // methods as small tags; "No ML" (the absence of a method) is left out here (it stays in filters, panel, downloads)
  { k: 'm', label: AXL.method[1][0].toUpperCase() + AXL.method[1].slice(1), v: p => tableMethods(p).join(', '), show: p => tableMethods(p).map(m => `<span class="mtag">${esc(m)}</span>`).join(''), cls: 'sm mt', html: true },
  { k: 'c', label: 'Citations', v: p => p.cs === 2 ? -1 : p.c, show: p => p.cs === 2 ? '–' : p.c, cls: 'num', num: true },
  { k: 'ci', label: `In ${NAME}`, v: p => citeCount(p), cls: 'num', num: true },
];
S.sort = { k: 'c', dir: -1 };
function renderTable() {
  const nRows = P.filter(p => pOn[p.i]).length;
  $('tcap').textContent = `${nRows} of ${P.length} papers${S.sort.k === 'rel' ? ', best search matches first' : ''} · click a header to sort · “In ${NAME}” = citations from other ${NAME} papers; * year estimated`;
  const rel = S.sort.k === 'rel';
  const col = rel ? { v: p => S.score[p.i] || 0 } : COLS.find(c => c.k === S.sort.k);
  const rows = P.filter(p => pOn[p.i]).sort((a, b) => {
    const x = col.v(a), y = col.v(b);
    return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y))) * S.sort.dir || b.c - a.c;
  });
  const head = COLS.map(c => `<th scope="col" aria-sort="${c.k === S.sort.k ? (S.sort.dir > 0 ? 'ascending' : 'descending') : 'none'}"><button data-sort="${c.k}">${c.label}</button></th>`).join('');
  const body = rows.map(p => `<tr tabindex="0" data-p="${p.i}" aria-selected="${!!(S.sel && S.sel.kind === 'p' && S.sel.i === p.i)}">${COLS.map(c => {
    const val = c.show ? c.show(p) : c.v(p);
    return `<td class="${c.cls}">${c.html ? val : esc(val)}</td>`; }).join('')}</tr>`).join('');
  $('tablewrap').innerHTML = `<table class="ptable"><caption class="sr">${rows.length} of ${P.length} papers</caption><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}
function markTableSelection() {
  document.querySelectorAll('#tablewrap tbody tr').forEach(tr => tr.setAttribute('aria-selected', !!(S.sel && S.sel.kind === 'p' && S.sel.i === +tr.dataset.p)));
}
$('tablewrap').addEventListener('click', e => {
  const b = e.target.closest('button[data-sort]');
  if (b) { const k = b.dataset.sort; S.sort = { k, dir: S.sort.k === k ? -S.sort.dir : (COLS.find(c => c.k === k).num ? -1 : 1) }; renderTable();
    const nb = document.querySelector(`#tablewrap button[data-sort="${k}"]`); if (nb) nb.focus(); return; }
  const tr = e.target.closest('tr[data-p]'); if (tr) select({ kind: 'p', i: +tr.dataset.p });
});
$('tablewrap').addEventListener('keydown', e => {
  const tr = e.target.closest('tr[data-p]'); if (!tr) return;
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select({ kind: 'p', i: +tr.dataset.p }); }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const n = e.key === 'ArrowDown' ? tr.nextElementSibling : tr.previousElementSibling; if (n) n.focus(); }
});

// ---------- controls ----------
let lastTracked = null;
function setView(v, animate) {
  if (FLAT[v]) stopPlay();   // the history animation is for the maps
  if (v !== lastTracked) { if (lastTracked) track('atlas_view', { view: v }); lastTracked = v; }
  S.view = v; CAM.snap = true; ['topics', 'citations', 'coauthors', 'table', 'trends'].forEach(x => $('m-' + x).setAttribute('aria-pressed', x === v));
  $('selfwrap').hidden = v !== 'citations'; $('cbwrap').hidden = !!FLAT[v]; $('spinrow').hidden = S.dim === 2; spinBtn();
  const flat = !!FLAT[v];
  cv.hidden = flat; $('note').hidden = flat; document.querySelector('.zoom').hidden = flat;
  $('tablewrap').hidden = v !== 'table'; $('tablebar').hidden = v !== 'table'; $('trendswrap').hidden = v !== 'trends';
  if (v === 'table') renderTable();
  if (v === 'trends') renderTrends();
  cv.tabIndex = 0;
  $('note').textContent = noteText(v);
  writeHash(false);
  S.hover = null; hideTip(); userMoved = false; fit(animate); if (!S.sel) overview(); draw(); updateStats(); tapCard(); colorKey();
}
document.querySelectorAll('.modes button').forEach(b => b.addEventListener('click', () => setView(b.dataset.view, true)));
// Back/Forward and edited addresses fire popstate and/or hashchange (often both): apply each address once
let lastHash = null;
const onNav = () => { if (location.hash !== lastHash) applyHash(); };
window.addEventListener('hashchange', onNav);
window.addEventListener('popstate', onNav);
const legend = $('legend');
function renderLegend() {
  legend.innerHTML = TOP.map((t, k) => !P.some(p => p.k === k) ? '' : `<button class="chip" data-k="${k}" aria-pressed="${S.on.has(k)}"><i style="background:var(--t${k})"></i>${esc(t)} <span class="n">${P.filter(p => p.k === k).length}</span></button>`).join('');
  const nNew = P.filter(p => p.nw).length;
  if (nNew) legend.insertAdjacentHTML('afterbegin', `<button class="chip" data-new aria-pressed="${S.newOnly}" title="Papers added to the site in the last 30 days"><i style="background:var(--accent)"></i>New <span class="n">${nNew}</span></button>`);
}
// update the chips in place (not renderLegend): the clicked button stays in the page and keeps the focus
const syncLegend = () => legend.querySelectorAll('.chip').forEach(b =>
  b.setAttribute('aria-pressed', b.dataset.new !== undefined ? S.newOnly : S.on.has(+b.dataset.k)));
legend.addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  if (b.dataset.new !== undefined) { S.newOnly = !S.newOnly; syncLegend(); refresh(); return; } const k = +b.dataset.k;
  if (e.altKey || e.metaKey) { S.on = new Set([k]); } else if (S.on.has(k)) S.on.delete(k); else S.on.add(k);
  syncLegend(); refresh(); });
[$('y0'), $('y1')].forEach((sel, n) => { sel.innerHTML = years.map(y => `<option ${y === (n ? S.y1 : S.y0) ? 'selected' : ''}>${y}</option>`).join('');
  sel.addEventListener('change', () => { S.y0 = +$('y0').value; S.y1 = +$('y1').value; if (S.y0 > S.y1) { [S.y0, S.y1] = [S.y1, S.y0]; $('y0').value = S.y0; $('y1').value = S.y1; } refresh(); }); });
let qt; $('q').addEventListener('input', e => { clearTimeout(qt); qt = setTimeout(() => {
  const had = !!S.q.trim(); S.q = e.target.value; const has = !!S.q.trim();
  if (has && !had && S.sort.k === 'c') S.sort = { k: 'rel', dir: -1 };          // searching: best matches first
  if (!has && S.sort.k === 'rel') S.sort = { k: 'c', dir: -1 };
  refresh(); }, 120); });
$('q').addEventListener('keydown', e => { if (e.key === 'Escape' && e.target.value) { e.target.value = ''; e.target.dispatchEvent(new Event('input')); } });
document.addEventListener('keydown', e => {   // "/" jumps to the search box
  if (e.key === '/' && !e.ctrlKey && !e.metaKey && !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || '')) && !e.target.isContentEditable) {
    e.preventDefault(); $('q').focus(); $('q').select();
  }
});
['method', 'suite'].forEach(a => { $('colorby').querySelector(`option[value="${a}"]`).textContent = AXL[a][0]; });
const dispSum = () => { $('dispsum').textContent = `· ${S.dim}D${S.colorBy !== 'topic' ? ' · ' + { year: 'Year', method: AXL.method[0], suite: AXL.suite[0] }[S.colorBy] : ''}`; };
// ---------- pop-ups (Display menu, Filters panel, Download menu) ----------
// The button toggles its pop-up (closing the others); a click outside it or Escape closes it. "Outside" uses
// composedPath() (the path at dispatch time), so a click on a button that a handler has since removed from
// the page (re-rendered chips) still counts as inside.
const POPUPS = [];
function popup(btn, box, inside) {
  const set = open => { $(box).hidden = !open; $(btn).setAttribute('aria-expanded', open); };
  const me = { set, inside };
  POPUPS.push(me);
  $(btn).addEventListener('click', e => { e.stopPropagation(); POPUPS.forEach(p => { if (p !== me) p.set(false); }); set($(box).hidden); });
  return set;
}
document.addEventListener('click', e => {
  const path = e.composedPath().filter(n => n.nodeType === 1);
  POPUPS.forEach(p => { if (!path.some(n => n.matches(p.inside))) p.set(false); });
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') POPUPS.forEach(p => p.set(false)); });
const dispMenu = popup('dispbtn', 'dispmenu', '.dispwrap');
$('colorby').addEventListener('change', e => { S.colorBy = e.target.value; dispSum(); track('atlas_color_by', { by: S.colorBy }); colorKey(); if (!S.sel) overview(); draw(); writeHash(false); });
const noteText = v => (v === 'topics' ? (S.dim === 2 ? 'Layout: 2D t-SNE of SPECTER2 abstract embeddings · axes have no units'
    : 'Layout: each paper pulled toward its 4 most similar papers (SPECTER2) · axes have no units')
  : v === 'citations' ? citeNote().replace(' · drag to rotate', '') : `${nBig ? AU.filter(a => D.co['1'][a.i]).length : AU.length} authors · ${EM.size} co-author pairs${nBig ? ` · ${nBig} paper${nBig > 1 ? 's' : ''} with over ${CO_MAX} authors: first ${CO_MAX} counted` : ''}`)
  + (S.dim === 3 ? ' · drag to rotate' : ' · drag to pan');
function setDim(d) {
  if (S.dim === d) return;
  if (!applying) track('atlas_dim', { dim: d + 'D' });
  S.dim = d;
  $('d2').setAttribute('aria-pressed', d === 2); $('d3').setAttribute('aria-pressed', d === 3);
  $('spinrow').hidden = d === 2; dispSum(); CAM.snap = true;
  $('note').textContent = noteText(S.view); S.hover = null; hideTip(); userMoved = false; fit(false); if (!S.sel) overview(); draw();
  writeHash(false);
}
$('d2').addEventListener('click', () => setDim(2));
$('d3').addEventListener('click', () => setDim(3));
$('selfc').addEventListener('change', e => {
  S.selfc = e.target.checked;
  Object.keys(L).filter(k => k.startsWith('citations')).forEach(k => L[k].nodes.forEach(n => { n.r = dotR(citeCount(P[n.id]), 2.6); }));
  $('note').textContent = noteText('citations'); refresh(); if (S.sel) renderPanel();
});
$('reset').addEventListener('click', () => { S.q = ''; $('q').value = ''; S.y0 = years[0]; S.y1 = years[years.length - 1]; $('y0').value = S.y0; $('y1').value = S.y1;
  S.on = new Set(TOP.map((_, k) => k)); S.tag = { s: '', d: '', m: '' }; S.newOnly = false; ['suite', 'data', 'method'].forEach(a => { $('f-' + a).value = ''; });
  renderLegend(); refresh(); });
// tag filters: one dropdown per axis, with paper counts
[['suite', 's'], ['data', 'd'], ['method', 'm']].forEach(([axis, ax]) => {
  document.querySelector(`label[for="f-${axis}"]`).textContent = AXL[axis][0];
  const sel = $('f-' + axis), names = { suite: `All ${AXL.suite[1]}`, data: `All ${AXL.data[1]}`, method: `All ${AXL.method[1]}` };
  const n = t => P.filter(p => p.tg && p.tg[ax].includes(t)).length;
  sel.innerHTML = `<option value="">${names[axis]}</option>` + (D.tagaxes ? D.tagaxes[axis] : []).filter(n)
    .map(t => `<option value="${esc(t)}">${esc(t)} (${n(t)})</option>`).join('');
  sel.addEventListener('change', () => { S.tag[ax] = sel.value; refresh(); });
});
$('zin').addEventListener('click', () => { userMoved = true; zoomAt(1.5, W / 2, H / 2, 200); });
$('zout').addEventListener('click', () => { userMoved = true; zoomAt(1 / 1.5, W / 2, H / 2, 200); });
$('zfit').addEventListener('click', () => { userMoved = false; fit(true, true); });
const spinBtn = () => { const b = $('zspin'); b.textContent = CAM.spin ? 'Pause' : 'Resume'; b.setAttribute('aria-label', CAM.spin ? 'Pause rotation' : 'Resume rotation'); b.setAttribute('aria-pressed', CAM.spin); };
$('zspin').addEventListener('click', () => { CAM.spin = !CAM.spin; spinBtn(); });
function updateStats() {
  const filtered = nShown < P.length;
  $('stats').innerHTML = `<b>${filtered ? nShown + ' of ' : ''}${P.length}</b> papers · <b>${AU.length}</b> authors · <b>${CE.length}</b> citation links · ${years[0]}–${years[years.length - 1]}`;
}
function refresh() { applyFilters(); updateStats(); renderActive(); if (!S.sel) overview(); if (S.view === 'table') renderTable(); if (S.view === 'trends') renderTrends(); draw(); writeHash(false); }
const nSelf = CE.filter(e => e.self).length;
$('foot').innerHTML = `Data as of ${esc(D.fetched)} · <button class="linkbtn" id="aboutbtn" type="button">About &amp; data sources</button> · <a href="${esc(missingUrl())}" target="_blank" rel="noopener">Suggest a missing paper</a> · <a href="${esc(safeUrl(REPO))}" target="_blank" rel="noopener">Source on GitHub</a>`;
$('about-body').innerHTML = `
  <h3>What this is</h3>
  <p>Every entry on the <a href="${esc(safeUrl(PUBS))}" target="_blank" rel="noopener">${esc(LIST)}</a> (${P.length} papers and theses), shown as a topic map, a citation network, a co-author network and a table. The site is rebuilt automatically twice a month.</p>
  <h3>Data sources</h3>
  <ul>
    <li><b>Titles, abstracts, authors, dates:</b> arXiv; for entries without an arXiv ID, NASA ADS or the publications page itself. Theses without a known date get a year estimated from their position in the list (marked as estimated).</li>
    <li><b>Citation counts:</b> ${D.nads ? 'NASA ADS (Semantic Scholar where ADS has no record)' : 'Semantic Scholar'}.</li>
    <li><b>Citation links between ${NAME} papers:</b> ${D.refsrc && D.refsrc.ads ? `Semantic Scholar and NASA ADS reference lists combined; a link counts if either has it (${D.refsrc.both} in both, ${D.refsrc.s2} only in Semantic Scholar, ${D.refsrc.ads} only in ADS)` : 'Semantic Scholar reference lists'}. Papers whose reference lists are in neither database say so in their panel.</li>
    <li><b>Abstract embeddings:</b> SPECTER2, from Semantic Scholar.</li>
  </ul>
  <h3>How it is made</h3>
  <ul>
    <li><b>Topics:</b> k-means clusters of the embeddings, named by hand. New papers join the nearest topic, or "Unassigned" if they fit none.</li>
    <li><b>Topic map:</b> in 2D, a t-SNE projection of the embeddings; in 3D, each paper pulled toward its 4 most similar papers. Positions are kept fixed as papers are added.</li>
    <li><b>Most similar papers:</b> cosine similarity of the embeddings (word similarity for papers without one).</li>
    <li><b>Tags</b> (${lo('suite')}, ${lo('data')}, ${lo('method')}): assigned with AI assistance from each abstract and not all checked by hand; dashed tags marked "?" are uncertain.</li>
    <li><b>Self-citations:</b> a citation between papers that share at least one author${OWNER >= 0 ? ` other than ${esc(D.proj.owner)}` : ''} (${nSelf} of ${CE.length} links); they can be hidden in the citation view.</li>
    <li><b>Co-author links:</b> darker for closer collaborations; each shared paper counts 1/(number of authors − 1).</li>
  </ul>
  <p>Corrections are welcome: see the <a href="${esc(safeUrl(REPO))}" target="_blank" rel="noopener">GitHub repository</a>.</p>`;
const about = $('about');
$('aboutbtn').addEventListener('click', () => { if (about.showModal) about.showModal(); else about.setAttribute('open', ''); });
$('about-x').addEventListener('click', () => about.close ? about.close() : about.removeAttribute('open'));
about.addEventListener('click', e => { if (e.target === about) about.close(); });

// ---------- trends view: papers per year, stacked by topic, method or suite ----------
const TR = { by: 'topic', share: false };   // share: each year as 100%
function trendSeries() {
  if (TR.by === 'topic') return TOP.map((name, k) => ({ label: name, color: `var(--t${k})`, match: p => p.k === k,
    apply: () => { S.on = new Set([k]); renderLegend(); } })).filter(s => P.some(s.match));
  const axis = TR.by, { names, small, neutral, slot, ax } = CB[axis];   // same colours and "Other" as Color by
  const s = [...names, ...neutral].map(tg => ({ label: tg, color: `var(--t${slot(tg)})`, match: p => !!(p.tg && p.tg[ax].includes(tg)),
    apply: () => { S.tag[ax] = tg; $('f-' + axis).value = tg; } }));
  if (small.length) s.push({ label: 'Other (' + small.join(', ') + ')', color: 'var(--t10)',
    match: p => !!(p.tg && small.some(tg => p.tg[ax].includes(tg))), apply: null });
  return s;
}
function renderTrends() {
  const wrap = $('trendswrap'); if (wrap.hidden) return;
  const series = trendSeries(), yrs = years.filter(y => y >= S.y0 && y <= S.y1);
  const nowY = +String(D.fetched).slice(0, 4);
  const cnt = yrs.map(y => series.map(s => P.filter(p => pOn[p.i] && p.y === y && s.match(p)).length));
  const tot = yrs.map(y => P.filter(p => pOn[p.i] && p.y === y).length);
  const ww = Math.max(320, wrap.clientWidth - 40), hh = Math.max(220, Math.min(420, wrap.clientHeight - 190));
  const ml = 40, mr = 8, mt = 22, mb = 26, iw = ww - ml - mr, ih = hh - mt - mb;
  // Share: each segment as a fraction of its year's segments (for topics that is the year's papers)
  const sums = cnt.map(r => r.reduce((a, b) => a + b, 0)), val = (yi, si) => TR.share ? (sums[yi] ? cnt[yi][si] / sums[yi] : 0) : cnt[yi][si];
  const maxV = TR.share ? 1 : Math.max(1, ...sums);
  const step = TR.share ? 0.25 : [1, 2, 5, 10, 20, 25, 50, 100].find(s => maxV / s <= 6) || 200, top = TR.share ? 1 : Math.ceil(maxV / step) * step;
  const yS = v => mt + ih - v / top * ih, band = iw / Math.max(1, yrs.length), bw = Math.min(64, band * 0.62);
  let g = '';
  for (let v = 0; v <= top + 1e-9; v += step) g += `<line x1="${ml}" x2="${ww - mr}" y1="${yS(v)}" y2="${yS(v)}" class="tgrid"/><text x="${ml - 6}" y="${yS(v) + 4}" text-anchor="end" class="tax">${TR.share ? Math.round(v * 100) + '%' : v}</text>`;
  let bars = '';
  yrs.forEach((y, yi) => {
    const x = ml + yi * band + (band - bw) / 2; let acc = 0;
    const partial = y === nowY ? ' partial' : '';   // the current year is not over: drawn faded
    series.forEach((s, si) => {
      const v = val(yi, si); if (!v) return;
      const y1 = yS(acc + v), y0 = yS(acc); acc += v;
      bars += `<rect x="${x}" y="${y1}" width="${bw}" height="${Math.max(1, y0 - y1 - 2)}" rx="2" fill="${s.color}" data-y="${y}" data-s="${si}" data-v="${cnt[yi][si]}" data-pct="${sums[yi] ? Math.round(100 * cnt[yi][si] / sums[yi]) : 0}" class="tseg${partial}"/>`;
    });
    bars += `<text x="${x + bw / 2}" y="${yS(acc) - 6}" text-anchor="middle" class="ttot">${tot[yi]}</text>`;
    bars += `<text x="${x + bw / 2}" y="${hh - 8}" text-anchor="middle" class="tax">${y}${y === nowY ? ' (to date)' : ''}</text>`;
  });
  const opts = ['topic', 'method', 'suite'].map(b => `<button type="button" data-by="${b}" aria-pressed="${TR.by === b}">${b === 'topic' ? 'Topic' : AXL[b][0]}</button>`).join('');
  const modes = [['0', 'Counts'], ['1', 'Share']].map(([v, l]) => `<button type="button" data-share="${v}" aria-pressed="${TR.share === (v === '1')}">${l}</button>`).join('');
  // the legend lists the series top to bottom, as they are stacked
  const legend = series.map((s, si) => [s, si]).reverse().map(([s, si]) => { const n = cnt.reduce((a, r) => a + r[si], 0);
    return n ? `<span class="tleg"><i style="background:${s.color}"></i>${esc(s.label)} <span class="n">${n}</span></span>` : ''; }).join('');
  wrap.innerHTML = `<div class="trhead"><h3>Papers per year${TR.share ? ' (share)' : ''}</h3><div class="trbtns"><div class="dimtoggle" role="group" aria-label="Counts or share">${modes}</div><div class="dimtoggle" role="group" aria-label="Split by">${opts}</div></div></div>
    <svg width="${ww}" height="${hh}" viewBox="0 0 ${ww} ${hh}" role="img" aria-label="Stacked bar chart of papers per year by ${TR.by}">${g}${bars}</svg>
    <div class="tlegend">${legend}</div>
    <p class="tnote">Numbers above the bars count papers${TR.by !== 'topic' ? `; a paper with several ${AXL[TR.by][1]} appears in each of its segments` : ''}. ${yrs.includes(nowY) ? nowY + ' is partial (data as of ' + D.fetched + '). ' : ''}Click a segment to list those papers.</p>`;
  wrap._series = series;
}
$('trendswrap').addEventListener('click', e => {
  const b = e.target.closest('button[data-by]');
  if (b) { TR.by = b.dataset.by; renderTrends(); const nb = $('trendswrap').querySelector(`button[data-by="${TR.by}"]`); if (nb) nb.focus(); return; }
  const m = e.target.closest('button[data-share]');
  if (m) { TR.share = m.dataset.share === '1'; renderTrends(); const nb = $('trendswrap').querySelector(`button[data-share="${m.dataset.share}"]`); if (nb) nb.focus(); return; }
  const r = e.target.closest('rect.tseg'); if (!r) return;
  const s = $('trendswrap')._series[+r.dataset.s], y = +r.dataset.y;
  if (!s.apply) return;
  s.apply(); S.y0 = S.y1 = y; $('y0').value = y; $('y1').value = y; hideTip();
  applyFilters(); setView('table', false); refresh();
});
$('trendswrap').addEventListener('mousemove', e => {
  const r = e.target.closest('rect.tseg'); if (!r) { hideTip(); return; }
  const s = $('trendswrap')._series[+r.dataset.s], box = stage.getBoundingClientRect();
  tip.innerHTML = `${esc(s.label)}<small>${r.dataset.y}: ${r.dataset.v} paper${r.dataset.v === '1' ? '' : 's'} (${r.dataset.pct}% of the year)${s.apply ? ' · click to list them' : ''}</small>`;
  tip.hidden = false; tip.style.left = Math.min(box.width - tip.offsetWidth - 8, e.clientX - box.left + 14) + 'px'; tip.style.top = (e.clientY - box.top + 14) + 'px';
});
$('trendswrap').addEventListener('mouseleave', hideTip);

// ---------- filters panel and active-filter chips ----------
function renderActive() {
  const shown = TOP.filter((_, k) => P.some(p => p.k === k)).length, onN = [...S.on].filter(k => P.some(p => p.k === k)).length;
  const chips = [];
  if (S.y0 !== years[0] || S.y1 !== years[years.length - 1]) chips.push(['years', S.y0 === S.y1 ? `${S.y0}` : `${S.y0}–${S.y1}`]);
  if (onN < shown) chips.push(['topics', onN === 1 ? `Topic: ${(D.topicsShort || TOP)[[...S.on][0]]}` : `Topics: ${onN} of ${shown}`]);
  [['s', AXL.suite[0]], ['d', AXL.data[0]], ['m', AXL.method[0]]].forEach(([ax, l]) => { if (S.tag[ax]) chips.push([ax, `${l}: ${S.tag[ax]}`]); });
  if (S.newOnly) chips.push(['new', 'New papers']);
  $('active').innerHTML = chips.map(([k, l]) => `<button class="achip" data-clear="${k}" title="Remove this filter">${esc(l)} <span aria-hidden="true">×</span></button>`).join('');
  const n = chips.filter(c => c[0] !== 'years').length;
  $('fcount').textContent = n ? `· ${n}` : '';
  document.body.classList.toggle('nofilter', !chips.length && !S.q.trim());   // phones hide "Clear filters" then
}
$('active').addEventListener('click', e => {
  const b = e.target.closest('[data-clear]'); if (!b) return;
  const k = b.dataset.clear;
  if (k === 'years') { S.y0 = years[0]; S.y1 = years[years.length - 1]; $('y0').value = S.y0; $('y1').value = S.y1; }
  else if (k === 'topics') { S.on = new Set(TOP.map((_, i) => i)); renderLegend(); }
  else if (k === 'new') { S.newOnly = false; renderLegend(); }
  else { S.tag[k] = ''; $('f-' + { s: 'suite', d: 'data', m: 'method' }[k]).value = ''; }
  refresh();
});
const fPanel = popup('fbtn', 'fpanel', '#fpanel, #fbtn');

// ---------- export the papers currently shown ----------
function shownPapers() { return P.filter(p => pOn[p.i]).sort((a, b) => b.d.localeCompare(a.d)); }
function bibtex(list) {
  const used = new Set();
  const tex = s => String(s).replace(/([&%$#_])/g, '\\$1').replace(/\^/g, '\\textasciicircum{}').replace(/~/g, '\\textasciitilde{}');
  const lastFirst = n => { const w = n.trim().split(/\s+/); return w.length < 2 ? n : `${w[w.length - 1]}, ${w.slice(0, -1).join(' ')}`; };
  return list.map(p => {
    const first = p.au.length ? AU[p.au[0]].name.trim().split(/\s+/).pop() : 'anon';
    const word = (p.t.match(/[A-Za-z]{3,}/) || ['paper'])[0];
    let key = (first.normalize('NFKD').replace(/[^A-Za-z]/g, '') || 'anon') + p.y + word.toLowerCase(), k = key, n = 1;
    while (used.has(k)) k = key + String.fromCharCode(96 + n++);
    used.add(k);
    const ax = /^\d{4}\.\d{4,5}$/.test(p.id) ? p.id : '';
    const journal = p.v && !/arxiv/i.test(p.v) ? p.v : '';
    const f = [['title', `{${/[\\$]/.test(p.tRaw) ? p.tRaw.replace(/(^|[^\\])([&%#])/g, '$1\\$2') : tex(p.t)}}`], ['author', p.au.map(a => tex(lastFirst(AU[a].name))).join(' and ')], ['year', p.y],
      journal && ['journal', tex(journal)], p.doi && ['doi', p.doi], ax && ['eprint', ax], ax && ['archivePrefix', 'arXiv'],
      p.bib && ['adsurl', `https://ui.adsabs.harvard.edu/abs/${p.bib}`], ['url', p.url || (ax ? `https://arxiv.org/abs/${ax}` : '')]]
      .filter(x => x && x[1] !== '' && x[1] !== undefined);
    return `@${journal ? 'article' : 'misc'}{${k},\n` + f.map(([a, b]) => `  ${a} = {${b}}`).join(',\n') + '\n}';
  }).join('\n\n') + '\n';
}
function csv(list) {
  const q = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const head = ['title', 'authors', 'year', 'date', 'topic', 'suites', 'data', 'methods', 'citations', 'citation_source', `cited_in_${NAME.toLowerCase()}`, 'arxiv', 'doi', 'ads_bibcode', 'url'];
  const rows = list.map(p => [p.t, p.au.map(a => AU[a].name).join('; '), p.y, p.d, TOP[p.k], p.tg ? p.tg.s.join('; ') : '', p.tg ? p.tg.d.join('; ') : '',
    p.tg ? p.tg.m.join('; ') : '', p.cs === 2 ? '' : p.c, ['ADS', 'Semantic Scholar', 'unknown'][p.cs], p.citers.length,
    /^\d{4}\.\d{4,5}$/.test(p.id) ? p.id : '', p.doi || '', p.bib || '', p.url || '']);
  return [head, ...rows].map(r => r.map(q).join(',')).join('\n') + '\n';
}
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
const dlMenu = popup('dlbtn', 'dlmenu', '#dlwrap');
document.addEventListener('click', e => {
  if (e.target.closest('.reportlink a')) track('atlas_report_problem');
  if (e.target.closest('#foot a[href*="issues/new"]')) track('atlas_suggest_paper'); });
$('dlmenu').addEventListener('click', e => {
  const b = e.target.closest('button[data-dl]'); if (!b) return;
  const list = shownPapers(), stamp = String(D.fetched);
  track('atlas_download', { format: b.dataset.dl, papers: list.length });
  if (b.dataset.dl === 'bib') download(`${NAME.toLowerCase()}-papers-${stamp}.bib`, bibtex(list), 'application/x-bibtex');
  else download(`${NAME.toLowerCase()}-papers-${stamp}.csv`, '﻿' + csv(list), 'text/csv');
  dlMenu(false);
});

// ---------- play history: papers appear one by one in date order ----------
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const sortKey = p => p.d.length >= 7 ? p.d.slice(0, 10) : p.d.slice(0, 4) + '-07';   // year-only dates go mid-year
const playOrder = P.slice().sort((a, b) => sortKey(a).localeCompare(sortKey(b)) || a.i - b.i);
playOrder.forEach((p, r) => { p.rank = r; });
function stopPlay() {
  if (!PLAY.on) return;
  PLAY.on = false; clearTimeout(PLAY.timer); PLAY.upto = null; PLAY.flash = null;
  $('play').setAttribute('aria-pressed', 'false'); $('play').textContent = '▶'; $('play').title = 'Play the history: papers appear one by one in date order'; $('playyear').hidden = true;
  refresh();
}
function startPlay() {
  if (FLAT[S.view]) setView('topics', false);
  PLAY.on = true;
  $('play').setAttribute('aria-pressed', 'true'); $('play').textContent = '■'; $('play').title = 'Stop';
  // only the papers that pass the current filters take part, in date order
  PLAY.upto = Infinity; applyFilters();
  const seq = playOrder.filter(p => pOn[p.i]);
  PLAY.upto = -1;
  const dt = Math.max(40, Math.min(250, PLAY.total / Math.max(1, seq.length)));
  let i = 0;
  const step = () => {
    if (!PLAY.on) return;
    if (i >= seq.length) { PLAY.flash = null; draw(); PLAY.timer = setTimeout(() => stopPlay(), 1500); return; }
    const p = seq[i];
    PLAY.upto = p.rank; PLAY.flash = p.i; refresh();
    const k = sortKey(p), py = $('playyear');
    py.innerHTML = `${p.d.length >= 7 ? MON[+k.slice(5, 7) - 1] + ' ' : ''}${k.slice(0, 4)}<small>${i + 1} of ${seq.length} papers</small>`;
    py.hidden = false;
    i++; PLAY.timer = setTimeout(step, dt);
  };
  step();
}
$('play').addEventListener('click', e => { e.stopPropagation(); if (!PLAY.on) track('atlas_play', { view: S.view }); PLAY.on ? stopPlay() : startPlay(); });
// The animation plays the papers that passed the filters when it started, so any change to the filters
// (search, years, topics, tags, New, the active-filter chips, Clear filters) stops it, as does a click on
// the map. Capture phase: it stops before the control's own handler refreshes the page.
cv.addEventListener('pointerdown', () => stopPlay());
document.addEventListener('input', e => { if (e.target.closest('#q, #fpanel')) stopPlay(); }, true);
document.addEventListener('change', e => { if (e.target.closest('#y0, #y1, #fpanel')) stopPlay(); }, true);
document.addEventListener('click', e => { if (e.target.closest('#fpanel, #active, #reset')) stopPlay(); }, true);

// ---------- usage events for Google Analytics (public site only; no-op when gtag is absent) ----------
const track = (name, params) => { try { if (window.gtag) window.gtag('event', name, params || {}); } catch (e) {} };

// ---------- shareable links ----------
// On the public site the address holds the view, the selected paper/author, the filters and 2D/3D,
// e.g. #citations&paper=2201.02202&years=2022-2024.
let applying = false, viewInit = false;
function stateHash() {
  const q = new URLSearchParams();
  if (S.sel) { if (S.sel.kind === 'p') q.set('paper', P[S.sel.i].id); else q.set('author', AU[S.sel.i].name); }
  if (S.q.trim()) q.set('q', S.q.trim());
  if (S.y0 !== years[0] || S.y1 !== years[years.length - 1]) q.set('years', S.y0 + '-' + S.y1);
  if (S.on.size !== TOP.length) q.set('topics', [...S.on].sort((a, b) => a - b).join('.'));
  if (S.tag.s) q.set('suite', S.tag.s);
  if (S.tag.d) q.set('data', S.tag.d);
  if (S.tag.m) q.set('method', S.tag.m);
  if (S.dim === 3) q.set('dim', '3');
  if (!S.selfc) q.set('self', '0');
  if (S.newOnly) q.set('new', '1');
  if (S.colorBy !== 'topic') q.set('color', S.colorBy);
  const s = q.toString();
  return '#' + S.view + (s ? '&' + s : '');
}
function writeHash(push) {   // push: add a history entry (selections), else replace (filters, view)
  if (applying || PLAY.on) return;
  const h = stateHash();
  if (location.hash === h) return;
  try { if (push) history.pushState(null, '', h); else history.replaceState(null, '', h); lastHash = location.hash; } catch (e) {}
}
function applyHash() {
  lastHash = location.hash;
  stopPlay();   // another shared link, or Back/Forward
  const amp = location.hash.indexOf('&');
  const raw = amp < 0 ? location.hash.slice(1) : location.hash.slice(1, amp);
  const v = VIEWS.includes(raw) ? raw : 'topics';
  const q = new URLSearchParams(amp < 0 ? '' : location.hash.slice(amp + 1));
  applying = true;
  try {
    {
      S.q = q.get('q') || ''; $('q').value = S.q;
      const yr = (q.get('years') || '').split('-').map(Number);
      S.y0 = years.includes(yr[0]) ? yr[0] : years[0];
      S.y1 = years.includes(yr[1]) ? yr[1] : years[years.length - 1];
      if (S.y0 > S.y1) [S.y0, S.y1] = [S.y1, S.y0];   // years=2025-2020 means 2020-2025
      $('y0').value = S.y0; $('y1').value = S.y1;
      S.newOnly = q.get('new') === '1';
      S.colorBy = ['year', 'method', 'suite'].includes(q.get('color')) ? q.get('color') : 'topic'; $('colorby').value = S.colorBy; dispSum();
      S.on = q.get('topics') ? new Set(q.get('topics').split('.').map(Number).filter(k => k >= 0 && k < TOP.length)) : new Set(TOP.map((_, k) => k));
      renderLegend();
      [['suite', 's'], ['data', 'd'], ['method', 'm']].forEach(([a, ax]) => {
        const sel = $('f-' + a); sel.value = q.get(a) || ''; S.tag[ax] = sel.value;   // unknown values fall back to "All"
      });
      const sc = q.get('self') !== '0';
      if (sc !== S.selfc) { $('selfc').checked = sc; $('selfc').dispatchEvent(new Event('change')); }
      setDim(q.get('dim') === '3' ? 3 : 2);
    }
    if (!viewInit || v !== S.view) { viewInit = true; setView(v, false); }
    applyFilters(); updateStats(); renderActive();
    let sel = null;
    if (q.get('paper')) { const p = P.find(x => x.id === q.get('paper')); if (p) sel = { kind: 'p', i: p.i }; }
    if (q.get('author')) { const a = AU.find(x => x.name === q.get('author')); if (a) sel = { kind: 'a', i: a.i }; }
    select(sel);
    if (S.view === 'table') renderTable();
    if (S.view === 'trends') renderTrends();
    if (!S.sel) overview();
    draw();
  } finally { applying = false; }
}

// ---------- boot ----------
renderLegend(); applyFilters(); renderPanel();
new ResizeObserver(() => { resize(); if (!userMoved) fit(false); if (S.view === 'trends') renderTrends(); }).observe(stage);
const mq = matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener && mq.addEventListener('change', draw);
new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
applyHash(); dispSum();
document.fonts && document.fonts.ready.then(draw);
})();
