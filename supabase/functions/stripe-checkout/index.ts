import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
// Stripe checkout edge function for HostPortal
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripe = new Stripe(stripeSecret, {
  appInfo: {
    name: 'Bolt Integration',
    version: '1.0.0',
  },
});

// Helper function to create responses with CORS headers
function corsResponse(body: string | object | null, status = 200) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  // For 204 No Content, don't include Content-Type or body
  if (status === 204) {
    return new Response(null, { status, headers });
  }

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
  });
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return corsResponse({}, 204);
    }

    if (req.method !== 'POST') {
      return corsResponse({ error: 'Method not allowed' }, 405);
    }

    const {
      price_id,
      success_url,
      cancel_url,
      mode,
      pending_client_id,
      invite_token,
    } = await req.json();

    const error = validateParameters(
      { price_id, success_url, cancel_url, mode },
      {
        cancel_url: 'string',
        price_id: 'string',
        success_url: 'string',
        mode: { values: ['payment', 'subscription'] },
      },
    );

    if (error) {
      return corsResponse({ error }, 400);
    }

    // Invite flow: no auth required, but must provide valid pending_client_id + invite_token
    if (pending_client_id && invite_token) {
      return await handleInviteCheckout(
        price_id,
        success_url,
        cancel_url,
        mode,
        pending_client_id,
        invite_token,
      );
    }

    // Standard flow: requires auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return corsResponse({ error: 'Missing authorization header' }, 401);
    }
    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: getUserError,
    } = await supabase.auth.getUser(token);

    if (getUserError) {
      return corsResponse({ error: 'Failed to authenticate user' }, 401);
    }

    if (!user) {
      return corsResponse({ error: 'User not found' }, 404);
    }

    const { data: customer, error: getCustomerError } = await supabase
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (getCustomerError) {
      console.error('Failed to fetch customer information from the database', getCustomerError);

      return corsResponse({ error: 'Failed to fetch customer information' }, 500);
    }

    let customerId;

    /**
     * In case we don't have a mapping yet, the customer does not exist and we need to create one.
     */
    if (!customer || !customer.customer_id) {
      const newCustomer = await stripe.customers.create({
        email: user.email,
        metadata: {
          userId: user.id,
        },
      });

      console.log(`Created new Stripe customer ${newCustomer.id} for user ${user.id}`);

      const { error: createCustomerError } = await supabase.from('stripe_customers').insert({
        user_id: user.id,
        customer_id: newCustomer.id,
      });

      if (createCustomerError) {
        console.error('Failed to save customer information in the database', createCustomerError);

        // Try to clean up both the Stripe customer and subscription record
        try {
          await stripe.customers.del(newCustomer.id);
          await supabase.from('stripe_subscriptions').delete().eq('customer_id', newCustomer.id);
        } catch (deleteError) {
          console.error('Failed to clean up after customer mapping error:', deleteError);
        }

        return corsResponse({ error: 'Failed to create customer mapping' }, 500);
      }

      if (mode === 'subscription') {
        const { error: createSubscriptionError } = await supabase.from('stripe_subscriptions').insert({
          customer_id: newCustomer.id,
          status: 'not_started',
        });

        if (createSubscriptionError) {
          console.error('Failed to save subscription in the database', createSubscriptionError);

          // Try to clean up the Stripe customer since we couldn't create the subscription
          try {
            await stripe.customers.del(newCustomer.id);
          } catch (deleteError) {
            console.error('Failed to delete Stripe customer after subscription creation error:', deleteError);
          }

          return corsResponse({ error: 'Unable to save the subscription in the database' }, 500);
        }
      }

      customerId = newCustomer.id;

      console.log(`Successfully set up new customer ${customerId} with subscription record`);
    } else {
      customerId = customer.customer_id;

      if (mode === 'subscription') {
        // Verify subscription exists for existing customer
        const { data: subscription, error: getSubscriptionError } = await supabase
          .from('stripe_subscriptions')
          .select('status')
          .eq('customer_id', customerId)
          .maybeSingle();

        if (getSubscriptionError) {
          console.error('Failed to fetch subscription information from the database', getSubscriptionError);

          return corsResponse({ error: 'Failed to fetch subscription information' }, 500);
        }

        if (!subscription) {
          // Create subscription record for existing customer if missing
          const { error: createSubscriptionError } = await supabase.from('stripe_subscriptions').insert({
            customer_id: customerId,
            status: 'not_started',
          });

          if (createSubscriptionError) {
            console.error('Failed to create subscription record for existing customer', createSubscriptionError);

            return corsResponse({ error: 'Failed to create subscription record for existing customer' }, 500);
          }
        }
      }
    }

    // create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: price_id,
          quantity: 1,
        },
      ],
      mode,
      success_url,
      cancel_url,
    });

    console.log(`Created checkout session ${session.id} for customer ${customerId}`);

    return corsResponse({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error(`Checkout error: ${error.message}`);
    return corsResponse({ error: error.message }, 500);
  }
});

