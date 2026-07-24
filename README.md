# Multi-Site Microgrid Digital Twin & Real-Time SCADA Ecosystem

## 📌 Project Overview
An industrial-grade, multi-tenant fleet observability SCADA platform engineered to monitor critical energy parameters across 7 distributed infrastructure microgrid sites.Faced with proprietary vendor lock-in on edge gateway hardware, this project uses a high-fidelity **Digital Twin / Software-in-the-Loop (SIL)** simulation engine to model electrical telemetry parameters and validate the full cloud data pipeline from field device to live dashboard before physical DTU hardware is fully integrated(soon).

### Core Key Performance Indicators (KPIs) Captured
1. **Solar Power Generation:** Dual charge-controller tracking — Charge Controller 1 (`cc1_pv_watts`, `cc1_pv_volts`, `cc1_pv_amps`) & Charge Controller 2 (`cc2_pv_watts`, `cc2_pv_volts`, `cc2_pv_amps`).
2. **Storage Health:** Real-time 48V DC bus potential (`battery_voltage`) and derived state-of-charge (`battery_soc_percent`).
3. **Demand Metrics:** Live load consumption per charge controller (`cc1_load_watts`, `cc2_load_watts`).

---

## 🛠️ System Architecture & Data Pipeline

```
[Edge Gateway / DTU Simulator]
        │  HTTPS POST (JSON telemetry)
        ▼
[Ingestion Layer — Dockerized Node.js service]  ← in progress
        │  validates payload, provides database isolation
        ▼
[Supabase — PostgreSQL]
        │  authenticated-only reads, RLS-gated
        ▼
[HMI Layer — Vercel-hosted dashboard]
```

1. **The Edge Layer (Digital Twin Simulator):** A Python simulation engine mimics 7 unique hardware DTUs (Data Transfer Units), generating structured JSON telemetry payloads with realistic fault injection (cloud-cover under-generation events, PV overvoltage spikes, battery undervoltage/overvoltage excursions) to exercise the alarm system under controlled conditions.
2. **The Ingestion Layer (in progress):** A containerized Node.js/Express service is being built to sit between edge gateways and Supabase. It authenticates incoming gateway requests against a dedicated shared token, validates payload schema and sensor value bounds, and is the sole holder of Supabase's privileged access so no field device or frontend ever carries write-capable credentials. This replaces direct gateway-to-database writes with a controlled, auditable choke point. Deployment target (central cloud VM) is still being evaluated.
3. **The Storage & Broadcast Layer (Supabase):** PostgreSQL with Row Level Security enforced on all tables — read access is scoped to authenticated dashboard sessions only, and writes are only possible via the ingestion layer, not by any publicly reachable key. A dedicated Realtime WebSocket channel broadcasts new telemetry rows to connected dashboards as they arrive.
4. **The HMI Layer (Vercel Frontend):** A responsive dashboard with reactive multi-site dropdown filtering, adjustable history windows, and live chart updates via Supabase Realtime subscriptions no polling required.

---

## 🔐 Security Model
- **Row Level Security (RLS)** enforced on `location_telemetry`: `SELECT` is restricted to `authenticated` sessions only; no anonymous read or write access exists at the database level.
- **Key separation by trust boundary:** the frontend uses Supabase's public **publishable key**, while all writes route through the ingestion layer using the priviledged access, which is never present in frontend code, git history, or any device firmware.
- **Gateway authentication:** the ingestion layer requires a separate shared bearer token from any device posting telemetry, independent of Supabase's own auth so a leaked Supabase key alone can't be used to inject fake sensor data.

---

## 🚨 Automated Edge Fault & SCADA Alarm Infrastructure
The HMI layer includes a real-time client-side alarm system that flags microgrid abnormalities directly in the UI as telemetry arrives:

1. **Battery Undervoltage / Overvoltage:** Tiered alerts (warning vs. critical) when the 48V DC bus falls below or exceeds safe operating thresholds.
2. **PV String Overvoltage:** Flags charge controller input spikes above safe string voltage limits.
3. **Solar Under-Generation:** Detects sub-optimal harvesting specifically during Nigerian daylight hours (WAT), avoiding false positives overnight.
4. **Site Disconnection / Heartbeat Timeout:** A watchdog monitors data-stream intervals per site; if a site's packet feed stalls, the SCADA interface flags the node as offline.

> Alarm delivery is currently in-dashboard (visual banner + audible tone) and also outbound notification (email/SMS to NOC operators) has been implemented.

---

## 💻 Tech Stack
1. **Simulation Engine:** Python 3 (`requests`, `random` for stochastic telemetry and fault-injection testing)
2. **Ingestion Layer (in progress):** Node.js / Express, containerized with Docker
3. **User Interface:** Vanilla JS (ES6+), HTML5, Tailwind CSS, Chart.js
4. **Database & Realtime Backend:** Supabase (PostgreSQL + native WebSockets)
5. **Hosting & Deployment:** Vercel (frontend), Docker (ingestion layer — cloud hosting target)

---

## 🗺️ Roadmap
- [ ] Containerized ingestion layer — validation logic complete, hosting environment decision pending
- [ ] Physical DTU/gateway integration to replace simulator in production sites