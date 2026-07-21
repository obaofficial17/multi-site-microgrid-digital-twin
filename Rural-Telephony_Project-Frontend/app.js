// Initialize Supabase Client using the globally accessible config object
const SUPABASE_URL = SUPABASE_CONFIG.URL;
const SUPABASE_ANON_KEY = SUPABASE_CONFIG.ANON_KEY;

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Multi-Tenant Infrastructure Security Contact Directory
const SITE_SECURITY_DIRECTORY = {
    "Site 1 - Epe": { responder: "Epe SG", hotline: "+234 803 111 0001", supervisor: "Engr. Lekan" },
    "Site 2 - Oyere": { responder: "Oyere SG", hotline: "+234 803 111 0002", supervisor: "Tosin" },
    "Site 3 - Aiyetiabo": { responder: "Aiyetiabo SG", hotline: "+234 803 111 0003", supervisor: "Lekan (Field Ops)" },
    "Site 4 - Emuren": { responder: "Emuren SG", hotline: "+234 803 111 0004", supervisor: "On-Site Resident Engr" },
    "Site 5 - Igirigi": { responder: "Igirigi SG", hotline: "+234 803 111 0005", supervisor: "Tosin" },
    "Site 6 - Gbedu": { responder: "Gbedu SG", hotline: "+234 803 111 0006", supervisor: "Lekan" },
    "Site 7 - Obbo Aiyegunle": { responder: "Obbo Aiyegunle SG", hotline: "+234 803 111 0007", supervisor: "HQ Admin Lead" }
};

// UI DOM Pointers
const authOverlay = document.getElementById('auth-overlay');
const appContent = document.getElementById('app-content');
const loginForm = document.getElementById('login-form');
const authError = document.getElementById('auth-error');
const logoutBtn = document.getElementById('logout-btn');
const siteSelector = document.getElementById('site-selector');

const heartbeatBadge = document.getElementById('heartbeat-badge');
const heartbeatDot = document.getElementById('heartbeat-dot');
const heartbeatText = document.getElementById('heartbeat-text');

const securitySupervisor = document.getElementById('security-supervisor');
const securityResponder = document.getElementById('security-responder');
const securityHotline = document.getElementById('security-hotline');
const liveAlarmBanner = document.getElementById('live-alarm-banner');
const liveAlarmDesc = document.getElementById('live-alarm-desc');
const alarmHistoryContainer = document.getElementById('alarm-history-container');

const totalSolarVal = document.getElementById('total-solar-val');
const totalLoadVal = document.getElementById('total-load-val');
const batVal = document.getElementById('bat-val');
const socBadge = document.getElementById('soc-badge');
const socBar = document.getElementById('soc-bar');

// Chart & Audio Global References
let chartGen = null, chartVolt = null, chartLoad = null, chartBat = null;
let activeChannel = null, heartbeatTimer = null, audioCtx = null;
const MAX_DATAPOINTS_VIEWPORT = 15;

// ==============================================================================
// 0. INDUSTRIAL ALARM AUDIO SYNTHESIZER (Web Audio API)
// ==============================================================================
function triggerAudibleSCADAAlert() {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 Tone
        osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.3);

        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
        console.warn("Audio Context waiting for initial user UI interaction.");
    }
}

// ==============================================================================
// 1. SCADA CHART ENGINE INITIALIZATION (Updated for Light Theme)
// ==============================================================================
function initSCADACharts() {
    // Light Mode Grid & Text Settings
    const commonScales = {
        x: { grid: { color: '#f1f5f9' }, ticks: { color: '#64748b', font: { size: 10 } } },
        y: { grid: { color: '#f1f5f9' }, ticks: { color: '#64748b', font: { size: 10 } } }
    };
    const commonPlugin = { legend: { labels: { color: '#334155', font: { size: 11, weight: 'bold' } } } };

    chartGen = new Chart(document.getElementById('solarPowerChart'), {
        type: 'line',
        data: { labels: [], datasets: [
            { label: 'CC1 Output (W)', data: [], borderColor: '#10b981', backgroundColor: '#10b98120', borderWidth: 2, fill: true, tension: 0.2, pointRadius: 2 },
            { label: 'CC2 Output (W)', data: [], borderColor: '#0ea5e9', backgroundColor: '#0ea5e920', borderWidth: 2, fill: true, tension: 0.2, pointRadius: 2 }
        ]},
        options: { responsive: true, maintainAspectRatio: false, scales: commonScales, plugins: commonPlugin }
    });

    chartVolt = new Chart(document.getElementById('solarVoltChart'), {
        type: 'line',
        data: { labels: [], datasets: [
            { label: 'CC1 Input (V)', data: [], borderColor: '#f59e0b', borderWidth: 2, tension: 0.2, pointRadius: 2 },
            { label: 'CC2 Input (V)', data: [], borderColor: '#3b82f6', borderWidth: 2, tension: 0.2, pointRadius: 2 }
        ]},
        options: { responsive: true, maintainAspectRatio: false, scales: commonScales, plugins: commonPlugin }
    });

    chartLoad = new Chart(document.getElementById('loadPowerChart'), {
        type: 'line',
        data: { labels: [], datasets: [
            { label: 'CC1 Load Draw (W)', data: [], borderColor: '#6366f1', borderWidth: 2, tension: 0.2, pointRadius: 2 },
            { label: 'CC2 Load Draw (W)', data: [], borderColor: '#8b5cf6', borderWidth: 2, tension: 0.2, pointRadius: 2 }
        ]},
        options: { responsive: true, maintainAspectRatio: false, scales: commonScales, plugins: commonPlugin }
    });

    chartBat = new Chart(document.getElementById('batteryStabilityChart'), {
        type: 'line',
        data: { labels: [], datasets: [
            { label: 'DC Bus Potential (V)', data: [], borderColor: '#0d9488', backgroundColor: '#0d948815', borderWidth: 2.5, fill: true, tension: 0.2, pointRadius: 2 }
        ]},
        options: { responsive: true, maintainAspectRatio: false, scales: commonScales, plugins: commonPlugin }
    });
}

