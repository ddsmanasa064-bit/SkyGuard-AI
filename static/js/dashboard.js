// SkyGuard AI - Deep Cyber Obsidian & Real-Time Alerting Engine JS

let tempChart = null;
let presChart = null;
let humChart = null;

let currentStation = 'AWS-001';
let pollInterval = null;

let isSirenEnabled = false;
let audioContext = null;

// Track toasted alert IDs to avoid duplicate toasts
const toastedAlertIds = new Set();

document.addEventListener('DOMContentLoaded', () => {
    initCharts();
    setupTabNavigation();
    setupEventListeners();
    fetchData();

    // Start auto polling loop (1 second interval)
    pollInterval = setInterval(fetchData, 1000);
});

// TAB NAVIGATION SYSTEM
function setupTabNavigation() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTabId = tab.getAttribute('data-tab');

            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-view').forEach(v => v.classList.remove('active'));

            tab.classList.add('active');
            const targetView = document.getElementById(targetTabId);
            if (targetView) {
                targetView.classList.add('active');
            }

            if (targetTabId === 'tabTelemetry') {
                if (tempChart) tempChart.resize();
                if (presChart) presChart.resize();
                if (humChart) humChart.resize();
            }
        });
    });
}

// INITIALIZE CHART.JS (CYBER OBSIDIAN THEME)
function initCharts() {
    const chartOptions = (label, color, minVal, maxVal) => ({
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 250 },
        scales: {
            x: {
                grid: { color: 'rgba(255, 255, 255, 0.04)' },
                ticks: { color: '#94A3B8', font: { family: 'JetBrains Mono', size: 10 } }
            },
            y: {
                grid: { color: 'rgba(255, 255, 255, 0.04)' },
                ticks: { color: '#94A3B8', font: { family: 'JetBrains Mono', size: 10 } },
                suggestedMin: minVal,
                suggestedMax: maxVal
            }
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#111827',
                titleColor: '#00F0FF',
                bodyColor: '#F8FAFC',
                borderColor: '#1E293B',
                borderWidth: 1,
                titleFont: { family: 'JetBrains Mono' },
                bodyFont: { family: 'JetBrains Mono' }
            }
        }
    });

    const ctxTemp = document.getElementById('tempChart').getContext('2d');
    tempChart = new Chart(ctxTemp, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Temperature (°C)',
                data: [],
                borderColor: '#00F0FF',
                backgroundColor: 'rgba(0, 240, 255, 0.08)',
                borderWidth: 2,
                fill: true,
                tension: 0.25,
                pointRadius: [],
                pointBackgroundColor: []
            }]
        },
        options: chartOptions('Temp', '#00F0FF', 20, 60)
    });

    const ctxPres = document.getElementById('presChart').getContext('2d');
    presChart = new Chart(ctxPres, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Pressure (hPa)',
                data: [],
                borderColor: '#00E676',
                backgroundColor: 'rgba(0, 230, 118, 0.08)',
                borderWidth: 2,
                fill: true,
                tension: 0.25,
                pointRadius: [],
                pointBackgroundColor: []
            }]
        },
        options: chartOptions('Pres', '#00E676', 990, 1030)
    });

    const ctxHum = document.getElementById('humChart').getContext('2d');
    humChart = new Chart(ctxHum, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Humidity (%)',
                data: [],
                borderColor: '#3B82F6',
                backgroundColor: 'rgba(59, 130, 246, 0.08)',
                borderWidth: 2,
                fill: true,
                tension: 0.25,
                pointRadius: [],
                pointBackgroundColor: []
            }]
        },
        options: chartOptions('Hum', '#3B82F6', 30, 100)
    });
}

// AUDIO SIREN SYNTHESIZER (WEB AUDIO API)
function playSirenSound() {
    if (!isSirenEnabled) return;

    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(900, audioContext.currentTime + 0.15);

        gain.gain.setValueAtTime(0.08, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);

        osc.connect(gain);
        gain.connect(audioContext.destination);

        osc.start();
        osc.stop(audioContext.currentTime + 0.2);
    } catch (e) {}
}

