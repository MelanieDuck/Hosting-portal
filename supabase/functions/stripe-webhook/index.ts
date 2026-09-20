import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
// Stripe webhook edge function for HostPortal
// Handles subscription sync, one-time payments, and invite flow completion
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const stripe = new Stripe(stripeSecret, {
  appInfo: {
    name: 'Bolt Integration',
    version: '1.0.0',
  },
});

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async (req) => {
  try {
    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // get the signature from the header
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return new Response('No signature found', { status: 400 });
    }

    // get the raw body
    const body = await req.text();

    // verify the webhook signature
    let event: Stripe.Event;

    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, stripeWebhookSecret);
    } catch (error: any) {
      console.error(`Webhook signature verification failed: ${error.message}`);
      return new Response(`Webhook signature verification failed: ${error.message}`, { status: 400 });
    }

    EdgeRuntime.waitUntil(handleEvent(event));

    return Response.json({ received: true });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function handleEvent(event: Stripe.Event) {
  const stripeData = event?.data?.object ?? {};

  if (!stripeData) {
    return;
  }

  if (!('customer' in stripeData)) {
    return;
  }

  // for one time payments, we only listen for the checkout.session.completed event
  if (event.type === 'payment_intent.succeeded' && event.data.object.invoice === null) {
    return;
  }

  const { customer: customerId } = stripeData;

  if (!customerId || typeof customerId !== 'string') {
    console.error(`No customer received on event: ${JSON.stringify(event)}`);
  } else {
    let isSubscription = true;

    if (event.type === 'checkout.session.completed') {
      const { mode } = stripeData as Stripe.Checkout.Session;

      isSubscription = mode === 'subscription';

      console.info(`Processing ${isSubscription ? 'subscription' : 'one-time payment'} checkout session`);
    }

    const { mode, payment_status } = stripeData as Stripe.Checkout.Session;

    // Check for invite flow metadata
    const metadata = (stripeData as Stripe.Checkout.Session).metadata;
    const pendingClientId = metadata?.pending_client_id;
    const inviteToken = metadata?.invite_token;

    if (isSubscription) {
      console.info(`Starting subscription sync for customer: ${customerId}`);
      await syncCustomerFromStripe(customerId);

      // If this was an invite flow checkout, mark the token as used and update pending client
      if (pendingClientId && inviteToken && payment_status === 'paid') {
        const session = stripeData as Stripe.Checkout.Session;
        await handleInviteCompletion(pendingClientId, inviteToken, customerId, session);
      }
    } else if (mode === 'payment' && payment_status === 'paid') {
      try {
        // Extract the necessary information from the session
        const {
          id: checkout_session_id,
          payment_intent,
          amount_subtotal,
          amount_total,
          currency,
        } = stripeData as Stripe.Checkout.Session;

        // Insert the order into the stripe_orders table
        const { error: orderError } = await supabase.from('stripe_orders').insert({
          checkout_session_id,
          payment_intent_id: payment_intent,
          customer_id: customerId,
          amount_subtotal,
          amount_total,
          currency,
          payment_status,
          status: 'completed', // assuming we want to mark it as completed since payment is successful
        });

        if (orderError) {
          console.error('Error inserting order:', orderError);
          return;
        }
        console.info(`Successfully processed one-time payment for session: ${checkout_session_id}`);

        // Also handle invite completion for one-time payments
        if (pendingClientId && inviteToken) {
          const session = stripeData as Stripe.Checkout.Session;
          await handleInviteCompletion(pendingClientId, inviteToken, customerId, session);
        }
      } catch (error) {
        console.error('Error processing one-time payment:', error);
      }
    }
  }
}

async function handleInviteCompletion(
  pendingClientId: string,
  inviteTokenValue: string,
  customerId: string,
  session: Stripe.Checkout.Session,
) {
  try {
    console.info(`Processing invite completion for client ${pendingClientId}`);

    // Extract plan details from the checkout session's line items / price
    let planName = 'Hosting Plan';
    let planAmount: number | null = null;
    let planCurrency: string | null = null;
    let billingCycle = 'monthly';

    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
      if (lineItems.data.length > 0) {
        const price = lineItems.data[0].price;
        if (price) {
          planAmount = price.unit_amount ? price.unit_amount / 100 : null;
          planCurrency = price.currency;
          if (price.recurring?.interval === 'year') {
            billingCycle = 'yearly';
          } else if (price.recurring?.interval === 'month') {
            billingCycle = 'monthly';
          }
          // Use the product name as plan name if available
          if (price.product && typeof price.product !== 'string') {
            planName = price.product.name || planName;
          } else if (typeof price.product === 'string') {
            const product = await stripe.products.retrieve(price.product);
            planName = product.name || planName;
          }
        }
      }
    } catch (priceErr) {
      console.error('Failed to fetch price details, using defaults:', priceErr);
    }

    // Mark the invite token as used
    const { error: tokenUpdateError } = await supabase
      .from('invite_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', inviteTokenValue)
      .eq('client_id', pendingClientId)
      .is('used_at', null);

    if (tokenUpdateError) {
      console.error('Failed to mark invite token as used:', tokenUpdateError);
    } else {
      console.info(`Marked invite token as used for client ${pendingClientId}`);
    }

    // Update pending client: save Stripe customer ID + plan details, set status to completed
    const { error: clientUpdateError } = await supabase
      .from('pending_clients')
      .update({
        status: 'completed',
        stripe_customer_id: customerId,
        plan_name: planName,
        plan_amount: planAmount,
        plan_currency: planCurrency,
        billing_cycle: billingCycle,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pendingClientId);

    if (clientUpdateError) {
      console.error('Failed to update pending client:', clientUpdateError);
    } else {
      console.info(`Updated pending client ${pendingClientId} with Stripe data and status completed`);
    }
  } catch (error) {
    console.error(`Failed to handle invite completion for client ${pendingClientId}:`, error);
  }
}

// based on the excellent https://github.com/t3dotgg/stripe-recommendations
async function syncCustomerFromStripe(customerId: string) {
  try {
    // fetch latest subscription data from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
      status: 'all',
      expand: ['data.default_payment_method'],
    });

    // TODO verify if needed
    if (subscriptions.data.length === 0) {
      console.info(`No active subscriptions found for customer: ${customerId}`);
      const { error: noSubError } = await supabase.from('stripe_subscriptions').upsert(
        {
          customer_id: customerId,
          subscription_status: 'not_started',
        },
        {
          onConflict: 'customer_id',
        },
      );

      if (noSubError) {
        console.error('Error updating subscription status:', noSubError);
        throw new Error('Failed to update subscription status in database');
      }
    }

    // assumes that a customer can only have a single subscription
    const subscription = subscriptions.data[0];

    // store subscription state
    const { error: subError } = await supabase.from('stripe_subscriptions').upsert(
      {
        customer_id: customerId,
        subscription_id: subscription.id,
        price_id: subscription.items.data[0].price.id,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
        ...(subscription.default_payment_method && typeof subscription.default_payment_method !== 'string'
          ? {
              payment_method_brand: subscription.default_payment_method.card?.brand ?? null,
              payment_method_last4: subscription.default_payment_method.card?.last4 ?? null,
            }
          : {}),
        status: subscription.status,
      },
      {
        onConflict: 'customer_id',
      },
    );

    if (subError) {
      console.error('Error syncing subscription:', subError);
      throw new Error('Failed to sync subscription in database');
    }
    console.info(`Successfully synced subscription for customer: ${customerId}`);
  } catch (error) {
    console.error(`Failed to sync subscription for customer ${customerId}:`, error);
    throw error;
  }
}

