/* ════════════════════════════════════════════════════════════════════════
   HTML-first canvas — JavaScript only for what HTML/CSS cannot do:
   pan/zoom, dragging, the minimap, collaborator cursors, comments,
   prototype arrows, measurement lines, present mode and persistence.
   Content lives in index.html; visual state (pages, tabs, tools, detail)
   is driven by CSS. This script reads the DOM, it does not generate it.
   ════════════════════════════════════════════════════════════════════════ */

const wrap = document.getElementById('canvasWrap');
const canvasEl = document.getElementById('canvas');
const SVGNS = 'http://www.w3.org/2000/svg';

let camX = 0, camY = 0, zoom = 0.78;
let isPanning = false, panStart = {x:0,y:0}, camStart = {x:0,y:0};
let currentPage = 'over', frames = [], TOTAL_W = 0, TOTAL_H = 0;
let selectedId = null, selectedElt = null, justDragged = false;
let COMMENTS = {}, ELEMENTS = {}, commentSeq = 1, eltSeq = 1, openPop = null, measure = null;

/* ───────── tiny helpers ───────── */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const activeTool = () => ($('input[name=tool]:checked') || {}).value || 'move';
const protoActive = () => !!$('#itab-proto:checked');
const detailOpen = () => /^#d-/.test(location.hash);
function setToolRadio(v){ const r = $(`input[name=tool][value="${v}"]`); if (r) r.checked = true; }
function geo(el){ return { x:parseFloat(el.style.left)||0, y:parseFloat(el.style.top)||0, w:parseFloat(el.style.width)||0, h:parseFloat(el.style.height)||0 }; }
function accentOf(el){ return el.style.getPropertyValue('--accent').trim() || '#888'; }
function bgOf(el){ return el.style.getPropertyValue('--bg').trim() || '#1e1e1e'; }
function labelOf(el){ return el.querySelector('.frame-label')?.textContent || ''; }
function pageOf(el){ return el.closest('.page').dataset.page; }
function frameKey(el){ return pageOf(el) + ':' + el.dataset.id; }
function frameById(id){ return frames.find(f => f.dataset.id === id); }
function canvasToScreen(cx, cy){ return { x:camX + cx*zoom, y:camY + cy*zoom }; }
function evToCanvas(e){ const r = wrap.getBoundingClientRect(); return { x:(e.clientX-r.left-camX)/zoom, y:(e.clientY-r.top-camY)/zoom }; }

/* state (frame positions, dropped elements, comments) lives only in memory
   for the duration of the session — no localStorage is used. */

/* ───────── page state (which page is active) ───────── */
function setActivePage(){
  currentPage = ($('input[name=page]:checked') || {}).value || 'over';
  const section = $(`.page[data-page="${currentPage}"]`);
  TOTAL_W = +section.dataset.w; TOTAL_H = +section.dataset.h;
  frames = $$('.frame', section);
  canvasEl.style.width = TOTAL_W + 'px';
  canvasEl.style.height = TOTAL_H + 'px';
  $('#fileName').textContent = 'Mitchell Scholte — ' + section.dataset.name;
  selectedId = null; clearEltSelection(); closeCommentPop(); measure = null;
  layoutSectionLabels();
  buildMinimap();
  renderComments();
  drawOverlay();
  showPageProps();
  fitAll();
}
function layoutSectionLabels(){
  const section = $(`.page[data-page="${currentPage}"]`);
  $$('.section-label', section).forEach(lbl => {
    const name = lbl.dataset.section;
    let minx = Infinity, miny = Infinity;
    frames.forEach(f => { if (f.dataset.section === name){ const g = geo(f); minx = Math.min(minx, g.x); miny = Math.min(miny, g.y); } });
    if (isFinite(minx)) { lbl.style.left = minx + 'px'; lbl.style.top = (miny - 36) + 'px'; }
  });
}

