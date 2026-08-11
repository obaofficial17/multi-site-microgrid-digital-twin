# ⚡ Multi-Site Microgrid Digital Twin & Real-Time Monitoring Ecosystem

> An industrial-grade, multi-tenant SCADA platform for fleet-wide observability across distributed solar microgrid infrastructure.

[![Status](https://img.shields.io/badge/status-active--development-orange)]()
[![Stack](https://img.shields.io/badge/stack-Node.js%20%7C%20Supabase%20%7C%20Python-blue)]()
[![Hosting](https://img.shields.io/badge/frontend-Vercel-black)]()
[![License](https://img.shields.io/badge/license-Private-lightgrey)]()

---

## Table of Contents

- [Overview](#overview)
- [Key Performance Indicators](#key-performance-indicators)
- [System Architecture](#system-architecture)
- [Security Model](#security-model)
- [Alarm & Fault Detection](#alarm--fault-detection)
- [Tech Stack](#tech-stack)
- [Project Status & Roadmap](#project-status--roadmap)
- [Why This Project Matters](#why-this-project-matters)

---

## Overview

This platform delivers real-time observability across **7 distributed microgrid sites**, unifying solar generation, battery storage, and load telemetry into a single fleet-wide SCADA interface.

To eliminate dependency on proprietary, vendor-locked edge gateway hardware, the system is built around a **high-fidelity Digital Twin (Software-in-the-Loop)** simulation engine. This allows the entire data pipeline — from field device to live dashboard — to be built, tested, and hardened *before* physical DTU hardware is fully deployed in the field, de-risking the hardware integration phase entirely.

The result is a production-grade cloud pipeline that is hardware-agnostic by design: any device that can speak the ingestion layer's schema — simulated or physical — can plug directly into the system with zero changes downstream.

## Key Performance Indicators

The platform tracks the electrical parameters that determine microgrid health and performance:

| **Solar Generation** | Dual charge-controller tracking | `cc1_pv_watts`, `cc1_pv_volts`, `cc1_pv_amps`, `cc2_pv_watts`, `cc2_pv_volts`, `cc2_pv_amps` |
| **Storage Health** | 48V DC bus voltage & derived state-of-charge | `battery_voltage`, `battery_soc_percent` |
| **Demand** | Live load consumption per charge controller | `cc1_load_watts`, `cc2_load_watts` |

## System Architecture

```
┌───────────────────────────────┐
│  Edge Gateway / DTU Simulator │
└───────────────┬───────────────┘
                │ HTTPS POST (JSON telemetry)
                ▼
┌───────────────────────────────┐
│  Ingestion Layer              │
│  Dockerized Node.js / Express │  ← in progress
│  (payload validation, auth,   │
│   database write isolation)   │
└───────────────┬───────────────┘
                │ authenticated writes only
                ▼
┌───────────────────────────────┐
│  Supabase — PostgreSQL        │
│  RLS-gated,authenticated reads│
└───────────────┬───────────────┘
                │ Realtime WebSocket broadcast
                ▼
┌───────────────────────────────┐
│  HMI Layer — Vercel Dashboard │
└───────────────────────────────┘
```

**1. Edge Layer — Digital Twin Simulator**
A Python simulation engine models 7 unique hardware DTUs, generating structured JSON telemetry with realistic, stochastic fault injection, cloud-cover under-generation, PV overvoltage spikes, and battery undervoltage/overvoltage excursions to exercise the alarm system under controlled, repeatable conditions.

**2. Ingestion Layer — *in progress***
A containerized Node.js/Express service sits between edge gateways and Supabase. It authenticates incoming requests against a dedicated shared bearer token, validates payload schema and sensor value bounds, and is the sole holder of Supabase's privileged write credentials so no field device or frontend ever carries write-capable secrets. This replaces direct gateway-to-database writes with a single, auditable choke point. Hosting target (central cloud VM vs. on-prem) is still in progress.

**3. Storage & Broadcast Layer — Supabase**
PostgreSQL with Row Level Security enforced across all tables: read access is scoped to authenticated dashboard sessions only, and writes are only possible through the ingestion layer never via a publicly reachable key. A dedicated Realtime channel broadcasts new telemetry rows to connected dashboards as they land.

**4. HMI Layer — Vercel Frontend**
A responsive dashboard with multi-site dropdown filtering, adjustable history windows, and live chart updates driven entirely by Supabase Realtime subscriptions no polling required.

## Security Model

- **Row Level Security (RLS)** is enforced on database: `SELECT` is restricted to `authenticated` sessions only, with no anonymous read or write access at the database level.
- **Key separation by trust boundary:** the frontend uses Supabase's public **publishable key** only; all writes route through the ingestion layer using privileged access that never touches frontend code, git history, or device firmware.
- **Independent gateway authentication:** the ingestion layer requires its own shared bearer token from any device posting telemetry, decoupled from Supabase's auth so a leaked Supabase key alone cannot be used to inject fabricated sensor data.

## Alarm & Fault Detection

The HMI layer includes a real-time, client-side alarm system that flags microgrid abnormalities directly in the UI as telemetry arrives:

| **Battery Undervoltage / Overvoltage** | Tiered warning vs. critical alerts when the 48V DC bus exits safe operating thresholds |
| **PV String Overvoltage** | Charge controller input spikes above safe string voltage limits |
| **Solar Under-Generation** | Sub-optimal harvesting during Nigerian daylight hours (WAT) — time-aware to avoid overnight false positives |
| **Site Disconnection / Heartbeat Timeout** | Watchdog monitors per-site packet intervals and flags a node offline on stalled feeds |

> Alarm delivery currently combines in-dashboard visual banners and audible tones with outbound NOC notifications (email/SMS), giving operators both an on-screen and off-screen line of sight into fleet health.

## Tech Stack

| Layer | Technology |
|---|---|
| Simulation Engine | Python 3 (`requests`, `random` for stochastic fault injection) |
| Ingestion Layer *(in progress)* | Node.js / Express, containerized with Docker |
| User Interface | Vanilla JS (ES6+), HTML5, Tailwind CSS, Chart.js |
| Database & Realtime Backend | Supabase (PostgreSQL + native WebSockets) |
| Hosting & Deployment | Vercel (frontend) · Docker (ingestion layer, target TBD) |

## Project Status & Roadmap

- [x] Digital Twin simulation engine — 7-site fault injection modeling
- [x] Supabase schema, RLS policy, and Realtime broadcast layer
- [x] Vercel-hosted HMI dashboard with live multi-site views
- [x] Client-side alarm system with NOC email/SMS notifications
- [ ] Containerized ingestion layer — validation logic complete, hosting environment decision pending
- [ ] Physical DTU/gateway integration to replace simulator in production sites

## Why This Project Matters

Most small-scale telecom and microgrid operators are locked into whatever monitoring stack their edge hardware vendor ships — closed, non-portable, and expensive to scale across sites. This platform inverts that model: the entire pipeline is validated in software first, hardware-agnostic by design, and built on infrastructure (Supabase, Docker, Vercel) that scales from 7 pilot sites to a much larger fleet without an architectural rewrite. The digital twin approach also means new fault-handling logic and alarm thresholds can be tested exhaustively against simulated edge cases *before* they ever run against live, revenue-critical infrastructure.

---

<p align="center"><sub>Built for multi-site solar microgrid monitoring across distributed telecom infrastructure sites in Nigeria.</sub></p>