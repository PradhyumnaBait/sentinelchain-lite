/* ═══════════════════════════════════════════════════
   SENTINELCHAIN LITE — Full Stability Patch (Phase 6)
   Parts 1–13: safeRun, setState, sanitize, fallback,
   calculateRisk, lockButton, invalidateSize, etc.
═══════════════════════════════════════════════════ */

/* ══ PART 1 — GLOBAL SAFETY WRAPPER ══════════════ */
window.safeRun = function(fn) {
  try { fn(); } catch(e) { console.error('[SCL] SAFE ERROR:', e); }
};

/* ══ PART 3 — STATE ═══════════════════════════════ */
const state = { routes:[], selectedRoute:null, analysis:null, loading:false, analyzed:false };
function setState(update) { Object.assign(state, update); }

/* ══ PART 7 — SANITIZATION ═══════════════════════ */
function clamp(v) { return Math.max(0, Math.min(100, Number(v) || 0)); }

function sanitizeRoute(route) {
  return {
    ...route,
    weather:      clamp(route.weather),
    congestion:   clamp(route.congestion),
    geopolitical: clamp(route.geopolitical),
    piracy:       clamp(route.piracy),
    riskScore:    clamp(route.riskScore || 0)
  };
}

/* ══ PART 8 — RISK ENGINE (reads localStorage weights) ═ */
function getSettings() {
  try { return JSON.parse(localStorage.getItem('scl-settings') || '{}'); } catch(_) { return {}; }
}
function calculateRisk(r) {
  const s = getSettings();
  const w = { weather: clamp(s.weather||25)/100, congestion: clamp(s.congestion||25)/100,
              geopolitical: clamp(s.geopolitical||30)/100, piracy: clamp(s.piracy||20)/100 };
  const total = w.weather+w.congestion+w.geopolitical+w.piracy || 1;
  const score = (r.weather*w.weather + r.congestion*w.congestion +
                 r.geopolitical*w.geopolitical + r.piracy*w.piracy) / total * 100;
  return clamp(Math.round(score));
}

