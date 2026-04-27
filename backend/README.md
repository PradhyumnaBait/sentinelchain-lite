# SentinelChain Lite — Backend

> **AI-powered emergency routing assistant** — Risk-aware navigation for critical deliveries.

## Overview

The SentinelChain Lite backend is a production-style **Node.js + Express** API that powers the route risk intelligence engine. It combines Google Directions data, real-time weather conditions, and traffic analysis to compute a weighted disruption risk score for every route alternative — then optionally sends all this structured data to **Gemini AI** for explainable reasoning.

---

## Architecture

```
Client (React Frontend)
        ↓
  Express API Layer (port 5000)
        ↓
  ┌─────────────────────────────────┐
  │         Services Layer          │
  │  mapsService    weatherService  │
  │  trafficService simulationEngine│
  │         riskBuilder             │
  │         geminiService           │
  └─────────────────────────────────┘
        ↓
  Structured JSON → Frontend Dashboard
```

---

## Folder Structure

```
backend/
├── src/
│   ├── app.js                      # Express app setup
│   ├── server.js                   # HTTP server bootstrap
│   │
│   ├── config/
│   │   └── apiKeys.js              # Centralised env config
│   │
│   ├── routes/
│   │   ├── routeRoutes.js          # POST /api/route
│   │   └── analysisRoutes.js       # All analysis endpoints
│   │
│   ├── controllers/
│   │   ├── routeController.js      # Route fetch handler
│   │   ├── analysisController.js   # Analysis + weather + traffic
│   │   └── simulationController.js # Simulation handler
│   │
│   ├── services/
│   │   ├── mapsService.js          # Module 1 — Google Directions API
│   │   ├── weatherService.js       # Module 2 — OpenWeatherMap API
│   │   ├── trafficService.js       # Module 3 — Traffic risk scoring
│   │   ├── riskBuilder.js          # Module 4 — Risk payload builder
│   │   ├── simulationEngine.js     # Module 5 — Disaster simulation
│   │   └── geminiService.js        # AI reasoning engine
│   │
│   └── middleware/
│       ├── errorHandler.js         # Global error handler
│       └── validate.js             # Joi request validation
│
├── .env                            # Environment variables (fill in keys)
├── .env.example                    # Template
├── .gitignore
└── package.json
```

---

## Quick Start

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Configure API keys

Edit `.env`:

```env
PORT=5000
NODE_ENV=development

GOOGLE_MAPS_KEY=your_key_here
WEATHER_API_KEY=your_key_here
GEMINI_API_KEY=your_key_here

# Set to true to use mock data (no API keys needed for demo)
USE_MOCK_DATA=false
```

> **Demo mode**: If no API keys are set, the server automatically uses realistic mock data with zero configuration needed.

### 3. Run the server

```bash
# Development (with hot reload)
npm run dev

# Production
npm start
```

Server starts on `http://localhost:5000`

---

## API Reference

### `POST /api/route`
Fetch route alternatives between source and destination.

**Request:**
```json
{
  "source": "Mumbai",
  "destination": "Pune",
  "mode": "driving"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "routes": [
      {
        "id": "route_A",
        "name": "Route A",
        "distance": "24.3 km",
        "duration": "42 mins",
        "durationInTraffic": "58 mins",
        "trafficImpact": "High",
        "polyline": [...],
        "riskFactors": [...],
        "steps": [...]
      }
    ]
  }
}
```

---

### `POST /api/analyze-route`
**Full pipeline**: routes → weather → traffic → weighted risk score → Gemini AI explanation.

**Request:**
```json
{
  "source": "Mumbai",
  "destination": "Pune"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "routes": [...],
    "riskPayloads": [
      {
        "routeId": "route_A",
        "riskScore": 77,
        "riskLevel": "High",
        "scoreBreakdown": {
          "traffic": { "weight": "40%", "score": 75, "contribution": 30 },
          "weather": { "weight": "40%", "score": 72, "contribution": 29 },
          "routeVulnerability": { "weight": "20%", "score": 38, "contribution": 8 }
        },
        "riskFactors": [...]
      }
    ],
    "recommendedRouteId": "route_B",
    "recommendedRouteName": "Route B",
    "delayAvoided": "13 mins",
    "aiAnalysis": {
      "recommendation": "Route B",
      "confidence": 78,
      "primaryReason": "...",
      "routeAnalysis": [...],
      "operationalAdvice": "..."
    }
  }
}
```

---

### `POST /api/weather`
Weather risk for a source-destination pair (samples origin, midpoint, destination).

**Request:** `{ "source": "...", "destination": "..." }`

**Response:**
```json
{
  "success": true,
  "data": {
    "weatherRisk": "High",
    "weatherScore": 72,
    "primaryCondition": "Heavy Rain",
    "temperature": 24,
    "alerts": ["Flood watch in effect"]
  }
}
```

---

### `POST /api/traffic`
Traffic congestion risk for all route alternatives.

**Request:** `{ "source": "...", "destination": "..." }`

**Response:**
```json
{
  "success": true,
  "data": {
    "routes": [
      {
        "routeId": "route_A",
        "trafficLevel": "High",
        "trafficScore": 75,
        "delayMinutes": 16,
        "description": "Heavy congestion on NH48"
      }
    ]
  }
}
```

---

### `POST /api/simulate`
Run a disaster scenario simulation with amplified risk conditions.

**Request:**
```json
{
  "source": "Mumbai",
  "destination": "Pune",
  "scenario": "flood",
  "severity": "critical"
}
```

**Scenarios:** `flood` | `storm` | `traffic_accident` | `normal`  
**Severity:** `low` | `medium` | `high` | `critical`

---

### `GET /api/scenarios`
Returns all available simulation scenario keys and metadata.

---

## Risk Scoring Formula

```
Final Risk Score = (40% × Traffic Score) + (40% × Weather Score) + (20% × Route Vulnerability)
```

| Component | Weight | Source |
|-----------|--------|--------|
| Traffic Score | 40% | Duration ratio vs. duration_in_traffic |
| Weather Score | 40% | OWM condition ID + rainfall + wind |
| Route Vulnerability | 20% | Keywords + distance + warnings |

**Risk Levels:**

| Score | Level |
|-------|-------|
| 0–14 | Minimal |
| 15–34 | Low |
| 35–59 | Moderate |
| 60–79 | High |
| 80–100 | Critical |

---

## AI Integration (Gemini)

When `GEMINI_API_KEY` is set, the backend sends a structured prompt to `gemini-1.5-flash` and receives:
- Per-route AI risk score
- Explainable driver-facing reasoning
- Operational advice
- Delivery safety classification (`isSafeForEmergencyDelivery`)

**Fallback:** When no Gemini key is present, the rule-based engine generates the same structured JSON output using heuristics.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 5000) |
| `NODE_ENV` | No | `development` / `production` |
| `GOOGLE_MAPS_KEY` | Recommended | Google Directions + Distance Matrix API |
| `WEATHER_API_KEY` | Recommended | OpenWeatherMap API key |
| `GEMINI_API_KEY` | Optional | Google Gemini AI for deep reasoning |
| `USE_MOCK_DATA` | No | Force mock data (`true`/`false`) |

---

## Getting API Keys

| Service | URL |
|---------|-----|
| Google Maps | https://console.cloud.google.com/apis/credentials |
| OpenWeatherMap | https://openweathermap.org/api |
| Gemini AI | https://aistudio.google.com/app/apikey |
