/* ═══════════════════════════════════════════════════
   SENTINELCHAIN LITE — Dashboard Engine (Phase 6)
   Safe: DOMContentLoaded, try/catch, null-checks
═══════════════════════════════════════════════════ */

/* ══ PHASE 6 ROUTE DATA ═══════════════════════════ */
const ROUTES_DATA = [
  {
    id: 'route-a', label: 'ROUTE A', name: 'Via Strait of Malacca',
    eta: 14, distance: 8420, risk: 'low', color: '#059669',
    coords: [[1.29,103.85],[4.85,100.34],[7.0,97.0],[10.5,92.5],[13.0,80.0],[16.0,67.0],[18.5,57.5],[20.0,47.0]],
    weather: 'Clear', congestion: 'Low', geopolitical: 'Stable', piracy: 'Low'
  },
  {
    id: 'route-b', label: 'ROUTE B', name: 'Via Cape of Good Hope',
    eta: 18, distance: 12100, risk: 'medium', color: '#D97706',
    coords: [[1.29,103.85],[-5.0,98.0],[-15.0,82.0],[-25.0,60.0],[-34.4,18.4],[-26.0,15.0],[-15.0,12.5],[1.0,3.0]],
    weather: 'Moderate swells', congestion: 'Medium', geopolitical: 'Stable', piracy: 'Low'
  },
  {
    id: 'route-c', label: 'ROUTE C', name: 'Via Red Sea Corridor',
    eta: 12, distance: 6900, risk: 'high', color: '#DC2626',
    coords: [[1.29,103.85],[6.0,82.0],[11.0,68.0],[16.0,55.0],[22.0,44.0],[27.0,37.0],[30.0,32.5]],
    weather: 'Clear', congestion: 'High', geopolitical: 'Conflict', piracy: 'High'
  }
];

/* ══ GLOBAL STATE ═════════════════════════════════ */
const state = {
  routes: [],
  selectedRoute: null,
  analysis: null,
  loading: false,
  analyzed: false
};

/* ══ MOCK API ═════════════════════════════════════ */
const rand  = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const FACTORS = {
  low:    { Geopolitical:[10,28], Weather:[5,22],  'Port Congestion':[15,38], 'Piracy Index':[5,18]  },
  medium: { Geopolitical:[30,54], Weather:[25,48], 'Port Congestion':[45,68], 'Piracy Index':[20,44] },
  high:   { Geopolitical:[62,88], Weather:[52,78], 'Port Congestion':[65,92], 'Piracy Index':[55,84] }
};
const EXPLANATIONS = {
  low:[
    { factor:'Low piracy index in Malacca corridor',    impact:'+Safety',  c:'var(--clr-risk-safe)'  },
    { factor:'Clear monsoon forecast for next 12 days', impact:'+Weather', c:'var(--clr-risk-safe)'  },
    { factor:'Singapore port backlog est. 2 days',      impact:'−Delay',   c:'var(--clr-risk-medium)'},
    { factor:'Red Sea conflict fully avoided',          impact:'+Safety',  c:'var(--clr-risk-safe)'  }
  ],
  medium:[
    { factor:'Extended voyage adds weather exposure',   impact:'−Risk',    c:'var(--clr-risk-medium)'},
    { factor:'Cape corridor avoids conflict zones',     impact:'+Safety',  c:'var(--clr-risk-safe)'  },
    { factor:'Port congestion at Cape Town (+3 days)',  impact:'−Delay',   c:'var(--clr-risk-medium)'},
    { factor:'Seasonal swells — moderate risk',         impact:'−Weather', c:'var(--clr-risk-medium)'}
  ],
  high:[
    { factor:'Active conflict zones along Red Sea',     impact:'−Critical',c:'var(--clr-risk-high)'  },
    { factor:'Houthi activity in Gulf of Aden',         impact:'−Safety',  c:'var(--clr-risk-high)'  },
    { factor:'Fastest ETA despite high risk',           impact:'+Speed',   c:'var(--clr-risk-safe)'  },
    { factor:'Insurance premiums elevated +35%',        impact:'−Cost',    c:'var(--clr-risk-high)'  }
  ]
};
const RECS = {
  low:    n => ({ h:`Take ${n} — Optimal Safety`,   b:`Best balance of safety and efficiency. Geopolitical conditions are stable and weather is clear for the voyage window.` }),
  medium: n => ({ h:`${n} — Acceptable Risk`,       b:`Extended voyage increases weather exposure but avoids conflict zones. Expect minor port delays. Suitable for non-urgent cargo.` }),
  high:   n => ({ h:`Avoid ${n} — High Risk`,       b:`Active conflict makes this route unsuitable for standard operations. Consider Route A or B. Only use under exceptional time pressure.` })
};