// SETUP EVENT LISTENERS
function setupEventListeners() {
    // Station dropdown
    document.getElementById('stationSelect').addEventListener('change', (e) => {
        currentStation = e.target.value;
        fetchData();
    });

    // Master Simulation Controls
    document.getElementById('btnStart').addEventListener('click', () => {
        fetch('/api/demo/start', { method: 'POST' }).then(() => fetchData());
    });

    document.getElementById('btnPause').addEventListener('click', () => {
        fetch('/api/demo/stop', { method: 'POST' }).then(() => fetchData());
    });

    document.getElementById('btnReset').addEventListener('click', () => {
        fetch('/api/demo/reset', { method: 'POST' }).then(() => {
            toastedAlertIds.clear();
            const toastContainer = document.getElementById('toastContainer');
            if (toastContainer) toastContainer.innerHTML = '';
            fetchData();
        });
    });

    // Siren Toggle
    const sirenBtn = document.getElementById('btnSirenToggle');
    if (sirenBtn) {
        sirenBtn.addEventListener('click', () => {
            isSirenEnabled = !isSirenEnabled;
            if (isSirenEnabled) {
                sirenBtn.classList.add('active');
                document.getElementById('sirenIcon').innerText = '🔊';
                document.getElementById('sirenLabel').innerText = 'Siren Sound: ON';
                playSirenSound();
            } else {
                sirenBtn.classList.remove('active');
                document.getElementById('sirenIcon').innerText = '🔔';
                document.getElementById('sirenLabel').innerText = 'Siren Sound: OFF';
            }
        });
    }

    // Intensity Slider Badge
    const magSlider = document.getElementById('paramMagnitude');
    const magBadge = document.getElementById('paramMagnitudeVal');
    if (magSlider && magBadge) {
        magSlider.addEventListener('input', (e) => {
            magBadge.innerText = `${parseFloat(e.target.value).toFixed(1)}x`;
        });
    }

    // Parametric Injection Buttons
    document.querySelectorAll('.btn-inject').forEach(btn => {
        btn.addEventListener('click', () => {
            const anomalyType = btn.getAttribute('data-type');
            const targetSensor = document.getElementById('paramTargetSensor').value;
            const magnitude = parseFloat(document.getElementById('paramMagnitude').value);
            const duration = parseInt(document.getElementById('paramDuration').value);

            fetch('/api/demo/inject', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    station_id: currentStation,
                    anomaly_type: anomalyType,
                    target_sensor: targetSensor,
                    magnitude: magnitude,
                    duration: duration
                })
            }).then(res => res.json()).then(() => {
                fetchData();
            });
        });
    });

    // Abort / Flush Injections Button
    const abortBtn = document.getElementById('btnAbortInjections');
    if (abortBtn) {
        abortBtn.addEventListener('click', () => {
            fetch('/api/demo/abort-injections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ station_id: currentStation })
            }).then(res => res.json()).then(() => {
                fetchData();
            });
        });
    }

    // Acknowledge Active Alert Button (in Audit Panel)
    const ackBtn = document.getElementById('btnAckActiveAlert');
    if (ackBtn) {
        ackBtn.addEventListener('click', () => {
            acknowledgeAllAlerts();
        });
    }
}

// ACKNOWLEDGE ALERTS
function acknowledgeAllAlerts(alertId = null) {
    fetch('/api/alerts/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ station_id: currentStation, alert_id: alertId })
    }).then(res => res.json()).then(() => {
        if (alertId) {
            const toastEl = document.getElementById(`toast-${alertId}`);
            if (toastEl) toastEl.remove();
        } else {
            const toastContainer = document.getElementById('toastContainer');
            if (toastContainer) toastContainer.innerHTML = '';
        }
        fetchData();
    });
}

// MAIN FETCH DATA FUNCTION
async function fetchData() {
    try {
        const [histRes, healthRes, anomaliesRes, statsRes, activeInjRes, alertsRes] = await Promise.all([
            fetch(`/api/history?station_id=${currentStation}&limit=40`),
            fetch(`/api/sensor-health?station_id=${currentStation}`),
            fetch(`/api/anomalies?station_id=${currentStation}`),
            fetch('/api/stats'),
            fetch(`/api/demo/active-injections?station_id=${currentStation}`),
            fetch(`/api/alerts?station_id=${currentStation}`)
        ]);

        const histData = await histRes.json();
        const healthData = await healthRes.json();
        const anomaliesData = await anomaliesRes.json();
        const statsData = await statsRes.json();
        const activeInjData = await activeInjRes.json();
        const alertsData = await alertsRes.json();

        if (histData.status === 'success' && histData.data.length > 0) {
            updateDashboard(
                histData.data,
                healthData.health,
                anomaliesData.anomalies,
                statsData.stats,
                activeInjData.injections || [],
                alertsData.alerts || []
            );
        }
    } catch (err) {
        console.error('Error fetching telemetry data:', err);
    }
}