/* ───────── minimap ───────── */
function buildMinimap(){
  const mm = $('#minimapFrames'); mm.innerHTML = '';
  const mmW = 150, mmH = 96, sx = mmW / TOTAL_W, sy = mmH / TOTAL_H;
  frames.forEach(f => {
    const g = geo(f), acc = accentOf(f);
    const el = document.createElement('div');
    el.className = 'minimap-frame';
    el.style.cssText = `left:${g.x*sx}px;top:${g.y*sy}px;width:${g.w*sx}px;height:${g.h*sy}px;background:${acc}33;border:0.5px solid ${acc}66`;
    mm.appendChild(el);
  });
  updateMinimap();
}
function updateMinimap(){
  const vp = $('#minimapViewport');
  const mmW = 150, mmH = 96, sx = mmW/TOTAL_W, sy = mmH/TOTAL_H;
  const vw = wrap.clientWidth/zoom, vh = wrap.clientHeight/zoom;
  const ox = -camX/zoom, oy = -camY/zoom;
  vp.style.left = Math.max(0, Math.min(mmW-2, ox*sx)) + 'px';
  vp.style.top = Math.max(0, Math.min(mmH-2, oy*sy)) + 'px';
  vp.style.width = Math.min(mmW, vw*sx) + 'px';
  vp.style.height = Math.min(mmH, vh*sy) + 'px';
}

