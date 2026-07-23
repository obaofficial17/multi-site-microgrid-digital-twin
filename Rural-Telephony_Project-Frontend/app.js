// Initialize Supabase Client
const SUPABASE_URL = "https://icgryayptwjgcpqhwsxx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_U8VMbs1XABYo62cOslpNkw_PfN6rPRl";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Multi-Tenant Infrastructure Security Contact
const SITE_DIRECTORY = {
    "Site 1 - Epe": { security: "Lekan / Epe SG", phone: "+234 803 111 0001", lat: 6.58, lon: 3.98 },
    "Site 2 - Oyere": { security: "Tosin / Oyere SG", phone: "+234 803 111 0002", lat: 7.52, lon: 4.50 },
    "Site 3 - Aiyetiabo": { security: "Aiyetiabo Team", phone: "+234 803 111 0003", lat: 7.50, lon: 4.55 },
    "Site 4 - Emuren": { security: "Emuren Resident SG", phone: "+234 803 111 0004", lat: 6.73, lon: 3.65 },
    "Site 5 - Igirigi": { security: "Igirigi Patrol", phone: "+234 803 111 0005", lat: 7.60, lon: 4.50 },
    "Site 6 - Gbedu": { security: "Gbedu Security", phone: "+234 803 111 0006", lat: 7.30, lon: 3.90 },
    "Site 7 - Obbo Aiyegunle": { security: "Obbo HQ Guard", phone: "+234 803 111 0007", lat: 8.12, lon: 5.10 }
};

// DOM Pointers
const authOverlay = document.getElementById('auth-overlay');
const appContent = document.getElementById('app-content');
const loginForm = document.getElementById('login-form');
const authError = document.getElementById('auth-error');
const logoutBtn = document.getElementById('logout-btn');

const siteSelector = document.getElementById('site-selector');
const startTimeInput = document.getElementById('start-time');
const endTimeInput = document.getElementById('end-time');
const fetchRangeBtn = document.getElementById('fetch-range-btn');

const heartbeatBadge = document.getElementById('heartbeat-badge');
const heartbeatDot = document.getElementById('heartbeat-dot');
const heartbeatText = document.getElementById('heartbeat-text');

const securityPersonnel = document.getElementById('security-personnel');
const securityPhone = document.getElementById('security-phone');

const weatherTemp = document.getElementById('weather-temp');
const weatherClouds = document.getElementById('weather-clouds');

const liveAlarmBanner = document.getElementById('live-alarm-banner');
const liveAlarmDesc = document.getElementById('live-alarm-desc');
const alarmHistoryContainer = document.getElementById('alarm-history-container');

const totalSolarVal = document.getElementById('total-solar-val');
const totalLoadVal = document.getElementById('total-load-val');
const batVal = document.getElementById('bat-val');
const socBadge = document.getElementById('soc-badge');
const socBar = document.getElementById('soc-bar');

// Global Configurations
let chartGen = null, chartVolt = null, chartLoad = null, chartBat = null;
let activeChannel = null, heartbeatTimer = null, audioCtx = null;

