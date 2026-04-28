/* ═══════════════════════════════════════════════════
   SENTINELCHAIN LITE — api.js (Phase 7)
   Frontend API layer. Set USE_BACKEND = true when
   a real backend is available at /api/*.
   Exposes: window.SentinelAPI
═══════════════════════════════════════════════════ */

(function(global) {

  const USE_BACKEND = true;
  const API_BASE = '/api';

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
    const label = () => `${origin} → ${destination}`;
    return [
      { id:'route-a', label:'ROUTE A', name:`Primary corridor (${label()})`,
        eta:14, distance:8420, weather:30, congestion:35, routeVulnerability:38,
        risk:'low', color:'#059669',
        coords:[[1.29,103.85],[4.85,100.34],[10.5,92.5],[16.0,67.0],[20.0,47.0]],
        origin, destination },
      { id:'route-b', label:'ROUTE B', name:`Alternate relief corridor (${label()})`,
        eta:18, distance:12100, weather:55, congestion:60, routeVulnerability:62,
        risk:'medium', color:'#D97706',
        coords:[[1.29,103.85],[-5.0,98.0],[-15.0,82.0],[-34.4,18.4],[1.0,3.0]],
        origin, destination },
      { id:'route-c', label:'ROUTE C', name:`Fast but unstable corridor (${label()})`,
        eta:12, distance:6900, weather:55, congestion:80, routeVulnerability:92,
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
        Vulnerability: route.routeVulnerability || 0,
        Reliability:   clamp(100 - risk)
      },
      rec: {
        h: lvl === 'low'    ? 'Route recommended — low risk profile' :
           lvl === 'medium' ? 'Caution advised — moderate risk factors' :
                             'High risk — consider alternative routes',
        b: lvl === 'low'    ? 'All factors within safe thresholds. Proceed.' :
           lvl === 'medium' ? 'Some factors elevated. Monitor weather and traffic.' :
                             'Multiple risk factors critical. Route A or B preferred.'
      },
      explanations: [
        { factor: 'Weather conditions',   impact: `${route.weather}% exposure`,   c: route.weather   > 70 ? '#ef4444' : '#10b981' },
        { factor: 'Traffic congestion',   impact: `${route.congestion}% risk`,    c: route.congestion> 70 ? '#ef4444' : '#10b981' },
        { factor: 'Route vulnerability',  impact: `${route.routeVulnerability}% level`, c: route.routeVulnerability>70? '#ef4444' : '#f59e0b' }
      ]
    };
  }

  async function requestJson(path, options = {}, timeoutMs = 15000) {
    const res = await withTimeout(
      fetch(`${API_BASE}${path}`, {
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        ...options,
      }),
      timeoutMs
    );

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error?.message || `Request failed with ${res.status}`);
    }
    return json;
  }

  function normalizeRouteCard(route) {
    return {
      ...route,
      weather: clamp(route.weather),
      congestion: clamp(route.congestion),
      routeVulnerability: clamp(route.routeVulnerability),
      coords: Array.isArray(route.coords) ? route.coords : [],
    };
  }

  async function realFetchRoutes(source, destination, mode = 'driving') {
    const json = await requestJson('/route', {
      method: 'POST',
      body: JSON.stringify({ source, destination, mode }),
    });

    return (json?.data?.routes || []).map((route) => ({
      id: route.id,
      label: route.name.toUpperCase(),
      name: route.summary || route.name,
      summary: route.summary,
      eta: Math.round((route.durationSeconds || 0) / 60),
      etaText: route.durationInTraffic || route.duration,
      distance: Math.round((route.distanceMeters || 0) / 1000),
      distanceText: route.distance,
      color: '#64748B',
      coords: (route.polyline || []).map((point) => [point.lat, point.lng]),
      risk: 'low',
      riskScore: 0,
      origin: source,
      destination,
    }));
  }

  async function realAnalyzeRoute(source, destination, mode = 'driving', simulationScenario = null) {
    const body = { source, destination, mode };
    if (simulationScenario) body.simulationScenario = simulationScenario;
    const json = await requestJson('/analyze-route', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return json.data;
  }

  async function realRunSimulation(source, destination, scenario, severity = 'high', mode = 'driving') {
    const json = await requestJson('/simulate', {
      method: 'POST',
      body: JSON.stringify({ source, destination, scenario, severity, mode }),
    });
    return json.data;
  }

  async function realFetchScenarios() {
    const json = await requestJson('/scenarios', { method: 'GET' });
    return json?.data?.scenarios || [];
  }

  async function realFetchConfig() {
    const json = await requestJson('/config', { method: 'GET' });
    return json?.data || {};
  }

  async function checkBackendHealth() {
    try {
      await requestJson('/route', {
        method: 'POST',
        body: JSON.stringify({ source: 'Health Probe', destination: 'Health Probe', mode: 'driving' }),
      }, 5000);
      return true;
    } catch (_) {
      return false;
    }
  }

  /* ── Public API ──────────────────────────────── */
  global.SentinelAPI = {

    /**
     * Fetch routes for origin → destination.
     * Returns array of route objects.
     */
    async fetchRoutes(origin, destination, mode = 'driving') {
      if (!USE_BACKEND) {
        await new Promise(r => setTimeout(r, 300));
        return mockRoutes(origin, destination);
      }
      try {
        return await realFetchRoutes(origin, destination, mode);
      } catch(e) {
        console.warn('[SCL API] Backend unavailable, using mock data:', e.message);
        return mockRoutes(origin, destination);
      }
    },

    async analyzeRoute(source, destination, mode = 'driving', simulationScenario = null) {
      if (!USE_BACKEND) {
        await new Promise(r => setTimeout(r, 400));
        const routes = mockRoutes(source, destination).map(normalizeRouteCard);
        return {
          frontend: {
            routeCards: routes,
            recommendedRouteId: routes[0].id,
            recommendedRouteName: routes[0].label,
            fastestRouteId: routes[2].id,
            aiPanel: {
              selectedRouteId: routes[0].id,
              riskScore: 38,
              riskLevel: 'Low',
              confidence: 84,
              factors: mockAnalysis({ ...routes[0], riskScore: 38 }).factors,
              recommendation: {
                headline: 'Use Route A for stable emergency delivery',
                body: 'This route balances lower disruption risk with acceptable travel time.',
              },
              explanations: mockAnalysis({ ...routes[0], riskScore: 38 }).explanations,
              delayAvoided: '12 mins',
            },
            liveMode: false,
            delayAvoided: '12 mins',
          }
        };
      }
      try {
        return await realAnalyzeRoute(source, destination, mode, simulationScenario);
      } catch(e) {
        console.warn('[SCL API] Analysis backend unavailable, using mock:', e.message);
        const routes = mockRoutes(source, destination).map(normalizeRouteCard);
        return {
          frontend: {
            routeCards: routes,
            recommendedRouteId: routes[0].id,
            recommendedRouteName: routes[0].label,
            fastestRouteId: routes[2].id,
            aiPanel: {
              selectedRouteId: routes[0].id,
              riskScore: 38,
              riskLevel: 'Low',
              confidence: 80,
              factors: mockAnalysis({ ...routes[0], riskScore: 38 }).factors,
              recommendation: {
                headline: 'Use Route A for stable emergency delivery',
                body: 'Mock mode is active. Backend analysis is currently unavailable.',
              },
              explanations: mockAnalysis({ ...routes[0], riskScore: 38 }).explanations,
              delayAvoided: '12 mins',
            },
            liveMode: false,
            delayAvoided: '12 mins',
          }
        };
      }
    },

    async runSimulation(source, destination, scenario, severity = 'high', mode = 'driving') {
      if (!USE_BACKEND) {
        await new Promise((r) => setTimeout(r, 400));
        return {
          frontend: {
            simulation: { name: 'Mock Simulation', description: 'Offline demo mode', severity },
            recommendedRouteName: 'Route B',
            aiPanel: { riskScore: 72 },
            delayAvoided: '18 mins',
          }
        };
      }
      return realRunSimulation(source, destination, scenario, severity, mode);
    },

    async fetchScenarios() {
      if (!USE_BACKEND) return [];
      try {
        return await realFetchScenarios();
      } catch (e) {
        console.warn('[SCL API] Scenario fetch failed:', e.message);
        return [];
      }
    },

    async fetchConfig() {
      if (!USE_BACKEND) {
        return {
          modes: [
            { value: 'driving', label: 'Road Delivery' },
            { value: 'walking', label: 'On-foot Courier' },
            { value: 'bicycling', label: 'Bike Responder' },
            { value: 'transit', label: 'Public Transit' }
          ],
          severities: ['low', 'medium', 'high', 'critical']
        };
      }
      try {
        return await realFetchConfig();
      } catch (e) {
        console.warn('[SCL API] Config fetch failed:', e.message);
        return {
          modes: [
            { value: 'driving', label: 'Road Delivery' },
            { value: 'walking', label: 'On-foot Courier' },
            { value: 'bicycling', label: 'Bike Responder' },
            { value: 'transit', label: 'Public Transit' }
          ],
          severities: ['low', 'medium', 'high', 'critical']
        };
      }
    },

    async health() {
      return checkBackendHealth();
    },

    get isLive() { return USE_BACKEND; }
  };

  console.log(`[SCL API] Initialized. Mode: ${USE_BACKEND ? 'LIVE backend' : 'Mock data'}`);

})(window);