/* ───────── camera ───────── */
function flyToFrame(id){
  const f = frameById(id); if (!f) return;
  const g = geo(f), ww = wrap.clientWidth, wh = wrap.clientHeight;
  const tz = Math.min(ww/(g.w+120), wh/(g.h+120), 1.4);
  animateTo(ww/2-(g.x+g.w/2)*tz, wh/2-(g.y+g.h/2)*tz, tz);
}
function animateTo(tx, ty, tz){
  const sx = camX, sy = camY, sz = zoom, dur = 380, start = performance.now();
  function step(now){
    const t = Math.min((now-start)/dur, 1), e = t<0.5 ? 2*t*t : -1+(4-2*t)*t;
    camX = sx+(tx-sx)*e; camY = sy+(ty-sy)*e; zoom = sz+(tz-sz)*e;
    applyTransform(); if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
function applyTransform(){
  canvasEl.style.transform = `translate(${camX}px,${camY}px) scale(${zoom})`;
  $('#zoomDisplay').textContent = Math.round(zoom*100) + '%';
  const sz = 24*zoom, dg = $('#dot-grid');
  dg.style.backgroundSize = `${sz}px ${sz}px`;
  dg.style.backgroundPosition = `${camX%sz}px ${camY%sz}px`;
  updateMinimap();
  positionComments();
  drawOverlay();
}
function fitAll(){
  const ww = wrap.clientWidth, wh = wrap.clientHeight, pad = 60;
  const tz = Math.min((ww-pad*2)/TOTAL_W, (wh-pad*2)/TOTAL_H);
  animateTo(ww/2-(TOTAL_W/2)*tz, wh/2-(TOTAL_H/2)*tz, tz);
}
function resetZoom(){ animateTo(wrap.clientWidth/2-TOTAL_W/2, wrap.clientHeight/2-TOTAL_H/2, 1); }
function zoomBy(f){
  const ww = wrap.clientWidth/2, wh = wrap.clientHeight/2;
  const nz = Math.max(0.1, Math.min(4, zoom*f));
  camX = ww-(ww-camX)*(nz/zoom); camY = wh-(wh-camY)*(nz/zoom); zoom = nz;
  applyTransform();
}

/* ───────── selection + inspector ───────── */
function selectFrame(id){
  selectedId = id; clearEltSelection();
  $$('.frame').forEach(el => el.classList.remove('selected'));
  $$('.layer-row').forEach(el => el.classList.remove('selected'));
  if (id) {
    frameById(id)?.classList.add('selected');
    $(`.layer-row[data-target="${id}"]`)?.classList.add('selected');
    showProps(frameById(id));
  } else {
    showPageProps();
  }
}
function showPageProps(){
  const name = $(`.page[data-page="${currentPage}"]`).dataset.name;
  $('#inspBody').innerHTML = `
    <div class="insp-section">
      <div class="insp-title">Pagina · ${name} <span class="add">···</span></div>
      <div class="color-row">
        <div class="swatch" style="background:#1e1e1e"></div>
        <span class="color-hex">1E1E1E</span>
        <span class="color-op">100%</span>
        <svg class="color-eye" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="2.5"/></svg>
      </div>
    </div>
    <div class="insp-section">
      <div class="insp-title">Presenteren</div>
      <button class="export-btn primary" onclick="startPresent()">▶ Start presentatie</button>
    </div>`;
}
function showProps(el){
  if (!el) { showPageProps(); return; }
  const id = el.dataset.id, g = geo(el), type = el.dataset.type || 'post';
  const bg = bgOf(el), accent = accentOf(el);
  const action = document.getElementById('d-' + id)
    ? `<a class="export-btn primary" href="#d-${id}" style="display:block;line-height:28px;text-align:center;text-decoration:none">↗ Open detailpagina</a>`
    : `<button class="export-btn" onclick="flyToFrame('${id}')">Zoom naar frame</button>`;
  $('#inspBody').innerHTML = `
    <div class="align-row">
      ${['M3 4v16','M4 3h16','M21 4v16','M3 4v16M21 4v16','M4 3h16M4 21h16','M3 4v16M12 4v16M21 4v16']
        .map(d => `<div class="align-btn"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><path d="${d}"/></svg></div>`).join('')}
    </div>
    <div class="insp-section">
      <div class="insp-title">Positie</div>
      <div class="field-grid">
        <div class="field"><span class="f-key">X</span><span class="f-val">${g.x}</span></div>
        <div class="field"><span class="f-key">Y</span><span class="f-val">${g.y}</span></div>
        <div class="field"><span class="f-key">W</span><span class="f-val">${g.w}</span></div>
        <div class="field"><span class="f-key">H</span><span class="f-val">${g.h}</span></div>
        <div class="field"><span class="f-key">∠</span><span class="f-val">0°</span></div>
        <div class="field"><span class="f-key">◠</span><span class="f-val">${type==='wip'?0:4}</span></div>
      </div>
    </div>
    <div class="insp-section">
      <div class="insp-title">Weergave</div>
      <div class="field-grid">
        <div class="field"><span class="f-key">◑</span><span class="f-val">100%</span></div>
        <div class="field"><span class="f-key">▦</span><span class="f-val">Doorgeven</span></div>
      </div>
    </div>
    <div class="insp-section">
      <div class="insp-title">Vulling <span class="add">+</span></div>
      <div class="color-row">
        <div class="swatch" style="background:${bg}"></div>
        <span class="color-hex">${bg.replace('#','')}</span>
        <span class="color-op">100%</span>
        <svg class="color-eye" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="2.5"/></svg>
      </div>
    </div>
    <div class="insp-section">
      <div class="insp-title">Selectiekleuren</div>
      <div class="color-row">
        <div class="swatch" style="background:${accent}"></div>
        <span class="color-hex">${accent.replace('#','')}</span>
        <span class="color-op">100%</span>
      </div>
    </div>
    <div class="insp-section">
      <div class="insp-title">Acties <span class="add">+</span></div>
      ${action}
    </div>`;
}

/* ───────── prototype flows + measurement (screen-space SVG) ───────── */
function drawOverlay(){
  const svg = $('#overlaySvg'); if (!svg) return;
  svg.innerHTML = '';
  if (protoActive()) drawFlows(svg);
  if (measure && !protoActive()) drawMeasure(svg, measure.a, measure.b);
}
function drawFlows(svg){
  const defs = document.createElementNS(SVGNS, 'defs');
  defs.innerHTML = '<marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#0d99ff"/></marker>';
  svg.appendChild(defs);
  for (let i = 0; i < frames.length-1; i++){
    const a = geo(frames[i]), b = geo(frames[i+1]);
    const p1 = canvasToScreen(a.x+a.w, a.y+a.h/2), p2 = canvasToScreen(b.x, b.y+b.h/2);
    const dx = Math.max(40, Math.abs(p2.x-p1.x)*0.5);
    const path = document.createElementNS(SVGNS, 'path');
    path.setAttribute('class','flow-path'); path.setAttribute('marker-end','url(#arrow)');
    path.setAttribute('d', `M${p1.x},${p1.y} C${p1.x+dx},${p1.y} ${p2.x-dx},${p2.y} ${p2.x},${p2.y}`);
    svg.appendChild(path);
    const dot = document.createElementNS(SVGNS, 'circle');
    dot.setAttribute('class','flow-dot'); dot.setAttribute('cx',p1.x); dot.setAttribute('cy',p1.y); dot.setAttribute('r',4);
    svg.appendChild(dot);
  }
  if (frames.length){
    const s = canvasToScreen(geo(frames[0]).x, geo(frames[0]).y);
    const rect = document.createElementNS(SVGNS,'rect');
    rect.setAttribute('class','flow-badge'); rect.setAttribute('x',s.x); rect.setAttribute('y',s.y-22); rect.setAttribute('width',48); rect.setAttribute('height',18); rect.setAttribute('rx',4);
    const t = document.createElementNS(SVGNS,'text');
    t.setAttribute('class','flow-badge-txt'); t.setAttribute('x',s.x+8); t.setAttribute('y',s.y-9); t.textContent='START';
    svg.appendChild(rect); svg.appendChild(t);
  }
}
function drawMeasure(svg, aEl, bEl){
  const a = geo(aEl), b = geo(bEl);
  function line(x1,y1,x2,y2){ const l = document.createElementNS(SVGNS,'line'); l.setAttribute('class','measure-line'); l.setAttribute('x1',x1); l.setAttribute('y1',y1); l.setAttribute('x2',x2); l.setAttribute('y2',y2); svg.appendChild(l); }
  function label(x,y,txt){
    const w = String(txt).length*7+12;
    const r = document.createElementNS(SVGNS,'rect'); r.setAttribute('class','measure-pill'); r.setAttribute('x',x-w/2); r.setAttribute('y',y-8); r.setAttribute('width',w); r.setAttribute('height',16); r.setAttribute('rx',3); svg.appendChild(r);
    const t = document.createElementNS(SVGNS,'text'); t.setAttribute('class','measure-txt'); t.setAttribute('x',x); t.setAttribute('y',y+4); t.setAttribute('text-anchor','middle'); t.textContent = txt; svg.appendChild(t);
  }
  let hx1, hx2, gapX = 0;
  if (b.x >= a.x+a.w){ gapX = b.x-(a.x+a.w); hx1 = a.x+a.w; hx2 = b.x; }
  else if (a.x >= b.x+b.w){ gapX = a.x-(b.x+b.w); hx1 = b.x+b.w; hx2 = a.x; }
  if (gapX > 0){ const cy = b.y+b.h/2, s1 = canvasToScreen(hx1,cy), s2 = canvasToScreen(hx2,cy); line(s1.x,s1.y,s2.x,s2.y); label((s1.x+s2.x)/2,s1.y-3,Math.round(gapX)); }
  let vy1, vy2, gapY = 0;
  if (b.y >= a.y+a.h){ gapY = b.y-(a.y+a.h); vy1 = a.y+a.h; vy2 = b.y; }
  else if (a.y >= b.y+b.h){ gapY = a.y-(b.y+b.h); vy1 = b.y+b.h; vy2 = a.y; }
  if (gapY > 0){ const cx = b.x+b.w/2, s1 = canvasToScreen(cx,vy1), s2 = canvasToScreen(cx,vy2); line(s1.x,s1.y,s2.x,s2.y); label(s1.x,(s1.y+s2.y)/2,Math.round(gapY)); }
}
function showMeasure(e){
  if (!selectedId) return;
  const fe = e.target.closest && e.target.closest('.frame');
  const id = fe ? fe.dataset.id : null;
  if (!id || id === selectedId){ hideMeasure(); return; }
  if (measure && measure.b.dataset.id === id) return;
  const a = frameById(selectedId), b = frameById(id);
  if (!a || !b) return;
  measure = { a, b }; drawOverlay();
}
function hideMeasure(){ if (measure){ measure = null; drawOverlay(); } }

/* ───────── comments ───────── */
function curComments(){ return COMMENTS[currentPage] || (COMMENTS[currentPage] = []); }
function addCommentAt(e){
  const p = evToCanvas(e);
  const c = { id:commentSeq++, x:p.x, y:p.y, text:'' };
  curComments().push(c); renderComments(); setToolRadio('move'); openCommentPop(c, true);
}
function renderComments(){
  const layer = $('#commentsLayer'); if (!layer) return;
  layer.querySelectorAll('.comment-pin').forEach(n => n.remove());
  curComments().forEach((c, i) => {
    const pin = document.createElement('div');
    pin.className = 'comment-pin'; pin.dataset.id = c.id;
    pin.innerHTML = `<svg width="28" height="28" viewBox="0 0 28 28"><path d="M5 3h18a2 2 0 012 2v12a2 2 0 01-2 2H12l-6 5v-5H5a2 2 0 01-2-2V5a2 2 0 012-2z" fill="#ffd60a"/></svg><span class="cp-num">${i+1}</span>`;
    pin.addEventListener('mousedown', ev => ev.stopPropagation());
    pin.addEventListener('click', ev => { ev.stopPropagation(); openCommentPop(c, false); });
    layer.appendChild(pin);
  });
  positionComments();
}
function positionComments(){
  const layer = $('#commentsLayer'); if (!layer) return;
  const arr = curComments();
  layer.querySelectorAll('.comment-pin').forEach(pin => {
    const c = arr.find(x => String(x.id) === pin.dataset.id); if (!c) return;
    const s = canvasToScreen(c.x, c.y); pin.style.left = s.x + 'px'; pin.style.top = s.y + 'px';
  });
  if (openPop){ const c = arr.find(x => x.id === openPop.id), pop = $('#activePop'); if (c && pop){ const s = canvasToScreen(c.x, c.y); pop.style.left = (s.x+16) + 'px'; pop.style.top = s.y + 'px'; } }
}
function openCommentPop(c, focus){
  closeCommentPop(); openPop = c;
  const pop = document.createElement('div');
  pop.className = 'comment-pop'; pop.id = 'activePop';
  pop.innerHTML = `
    <div class="cpop-head"><div class="cpop-av">MS</div><div class="cpop-name">Mitchell Scholte</div></div>
    <textarea placeholder="Schrijf een reactie…"></textarea>
    <div class="cpop-actions">
      <button class="cpop-btn ghost" data-act="del">Verwijderen</button>
      <button class="cpop-btn primary" data-act="save">Opslaan</button>
    </div>`;
  pop.querySelector('textarea').value = c.text || '';
  pop.addEventListener('mousedown', e => e.stopPropagation());
  pop.querySelector('[data-act="save"]').addEventListener('click', () => { c.text = pop.querySelector('textarea').value; closeCommentPop(); });
  pop.querySelector('[data-act="del"]').addEventListener('click', () => { const a = curComments(), i = a.indexOf(c); if (i >= 0) a.splice(i,1); closeCommentPop(); renderComments(); });
  $('#commentsLayer').appendChild(pop);
  positionComments();
  if (focus) setTimeout(() => pop.querySelector('textarea').focus(), 0);
}
function closeCommentPop(){ openPop = null; const p = $('#activePop'); if (p) p.remove(); }

/* ───────── collaborator cursors (4 docenten — pas namen hier aan) ───────── */
const COLLABS = [
  { name:'Jad',     color:'#0d99ff' },
  { name:'Cyd',     color:'#0acf83' },
  { name:'Sanne',   color:'#a259ff' },
  { name:'Vasilis', color:'#ff7262' },
];
let cursorState = [];
function setupCursors(){
  const layer = $('#cursorsLayer'); layer.innerHTML = '';
  cursorState = COLLABS.map(c => {
    const el = document.createElement('div'); el.className = 'collab-cursor';
    el.innerHTML = `<svg class="collab-pointer" width="20" height="20" viewBox="0 0 24 24"><path d="M5 3l15 7-6.5 1.8L10 19 5 3z" fill="${c.color}" stroke="#fff" stroke-width="1"/></svg><span class="collab-name" style="background:${c.color}">${c.name}</span>`;
    layer.appendChild(el);
    return { el, cx:Math.random()*TOTAL_W, cy:Math.random()*TOTAL_H, tx:Math.random()*TOTAL_W, ty:Math.random()*TOTAL_H };
  });
  setInterval(() => cursorState.forEach(s => { s.tx = Math.random()*TOTAL_W; s.ty = Math.random()*TOTAL_H; }), 2800);
  requestAnimationFrame(animCursors);
}
function animCursors(){
  cursorState.forEach(s => { s.cx += (s.tx-s.cx)*0.02; s.cy += (s.ty-s.cy)*0.02; const p = canvasToScreen(s.cx, s.cy); s.el.style.transform = `translate(${p.x}px,${p.y}px)`; });
  requestAnimationFrame(animCursors);
}

/* ───────── frame dragging ───────── */
function startFrameDrag(e, el){
  if (e.button !== 0 || activeTool() !== 'move') return;
  if (e.target.closest('.elt') || e.target.closest('.comment-pin')) return;
  e.stopPropagation();
  const start = { x:e.clientX, y:e.clientY }, orig = geo(el); let moved = false;
  selectFrame(el.dataset.id);
  function mv(ev){
    const dx = (ev.clientX-start.x)/zoom, dy = (ev.clientY-start.y)/zoom;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
    el.style.left = Math.round(orig.x+dx) + 'px';
    el.style.top  = Math.round(orig.y+dy) + 'px';
    el.classList.add('dragging');
    if (selectedId === el.dataset.id && !protoActive()) showProps(el);
    if (protoActive()) drawOverlay();
    buildMinimap();
  }
  function up(){
    document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
    el.classList.remove('dragging');
    if (moved){ justDragged = true; setTimeout(() => justDragged = false, 0); layoutSectionLabels(); }
  }
  document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
}

/* ───────── elements dragged from the palette ───────── */
const ELT_DEFAULTS = { heading:{text:'Kop'}, text:{text:'Dubbelklik om te bewerken', w:170}, button:{text:'Knop'}, shape:{w:120, h:80, color:'#3b82f6'} };
function dropElement(e, frameEl, layer){
  e.preventDefault();
  const type = e.dataTransfer.getData('text/plain'); if (!ELT_DEFAULTS[type]) return;
  const r = wrap.getBoundingClientRect();
  const cx = (e.clientX-r.left-camX)/zoom, cy = (e.clientY-r.top-camY)/zoom;
  const g = geo(frameEl), d = ELT_DEFAULTS[type], key = frameKey(frameEl);
  const el = { id:'e'+(eltSeq++), type, x:Math.round(cx-g.x), y:Math.round(cy-g.y) };
  if (d.text !== undefined) el.text = d.text;
  if (d.w) el.w = d.w; if (d.h) el.h = d.h; if (d.color) el.color = d.color;
  (ELEMENTS[key] = ELEMENTS[key] || []).push(el);
  renderFrameElements(key, layer); selectElt(key, el.id);
}
function renderFrameElements(key, layer){
  layer.innerHTML = '';
  (ELEMENTS[key] || []).forEach(el => {
    const node = document.createElement('div');
    node.className = 'elt elt-' + el.type; node.dataset.id = el.id;
    node.style.left = el.x + 'px'; node.style.top = el.y + 'px';
    if (el.w) node.style.width = el.w + 'px';
    if (el.type === 'shape'){ node.style.height = (el.h||80) + 'px'; node.style.background = el.color || '#3b82f6'; }
    else node.textContent = el.text || '';
    node.addEventListener('mousedown', ev => startEltDrag(ev, key, el, node));
    node.addEventListener('click', ev => ev.stopPropagation());
    node.addEventListener('dblclick', ev => { ev.stopPropagation(); if (el.type !== 'shape') editElt(key, el, node); });
    layer.appendChild(node);
  });
}
function selectElt(key, id){
  clearEltSelection(); selectedElt = { key, id };
  document.querySelector(`.elt[data-id="${id}"]`)?.classList.add('selected');
}
function clearEltSelection(){ if (selectedElt){ $$('.elt.selected').forEach(n => n.classList.remove('selected')); selectedElt = null; } }
function startEltDrag(e, key, el, node){
  if (e.button !== 0 || activeTool() !== 'move') return;
  if (node.getAttribute('contenteditable') === 'true') return;
  e.stopPropagation(); selectElt(key, el.id);
  const start = { x:e.clientX, y:e.clientY }, orig = { x:el.x, y:el.y }; let moved = false;
  function mv(ev){ const dx = (ev.clientX-start.x)/zoom, dy = (ev.clientY-start.y)/zoom; if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true; el.x = Math.round(orig.x+dx); el.y = Math.round(orig.y+dy); node.style.left = el.x+'px'; node.style.top = el.y+'px'; }
  function up(){ document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); }
  document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
}
function editElt(key, el, node){
  node.setAttribute('contenteditable', 'true'); node.focus();
  const sel = window.getSelection(), range = document.createRange(); range.selectNodeContents(node); sel.removeAllRanges(); sel.addRange(range);
  function done(){ node.removeAttribute('contenteditable'); el.text = node.textContent; node.removeEventListener('blur', done); }
  node.addEventListener('blur', done);
}
function deleteSelectedElt(){
  if (!selectedElt) return false;
  const { key, id } = selectedElt;
  if (ELEMENTS[key]){ ELEMENTS[key] = ELEMENTS[key].filter(x => x.id !== id); const layer = frameById(key.split(':')[1])?.querySelector('.elt-layer'); if (layer) renderFrameElements(key, layer); }
  selectedElt = null; return true;
}

/* ───────── present mode ───────── */
let presenting = false, presentIndex = 0;
function startPresent(){
  presenting = true; presentIndex = 0;
  if (selectedId){ const i = frames.findIndex(f => f.dataset.id === selectedId); if (i >= 0) presentIndex = i; }
  $('#present').classList.add('on');
  $('#presentPage').textContent = '  ·  ' + $(`.page[data-page="${currentPage}"]`).dataset.name;
  buildPresentDots(); renderPresent();
}
function stopPresent(){ presenting = false; $('#present').classList.remove('on'); }
function presentStep(d){ presentIndex = (presentIndex + d + frames.length) % frames.length; renderPresent(); }
function buildPresentDots(){
  const dots = $('#presentDots'); dots.innerHTML = '';
  frames.forEach((f, i) => {
    const dot = document.createElement('div');
    dot.className = 'present-dot' + (i === presentIndex ? ' active' : '');
    dot.addEventListener('click', () => { presentIndex = i; renderPresent(); });
    dots.appendChild(dot);
  });
}
function renderPresent(){
  const f = frames[presentIndex], g = geo(f);
  const stage = $('#presentStage'), fr = $('#presentFrame');
  const sw = stage.clientWidth, sh = stage.clientHeight;
  const scale = Math.min((sw*0.86)/g.w, (sh*0.86)/g.h);
  fr.style.width = g.w + 'px'; fr.style.height = g.h + 'px';
  fr.style.setProperty('--accent', accentOf(f));
  fr.style.setProperty('--bg', bgOf(f));
  fr.style.background = bgOf(f);
  fr.style.border = f.dataset.type === 'wip' ? `1px dashed ${accentOf(f)}44` : 'none';
  fr.style.transform = `scale(${scale})`;
  fr.innerHTML = f.querySelector('.frame-inner').innerHTML;
  $('#presentName').textContent = labelOf(f);
  $('#presentCount').textContent = (presentIndex+1) + ' / ' + frames.length;
  $$('.present-dot').forEach((d, i) => d.classList.toggle('active', i === presentIndex));
}

/* ───────── input ───────── */
wrap.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  if (activeTool() === 'comment'){ addCommentAt(e); return; }
  const onCanvas = e.target === canvasEl || e.target.id === 'dot-grid' || e.target.classList.contains('page') || e.target.classList.contains('section-label');
  if (onCanvas || activeTool() === 'hand'){
    isPanning = true; wrap.classList.add('panning');
    panStart = { x:e.clientX, y:e.clientY }; camStart = { x:camX, y:camY };
    if (onCanvas){ selectFrame(null); closeCommentPop(); }
  }
});
window.addEventListener('mouseup', () => { isPanning = false; wrap.classList.remove('panning'); });
window.addEventListener('mousemove', e => {
  if (isPanning){ camX = camStart.x + e.clientX - panStart.x; camY = camStart.y + e.clientY - panStart.y; applyTransform(); return; }
  if (e.altKey && selectedId && !protoActive()) showMeasure(e); else hideMeasure();
});
window.addEventListener('keyup', e => { if (e.key === 'Alt') hideMeasure(); });
wrap.addEventListener('wheel', e => {
  e.preventDefault();
  const r = wrap.getBoundingClientRect(), mx = e.clientX-r.left, my = e.clientY-r.top;
  const f = e.deltaY < 0 ? 1.09 : 0.92, nz = Math.max(0.1, Math.min(4, zoom*f));
  camX = mx-(mx-camX)*(nz/zoom); camY = my-(my-camY)*(nz/zoom); zoom = nz;
  applyTransform();
}, { passive:false });

