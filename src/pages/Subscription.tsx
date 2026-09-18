import { useEffect, useState } from 'react';
import {
  Settings,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  CreditCard,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { supabase, type Subscription, type StripeSubscription } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  Card,
  CardHeader,
  Badge,
  Button,
  Spinner,
  Modal,
  EmptyState,
} from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/format';

const STRIPE_PRICE_ID = import.meta.env.VITE_STRIPE_PRICE_ID ?? '';
const STRIPE_ONE_OFF_PRICE_ID = import.meta.env.VITE_STRIPE_ONE_OFF_PRICE_ID ?? '';

export function SubscriptionPage() {
  const { user, session } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [stripeSub, setStripeSub] = useState<StripeSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  const loadData = async () => {
    if (!user) return;
    const [subRes, stripeSubRes] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .maybeSingle(),
      supabase
        .from('stripe_user_subscriptions')
        .select('*')
        .maybeSingle(),
    ]);
    setSubscription(subRes.data as Subscription | null);
    setStripeSub(stripeSubRes.data as StripeSubscription | null);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleCancel = async () => {
    if (!subscription || !user) return;
    setCancelling(true);
    setError('');
    try {
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', subscription.id);

      if (updateError) throw updateError;

      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-cancellation-email`;
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          user_id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.email,
          plan_name: subscription.plan_name,
          website_url: '',
        }),
      });
      if (!res.ok) {
        console.warn('Cancellation email notification may not have been sent');
      }

      setSubscription({
        ...subscription,
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      });
      setSuccess(true);
      setCancelConfirmOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel subscription';
      setError(msg);
    } finally {
      setCancelling(false);
    }
  };

  const handleCheckout = async (mode: 'subscription' | 'payment') => {
    setCheckoutLoading(true);
    setCheckoutError('');
    try {
      const priceId = mode === 'subscription' ? STRIPE_PRICE_ID : STRIPE_ONE_OFF_PRICE_ID;
      if (!priceId) {
        setCheckoutError('Payment is not configured yet. Please contact support.');
        return;
      }

      const origin = window.location.origin;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
          },
          body: JSON.stringify({
            price_id: priceId,
            success_url: `${origin}/#/subscription`,
            cancel_url: `${origin}/#/subscription`,
            mode,
          }),
        },
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to start checkout');
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start checkout';
      setCheckoutError(msg);
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (loading) return <Spinner className="py-20" />;

  const stripeActive = stripeSub?.subscription_status === 'active';
  const stripeCancelled = stripeSub?.subscription_status === 'canceled';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Subscription</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your hosting subscription plan
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <p className="text-sm text-emerald-800">
            Your subscription has been cancelled. We've notified our team to process the cancellation. Your website will remain active until the end of your current billing period.
          </p>
        </div>
      )}

      {checkoutError && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">{checkoutError}</p>
        </div>
      )}

      {/* Stripe payment status card */}
      {stripeSub && (
        <Card>
          <CardHeader
            title="Payment Method"
            subtitle="Your card and billing status via Stripe"
            icon={<CreditCard className="w-5 h-5" />}
          />
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {stripeSub.payment_method_brand && (
                  <div className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200">
                    <span className="text-sm font-semibold text-slate-700 uppercase">
                      {stripeSub.payment_method_brand}
                    </span>
                    {stripeSub.payment_method_last4 && (
                      <span className="text-sm text-slate-500 ml-2">
                        •••• {stripeSub.payment_method_last4}
                      </span>
                    )}
                  </div>
                )}
                <Badge variant={stripeActive ? 'success' : stripeCancelled ? 'danger' : 'warning'}>
                  {stripeSub.subscription_status}
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadData()}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </Button>
            </div>

            {stripeSub.current_period_end && (
              <p className="text-sm text-slate-500">
                {stripeSub.cancel_at_period_end
                  ? `Subscription cancels on ${formatDate(new Date(stripeSub.current_period_end * 1000).toISOString())}`
                  : `Next billing date: ${formatDate(new Date(stripeSub.current_period_end * 1000).toISOString())}`}
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Plan details */}
      {!subscription ? (
        <Card>
          <EmptyState
            icon={<Settings className="w-6 h-6" />}
            title="No subscription found"
            description="If you believe this is an error, please contact support."
          />
        </Card>
      ) : (
        <Card>
          <CardHeader
            title="Plan Details"
            subtitle="Your current hosting plan"
            icon={<Settings className="w-5 h-5" />}
            action={
              <Badge variant={subscription.status === 'active' ? 'success' : 'danger'}>
                {subscription.status === 'active' ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" /> Active
                  </>
                ) : (
                  <>
                    <XCircle className="w-3 h-3" /> Cancelled
                  </>
                )}
              </Badge>
            }
          />
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">
                Plan name
              </p>
              <p className="text-lg font-semibold text-slate-900">
                {subscription.plan_name}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">
                Monthly amount
              </p>
              <p className="text-lg font-semibold text-slate-900">
                {formatCurrency(subscription.amount, subscription.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">
                Billing cycle
              </p>
              <p className="text-lg font-semibold text-slate-900 capitalize">
                {subscription.billing_cycle}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">
                Start date
              </p>
              <p className="text-lg font-semibold text-slate-900">
                {formatDate(subscription.started_at)}
              </p>
            </div>
            {subscription.next_payment_date && subscription.status === 'active' && (
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">
                  Next payment
                </p>
                <p className="text-lg font-semibold text-slate-900">
                  {formatDate(subscription.next_payment_date)}
                </p>
              </div>
            )}
            {subscription.cancelled_at && (
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">
                  Cancelled on
                </p>
                <p className="text-lg font-semibold text-slate-900">
                  {formatDate(subscription.cancelled_at)}
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Billing info */}
      {subscription?.status === 'active' && (
        <Card>
          <CardHeader
            title="Billing Schedule"
            subtitle="Your upcoming payment information"
            icon={<Calendar className="w-5 h-5" />}
          />
          <div className="p-6">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 border border-blue-200">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-blue-900 font-medium">
                  Next payment: {formatCurrency(subscription.amount, subscription.currency)}
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  Due on {formatDate(subscription.next_payment_date)}. You'll receive a reminder email a few days before your card is charged.
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Stripe checkout section */}
      {subscription?.status === 'cancelled' && (
        <Card>
          <CardHeader
            title="Reactivate Subscription"
            subtitle="Resume your hosting subscription via secure Stripe checkout"
            icon={<CreditCard className="w-5 h-5" />}
          />
          <div className="p-6 space-y-4">
            <p className="text-sm text-slate-600">
              Reactivate your hosting plan to restore full access to your website, backups, and support. You'll be redirected to Stripe's secure checkout page to enter your payment details.
            </p>
            <Button
              onClick={() => handleCheckout('subscription')}
              disabled={checkoutLoading}
            >
              {checkoutLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Redirecting to checkout...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  Reactivate via Stripe
                </>
              )}
            </Button>
          </div>
        </Card>
      )}

      {/* Cancel section */}
      {subscription?.status === 'active' && (
        <Card className="border-red-200">
          <CardHeader
            title="Cancel Subscription"
            subtitle="Cancel your hosting subscription at any time"
            icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
          />
          <div className="p-6">
            <p className="text-sm text-slate-600 mb-4">
              Cancelling your subscription will stop all future payments. Your website
              will remain active until the end of your current billing period. Our team
              will be notified automatically to take down your website.
            </p>
            <Button
              variant="danger"
              onClick={() => setCancelConfirmOpen(true)}
            >
              Cancel my subscription
            </Button>
          </div>
        </Card>
      )}

      {subscription?.status === 'cancelled' && (
        <Card>
          <div className="p-6 flex items-start gap-3">
            <Info className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-slate-900">
                Subscription cancelled
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Your subscription was cancelled on {formatDate(subscription.cancelled_at)}.
                Use the reactivation button above to resume your hosting via Stripe.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Cancel confirmation modal */}
      <Modal
        open={cancelConfirmOpen}
        onClose={() => setCancelConfirmOpen(false)}
        title="Confirm cancellation"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-900">
                Are you sure you want to cancel?
              </p>
              <p className="text-sm text-amber-700 mt-1">
                This action cannot be undone. Your website will be taken down at the end
                of your billing period and you'll lose access to backups. Our team will be
                notified automatically.
              </p>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => setCancelConfirmOpen(false)}
            >
              Keep subscription
            </Button>
            <Button
              variant="danger"
              loading={cancelling}
              onClick={handleCancel}
            >
              Yes, cancel subscription
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
