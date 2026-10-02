import { useEffect, useState } from 'react';
import {
  Globe,
  CreditCard,
  Calendar,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Save,
  X,
  ExternalLink,
} from 'lucide-react';
import { supabase, type Subscription, type Payment, type Profile, type DnsRecord } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, CardHeader, Badge, Spinner, Button, EmptyState } from '@/components/ui';
import { formatCurrency, formatDate, daysUntil } from '@/lib/format';
import type { PageKey } from '@/components/Layout';

export function DashboardPage({ onNavigate }: { onNavigate: (key: PageKey) => void }) {
  const { user, profile } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
  const [dnsRecords, setDnsRecords] = useState<DnsRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Website address editing
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [savingUrl, setSavingUrl] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [subRes, payRes, dnsRes] = await Promise.all([
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
        supabase
          .from('dns_records')
          .select('*')
          .eq('user_id', user.id)
          .order('sort_order', { ascending: true }),
      ]);
      if (cancelled) return;
      setSubscription(subRes.data as Subscription | null);
      setRecentPayments(payRes.data as Payment[]);
      setDnsRecords((dnsRes.data ?? []) as DnsRecord[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) return <Spinner className="py-20" />;

  const handleSaveUrl = async () => {
    if (!user) return;
    setSavingUrl(true);
    const normalized = urlValue.trim();
    const { error } = await supabase
      .from('profiles')
      .update({ website_url: normalized })
      .eq('id', user.id);
    if (!error) {
      setEditingUrl(false);
      // Refresh profile in context
      const { data: freshProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      // Local refresh — the auth context will pick this up on next render cycle
      if (freshProfile) {
        window.dispatchEvent(new Event('profile-updated'));
      }
    }
    setSavingUrl(false);
  };

  const startEditingUrl = () => {
    setUrlValue(profile?.website_url ?? '');
    setEditingUrl(true);
  };

  const displayUrl = profile?.website_url || '';
  const formattedUrl = displayUrl.startsWith('http') ? displayUrl : `https://${displayUrl}`;

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
            {editingUrl ? (
              <div className="flex gap-2 items-start">
                <input
                  type="text"
                  value={urlValue}
                  onChange={(e) => setUrlValue(e.target.value)}
                  placeholder="mywebsite.com"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveUrl();
                    if (e.key === 'Escape') setEditingUrl(false);
                  }}
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                />
                <button
                  onClick={handleSaveUrl}
                  disabled={savingUrl}
                  className="p-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
                  title="Save"
                >
                  <Save className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setEditingUrl(false)}
                  className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                  title="Cancel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : displayUrl ? (
              <a
                href={formattedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors break-all"
              >
                {displayUrl}
                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
              </a>
            ) : (
              <button
                onClick={startEditingUrl}
                className="text-sm font-medium text-slate-400 hover:text-slate-700 transition-colors"
              >
                Not configured — click to set
              </button>
            )}
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
              DNS Records
            </p>
            {dnsRecords.length > 0 ? (
              <div className="space-y-2">
                {dnsRecords.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100"
                  >
                    <span className="inline-flex items-center justify-center w-16 py-1 rounded-md bg-slate-200 text-xs font-semibold text-slate-700">
                      {rec.record_type}
                    </span>
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900">{rec.host_name}</span>
                      <span className="text-slate-300">→</span>
                      <span className="text-sm text-slate-600 break-all">{rec.record_value}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm font-medium text-slate-400">No DNS records configured</p>
            )}
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
