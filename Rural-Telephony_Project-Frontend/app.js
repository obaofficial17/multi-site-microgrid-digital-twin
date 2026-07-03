// ==============================================================================
// A1 POWER MONITORING CORE SCADA ENGINE (FIRST PRINCIPLES)
// ==============================================================================

const SUPABASE_URL = "https://icgryayptwjgcpqhwsxx.supabase.co";
// !!! ACTION REQUIRED !!! Replace this string with your long sb_publishable_... key!
const SUPABASE_ANON_KEY = "sb_publishable_U8VMbs1XABYo62cOslpNkw_PfN6rPRl";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Multi-Tenant Infrastructure Security Contact Directory Directory
const SITE_SECURITY_DIRECTORY = {
    "Site 1 - Epe": { responder: "Epe SG", hotline: "+234 803 111 0001", supervisor: "Engr. Lekan" },
    "Site 2 - Oyere": { responder: "Oyere SG", hotline: "+234 803 111 0002", supervisor: "Tosin" },
    "Site 3 - Aiyetiabo": { responder: "Aiyetiabo SG", hotline: "+234 803 111 0003", supervisor: "Lekan (Field Ops)" },
    "Site 4 - Emuren": { responder: "Emuren SG", hotline: "+234 803 111 0004", supervisor: "On-Site Resident Engr" },
    "Site 5 - Igirigi": { responder: "Igirigi SG", hotline: "+234 803 111 0005", supervisor: "Tosin" },
    "Site 6 - Gbedu": { responder: "Gbedu SG", hotline: "+234 803 111 0006", supervisor: "Lekan" },
    "Site 7 - Obbo Aiyegunle": { responder: "Obbo Aiyegunle SG", hotline: "+234 803 111 0007", supervisor: "HQ Admin Lead" }
};

// UI DOM Pointers References
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

// Chart Global Cache References
let chartGen = null, chartVolt = null, chartLoad = null, chartBat = null;
let activeChannel = null, heartbeatTimer = null;
const MAX_DATAPOINTS_VIEWPORT = 15;

