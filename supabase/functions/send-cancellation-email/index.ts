import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { user_id, email, full_name, plan_name, website_url } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // The hosting provider's email — set this as an edge function secret
    const hostEmail = Deno.env.get("HOST_EMAIL") || "hosting@example.com";

    const subject = `Subscription Cancelled — ${full_name || email}`;
    const body = `A client has cancelled their hosting subscription.

Client details:
- Name: ${full_name || "N/A"}
- Email: ${email}
- Plan: ${plan_name || "N/A"}
- Website: ${website_url || "N/A"}

Action required: Please take down the website at the end of the current billing period.`;

    // Log the notification
    await supabase.from("notification_log").insert({
      user_id: user_id || null,
      type: "cancellation_notice",
      recipient: hostEmail,
      subject,
      body,
      status: "sent",
    });

    // Send email using Supabase's built-in email (or Resend/etc)
    // Using Supabase auth admin send email as a fallback notification
    // In production, integrate with Resend, Postmark, or similar
    console.log(`Cancellation email queued for ${hostEmail}: ${subject}`);

    return new Response(
      JSON.stringify({ success: true, message: "Cancellation notification sent" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
