# Multi-Site Microgrid Digital Twin & Real-Time SCADA Ecosystem

## 📌 Project Overview
An industrial-grade, multi-tenant fleet observability SCADA platform engineered to monitor critical energy parameters across 7 distributed infrastructure microgrid sites. 

Faced with proprietary manufacturer vendor lock-in constraints on edge gateways, this project utilizes a high-fidelity **Digital Twin / Software-in-the-Loop (HIL)** validation engine to map electrical telemetry parameters over the internet directly into a serverless cloud infrastructure database.

### Core Key Performance Indicators (KPIs) Captured:
1. **Solar Power Generation:** Dual tracking of Charge Controller 1 (`cc1_pv_watts`, `cc1_pv_volts`, `cc1_pv_amps`) & Charge Controller 2 (`cc2_pv_watts`, `cc2_pv_volts`, `cc2_pv_amps`).
2. **Storage Health:** Real-time bus potential tracking (`battery_voltage`).
3. **Demand Metrics:** Live load consumption profile logs (`load_consumption`).

---

## 🛠️ System Architecture & Data Pipeline
The architecture bridges physical power infrastructure with modern, event-driven cloud plumbing:

1. **The Edge Layer (Digital Twin Simulator):** An asynchronous Python engine mimics 7 unique hardware DTUs (Data Transfer Units), wrapping Modbus-mapped register strings into clean, structured JSON telemetry payloads.
2. **The Ingestion Layer (Direct API Access):** Telemetry is transmitted via secure HTTP POST network requests directly into the cloud data lake, completely eliminating middleware server latencies.
3. **The Storage & Broadcast Layer (Supabase):** Built on enterprise-grade PostgreSQL with a dedicated Realtime WebSocket channel activated to instantly broadcast updates on data arrival.
4. **The HMI Layer (Vercel Frontend):** A responsive full-stack web dashboard featuring reactive multi-site dropdown filtering, allowing clients to isolate and monitor specific fleet node metrics with sub-second visual updates.

---

## 🚨 Automated Edge Fault & SCADA Alarm Infrastructure
To ensure true industrial-grade system resilience, the HMI layer incorporates a real-time alarm system that instantly flags microgrid abnormalities directly within the UI layout and also sends the alarm information to the NOC operator email:

1. **Low Battery Voltage Warning:** Triggers an amber alert banner if the main DC bus potential drops below critical thresholds under heavy load sequences.
2. **High Load / Surge Fault:** Flashes an instant red hazard alarm status if the `load_consumption` profile exceeds safe operational levels relative to system capacity.
3. **Site Disconnection / Heartbeat Timeout:** Built-in sub-second watchdogs monitor data streaming intervals; if an active site's packet feed stalls due to regional cellular dropouts, the SCADA interface flags the node as "OFFLINE" to notify fleet administrators.

---

## 💻 Tech Stack
1. **Simulation Engine:** Python 3 (Utilizing `requests` and `random` packages for stochastic telemetry noise validation)
2. **User Interface:** Vanilla JS (ES6+ Architecture), HTML5, Tailwind CSS
3. **Database & Realtime Backend:** Supabase (PostgreSQL Engine with native WebSockets)
4. **Hosting & Deployment:** Vercel (Serverless UI Platform)