function appendMetricsToCharts(timeStr, r) {
    [chartGen, chartVolt, chartLoad, chartBat].forEach(c => {
        c.data.labels.push(timeStr);
        if(c.data.labels.length > MAX_DATAPOINTS_VIEWPORT) c.data.labels.shift();
    });

    chartGen.data.datasets[0].data.push(r.cc1_pv_watts);
    chartGen.data.datasets[1].data.push(r.cc2_pv_watts);
    chartVolt.data.datasets[0].data.push(r.cc1_pv_volts);
    chartVolt.data.datasets[1].data.push(r.cc2_pv_volts);
    chartLoad.data.datasets[0].data.push(r.cc1_load_watts);
    chartLoad.data.datasets[1].data.push(r.cc2_load_watts);
    chartBat.data.datasets[0].data.push(r.battery_voltage);

    [chartGen, chartVolt, chartLoad, chartBat].forEach(c => {
        if(c.data.datasets[0].data.length > MAX_DATAPOINTS_VIEWPORT) c.data.datasets.forEach(d => d.data.shift());
        c.update('none');
    });
}

// ==============================================================================
// 2. HARDWARE HEARTBEAT & 48V THRESHOLD ALARM INTERCEPT
// ==============================================================================
function kickHeartbeatCountdownTimer() {
    clearTimeout(heartbeatTimer);
    
    // Updated Light Theme Heartbeat Badges
    heartbeatBadge.className = "bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-emerald-200 shadow-sm";
    heartbeatDot.className = "w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping";
    heartbeatText.innerText = "DTU Link Active";

    heartbeatTimer = setTimeout(() => {
        heartbeatBadge.className = "bg-rose-50 text-rose-600 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-rose-200 shadow-sm animate-pulse";
        heartbeatDot.className = "w-1.5 h-1.5 rounded-full bg-rose-500";
        heartbeatText.innerText = "Connection Dormant";
    }, 40000);
}

