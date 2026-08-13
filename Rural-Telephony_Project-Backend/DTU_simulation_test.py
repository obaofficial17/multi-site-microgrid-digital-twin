import os
import random
import time
import requests
from dotenv import load_dotenv
from concurrent.futures import ThreadPoolExecutor

# Load local environment configuration
load_dotenv()

# Point to your Docker containerized Express Edge Proxy Gateway
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

# Set loop pause interval (10s keeps dashboard telemetry live and well under timeout limits)
CYCLE_DELAY = 10 

def generate_and_send_telemetry(site):
    """
    Generates telemetry for a single site and posts it to the container gateway.
    Runs concurrently in a dedicated background worker thread.
    """
    # Simulate a 10% chance of cloud cover / low solar generation
    cloud_cover = random.random() < 0.10
    
    # 1. CC1 Solar Metrics
    if cloud_cover:
        cc1_v = round(random.uniform(10.0, 30.0), 1)
        cc1_a = round(random.uniform(0.1, 0.5), 1)
    else:
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

    # Build payload matching Edge Proxy and location_telemetry schema
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
            return f"  ✅ [Proxy Ingested] -> {site} | Bat: {bat_v}V | Solar: {cc1_w + cc2_w}W"
        else:
            return f"  ❌ [Proxy Error {response.status_code}] -> {response.text}"
            
    except Exception as e:
        return f"  ⚠️ [Container Unreachable] Ensure Docker Desktop container is running on port 8080: {e}"


def run_simulation():
    print("🚀 A1 Power High-Resolution Concurrent Digital Twin Initialized...")
    print(f"🔗 Target Edge Proxy Container Endpoint: {CONTAINER_INGEST_URL}")
    print("⚡ Operating in 48V DC Bus Mode (Multithreaded Fleet Ingestion Active)\n")

    cycle = 1
    try:
        while True:
            start_time = time.time()
            print(f"--- 📡 Starting Fleet Ingestion Sweep #{cycle} [{time.strftime('%X')}] ---")
            
            # Fire all 7 site HTTP requests concurrently in background threads
            with ThreadPoolExecutor(max_workers=7) as executor:
                results = list(executor.map(generate_and_send_telemetry, SITES))

            # Output logs as threads complete
            for log in results:
                print(log)

            elapsed_time = time.time() - start_time
            print(f"⚡ Full 7-site fleet sweep finished in {elapsed_time:.2f}s")
            print(f"⏳ Next cycle in {CYCLE_DELAY} seconds...\n")
            
            cycle += 1
            time.sleep(CYCLE_DELAY)

    except KeyboardInterrupt:
        print("\n🛑 Digital Twin Simulation cleanly terminated by user.")


if __name__ == "__main__":
    run_simulation()