// UPDATE ALL DASHBOARD PANELS
function updateDashboard(history, health, anomalies, stats, activeInjections, alerts) {
    const latest = history[history.length - 1];

    // 1. UPDATE KPI CARDS
    const tempVal = latest.temperature !== 'NULL' ? latest.temperature : 'N/A';
    const presVal = latest.pressure !== 'NULL' ? latest.pressure : 'N/A';
    const humVal = latest.humidity !== 'NULL' ? latest.humidity : 'N/A';

    document.getElementById('kpiTemp').innerText = tempVal;
    document.getElementById('kpiPres').innerText = presVal;
    document.getElementById('kpiHum').innerText = humVal;
    document.getElementById('kpiTempSub').innerText = `Expected: ~${latest.estimated_temp} °C`;

    document.getElementById('kpiAnomalies').innerText = stats.active_anomalies;
    document.getElementById('kpiUnackAlerts').innerText = stats.unacknowledged_alerts || 0;

    const healthCard = document.getElementById('kpiHealth');
    const healthStatus = health.overall || 'HEALTHY';
    healthCard.innerText = healthStatus;

    if (healthStatus === 'HEALTHY') {
        healthCard.className = 'kpi-value health-text';
    } else if (healthStatus === 'WARNING') {
        healthCard.className = 'kpi-value text-warning';
    } else {
        healthCard.className = 'kpi-value text-danger';
    }

    // 2. HEADER ALERT BELL & SIREN
    const unackCount = stats.unacknowledged_alerts || 0;
    const alertBellWrapper = document.getElementById('alertBellWrapper');
    const unackCountBadge = document.getElementById('unackAlertCount');

    if (unackCount > 0) {
        alertBellWrapper.classList.remove('hidden');
        unackCountBadge.innerText = unackCount;
        playSirenSound();
    } else {
        alertBellWrapper.classList.add('hidden');
    }

    // 3. PROCESS FLOATING TOAST ALERTS
    const unackAlerts = alerts.filter(a => a.status === 'UNACKNOWLEDGED');
    unackAlerts.forEach(alt => {
        if (!toastedAlertIds.has(alt.id)) {
            toastedAlertIds.add(alt.id);
            spawnToastAlert(alt);
        }
    });

    // 4. UPDATE LIVE TELEMETRY CHARTS
    const timestamps = history.map(h => h.timestamp);
    const temps = history.map(h => h.temperature === 'NULL' ? null : h.temperature);
    const pres = history.map(h => h.pressure === 'NULL' ? null : h.pressure);
    const hums = history.map(h => h.humidity === 'NULL' ? null : h.humidity);

    const tempRadii = history.map(h => h.is_anomaly ? 7 : 2.5);
    const tempColors = history.map(h => h.is_anomaly ? '#FF2A5F' : '#00F0FF');

    const presRadii = history.map(h => h.is_anomaly ? 7 : 2.5);
    const presColors = history.map(h => h.is_anomaly ? '#FF2A5F' : '#00E676');

    const humRadii = history.map(h => h.is_anomaly ? 7 : 2.5);
    const humColors = history.map(h => h.is_anomaly ? '#FF2A5F' : '#3B82F6');

    updateChartData(tempChart, timestamps, temps, tempRadii, tempColors);
    updateChartData(presChart, timestamps, pres, presRadii, presColors);
    updateChartData(humChart, timestamps, hums, humRadii, humColors);

    // 5. UPDATE ANOMALY ALERT PANEL (AUDIT VIEW)
    const normalView = document.getElementById('anomalyNormalView');
    const activeView = document.getElementById('anomalyActiveView');
    const statusBadge = document.getElementById('anomalyStatusBadge');
    const ackBtn = document.getElementById('btnAckActiveAlert');

    if (latest.is_anomaly) {
        normalView.classList.add('hidden');
        activeView.classList.remove('hidden');

        statusBadge.className = 'badge badge-danger';
        statusBadge.innerText = '⚠ ANOMALY DETECTED';
        if (ackBtn) ackBtn.classList.remove('hidden');

        document.getElementById('detAnomalyType').innerText = latest.anomaly_type;
        
        const sevBadge = document.getElementById('detSeverityBadge');
        sevBadge.innerText = latest.severity;
        sevBadge.className = latest.severity === 'HIGH' || latest.severity === 'CRITICAL' ? 'badge badge-danger' : 'badge badge-warning';

        document.getElementById('detConfidence').innerText = `${latest.confidence}%`;
        document.getElementById('detTimestamp').innerText = latest.timestamp;
        document.getElementById('detStationSensor').innerText = `${latest.station_id} (${latest.target_sensor})`;
        document.getElementById('detEventAttribution').innerText = latest.event_type;

        // Update Multi-Channel Dispatch Card
        document.getElementById('dispSmsText').innerText = `SMS Sent to +91 98765-XXXXX | ${latest.anomaly_type} (${latest.severity})`;
        document.getElementById('dispEmailText').innerText = `Email Sent to alert@imd.gov.in | Confidence ${latest.confidence}%`;
        document.getElementById('dispWebhookText').innerText = `HTTP POST https://api.imd-aws.gov.in/v1/alerts -> 200 OK`;
    } else {
        normalView.classList.remove('hidden');
        activeView.classList.add('hidden');

        statusBadge.className = 'badge badge-success';
        statusBadge.innerText = '✓ NORMAL';
        if (ackBtn) ackBtn.classList.add('hidden');

        document.getElementById('dispSmsText').innerText = 'Target: +91 98765-XXXXX | System Normal';
        document.getElementById('dispEmailText').innerText = 'Target: alert@imd.gov.in | System Normal';
        document.getElementById('dispWebhookText').innerText = 'Endpoint: https://api.imd-aws.gov.in/v1/alerts | Standby';
    }

    // 6. UPDATE EXPLAINABLE AI PANEL
    const xaiBullets = document.getElementById('xaiBullets');
    if (latest.reasoning_bullets && latest.reasoning_bullets.length > 0) {
        xaiBullets.innerHTML = latest.reasoning_bullets.map(b => `<li>${b}</li>`).join('');
    }

    if (latest.contribution_bars) {
        const bars = latest.contribution_bars;
        setBarWidth('fillTempDev', 'valTempDevBar', bars.temp_deviation);
        setBarWidth('fillRoc', 'valRocBar', bars.rate_of_change);
        setBarWidth('fillMulti', 'valMultiBar', bars.multivariate_inconsistency);
        setBarWidth('fillHist', 'valHistBar', bars.historical_deviation);
    }

    // 7. UPDATE DATA QUALITY CORRECTION CARD
    const origDisp = document.getElementById('origValueDisplay');
    const estDisp = document.getElementById('estValueDisplay');
    const qualBadge = document.getElementById('qualityStatusBadge');

    origDisp.innerText = latest.temperature !== 'NULL' ? `${latest.temperature} °C` : 'NULL';
    estDisp.innerText = `${latest.estimated_temp} °C`;

    if (latest.is_anomaly) {
        qualBadge.className = 'badge badge-warning';
        qualBadge.innerText = '⚠ Suspected Sensor Error';
    } else {
        qualBadge.className = 'badge badge-success';
        qualBadge.innerText = 'Data Valid';
    }

    // 8. UPDATE HARDWARE DIAGNOSTICS & HEALTH PANELS
    document.getElementById('tempHealthPct').innerText = `${health.temp_health || 98}%`;
    document.getElementById('presHealthPct').innerText = `${health.pres_health || 100}%`;
    document.getElementById('humHealthPct').innerText = `${health.hum_health || 97}%`;

    setHealthBar('tempHealthBar', health.temp_health || 98);
    setHealthBar('presHealthBar', health.pres_health || 100);
    setHealthBar('humHealthBar', health.hum_health || 97);

    document.getElementById('healthOverallBadge').innerText = health.overall || 'HEALTHY';
    document.getElementById('healthOverallBadge').className = getBadgeClassForHealth(health.overall);
    document.getElementById('recommendedActionText').innerText = latest.action_recommendation || 'System operating normally.';

    document.getElementById('diagTempBase').innerText = `${latest.estimated_temp || 31.2} °C`;
    document.getElementById('diagTempOffset').innerText = `${health.temp_offset || 0.0} °C`;
    document.getElementById('diagTempStatus').innerText = health.temp_health >= 85 ? 'HEALTHY' : (health.temp_health >= 60 ? 'WARNING' : 'DEGRADED');
    document.getElementById('diagTempStatus').className = getBadgeClassForPct(health.temp_health || 98);

    document.getElementById('diagPresBase').innerText = `${latest.estimated_pres || 1012.6} hPa`;
    document.getElementById('diagPresOffset').innerText = `${health.pres_offset || 0.0} hPa`;
    document.getElementById('diagPresStatus').innerText = health.pres_health >= 85 ? 'HEALTHY' : (health.pres_health >= 60 ? 'WARNING' : 'DEGRADED');
    document.getElementById('diagPresStatus').className = getBadgeClassForPct(health.pres_health || 100);

    document.getElementById('diagHumBase').innerText = `${latest.estimated_hum || 67.0} %`;
    document.getElementById('diagHumOffset').innerText = `${health.hum_offset || 0.0} %`;
    document.getElementById('diagHumStatus').innerText = health.hum_health >= 85 ? 'HEALTHY' : (health.hum_health >= 60 ? 'WARNING' : 'DEGRADED');
    document.getElementById('diagHumStatus').className = getBadgeClassForPct(health.hum_health || 97);

    document.getElementById('diagPacketLoss').innerText = `${health.packet_loss_pct || 0.1}%`;

    // 9. UPDATE ACTIVE INJECTIONS TABLE
    updateActiveInjectionsTable(activeInjections);

    // 10. UPDATE ANOMALY HISTORY TABLE
    updateAnomalyTable(anomalies);
}