async function handleInviteCheckout(
  priceId: string,
  successUrl: string,
  cancelUrl: string,
  mode: string,
  pendingClientId: string,
  inviteTokenValue: string,
) {
  // Validate the invite token
  const { data: tokenData, error: tokenError } = await supabase
    .from('invite_tokens')
    .select('*')
    .eq('token', inviteTokenValue)
    .eq('client_id', pendingClientId)
    .is('used_at', null)
    .maybeSingle();

  if (tokenError || !tokenData) {
    return corsResponse({ error: 'Invalid or expired invite token' }, 400);
  }

  // Check expiry
  if (new Date(tokenData.expires_at).getTime() < Date.now()) {
    return corsResponse({ error: 'This invite link has expired' }, 410);
  }

  // Get the pending client
  const { data: clientData, error: clientError } = await supabase
    .from('pending_clients')
    .select('*')
    .eq('id', pendingClientId)
    .maybeSingle();

  if (clientError || !clientData) {
    return corsResponse({ error: 'Client record not found' }, 404);
  }

  // Create Stripe customer with pending client's email
  const newCustomer = await stripe.customers.create({
    email: clientData.email,
    metadata: {
      pending_client_id: pendingClientId,
      invite_token: inviteTokenValue,
    },
  });

  console.log(`Created Stripe customer ${newCustomer.id} for pending client ${pendingClientId}`);

  if (mode === 'subscription') {
    const { error: createSubError } = await supabase.from('stripe_subscriptions').insert({
      customer_id: newCustomer.id,
      status: 'not_started',
    });

    if (createSubError) {
      console.error('Failed to create subscription record:', createSubError);
      try {
        await stripe.customers.del(newCustomer.id);
      } catch (delErr) {
        console.error('Failed to clean up Stripe customer:', delErr);
      }
      return corsResponse({ error: 'Failed to create subscription record' }, 500);
    }
  }

  // Create checkout session with metadata for webhook matching
  const checkoutMode: 'payment' | 'subscription' = mode === 'payment' ? 'payment' : 'subscription';
  const session = await stripe.checkout.sessions.create({
    customer: newCustomer.id,
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: checkoutMode,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      pending_client_id: pendingClientId,
      invite_token: inviteTokenValue,
    },
  });

  console.log(`Created checkout session ${session.id} for pending client ${pendingClientId}`);

  return corsResponse({ sessionId: session.id, url: session.url });
}

type ExpectedType = 'string' | { values: string[] };
type Expectations<T> = { [K in keyof T]: ExpectedType };

function validateParameters<T extends Record<string, any>>(values: T, expected: Expectations<T>): string | undefined {
  for (const parameter in values) {
    const expectation = expected[parameter];
    const value = values[parameter];

    if (expectation === 'string') {
      if (value == null) {
        return `Missing required parameter ${parameter}`;
      }
      if (typeof value !== 'string') {
        return `Expected parameter ${parameter} to be a string got ${JSON.stringify(value)}`;
      }
    } else {
      if (!expectation.values.includes(value)) {
        return `Expected parameter ${parameter} to be one of ${expectation.values.join(', ')}`;
      }
    }
  }

  return undefined;
}
