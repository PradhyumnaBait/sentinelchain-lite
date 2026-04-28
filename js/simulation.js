/* ═══════════════════════════════════════════════════
   SENTINELCHAIN LITE — Simulation Engine (Part 7)
   Async runSimulation, live re-render, state object
═══════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ══ State ══════════════════════════════════════ */
  const state = {
    scenario: null,
    severity: 50,
    result: null,
    loading: false
  };

  /* ══ Mock Data ══════════════════════════════════ */
  const SCENARIOS = {
    'port-strike': {
      baseRisk:65, delay:4.2, cost:18, alt:'Route B',
      note:'Port strike disrupts loading. Route B via Cape of Good Hope recommended.',
      timeline:[
        { day:2,  label:'Port Strike Begins',    desc:'Singapore Tanjong Pagar — 72h backlog est.',      level:'danger' },
        { day:5,  label:'Congestion Peaks',       desc:'Container queues 3× normal; diversions advised.',  level:'danger' },
        { day:9,  label:'Strike Partially Resolved', desc:'Port at 60% capacity; delays continue.',        level:'warn'   },
        { day:14, label:'Operations Restored',    desc:'Full capacity resumed. Route A viable again.',     level:'safe'   }
      ]
    },
    'typhoon': {
      baseRisk:80, delay:6.0, cost:25, alt:'Route B',
      note:'Typhoon path crosses Route A corridor. Divert immediately to Route B.',
      timeline:[
        { day:1,  label:'Typhoon Watch Issued',   desc:'Category 2 storm 480km east of Philippines.',     level:'warn'   },
        { day:3,  label:'Typhoon Warning Active',  desc:'Route A corridor within projected path.',          level:'danger' },
        { day:6,  label:'Landfall — Avoid Zone',   desc:'All vessels advised to hold or reroute.',          level:'danger' },
        { day:10, label:'Storm Clears',            desc:'Route A re-opens. Expect debris and swell.',       level:'safe'   }
      ]
    },
    'conflict': {
      baseRisk:92, delay:9.0, cost:42, alt:'Air Freight',
      note:'Armed conflict makes sea routes untenable. Air freight is the only safe option.',
      timeline:[
        { day:1,  label:'Conflict Zone Active',   desc:'Red Sea corridor under active threat.',             level:'danger' },
        { day:4,  label:'Shipping Halt',          desc:'Lloyd\'s War Risk listed. Insurance suspended.',    level:'danger' },
        { day:7,  label:'Naval Escort Available', desc:'Limited convoy option — 3× cost premium.',         level:'warn'   },
        { day:14, label:'Situation Unresolved',   desc:'Avoid corridor indefinitely.',                      level:'danger' }
      ]
    },
    'pandemic': {
      baseRisk:55, delay:3.5, cost:12, alt:'Route A',
      note:'Pandemic lockdown causes customs delays. Route A with reduced cargo is viable.',
      timeline:[
        { day:2,  label:'Border Controls Tightened', desc:'Enhanced screening adds 24–48h at ports.',      level:'warn'   },
        { day:5,  label:'Customs Backlog',           desc:'Singapore: 2-day customs processing delay.',    level:'warn'   },
        { day:8,  label:'Crew Health Protocol',      desc:'All crew require PCR testing pre-departure.',   level:'warn'   },
        { day:14, label:'Controls Easing',           desc:'Processing times returning to normal.',          level:'safe'   }
      ]
    },
    'customs': {
      baseRisk:40, delay:2.0, cost:8, alt:'Route A',
      note:'Customs delay is manageable. Add buffer time; Route A remains best.',
      timeline:[
        { day:1,  label:'Documentation Review',   desc:'Spot-check inspection at Singapore customs.',      level:'warn'   },
        { day:3,  label:'Clearance Delayed',      desc:'Additional 36h processing for manifest review.',  level:'warn'   },
        { day:5,  label:'Clearance Granted',      desc:'Cargo cleared with 2-day delay.',                  level:'safe'   },
        { day:7,  label:'Voyage Resumes',         desc:'Back on schedule — no further issues expected.',   level:'safe'   }
      ]
    },
    'piracy': {
      baseRisk:75, delay:5.0, cost:22, alt:'Route B',
      note:'Piracy advisory in Gulf of Aden. Route B avoids the affected corridor.',
      timeline:[
        { day:1,  label:'Piracy Advisory Issued', desc:'IMB alert: 3 incidents near Gulf of Aden.',        level:'danger' },
        { day:3,  label:'Vessel Shadow Reported', desc:'Armed escort required for Route C transit.',       level:'danger' },
        { day:6,  label:'Naval Patrol Deployed',  desc:'Coalition warships dispatched to corridor.',       level:'warn'   },
        { day:12, label:'Advisory Downgraded',    desc:'Reduced activity; corridor partially re-opens.',   level:'safe'   }
      ]
    }
  };

  /* ══ Mock API ═══════════════════════════════════ */
  const rand     = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const sleep    = ms => new Promise(r => setTimeout(r, ms));

  async function runSimulation(scenarioKey, severity) {
    await sleep(rand(800, 1400));
    const data = SCENARIOS[scenarioKey];
    if (!data) throw new Error('Unknown scenario');
    const sf           = severity / 100;
    const adjustedRisk = Math.min(99, Math.round(data.baseRisk * (0.5 + sf * 0.7)));
    const delay        = (data.delay * (0.6 + sf * 0.8)).toFixed(1);
    const cost         = Math.round(data.cost * (0.6 + sf * 0.8));
    const delta        = `▲ +${Math.round(adjustedRisk - data.baseRisk * 0.5)} pts`;
    const riskProfile  = generateProfile(adjustedRisk, 14);
    return { adjustedRisk, delay:`+${delay} days`, cost:`+${cost}%`, delta, alt:data.alt, note:data.note, riskProfile, timeline:data.timeline };
  }

  function generateProfile(peak, count) {
    const peakPos = Math.floor(count * 0.35);
    return Array.from({ length: count }, (_, i) => {
      const dist  = Math.abs(i - peakPos);
      const decay = Math.max(0, peak - dist * (peak / (count * 0.6)));
      return Math.min(99, Math.max(10, Math.round(decay + (Math.random() - 0.5) * 10)));
    });
  }

  /* ══ DOM Refs ════════════════════════════════════ */
  const $ = id => document.getElementById(id);
  const sidebar        = $('sidebar');
  const hamburger      = $('hamburger-btn');
  const severitySlider = $('severity-slider');
  const severityVal    = $('severity-val');
  const scenarioSel    = $('scenario-select');
  const runBtn         = $('run-simulation-btn');
  const resetBtn       = $('reset-simulation-btn');
  const gaugeFill      = $('gauge-fill');
  const gaugeScore     = $('gauge-score');
  const gaugeBadge     = $('gauge-badge');
  const impactDelay    = $('impact-delay-val');
  const impactCost     = $('impact-cost-val');
  const impactRisk     = $('impact-risk-val');
  const impactAlt      = $('impact-alt-val');
  const impactNote     = $('impact-note');
  const chartBars      = document.querySelectorAll('.chart-bar');

  /* ══ Helpers ════════════════════════════════════ */
  const riskLvl   = s => s >= 70 ? 'high' : s >= 40 ? 'medium' : 'low';
  const riskLbl   = s => s >= 70 ? 'High Risk' : s >= 40 ? 'Medium Risk' : 'Low Risk';
  const riskColor = s => s >= 70 ? 'var(--clr-risk-high)' : s >= 40 ? 'var(--clr-risk-medium)' : 'var(--clr-risk-safe)';

  /* ══ Render result ═══════════════════════════════ */
  function renderResult(result) {
    const { adjustedRisk, delay, cost, delta, alt, note, riskProfile, timeline } = result;

    // Gauge
    if (gaugeFill)  gaugeFill.style.width = `${adjustedRisk}%`;
    if (gaugeScore) {
      gaugeScore.textContent = adjustedRisk;
      gaugeScore.style.color = riskColor(adjustedRisk);
      gaugeScore.setAttribute('aria-label', `Risk score ${adjustedRisk}`);
    }
    if (gaugeBadge) {
      gaugeBadge.className  = `risk-badge risk-badge--${riskLvl(adjustedRisk)}`;
      gaugeBadge.textContent = riskLbl(adjustedRisk);
    }

    // Impact metrics + mini-bars
    if (impactDelay) {
      impactDelay.textContent = delay;
      impactDelay.style.color = 'var(--clr-risk-medium)';
      const pct = Math.min(100, parseFloat(delay) / 10 * 100);
      const delayParent = impactDelay.closest('.metric, .impact-item, td, div');
      if (delayParent && !delayParent.querySelector('.mini-bar')) {
        const bar = document.createElement('div');
        bar.className = 'mini-bar';
        bar.style.width = `${pct}%`;
        delayParent.appendChild(bar);
      } else if (delayParent?.querySelector('.mini-bar')) {
        delayParent.querySelector('.mini-bar').style.width = `${pct}%`;
      }
    }
    if (impactCost)  { impactCost.textContent  = cost;   impactCost.style.color  = 'var(--clr-risk-medium)'; }
    if (impactRisk)  { impactRisk.textContent  = delta;  impactRisk.style.color  = riskColor(adjustedRisk); }
    if (impactAlt)   { impactAlt.textContent   = alt; }
    if (impactNote)  impactNote.textContent = note;

    // Chart bars — add risk-bar-box for staggered grow animation
    riskProfile.forEach((val, i) => {
      const bar = chartBars[i];
      if (!bar) return;
      bar.style.height = `${val}%`;
      bar.className = (val >= 70 ? 'chart-bar chart-bar--peak' : 'chart-bar') + ' risk-bar-box';
    });

    // Timeline
    if (timeline) renderTimeline(timeline);
  }

  /* ══ Render timeline ════════════════════════════ */
  const timelineEl = $('risk-timeline');
  function renderTimeline(events) {
    if (!timelineEl) return;
    const LEVEL_MAP = { danger:'danger', warn:'warn', safe:'safe' };
    const BADGE_MAP = { danger:'high',  warn:'medium', safe:'low'  };
    const BADGE_LBL = { danger:'High',  warn:'Medium', safe:'Low'  };
    timelineEl.innerHTML = events.map((ev, i) => `
      <li class="timeline-event timeline-event--${LEVEL_MAP[ev.level]}" id="timeline-ev-${i+1}">
        <span class="timeline-event__dot" aria-hidden="true"></span>
        <div class="timeline-event__content">
          <p class="timeline-event__label">Day ${ev.day} — ${ev.label}</p>
          <p class="timeline-event__desc">${ev.desc}</p>
        </div>
        <span class="risk-badge risk-badge--${BADGE_MAP[ev.level]}">${BADGE_LBL[ev.level]}</span>
      </li>`).join('');
  }

  /* ══ Loading state ═══════════════════════════════ */
  function setRunning(loading) {
    if (!runBtn) return;
    runBtn.disabled = loading;
    runBtn.textContent = loading ? 'Simulating disruption impact…' : '⚡ Run Simulation';
    runBtn.style.opacity = loading ? '0.7' : '';
  }

  /* ══ Severity slider ════════════════════════════ */
  if (severitySlider && severityVal) {
    severitySlider.addEventListener('input', () => {
      state.severity = parseInt(severitySlider.value, 10);
      severityVal.textContent = state.severity;
    });
  }

  /* ══ Run Simulation ═════════════════════════════ */
  if (runBtn) {
    runBtn.addEventListener('click', async () => {
      if (state.loading) return; // prevent duplicate
      const scenarioKey = scenarioSel?.value;
      if (!scenarioKey) {
        showModal('Select a Scenario', 'Please choose a disruption scenario from the dropdown before running the simulation.');
        return;
      }

      state.loading = true;
      state.scenario = scenarioKey;
      state.severity = parseInt(severitySlider?.value ?? '50', 10);
      setRunning(true);

      // Mark scenario card as active (LIVE indicator)
      document.querySelectorAll('.scenario-active').forEach(el => el.classList.remove('scenario-active'));
      scenarioSel?.closest('.card, .panel, .sim-card, section, div')?.classList.add('scenario-active');

      try {
        const result  = await runSimulation(scenarioKey, state.severity);
        state.result  = result;
        renderResult(result);
      } catch (_) {
        showModal('Error', 'Simulation failed. Please try again.');
      } finally {
        state.loading = false;
        setRunning(false);
      }
    });
  }

  /* ══ Reset ══════════════════════════════════════ */
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (state.loading) return;
      state.result   = null;
      state.scenario = null;
      if (scenarioSel)    scenarioSel.value = '';
      if (severitySlider) { severitySlider.value = 50; }
      if (severityVal)    severityVal.textContent = '50';
      if (gaugeFill)      gaugeFill.style.width = '0%';
      if (gaugeScore)     { gaugeScore.textContent = '—'; gaugeScore.style.color = ''; }
      if (gaugeBadge)     { gaugeBadge.className = 'risk-badge'; gaugeBadge.textContent = '—'; }
      if (impactDelay)    impactDelay.textContent = '—';
      if (impactCost)     impactCost.textContent  = '—';
      if (impactRisk)     impactRisk.textContent  = '—';
      if (impactAlt)      impactAlt.textContent   = '—';
      if (impactNote)     impactNote.textContent  = 'Run a simulation to see the impact summary.';
      chartBars.forEach(b => { b.style.height = '10%'; b.className = 'chart-bar'; });
      // Remove LIVE indicator
      document.querySelectorAll('.scenario-active').forEach(el => el.classList.remove('scenario-active'));

    });
  }

  /* ══ Boot: initial chart ════════════════════════ */
  renderResult({ adjustedRisk:42, delay:'+2.1 days', cost:'+9%', delta:'▲ +12 pts', alt:'Route A', note:'Run a simulation to see live impact analysis.', riskProfile: generateProfile(42, 14) });

  /* ══ Hamburger ══════════════════════════════════ */
  if (hamburger && sidebar) {
    hamburger.addEventListener('click', () => {
      const open = sidebar.classList.toggle('is-open');
      hamburger.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', e => {
      if (!sidebar.contains(e.target) && !hamburger.contains(e.target)) {
        sidebar.classList.remove('is-open');
        hamburger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ══ Modal system (shared) ══════════════════════ */
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
    $('nmc').onclick = () => ov.remove();
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { ov.remove(); document.removeEventListener('keydown', esc); }
    });
  }

  /* ══ Sidebar modals ═════════════════════════════ */
  $('sidebar-alerts')  ?.addEventListener('click', e => { e.preventDefault(); showModal('🔔 Alerts',        "Alerts panel coming soon. Real-time risk notifications and route advisories will appear here."); });
  $('sidebar-settings')?.addEventListener('click', e => { e.preventDefault(); showModal('⚙ Settings',      'Settings panel coming soon. Configure risk thresholds, preferences, and display options.'); });
  $('sidebar-history') ?.addEventListener('click', e => { e.preventDefault(); showModal('📋 Route History', 'Route history coming soon. View and re-analyze previously searched routes.'); });

})();