window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable){ if (e.key === 'Escape') e.target.blur(); return; }
  if (detailOpen()){ if (e.key === 'Escape') location.hash = ''; return; }
  if ((e.key === 'Delete' || e.key === 'Backspace') && deleteSelectedElt()){ e.preventDefault(); return; }
  if (presenting){
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter'){ e.preventDefault(); presentStep(1); }
    if (e.key === 'ArrowLeft') presentStep(-1);
    if (e.key === 'Escape') stopPresent();
    return;
  }
  if (e.altKey && (e.key === 'p' || e.key === 'P')){ startPresent(); return; }
  if (e.shiftKey && e.key === '1'){ fitAll(); return; }
  if (e.key === '1') resetZoom();
  if (e.key === 'f' || e.key === 'F') setToolRadio('frame');
  if (e.key === 'h' || e.key === 'H') setToolRadio('hand');
  if (e.key === 'v' || e.key === 'V') setToolRadio('move');
  if (e.key === 't' || e.key === 'T') setToolRadio('text');
  if (e.key === 'r' || e.key === 'R') setToolRadio('shape');
  if (e.key === 'p' || e.key === 'P') setToolRadio('pen');
  if (e.key === 'k' || e.key === 'K') setToolRadio('scale');
  if (e.key === 'c' || e.key === 'C') setToolRadio('comment');
  if (e.key === 'Escape'){ closeCommentPop(); selectFrame(null); }
});

