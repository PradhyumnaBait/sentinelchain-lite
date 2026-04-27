/* ═══════════════════════════════════════════════════
   SENTINELCHAIN LITE — api.js (Phase 7)
   Frontend API layer. Set USE_BACKEND = true when
   a real backend is available at /api/*.
   Exposes: window.SentinelAPI
═══════════════════════════════════════════════════ */

(function(global) {

  /* ── Feature flag ────────────────────────────── */
  const USE_BACKEND = false;

  /* ── Request timeout helper ──────────────────── */
  function withTimeout(promise, ms) {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out')), ms)
    );
    return Promise.race([promise, timeout]);
  }

  /* ── Mock data helpers ───────────────────────── */
  function clamp(v) { return Math.max(0, Math.min(100, Number(v) || 0)); }

  function mockRoutes(origin, destination) {
    const label = (n) => `${origin} → ${destination}`;
    return [
      { id:'route-a', label:'ROUTE A', name:`Via Strait of Malacca (${label()})`,
        eta:14, distance:8420, weather:30, congestion:35, geopolitical:38, piracy:28,
        risk:'low', color:'#059669',
        coords:[[1.29,103.85],[4.85,100.34],[10.5,92.5],[16.0,67.0],[20.0,47.0]],
        origin, destination },
      { id:'route-b', label:'ROUTE B', name:`Via Cape of Good Hope (${label()})`,
        eta:18, distance:12100, weather:55, congestion:60, geopolitical:62, piracy:50,
        risk:'medium', color:'#D97706',
        coords:[[1.29,103.85],[-5.0,98.0],[-15.0,82.0],[-34.4,18.4],[1.0,3.0]],
        origin, destination },
      { id:'route-c', label:'ROUTE C', name:`Via Red Sea Corridor (${label()})`,
        eta:12, distance:6900, weather:55, congestion:80, geopolitical:92, piracy:88,
        risk:'high', color:'#DC2626',
        coords:[[1.29,103.85],[6.0,82.0],[16.0,55.0],[27.0,37.0],[30.0,32.5]],
        origin, destination }
    ];
  }

  function mockAnalysis(route) {
    const risk = route.riskScore || 0;
    const lvl  = risk >= 75 ? 'high' : risk >= 50 ? 'medium' : 'low';
    return {
      riskScore:  risk,
      confidence: clamp(85 - Math.abs(risk - 50) * 0.3),
      factors: {
        Weather:      route.weather      || 0,
        Congestion:   route.congestion   || 0,
        Geopolitical: route.geopolitical || 0,
        Piracy:       route.piracy       || 0
      },
      rec: {
        h: lvl === 'low'    ? 'Route recommended — low risk profile' :
           lvl === 'medium' ? 'Caution advised — moderate risk factors' :
                             'High risk — consider alternative routes',
        b: lvl === 'low'    ? 'All factors within safe thresholds. Proceed.' :
           lvl === 'medium' ? 'Some factors elevated. Monitor weather and ports.' :
                             'Multiple risk factors critical. Route A or B preferred.'
      },
      explanations: [
        { factor: 'Weather conditions',   impact: `${route.weather}% exposure`,   c: route.weather   > 70 ? '#ef4444' : '#10b981' },
        { factor: 'Port congestion',      impact: `${route.congestion}% risk`,    c: route.congestion> 70 ? '#ef4444' : '#10b981' },
        { factor: 'Geopolitical tension', impact: `${route.geopolitical}% level`, c: route.geopolitical>70? '#ef4444' : '#f59e0b' },
        { factor: 'Piracy threat',        impact: `${route.piracy}% probability`, c: route.piracy    > 60 ? '#ef4444' : '#10b981' }
      ]
    };
  }

  /* ── Real API calls ──────────────────────────── */
  async function realFetchRoutes(origin, destination) {
    const url = `/api/routes?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
    const res  = await withTimeout(fetch(url), 8000);
    if (!res.ok) throw new Error(`Routes API error: ${res.status}`);
    return res.json();
  }

  async function realFetchAnalysis(route) {
    const res = await withTimeout(
      fetch('/api/analysis', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(route)
      }), 8000
    );
    if (!res.ok) throw new Error(`Analysis API error: ${res.status}`);
    return res.json();
  }

  /* ── Public API ──────────────────────────────── */
  global.SentinelAPI = {

    /**
     * Fetch routes for origin → destination.
     * Returns array of route objects.
     */
    async fetchRoutes(origin, destination) {
      if (!USE_BACKEND) {
        // Simulate async delay for realistic UX
        await new Promise(r => setTimeout(r, 300));
        return mockRoutes(origin, destination);
      }
      try {
        return await realFetchRoutes(origin, destination);
      } catch(e) {
        console.warn('[SCL API] Backend unavailable, using mock data:', e.message);
        return mockRoutes(origin, destination);
      }
    },

    /**
     * Fetch AI analysis for a specific route.
     */
    async fetchAnalysis(route) {
      if (!USE_BACKEND) {
        await new Promise(r => setTimeout(r, 200));
        return mockAnalysis(route);
      }
      try {
        return await realFetchAnalysis(route);
      } catch(e) {
        console.warn('[SCL API] Analysis backend unavailable, using mock:', e.message);
        return mockAnalysis(route);
      }
    },

    /** Check if backend mode is active */
    get isLive() { return USE_BACKEND; }
  };

  console.log(`[SCL API] Initialized. Mode: ${USE_BACKEND ? 'LIVE backend' : 'Mock data'}`);

})(window);
