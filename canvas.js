/* ════════════════════════════════════════════════════════════════════════
   HTML-first canvas — JavaScript only for what HTML/CSS cannot do:
   pan/zoom, dragging, the minimap, collaborator cursors, measurement lines,
   present mode and selection. Content lives in index.html; visual state
   (pages, tabs, tools, detail) is driven by CSS. This script reads the DOM.
   State (frame positions) lives only in memory — no persistence.
   ════════════════════════════════════════════════════════════════════════ */

const wrap = document.getElementById('canvasWrap');
const canvasEl = document.getElementById('canvas');
const SVGNS = 'http://www.w3.org/2000/svg';

let camX = 0, camY = 0, zoom = 0.78;
let isPanning = false, panStart = {x:0,y:0}, camStart = {x:0,y:0};
let currentPage = 'over', frames = [], TOTAL_W = 0, TOTAL_H = 0;
let selectedId = null, justDragged = false, measure = null;

/* ───────── tiny helpers ───────── */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const activeTool = () => ($('input[name=tool]:checked') || {}).value || 'move';
const detailOpen = () => /^#d-/.test(location.hash);
function setToolRadio(v){ const r = $(`input[name=tool][value="${v}"]`); if (r) r.checked = true; }
function geo(el){ return { x:parseFloat(el.style.left)||0, y:parseFloat(el.style.top)||0, w:parseFloat(el.style.width)||0, h:parseFloat(el.style.height)||0 }; }
function accentOf(el){ return el.style.getPropertyValue('--accent').trim() || '#888'; }
function bgOf(el){ return el.style.getPropertyValue('--bg').trim() || '#1e1e1e'; }
function labelOf(el){ return el.querySelector('.frame-label')?.textContent || ''; }
function frameById(id){ return frames.find(f => f.dataset.id === id); }
function canvasToScreen(cx, cy){ return { x:camX + cx*zoom, y:camY + cy*zoom }; }

/* ───────── page state (which page is active) ───────── */
function setActivePage(){
  currentPage = ($('input[name=page]:checked') || {}).value || 'over';
  const section = $(`.page[data-page="${currentPage}"]`);
  TOTAL_W = +section.dataset.w; TOTAL_H = +section.dataset.h;
  frames = $$('.frame', section);
  canvasEl.style.width = TOTAL_W + 'px';
  canvasEl.style.height = TOTAL_H + 'px';
  $('#fileName').textContent = 'Mitchell Scholte — ' + section.dataset.name;
  selectedId = null; measure = null;
  layoutSectionLabels();
  buildMinimap();
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
  selectedId = id;
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

/* ───────── measurement lines (screen-space SVG, Alt-hover) ───────── */
function drawOverlay(){
  const svg = $('#overlaySvg'); if (!svg) return;
  svg.innerHTML = '';
  if (measure) drawMeasure(svg, measure.a, measure.b);
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
  e.stopPropagation();
  const start = { x:e.clientX, y:e.clientY }, orig = geo(el); let moved = false;
  selectFrame(el.dataset.id);
  function mv(ev){
    const dx = (ev.clientX-start.x)/zoom, dy = (ev.clientY-start.y)/zoom;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
    el.style.left = Math.round(orig.x+dx) + 'px';
    el.style.top  = Math.round(orig.y+dy) + 'px';
    el.classList.add('dragging');
    if (selectedId === el.dataset.id) showProps(el);
    buildMinimap();
  }
  function up(){
    document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
    el.classList.remove('dragging');
    if (moved){ justDragged = true; setTimeout(() => justDragged = false, 0); layoutSectionLabels(); }
  }
  document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
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
  const onCanvas = e.target === canvasEl || e.target.id === 'dot-grid' || e.target.classList.contains('page') || e.target.classList.contains('section-label');
  if (onCanvas || activeTool() === 'hand'){
    isPanning = true; wrap.classList.add('panning');
    panStart = { x:e.clientX, y:e.clientY }; camStart = { x:camX, y:camY };
    if (onCanvas) selectFrame(null);
  }
});
window.addEventListener('mouseup', () => { isPanning = false; wrap.classList.remove('panning'); });
window.addEventListener('mousemove', e => {
  if (isPanning){ camX = camStart.x + e.clientX - panStart.x; camY = camStart.y + e.clientY - panStart.y; applyTransform(); return; }
  if (e.altKey && selectedId) showMeasure(e); else hideMeasure();
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
  if (presenting){
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter'){ e.preventDefault(); presentStep(1); }
    if (e.key === 'ArrowLeft') presentStep(-1);
    if (e.key === 'Escape') stopPresent();
    return;
  }
  if (e.altKey && (e.key === 'p' || e.key === 'P')){ startPresent(); return; }
  if (e.shiftKey && e.key === '1'){ fitAll(); return; }
  if (e.key === '1') resetZoom();
  if (e.key === 'h' || e.key === 'H') setToolRadio('hand');
  if (e.key === 'v' || e.key === 'V') setToolRadio('move');
  if (e.key === 'Escape') selectFrame(null);
});

window.addEventListener('resize', () => { applyTransform(); if (presenting) renderPresent(); });

/* ───────── wiring ───────── */
function wire(){
  $$('.frame').forEach(el => {
    el.addEventListener('mousedown', e => startFrameDrag(e, el));
    el.addEventListener('click', e => { e.stopPropagation(); if (!justDragged) selectFrame(el.dataset.id); });
    el.addEventListener('dblclick', e => { e.stopPropagation(); if (document.getElementById('d-' + el.dataset.id)) location.hash = 'd-' + el.dataset.id; });
  });
  $$('.layer-row').forEach(row => row.addEventListener('click', () => { selectFrame(row.dataset.target); flyToFrame(row.dataset.target); }));
  $$('input[name=page]').forEach(r => r.addEventListener('change', setActivePage));
}

/* ───────── init ───────── */
wire();
setActivePage();
setupCursors();