function evaluateThresholdAlarms(r) {
    let internalFaultLogs = [];
    const batVolt = parseFloat(r.battery_voltage);

    if (batVolt < 44.0) {
        internalFaultLogs.push({ type: 'CRITICAL UNDERVOLTAGE', msg: `CRITICAL: Battery Voltage Deep Discharge (${batVolt}V) - Immediate Low Voltage Disconnect (LVD) Hazard.` });
    } else if (batVolt < 46.8) {
        internalFaultLogs.push({ type: 'UNDERVOLTAGE WARNING', msg: `WARNING: Battery Voltage Low (${batVolt}V) - DC Bus Approaching Discharge Threshold.` });
    }

    if (batVolt > 58.4) {
        internalFaultLogs.push({ type: 'CRITICAL OVERVOLTAGE', msg: `CRITICAL: Battery Overvoltage Spike (${batVolt}V) - Potential Charge Controller Regulation Failure / BMS Trip.` });
    } else if (batVolt > 56.8) {
        internalFaultLogs.push({ type: 'OVERVOLTAGE WARNING', msg: `WARNING: High Charge Potential (${batVolt}V) - Charge Controller Absorption Cutoff Approaching.` });
    }

    if (r.cc1_pv_volts > 110.0 || r.cc2_pv_volts > 110.0) {
        internalFaultLogs.push({ type: 'PV OVERVOLTAGE', msg: `OVERVOLTAGE: Solar String Voltage Spike Detected (CC1: ${r.cc1_pv_volts}V, CC2: ${r.cc2_pv_volts}V).` });
    }

    const currentHour = new Date().getHours();
    if ((r.cc1_pv_watts + r.cc2_pv_watts < 50.0) && (currentHour >= 8 && currentHour <= 17)) {
        internalFaultLogs.push({ type: 'UNDER-GENERATION', msg: `UNDER-GENERATION: Sub-optimal daylight harvesting detected during peak generation window.` });
    }

    if (internalFaultLogs.length > 0) {
        liveAlarmDesc.innerText = `${internalFaultLogs[0].type}: ${internalFaultLogs[0].msg}`;
        liveAlarmBanner.classList.remove('hidden');
        
        // Updated Light Theme Screen Flash
        document.body.classList.add('ring-4', 'ring-rose-500', 'ring-inset');
        triggerAudibleSCADAAlert();

        internalFaultLogs.forEach(alert => {
            const timeLog = new Date().toLocaleTimeString();
            if (alarmHistoryContainer.innerText.includes("Awaiting hardware baseline")) {
                alarmHistoryContainer.innerHTML = "";
            }
            
            // Updated Light Theme Log Entry Structure
            alarmHistoryContainer.innerHTML = `
                <div class="bg-white border-l-2 border-l-rose-500 border border-slate-200 rounded p-3 text-slate-700 shadow-sm space-y-1.5 animate-pulse">
                    <div class="flex justify-between font-bold items-center border-b border-slate-100 pb-1">
                        <span class="text-xs text-slate-800">${timeLog} ⚠️ ${r.site_id}</span>
                        <span class="text-[9px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded border border-rose-200 font-mono uppercase">${alert.type}</span>
                    </div>
                    <p class="text-slate-600 text-[11px] font-sans font-medium">${alert.msg}</p>
                </div>
            ` + alarmHistoryContainer.innerHTML;
        });
    } else {
        liveAlarmBanner.classList.add('hidden');
        document.body.classList.remove('ring-4', 'ring-rose-500', 'ring-inset');
    }
}

// ==============================================================================
// 3. UI DASHBOARD REFRESH & REALTIME SYNC
// ==============================================================================
function renderScreenCards(r) {
    if(!r) return;
    totalSolarVal.innerText = (r.cc1_pv_watts + r.cc2_pv_watts).toFixed(1);
    totalLoadVal.innerText = (r.cc1_load_watts + r.cc2_load_watts).toFixed(1);
    batVal.innerText = Number(r.battery_voltage).toFixed(2);
    socBadge.innerText = `${Number(r.battery_soc_percent).toFixed(0)}% SoC`;
    socBar.style.width = `${r.battery_soc_percent}%`;
}

async function syncNodeHistory(siteName) {
    const meta = SITE_SECURITY_DIRECTORY[siteName];
    if (meta) {
        securitySupervisor.innerText = meta.supervisor;
        securityResponder.innerText = meta.responder;
        securityHotline.innerText = meta.hotline;
    }

    let { data } = await supabaseClient
        .from('location_telemetry')
        .select('*')
        .eq('site_id', siteName)
        .order('id', { ascending: false })
        .limit(15);

    if (data && data.length > 0) {
        [chartGen, chartVolt, chartLoad, chartBat].forEach(c => {
            if(c) { c.data.labels = []; c.data.datasets.forEach(d => d.data = []); }
        });
        
        data.reverse().forEach(row => {
            const stamp = new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            appendMetricsToCharts(stamp, row);
        });
        renderScreenCards(data[data.length - 1]);
    }
}

function subscribeLiveFeed(siteName) {
    if (activeChannel) supabaseClient.removeChannel(activeChannel);

    activeChannel = supabaseClient
        .channel('live-scada-stream')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'location_telemetry', filter: `site_id=eq.${siteName}` }, 
        (payload) => {
            kickHeartbeatCountdownTimer();
            const row = payload.new;
            const stamp = new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            renderScreenCards(row);
            appendMetricsToCharts(stamp, row);
            evaluateThresholdAlarms(row);
        })
        .subscribe();
}

siteSelector.addEventListener('change', (e) => {
    syncNodeHistory(e.target.value);
    subscribeLiveFeed(e.target.value);
});

// ==============================================================================
// 4. AUTHENTICATION & MOUNT GATEKEEPER
// ==============================================================================
function mountDashboard() {
    authOverlay.classList.add('opacity-0', 'pointer-events-none');
    appContent.classList.remove('invisible');
    initSCADACharts();
    syncNodeHistory(siteSelector.value);
    subscribeLiveFeed(siteSelector.value);
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.classList.add('hidden');
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
        authError.innerText = `Identity verification rejected: ${error.message}`;
        authError.classList.remove('hidden');
    } else {
        mountDashboard();
    }
});

logoutBtn.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.reload();
});

async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) mountDashboard();
}
checkSession();