/* ══ PHASE 6: localStorage history + alerts ═══════ */
function saveHistory(route) {
  try {
    const key = 'scl-history';
    const hist = JSON.parse(localStorage.getItem(key)||'[]');
    hist.unshift({ route: route.name||route.label, risk: route.risk||'?', score: route.riskScore||0,
                   origin: route.origin||'', destination: route.destination||'', ts: new Date().toLocaleString() });
    localStorage.setItem(key, JSON.stringify(hist.slice(0,20)));
    updateAlertBadge();
  } catch(_) {}
}
function generateAlerts(route) {
  try {
    const alerts = [];
    if ((route.weather||0)    > 70) alerts.push('Severe weather risk on '+route.name);
    if ((route.congestion||0) > 70) alerts.push('Port congestion risk on '+route.name);
    if ((route.piracy||0)     > 60) alerts.push('Piracy zone alert on '+route.name);
    if (route.risk==='high')        alerts.push('High geopolitical risk — '+route.name+' not recommended');
    if (alerts.length) {
      const prev = JSON.parse(localStorage.getItem('scl-alerts')||'[]');
      const merged = [...alerts, ...prev].slice(0,30);
      localStorage.setItem('scl-alerts', JSON.stringify(merged));
      updateAlertBadge();
    }
  } catch(_) {}
}
function updateAlertBadge() {
  try {
    const count = JSON.parse(localStorage.getItem('scl-alerts')||'[]').length;
    const badge = document.querySelector('#sidebar-alerts .sidebar-nav__badge');
    if (badge) badge.textContent = count > 0 ? Math.min(count,99) : '';
  } catch(_) {}
}
function openHistory() {
  try {
    const data = JSON.parse(localStorage.getItem('scl-history')||'[]');
    let body = data.length ? data.map(r =>
      `<div class="history-item" style="padding:10px 0;border-bottom:1px solid var(--clr-border)">
        <strong>${r.route}</strong><br>
        <span style="font-size:12px;color:var(--clr-text-secondary)">${r.origin||''} → ${r.destination||''} &nbsp;|&nbsp; Risk: <b>${r.risk}</b> (${r.score}) &nbsp;|&nbsp; ${r.ts}</span>
      </div>`).join('')
      : '<p style="color:var(--clr-text-muted)">No history yet. Analyze a route first.</p>';
    showModal('📋 Route History', body, true);
  } catch(e) { showModal('📋 Route History','Error loading history.'); }
}
function openAlerts() {
  try {
    const alerts = JSON.parse(localStorage.getItem('scl-alerts')||'[]');
    let body = alerts.length ? alerts.map(a =>
      `<div class="alert-item" style="padding:8px 0;border-bottom:1px solid var(--clr-border);color:var(--clr-risk-high)">⚠ ${a}</div>`).join('')
      : '<p style="color:var(--clr-text-muted)">No alerts. System nominal.</p>';
    body += alerts.length ? `<div style="margin-top:12px"><button class="btn btn--ghost btn--sm" onclick="localStorage.removeItem('scl-alerts');updateAlertBadge();this.closest('.notify-modal-overlay').remove()">Clear All</button></div>` : '';
    showModal('🔔 Active Alerts', body, true);
  } catch(e) { showModal('🔔 Alerts','Error loading alerts.'); }
}
function openSettings() {
  const s = getSettings();
  const body = `
    <div style="display:flex;flex-direction:column;gap:12px;margin-top:8px">
      ${['weather','congestion','geopolitical','piracy'].map(k =>
        `<label style="display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:13px">
          <span style="text-transform:capitalize">${k} Weight (%)</span>
          <input id="scl-set-${k}" type="number" min="0" max="100" value="${s[k]||{weather:25,congestion:25,geopolitical:30,piracy:20}[k]}"
            style="width:70px;padding:4px 8px;border:1px solid var(--clr-border);border-radius:6px;background:var(--clr-bg-surface);color:var(--clr-text-primary)">
        </label>`).join('')}
      <p style="font-size:11px;color:var(--clr-text-muted)">Weights affect the risk score calculation. Total should ideally sum to 100.</p>
      <button class="btn btn--primary btn--sm" onclick="saveSettings()">Save Settings</button>
    </div>`;
  showModal('⚙ Settings', body, true);
}
function saveSettings() {
  try {
    const s = {};
    ['weather','congestion','geopolitical','piracy'].forEach(k =>
      s[k] = clamp(Number(document.getElementById('scl-set-'+k)?.value||25)));
    localStorage.setItem('scl-settings', JSON.stringify(s));
    document.querySelector('.notify-modal-overlay')?.remove();
    showAlert('Settings saved. Re-analyze to apply new weights.','info');
  } catch(e) { showAlert('Failed to save settings.','danger'); }
}

