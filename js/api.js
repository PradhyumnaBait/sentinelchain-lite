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

  // Approximate coordinates for major Indian cities
  const MOCK_CITY_COORDS = {
    mumbai:     [19.0760, 72.8777],
    pune:       [18.5204, 73.8567],
    delhi:      [28.6139, 77.2090],
    bangalore:  [12.9716, 77.5946],
    bengaluru:  [12.9716, 77.5946],
    chennai:    [13.0827, 80.2707],
    hyderabad:  [17.3850, 78.4867],
    kolkata:    [22.5726, 88.3639],
    guwahati:   [26.1445, 91.7362],
    shillong:   [25.5788, 91.8933],
    puducherry: [11.9416, 79.8083],
    pondicherry:[11.9416, 79.8083],
    coimbatore: [11.0168, 76.9558],
    agra:       [27.1767, 78.0081],
    jaipur:     [26.9124, 75.7873],
    lucknow:    [26.8467, 80.9462],
    nagpur:     [21.1458, 79.0882],
    ahmedabad:  [23.0225, 72.5714],
    surat:      [21.1702, 72.8311],
    bhopal:     [23.2599, 77.4126],
    patna:      [25.5941, 85.1376],
    chandigarh: [30.7333, 76.7794],
    kochi:      [9.9312,  76.2673],
    visakhapatnam: [17.6868, 83.2185],
    bhubaneswar:[20.2961, 85.8245],
    ranchi:     [23.3441, 85.3096],
    raipur:     [21.2514, 81.6296],
    varanasi:   [25.3176, 82.9739],
    amritsar:   [31.6340, 74.8723],
  };

  function resolveMockCoords(cityName) {
    if (!cityName) return [20.5937, 78.9629];
    const key = cityName.toLowerCase().trim();
    if (MOCK_CITY_COORDS[key]) return MOCK_CITY_COORDS[key];
    const found = Object.keys(MOCK_CITY_COORDS).find((k) => key.includes(k) || k.includes(key));
    return found ? MOCK_CITY_COORDS[found] : [20.5937, 78.9629];
  }

  function interpolateMockPath(start, end, steps, offsetFactor) {
    const pts = [start];
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const lat = start[0] + (end[0] - start[0]) * t + offsetFactor * Math.sin(t * Math.PI) * (end[1] - start[1]) * 0.15;
      const lng = start[1] + (end[1] - start[1]) * t - offsetFactor * Math.sin(t * Math.PI) * (end[0] - start[0]) * 0.15;
      pts.push([Math.round(lat * 10000) / 10000, Math.round(lng * 10000) / 10000]);
    }
    pts.push(end);
    return pts;
  }

  function mockRoutes(origin, destination) {
    const start = resolveMockCoords(origin);
    const end   = resolveMockCoords(destination);
    const dLat  = end[0] - start[0];
    const dLng  = end[1] - start[1];
    const distKm = Math.round(Math.sqrt(dLat * dLat + dLng * dLng) * 111);
    const baseEta = Math.max(10, Math.round(distKm * 1.5));

    return [
      {
        id: 'route_A', label: 'ROUTE A',
        name: `Route A`,
        routeName: 'Route A',
        summary: `${origin} → Highway (Primary) → ${destination}`,
        eta: baseEta, etaText: `${Math.round(baseEta * 1.35)} mins`,
        distance: distKm, distanceText: `${distKm} km`,
        weather: 30, congestion: 65, routeVulnerability: 38,
        risk: 'medium', color: '#D97706',
        riskScore: 48, riskLevel: 'Moderate',
        weatherCondition: 'Partly Cloudy', trafficLevel: 'High',
        delayMinutes: 16,
        coords: interpolateMockPath(start, end, 5, 0),
        origin, destination,
        isRecommended: false, isFastest: false,
      },
      {
        id: 'route_B', label: 'ROUTE B',
        name: `Route B`,
        routeName: 'Route B',
        summary: `${origin} → Alternate Road → ${destination}`,
        eta: Math.round(baseEta * 1.22), etaText: `${Math.round(baseEta * 1.28)} mins`,
        distance: Math.round(distKm * 1.18), distanceText: `${Math.round(distKm * 1.18)} km`,
        weather: 20, congestion: 18, routeVulnerability: 22,
        risk: 'low', color: '#059669',
        riskScore: 20, riskLevel: 'Low',
        weatherCondition: 'Clear', trafficLevel: 'Low',
        delayMinutes: 3,
        coords: interpolateMockPath(start, end, 6, 0.6),
        origin, destination,
        isRecommended: true, isFastest: false,
      },
      {
        id: 'route_C', label: 'ROUTE C',
        name: `Route C`,
        routeName: 'Route C',
        summary: `${origin} → Rural Bypass → ${destination}`,
        eta: Math.round(baseEta * 1.45), etaText: `${Math.round(baseEta * 1.5)} mins`,
        distance: Math.round(distKm * 1.32), distanceText: `${Math.round(distKm * 1.32)} km`,
        weather: 55, congestion: 80, routeVulnerability: 88,
        risk: 'high', color: '#DC2626',
        riskScore: 78, riskLevel: 'High',
        weatherCondition: 'Heavy Rain', trafficLevel: 'Severe',
        delayMinutes: 35,
        coords: interpolateMockPath(start, end, 6, -0.5),
        origin, destination,
        isRecommended: false, isFastest: true,
      }
    ];
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

  async function realFetchRoutes(source, destination, mode = 'driving') {
    const json = await requestJson('/route', {
      method: 'POST',
      body: JSON.stringify({ source, destination, mode }),
    });

    return (json?.data?.routes || []).map((route) => ({
      id: route.id,
      label: route.name.toUpperCase(),
      name: route.summary || route.name,
      routeName: route.name,
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
        const routes = mockRoutes(source, destination);
        const recommended = routes.find(r => r.isRecommended) || routes[0];
        return {
          frontend: {
            routeCards: routes,
            recommendedRouteId: recommended.id,
            recommendedRouteName: recommended.routeName,
            fastestRouteId: routes.find(r => r.isFastest)?.id || routes[2].id,
            aiPanel: {
              selectedRouteId: recommended.id,
              riskScore: recommended.riskScore,
              riskLevel: recommended.riskLevel,
              confidence: 84,
              factors: {
                Weather: recommended.weather,
                Traffic: recommended.congestion,
                Vulnerability: recommended.routeVulnerability,
                Reliability: Math.max(0, 100 - recommended.riskScore),
              },
              recommendation: {
                headline: `Use ${recommended.routeName} for safer emergency delivery`,
                body: `${recommended.riskLevel} risk profile. ${recommended.weatherCondition} conditions with ${recommended.trafficLevel} traffic.`,
              },
              explanations: [
                { factor: 'Weather conditions', impact: `${recommended.weather}% exposure` },
                { factor: 'Traffic congestion', impact: `${recommended.congestion}% risk` },
                { factor: 'Route vulnerability', impact: `${recommended.routeVulnerability}% level` },
              ],
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
        const routes = mockRoutes(source, destination);
        const recommended = routes.find(r => r.isRecommended) || routes[0];
        return {
          frontend: {
            routeCards: routes,
            recommendedRouteId: recommended.id,
            recommendedRouteName: recommended.routeName,
            fastestRouteId: routes.find(r => r.isFastest)?.id || routes[2].id,
            aiPanel: {
              selectedRouteId: recommended.id,
              riskScore: recommended.riskScore,
              riskLevel: recommended.riskLevel,
              confidence: 80,
              factors: {
                Weather: recommended.weather,
                Traffic: recommended.congestion,
                Vulnerability: recommended.routeVulnerability,
                Reliability: Math.max(0, 100 - recommended.riskScore),
              },
              recommendation: {
                headline: `Use ${recommended.routeName} for safer emergency delivery`,
                body: 'Mock mode active — backend analysis unavailable.',
              },
              explanations: [
                { factor: 'Weather conditions', impact: `${recommended.weather}% exposure` },
                { factor: 'Traffic congestion', impact: `${recommended.congestion}% risk` },
                { factor: 'Route vulnerability', impact: `${recommended.routeVulnerability}% level` },
              ],
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
