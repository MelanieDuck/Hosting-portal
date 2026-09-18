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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Find all active subscriptions with a next_payment_date within the next 5 days
    const now = new Date();
    const fiveDaysFromNow = new Date();
    fiveDaysFromNow.setDate(now.getDate() + 5);

    const { data: subscriptions, error: subError } = await supabase
      .from("subscriptions")
      .select("id, user_id, plan_name, amount, currency, next_payment_date")
      .eq("status", "active")
      .gte("next_payment_date", now.toISOString().split("T")[0])
      .lte("next_payment_date", fiveDaysFromNow.toISOString().split("T")[0]);

    if (subError) throw subError;

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No reminders to send", sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let sentCount = 0;

    for (const sub of subscriptions) {
      // Check if we already sent a reminder for this subscription recently
      const { data: existing } = await supabase
        .from("notification_log")
        .select("id")
        .eq("user_id", sub.user_id)
        .eq("type", "payment_reminder")
        .gte("sent_at", new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .maybeSingle();

      if (existing) continue;

      // Get the user's email
      const { data: userData } = await supabase.auth.admin.getUserById(sub.user_id);
      if (!userData?.user?.email) continue;

      const paymentDate = new Date(sub.next_payment_date).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      const currencySymbol = sub.currency === "GBP" ? "£" : sub.currency === "EUR" ? "€" : "$";

      const subject = `Payment reminder — ${currencySymbol}${sub.amount} due on ${paymentDate}`;
      const body = `Hi ${userData.user.user_metadata?.full_name || ""},

This is a friendly reminder that your hosting subscription payment of ${currencySymbol}${sub.amount} will be charged on ${paymentDate}.

Plan: ${sub.plan_name}
Amount: ${currencySymbol}${sub.amount} ${sub.currency}

If you need to update your payment method, please log in to your client portal.

Thank you for choosing our hosting service.`;

      await supabase.from("notification_log").insert({
        user_id: sub.user_id,
        type: "payment_reminder",
        recipient: userData.user.email,
        subject,
        body,
        status: "sent",
      });

      sentCount++;
    }

    return new Response(
      JSON.stringify({ success: true, message: `Sent ${sentCount} reminders`, sent: sentCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
