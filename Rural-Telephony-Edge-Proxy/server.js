const express = require('express');
const cors = require('cors');

// Initialize the Express App
const app = express();
const PORT = process.env.PORT || 8080;

// Middleware to automatically parse incoming JSON payloads
app.use(express.json());
app.use(cors());

// Health Check Endpoint (Proves the container is alive)
app.get('/health', (req, res) => {
    res.status(200).json({ status: "Edge Proxy is Online and Listening" });
});

// Telemetry Ingestion Endpoint (Where the DTU sends data)
app.post('/ingest', (req, res) => {
    try {
        const payload = req.body;

        // Log the incoming data to the terminal (Proof of receipt)
        console.log(`\n📥 [${new Date().toISOString()}] Received payload from: ${payload.site_id || 'Unknown Site'}`);
        console.log("Data payload:", payload);

        // (The Supabase forwarding logic will be here)

        // Send a success response back to the hardware/simulator
        res.status(200).json({ 
            status: "success", 
            message: "Telemetry received safely by Node.js Proxy" 
        });

    } catch (error) {
        console.error("❌ Error processing payload:", error);
        res.status(400).json({ status: "error", message: "Invalid payload format" });
    }
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Node.js Edge Proxy running on http://0.0.0.0:${PORT}`);
});