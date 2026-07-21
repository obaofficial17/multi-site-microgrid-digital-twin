import os
import random
import time
import requests
from dotenv import load_dotenv 

# Explicitly load the .env file from the backend directory
load_dotenv() 

# Pull secretly from environment variables
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

API_ENDPOINT = f"{SUPABASE_URL}/rest/v1/location_telemetry"
HEADERS = {
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "apikey": SUPABASE_KEY,
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

SITES = [
    "Site 1 - Epe", "Site 2 - Oyere", "Site 3 - Aiyetiabo",
    "Site 4 - Emuren", "Site 5 - Igirigi", "Site 6 - Gbedu", "Site 7 - Obbo Aiyegunle"
]

print("🚀 A1 Power High-Resolution DTU Telemetry Simulator Initialized...")

while True:
    print(f"\n--- Starting Data Ingestion Loop: {time.strftime('%X')} ---")
    
    for site in SITES:
        print(f"📦 Compiling telemetry packet for [{site}]...")
        
        # 1. Simulate CC1 Metrics
        cc1_v = round(random.uniform(65.0, 115.0), 1)  # Array Volts
        cc1_a = round(random.uniform(4.0, 12.0), 1)   # Array Amps
        cc1_w = round(cc1_v * cc1_a, 1)               # Power (W = V * A)
        cc1_load = round(random.uniform(100.0, 450.0), 1)
        
        # 2. Simulate CC2 Metrics
        cc2_v = round(random.uniform(60.0, 110.0), 1)
        cc2_a = round(random.uniform(3.5, 11.5), 1)
        cc2_w = round(cc2_v * cc2_a, 1)
        cc2_load = round(random.uniform(80.0, 400.0), 1)
        
        # 3. Simulate Storage Battery DC Bus
        bat_v = round(random.uniform(23.8, 27.8), 2) # Purposefully dipping low sometimes to test alarms
        soc = round(((bat_v - 24.0) / (28.2 - 24.0)) * 100, 1)
        soc = max(min(soc, 100.0), 0.0)

        payload = {
            "site_id": site,
            "cc1_pv_watts": cc1_w, "cc1_pv_volts": cc1_v, "cc1_pv_amps": cc1_a, "cc1_load_watts": cc1_load,
            "cc2_pv_watts": cc2_w, "cc2_pv_volts": cc2_v, "cc2_pv_amps": cc2_a, "cc2_load_watts": cc2_load,
            "battery_voltage": bat_v, "battery_soc_percent": soc
        }
        
        try:
            response = requests.post(API_ENDPOINT, headers=HEADERS, json=payload, timeout=10)
            if response.status_code in [200, 201]:
                print(f"  ✅ [Storage Confirmed] -> Ingested successfully.")
            else:
                print(f"  ❌ [Error {response.status_code}] -> {response.text}")
        except Exception as e:
            print(f"  ⚠️ [Network Fault] Connection timeout: {e}")
            
    # Polling frequency interval simulator (Set to 15s for visual validation testing)
    time.sleep(30)
