import os
import random
import time
import requests
from dotenv import load_dotenv

# Load local environment configuration
load_dotenv()

# Point to your Docker containerized Express Edge Proxy Gateway
# Container is mapped to host port 8080
CONTAINER_INGEST_URL = os.environ.get("PROXY_URL", "http://localhost:8080/ingest")

# Standard HTTP headers for JSON payloads targeting the proxy
HEADERS = {
    "Content-Type": "application/json"
}

SITES = [
    "Site 1 - Epe", 
    "Site 2 - Oba-Do", 
    "Site 3 - Likogbe",
    "Site 4 - Adu camp Emuren", 
    "Site 5 - Igirigi Ado-Ekiti", 
    "Site 6 - Gbedu", 
    "Site 7 - Obbo Aiyegunle"
]

print("🚀 A1 Power High-Resolution DTU Telemetry Digital Twin Initialized...")
print(f"🔗 Target Edge Proxy Container Endpoint: {CONTAINER_INGEST_URL}")
print("⚡ Operating in 48V DC Bus Mode (Live Dashboard Streaming Active)")

while True:
    print(f"\n--- Starting Fleet Ingestion Loop: {time.strftime('%X')} ---")
    
    for site in SITES:
        print(f"📦 Transmitting DTU telemetry packet for [{site}]...")
        
        # Simulate a 10% chance of cloud cover / low solar generation
        cloud_cover = random.random() < 0.10
        
        # 1. CC1 Solar Metrics
        if cloud_cover:
            cc1_v = round(random.uniform(10.0, 30.0), 1)
            cc1_a = round(random.uniform(0.1, 0.5), 1)
        else:
            # PV voltage spikes above 110V to test SCADA UI alarms
            cc1_v = round(random.uniform(65.0, 115.0), 1)  
            cc1_a = round(random.uniform(4.0, 12.0), 1)    
            
        cc1_w = round(cc1_v * cc1_a, 1)
        cc1_load = round(random.uniform(100.0, 450.0), 1)
        
        # 2. CC2 Solar Metrics
        if cloud_cover:
            cc2_v = round(random.uniform(10.0, 30.0), 1)
            cc2_a = round(random.uniform(0.1, 0.5), 1)
        else:
            cc2_v = round(random.uniform(60.0, 115.0), 1)
            cc2_a = round(random.uniform(3.5, 11.5), 1)
            
        cc2_w = round(cc2_v * cc2_a, 1)
        cc2_load = round(random.uniform(80.0, 400.0), 1)
        
        # 3. Storage Battery DC Bus Potential (48V LFP System)
        bat_v = round(random.uniform(43.5, 54.8), 2) 
        
        # Calculate State of Charge (44V = 0%, 55V = 100%)
        soc = round(((bat_v - 44.0) / (55.0 - 44.0)) * 100, 1)
        soc = max(min(soc, 100.0), 0.0)

        # Build packet matching Edge Proxy and location_telemetry schema
        payload = {
            "site_id": site,
            "cc1_pv_watts": cc1_w, 
            "cc1_pv_volts": cc1_v, 
            "cc1_pv_amps": cc1_a, 
            "cc1_load_watts": cc1_load,
            "cc2_pv_watts": cc2_w, 
            "cc2_pv_volts": cc2_v, 
            "cc2_pv_amps": cc2_a, 
            "cc2_load_watts": cc2_load,
            "battery_voltage": bat_v, 
            "battery_soc_percent": soc
        }
        
        try:
            # POST directly to your Node.js Docker Container
            response = requests.post(CONTAINER_INGEST_URL, headers=HEADERS, json=payload, timeout=5)
            
            if response.status_code == 200:
                print(f"  ✅ [Proxy Ingested] -> {site} | Bat: {bat_v}V | Solar: {cc1_w + cc2_w}W")
            else:
                print(f"  ❌ [Proxy Error {response.status_code}] -> {response.text}")
                
        except Exception as e:
            print(f"  ⚠️ [Container Unreachable] Ensure Docker Desktop container is running on port 8080: {e}")
            
    # Interval between site fleet pushes (Set to 20 seconds for real-time SCADA updates)
    time.sleep(20)