window.addEventListener('resize', () => { applyTransform(); if (presenting) renderPresent(); });

/* ───────── wiring ───────── */
function wire(){
  $$('.frame').forEach(el => {
    el.addEventListener('mousedown', e => startFrameDrag(e, el));
    el.addEventListener('click', e => { e.stopPropagation(); if (!justDragged && activeTool() !== 'comment') selectFrame(el.dataset.id); });
    el.addEventListener('dblclick', e => { e.stopPropagation(); if (document.getElementById('d-' + el.dataset.id)) location.hash = 'd-' + el.dataset.id; });
    el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drop-target'); });
    el.addEventListener('dragleave', () => el.classList.remove('drop-target'));
    el.addEventListener('drop', e => { el.classList.remove('drop-target'); dropElement(e, el, el.querySelector('.elt-layer')); });
  });
  $$('.layer-row').forEach(row => row.addEventListener('click', () => { selectFrame(row.dataset.target); flyToFrame(row.dataset.target); }));
  $$('.palette-item').forEach(it => it.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', it.dataset.elt); e.dataTransfer.effectAllowed = 'copy'; }));
  $$('input[name=page]').forEach(r => r.addEventListener('change', setActivePage));
  $$('input[name=itab]').forEach(r => r.addEventListener('change', drawOverlay));
}

/* ───────── init ───────── */
wire();
setActivePage();
setupCursors();
