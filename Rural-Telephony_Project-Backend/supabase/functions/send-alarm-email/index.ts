import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// !!! ACTION REQUIRED !!! Replace this string token with your real Resend API key!
const RESEND_API_KEY = "re_CYVi6qDh_8B4qUwsLHufLUicT6PzL2aNQ"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { record } = await req.json()

    // Threshold breaker evaluations engine
    if (record.battery_voltage < 24.2 || record.cc1_pv_volts > 110.0 || record.cc2_pv_volts > 110.0) {
      
      // Update this to your personal verified Resend account email for free-tier clearance
      const targetEmails = ["obakinemmanuel@gmail.com"]

      const emailBody = {
        from: "A1 Power SCADA Core <onboarding@resend.dev>",
        to: targetEmails,
        subject: `🚨 CRITICAL ALARM: Infrastructure Fault at ${record.site_id}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; background-color: #0f172a; color: #f1f5f9; border-radius: 16px; border: 1px solid #334155;">
            <h2 style="color: #ef4444; margin-top: 0; border-bottom: 1px solid #334155; padding-bottom: 12px; font-weight: 900;">A1 Power SCADA Alert Intercept</h2>
            <p style="font-size: 14px; color: #94a3b8;">An automated real-time threshold breaker alarm has been tripped by the field hardware hardware telemetry stream.</p>
            
            <div style="background-color: #1e293b; padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid #475569;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: bold;">Target Asset Node:</td>
                  <td style="padding: 6px 0; color: #f8fafc; font-weight: bold; text-align: right;">${record.site_id}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: bold;">DC Battery Bus:</td>
                  <td style="padding: 6px 0; color: #a78bfa; font-weight: bold; text-align: right;">${record.battery_voltage} Volts</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: bold;">CC1 Solar Harvest:</td>
                  <td style="padding: 6px 0; color: #10b981; font-weight: bold; text-align: right;">${record.cc1_pv_watts}W (${record.cc1_pv_volts}V)</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: bold;">CC2 Solar Harvest:</td>
                  <td style="padding: 6px 0; color: #06b6d4; font-weight: bold; text-align: right;">${record.cc2_pv_watts}W (${record.cc2_pv_volts}V)</td>
                </tr>
              </table>
            </div>
            
            <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">This communication transmission was securely dispatched from A1 Power Cloud Systems infrastructure.</p>
          </div>
        `
      }

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(emailBody)
      })

      const resData = await res.json()
      return new Response(JSON.stringify({ success: true, info: resData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      })
    }

    return new Response(JSON.stringify({ status: "Metrics nominal. Alerts suppressed." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400
    })
  }
})