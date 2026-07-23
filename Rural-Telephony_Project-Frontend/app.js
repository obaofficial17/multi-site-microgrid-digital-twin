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
let isViewingHistory = false; 

// ==============================================================================
// 0. OPEN-METEO WEATHER & UTILITIES
// ==============================================================================
async function fetchLocalWeather(siteName) {
    const coords = SITE_DIRECTORY[siteName];
    if (!coords) return;
    try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,cloud_cover`);
        if (!res.ok) return;
        const data = await res.json();
        weatherTemp.innerText = `${Math.round(data.current.temperature_2m)}°C`;
        weatherClouds.innerText = `${data.current.cloud_cover}%`;
    } catch (e) {
        console.warn("Weather fetch bypassed. Running in offline/firewall mode.");
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
// 1. SCADA CHART ENGINE (PERFECT SMOOTH CURVES)
// ==============================================================================
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

    const commonScales = {
        x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 9 }, maxRotation: 45, minRotation: 45, autoSkip: true, maxTicksLimit: 8 } },
        y: { grid: { display: true, color: '#f1f5f9' }, ticks: { color: '#64748b', font: { size: 10 } } }
    };
    
    // cubicInterpolationMode: 'monotone' guarantees perfect, non-jagged smooth curves
    const commonOptions = { 
        responsive: true, maintainAspectRatio: false, scales: commonScales, 
        plugins: { 
            legend: { display: true, position: 'top', labels: { color: '#334155', font: { size: 11, weight: 'bold' }, usePointStyle: true, boxWidth: 8 } }, 
            customCanvasBackgroundColor: { color: 'white' } 
        },
        elements: { 
            point: { radius: 0, hitRadius: 10, hoverRadius: 4 },
            line: { tension: 0.4, cubicInterpolationMode: 'monotone', borderJoinStyle: 'round' } // Ensures perfectly smooth line strokes
        } 
    };

    chartGen = new Chart(document.getElementById('solarPowerChart'), {
        type: 'line', data: { labels: [], datasets: [
            { label: 'CC1 Output (W)', data: [], borderColor: '#10b981', borderWidth: 2, fill: false },
            { label: 'CC2 Output (W)', data: [], borderColor: '#0ea5e9', borderWidth: 2, fill: false }
        ]}, options: commonOptions
    });

    chartVolt = new Chart(document.getElementById('solarVoltChart'), {
        type: 'line', data: { labels: [], datasets: [
            { label: 'CC1 Input (V)', data: [], borderColor: '#f59e0b', borderWidth: 2, fill: false },
            { label: 'CC2 Input (V)', data: [], borderColor: '#3b82f6', borderWidth: 2, fill: false }
        ]}, options: commonOptions
    });

    chartLoad = new Chart(document.getElementById('loadPowerChart'), {
        type: 'line', data: { labels: [], datasets: [
            { label: 'CC1 Load Draw (W)', data: [], borderColor: '#6366f1', borderWidth: 2, fill: false },
            { label: 'CC2 Load Draw (W)', data: [], borderColor: '#8b5cf6', borderWidth: 2, fill: false }
        ]}, options: commonOptions
    });

    chartBat = new Chart(document.getElementById('batteryStabilityChart'), {
        type: 'line', data: { labels: [], datasets: [
            { label: 'DC Bus Potential (V)', data: [], borderColor: '#0d9488', borderWidth: 2.5, fill: false }
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

// Clears ONLY the charts so the numbers don't flash to zero while fetching
function clearChartsOnly() {
    liveAlarmBanner.classList.add('hidden');
    document.body.classList.remove('ring-4', 'ring-rose-500', 'ring-inset');
    [chartGen, chartVolt, chartLoad, chartBat].forEach(c => {
        if(c) { c.data.labels = []; c.data.datasets.forEach(d => d.data = []); c.update('none'); }
    });
}

// ==============================================================================
// 2. HARDWARE HEARTBEAT & THRESHOLD ALARM INTERCEPT
// ==============================================================================
function kickHeartbeatCountdownTimer() {
    clearTimeout(heartbeatTimer);
    if(isViewingHistory) return;

    heartbeatBadge.className = "bg-emerald-50 text-emerald-600 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200 shadow-sm";
    heartbeatDot.className = "w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping";
    heartbeatText.innerText = "DTU Link Active";

    heartbeatTimer = setTimeout(() => {
        heartbeatBadge.className = "bg-rose-50 text-rose-600 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-rose-200 shadow-sm animate-pulse";
        heartbeatDot.className = "w-1.5 h-1.5 rounded-full bg-rose-500";
        heartbeatText.innerText = "Connection Dormant";
    }, 40000);
}

function evaluateThresholdAlarms(r, isLiveBannerUpdate = false) {
    let internalFaultLogs = [];
    const batVolt = parseFloat(r.battery_voltage);

    if (batVolt > 55.0) internalFaultLogs.push({ type: 'CRITICAL OVERVOLTAGE', msg: `Battery Overvoltage (${batVolt}V) - Exceeds 55V limit.` });
    else if (batVolt >= 53.0) internalFaultLogs.push({ type: 'APPROACHING HIGH LIMIT', msg: `Battery approaching upper limit (${batVolt}V).` });
    else if (batVolt <= 44.0) internalFaultLogs.push({ type: 'CRITICAL UNDERVOLTAGE', msg: `Battery Deep Discharge (${batVolt}V) - Immediate LVD Hazard.` });
    else if (batVolt <= 48.0) internalFaultLogs.push({ type: 'APPROACHING LOW LEVELS', msg: `Battery approaching low levels (${batVolt}V).` });

    if (r.cc1_pv_volts > 110.0 || r.cc2_pv_volts > 110.0) internalFaultLogs.push({ type: 'PV OVERVOLTAGE', msg: `Solar String Voltage Spike Detected.` });

    const rowTime = r.created_at ? new Date(r.created_at) : new Date();
    const watHour = parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', hour: 'numeric', hour12: false }).format(rowTime));
    
    if (watHour >= 8 && watHour <= 17) {
        if ((r.cc1_pv_watts + r.cc2_pv_watts < 50.0)) {
            internalFaultLogs.push({ type: 'UNDER-GENERATION', msg: `Sub-optimal daylight harvesting detected (${(r.cc1_pv_watts + r.cc2_pv_watts).toFixed(1)}W).` });
        }
    } 

    if (isLiveBannerUpdate) {
        if (internalFaultLogs.length > 0) {
            liveAlarmDesc.innerText = `${internalFaultLogs[0].type}: ${internalFaultLogs[0].msg}`;
            liveAlarmBanner.classList.remove('hidden');
            document.body.classList.add('ring-4', 'ring-rose-500', 'ring-inset');
            triggerAudibleSCADAAlert();
        } else {
            liveAlarmBanner.classList.add('hidden');
            document.body.classList.remove('ring-4', 'ring-rose-500', 'ring-inset');
        }
    }

    return internalFaultLogs;
}

// ==============================================================================
// 3. UI DASHBOARD REFRESH & CUSTOM TIME-RANGE QUERY
// ==============================================================================
function renderScreenCards(r) {
    if(!r) return;
    const maxVolt = 55.0;
    const minVolt = 42.0; 
    let calculatedSoc = ((r.battery_voltage - minVolt) / (maxVolt - minVolt)) * 100;
    calculatedSoc = Math.max(0, Math.min(100, calculatedSoc)); 

    totalSolarVal.innerText = (r.cc1_pv_watts + r.cc2_pv_watts).toFixed(1);
    totalLoadVal.innerText = (r.cc1_load_watts + r.cc2_load_watts).toFixed(1);
    batVal.innerText = Number(r.battery_voltage).toFixed(2);
    
    socBadge.innerText = `${calculatedSoc.toFixed(0)}% SoC`;
    socBar.style.width = `${calculatedSoc}%`;
}

function renderEmptyCards() {
    totalSolarVal.innerText = "--";
    totalLoadVal.innerText = "--";
    batVal.innerText = "--";
    socBadge.innerText = "N/A";
    socBar.style.width = "0%";
}

async function syncNodeHistory() {
    try {
        const siteName = siteSelector.value;
        const startVal = startTimeInput.value;
        const endVal = endTimeInput.value;
        
        clearChartsOnly(); 
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
            // Default load fetches newest 50 points
            query = supabaseClient.from('location_telemetry').select('*').eq('site_id', siteName).order('created_at', { ascending: false }).limit(50);
        } else {
            query = query.limit(2000); 
        }

        const { data, error } = await query;
        if (error) throw error; 

        if (data && data.length > 0) {
            const processedData = (!startVal && !endVal) ? data.reverse() : data;
            const latestDataPoint = processedData[processedData.length - 1];
            
            // Instantly render cards with real-time (or last known) data
            renderScreenCards(latestDataPoint);
            
            // Evaluate if this data is "Real-Time" or "Offline / Last Known"
            if (!isViewingHistory) {
                const pointTime = new Date(latestDataPoint.created_at).getTime();
                const nowTime = new Date().getTime();
                const diffMinutes = (nowTime - pointTime) / (1000 * 60);

                if (diffMinutes > 15) { // If the hardware hasn't sent data in 15 mins
                    heartbeatBadge.className = "bg-amber-50 text-amber-700 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-amber-200 shadow-sm";
                    heartbeatDot.className = "w-1.5 h-1.5 rounded-full bg-amber-500";
                    heartbeatText.innerText = "Site Offline (Showing Last Known)";
                } else {
                    kickHeartbeatCountdownTimer();
                }
            }

            let accumulatedLogHtml = "";
            let anyAlarmsFound = false;

            processedData.forEach(row => {
                const stamp = formatWATTimestamp(row.created_at);
                appendMetricsToCharts(stamp, row, processedData.length);
            });

            const alarmData = processedData.slice(-100);
            
            alarmData.forEach((row, index) => {
                const isLastPoint = (index === alarmData.length - 1); 
                const logs = evaluateThresholdAlarms(row, isLastPoint); 
                
                if (logs.length > 0) {
                    anyAlarmsFound = true;
                    const stamp = formatWATTimestamp(row.created_at);
                    let rowHtml = "";
                    logs.forEach(alert => {
                        rowHtml += `
                            <div class="bg-white border-l-2 border-l-rose-500 border border-slate-200 rounded p-3 text-slate-700 shadow-sm space-y-1.5">
                                <div class="flex justify-between font-bold items-center border-b border-slate-100 pb-1">
                                    <span class="text-xs text-slate-800">${stamp} ⚠️ ${row.site_id}</span>
                                    <span class="text-[9px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded border border-rose-200 font-mono uppercase">${alert.type}</span>
                                </div>
                                <p class="text-slate-600 text-[11px] font-sans font-medium">${alert.msg}</p>
                            </div>
                        `;
                    });
                    accumulatedLogHtml = rowHtml + accumulatedLogHtml; 
                }
            });

            if (anyAlarmsFound) {
                alarmHistoryContainer.innerHTML = accumulatedLogHtml;
            } else {
                alarmHistoryContainer.innerHTML = '<div class="text-slate-400 italic py-2">System log clear. No faults detected in this dataset.</div>';
            }
        } else {
            renderEmptyCards();
            heartbeatBadge.className = "bg-rose-50 text-rose-600 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-rose-200 shadow-sm";
            heartbeatDot.className = "w-1.5 h-1.5 rounded-full bg-rose-500";
            heartbeatText.innerText = "No Data Found for Site";
            alarmHistoryContainer.innerHTML = '<div class="text-slate-400 italic py-2">No telemetry data found for this site/window.</div>';
        }
    } catch (err) {
        console.error("Critical Fetch Error: ", err);
        renderEmptyCards();
        alarmHistoryContainer.innerHTML = `<div class="text-rose-600 font-bold py-2">Error connecting to database: ${err.message}</div>`;
    }
}

let isLiveFeedSubscribed = false;
function subscribeLiveFeed() {
    if (isLiveFeedSubscribed) return;
    
    activeChannel = supabaseClient
        .channel('global-telemetry-feed')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'location_telemetry' }, 
        (payload) => {
            if (payload.new.site_id === siteSelector.value && !isViewingHistory) {
                kickHeartbeatCountdownTimer();
                const row = payload.new;
                const stamp = formatWATTimestamp(row.created_at);
                renderScreenCards(row);
                appendMetricsToCharts(stamp, row, 50); 
                
                const logs = evaluateThresholdAlarms(row, true); 
                if (logs.length > 0) {
                    if (alarmHistoryContainer.innerText.includes("clear") || alarmHistoryContainer.innerText.includes("baseline") || alarmHistoryContainer.innerText.includes("No telemetry")) {
                        alarmHistoryContainer.innerHTML = "";
                    }
                    let newLogsHtml = "";
                    logs.forEach(alert => {
                        newLogsHtml += `
                            <div class="bg-white border-l-2 border-l-rose-500 border border-slate-200 rounded p-3 text-slate-700 shadow-sm space-y-1.5 animate-pulse">
                                <div class="flex justify-between font-bold items-center border-b border-slate-100 pb-1">
                                    <span class="text-xs text-slate-800">${stamp} ⚠️ ${row.site_id}</span>
                                    <span class="text-[9px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded border border-rose-200 font-mono uppercase">${alert.type}</span>
                                </div>
                                <p class="text-slate-600 text-[11px] font-sans font-medium">${alert.msg}</p>
                            </div>
                        `;
                    });
                    alarmHistoryContainer.innerHTML = newLogsHtml + alarmHistoryContainer.innerHTML;
                }
            }
        })
        .subscribe();
        
    isLiveFeedSubscribed = true;
}

// ==============================================================================
// 4. EVENT LISTENERS
// ==============================================================================
siteSelector.addEventListener('change', () => {
    syncNodeHistory(); 
});

fetchRangeBtn.addEventListener('click', () => {
    const startVal = startTimeInput.value;
    const endVal = endTimeInput.value;
    
    if (startVal || endVal) {
        isViewingHistory = true; 
        heartbeatText.innerText = "Viewing History (Live Paused)";
        heartbeatDot.className = "w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse";
        heartbeatBadge.className = "bg-amber-50 text-amber-700 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-amber-200 shadow-sm";
    } else {
        isViewingHistory = false;
        heartbeatText.innerText = "Reconnecting...";
    }
    syncNodeHistory(); 
});

// ==============================================================================
// 5. CHART EXPORT UTILITY 
// ==============================================================================
function downloadChart(canvasId, filename) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    let siteNameStr = siteSelector.value.replace(/\s+/g, '_').replace(/-/g, '');
    const imageURI = canvas.toDataURL('image/png');
    
    const link = document.createElement('a');
    link.download = `${siteNameStr}_${filename}_${new Date().toISOString().slice(0,10)}.png`;
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
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
});

async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) mountDashboard();
}
checkSession();