// SPAWN FLOATING TOAST ALERT
function spawnToastAlert(alertObj) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast-alert';
    toast.id = `toast-${alertObj.id}`;

    toast.innerHTML = `
        <div class="toast-header">
            <span class="toast-title">🚨 ANOMALY ALERT (${alertObj.severity})</span>
            <span class="mono" style="font-size: 0.7rem; color: #94A3B8;">${alertObj.timestamp}</span>
        </div>
        <div class="toast-body">
            <strong>${alertObj.anomaly_type}</strong> detected at <strong>${alertObj.station_id}</strong> (${alertObj.target_sensor}). Confidence: ${alertObj.confidence}%
        </div>
        <div style="text-align: right;">
            <button class="btn-toast-ack" onclick="acknowledgeAllAlerts('${alertObj.id}')">✔ Acknowledge</button>
        </div>
    `;

    container.appendChild(toast);

    // Auto remove toast after 10 seconds if not acknowledged
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 10000);
}

function updateChartData(chart, labels, data, radii, colors) {
    if (!chart) return;
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.data.datasets[0].pointRadius = radii;
    chart.data.datasets[0].pointBackgroundColor = colors;
    chart.update('none');
}

function setBarWidth(fillId, textId, pct) {
    const fillEl = document.getElementById(fillId);
    const textEl = document.getElementById(textId);
    if (fillEl && textEl) {
        fillEl.style.width = `${pct}%`;
        textEl.innerText = `${pct}%`;
    }
}

