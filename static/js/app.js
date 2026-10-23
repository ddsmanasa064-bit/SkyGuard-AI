const { useState, useEffect, useRef } = React;

// 10-Step Automated Demo Story Tour Configuration
const DEMO_TOUR_STEPS = [
    { title: "1. Normal Baseline State", scenario: "normal", desc: "All 8 AWS stations operating within normal physical & spatial parameters.", view: "overview" },
    { title: "2. Stuck Sensor Fault", scenario: "stuck_sensor", desc: "Station #3 (AWS-003) Temperature drops to 22.4°C and flatlines completely.", view: "overview" },
    { title: "3. Sensor Drift Anomaly", scenario: "sensor_drift", desc: "Station #5 (AWS-005) Relative Humidity drifts upward (+0.8%/step) away from spatial reality.", view: "stations" },
    { title: "4. Communication Failure", scenario: "comm_failure", desc: "Station #1 (AWS-001) telemetry flatlines to null values (RS485/cellular drop).", view: "live-monitoring" },
    { title: "5. Heavy Rainfall Verification", scenario: "heavy_rainfall", desc: "Station #7 registers 68.5mm rain; neighbor AWS-006 cross-verifies it as a genuine storm event.", view: "spatial-network" },
    { title: "6. Regional Weather Front", scenario: "weather_front", desc: "Rapid temperature drop sweeping across Stations 2, 4, and 6 sequentially.", view: "overview" },
    { title: "7. Physics Law Violation", scenario: "physics_violation", desc: "Station #8 reports high RH (94%) with zero dewpoint convergence (psychrometric violation).", view: "physics-engine" },
    { title: "8. Edge Power Drop", scenario: "power_drop", desc: "Station #4 edge battery drops to 2.9V (< 3.2V threshold), indicating solar charger fault.", view: "stations" },
    { title: "9. Technician Data Reconstruction", scenario: "sensor_drift", desc: "Technician evaluates IDW + lapse rate data reconstruction (31.6°C proposed vs 37.8°C raw).", view: "data-reconstruction" },
    { title: "10. Operator Alert Resolution", scenario: "sensor_drift", desc: "Technician inputs verification notes and resolves alert.", view: "alerts" }
];

// Audio Alert Synthesizer
function playAudioAlert(severity = 'CRITICAL') {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = severity === 'CRITICAL' ? 'sawtooth' : 'sine';
        osc.frequency.setValueAtTime(severity === 'CRITICAL' ? 880 : 587.33, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.4);
    } catch (e) {
        console.warn("Audio Context disabled by browser policy:", e);
    }
}

function SkyGuardApp() {
    const [activeView, setActiveView] = useState('overview');
    const [kpis, setKpis] = useState({ total_stations: 8, healthy_stations: 8, active_alerts: 0, data_quality_pct: 100, physics_consistency_pct: 99.0, spatial_consensus_pct: 95.8, active_scenario: 'normal', streaming_active: true });
    const [stations, setStations] = useState({});
    const [alerts, setAlerts] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [activityLogs, setActivityLogs] = useState([]);
    const [drawerAlert, setDrawerAlert] = useState(null);
    const [stationModalId, setStationModalId] = useState(null);
    const [showDatasetModal, setShowDatasetModal] = useState(false);
    const [showNotificationDrawer, setShowNotificationDrawer] = useState(false);
    const [audioAlertEnabled, setAudioAlertEnabled] = useState(true);
    const [resolutionModalAlert, setResolutionModalAlert] = useState(null);
    const [resolutionNotes, setResolutionNotes] = useState('');
    const [toastMessage, setToastMessage] = useState(null);
    const [activeDatasetName, setActiveDatasetName] = useState('aws_demo_data.csv');
    const [streamingPaused, setStreamingPaused] = useState(false);

    // Tour State
    const [tourActive, setTourActive] = useState(false);
    const [tourStep, setTourStep] = useState(0);
    const [tourPaused, setTourPaused] = useState(false);

    const prevAlertsCountRef = useRef(0);

    // Load initial state
    useEffect(() => {
        refreshAll();
        const interval = setInterval(() => {
            if (!streamingPaused) refreshAll();
        }, 3500);
        return () => clearInterval(interval);
    }, [streamingPaused]);

    // Tour Step Timer
    useEffect(() => {
        if (tourActive && !tourPaused) {
            const timer = setTimeout(() => {
                if (tourStep < DEMO_TOUR_STEPS.length - 1) {
                    const nextStep = tourStep + 1;
                    setTourStep(nextStep);
                    executeTourStep(nextStep);
                } else {
                    setTourActive(false);
                    showToast("▶ Automated Story Tour Completed!", "success");
                }
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [tourActive, tourStep, tourPaused]);

    const showToast = (msg, type = 'info') => {
        setToastMessage({ text: msg, type: type });
        setTimeout(() => setToastMessage(null), 3500);
    };

    const refreshAll = async () => {
        try {
            const [resKpi, resSt, resAlt, resLog, resNotif] = await Promise.all([
                fetch('/api/kpis').then(r => r.json()),
                fetch('/api/stations').then(r => r.json()),
                fetch('/api/alerts').then(r => r.json()),
                fetch('/api/activity-log').then(r => r.json()),
                fetch('/api/notifications').then(r => r.json())
            ]);
            if (resKpi.status === 'success') setKpis(resKpi.kpis);
            if (resSt.status === 'success') setStations(resSt.stations);
            if (resAlt.status === 'success') {
                setAlerts(resAlt.alerts);
                if (audioAlertEnabled && resAlt.alerts.length > prevAlertsCountRef.current && prevAlertsCountRef.current > 0) {
                    playAudioAlert(resAlt.alerts[0]?.severity || 'CRITICAL');
                }
                prevAlertsCountRef.current = resAlt.alerts.length;
            }
            if (resLog.status === 'success') setActivityLogs(resLog.logs);
            if (resNotif.status === 'success') {
                setNotifications(resNotif.notifications);
                setUnreadCount(resNotif.unread_count);
            }
        } catch (e) {
            console.error("Failed to refresh global state:", e);
        }
    };

    // Global State Triggers
    const runAnalysisPass = async () => {
        showToast("⚡ Executing backend physics & spatial analysis pass...", "info");
        try {
            const res = await fetch('/api/run-analysis', { method: 'POST' });
            const data = await res.json();
            if (data.status === 'success') {
                setKpis(data.kpis);
                setStations(data.stations);
                await refreshAll();
                showToast("Analysis complete. Synchronized state across all 11 views.", "success");
            }
        } catch (e) {
            showToast("Analysis pass failed.", "error");
        }
    };

    const triggerScenario = async (scenarioName) => {
        try {
            const res = await fetch('/api/scenario/inject', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scenario_name: scenarioName })
            });
            const data = await res.json();
            if (data.status === 'success') {
                setKpis(data.kpis);
                setStations(data.stations);
                await refreshAll();
                showToast(`Scenario active: ${scenarioName.toUpperCase().replace('_', ' ')}`, "warning");
            }
        } catch (e) {
            showToast("Failed to trigger scenario.", "error");
        }
    };

    const resetSystemGlobal = async () => {
        try {
            const res = await fetch('/api/scenario/reset', { method: 'POST' });
            const data = await res.json();
            if (data.status === 'success') {
                setKpis(data.kpis);
                setStations(data.stations);
                await refreshAll();
                showToast("Reset System: Cleared active scenarios, restored baseline healthy graphs across all stations.", "success");
            }
        } catch (e) {
            showToast("Reset failed.", "error");
        }
    };

    const acknowledgeAlert = async (alertId) => {
        try {
            await fetch('/api/alerts/acknowledge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alert_id: alertId })
            });
            await refreshAll();
            showToast("Alert status updated to ACKNOWLEDGED.", "success");
        } catch (e) {
            showToast("Failed to acknowledge alert.", "error");
        }
    };

    const investigateAlert = async (alertId) => {
        const alt = alerts.find(a => a.id === alertId);
        try {
            await fetch('/api/alerts/investigate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alert_id: alertId })
            });
            await refreshAll();
            setDrawerAlert(null);
            setShowNotificationDrawer(false);
            if (alt) setStationModalId(alt.station_id);
            showToast(`Launched diagnostic investigation panel for station ${alt?.station_id || ''}.`, "info");
        } catch (e) {
            showToast("Failed to launch investigation.", "error");
        }
    };

    const resolveAlertWithNotes = async (e) => {
        e.preventDefault();
        if (!resolutionModalAlert) return;
        try {
            await fetch('/api/alerts/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alert_id: resolutionModalAlert.id, resolution_notes: resolutionNotes || "Technician consultation check completed." })
            });
            await refreshAll();
            setResolutionModalAlert(null);
            setResolutionNotes('');
            setDrawerAlert(null);
            showToast("Alert RESOLVED with technician consultation notes.", "success");
        } catch (e) {
            showToast("Failed to resolve alert.", "error");
        }
    };

    const dismissAlert = async (alertId) => {
        if (!confirm("Dismiss alert from queue?")) return;
        try {
            await fetch('/api/alerts/dismiss', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alert_id: alertId })
            });
            await refreshAll();
            setDrawerAlert(null);
            showToast("Alert dismissed.", "info");
        } catch (e) {
            showToast("Failed to dismiss alert.", "error");
        }
    };

    const acceptCorrection = async (stId, param, val) => {
        try {
            await fetch('/api/correction/approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ station_id: stId, parameter: param, corrected_value: val })
            });
            await refreshAll();
            showToast(`Approved data reconstruction proposal for ${stId} (${param} -> ${val}).`, "success");
        } catch (e) {
            showToast("Failed to approve correction.", "error");
        }
    };

    const rejectCorrection = async (stId, param) => {
        try {
            await fetch('/api/correction/reject', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ station_id: stId, parameter: param })
            });
            await refreshAll();
            showToast(`Rejected proposed correction. Kept original raw measurement for ${stId}.`, "warning");
        } catch (e) {
            showToast("Failed to reject correction.", "error");
        }
    };

    // Tour Player Handlers
    const startTour = () => {
        setTourActive(true);
        setTourPaused(false);
        setTourStep(0);
        executeTourStep(0);
    };

    const executeTourStep = (stepIdx) => {
        const step = DEMO_TOUR_STEPS[stepIdx];
        if (step) {
            triggerScenario(step.scenario);
            setActiveView(step.view);
        }
    };

    const handleDatasetUploaded = async (filename) => {
        setActiveDatasetName(filename);
        await refreshAll();
        showToast(`Dataset '${filename}' loaded & station graph dynamically synchronized!`, "success");
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 text-slate-900">
            
            {/* Toast Notification Container */}
            {toastMessage && (
                <div className="toast-container">
                    <div className={`toast ${toastMessage.type}`}>{toastMessage.text}</div>
                </div>
            )}

            {/* Active Simulation Scenario Banner */}
            {kpis.active_scenario !== 'normal' && (
                <div className="bg-red-50 border-b border-red-200 text-red-900 px-4 py-1.5 flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-2">
                        <span className="pulse-indicator red"></span>
                        <span><strong>ACTIVE SCENARIO:</strong> <span className="font-mono text-red-700 font-bold">{kpis.active_scenario.toUpperCase().replace('_', ' ')}</span> — Injecting physical failure telemetry</span>
                    </div>
                    <button onClick={resetSystemGlobal} className="px-2.5 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold transition shadow-sm">✕ STOP SCENARIO</button>
                </div>
            )}

            {/* Header Component */}
            <Header 
                kpis={kpis} 
                activeDatasetName={activeDatasetName}
                unreadCount={unreadCount}
                onRunAnalysis={runAnalysisPass} 
                onOpenDatasetModal={() => setShowDatasetModal(true)}
                onToggleNotifications={() => setShowNotificationDrawer(!showNotificationDrawer)}
                onReset={resetSystemGlobal} 
            />

            {/* Main Layout Grid */}
            <div className="flex flex-1 overflow-hidden">
                <Sidebar 
                    activeView={activeView} 
                    setActiveView={setActiveView} 
                    alertCount={kpis.active_alerts || 0} 
                />

                <main className="flex-1 overflow-y-auto p-4 bg-slate-50">
                    {activeView === 'overview' && (
                        <OverviewView 
                            kpis={kpis} 
                            stations={stations} 
                            alerts={alerts} 
                            activityLogs={activityLogs} 
                            onInvestigate={investigateAlert} 
                            onAcknowledge={acknowledgeAlert} 
                            onSelectStation={setStationModalId} 
                            onSwitchView={setActiveView}
                        />
                    )}
                    {activeView === 'live-monitoring' && (
                        <LiveMonitoringView 
                            stations={stations} 
                            streamingPaused={streamingPaused}
                            onToggleStreaming={() => setStreamingPaused(!streamingPaused)}
                            onSelectStation={setStationModalId} 
                        />
                    )}
                    {activeView === 'stations' && <StationsView stations={stations} alerts={alerts} onSelectStation={setStationModalId} />}
                    {activeView === 'alerts' && (
                        <AlertsView 
                            alerts={alerts} 
                            onOpenDrawer={setDrawerAlert} 
                            onInvestigate={investigateAlert} 
                            onAcknowledge={acknowledgeAlert} 
                        />
                    )}
                    {activeView === 'anomaly-analysis' && <AnomalyAnalysisView stations={stations} alerts={alerts} onSelectStation={setStationModalId} />}
                    {activeView === 'physics-engine' && <PhysicsEngineView stations={stations} alerts={alerts} onSelectStation={setStationModalId} />}
                    {activeView === 'data-reconstruction' && (
                        <DataReconstructionView 
                            stations={stations} 
                            onAccept={acceptCorrection} 
                            onReject={rejectCorrection} 
                        />
                    )}
                    {activeView === 'spatial-network' && <SpatialNetworkView stations={stations} />}
                    {activeView === 'demo-simulator' && (
                        <DemoSimulatorView 
                            activeScenario={kpis.active_scenario} 
                            onTriggerScenario={triggerScenario} 
                            onReset={resetSystemGlobal}
                            tourActive={tourActive}
                            tourStep={tourStep}
                            tourPaused={tourPaused}
                            onStartTour={startTour}
                            onPauseTour={() => setTourPaused(!tourPaused)}
                            onStepTour={() => { const next = (tourStep + 1) % DEMO_TOUR_STEPS.length; setTourStep(next); executeTourStep(next); }}
                            onResetTour={() => { setTourActive(false); resetSystemGlobal(); }}
                        />
                    )}
                    {activeView === 'analytics' && <AnalyticsView stations={stations} />}
                    {activeView === 'system-architecture' && <SystemArchitectureView />}
                </main>
            </div>

            {/* Alert Drawer */}
            {drawerAlert && (
                <AlertDrawer 
                    alert={drawerAlert} 
                    onClose={() => setDrawerAlert(null)} 
                    onAcknowledge={acknowledgeAlert} 
                    onInvestigate={investigateAlert} 
                    onResolvePrompt={(alt) => setResolutionModalAlert(alt)} 
                    onDismiss={dismissAlert} 
                />
            )}

            {/* Notifications Tray */}
            {showNotificationDrawer && (
                <NotificationDrawer 
                    notifications={notifications}
                    unreadCount={unreadCount}
                    audioEnabled={audioAlertEnabled}
                    onToggleAudio={() => setAudioAlertEnabled(!audioAlertEnabled)}
                    onClose={() => setShowNotificationDrawer(false)}
                    onAcknowledge={acknowledgeAlert}
                    onInvestigate={investigateAlert}
                />
            )}

            {/* Dataset Importer Modal */}
            {showDatasetModal && (
                <DatasetImporterModal 
                    onClose={() => setShowDatasetModal(false)}
                    onSuccess={handleDatasetUploaded}
                />
            )}

            {/* Station Diagnostic Panel Modal (Synchronized Core Fix) */}
            {stationModalId && (
                <StationDiagnosticModal 
                    stationId={stationModalId} 
                    station={stations[stationModalId]}
                    alerts={alerts.filter(a => a.station_id === stationModalId)}
                    onClose={() => setStationModalId(null)} 
                    onAcknowledge={acknowledgeAlert}
                    onResolvePrompt={(alt) => setResolutionModalAlert(alt)}
                />
            )}

            {/* Technician Resolution Notes Modal */}
            {resolutionModalAlert && (
                <ResolutionModal 
                    alert={resolutionModalAlert} 
                    notes={resolutionNotes} 
                    setNotes={setResolutionNotes} 
                    onSubmit={resolveAlertWithNotes} 
                    onClose={() => setResolutionModalAlert(null)} 
                />
            )}

        </div>
    );
}