async function getRoutes(origin, destination) {
  await sleep(rand(1000, 1800));
  return ROUTES_DATA.map(r => ({ ...r, eta: r.eta + rand(-1,2), distance: r.distance + rand(-150,150), origin, destination }));
}

async function getAnalysis(route) {
  await sleep(rand(600, 1000));
  const ranges = { low:[30,49], medium:[51,74], high:[75,94] };
  const [mn, mx] = ranges[route.risk];
  const riskScore  = rand(mn, mx);
  const confidence = rand(72, 95);
  const factors    = {};
  for (const [k,[a,b]] of Object.entries(FACTORS[route.risk])) factors[k] = rand(a, b);
  return { riskScore, confidence, factors, rec: RECS[route.risk](route.name), explanations: EXPLANATIONS[route.risk] };
}

/* ══ LEAFLET MAP ══════════════════════════════════ */
let mapInstance = null;
const polylines  = {};

function initMap() {
  const mapEl = document.getElementById('map');
  if (!mapEl) { console.warn('[SCL] #map not found'); return; }
  if (typeof L === 'undefined') { console.error('[SCL] Leaflet not loaded'); return; }
  if (mapInstance) return;

  try {
    mapInstance = L.map('map', { zoomControl: false }).setView([12, 78], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18
    }).addTo(mapInstance);
    L.control.zoom({ position: 'topright' }).addTo(mapInstance);
    drawRoutes();
    console.log('[SCL] Map initialised');
  } catch (e) {
    console.error('[SCL] Map init failed:', e);
  }
}

function drawRoutes() {
  if (!mapInstance) return;
  Object.values(polylines).forEach(p => { try { p.remove(); } catch(_){} });
  Object.keys(polylines).forEach(k => delete polylines[k]);

  ROUTES_DATA.forEach(route => {
    try {
      polylines[route.id] = L.polyline(route.coords, {
        color: route.color, weight: 4, opacity: 0.55, smoothFactor: 1.5
      }).addTo(mapInstance);
    } catch (e) { console.warn('[SCL] polyline draw failed:', route.id, e); }
  });
}

function updateMapLines(selId) {
  if (!mapInstance) return;
  for (const [routeId, poly] of Object.entries(polylines)) {
    try {
      const route  = state.routes.find(r => r.id === routeId) || ROUTES_DATA.find(r => r.id === routeId);
      const color  = route ? route.color : '#64748B';
      const active = routeId === selId;
      poly.setStyle({ color, weight: active ? 7 : 3, opacity: active ? 1.0 : 0.35 });
      if (active) poly.bringToFront();
    } catch (e) { console.warn('[SCL] polyline style failed:', e); }
  }
}

/* ══ HELPERS ══════════════════════════════════════ */
const $ = id => document.getElementById(id);
const riskLevel = s => s >= 75 ? 'high'      : s >= 50 ? 'medium'      : 'low';
const riskLabel = s => s >= 75 ? 'High Risk' : s >= 50 ? 'Medium Risk' : 'Low Risk';
const riskColor = s => s >= 75 ? 'var(--clr-risk-high)' : s >= 50 ? 'var(--clr-risk-medium)' : 'var(--clr-risk-safe)';

/* ══ ROUTE CARDS RENDER ═══════════════════════════ */
function renderRouteCards() {
  const container = $('route-cards') || $('route-cards-overlay');
  if (!container) { console.warn('[SCL] Route cards container not found'); return; }
  container.innerHTML = '';
  if (!state.routes.length) return;

  const bestId = (state.routes.find(r => r.risk === 'low') || state.routes[0]).id;

  state.routes.forEach(route => {
    const sel      = state.selectedRoute?.id === route.id;
    const best     = route.id === bestId;
    const badgeTxt = route.risk === 'low' ? '● Low' : route.risk === 'medium' ? '● Med' : '● High';
    const btnCls   = best ? 'btn--primary' : route.risk === 'medium' ? 'btn--secondary' : 'btn--ghost';
    const btnTxt   = sel  ? 'Selected ✓'  : best ? 'Select Route'   : route.risk === 'medium' ? 'Compare' : 'View';

    const art = document.createElement('article');
    art.className = `route-card${sel?' is-selected':''}${best?' is-recommended':''}`;
    art.setAttribute('role','listitem');
    art.setAttribute('tabindex','0');
    art.setAttribute('aria-selected', String(sel));
    art.dataset.routeId = route.id;
    art.innerHTML = `
      <div class="route-card__header">
        <span class="route-card__label">${route.label}</span>
        <span class="risk-badge risk-badge--${route.risk}">${badgeTxt}</span>
      </div>
      <div class="route-card__body">
        <p class="route-card__name">${route.name}</p>
        <div class="route-card__meta">
          <span class="route-card__meta-item">⏱ ${route.eta} days</span>
          <span class="route-card__meta-item">📏 ${route.distance.toLocaleString()} km</span>
        </div>
      </div>
      <div class="route-card__footer">
        <button class="btn ${btnCls} btn--sm" data-action="select" data-route-id="${route.id}">${btnTxt}</button>
      </div>`;
    container.appendChild(art);
  });

  wireCardEvents(container);
}