// ==============================================================================
// 0. OPEN-METEO WEATHER & UTILITIES
// ==============================================================================
async function fetchLocalWeather(siteName) {
    const coords = SITE_DIRECTORY[siteName];
    if (!coords) return;
    try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,cloud_cover`);
        const data = await res.json();
        weatherTemp.innerText = `${Math.round(data.current.temperature_2m)}°C`;
        weatherClouds.innerText = `${data.current.cloud_cover}%`;
    } catch (e) {
        console.error("Weather fetch failed.");
    }
}

function formatWATTimestamp(dateString) {
    return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Lagos',
        day: '2-digit', month: 'short',
        hour: '2-digit', minute: '2-digit'
    }).format(new Date(dateString));
}

function triggerAudibleSCADAAlert() {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); 
        osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {}
}

// ==============================================================================
// 1. SCADA CHART ENGINE (With Custom Export Plugin)
// ==============================================================================

// Plugin to force a solid white background when exporting the canvas to PNG
const customCanvasBackgroundColor = {
    id: 'customCanvasBackgroundColor',
    beforeDraw: (chart, args, options) => {
        const {ctx} = chart;
        ctx.save();
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = options.color || '#ffffff';
        ctx.fillRect(0, 0, chart.width, chart.height);
        ctx.restore();
    }
};

function initSCADACharts() {
    Chart.register(customCanvasBackgroundColor);

    // Turned off grid lines (display: false) and disabled native legend
    const commonScales = {
        x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10 }, maxRotation: 45, minRotation: 45 } },
        y: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10 } } }
    };
    const commonOptions = { 
        responsive: true, 
        maintainAspectRatio: false, 
        scales: commonScales, 
        plugins: { 
            legend: { display: false }, // Using custom fixed HTML legend instead
            customCanvasBackgroundColor: { color: 'white' } 
        } 
    };

    chartGen = new Chart(document.getElementById('solarPowerChart'), {
        type: 'line', data: { labels: [], datasets: [
            { label: 'CC1 Output (W)', data: [], borderColor: '#10b981', backgroundColor: '#10b98120', borderWidth: 2, fill: true, tension: 0.2, pointRadius: 1 },
            { label: 'CC2 Output (W)', data: [], borderColor: '#0ea5e9', backgroundColor: '#0ea5e920', borderWidth: 2, fill: true, tension: 0.2, pointRadius: 1 }
        ]}, options: commonOptions
    });

    chartVolt = new Chart(document.getElementById('solarVoltChart'), {
        type: 'line', data: { labels: [], datasets: [
            { label: 'CC1 Input (V)', data: [], borderColor: '#f59e0b', borderWidth: 2, tension: 0.2, pointRadius: 1 },
            { label: 'CC2 Input (V)', data: [], borderColor: '#3b82f6', borderWidth: 2, tension: 0.2, pointRadius: 1 }
        ]}, options: commonOptions
    });

    chartLoad = new Chart(document.getElementById('loadPowerChart'), {
        type: 'line', data: { labels: [], datasets: [
            { label: 'CC1 Load Draw (W)', data: [], borderColor: '#6366f1', borderWidth: 2, tension: 0.2, pointRadius: 1 },
            { label: 'CC2 Load Draw (W)', data: [], borderColor: '#8b5cf6', borderWidth: 2, tension: 0.2, pointRadius: 1 }
        ]}, options: commonOptions
    });

    chartBat = new Chart(document.getElementById('batteryStabilityChart'), {
        type: 'line', data: { labels: [], datasets: [
            { label: 'DC Bus Potential (V)', data: [], borderColor: '#0d9488', backgroundColor: '#0d948815', borderWidth: 2.5, fill: true, tension: 0.2, pointRadius: 1 }
        ]}, options: commonOptions
    });
}

function appendMetricsToCharts(timeStr, r, limit) {
    [chartGen, chartVolt, chartLoad, chartBat].forEach(c => {
        c.data.labels.push(timeStr);
        if(c.data.labels.length > limit) c.data.labels.shift();
    });

    chartGen.data.datasets[0].data.push(r.cc1_pv_watts);
    chartGen.data.datasets[1].data.push(r.cc2_pv_watts);
    chartVolt.data.datasets[0].data.push(r.cc1_pv_volts);
    chartVolt.data.datasets[1].data.push(r.cc2_pv_volts);
    chartLoad.data.datasets[0].data.push(r.cc1_load_watts);
    chartLoad.data.datasets[1].data.push(r.cc2_load_watts);
    chartBat.data.datasets[0].data.push(r.battery_voltage);

    [chartGen, chartVolt, chartLoad, chartBat].forEach(c => {
        if(c.data.datasets[0].data.length > limit) c.data.datasets.forEach(d => d.data.shift());
        c.update('none'); 
    });
}

// ==============================================================================
// 2. HARDWARE HEARTBEAT & THRESHOLD ALARM INTERCEPT
// ==============================================================================
function kickHeartbeatCountdownTimer() {
    clearTimeout(heartbeatTimer);
    heartbeatBadge.className = "bg-emerald-50 text-emerald-600 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200 shadow-sm";
    heartbeatDot.className = "w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping";
    heartbeatText.innerText = "DTU Link Active";

    heartbeatTimer = setTimeout(() => {
        heartbeatBadge.className = "bg-rose-50 text-rose-600 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-rose-200 shadow-sm animate-pulse";
        heartbeatDot.className = "w-1.5 h-1.5 rounded-full bg-rose-500";
        heartbeatText.innerText = "Connection Dormant";
    }, 40000);
}

function evaluateThresholdAlarms(r) {
    let internalFaultLogs = [];
    const batVolt = parseFloat(r.battery_voltage);

    // New Battery Limit Alarms based on 55V Max architecture
    if (batVolt >= 55.0) internalFaultLogs.push({ type: 'MAX VOLTAGE', msg: `Battery at Maximum Voltage Limit (${batVolt}V).` });
    else if (batVolt >= 53.0) internalFaultLogs.push({ type: 'APPROACHING HIGH LIMIT', msg: `Battery approaching high limit (${batVolt}V).` });
    else if (batVolt <= 44.0) internalFaultLogs.push({ type: 'CRITICAL UNDERVOLTAGE', msg: `Battery Deep Discharge (${batVolt}V) - Immediate LVD Hazard.` });
    else if (batVolt <= 48.0) internalFaultLogs.push({ type: 'APPROACHING LOW LEVELS', msg: `Battery approaching low levels (${batVolt}V).` });

    if (r.cc1_pv_volts > 110.0 || r.cc2_pv_volts > 110.0) internalFaultLogs.push({ type: 'PV OVERVOLTAGE', msg: `Solar String Voltage Spike Detected.` });

    const watHour = parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', hour: 'numeric', hour12: false }).format(new Date()));
    if (watHour >= 8 && watHour <= 17) {
        if ((r.cc1_pv_watts + r.cc2_pv_watts < 50.0)) {
            internalFaultLogs.push({ type: 'UNDER-GENERATION', msg: `Sub-optimal daylight harvesting detected.` });
        }
    } 

    if (internalFaultLogs.length > 0) {
        liveAlarmDesc.innerText = `${internalFaultLogs[0].type}: ${internalFaultLogs[0].msg}`;
        liveAlarmBanner.classList.remove('hidden');
        document.body.classList.add('ring-4', 'ring-rose-500', 'ring-inset');
        triggerAudibleSCADAAlert();

        internalFaultLogs.forEach(alert => {
            const timeLog = formatWATTimestamp(r.created_at || new Date().toISOString());
            if (alarmHistoryContainer.innerText.includes("Awaiting hardware baseline")) alarmHistoryContainer.innerHTML = "";
            
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
// 3. UI DASHBOARD REFRESH & CUSTOM TIME-RANGE QUERY
// ==============================================================================
function renderScreenCards(r) {
    if(!r) return;
    
    // New Calculation logic capping at 55V Maximum. (Assumes 42V as absolute 0%)
    const maxVolt = 55.0;
    const minVolt = 42.0;
    let calculatedSoc = ((r.battery_voltage - minVolt) / (maxVolt - minVolt)) * 100;
    // Clamp the value strictly between 0 and 100%
    calculatedSoc = Math.max(0, Math.min(100, calculatedSoc));

    totalSolarVal.innerText = (r.cc1_pv_watts + r.cc2_pv_watts).toFixed(1);
    totalLoadVal.innerText = (r.cc1_load_watts + r.cc2_load_watts).toFixed(1);
    batVal.innerText = Number(r.battery_voltage).toFixed(2);
    
    socBadge.innerText = `${calculatedSoc.toFixed(0)}% SoC`;
    socBar.style.width = `${calculatedSoc}%`;
}

function adjustChartScrollWidths(dataLength) {
    const newWidth = dataLength > 30 ? `${dataLength * 25}px` : '100%';
    ['wrapper-gen', 'wrapper-volt', 'wrapper-load', 'wrapper-bat'].forEach(id => {
        document.getElementById(id).style.minWidth = newWidth;
    });
}

async function syncNodeHistory() {
    const siteName = siteSelector.value;
    const startVal = startTimeInput.value;
    const endVal = endTimeInput.value;
    
    fetchLocalWeather(siteName);
    
    const meta = SITE_DIRECTORY[siteName];
    if (meta) {
        securityPersonnel.innerText = meta.security;
        securityPhone.innerText = meta.phone;
    }

    let query = supabaseClient
        .from('location_telemetry')
        .select('*')
        .eq('site_id', siteName)
        .order('created_at', { ascending: true }); 

    if (startVal) query = query.gte('created_at', new Date(startVal).toISOString());
    if (endVal) query = query.lte('created_at', new Date(endVal).toISOString());
    
    if (!startVal && !endVal) {
        query = supabaseClient
            .from('location_telemetry')
            .select('*')
            .eq('site_id', siteName)
            .order('created_at', { ascending: false })
            .limit(50);
    } else {
        query = query.limit(500); 
    }

    const { data } = await query;

    if (data && data.length > 0) {
        [chartGen, chartVolt, chartLoad, chartBat].forEach(c => {
            if(c) { c.data.labels = []; c.data.datasets.forEach(d => d.data = []); }
        });
        
        const processedData = (!startVal && !endVal) ? data.reverse() : data;
        adjustChartScrollWidths(processedData.length);
        
        processedData.forEach(row => {
            const stamp = formatWATTimestamp(row.created_at);
            appendMetricsToCharts(stamp, row, processedData.length);
        });
        renderScreenCards(processedData[processedData.length - 1]);
    }
}

function subscribeLiveFeed() {
    if (activeChannel) supabaseClient.removeChannel(activeChannel);

    activeChannel = supabaseClient
        .channel('live-scada-stream')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'location_telemetry' }, 
        (payload) => {
            if (payload.new.site_id === siteSelector.value) {
                kickHeartbeatCountdownTimer();
                const row = payload.new;
                const stamp = formatWATTimestamp(row.created_at);
                renderScreenCards(row);
                appendMetricsToCharts(stamp, row, 50); 
                evaluateThresholdAlarms(row);
            }
        })
        .subscribe();
}

// ==============================================================================
// 4. EVENT LISTENERS
// ==============================================================================
siteSelector.addEventListener('change', () => {
    syncNodeHistory();
    subscribeLiveFeed();
});

fetchRangeBtn.addEventListener('click', () => {
    if (activeChannel) {
        supabaseClient.removeChannel(activeChannel);
        activeChannel = null;
        heartbeatText.innerText = "Viewing History (Live Paused)";
        heartbeatDot.className = "w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse";
    }
    syncNodeHistory(); 
});

// ==============================================================================
// 5. CHART EXPORT UTILITY
// ==============================================================================
function downloadChart(canvasId, filename) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    // The customCanvasBackgroundColor plugin forces the white background on generation
    const imageURI = canvas.toDataURL('image/png');
    
    const link = document.createElement('a');
    link.download = `${filename}_${new Date().toISOString().slice(0,10)}.png`;
    link.href = imageURI;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ==============================================================================
// 6. AUTHENTICATION & MOUNT GATEKEEPER
// ==============================================================================
function mountDashboard() {
    authOverlay.classList.add('opacity-0', 'pointer-events-none');
    appContent.classList.remove('invisible');
    initSCADACharts();
    syncNodeHistory();
    subscribeLiveFeed();
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