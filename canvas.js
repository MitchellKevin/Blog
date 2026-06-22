/* Canvas view: pan/zoom, minimap, collaborator cursors, present mode and
   selection. The content lives in index.html and is read from the DOM here.
   Page, tool and detail state is handled in CSS; frame positions live in
   memory only. */

const wrap = document.getElementById('canvasWrap');
const canvasEl = document.getElementById('canvas');
const SVGNS = 'http://www.w3.org/2000/svg';

let camX = 0, camY = 0, zoom = 0.78;
let isPanning = false, panStart = {x:0,y:0}, camStart = {x:0,y:0};
let currentPage = 'over', frames = [], TOTAL_W = 0, TOTAL_H = 0;
let selectedId = null;

/* tiny helpers */
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

/* page state (which page is active) */
function setActivePage(){
  currentPage = ($('input[name=page]:checked') || {}).value || 'over';
  const section = $(`.page[data-page="${currentPage}"]`);
  TOTAL_W = +section.dataset.w; TOTAL_H = +section.dataset.h;
  frames = $$('.frame', section);
  canvasEl.style.width = TOTAL_W + 'px';
  canvasEl.style.height = TOTAL_H + 'px';
  $('#fileName').textContent = 'Mitchell Scholte — ' + section.dataset.name;
  selectedId = null;
  layoutSectionLabels();
  buildMinimap();
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

/* minimap */
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

/* camera */
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

/* selection + inspector */
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

/* collaborator cursors (4 docenten, pas hun namen hier aan) */
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

/* present mode */
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

/* input */
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
});
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
  if (e.key === 'Escape') selectFrame(null);
});

window.addEventListener('resize', () => { applyTransform(); if (presenting) renderPresent(); });

/* wiring */
function wire(){
  $$('.frame').forEach(el => {
    el.addEventListener('click', e => { e.stopPropagation(); selectFrame(el.dataset.id); });
    el.addEventListener('dblclick', e => { e.stopPropagation(); if (document.getElementById('d-' + el.dataset.id)) location.hash = 'd-' + el.dataset.id; });
  });
  $$('.layer-row').forEach(row => row.addEventListener('click', () => { selectFrame(row.dataset.target); flyToFrame(row.dataset.target); }));
  $$('input[name=page]').forEach(r => r.addEventListener('change', setActivePage));
}

/* init */
wire();
setActivePage();
setupCursors();
