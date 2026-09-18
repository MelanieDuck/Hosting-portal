import { useEffect, useState } from 'react';
import {
  Globe,
  Server,
  CreditCard,
  Calendar,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { supabase, type Subscription, type Payment, type Profile } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, CardHeader, Badge, Spinner, EmptyState } from '@/components/ui';
import { formatCurrency, formatDate, daysUntil } from '@/lib/format';
import type { PageKey } from '@/components/Layout';

export function DashboardPage({ onNavigate }: { onNavigate: (key: PageKey) => void }) {
  const { user, profile } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [subRes, payRes] = await Promise.all([
        supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .maybeSingle(),
        supabase
          .from('payments')
          .select('*')
          .eq('user_id', user.id)
          .order('payment_date', { ascending: false })
          .limit(5),
      ]);
      if (cancelled) return;
      setSubscription(subRes.data as Subscription | null);
      setRecentPayments(payRes.data as Payment[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) return <Spinner className="py-20" />;

  const daysToPayment = daysUntil(subscription?.next_payment_date ?? null);
  const greetingName = profile?.full_name?.split(' ')[0] || 'there';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome back, {greetingName}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Here's an overview of your hosting subscription
        </p>
      </div>

      {/* Status banner */}
      {subscription?.status === 'active' && daysToPayment <= 5 && daysToPayment > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            Your next payment of {formatCurrency(subscription.amount, subscription.currency)} is due in{' '}
            {daysToPayment} day{daysToPayment !== 1 ? 's' : ''} —{' '}
            {formatDate(subscription.next_payment_date)}
          </p>
        </div>
      )}
      {subscription?.status === 'cancelled' && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-800">
            Your subscription has been cancelled. Your website will remain active until the end of your billing period.
          </p>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Plan</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-slate-600" />
            </div>
          </div>
          <p className="text-xl font-bold text-slate-900">
            {subscription?.plan_name || '—'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {subscription ? `${formatCurrency(subscription.amount, subscription.currency)}/month` : 'No active plan'}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Status</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-slate-600" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xl font-bold text-slate-900 capitalize">
              {subscription?.status || '—'}
            </p>
            {subscription && (
              <Badge variant={subscription.status === 'active' ? 'success' : 'danger'}>
                {subscription.status === 'active' ? 'Active' : 'Cancelled'}
              </Badge>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Next payment</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-slate-600" />
            </div>
          </div>
          <p className="text-xl font-bold text-slate-900">
            {formatDate(subscription?.next_payment_date ?? null)}
          </p>
          {subscription?.next_payment_date && (
            <p className="text-xs text-slate-400 mt-1">
              in {daysToPayment} day{daysToPayment !== 1 ? 's' : ''}
            </p>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Member since</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-slate-600" />
            </div>
          </div>
          <p className="text-xl font-bold text-slate-900">
            {formatDate(subscription?.started_at ?? null)}
          </p>
        </Card>
      </div>

      {/* Website info */}
      <Card>
        <CardHeader
          title="Hosted Website"
          subtitle="Your website details and server information"
          icon={<Globe className="w-5 h-5" />}
        />
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">
              Website address
            </p>
            <a
              href={profile?.website_url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-slate-900 hover:text-slate-600 transition-colors break-all"
            >
              {profile?.website_url || 'Not configured'}
            </a>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">
              Server
            </p>
            <p className="text-sm font-medium text-slate-900">
              {profile?.website_server || 'Not configured'}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">
              Server IP
            </p>
            <p className="text-sm font-medium text-slate-900">
              {profile?.website_ip || '—'}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">
              Company
            </p>
            <p className="text-sm font-medium text-slate-900">
              {profile?.company_name || '—'}
            </p>
          </div>
        </div>
      </Card>

      {/* Recent payments */}
      <Card>
        <CardHeader
          title="Recent Payments"
          subtitle="Your latest billing transactions"
          icon={<CreditCard className="w-5 h-5" />}
          action={
            <button
              onClick={() => onNavigate('payments')}
              className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              View all
              <ArrowRight className="w-4 h-4" />
            </button>
          }
        />
        <div className="p-6">
          {recentPayments.length === 0 ? (
            <EmptyState
              icon={<CreditCard className="w-6 h-6" />}
              title="No payments yet"
              description="Your payment history will appear here once transactions are processed."
            />
          ) : (
            <div className="space-y-3">
              {recentPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                      <CreditCard className="w-4 h-4 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {payment.invoice_number || 'Payment'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatDate(payment.payment_date)}
                        {payment.payment_method_label ? ` • ${payment.payment_method_label}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">
                      {formatCurrency(payment.amount, payment.currency)}
                    </p>
                    <Badge
                      variant={
                        payment.status === 'succeeded'
                          ? 'success'
                          : payment.status === 'failed'
                            ? 'danger'
                            : payment.status === 'refunded'
                              ? 'warning'
                              : 'neutral'
                      }
                    >
                      {payment.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
