require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

// Initialize the Express App
const app = express();
const PORT = process.env.PORT || 8080;

// Initialize Supabase Client using environment variables with fallbacks
const SUPABASE_URL = process.env.SUPABASE_URL || "https://icgryayptwjgcpqhwsxx.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_U8VMbs1XABYo62cOslpNkw_PfN6rPRl";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Middleware
app.use(express.json());
app.use(cors());

// Health Check Endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: "Edge Proxy is Online and Listening" });
});

// Telemetry Ingestion Endpoint
app.post('/ingest', async (req, res) => {
    try {
        const payload = req.body;

        // Log incoming raw telemetry stream
        console.log(`\n📥 [${new Date().toISOString()}] Received payload from: ${payload.site_id || 'Unknown Site'}`);
        console.log("Payload content:", payload);

        // Sanitize and structure payload to match location_telemetry table schema
        const telemetryRow = {
            site_id: payload.site_id,
            cc1_pv_watts: parseFloat(payload.cc1_pv_watts) || 0,
            cc2_pv_watts: parseFloat(payload.cc2_pv_watts) || 0,
            cc1_pv_volts: parseFloat(payload.cc1_pv_volts) || 0,
            cc2_pv_volts: parseFloat(payload.cc2_pv_volts) || 0,
            cc1_load_watts: parseFloat(payload.cc1_load_watts) || 0,
            cc2_load_watts: parseFloat(payload.cc2_load_watts) || 0,
            battery_voltage: parseFloat(payload.battery_voltage) || 0,
            created_at: payload.created_at || new Date().toISOString()
        };

        // Forward sanitized record directly to Supabase
        const { data, error } = await supabase
            .from('location_telemetry')
            .insert([telemetryRow]);

        if (error) {
            console.error("❌ Supabase Database Insert Failure:", error.message);
            return res.status(500).json({ status: "error", message: error.message });
        }

        console.log(`⚡ Successfully posted record to Supabase for ${telemetryRow.site_id}`);

        // Return success response to the edge client / DTU
        res.status(200).json({ 
            status: "success", 
            message: "Telemetry ingested and stored successfully",
            site_id: telemetryRow.site_id 
        });

    } catch (error) {
        console.error("❌ Critical Proxy Execution Error:", error);
        res.status(400).json({ status: "error", message: "Invalid payload format" });
    }
});

// Start listening server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Node.js Edge Proxy Gateway listening on http://0.0.0.0:${PORT}`);
});