// ==============================================================================
// 1. ENGINE GRAPHICS INITIALIZATION
// ==============================================================================
function initSCADACharts() {
    const commonScales = {
        x: { grid: { color: '#33415530' }, ticks: { color: '#94a3b8', font: { size: 9 } } },
        y: { grid: { color: '#33415530' }, ticks: { color: '#94a3b8', font: { size: 9 } } }
    };
    const commonPlugin = { legend: { labels: { color: '#f1f5f9', font: { size: 10, weight: 'bold' } } } };

    chartGen = new Chart(document.getElementById('solarPowerChart'), {
        type: 'line',
        data: { labels: [], datasets: [
            { label: 'CC1 Output (W)', data: [], borderColor: '#10b981', backgroundColor: '#10b98110', borderWidth: 1.5, fill: true, tension: 0.1, pointRadius: 1 },
            { label: 'CC2 Output (W)', data: [], borderColor: '#06b6d4', backgroundColor: '#06b6d410', borderWidth: 1.5, fill: true, tension: 0.1, pointRadius: 1 }
        ]},
        options: { responsive: true, maintainAspectRatio: false, scales: commonScales, plugins: commonPlugin }
    });

    chartVolt = new Chart(document.getElementById('solarVoltChart'), {
        type: 'line',
        data: { labels: [], datasets: [
            { label: 'CC1 Input (V)', data: [], borderColor: '#f59e0b', borderWidth: 1.5, tension: 0.1, pointRadius: 1 },
            { label: 'CC2 Input (V)', data: [], borderColor: '#3b82f6', borderWidth: 1.5, tension: 0.1, pointRadius: 1 }
        ]},
        options: { responsive: true, maintainAspectRatio: false, scales: commonScales, plugins: commonPlugin }
    });

    chartLoad = new Chart(document.getElementById('loadPowerChart'), {
        type: 'line',
        data: { labels: [], datasets: [
            { label: 'CC1 Load Draw (W)', data: [], borderColor: '#ec4899', borderWidth: 1.5, tension: 0.1, pointRadius: 1 },
            { label: 'CC2 Load Draw (W)', data: [], borderColor: '#a855f7', borderWidth: 1.5, tension: 0.1, pointRadius: 1 }
        ]},
        options: { responsive: true, maintainAspectRatio: false, scales: commonScales, plugins: commonPlugin }
    });

    chartBat = new Chart(document.getElementById('batteryStabilityChart'), {
        type: 'line',
        data: { labels: [], datasets: [
            { label: 'DC Bus Potential (V)', data: [], borderColor: '#8b5cf6', backgroundColor: '#8b5cf608', borderWidth: 2, fill: true, tension: 0.1, pointRadius: 1 }
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
// 2. HARDWARE HEARTBEAT & THRESHOLD ALARM INTERCEPT TRIGGERS
// ==============================================================================
function kickHeartbeatCountdownTimer() {
    clearTimeout(heartbeatTimer);
    
    // Pulse Header Badge Green
    heartbeatBadge.className = "bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-emerald-500/30";
    heartbeatDot.className = "w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping";
    heartbeatText.innerText = "DTU Link Active";

    // If hardware misses transmission window for more than 40s, flag Dormancy
    heartbeatTimer = setTimeout(() => {
        heartbeatBadge.className = "bg-rose-500/10 text-rose-400 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-rose-500/30 animate-pulse";
        heartbeatDot.className = "w-1.5 h-1.5 rounded-full bg-rose-500";
        heartbeatText.innerText = "Connection Dormant";
    }, 40000);
}

function evaluateThresholdAlarms(r) {
    let internalFaultLogs = [];
    
    // Industrial Parameter Checks
    if (r.battery_voltage < 24.2) {
        internalFaultLogs.push(`CRITICAL: Low Storage Potential Alarm (${r.battery_voltage}V) - Deep Discharge Hazard.`);
    }
    if (r.cc1_pv_volts > 110.0 || r.cc2_pv_volts > 110.0) {
        internalFaultLogs.push(`OVERVOLTAGE: PV String Input Spike Detected (CC1: ${r.cc1_pv_volts}V, CC2: ${r.cc2_pv_volts}V).`);
    }
    if ((r.cc1_pv_watts + r.cc2_pv_watts < 50.0) && (new Date().getHours() >= 8 && new Date().getHours() <= 17)) {
        internalFaultLogs.push(`UNDER-GENERATION: Zero or sub-optimal daylight harvesting detected during active hours.`);
    }

    if (internalFaultLogs.length > 0) {
        // 1. Pop open the live alert box banner overlay on screen
        liveAlarmDesc.innerText = internalFaultLogs[0];
        liveAlarmBanner.classList.remove('hidden');
        
        // 2. Append directly to the rolling SCADA historical table log
        internalFaultLogs.forEach(msg => {
            const timeLog = new Date().toLocaleTimeString();
            if (alarmHistoryContainer.innerText.includes("Awaiting hardware baseline")) {
                alarmHistoryContainer.innerHTML = "";
            }
            
            // Render detailed log block
            alarmHistoryContainer.innerHTML = `
                <div class="bg-rose-950/30 border border-rose-500/20 rounded p-2.5 py-1.5 text-rose-400 space-y-1">
                    <div class="flex justify-between font-bold">
                        <span>[${timeLog}] ⚠️ ${r.site_id}</span>
                        <span class="text-[10px] bg-rose-500/20 px-1.5 py-0.2 rounded border border-rose-500/30 font-sans uppercase">Email Dispatched</span>
                    </div>
                    <p class="text-slate-300 text-[10px] font-sans">${msg}</p>
                </div>
            ` + alarmHistoryContainer.innerHTML;
        });
    } else {
        liveAlarmBanner.classList.add('hidden');
    }
}

// ==============================================================================
// 3. STORAGE SYNC & DROPDOWN COORDINATOR
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
    // Map Site Contacts Directory details
    const meta = SITE_SECURITY_DIRECTORY[siteName];
    securitySupervisor.innerText = meta.supervisor;
    securityResponder.innerText = meta.responder;
    securityHotline.innerText = meta.hotline;

    let { data } = await supabaseClient
        .from('location_telemetry')
        .select('*')
        .eq('site_id', siteName)
        .order('id', { ascending: false })
        .limit(15);

    if (data && data.length > 0) {
        // Clear viewport lines array configurations before loading history lines
        [chartGen, chartVolt, chartLoad, chartBat].forEach(c => {
            c.data.labels = []; c.data.datasets.forEach(d => d.data = []);
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
// 4. OPERATOR SECURITY GATE KEEPER CONTROL AUTHENTICATION
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