function wireCardEvents(container) {
  container.querySelectorAll('.route-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('[data-action="select"]')) return;
      selectRoute(card.dataset.routeId);
    });
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectRoute(card.dataset.routeId); }
    });
  });
  container.querySelectorAll('[data-action="select"]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); selectRoute(btn.dataset.routeId); });
  });
}

/* ══ ROUTE SELECTION ══════════════════════════════ */
async function selectRoute(routeId) {
  if (state.loading) return;
  const route = state.routes.find(r => r.id === routeId);
  if (!route || state.selectedRoute?.id === routeId) return;

  state.selectedRoute = route;
  renderRouteCards();
  updateMapLines(routeId);

  if (route.risk === 'high') showAlert('High risk route selected — consider Route A or B.', 'danger');
  else if (route.risk === 'medium') showAlert('Moderate risk — conditions are manageable.', 'warning');
  else { const b = $('alert-banner'); if(b) b.hidden = true; }

  state.loading = true;
  setPanelDim(true);
  try {
    state.analysis = await getAnalysis(route);
    renderAIPanel();
  } catch(e) { console.error('[SCL] Analysis failed:', e); }
  finally { state.loading = false; setPanelDim(false); }
}

/* ══ AI PANEL RENDER ══════════════════════════════ */
const DOM = {};
function initDOMRefs() {
  DOM.scoreNum   = $('risk-score-number');
  DOM.scoreBadge = $('risk-score-badge');
  DOM.scoreSub   = $('risk-score-sub');
  DOM.factors    = $('risk-factors');
  DOM.confVal    = $('confidence-value');
  DOM.confFill   = $('confidence-fill');
  DOM.recHead    = $('rec-headline');
  DOM.recBody    = $('rec-body');
  DOM.explain    = $('explain-list');
}

function renderAIPanel() {
  if (!state.analysis) return;
  const { riskScore, confidence, factors, rec, explanations } = state.analysis;
  const lvl = riskLevel(riskScore);

  if (DOM.scoreNum)   { DOM.scoreNum.textContent = riskScore; DOM.scoreNum.className = `risk-score-number risk-score-number--${lvl}`; }
  if (DOM.scoreBadge) { DOM.scoreBadge.textContent = riskLabel(riskScore); DOM.scoreBadge.className = `risk-badge risk-badge--${lvl}`; }
  if (DOM.scoreSub && state.selectedRoute) DOM.scoreSub.textContent = `${state.selectedRoute.label} selected`;

  if (DOM.factors) {
    DOM.factors.innerHTML = Object.entries(factors).map(([k,v]) => `
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
  if (DOM.recHead)  DOM.recHead.textContent  = rec.h;
  if (DOM.recBody)  DOM.recBody.textContent  = rec.b;
  if (DOM.explain)  DOM.explain.innerHTML = (explanations || []).map(({factor,impact,c}) =>
    `<div class="explain-row"><span class="explain-row__factor">${factor}</span><span class="explain-row__impact" style="color:${c}">${impact}</span></div>`).join('');
}

function setPanelDim(on) {
  document.querySelectorAll('#ai-panel .panel-block').forEach(p => {
    p.style.opacity = on ? '0.4' : '';
    p.style.pointerEvents = on ? 'none' : '';
    p.style.transition = 'opacity .3s';
  });
}

/* ══ ROUTE FORM ═══════════════════════════════════ */
function setAnalyzeState(loading) {
  const btn = $('analyze-btn');
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? 'Analyzing…' : 'Analyze Route';
  btn.style.opacity = loading ? '0.7' : '';
}

function initRouteForm() {
  const form = $('route-form');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (state.loading) return;

    const src  = $('input-source')?.value.trim();
    const dest = $('input-destination')?.value.trim();
    if (!src || !dest) { showAlert('Enter both origin and destination.', 'warning'); return; }

    state.loading = true;
    setAnalyzeState(true);

    // Show skeleton in cards container
    const cardsEl = $('route-cards') || $('route-cards-overlay');
    if (cardsEl) {
      cardsEl.innerHTML = '<div style="display:flex;gap:16px;width:100%">' +
        [0,1,2].map(() => '<div class="skeleton-card" style="flex:1" aria-hidden="true"><div class="skeleton skeleton-line skeleton-line--title"></div><div class="skeleton skeleton-line skeleton-line--medium"></div><div class="skeleton skeleton-bar"></div></div>').join('') +
        '</div>';
    }
    setPanelDim(true);

    try {
      state.routes = await getRoutes(src, dest);
      const best   = state.routes.find(r => r.risk === 'low') || state.routes[0];
      state.selectedRoute = best;
      renderRouteCards();
      updateMapLines(best.id);

      state.analysis = await getAnalysis(best);
      renderAIPanel();
      state.analyzed = true;
      showAlert(`Analysis complete: ${src} → ${dest}. ${best.label} recommended.`, 'info');
    } catch(err) {
      console.error('[SCL] Form submit failed:', err);
      showAlert('Analysis failed. Please try again.', 'danger');
    } finally {
      state.loading = false;
      setAnalyzeState(false);
      setPanelDim(false);
    }
  });
}

/* ══ ALERT ════════════════════════════════════════ */
function showAlert(msg, type = 'warning') {
  const b = $('alert-banner');
  if (!b) return;
  const t = $('alert-text');
  if (t) t.textContent = msg;
  b.className = `alert-banner alert-banner--${type}`;
  b.hidden = false;
}

/* ══ MODAL ════════════════════════════════════════ */
function showModal(title, msg) {
  document.querySelector('.notify-modal-overlay')?.remove();
  const ov = document.createElement('div');
  ov.className = 'notify-modal-overlay';
  ov.innerHTML = `<div class="notify-modal">
    <p class="notify-modal__title">${title}</p>
    <p class="notify-modal__body">${msg}</p>
    <div class="notify-modal__footer"><button class="btn btn--primary btn--sm" id="nmc">Got it</button></div>
  </div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.querySelector('#nmc').addEventListener('click', close);
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });
}