// ------------------- HEADER COMPONENT -------------------
function Header({ kpis, activeDatasetName, unreadCount, onRunAnalysis, onOpenDatasetModal, onToggleNotifications, onReset }) {
    return (
        <header className="bg-white border-b border-slate-200 px-5 py-2.5 flex items-center justify-between z-40 shadow-sm">
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xl shadow-md">
                    🛡️
                </div>
                <div>
                    <div className="flex items-center gap-2.5">
                        <h1 className="text-lg font-black tracking-wide text-slate-900">SkyGuard AI</h1>
                        <span className="bg-blue-50 border border-blue-200 text-blue-700 font-mono text-[10px] font-bold px-2 py-0.5 rounded tracking-wide">LIVE DEMO • SIMULATED AWS DATA</span>
                    </div>
                    <p className="text-xs text-slate-500">Physics-Informed Spatio-Temporal Intelligence for Automatic Weather Station Reliability</p>
                </div>
            </div>

            <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
                <div><span className="text-slate-500 font-medium">Dataset:</span> <span className="font-mono text-blue-700 font-bold max-w-[130px] inline-block truncate align-bottom">{activeDatasetName}</span></div>
                <div className="border-l border-slate-300 h-3"></div>
                <div><span className="text-slate-500 font-medium">Mode:</span> <span className="font-mono text-emerald-700 font-bold">Technician Consultation</span></div>
            </div>

            <div className="flex items-center gap-2">
                <button onClick={onRunAnalysis} className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-md shadow-sm transition">⚡ Run Analysis</button>
                <button onClick={onOpenDatasetModal} className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-md border border-slate-300 shadow-sm transition">📂 Upload Dataset</button>
                <button onClick={onToggleNotifications} className="relative px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-md border border-slate-300 shadow-sm transition">
                    <span>🔔 Alerts</span>
                    {unreadCount > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ml-1">{unreadCount}</span>}
                </button>
                <button onClick={onReset} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-md border border-red-200 transition">🔄 Reset</button>
            </div>
        </header>
    );
}

// ------------------- SIDEBAR COMPONENT (11 VIEWS) -------------------
function Sidebar({ activeView, setActiveView, alertCount }) {
    const navItems = [
        { id: 'overview', label: 'Overview', icon: '◉' },
        { id: 'live-monitoring', label: 'Live Monitoring', icon: '◎' },
        { id: 'stations', label: 'Stations', icon: '◎' },
        { id: 'alerts', label: 'Alerts', icon: '◎', badge: alertCount },
        { id: 'anomaly-analysis', label: 'Anomaly Analysis', icon: '◎', section: 'DIAGNOSTICS & AI' },
        { id: 'physics-engine', label: 'Physics Engine', icon: '◎' },
        { id: 'data-reconstruction', label: 'Data Reconstruction', icon: '◎' },
        { id: 'spatial-network', label: 'Spatial Network', icon: '◎' },
        { id: 'demo-simulator', label: 'Demo Simulator', icon: '◎', section: 'CONTROLS & INSIGHTS' },
        { id: 'analytics', label: 'Analytics', icon: '◎' },
        { id: 'system-architecture', label: 'System Architecture', icon: '◎' },
    ];

    return (
        <aside className="w-56 bg-white border-r border-slate-200 p-3 flex flex-col justify-between select-none shadow-sm">
            <nav className="flex flex-col gap-1">
                {navItems.map((item) => (
                    <React.Fragment key={item.id}>
                        {item.section && <div className="text-[10px] font-black text-slate-400 tracking-wider px-2 pt-3 pb-1">{item.section}</div>}
                        <button
                            onClick={() => setActiveView(item.id)}
                            className={`flex items-center justify-between px-3 py-2 rounded-md text-xs font-semibold transition ${activeView === item.id ? 'bg-blue-50 text-blue-700 font-bold border-l-3 border-blue-600' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                        >
                            <span className="flex items-center gap-2">
                                <span>{item.icon}</span>
                                <span>{item.label}</span>
                            </span>
                            {item.badge > 0 && <span className="bg-red-500 text-white font-mono text-[10px] px-1.5 py-0.5 rounded-full font-bold">{item.badge}</span>}
                        </button>
                    </React.Fragment>
                ))}
            </nav>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[11px]">
                <div className="font-bold text-slate-500 text-[10px] tracking-wide mb-1">SYSTEM HEALTH</div>
                <div className="flex items-center gap-1.5 text-slate-700 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Edge TinyML: ONLINE</div>
                <div className="flex items-center gap-1.5 text-slate-700 font-medium mt-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> ST-GNN Engine: READY</div>
                <div className="flex items-center gap-1.5 text-slate-700 font-medium mt-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Physics Engine: READY</div>
                <div className="flex items-center gap-1.5 text-slate-700 font-medium mt-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Spatial Imputer: READY</div>
            </div>
        </aside>
    );
}

// ------------------- 1. OVERVIEW VIEW (WITH INTERACTIVE SVG MAP) -------------------
function OverviewView({ kpis, stations, alerts, activityLogs, onInvestigate, onAcknowledge, onSelectStation, onSwitchView }) {
    const activeAlerts = alerts.filter(a => a.status !== 'RESOLVED');

    return (
        <div className="flex flex-col gap-4">
            {/* Top KPI Cards */}
            <div className="grid grid-cols-6 gap-3">
                <KpiCard title="TOTAL STATIONS" val={kpis.total_stations || 8} sub="AP Regional Network" />
                <KpiCard title="HEALTHY STATIONS" val={kpis.healthy_stations || 8} sub="100% Operational" color="text-emerald-600" />
                <KpiCard title="ACTIVE ALERTS" val={kpis.active_alerts || 0} sub="Technician Action Needed" color="text-red-600" />
                <KpiCard title="DATA QUALITY" val={`${kpis.data_quality_pct || 100}%`} sub="Reliability Metric" color="text-blue-600" />
                <KpiCard title="PHYSICS CONSISTENCY" val={`${kpis.physics_consistency_pct || 100}%`} sub="PINN Thermodynamic Score" color="text-teal-600" />
                <KpiCard title="SPATIAL CONSENSUS" val={`${kpis.spatial_consensus_pct || 100}%`} sub="ST-GNN Agreement" color="text-amber-600" />
            </div>

            {/* System Health Bar */}
            <div className="bg-white border border-slate-200 rounded-lg px-4 py-2 flex items-center justify-between text-xs shadow-sm">
                <span className="font-black text-slate-500 tracking-wider">SYSTEM HEALTH:</span>
                <div className="flex items-center gap-6 text-slate-700 font-medium">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Edge Processing: <strong>ONLINE</strong></span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Temporal Engine: <strong>READY</strong></span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Physics Engine: <strong>READY</strong></span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Spatial Consensus: <strong>READY</strong></span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Alert Engine: <strong>READY</strong></span>
                </div>
            </div>

            {/* Main Cockpit Grid: Map + Active Alerts */}
            <div className="grid grid-cols-2 gap-4">
                {/* Regional Interactive Weather Map */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3 shadow-sm">
                    <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">🗺️ INTERACTIVE REGIONAL AWS TOPOLOGY MAP</h3>
                        <span className="text-xs text-slate-500 font-mono">Andhra Pradesh Network</span>
                    </div>

                    <InteractiveRegionalMap stations={stations} onSelectStation={onSelectStation} />
                </div>

                {/* Active Alerts Cards */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3 shadow-sm">
                    <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">🚨 ACTIVE ALERTS & DIAGNOSTICS</h3>
                        <button onClick={() => onSwitchView('alerts')} className="text-xs text-blue-600 hover:underline font-semibold">View Alert Center →</button>
                    </div>

                    <div className="flex flex-col gap-2.5 max-h-[380px] overflow-y-auto">
                        {activeAlerts.length === 0 ? (
                            <div className="text-center py-16 text-slate-400">
                                <div className="text-4xl mb-2 text-emerald-500">✓</div>
                                <p className="text-xs font-medium">All AWS stations operating normally within physical parameters.</p>
                            </div>
                        ) : (
                            activeAlerts.map(alt => (
                                <div key={alt.id} className={`bg-slate-50 border p-3 rounded-lg flex flex-col gap-2 border-l-4 ${alt.severity === 'CRITICAL' ? 'border-l-red-500 border-slate-200' : 'border-l-amber-500 border-slate-200'}`}>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="font-bold text-slate-900">{alt.station_id}: {alt.station_name}</span>
                                        <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${alt.severity === 'CRITICAL' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>{alt.severity}</span>
                                    </div>
                                    <div className="text-xs font-bold text-slate-800">{alt.anomaly_type}</div>
                                    <div className="flex justify-between text-[11px] text-slate-500">
                                        <span>Confidence: <strong className="text-slate-800">{alt.confidence}%</strong></span>
                                        <span>Status: <strong className="text-blue-600">{alt.status}</strong></span>
                                    </div>
                                    <div className="flex gap-2 mt-1">
                                        <button onClick={() => onInvestigate(alt.id)} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] rounded transition shadow-sm">🔍 INVESTIGATE</button>
                                        {alt.status === 'NEW' && <button onClick={() => onAcknowledge(alt.id)} className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] rounded transition shadow-sm">✓ ACKNOWLEDGE</button>}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Real-time Activity Feed */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <h3 className="font-bold text-sm text-slate-900 mb-2">📋 REAL-TIME PIPELINE ACTIVITY FEED LOG</h3>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 h-36 overflow-y-auto font-mono text-xs flex flex-col gap-1.5">
                    {activityLogs.slice(0, 20).map((log, i) => (
                        <div key={i} className="flex items-center gap-4 border-b border-slate-200/60 pb-1">
                            <span className="text-slate-400 text-[10px]">{log.timestamp}</span>
                            <span className="font-bold text-blue-700 w-36 truncate">{log.action}</span>
                            <span className={log.level === 'ERROR' ? 'text-red-600 font-semibold' : (log.level === 'WARNING' ? 'text-amber-600 font-semibold' : 'text-slate-700')}>{log.detail}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// KPI Card Helper
function KpiCard({ title, val, sub, color = 'text-slate-900' }) {
    return (
        <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col justify-between shadow-sm">
            <span className="text-[10px] font-black text-slate-400 tracking-wider">{title}</span>
            <div className="flex items-baseline justify-between mt-1">
                <span className={`text-2xl font-black font-mono ${color}`}>{val}</span>
                <span className="text-[10px] text-slate-500 font-medium">{sub}</span>
            </div>
        </div>
    );
}

// ------------------- INTERACTIVE SVG REGIONAL MAP COMPONENT (FLICKER-FREE) -------------------
const InteractiveRegionalMap = React.memo(function InteractiveRegionalMap({ stations, onSelectStation }) {
    const [hoveredStId, setHoveredStId] = useState(null);

    // Coordinate mapping bounds for AP region
    const mapCoords = React.useCallback((lat, lon) => {
        const x = ((lon - 77.0) / 7.0) * 440 + 30;
        const y = 300 - ((lat - 13.0) / 5.0) * 260;
        return { x: Math.max(30, Math.min(470, x)), y: Math.max(30, Math.min(290, y)) };
    }, []);

    // Memoized graph nodes & edges to prevent DOM re-layout flickering
    const { nodes, edges } = React.useMemo(() => {
        const stList = Object.values(stations);
        const nodeMap = {};
        const edgeList = [];
        const seenEdges = new Set();

        stList.forEach(st => {
            const pos = mapCoords(st.station_info.latitude, st.station_info.longitude);
            let color = "#10B981"; // Healthy
            if (st.status === 'FAULT' || st.is_anomaly) color = "#EF4444";
            else if (st.status === 'WARNING') color = "#F59E0B";
            else if (st.status === 'EVENT') color = "#3B82F6";

            nodeMap[st.station_info.id] = {
                id: st.station_info.id,
                name: st.station_info.name,
                elev: st.station_info.elevation,
                status: st.status,
                telemetry: st.telemetry,
                raw: st,
                pos,
                color
            };

            (st.spatial_diagnostics?.neighbor_details || []).forEach(n => {
                const pairKey = [st.station_info.id, n.station_id].sort().join('--');
                if (!seenEdges.has(pairKey) && stations[n.station_id]) {
                    seenEdges.add(pairKey);
                    const targetSt = stations[n.station_id];
                    const pos2 = mapCoords(targetSt.station_info.latitude, targetSt.station_info.longitude);
                    edgeList.push({
                        key: pairKey,
                        x1: pos.x, y1: pos.y,
                        x2: pos2.x, y2: pos2.y,
                        agrees: n.agrees
                    });
                }
            });
        });

        return { nodes: Object.values(nodeMap), edges: edgeList };
    }, [stations, mapCoords]);

    const hoveredSt = hoveredStId ? stations[hoveredStId] : null;

    return (
        <div className="relative w-full h-[360px] bg-slate-100 rounded-xl border border-slate-200 overflow-hidden flex items-center justify-center">
            <svg viewBox="0 0 500 320" className="w-full h-full">
                {/* Regional Contour Outlines */}
                <path d="M 40,280 Q 120,290 200,260 T 320,180 T 460,40 L 480,80 L 380,200 L 260,300 Z" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="2" />
                <path d="M 380,40 Q 420,100 450,140 Q 350,220 220,290" fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeDasharray="4 4" />

                {/* Spatial Graph Connection Edges */}
                {edges.map(e => (
                    <line 
                        key={e.key}
                        x1={e.x1} y1={e.y1}
                        x2={e.x2} y2={e.y2}
                        stroke={e.agrees ? "#CBD5E1" : "#FCA5A5"}
                        strokeWidth={e.agrees ? "1.5" : "2.5"}
                        strokeDasharray={e.agrees ? "" : "4 4"}
                    />
                ))}

                {/* Station Nodes */}
                {nodes.map(node => {
                    const isHovered = hoveredStId === node.id;
                    return (
                        <g key={node.id} 
                           className="cursor-pointer"
                           onClick={() => onSelectStation(node.id)}
                           onMouseEnter={() => setHoveredStId(node.id)}
                           onMouseLeave={() => setHoveredStId(null)}>
                            {/* Outer Glow */}
                            <circle cx={node.pos.x} cy={node.pos.y} r={isHovered ? "16" : "12"} fill={node.color} fillOpacity={isHovered ? "0.35" : "0.2"} />
                            {/* Node Dot */}
                            <circle cx={node.pos.x} cy={node.pos.y} r={isHovered ? "8" : "6"} fill={node.color} stroke="#FFFFFF" strokeWidth="2" />
                            {/* Label */}
                            <text x={node.pos.x + 10} y={node.pos.y + 4} fontSize={isHovered ? "10" : "9"} fontWeight="bold" fill="#1E293B" className="select-none font-mono">
                                {node.id}
                            </text>
                        </g>
                    );
                })}
            </svg>

            {/* Hovered Tooltip */}
            {hoveredSt && (
                <div className="absolute top-3 right-3 bg-white border border-slate-200 p-2.5 rounded-lg shadow-lg text-xs space-y-1 z-20 pointer-events-none">
                    <div className="font-bold text-slate-900">{hoveredSt.station_info.id}: {hoveredSt.station_info.name}</div>
                    <div className="text-[11px] text-slate-600">Elev: {hoveredSt.station_info.elevation}m | Status: <span className="font-bold text-blue-600">{hoveredSt.status}</span></div>
                    <div className="text-[10px] font-mono text-slate-500">Temp: {hoveredSt.telemetry.temperature}°C | Hum: {hoveredSt.telemetry.humidity}%</div>
                </div>
            )}
        </div>
    );
});

// ------------------- 2. LIVE MONITORING VIEW -------------------
function LiveMonitoringView({ stations, streamingPaused, onToggleStreaming, onSelectStation }) {
    return (
        <div className="flex flex-col gap-4">
            <div className="border-b border-slate-200 pb-2 flex justify-between items-center">
                <div>
                    <h2 className="text-base font-bold text-slate-900">Live Multi-Station Telemetry Streaming Grid</h2>
                    <p className="text-xs text-slate-500">Real-time signal RSSI tracking and edge telemetry feeds</p>
                </div>
                <button onClick={onToggleStreaming} className={`px-3 py-1.5 rounded-md text-xs font-bold transition shadow-sm ${streamingPaused ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'}`}>
                    {streamingPaused ? '▶ Resume Stream' : '⏸ Pause Live Stream'}
                </button>
            </div>
            <div className="grid grid-cols-4 gap-3">
                {Object.values(stations).map(st => (
                    <StationCard key={st.station_info.id} st={st} onSelect={() => onSelectStation(st.station_info.id)} />
                ))}
            </div>
        </div>
    );
}

// ------------------- 3. STATIONS VIEW (WITH CRITICAL CORE FIX SYNCHRONIZATION) -------------------
function StationsView({ stations, alerts, onSelectStation }) {
    const [timeFilter, setTimeFilter] = useState('12H');

    return (
        <div className="flex flex-col gap-4">
            <div className="border-b border-slate-200 pb-2 flex justify-between items-center">
                <div>
                    <h2 className="text-base font-bold text-slate-900">AWS Station Sensor Health & Hardware Voltage Diagnostics</h2>
                    <p className="text-xs text-slate-500">Individual probe ratings, edge battery status, and synchronized failure telemetry</p>
                </div>
                <div className="flex gap-1 bg-white border border-slate-200 p-1 rounded-lg">
                    {['1H', '6H', '12H', '24H'].map(f => (
                        <button key={f} onClick={() => setTimeFilter(f)} className={`px-2.5 py-0.5 text-xs font-bold rounded ${timeFilter === f ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{f}</button>
                    ))}
                </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
                {Object.values(stations).map(st => {
                    const stAlerts = alerts.filter(a => a.station_id === st.station_info.id && a.status !== 'RESOLVED');
                    return (
                        <StationCard key={st.station_info.id} st={st} activeAlerts={stAlerts} onSelect={() => onSelectStation(st.station_info.id)} detailed />
                    );
                })}
            </div>
        </div>
    );
}

function StationCard({ st, activeAlerts = [], onSelect, detailed = false }) {
    const info = st.station_info;
    const t = st.telemetry;
    const isFault = st.status === 'FAULT' || st.is_anomaly || activeAlerts.length > 0;
    const isWarning = st.status === 'WARNING' || t.battery_voltage < 3.2;

    let badgeColor = 'bg-emerald-100 text-emerald-700 border-emerald-200';
    let statusText = st.status;
    if (isFault) { badgeColor = 'bg-red-100 text-red-700 border-red-200'; statusText = 'CRITICAL FAULT'; }
    else if (isWarning) { badgeColor = 'bg-amber-100 text-amber-700 border-amber-200'; statusText = 'WARNING / DRIFT'; }

    return (
        <div onClick={onSelect} className={`bg-white border rounded-xl p-3.5 flex flex-col justify-between cursor-pointer transition transform hover:-translate-y-0.5 shadow-sm ${isFault ? 'border-red-400 bg-red-50/20' : 'border-slate-200 hover:border-blue-400'}`}>
            <div className="flex justify-between items-start mb-2">
                <div>
                    <div className="font-bold text-sm text-slate-900">{info.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{info.id} • Elev: {info.elevation}m</div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${badgeColor}`}>{statusText}</span>
            </div>

            {/* Synchronized Failure Banner if active alert exists */}
            {activeAlerts.length > 0 && (
                <div className="bg-red-100 border border-red-300 text-red-800 p-2 rounded-lg text-xs font-bold mb-2">
                    ⚠️ {activeAlerts[0].anomaly_type}
                </div>
            )}

            <div className="bg-slate-50 p-2.5 rounded-lg grid grid-cols-2 gap-2 text-xs mb-2 border border-slate-200">
                <div><span className="text-slate-500 text-[10px]">Temp:</span> <strong className={`font-mono block ${isFault && t.temperature === 22.4 ? 'text-red-600 font-bold' : 'text-slate-900'}`}>{t.temperature !== null ? `${t.temperature} °C` : 'NULL'}</strong></div>
                <div><span className="text-slate-500 text-[10px]">Pressure:</span> <strong className="font-mono text-slate-900 block">{t.pressure !== null ? `${t.pressure} hPa` : 'NULL'}</strong></div>
                <div><span className="text-slate-500 text-[10px]">Humidity:</span> <strong className={`font-mono block ${isWarning && t.humidity > 85 ? 'text-amber-600 font-bold' : 'text-slate-900'}`}>{t.humidity !== null ? `${t.humidity} %` : 'NULL'}</strong></div>
                <div><span className="text-slate-500 text-[10px]">Rainfall:</span> <strong className="font-mono text-slate-900 block">{t.rainfall !== null ? `${t.rainfall} mm` : '0.0 mm'}</strong></div>
            </div>

            {detailed && (
                <div className="text-[11px] border-t border-slate-200 pt-2 text-slate-600 flex flex-col gap-1">
                    <div className="flex justify-between"><span>Battery Voltage:</span> <strong className={`font-mono ${t.battery_voltage < 3.2 ? 'text-amber-600 font-bold' : 'text-emerald-700'}`}>{t.battery_voltage || 13.5} V</strong></div>
                    <div className="flex justify-between"><span>Signal RSSI:</span> <strong className="font-mono text-blue-700">{t.signal_strength || -68} dBm</strong></div>
                </div>
            )}
        </div>
    );
}

// ------------------- 4. ALERTS CENTER VIEW -------------------
function AlertsView({ alerts, onOpenDrawer, onInvestigate, onAcknowledge }) {
    const [filter, setFilter] = useState('ALL');
    const [query, setQuery] = useState('');

    let filtered = alerts;
    if (filter !== 'ALL') {
        filtered = filtered.filter(a => a.status === filter);
    }
    if (query) {
        filtered = filtered.filter(a => a.station_id.toLowerCase().includes(query.toLowerCase()) || a.anomaly_type.toLowerCase().includes(query.toLowerCase()));
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="border-b border-slate-200 pb-2 flex justify-between items-center">
                <div>
                    <h2 className="text-base font-bold text-slate-900">Alert Center & Investigation Lifecycle Queue</h2>
                    <p className="text-xs text-slate-500">Track alerts: NEW → ACKNOWLEDGED → UNDER INVESTIGATION → RESOLVED</p>
                </div>
                <input 
                    type="text" 
                    placeholder="Search station or anomaly..." 
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="bg-white border border-slate-300 px-3 py-1.5 rounded-lg text-xs w-64 text-slate-900 focus:outline-none focus:border-blue-600 shadow-sm"
                />
            </div>

            <div className="flex gap-2">
                {['ALL', 'NEW', 'ACKNOWLEDGED', 'UNDER INVESTIGATION', 'RESOLVED'].map(tab => (
                    <button 
                        key={tab} 
                        onClick={() => setFilter(tab)}
                        className={`px-3 py-1 rounded-md text-xs font-semibold transition ${filter === tab ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 text-[11px] font-bold border-b border-slate-200">
                        <tr>
                            <th className="p-3">Timestamp</th>
                            <th className="p-3">Station</th>
                            <th className="p-3">Issue / Anomaly</th>
                            <th className="p-3">Severity</th>
                            <th className="p-3">Confidence</th>
                            <th className="p-3">Status</th>
                            <th className="p-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {filtered.length === 0 ? (
                            <tr><td colSpan="7" className="p-8 text-center text-slate-400">No active alerts match the selected filter.</td></tr>
                        ) : (
                            filtered.map(alt => (
                                <tr key={alt.id} className="hover:bg-slate-50 transition">
                                    <td className="p-3 font-mono text-slate-600">{alt.timestamp}</td>
                                    <td className="p-3 font-bold text-slate-900">{alt.station_id} ({alt.station_name})</td>
                                    <td className="p-3 font-bold text-slate-800">{alt.anomaly_type}</td>
                                    <td className="p-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${alt.severity === 'CRITICAL' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>{alt.severity}</span></td>
                                    <td className="p-3 font-mono font-semibold text-slate-700">{alt.confidence}%</td>
                                    <td className="p-3"><span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-mono text-[10px] font-bold border border-blue-200">{alt.status}</span></td>
                                    <td className="p-3 flex gap-2">
                                        <button onClick={() => onInvestigate(alt.id)} className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] rounded shadow-sm">🔍 Investigate</button>
                                        {alt.status === 'NEW' && <button onClick={() => onAcknowledge(alt.id)} className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] rounded shadow-sm">✓ Acknowledge</button>}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ------------------- 5. ANOMALY ANALYSIS VIEW (COMPOSITE SCORE & SYNCHRONIZED PILLARS) -------------------
function AnomalyAnalysisView({ stations, alerts, onSelectStation }) {
    const activeAnomalyStation = Object.values(stations).find(st => st.is_anomaly || st.status === 'FAULT') || stations['AWS-003'] || Object.values(stations)[0];
    const score = activeAnomalyStation?.is_anomaly ? 87 : 12;

    return (
        <div className="flex flex-col gap-4">
            <div className="border-b border-slate-200 pb-2">
                <h2 className="text-base font-bold text-slate-900">Composite Anomaly Score Breakdown (0–100)</h2>
                <p className="text-xs text-slate-500">Four weighted pillars: Temporal Deviation + Spatial Consensus + Physics Laws + Persistence Metrics</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 text-center shadow-sm">
                <span className="text-xs font-black text-slate-400 tracking-wider">COMPOSITE ANOMALY SCORE — {activeAnomalyStation?.station_info?.id || 'AWS-003'}</span>
                <div className={`text-6xl font-black font-mono my-2 ${score > 50 ? 'text-red-600' : 'text-emerald-600'}`}>{score} / 100</div>
                <p className="text-xs text-slate-500">Diagnostic Suggestion for Technician Consultation</p>
                {activeAnomalyStation?.is_anomaly && (
                    <button onClick={() => onSelectStation(activeAnomalyStation.station_info.id)} className="mt-3 px-4 py-1.5 bg-blue-600 text-white font-bold text-xs rounded-lg shadow-sm">
                        🔍 Inspect Station {activeAnomalyStation.station_info.id} Diagnostic Breakdown
                    </button>
                )}
            </div>

            <div className="grid grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                    <h4 className="text-xs font-bold text-slate-500">1. Temporal Deviation</h4>
                    <div className="text-2xl font-black font-mono text-blue-700 my-1">{activeAnomalyStation?.is_anomaly ? '42%' : '98%'}</div>
                    <p className="text-xs text-slate-500">Rate of change vs 40-step buffer</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                    <h4 className="text-xs font-bold text-slate-500">2. Spatial Consensus</h4>
                    <div className="text-2xl font-black font-mono text-amber-600 my-1">{activeAnomalyStation?.spatial_diagnostics?.consensus_score || 95}%</div>
                    <p className="text-xs text-slate-500">Agreement with neighbor nodes</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                    <h4 className="text-xs font-bold text-slate-500">3. Physics Laws Check</h4>
                    <div className="text-2xl font-black font-mono text-teal-600 my-1">{activeAnomalyStation?.physics_diagnostics?.overall_physics_score || 99}%</div>
                    <p className="text-xs text-slate-500">Magnus-Tetens psychrometric check</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                    <h4 className="text-xs font-bold text-slate-500">4. Persistence Metric</h4>
                    <div className="text-2xl font-black font-mono text-purple-700 my-1">{activeAnomalyStation?.is_anomaly ? '5 Cycles' : '0 Cycles'}</div>
                    <p className="text-xs text-slate-500">Consecutive abnormal cycles</p>
                </div>
            </div>
        </div>
    );
}

// ------------------- 6. PHYSICS ENGINE VIEW -------------------
function PhysicsEngineView({ stations, alerts, onSelectStation }) {
    return (
        <div className="flex flex-col gap-4">
            <div className="border-b border-slate-200 pb-2">
                <h2 className="text-base font-bold text-slate-900">Physics-Informed Consistency Engine (PINN Checks)</h2>
                <p className="text-xs text-slate-500">Thermodynamic Magnus-Tetens dewpoint check & Hydrostatic barometric elevation model</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {Object.values(stations).map(st => {
                    const info = st.station_info;
                    const p = st.physics_diagnostics;
                    const psych = p?.psychrometric_dew_point_check || {};
                    const baro = p?.hydrostatic_pressure_check || {};
                    const hasPhysicsViolation = p.overall_physics_score < 75;

                    return (
                        <div key={info.id} className={`bg-white border rounded-xl p-4 flex flex-col gap-2 shadow-sm ${hasPhysicsViolation ? 'border-red-400 bg-red-50/10' : 'border-slate-200'}`}>
                            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                                <h4 className="font-bold text-sm text-slate-900">{info.id}: {info.name}</h4>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${hasPhysicsViolation ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'}`}>{p.overall_physics_score}% PHYSICS SCORE</span>
                            </div>
                            <div className="bg-slate-50 p-2.5 rounded-lg text-xs space-y-1.5 border border-slate-200 text-slate-700 font-mono">
                                <div><strong>Psychrometric Magnus-Tetens Check:</strong> Observed: {st.telemetry.dew_point || 'N/A'}°C | Calculated: {psych.calculated_dew_point || 'N/A'}°C (Error: {psych.dew_point_error || 0}°C)</div>
                                <div><strong>Hydrostatic Pressure Check:</strong> Expected: {baro.expected_pressure || 1012} hPa | Observed: {st.telemetry.pressure || 'N/A'} hPa</div>
                            </div>
                            <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-lg text-xs text-slate-800">
                                <strong>WHY? (Technician Reasoning):</strong> {hasPhysicsViolation ? 'Observed thermodynamic values violate psychrometric gas law equations, indicating physical sensor probe degradation.' : 'Telemetry satisfies psychrometric and hydrostatic physical bounds.'}
                            </div>
                            {hasPhysicsViolation && (
                                <button onClick={() => onSelectStation(info.id)} className="mt-1 px-3 py-1 bg-red-600 text-white font-bold text-xs rounded-lg self-start shadow-sm">
                                    🔍 Inspect Station Physics Failure
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ------------------- 7. DATA RECONSTRUCTION VIEW -------------------
function DataReconstructionView({ stations, onAccept, onReject }) {
    const st = stations['AWS-003'] || Object.values(stations)[0];
    if (!st) return null;
    const corrState = st.correction_state?.status || 'PENDING';
    const rawVal = st.raw_value !== undefined ? st.raw_value : 37.8;
    const expVal = st.expected_value !== undefined ? st.expected_value : 31.6;
    const targetParam = (st.imputation?.target_parameter || 'temperature').toUpperCase();

    return (
        <div className="flex flex-col gap-4">
            <div className="border-b border-slate-200 pb-2">
                <h2 className="text-base font-bold text-slate-900">Physics-Guided Spatial Data Reconstruction</h2>
                <p className="text-xs text-slate-500">IDW spatial consensus + altitude lapse rate (-0.0065°C/m) reconstruction proposals for technician approval</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between shadow-sm">
                    <div>
                        <h3 className="font-bold text-sm text-slate-900 mb-3">RECONSTRUCTION PROPOSAL</h3>
                        <div className="bg-slate-50 p-3 rounded-lg text-xs flex flex-col gap-2 border border-slate-200">
                            <div>Station: <strong className="text-slate-900">{st.station_info.id} ({st.station_info.name})</strong></div>
                            <div>Target Parameter: <strong className="text-slate-900">{targetParam}</strong></div>
                            <div>Observed Raw Reading: <strong className="text-red-600 font-mono">{rawVal} °C</strong></div>
                            <div>AI Proposed Value: <strong className="text-emerald-600 font-mono">{expVal} °C</strong></div>
                            <div>Status: <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${corrState === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{corrState}</span></div>
                        </div>

                        <div className="mt-4">
                            <h4 className="text-xs font-bold text-slate-500 mb-1">Source Attribution</h4>
                            <ul className="text-xs text-slate-700 space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200 font-medium">
                                <li>✓ Neighboring AWS Stations (IDW Distance Weighting)</li>
                                <li>✓ Tropospheric Altitude Lapse Rate (-0.0065 °C / m)</li>
                                <li>✓ Temporal Spline Smoothing</li>
                            </ul>
                        </div>
                    </div>

                    <div className="flex gap-2 mt-4">
                        <button onClick={() => onAccept(st.station_info.id, 'temperature', expVal)} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition shadow-sm">✓ ACCEPT CORRECTION</button>
                        <button onClick={() => onReject(st.station_info.id, 'temperature')} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-red-600 font-bold text-xs rounded-lg border border-slate-300 transition">✕ KEEP ORIGINAL</button>
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between shadow-sm">
                    <h3 className="font-bold text-sm text-slate-900 mb-3">RAW VS PROPOSED TELEMETRY RECONSTRUCTION</h3>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs space-y-3 font-mono">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                            <span className="text-slate-500">Observed Telemetry Raw:</span>
                            <span className="text-red-600 font-bold">{rawVal} °C</span>
                        </div>
                        <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                            <span className="text-slate-500">AI Proposed Reconstructed:</span>
                            <span className="text-emerald-600 font-bold">{expVal} °C</span>
                        </div>
                        <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                            <span className="text-slate-500">Physical Bias Correction:</span>
                            <span className="text-blue-700 font-bold">{(expVal - rawVal).toFixed(1)} °C</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500">Imputation Method:</span>
                            <span className="text-slate-800">IDW + Lapse Rate (-0.0065°C/m)</span>
                        </div>
                    </div>
                    <div className="text-[11px] text-slate-600 bg-blue-50 border border-blue-200 p-2.5 rounded-lg mt-3">
                        <strong>Technician Note:</strong> Accepting this correction patches the output dataset for downstream forecasting without overwriting raw telemetry audit logs.
                    </div>
                </div>
            </div>
        </div>
    );
}

// ------------------- 8. SPATIAL NETWORK VIEW -------------------
function SpatialNetworkView({ stations }) {
    return (
        <div className="flex flex-col gap-4">
            <div className="border-b border-slate-200 pb-2">
                <h2 className="text-base font-bold text-slate-900">ST-GNN Spatial Network Topology</h2>
                <p className="text-xs text-slate-500">Spatial adjacency matrix and neighbor agreement scores across station network</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                        <tr><th className="p-2.5">Target Node</th><th className="p-2.5">Neighbor Station</th><th className="p-2.5">Distance (km)</th><th className="p-2.5">Consensus Agreement</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {Object.values(stations).flatMap(st => (st.spatial_diagnostics?.neighbor_details || []).map((n, i) => (
                            <tr key={`${st.station_info.id}-${i}`}>
                                <td className="p-2.5 font-bold text-slate-900">{st.station_info.id}</td>
                                <td className="p-2.5 font-medium">{n.station_id}</td>
                                <td className="p-2.5 font-mono text-slate-600">{n.distance_km} km</td>
                                <td className="p-2.5"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${n.agrees ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>{n.agrees ? '✓ AGREE' : '✕ DISAGREE'}</span></td>
                            </tr>
                        )))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ------------------- 9. DEMO SIMULATOR VIEW (EXACT 9 SCENARIO TRIGGERS) -------------------
function DemoSimulatorView({ activeScenario, onTriggerScenario, onReset, tourActive, tourStep, tourPaused, onStartTour, onPauseTour, onStepTour, onResetTour }) {
    const scenarios = [
        { id: 'normal', title: '1. Normal Baseline', icon: '▶', sub: 'All 8 stations healthy. Diurnal sinewaves.', color: 'border-l-emerald-500' },
        { id: 'stuck_sensor', title: '2. Stuck Sensor Fault', icon: '🧊', sub: 'AWS-003 Temp drops to 22.4°C flatline', color: 'border-l-red-500' },
        { id: 'sensor_drift', title: '3. Sensor Drift Anomaly', icon: '⚠', sub: 'AWS-005 Humidity drifts +0.8%/step upward', color: 'border-l-amber-500' },
        { id: 'comm_failure', title: '4. Comm Flatline', icon: '📡', sub: 'AWS-001 flatlines to null values drop', color: 'border-l-amber-500' },
        { id: 'heavy_rainfall', title: '5. Heavy Rain Event', icon: '🌧', sub: 'AWS-007 severe rain (cross-verified)', color: 'border-l-blue-500' },
        { id: 'weather_front', title: '6. Regional Weather Front', icon: '🌪', sub: 'Rapid temp drop across 2, 4, 6', color: 'border-l-blue-500' },
        { id: 'physics_violation', title: '7. Physics Violation', icon: '⚡', sub: 'AWS-008 high RH zero dewpoint', color: 'border-l-red-500' },
        { id: 'power_drop', title: '8. Edge Battery Drop', icon: '🔋', sub: 'AWS-004 battery drops < 3.2V threshold', color: 'border-l-amber-500' },
        { id: 'reset_system', title: '9. Reset System', icon: '🔄', sub: 'Restore all baseline healthy operational graphs', color: 'border-l-blue-600' }
    ];

    return (
        <div className="flex flex-col gap-4">
            <div className="border-b border-slate-200 pb-2">
                <h2 className="text-base font-bold text-slate-900">Demo Simulator Dashboard — 9 Scenario Triggers & Story Tour</h2>
                <p className="text-xs text-slate-500">Central control hub to instantly shift global application state and inject synchronized failures</p>
            </div>

            {/* Tour Player Card */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 shadow-sm">
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-sm text-blue-900">▶ RUN AUTOMATED 10-STEP STORY TOUR</h3>
                        <p className="text-xs text-slate-600">Automated presentation tour (Normal → Faults → Validation → Recovery)</p>
                    </div>
                    <div className="flex gap-2">
                        {!tourActive ? (
                            <button onClick={onStartTour} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-sm">▶ Start Full Tour</button>
                        ) : (
                            <button onClick={onPauseTour} className="px-3 py-1.5 bg-amber-500 text-white font-bold text-xs rounded-lg">{tourPaused ? '▶ Resume' : '⏸ Pause'}</button>
                        )}
                        <button onClick={onStepTour} className="px-3 py-1.5 bg-white text-slate-700 hover:bg-slate-100 font-bold text-xs rounded-lg border border-slate-300">⏭ Next Step</button>
                        <button onClick={onResetTour} className="px-3 py-1.5 bg-red-100 text-red-700 font-bold text-xs rounded-lg border border-red-200">🔄 Reset</button>
                    </div>
                </div>

                {tourActive && (
                    <div className="mt-3 bg-white p-3 rounded-lg border border-slate-200 text-xs">
                        <div className="font-bold text-blue-700">{DEMO_TOUR_STEPS[tourStep]?.title}</div>
                        <p className="text-slate-600 mt-1">{DEMO_TOUR_STEPS[tourStep]?.desc}</p>
                    </div>
                )}
            </div>

            {/* 9 Scenario Buttons Grid */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <h3 className="font-bold text-sm text-slate-900 mb-3">EXACT 9 SCENARIO TRIGGERS</h3>
                <div className="grid grid-cols-3 gap-3">
                    {scenarios.map(sc => (
                        <button
                            key={sc.id}
                            onClick={() => onTriggerScenario(sc.id)}
                            className={`bg-slate-50 border border-slate-200 p-3 rounded-lg text-left hover:border-blue-500 hover:bg-blue-50/40 transition border-l-4 ${sc.color}`}
                        >
                            <div className="flex items-center gap-2">
                                <span>{sc.icon}</span>
                                <span className="font-bold text-xs text-slate-900">{sc.title}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1">{sc.sub}</div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ------------------- 10. ANALYTICS VIEW -------------------
function AnalyticsView({ stations }) {
    return (
        <div className="flex flex-col gap-4">
            <div className="border-b border-slate-200 pb-2">
                <h2 className="text-base font-bold text-slate-900">AWS Reliability Analytics & Hardware Metrics</h2>
                <p className="text-xs text-slate-500">Fault distribution, hardware sensor ratings, and multi-station overlay parameters</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                    <h3 className="font-bold text-xs text-slate-500 mb-3">FAULT CATEGORY DISTRIBUTION</h3>
                    <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-2 font-mono border border-slate-200">
                        <div className="flex justify-between items-center"><span className="text-slate-600">Normal Operation:</span><span className="text-emerald-700 font-bold">6 Stations (75%)</span></div>
                        <div className="flex justify-between items-center"><span className="text-slate-600">Stuck Sensors:</span><span className="text-red-600 font-bold">1 Station (12.5%)</span></div>
                        <div className="flex justify-between items-center"><span className="text-slate-600">Calibration Drift:</span><span className="text-amber-600 font-bold">1 Station (12.5%)</span></div>
                        <div className="flex justify-between items-center"><span className="text-slate-600">Communication Failure:</span><span className="text-slate-500 font-bold">0 Active</span></div>
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                    <h3 className="font-bold text-xs text-slate-500 mb-3">HARDWARE SENSOR RELIABILITY RATING (%)</h3>
                    <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-2 font-mono border border-slate-200">
                        <div className="flex justify-between items-center"><span className="text-slate-600">Temperature Transducer:</span><span className="text-blue-700 font-bold">96.2%</span></div>
                        <div className="flex justify-between items-center"><span className="text-slate-600">Pressure Transducer:</span><span className="text-blue-700 font-bold">94.8%</span></div>
                        <div className="flex justify-between items-center"><span className="text-slate-600">Relative Humidity Probe:</span><span className="text-blue-700 font-bold">91.5%</span></div>
                        <div className="flex justify-between items-center"><span className="text-slate-600">Tipping Bucket Rain Gauge:</span><span className="text-blue-700 font-bold">86.0%</span></div>
                        <div className="flex justify-between items-center"><span className="text-slate-600">Wind Anemometer:</span><span className="text-blue-700 font-bold">97.4%</span></div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ------------------- 11. SYSTEM ARCHITECTURE VIEW -------------------
function SystemArchitectureView() {
    const pipelineStages = [
        { num: 1, title: "Sensor Data Collection", desc: "Raw AWS sensor data ingested in JSON or CSV format across temperature, pressure, humidity, rain, and wind arrays.", tech: "CSV / JSON Ingestion" },
        { num: 2, title: "Data Preprocessing", desc: "Python, Pandas, and NumPy pipeline to clean sensor streams, normalize units, and handle missing/abnormal telemetry values.", tech: "Python • Pandas • NumPy" },
        { num: 3, title: "Feature Engineering", desc: "Extraction of critical temporal trends, diurnal cycles, and seasonal meteorological patterns from continuous telemetry.", tech: "Diurnal & Seasonal Signals" },
        { num: 4, title: "AI/ML Anomaly Detection", desc: "Isolation Forest algorithm combined with time-series anomaly detection to identify physical faults and weather anomalies.", tech: "Isolation Forest + Time-Series" },
        { num: 5, title: "Explainable AI (XAI)", desc: "SHAP and LIME attribution models explaining exactly why specific sensor readings are flagged as physical or temporal anomalies.", tech: "SHAP & LIME Attribution" },
        { num: 6, title: "Output & Monitoring", desc: "Detected anomalies, physical cross-checks, and XAI explanations displayed via Flask monitoring dashboard for human consultation.", tech: "Flask Enterprise Dashboard" }
    ];

    return (
        <div className="flex flex-col gap-4">
            <div className="border-b border-slate-200 pb-2">
                <h2 className="text-base font-bold text-slate-900">SkyGuard AI Technical Approach & System Architecture</h2>
                <p className="text-xs text-slate-500">End-to-end 6-stage technical methodology: Sensor Data → Preprocessing → Feature Engineering → AI/ML Detection → Explainable AI → Output & Monitoring</p>
            </div>

            {/* 6-Stage Technical Approach Cards */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <h3 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2">
                    <span className="text-blue-600">⚡</span> 6-STAGE TECHNICAL APPROACH PIPELINE
                </h3>

                <div className="grid grid-cols-6 gap-2.5 mb-4">
                    {pipelineStages.map(s => (
                        <div key={s.num} className="bg-blue-50/60 border border-blue-200 p-2.5 rounded-lg flex flex-col justify-between text-xs">
                            <div>
                                <span className="bg-blue-600 text-white font-mono text-[10px] font-bold px-1.5 py-0.5 rounded">Stage {s.num}</span>
                                <div className="font-bold text-slate-900 mt-1.5 text-[11px]">{s.title}</div>
                            </div>
                            <div className="text-[9px] font-mono text-blue-700 font-bold mt-2 pt-1 border-t border-blue-200">{s.tech}</div>
                        </div>
                    ))}
                </div>

                <div className="bg-slate-100 border border-slate-200 p-3 rounded-lg text-xs font-mono text-center text-slate-800 font-bold">
                    Pipeline Summary: Sensor Data → Preprocessing → Feature Engineering → AI/ML Detection → Explainable AI → Output and Monitoring
                </div>
            </div>

            {/* Detailed Stage Description List */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
                    <h3 className="font-bold text-xs text-slate-500">STAGE DETAILS & METHODOLOGY</h3>
                    {pipelineStages.slice(0, 3).map(s => (
                        <div key={s.num} className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-xs space-y-1">
                            <div className="font-bold text-slate-900 flex items-center justify-between">
                                <span>{s.num}. {s.title}</span>
                                <span className="text-[10px] font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">{s.tech}</span>
                            </div>
                            <p className="text-slate-600 text-[11px]">{s.desc}</p>
                        </div>
                    ))}
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
                    <h3 className="font-bold text-xs text-slate-500">ANOMALY DETECTION & EXPLAINABILITY</h3>
                    {pipelineStages.slice(3, 6).map(s => (
                        <div key={s.num} className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-xs space-y-1">
                            <div className="font-bold text-slate-900 flex items-center justify-between">
                                <span>{s.num}. {s.title}</span>
                                <span className="text-[10px] font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">{s.tech}</span>
                            </div>
                            <p className="text-slate-600 text-[11px]">{s.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ------------------- ALERT DRAWER COMPONENT -------------------
function AlertDrawer({ alert, onClose, onAcknowledge, onInvestigate, onResolvePrompt, onDismiss }) {
    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
            <div className="w-[420px] bg-white border-l border-slate-200 h-full p-5 flex flex-col justify-between overflow-y-auto shadow-2xl">
                <div>
                    <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
                        <h3 className="font-bold text-sm text-slate-900">ALERT DIAGNOSTIC CONSULTATION</h3>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl">&times;</button>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-xs space-y-1.5 mb-4">
                        <div>Station: <strong className="text-slate-900">{alert.station_id} ({alert.station_name})</strong></div>
                        <div>Issue: <strong className="text-red-600">{alert.anomaly_type}</strong></div>
                        <div>Severity: <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 font-bold">{alert.severity}</span></div>
                        <div>Confidence: <strong className="text-blue-700">{alert.confidence}%</strong></div>
                        <div>Status: <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold">{alert.status}</span></div>
                    </div>

                    <div className="mb-4">
                        <h4 className="text-xs font-bold text-slate-500 mb-1.5">Why Was This Detected? (XAI Evidence)</h4>
                        <ul className="text-xs text-slate-700 space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                            {(alert.why_reasons || []).map((r, i) => <li key={i}>✓ {r}</li>)}
                        </ul>
                    </div>

                    <div className="mb-4">
                        <h4 className="text-xs font-bold text-slate-500 mb-1.5">Recommended Operational Action</h4>
                        <div className="bg-blue-50 border border-blue-200 text-xs text-slate-800 p-2.5 rounded-lg">
                            {alert.recommended_action || "Perform hardware sensor calibration check."}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-2 mt-4">
                    <button onClick={() => onAcknowledge(alert.id)} className="w-full py-2 bg-amber-500 text-white font-bold text-xs rounded-lg shadow-sm">✓ ACKNOWLEDGE ALERT</button>
                    <button onClick={() => onInvestigate(alert.id)} className="w-full py-2 bg-blue-600 text-white font-bold text-xs rounded-lg shadow-sm">🔍 INVESTIGATE STATION</button>
                    <button onClick={() => onResolvePrompt(alert)} className="w-full py-2 bg-emerald-600 text-white font-bold text-xs rounded-lg shadow-sm">✓ RESOLVE ALERT (WITH NOTES)</button>
                    <button onClick={() => onDismiss(alert.id)} className="w-full py-2 bg-slate-100 text-slate-600 hover:text-slate-900 font-bold text-xs rounded-lg border border-slate-300">✕ DISMISS</button>
                </div>
            </div>
        </div>
    );
}

// ------------------- NOTIFICATIONS DRAWER COMPONENT -------------------
function NotificationDrawer({ notifications, unreadCount, audioEnabled, onToggleAudio, onClose, onAcknowledge, onInvestigate }) {
    const [filter, setFilter] = useState('ALL');

    let filtered = notifications;
    if (filter === 'CRITICAL') filtered = notifications.filter(n => n.severity === 'CRITICAL');
    else if (filter === 'UNREAD') filtered = notifications.filter(n => !n.read);

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
            <div className="w-[440px] bg-white border-l border-slate-200 h-full p-5 flex flex-col justify-between overflow-y-auto shadow-2xl">
                <div>
                    <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm text-slate-900">🔔 REAL-TIME NOTIFICATION TRAY</h3>
                            {unreadCount > 0 && <span className="bg-red-500 text-white font-mono text-[10px] px-2 py-0.5 rounded-full font-bold">{unreadCount} New</span>}
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl">&times;</button>
                    </div>

                    <div className="flex items-center justify-between bg-slate-50 border border-slate-200 p-2.5 rounded-lg mb-4 text-xs">
                        <span className="text-slate-700 font-medium">Audio Chime Alerts</span>
                        <button onClick={onToggleAudio} className={`px-2.5 py-1 rounded text-[11px] font-bold ${audioEnabled ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-200 text-slate-600'}`}>
                            {audioEnabled ? '🔊 ENABLED' : '🔇 MUTED'}
                        </button>
                    </div>

                    <div className="flex gap-2 mb-3">
                        {['ALL', 'UNREAD', 'CRITICAL'].map(tab => (
                            <button 
                                key={tab}
                                onClick={() => setFilter(tab)}
                                className={`px-3 py-1 rounded text-xs font-semibold transition ${filter === tab ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-col gap-2.5 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
                        {filtered.length === 0 ? (
                            <div className="text-center py-12 text-slate-400 text-xs">No notifications in tray.</div>
                        ) : (
                            filtered.map(n => (
                                <div key={n.id} className={`bg-slate-50 border p-3 rounded-lg flex flex-col gap-1.5 border-l-4 ${n.severity === 'CRITICAL' ? 'border-l-red-500 border-slate-200' : 'border-l-amber-500 border-slate-200'} ${!n.read ? 'bg-blue-50/40' : 'opacity-80'}`}>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="font-bold text-slate-900">{n.title}</span>
                                        <span className="text-[10px] text-slate-500 font-mono">{n.timestamp}</span>
                                    </div>
                                    <p className="text-xs text-slate-700">{n.message}</p>
                                    <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-[11px]">
                                        <span className="text-slate-500">Confidence: <strong className="text-blue-700">{n.confidence}%</strong></span>
                                        <div className="flex gap-2">
                                            <button onClick={() => onInvestigate(n.id)} className="px-2 py-0.5 bg-blue-600 text-white font-bold text-[10px] rounded shadow-sm">Investigate</button>
                                            {!n.read && <button onClick={() => onAcknowledge(n.id)} className="px-2 py-0.5 bg-amber-500 text-white font-bold text-[10px] rounded shadow-sm">Acknowledge</button>}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ------------------- CSV DATASET IMPORTER & EXAMPLE DATASETS MODAL -------------------
const DEFAULT_SAMPLE_DATASETS = [
    {
        id: 'baseline_normal',
        filename: 'dataset_1_baseline_normal.csv',
        title: 'Baseline Healthy Network',
        badge: 'Optimal Baseline',
        badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        stations_count: 8,
        records_count: 480,
        region: 'Andhra Pradesh Network',
        description: 'Standard 24-hr diurnal cycle across 8 stations with zero sensor faults, verified hydrostatic pressure, and normal humidity.',
        highlight: 'Physics Consensus: 100% • 0 Anomalies'
    },
    {
        id: 'cyclonic_storm',
        filename: 'dataset_2_cyclonic_storm.csv',
        title: 'Bay of Bengal Cyclonic Depression',
        badge: 'Severe Weather',
        badgeColor: 'bg-sky-100 text-sky-800 border-sky-300',
        stations_count: 8,
        records_count: 480,
        region: 'Coastal AP Corridor',
        description: 'Severe meteorological event with coastal pressure drop (-22 hPa), high winds (60 km/h), and heavy precipitation (>65 mm). Tests genuine storm vs sensor fault discrimination.',
        highlight: 'Consensus confirms genuine meteorological front'
    },
    {
        id: 'mountain_network',
        filename: 'dataset_3_mountain_network.csv',
        title: 'Himalayan High-Altitude Network',
        badge: 'Dynamic Stations',
        badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
        stations_count: 6,
        records_count: 360,
        region: 'Western Himalayas',
        description: 'Dynamic discovery of 6 new mountain stations (Shimla, Manali, Leh, Srinagar, Dharamshala, Solan; 1457m - 3500m elevation). Demonstrates dynamic station discovery & hydrostatic altitude scaling.',
        highlight: 'Dynamic nodes onboarding: AWS-101 to AWS-106'
    },
    {
        id: 'sensor_faults',
        filename: 'dataset_4_sensor_faults.csv',
        title: 'Multi-Sensor Degradation & Faults',
        badge: 'Hardware Faults',
        badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
        stations_count: 8,
        records_count: 480,
        region: 'Andhra Pradesh Network',
        description: 'Real-world compound faults: stuck temperature on AWS-003 (22.4°C), sensor drift on AWS-005 (+0.8%/step), psychrometric violation on AWS-008, and low edge battery on AWS-004 (<3.0V).',
        highlight: 'Triggers XAI SHAP explanation & Spatial IDW imputation'
    },
    {
        id: 'heatwave_drought',
        filename: 'dataset_5_heatwave_drought.csv',
        title: 'Severe Heatwave & Aridity Front',
        badge: 'Extreme Heatwave',
        badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
        stations_count: 8,
        records_count: 480,
        region: 'Rayalaseema / Inland AP',
        description: 'Extreme arid heatwave with peak temperatures reaching 46.5°C and relative humidity dropping to 12%. Validates saturation vapor pressure equations and thermal threshold tolerance.',
        highlight: 'Thermal stress verification & vapor pressure validation'
    },
    {
        id: 'comm_outage_noise',
        filename: 'dataset_6_comm_outage_noise.csv',
        title: 'Cellular Dropout & Signal Noise',
        badge: 'Telemetry Faults',
        badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
        stations_count: 8,
        records_count: 480,
        region: 'Mixed AP Network',
        description: 'Edge telemetry degradation: cellular signal fading on AWS-001 with intermittent null packets (-105 dBm RSSI) and wild noise spikes on AWS-006. Validates edge cleaning & bounds rejection.',
        highlight: 'Edge noise rejection & missing packet imputation'
    }
];

function DatasetImporterModal({ onClose, onSuccess }) {
    const [activeTab, setActiveTab] = useState('examples'); // 'examples' or 'upload'
    const [sampleDatasets, setSampleDatasets] = useState(DEFAULT_SAMPLE_DATASETS);
    const [file, setFile] = useState(null);
    const [previewData, setPreviewData] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [loadingDatasetId, setLoadingDatasetId] = useState(null);
    const [activeStage, setActiveStage] = useState(0);
    const [errorMsg, setErrorMsg] = useState(null);
    const [dragActive, setDragActive] = useState(false);

    const stages = [
        { num: 1, label: "Sensor Data", detail: "Reading raw AWS sensor CSV/JSON telemetry stream" },
        { num: 2, label: "Preprocessing", detail: "Python, Pandas & NumPy data cleaning & missing value handling" },
        { num: 3, label: "Feature Eng.", detail: "Extracting temporal & seasonal weather patterns" },
        { num: 4, label: "AI/ML Detection", detail: "Isolation Forest & time-series anomaly detection pass" },
        { num: 5, label: "Explainable AI", detail: "Generating SHAP & LIME feature attribution reasoning" },
        { num: 6, label: "Output & Monitor", detail: "Updating Flask dashboard real-time monitoring output" }
    ];

    useEffect(() => {
        fetch('/api/sample-datasets')
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success' && data.datasets && data.datasets.length > 0) {
                    setSampleDatasets(data.datasets);
                }
            })
            .catch(() => {});
    }, []);

    const handleLoadSampleDataset = async (dataset) => {
        setLoadingDatasetId(dataset.id || dataset.filename);
        setUploading(true);
        setErrorMsg(null);
        setActiveStage(1);

        for (let s = 1; s <= 5; s++) {
            setActiveStage(s);
            await new Promise(r => setTimeout(r, 260));
        }

        try {
            const res = await fetch('/api/load-sample-dataset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: dataset.filename })
            });
            const data = await res.json();
            setActiveStage(6);
            await new Promise(r => setTimeout(r, 250));
            setUploading(false);
            setLoadingDatasetId(null);

            if (data.status === 'success') {
                onSuccess(data.dataset_name || dataset.title || dataset.filename);
                onClose();
            } else {
                setErrorMsg(data.message || "Failed to load sample dataset.");
            }
        } catch (e) {
            setUploading(false);
            setLoadingDatasetId(null);
            setErrorMsg("Network error occurred while loading dataset.");
        }
    };

    const handleFileChange = (e) => {
        const selected = e.target.files[0];
        if (selected) parseFilePreview(selected);
    };

    const parseFilePreview = (selectedFile) => {
        setFile(selectedFile);
        setErrorMsg(null);
        const reader = new FileReader();
        reader.onload = (evt) => {
            const text = evt.target.result;
            const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            if (lines.length === 0) {
                setErrorMsg("Uploaded CSV file is empty.");
                return;
            }
            const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
            const required = ['timestamp', 'station_id', 'temperature', 'pressure', 'humidity'];
            const missing = required.filter(r => !headers.includes(r));

            const sampleRows = lines.slice(1, 6).map(line => {
                const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                let rowObj = {};
                headers.forEach((h, i) => { rowObj[h] = cols[i] || ''; });
                return rowObj;
            });

            setPreviewData({
                headers: headers,
                missingColumns: missing,
                totalLines: lines.length - 1,
                sampleRows: sampleRows
            });
        };
        reader.readAsText(selectedFile);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            parseFilePreview(e.dataTransfer.files[0]);
        }
    };

    const handleUploadSubmit = async () => {
        if (!file) return;
        if (previewData && previewData.missingColumns.length > 0) {
            setErrorMsg(`Cannot import: CSV is missing required columns: ${previewData.missingColumns.join(', ')}`);
            return;
        }

        setUploading(true);
        setErrorMsg(null);
        setActiveStage(1);

        for (let s = 1; s <= 5; s++) {
            setActiveStage(s);
            await new Promise(r => setTimeout(r, 350));
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/upload-csv', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            setActiveStage(6);
            await new Promise(r => setTimeout(r, 300));
            setUploading(false);
            if (data.status === 'success') {
                onSuccess(file.name);
                onClose();
            } else {
                setErrorMsg(data.message || "Failed to parse CSV on backend.");
            }
        } catch (e) {
            setUploading(false);
            setErrorMsg("Network error occurred during CSV upload.");
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-xl w-[820px] max-h-[92vh] p-5 flex flex-col gap-3.5 shadow-2xl overflow-hidden">
                <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                    <div>
                        <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">📂 DATASET ENGINE & 6-STAGE TECHNICAL PIPELINE</h3>
                        <p className="text-xs text-slate-500">Sensor Data → Preprocessing → Feature Engineering → AI/ML Detection → Explainable AI → Output & Monitoring</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl font-bold">&times;</button>
                </div>

                {/* Technical Approach 6-Stage Banner */}
                <div className="bg-blue-50/70 border border-blue-200 p-2.5 rounded-lg text-xs space-y-1.5">
                    <div className="font-bold text-blue-900 text-[11px] flex justify-between items-center">
                        <span>TECHNICAL APPROACH 6-STAGE PIPELINE:</span>
                        <span className="font-mono text-[10px] text-blue-700">Pandas • NumPy • Isolation Forest • SHAP / LIME</span>
                    </div>

                    <div className="grid grid-cols-6 gap-1.5 text-center">
                        {stages.map((stg) => {
                            const isActive = activeStage === stg.num;
                            const isDone = activeStage > stg.num;
                            let bgClass = "bg-white border-slate-200 text-slate-600";
                            if (isActive) bgClass = "bg-blue-600 border-blue-700 text-white font-bold animate-pulse";
                            else if (isDone) bgClass = "bg-emerald-100 border-emerald-300 text-emerald-800 font-bold";

                            return (
                                <div key={stg.num} className={`p-1.5 rounded border text-[10px] flex flex-col justify-between h-13 ${bgClass}`}>
                                    <div className="font-mono font-black">{stg.num}. {stg.label}</div>
                                    <div className="text-[8px] leading-tight truncate">{isDone ? '✓ DONE' : (isActive ? 'RUNNING...' : 'READY')}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Tabs: Example Datasets vs Custom File Upload */}
                <div className="flex border-b border-slate-200 gap-4 text-xs font-bold">
                    <button 
                        onClick={() => setActiveTab('examples')} 
                        className={`pb-2 border-b-2 transition flex items-center gap-1.5 ${activeTab === 'examples' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        <span>⚡ Ready-to-Run Example Datasets</span>
                        <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.2 rounded-full font-bold">6 Scenarios</span>
                    </button>
                    <button 
                        onClick={() => setActiveTab('upload')} 
                        className={`pb-2 border-b-2 transition flex items-center gap-1.5 ${activeTab === 'upload' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        <span>📁 Upload Custom CSV File</span>
                    </button>
                </div>

                {errorMsg && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-2.5 rounded-lg text-xs font-bold">
                        ⚠️ {errorMsg}
                    </div>
                )}

                {/* Tab 1: Example Datasets Grid */}
                {activeTab === 'examples' && (
                    <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 max-h-[46vh]">
                        <div className="text-xs text-slate-500 font-medium">
                            Select any pre-configured AWS weather dataset to instantly load the network, execute the 6-stage AI pipeline, and analyze real-time diagnostics:
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                            {sampleDatasets.map((ds) => {
                                const isLoadingThis = loadingDatasetId === (ds.id || ds.filename);
                                return (
                                    <div key={ds.filename} className="bg-slate-50 border border-slate-200 hover:border-blue-300 rounded-lg p-3 flex flex-col justify-between transition shadow-sm">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between gap-1">
                                                <span className="font-bold text-slate-900 text-xs leading-snug">{ds.title}</span>
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${ds.badgeColor || 'bg-blue-100 text-blue-800 border-blue-200'}`}>
                                                    {ds.badge}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                                                <span>📡 {ds.stations_count} Stations</span>
                                                <span>•</span>
                                                <span>📊 {ds.records_count} Records</span>
                                                <span>•</span>
                                                <span>📍 {ds.region}</span>
                                            </div>
                                            <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2">
                                                {ds.description}
                                            </p>
                                            <div className="text-[10px] font-mono text-blue-800 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded truncate">
                                                💡 {ds.highlight || ds.scenario_preview}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-slate-200 text-xs">
                                            <a 
                                                href={`/api/sample-datasets/download/${ds.filename}`} 
                                                download 
                                                className="text-[11px] text-slate-500 hover:text-slate-800 font-bold flex items-center gap-1 hover:underline"
                                            >
                                                📥 Download CSV
                                            </a>
                                            <button 
                                                onClick={() => handleLoadSampleDataset(ds)} 
                                                disabled={uploading} 
                                                className={`px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded transition shadow-sm flex items-center gap-1.5 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                {isLoadingThis ? (
                                                    <>
                                                        <span className="animate-spin text-xs">🌀</span>
                                                        <span>Running Pipeline...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span>▶</span>
                                                        <span>Load & Run</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Tab 2: Custom CSV File Upload */}
                {activeTab === 'upload' && (
                    <div className="flex-1 overflow-y-auto space-y-3 max-h-[46vh] pr-1">
                        <div 
                            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                            onDragLeave={() => setDragActive(false)}
                            onDrop={handleDrop}
                            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition ${dragActive ? 'border-blue-600 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:border-slate-400'}`}
                        >
                            <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" id="csvFileInput" />
                            <label htmlFor="csvFileInput" className="cursor-pointer flex flex-col items-center gap-1.5">
                                <span className="text-2xl">📊</span>
                                <span className="text-xs font-bold text-slate-800">{file ? file.name : 'Click to select or drag & drop CSV file here'}</span>
                                <span className="text-[11px] text-slate-500">Supported columns: timestamp, station_id, temperature, pressure, humidity, dew_point, rainfall, wind_speed</span>
                            </label>
                        </div>

                        {previewData && (
                            <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-xs space-y-1.5">
                                <div className="flex justify-between items-center border-b border-slate-200 pb-1">
                                    <span className="font-bold text-slate-800">File Validation:</span>
                                    {previewData.missingColumns.length === 0 ? (
                                        <span className="text-emerald-700 font-bold flex items-center gap-1">✓ Valid Column Schema ({previewData.totalLines} records)</span>
                                    ) : (
                                        <span className="text-red-600 font-bold">✕ Missing: {previewData.missingColumns.join(', ')}</span>
                                    )}
                                </div>

                                <div className="overflow-x-auto max-h-24">
                                    <table className="w-full text-[10px] text-left">
                                        <thead className="text-slate-500 border-b border-slate-200">
                                            <tr>
                                                {previewData.headers.slice(0, 6).map(h => <th key={h} className="p-1">{h}</th>)}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {previewData.sampleRows.map((r, idx) => (
                                                <tr key={idx} className="border-b border-slate-200">
                                                    {previewData.headers.slice(0, 6).map(h => <td key={h} className="p-1 font-mono text-slate-700">{r[h]}</td>)}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {uploading && (
                    <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-lg text-xs font-mono text-blue-900 font-bold flex items-center justify-between">
                        <span>[STAGE {activeStage}/6] {stages[activeStage - 1]?.detail || 'Processing...'}</span>
                        <span className="animate-spin text-blue-700 text-base">🌀</span>
                    </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                    <button onClick={onClose} className="px-4 py-1.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-lg border border-slate-300">Cancel</button>
                    {activeTab === 'upload' && (
                        <button 
                            onClick={handleUploadSubmit} 
                            disabled={!file || uploading} 
                            className={`px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition shadow-sm ${(!file || uploading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {uploading ? 'Processing 6-Stage Pipeline...' : '🚀 Execute 6-Stage Pipeline & Analyze'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ------------------- STATION DIAGNOSTIC PANEL MODAL (CRITICAL CORE FIX SYNCHRONIZATION) -------------------
function StationDiagnosticModal({ stationId, station, alerts = [], onClose, onAcknowledge, onResolvePrompt }) {
    if (!station) return null;

    const info = station.station_info;
    const t = station.telemetry;
    const p = station.physics_diagnostics;
    const activeAlert = alerts.length > 0 ? alerts[0] : null;

    const isFault = station.status === 'FAULT' || station.is_anomaly || activeAlert !== null;
    const isWarning = station.status === 'WARNING' || t.battery_voltage < 3.2;

    let badgeText = "HEALTHY • OPERATIONAL";
    let badgeStyle = "bg-emerald-100 text-emerald-800 border-emerald-300";

    if (activeAlert) {
        badgeText = `CRITICAL FAULT: ${activeAlert.anomaly_type.toUpperCase()}`;
        badgeStyle = "bg-red-100 text-red-800 border-red-300";
    } else if (isWarning) {
        badgeText = "WARNING • DRIFT / LOW VOLTAGE";
        badgeStyle = "bg-amber-100 text-amber-800 border-amber-300";
    }

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-xl w-[680px] max-h-[90vh] overflow-y-auto p-5 flex flex-col gap-4 shadow-2xl">
                {/* Header */}
                <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                    <div>
                        <h3 className="font-bold text-base text-slate-900">{info.id}: {info.name} — Station Diagnostic Panel</h3>
                        <p className="text-xs text-slate-500 font-mono">Lat: {info.latitude}°N | Lon: {info.longitude}°E | Elev: {info.elevation}m</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl">&times;</button>
                </div>

                {/* Status Synchronized Alert Banner */}
                <div className={`p-3 rounded-lg border text-xs flex justify-between items-center font-bold ${badgeStyle}`}>
                    <span>{badgeText}</span>
                    <span className="font-mono text-[10px]">Status: {activeAlert?.status || station.status}</span>
                </div>

                {/* Failure Mathematical / Physical Breakdown (Flatline / Drift / Disconnect) */}
                {activeAlert && (
                    <div className="bg-red-50 border border-red-200 p-3.5 rounded-xl text-xs space-y-2">
                        <div className="font-bold text-red-900 flex items-center gap-1.5">
                            <span>🚨 ACTIVE ANOMALY MATHEMATICAL BREAKDOWN:</span>
                            <span className="font-mono text-red-700">[{activeAlert.anomaly_type}]</span>
                        </div>
                        <div className="text-slate-700 bg-white p-2.5 rounded-lg border border-red-200 font-mono space-y-1">
                            <div>Observed Telemetry Reading: <strong className="text-red-600">{t.temperature !== null ? `${t.temperature}°C` : 'NULL (Flatline)'}</strong></div>
                            <div>Expected Physical Baseline: <strong className="text-emerald-700">{station.expected_value !== undefined ? `${station.expected_value}°C` : '31.6°C'}</strong></div>
                            <div>Confidence Level: <strong>{activeAlert.confidence}%</strong></div>
                            <div className="text-slate-500 mt-1"><em>Evidence: {activeAlert.why_reasons ? activeAlert.why_reasons.join(', ') : 'Physical bounds violation detected.'}</em></div>
                        </div>
                    </div>
                )}

                {/* Telemetry Sensor Array Grid */}
                <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className={`p-3 rounded-lg border ${t.temperature === 22.4 && isFault ? 'bg-red-50 border-red-300' : 'bg-slate-50 border-slate-200'}`}>
                        <span className="text-slate-500 text-[10px] block">Temperature Transducer</span>
                        <strong className="text-lg font-mono text-slate-900">{t.temperature !== null ? `${t.temperature} °C` : 'NULL'}</strong>
                        <div className="text-[10px] text-slate-500 mt-1">Health Rating: <strong className="text-emerald-700">98% ✓</strong></div>
                    </div>
                    <div className={`p-3 rounded-lg border ${t.humidity > 85 && isWarning ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200'}`}>
                        <span className="text-slate-500 text-[10px] block">Relative Humidity Probe</span>
                        <strong className="text-lg font-mono text-slate-900">{t.humidity !== null ? `${t.humidity} %` : 'NULL'}</strong>
                        <div className="text-[10px] text-slate-500 mt-1">Health Rating: <strong className="text-amber-700">91% ⚠</strong></div>
                    </div>
                    <div className="p-3 rounded-lg border bg-slate-50 border-slate-200">
                        <span className="text-slate-500 text-[10px] block">Pressure Transducer</span>
                        <strong className="text-lg font-mono text-slate-900">{t.pressure !== null ? `${t.pressure} hPa` : 'NULL'}</strong>
                        <div className="text-[10px] text-slate-500 mt-1">Health Rating: <strong className="text-emerald-700">95% ✓</strong></div>
                    </div>
                </div>

                {/* Battery & Hardware Signal Voltage */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs flex justify-between items-center">
                    <div>
                        <span className="text-slate-500 font-medium">Edge Battery Voltage: </span>
                        <strong className={`font-mono text-sm ${t.battery_voltage < 3.2 ? 'text-amber-600 font-bold' : 'text-emerald-700'}`}>{t.battery_voltage || 13.5} V</strong>
                        {t.battery_voltage < 3.2 && <span className="ml-2 text-amber-700 font-bold">⚠️ Solar Charger Low Voltage Drop</span>}
                    </div>
                    <div>
                        <span className="text-slate-500 font-medium">Cellular Signal RSSI: </span>
                        <strong className="font-mono text-blue-700 text-sm">{t.signal_strength || -68} dBm</strong>
                    </div>
                </div>

                {/* Physics PINN Diagnostics */}
                <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-lg text-xs space-y-1 text-slate-800">
                    <div className="font-bold text-blue-900">PINN Physics Engine Diagnostic Summary:</div>
                    <div>Overall Physics Consistency Score: <strong className="text-blue-700 font-mono">{p.overall_physics_score}%</strong></div>
                    <div>Magnus-Tetens Dewpoint Check: Dew point error = <span className="font-mono font-bold">{p.psychrometric_dew_point_check?.dew_point_error || 0}°C</span></div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 justify-end border-t border-slate-200 pt-3">
                    {activeAlert && activeAlert.status === 'NEW' && (
                        <button onClick={() => onAcknowledge(activeAlert.id)} className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-lg shadow-sm">
                            ✓ Acknowledge Alert
                        </button>
                    )}
                    {activeAlert && (
                        <button onClick={() => onResolvePrompt(activeAlert)} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm">
                            ✓ Resolve Alert (With Notes)
                        </button>
                    )}
                    <button onClick={onClose} className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg border border-slate-300">
                        Close Diagnostic Panel
                    </button>
                </div>
            </div>
        </div>
    );
}

// ------------------- TECHNICIAN RESOLUTION MODAL -------------------
function ResolutionModal({ alert, notes, setNotes, onSubmit, onClose }) {
    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <form onSubmit={onSubmit} className="bg-white border border-slate-200 rounded-xl w-[480px] p-5 flex flex-col gap-4 shadow-2xl">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                    <h3 className="font-bold text-sm text-slate-900">Technician Consultation Resolution Notes</h3>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl">&times;</button>
                </div>
                <div className="text-xs text-slate-700">
                    Resolving alert for <strong className="text-slate-900">{alert.station_id}</strong> ({alert.anomaly_type})
                </div>
                <textarea
                    rows="3"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Enter technician consultation notes (e.g. Field sensor probe recalibrated, telemetry cross-verified)..."
                    className="w-full bg-slate-50 border border-slate-300 p-2.5 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                    required
                ></textarea>
                <div className="flex gap-2 justify-end">
                    <button type="button" onClick={onClose} className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs rounded-lg border border-slate-300">Cancel</button>
                    <button type="submit" className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm">✓ Complete Resolution</button>
                </div>
            </form>
        </div>
    );
}

// Render React App
ReactDOM.render(<SkyGuardApp />, document.getElementById('root'));