/* ══ PHASE 6: Nominatim geocoder + dynamic routes ═ */
async function getCoords(place) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(place)}&limit=1`;
  const res  = await fetch(url, { headers:{'Accept-Language':'en'} });
  const data = await res.json();
  if (!data[0]) throw new Error('Location not found: '+place);
  return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
}
async function generateRoutes(origin, destination) {
  const [start, end] = await Promise.all([getCoords(origin), getCoords(destination)]);
  const mid  = [(start[0]+end[0])/2, (start[1]+end[1])/2];
  const dist = Math.round(Math.hypot(end[0]-start[0], end[1]-start[1]) * 111);
  const fallback = getFallbackRoutes();
  return [
    { ...fallback[0], name:'Direct — '+origin+' to '+destination, origin, destination,
      coords:[start,end], distance:dist, eta:Math.round(dist/600) },
    { ...fallback[1], name:'Indirect — via waypoint', origin, destination,
      coords:[start,[mid[0]-5,mid[1]+10],end], distance:Math.round(dist*1.4), eta:Math.round(dist*1.4/600) },
    { ...fallback[2], name:'High-speed — narrow corridor', origin, destination,
      coords:[start,[mid[0]+8,mid[1]-8],end], distance:Math.round(dist*0.9), eta:Math.round(dist*0.9/600) }
  ];
}

/* ══ PHASE 6: System self-check ════════════════ */
function systemCheck() {
  console.log('[SCL] Running system diagnostics...');
  if (!$('map'))         console.error('[SCL] MISSING: #map');
  if (!$('route-cards') && !$('route-cards-overlay')) console.error('[SCL] MISSING: #route-cards');
  if (!$('analyze-btn'))console.error('[SCL] MISSING: #analyze-btn');
  if (!state.routes.length) console.warn('[SCL] No routes loaded yet');
  if (!mapInstance)     console.warn('[SCL] Map not initialised');
  else console.log('[SCL] Map OK');
  console.log('[SCL] Diagnostics complete. Routes:', state.routes.length);
}

/* ══ PART 11 — DOUBLE-CLICK LOCK ═════════════════ */
function lockButton(btn) {
  if (!btn) return;
  btn.disabled = true;
  btn.style.opacity = '0.7';
  setTimeout(() => { btn.disabled = false; btn.style.opacity = ''; }, 1500);
}

/* ══ PART 12 — FALLBACK ROUTES ═══════════════════ */
function getFallbackRoutes() {
  return [
    { id:'route-a', label:'ROUTE A', name:'Via Strait of Malacca', eta:14, distance:8420,
      weather:30, congestion:35, geopolitical:38, piracy:28, risk:'low',   color:'#059669',
      coords:[[1.29,103.85],[4.85,100.34],[10.5,92.5],[16.0,67.0],[20.0,47.0]] },
    { id:'route-b', label:'ROUTE B', name:'Via Cape of Good Hope', eta:18, distance:12100,
      weather:55, congestion:60, geopolitical:62, piracy:50, risk:'medium', color:'#D97706',
      coords:[[1.29,103.85],[-5.0,98.0],[-15.0,82.0],[-34.4,18.4],[1.0,3.0]] },
    { id:'route-c', label:'ROUTE C', name:'Via Red Sea Corridor',  eta:12, distance:6900,
      weather:55, congestion:80, geopolitical:92, piracy:88, risk:'high',  color:'#DC2626',
      coords:[[1.29,103.85],[6.0,82.0],[16.0,55.0],[27.0,37.0],[30.0,32.5]] }
  ].map(r => { r.riskScore = calculateRisk(r); return r; });
}

/* ══ PHASE 6 ROUTE DATA ═══════════════════════════ */
const ROUTES_DATA = getFallbackRoutes(); // Phase 6 data = sanitized fallback

/* ══ MOCK API ═════════════════════════════════════ */
const rand  = (a,b) => Math.floor(Math.random()*(b-a+1))+a;
const sleep = ms => new Promise(r => setTimeout(r,ms));

const FACTORS = {
  low:    { Geopolitical:[10,28], Weather:[5,22],  'Port Congestion':[15,38], 'Piracy Index':[5,18]  },
  medium: { Geopolitical:[30,54], Weather:[25,48], 'Port Congestion':[45,68], 'Piracy Index':[20,44] },
  high:   { Geopolitical:[62,88], Weather:[52,78], 'Port Congestion':[65,92], 'Piracy Index':[55,84] }
};
const EXPLANATIONS = {
  low:[
    { factor:'Low piracy index in Malacca corridor',    impact:'+Safety',  c:'var(--clr-risk-safe)'  },
    { factor:'Clear monsoon forecast for next 12 days', impact:'+Weather', c:'var(--clr-risk-safe)'  },
    { factor:'Singapore port backlog est. 2 days',      impact:'-Delay',   c:'var(--clr-risk-medium)'},
    { factor:'Red Sea conflict fully avoided',          impact:'+Safety',  c:'var(--clr-risk-safe)'  }
  ],
  medium:[
    { factor:'Extended voyage adds weather exposure',   impact:'-Risk',    c:'var(--clr-risk-medium)'},
    { factor:'Cape corridor avoids conflict zones',     impact:'+Safety',  c:'var(--clr-risk-safe)'  },
    { factor:'Port congestion at Cape Town (+3 days)',  impact:'-Delay',   c:'var(--clr-risk-medium)'},
    { factor:'Seasonal swells — moderate risk',         impact:'-Weather', c:'var(--clr-risk-medium)'}
  ],
  high:[
    { factor:'Active conflict zones along Red Sea',     impact:'-Critical',c:'var(--clr-risk-high)'  },
    { factor:'Houthi activity in Gulf of Aden',         impact:'-Safety',  c:'var(--clr-risk-high)'  },
    { factor:'Fastest ETA despite high risk',           impact:'+Speed',   c:'var(--clr-risk-safe)'  },
    { factor:'Insurance premiums elevated +35%',        impact:'-Cost',    c:'var(--clr-risk-high)'  }
  ]
};
const RECS = {
  low:    n => ({ h:`Take ${n} — Optimal Safety`,   b:`Best balance of safety and efficiency. Geopolitical conditions are stable and weather is clear.` }),
  medium: n => ({ h:`${n} — Acceptable Risk`,       b:`Extended voyage increases weather exposure but avoids conflict zones. Suitable for non-urgent cargo.` }),
  high:   n => ({ h:`Avoid ${n} — High Risk`,       b:`Active conflict makes this route unsuitable. Only use under exceptional time pressure.` })
};

async function getRoutes(origin, destination) {
  await sleep(rand(900,1600));
  return ROUTES_DATA.map(r => ({...r, eta:r.eta+rand(-1,2), distance:r.distance+rand(-100,100), origin, destination }));
}

async function getAnalysis(route) {
  await sleep(rand(500,900));
  const ranges = { low:[30,49], medium:[51,74], high:[75,94] };
  const [mn,mx] = ranges[route.risk] || [30,49];
  const riskScore  = rand(mn, mx);
  const confidence = rand(72, 95);
  const factors    = {};
  for (const [k,[a,b]] of Object.entries(FACTORS[route.risk] || FACTORS.low)) factors[k] = rand(a,b);
  return { riskScore, confidence, factors, rec: RECS[route.risk](route.name), explanations: EXPLANATIONS[route.risk] };
}

/* ══ HELPERS ══════════════════════════════════════ */
const $ = id => document.getElementById(id);
const riskLevel = s => s>=75?'high':s>=50?'medium':'low';
const riskLabel = s => s>=75?'High Risk':s>=50?'Medium Risk':'Low Risk';
const riskColor = s => s>=75?'var(--clr-risk-high)':s>=50?'var(--clr-risk-medium)':'var(--clr-risk-safe)';
const getRiskColor = s => s>=75?'#DC2626':s>=50?'#D97706':'#059669';
function getBestRoute(routes) {
  return routes.find(r=>r.risk==='low') || routes.reduce((a,b) => a.riskScore<b.riskScore?a:b);
}

/* ══ PART 5 — MAP (NEVER FAIL) ═══════════════════ */
let mapInstance = null;
let routeLayer  = null;
const polylines  = {};

function initMapSafe() {
  const el = $('map');
  if (!el)                   { console.warn('[SCL] #map not found'); return; }
  if (typeof L==='undefined'){ console.error('[SCL] Leaflet not loaded'); return; }
  if (mapInstance)           return;
  try {
    mapInstance = L.map(el, { zoomControl:false }).setView([12,78], 3);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18
    }).addTo(mapInstance);
    L.control.zoom({ position:'topright' }).addTo(mapInstance);
    setTimeout(() => { try { mapInstance.invalidateSize(); } catch(_){} }, 300);
    drawAllRoutes();
    console.log('[SCL] Map ready');
  } catch(e) { console.error('[SCL] Map init failed:', e); }
}

function drawAllRoutes() {
  if (!mapInstance) return;
  Object.values(polylines).forEach(p => { try { p.remove(); } catch(_){} });
  Object.keys(polylines).forEach(k => delete polylines[k]);
  ROUTES_DATA.forEach(route => {
    try {
      if (!Array.isArray(route.coords) || !route.coords.length) return;
      polylines[route.id] = L.polyline(route.coords, {
        color: route.color||'#64748B', weight:4, opacity:0.55, smoothFactor:1.5
      }).addTo(mapInstance);
    } catch(e) { console.warn('[SCL] polyline failed:', route.id, e); }
  });
}

/* ══ PART 10 — HIGHLIGHT ROUTE (fitBounds) ═════════ */
function highlightRoute(route) {
  if (!mapInstance || !route) return;
  try { if (routeLayer) { mapInstance.removeLayer(routeLayer); routeLayer = null; } } catch(_) {}
  // Style all polylines
  for (const [rid, poly] of Object.entries(polylines)) {
    try {
      const r   = state.routes.find(x=>x.id===rid) || ROUTES_DATA.find(x=>x.id===rid);
      const col = r ? (r.color || getRiskColor(r.riskScore||0)) : '#64748B';
      const act = rid === route.id;
      poly.setStyle({ color:col, weight:act?7:3, opacity:act?1:0.35 });
      if (act) poly.bringToFront();
    } catch(_) {}
  }
  // If route has real coords, draw dedicated layer + fitBounds
  if (Array.isArray(route.coords) && route.coords.length >= 2) {
    try {
      routeLayer = L.polyline(route.coords, {
        color: getRiskColor(route.riskScore||0), weight:5, opacity:0.9
      }).addTo(mapInstance);
      mapInstance.fitBounds(routeLayer.getBounds(), { padding:[40,40], maxZoom:8 });
    } catch(e) { console.warn('[SCL] fitBounds failed:', e); }
  }
}

/* ══ PART 6 — ROUTE CARDS RENDER ════════════════════ */
function renderRoutes(routes) {
  const container = $('route-cards') || $('route-cards-overlay');
  if (!container) { console.warn('[SCL] Route cards container missing'); return; }
  container.innerHTML = '';

  const list = routes && routes.length ? routes : getFallbackRoutes();
  const bestId = getBestRoute(list).id;

  list.forEach(rawRoute => {
    const route  = sanitizeRoute(rawRoute);
    const sel    = state.selectedRoute?.id === route.id;
    const best   = route.id === bestId;
    const badgeTxt = route.risk==='low'?'● Low':route.risk==='medium'?'● Med':'● High';
    const btnCls   = best?'btn--primary':route.risk==='medium'?'btn--secondary':'btn--ghost';
    const btnTxt   = sel?'Selected ✓':best?'Select Route':route.risk==='medium'?'Compare':'View';

    const art = document.createElement('article');
    art.className = `route-card${sel?' is-selected':''}${best?' is-recommended':''}`;
    art.setAttribute('role','listitem');
    art.setAttribute('tabindex','0');
    art.setAttribute('aria-selected', String(sel));
    art.dataset.routeId = route.id;
    art.innerHTML = `
      <div class="route-card__header">
        <span class="route-card__label">${route.label||route.name}</span>
        <span class="risk-badge risk-badge--${route.risk||'low'}">${badgeTxt}</span>
      </div>
      <div class="route-card__body">
        <p class="route-card__name">${route.name||'Unknown Route'}</p>
        <div class="route-card__meta">
          <span class="route-card__meta-item">⏱ ${route.eta||'?'} days</span>
          <span class="route-card__meta-item">📏 ${(route.distance||0).toLocaleString()} km</span>
        </div>
      </div>
      <div class="route-card__footer">
        <button class="btn ${btnCls} btn--sm" data-action="select" data-route-id="${route.id}">${btnTxt}</button>
      </div>`;

    art.addEventListener('click', e => {
      if (!e.target.closest('[data-action="select"]')) safeRun(() => selectRoute(route));
    });
    art.addEventListener('keydown', e => {
      if (e.key==='Enter'||e.key===' ') { e.preventDefault(); safeRun(() => selectRoute(route)); }
    });
    art.querySelector('[data-action="select"]')?.addEventListener('click', e => {
      e.stopPropagation();
      lockButton(e.currentTarget);
      safeRun(() => selectRoute(route));
    });
    container.appendChild(art);
  });
}

/* ══ PART 9 — SAFE ROUTE SELECTION (history+alerts) ═ */
async function selectRoute(route) {
  if (!route || state.loading) return;
  if (state.selectedRoute?.id === route.id) return;
  setState({ selectedRoute: route });
  renderRoutes(state.routes.length ? state.routes : getFallbackRoutes());
  safeRun(() => highlightRoute(route));
  safeRun(() => saveHistory(route));
  safeRun(() => generateAlerts(route));
  if (route.risk==='high')        showAlert('High risk route selected — consider Route A or B.','danger');
  else if (route.risk==='medium') showAlert('Moderate risk — conditions are manageable.','warning');
  else { const b=$('alert-banner'); if(b) b.hidden=true; }
  setState({ loading:true }); setPanelDim(true);
  try {
    state.analysis = await getAnalysis(route);
    renderAIPanel();
  } catch(e) { console.error('[SCL] Analysis error:', e); }
  finally { setState({ loading:false }); setPanelDim(false); }
}

/* ══ AI PANEL ═════════════════════════════════════ */
const DOM = {};
function initDOMRefs() {
  ['scoreNum','scoreBadge','scoreSub','factors','confVal','confFill','recHead','recBody','explain'].forEach(k => {
    const ids = { scoreNum:'risk-score-number', scoreBadge:'risk-score-badge', scoreSub:'risk-score-sub',
                  factors:'risk-factors', confVal:'confidence-value', confFill:'confidence-fill',
                  recHead:'rec-headline', recBody:'rec-body', explain:'explain-list' };
    DOM[k] = $(ids[k]);
  });
}

function renderAIPanel() {
  if (!state.analysis) return;
  const { riskScore, confidence, factors, rec, explanations } = state.analysis;
  const lvl = riskLevel(riskScore);
  if (DOM.scoreNum)   { DOM.scoreNum.textContent = riskScore; DOM.scoreNum.className = `risk-score-number risk-score-number--${lvl}`; }
  if (DOM.scoreBadge) { DOM.scoreBadge.textContent = riskLabel(riskScore); DOM.scoreBadge.className = `risk-badge risk-badge--${lvl}`; }
  if (DOM.scoreSub && state.selectedRoute) DOM.scoreSub.textContent = `${state.selectedRoute.label||''} selected`;
  if (DOM.factors) {
    DOM.factors.innerHTML = Object.entries(factors||{}).map(([k,v]) => `
      <div class="risk-factor-row">
        <span class="risk-factor-label">${k}</span>
        <div class="risk-factor-bar-track" role="progressbar" aria-valuenow="${v}" aria-valuemin="0" aria-valuemax="100">
          <div class="risk-factor-bar-fill" style="width:${v}%;background:${riskColor(v)};transition:width .6s ease"></div>
        </div>
        <span class="risk-factor-val">${v}</span>
      </div>`).join('');
  }
  if (DOM.confVal)  DOM.confVal.textContent = `${confidence}%`;
  if (DOM.confFill) DOM.confFill.style.width = `${confidence}%`;
  if (DOM.recHead)  DOM.recHead.textContent  = rec?.h || '';
  if (DOM.recBody)  DOM.recBody.textContent  = rec?.b || '';
  if (DOM.explain)  DOM.explain.innerHTML = (explanations||[]).map(({factor,impact,c}) =>
    `<div class="explain-row"><span class="explain-row__factor">${factor}</span><span class="explain-row__impact" style="color:${c}">${impact}</span></div>`).join('');
}

function setPanelDim(on) {
  document.querySelectorAll('#ai-panel .panel-block').forEach(p => {
    p.style.opacity = on?'0.4':''; p.style.pointerEvents = on?'none':''; p.style.transition='opacity .3s';
  });
}

/* ══ PART 13 — ANALYZE ROUTE (Nominatim + fallback) ═ */
async function analyzeRoute() {
  if (state.loading) return;
  const src  = $('input-source')?.value.trim();
  const dest = $('input-destination')?.value.trim();
  if (!src || !dest) { showAlert('Enter both origin and destination.','warning'); return; }
  setState({ loading:true });
  const btn = $('analyze-btn');
  if (btn) { btn.disabled=true; btn.textContent='Analyzing…'; btn.style.opacity='0.7'; }
  const cardsEl = $('route-cards')||$('route-cards-overlay');
  if (cardsEl) cardsEl.innerHTML = [0,1,2].map(()=>
    '<div class="skeleton-card" style="flex:1;min-width:200px" aria-hidden="true">'+
    '<div class="skeleton skeleton-line skeleton-line--title"></div>'+
    '<div class="skeleton skeleton-line skeleton-line--medium"></div>'+
    '<div class="skeleton skeleton-bar"></div></div>').join('');
  setPanelDim(true);
  try {
    let routes;
    try { routes = await generateRoutes(src, dest); }
    catch(geoErr) {
      console.warn('[SCL] Nominatim failed, using fallback:', geoErr.message);
      showAlert('Location lookup failed — using default routes.','warning');
      routes = getFallbackRoutes().map(r=>({...r, origin:src, destination:dest}));
    }
    routes.forEach(r => { r.riskScore = calculateRisk(r); r.risk = r.riskScore>=75?'high':r.riskScore>=50?'medium':'low'; });
    setState({ routes, analyzed:true });
    const best = getBestRoute(routes);
    setState({ selectedRoute: best });
    renderRoutes(routes);
    safeRun(() => highlightRoute(best));
    safeRun(() => saveHistory(best));
    safeRun(() => generateAlerts(best));
    state.analysis = await getAnalysis(best).catch(()=>null);
    if (state.analysis) renderAIPanel();
    showAlert(`Analysis complete: ${src} → ${dest}. ${best.label||best.name} recommended.`,'info');
  } catch(err) {
    console.error('[SCL] analyzeRoute failed:', err);
    const fb = getFallbackRoutes();
    setState({ routes:fb, selectedRoute:fb[0] });
    renderRoutes(fb);
    showAlert('Analysis failed — showing fallback routes.','warning');
  } finally {
    setState({ loading:false });
    if (btn) { btn.disabled=false; btn.textContent='Analyze Route'; btn.style.opacity=''; }
    setPanelDim(false);
  }
}

/* ══ ALERT ════════════════════════════════════════ */
function showAlert(msg, type='warning') {
  const b=$('alert-banner'); if(!b) return;
  const t=$('alert-text'); if(t) t.textContent=msg;
  b.className=`alert-banner alert-banner--${type}`;
  b.hidden=false;
}

/* ══ MODAL (accepts raw HTML via 3rd param) ════════ */
function showModal(title, content, isHtml=false) {
  document.querySelector('.notify-modal-overlay')?.remove();
  const ov = document.createElement('div');
  ov.className = 'notify-modal-overlay';
  const body = isHtml
    ? `<div class="notify-modal__body" style="max-height:55vh;overflow-y:auto;text-align:left">${content}</div>`
    : `<p class="notify-modal__body">${content}</p>`;
  ov.innerHTML = `<div class="notify-modal" style="max-width:480px;width:90%">
    <p class="notify-modal__title">${title}</p>
    ${body}
    <div class="notify-modal__footer"><button class="btn btn--primary btn--sm" id="nmc">Close</button></div>
  </div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.querySelector('#nmc').addEventListener('click', close);
  ov.addEventListener('click', e => { if(e.target===ov) close(); });
  document.addEventListener('keydown', function esc(e){ if(e.key==='Escape'){close();document.removeEventListener('keydown',esc);} });
}