/* ══ INIT APP — wrapped in DOMContentLoaded ═══════ */
function initApp() {
  initDOMRefs();

  // Map
  try { initMap(); } catch(e) { console.error('[SCL] initMap error:', e); }

  // Form
  initRouteForm();

  // Alert dismiss
  $('alert-close')?.addEventListener('click', () => { const b=$('alert-banner'); if(b) b.hidden=true; });

  // Accept Route
  $('rec-accept-btn')?.addEventListener('click', () => {
    if (!state.selectedRoute) return;
    showAlert(`Route accepted: ${state.selectedRoute.name}. Booking flow coming soon.`, 'info');
  });

  // AI Panel toggle
  const aiPanel = $('ai-panel');
  const aiToggle = $('ai-panel-toggle');
  const aiClose  = $('ai-panel-close');
  const openAI   = () => { aiPanel?.classList.add('is-open');    aiToggle?.setAttribute('aria-expanded','true'); };
  const closeAI  = () => { aiPanel?.classList.remove('is-open'); aiToggle?.setAttribute('aria-expanded','false'); };
  aiToggle?.addEventListener('click', () => aiPanel?.classList.contains('is-open') ? closeAI() : openAI());
  aiClose?.addEventListener('click', closeAI);

  // Hamburger
  const sidebar   = $('sidebar');
  const hamburger = $('hamburger-btn');
  if (hamburger && sidebar) {
    hamburger.addEventListener('click', () => {
      const open = sidebar.classList.toggle('is-open');
      hamburger.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', e => {
      if (!sidebar.contains(e.target) && !hamburger.contains(e.target)) {
        sidebar.classList.remove('is-open');
        hamburger.setAttribute('aria-expanded','false');
      }
    });
  }

  // Map toolbar
  $('map-zoom-in')     ?.addEventListener('click', () => { try { mapInstance?.zoomIn(); } catch(_){} });
  $('map-zoom-out')    ?.addEventListener('click', () => { try { mapInstance?.zoomOut(); } catch(_){} });
  $('map-reset-view')  ?.addEventListener('click', () => { try { mapInstance?.setView([12,78],4); } catch(_){} });
  $('map-layer-toggle')?.addEventListener('click', function() { this.classList.toggle('toolbar-btn--active'); });

  // Sidebar modals
  $('sidebar-alerts')  ?.addEventListener('click', e => { e.preventDefault(); showModal('🔔 Alerts',        "Alerts panel coming soon. Real-time risk notifications and route advisories will appear here."); });
  $('sidebar-settings')?.addEventListener('click', e => { e.preventDefault(); showModal('⚙ Settings',      'Settings panel coming soon. Configure risk thresholds, preferences, and display options.'); });
  $('sidebar-history') ?.addEventListener('click', e => { e.preventDefault(); showModal('📋 Route History', 'Route history coming soon. View and re-analyze previously searched routes.'); });

  // Boot alert
  setTimeout(() => showAlert('High seismic activity detected along Route C — consider Route A.', 'warning'), 800);

  console.log('[SCL] App initialised (Phase 6 ready)');
}

/* ══ SAFE ENTRY POINT ═════════════════════════════ */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp(); // Already loaded (script at end of body)
}