function setHealthBar(barId, pct) {
    const el = document.getElementById(barId);
    if (el) {
        el.style.width = `${pct}%`;
        if (pct >= 85) el.className = 'bar-fill fill-green';
        else if (pct >= 60) el.className = 'bar-fill fill-orange';
        else el.className = 'bar-fill fill-red';
    }
}

function getBadgeClassForHealth(status) {
    if (status === 'HEALTHY') return 'badge badge-success';
    if (status === 'WARNING') return 'badge badge-warning';
    return 'badge badge-danger';
}

function getBadgeClassForPct(pct) {
    if (pct >= 85) return 'badge badge-success';
    if (pct >= 60) return 'badge badge-warning';
    return 'badge badge-danger';
}

function updateActiveInjectionsTable(injections) {
    const tbody = document.getElementById('activeInjTableBody');
    if (!tbody) return;

    if (!injections || injections.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-muted text-center">No active injection jobs queued. Select a fault type above to trigger.</td></tr>`;
        return;
    }

    tbody.innerHTML = injections.map(j => `
        <tr>
            <td class="mono" style="color: #00F0FF;">${j.id}</td>
            <td>${j.station_id}</td>
            <td><strong style="color: #FFA5B8;">${j.anomaly_type}</strong></td>
            <td>${j.target_sensor}</td>
            <td class="mono">${j.magnitude}x</td>
            <td class="mono">${j.duration_remaining} / ${j.total_duration}</td>
            <td class="mono">${j.injected_at}</td>
            <td><span class="badge badge-warning">${j.status}</span></td>
        </tr>
    `).join('');
}

function updateAnomalyTable(anomalies) {
    const tbody = document.getElementById('anomalyTableBody');
    const badgeCount = document.getElementById('historyCountBadge');

    if (badgeCount) badgeCount.innerText = `${anomalies.length} Events`;
    if (!tbody) return;

    if (!anomalies || anomalies.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-muted text-center">No anomalies logged. Use the Injection Studio to simulate faults.</td></tr>`;
        return;
    }

    tbody.innerHTML = anomalies.slice(0, 20).map(a => `
        <tr>
            <td class="mono">${a.timestamp}</td>
            <td>${a.station_id}</td>
            <td>${a.target_sensor}</td>
            <td><strong style="color: #FFA5B8;">${a.anomaly_type}</strong></td>
            <td><span class="${a.severity === 'HIGH' || a.severity === 'CRITICAL' ? 'badge badge-danger' : 'badge badge-warning'}">${a.severity}</span></td>
            <td class="mono">${a.confidence}%</td>
            <td><span style="font-size: 0.72rem; color: #94A3B8;">${a.event_type}</span></td>
        </tr>
    `).join('');
}
