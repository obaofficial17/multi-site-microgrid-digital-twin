const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

// Safely bridges connection using your cloud project credentials
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

app.post('/api/v1/telemetry', async (req, res) => {
  const { site_id, cc1_pv_watts, cc2_pv_watts, battery_voltage } = req.body;

  // Makes sure incoming payloads include a site identification tag
  if (!site_id) {
    return res.status(400).json({ error: "Missing site_id parameter" });
  }

  // Inserts your live metrics directly to your Supabase log table
  const { error } = await supabase
    .from('location_telemetry')
    .insert([{ site_id, cc1_pv_watts, cc2_pv_watts, battery_voltage }]);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ status: "Success", message: `Stored updates for ${site_id}` });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Ingestion engine running on port ${PORT}`));