/* ══ PART 2 — STRICT INIT CONTROL ════════════════ */
function initApp() {
  if (!document.body) return;

  initDOMRefs();

  // Part 5: Map
  safeRun(initMapSafe);

  // Route form
  const form = $('route-form');
  if (form) {
    form.addEventListener('submit', e => { e.preventDefault(); safeRun(analyzeRoute); });
  }

  // Alert dismiss
  $('alert-close')?.addEventListener('click', ()=>{ const b=$('alert-banner'); if(b) b.hidden=true; });

  // AI Panel
  const aiPanel  = $('ai-panel');
  const aiToggle = $('ai-panel-toggle');
  const aiClose  = $('ai-panel-close');
  const openAI   = ()=>{ aiPanel?.classList.add('is-open');    aiToggle?.setAttribute('aria-expanded','true'); };
  const closeAI  = ()=>{ aiPanel?.classList.remove('is-open'); aiToggle?.setAttribute('aria-expanded','false'); };
  aiToggle?.addEventListener('click', ()=> aiPanel?.classList.contains('is-open') ? closeAI() : openAI());
  aiClose?.addEventListener('click', closeAI);
  $('rec-accept-btn')?.addEventListener('click', ()=>{
    if (!state.selectedRoute) return;
    showAlert(`Route accepted: ${state.selectedRoute.name}. Booking flow coming soon.`, 'info');
  });

  // Hamburger
  const sidebar   = $('sidebar');
  const hamburger = $('hamburger-btn');
  if (hamburger && sidebar) {
    hamburger.addEventListener('click', ()=>{
      const open=sidebar.classList.toggle('is-open');
      hamburger.setAttribute('aria-expanded',String(open));
    });
    document.addEventListener('click', e=>{
      if (!sidebar.contains(e.target)&&!hamburger.contains(e.target)){
        sidebar.classList.remove('is-open');
        hamburger.setAttribute('aria-expanded','false');
      }
    });
  }

  // Map toolbar (safe delegation)
  $('map-zoom-in')    ?.addEventListener('click', ()=>{ try{mapInstance?.zoomIn();}catch(_){} });
  $('map-zoom-out')   ?.addEventListener('click', ()=>{ try{mapInstance?.zoomOut();}catch(_){} });
  $('map-reset-view') ?.addEventListener('click', ()=>{ try{mapInstance?.setView([12,78],3);}catch(_){} });
  $('map-layer-toggle')?.addEventListener('click', function(){this.classList.toggle('toolbar-btn--active');});

  // Sidebar — REAL panels (no coming soon)
  $('sidebar-alerts')  ?.addEventListener('click', e=>{ e.preventDefault(); openAlerts(); });
  $('sidebar-settings')?.addEventListener('click', e=>{ e.preventDefault(); openSettings(); });
  $('sidebar-history') ?.addEventListener('click', e=>{ e.preventDefault(); openHistory(); });

  // Part 9: System self-check after boot
  setTimeout(systemCheck, 2000);
  // Sync alert badge with localStorage on load
  safeRun(updateAlertBadge);

  // Boot alert + show fallback cards immediately
  setTimeout(()=>showAlert('High seismic activity detected along Route C — consider Route A.','warning'), 700);
  // Pre-populate cards with fallback so UI is never empty
  safeRun(()=>{
    const fallback = getFallbackRoutes();
    setState({ routes: fallback, selectedRoute: fallback[0] });
    renderRoutes(fallback);
    highlightRoute(fallback[0]);
  });

  console.log('[SCL] App ready — Phase 6 Stability Patch applied');
}

/* ══ SAFE ENTRY POINT ═════════════════════════════ */
if (document.readyState==='loading') {
  document.addEventListener('DOMContentLoaded', ()=>safeRun(initApp));
} else {
  safeRun(initApp);
}
