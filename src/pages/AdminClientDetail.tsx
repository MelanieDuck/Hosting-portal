import { useEffect, useState } from 'react';
import {
  Globe,
  Server,
  Calendar,
  CreditCard,
  Plus,
  Trash2,
  StickyNote,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  Receipt,
  AlertCircle,
  Save,
} from 'lucide-react';
import {
  supabase,
  type Profile,
  type Subscription,
  type Payment,
  type ClientNote,
} from '@/lib/supabase';
import { Card, CardHeader, Badge, Spinner, Button, Modal, Input, Select, EmptyState } from '@/components/ui';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import { useAuth } from '@/lib/auth';

const statusConfig = {
  succeeded: { variant: 'success' as const, icon: <CheckCircle2 className="w-3 h-3" />, label: 'Succeeded' },
  failed: { variant: 'danger' as const, icon: <XCircle className="w-3 h-3" />, label: 'Failed' },
  pending: { variant: 'warning' as const, icon: <Clock className="w-3 h-3" />, label: 'Pending' },
  refunded: { variant: 'info' as const, icon: <RotateCcw className="w-3 h-3" />, label: 'Refunded' },
};

export function AdminClientDetailPage({ userId }: { userId: string }) {
  const { user: adminUser } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState('');
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [loading, setLoading] = useState(true);

  // Note form
  const [noteContent, setNoteContent] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // One-off payment modal
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDescription, setPaymentDescription] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('succeeded');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [savingPayment, setSavingPayment] = useState(false);

  // Edit subscription modal
  const [subEditOpen, setSubEditOpen] = useState(false);
  const [subStatus, setSubStatus] = useState('active');
  const [subAmount, setSubAmount] = useState('');
  const [subRenewal, setSubRenewal] = useState('');
  const [savingSub, setSavingSub] = useState(false);

  const loadData = async () => {
    const [profileRes, subRes, paymentsRes, notesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('subscriptions').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('payments').select('*').eq('user_id', userId).order('payment_date', { ascending: false }),
      supabase.from('client_notes').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    ]);

    // Fetch email
    const { data: emailData } = await supabase.rpc('get_client_emails');
    const emailEntry = (emailData ?? []).find((r: { id: string }) => r.id === userId);

    setProfile(profileRes.data as Profile | null);
    setEmail(emailEntry?.email ?? '');
    setSubscription(subRes.data as Subscription | null);
    setPayments(paymentsRes.data as Payment[]);
    setNotes(notesRes.data as ClientNote[]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [userId]);

  const handleAddNote = async () => {
    if (!noteContent.trim() || !adminUser) return;
    setSavingNote(true);
    const { error } = await supabase.from('client_notes').insert({
      user_id: userId,
      author_id: adminUser.id,
      content: noteContent.trim(),
    });
    if (!error) {
      setNoteContent('');
      await loadData();
    }
    setSavingNote(false);
  };

  const handleDeleteNote = async (id: string) => {
    await supabase.from('client_notes').delete().eq('id', id);
    await loadData();
  };

  const handleAddPayment = async () => {
    if (!paymentAmount || !paymentDescription) return;
    setSavingPayment(true);
    const { error } = await supabase.from('payments').insert({
      user_id: userId,
      subscription_id: subscription?.id ?? null,
      amount: parseFloat(paymentAmount),
      currency: 'GBP',
      status: paymentStatus,
      payment_date: new Date(paymentDate).toISOString(),
      invoice_number: `OFF-${Date.now().toString().slice(-6)}`,
      payment_method_label: 'Manual entry',
      description: paymentDescription,
      is_one_off: true,
    });
    if (!error) {
      setPaymentOpen(false);
      setPaymentAmount('');
      setPaymentDescription('');
      await loadData();
    }
    setSavingPayment(false);
  };

  const handleSaveSubscription = async () => {
    if (!subscription) return;
    setSavingSub(true);
    const updates: Record<string, unknown> = {
      status: subStatus,
      amount: parseFloat(subAmount) || subscription.amount,
    };
    if (subRenewal) {
      updates.next_payment_date = subRenewal;
    }
    await supabase.from('subscriptions').update(updates).eq('id', subscription.id);
    setSubEditOpen(false);
    await loadData();
    setSavingSub(false);
  };

  const openSubEdit = () => {
    if (subscription) {
      setSubStatus(subscription.status);
      setSubAmount(String(subscription.amount));
      setSubRenewal(subscription.next_payment_date ?? '');
      setSubEditOpen(true);
    }
  };

  if (loading) return <Spinner className="py-20" />;

  if (!profile) {
    return (
      <Card>
        <EmptyState
          icon={<AlertCircle className="w-6 h-6" />}
          title="Client not found"
        />
      </Card>
    );
  }

  const totalPaid = payments
    .filter((p) => p.status === 'succeeded')
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const oneOffTotal = payments
    .filter((p) => p.is_one_off && p.status === 'succeeded')
    .reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      {/* Client header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {profile.full_name || 'Unnamed Client'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">{email}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={openSubEdit}>
            Edit subscription
          </Button>
          <Button size="sm" onClick={() => setPaymentOpen(true)}>
            <Plus className="w-4 h-4" />
            Add one-off payment
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <p className="text-sm text-slate-500">Subscription</p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-lg font-bold text-slate-900 capitalize">
              {subscription?.status || 'None'}
            </p>
            {subscription && (
              <Badge variant={subscription.status === 'active' ? 'success' : 'danger'}>
                {subscription.status === 'active' ? 'Active' : 'Cancelled'}
              </Badge>
            )}
          </div>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">Total paid</p>
          <p className="text-lg font-bold text-slate-900 mt-1">{formatCurrency(totalPaid)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">One-off payments</p>
          <p className="text-lg font-bold text-slate-900 mt-1">{formatCurrency(oneOffTotal)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">Member since</p>
          <p className="text-lg font-bold text-slate-900 mt-1">{formatDate(profile.created_at)}</p>
        </Card>
      </div>

      {/* Contact & hosting info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Contact Details" icon={<Globe className="w-5 h-5" />} />
          <div className="p-6 space-y-4">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Email</p>
              <p className="text-sm font-medium text-slate-900">{email || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Phone</p>
              <p className="text-sm font-medium text-slate-900">{profile.phone || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Company</p>
              <p className="text-sm font-medium text-slate-900">{profile.company_name || '—'}</p>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Hosting Details" icon={<Server className="w-5 h-5" />} />
          <div className="p-6 space-y-4">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Domain</p>
              <a
                href={profile.website_url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-slate-900 hover:text-slate-600 break-all"
              >
                {profile.website_url || '—'}
              </a>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Server</p>
              <p className="text-sm font-medium text-slate-900">{profile.website_server || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">IP Address</p>
              <p className="text-sm font-medium text-slate-900">{profile.website_ip || '—'}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Subscription details */}
      {subscription && (
        <Card>
          <CardHeader
            title="Subscription Details"
            subtitle="Plan and billing information"
            icon={<Calendar className="w-5 h-5" />}
          />
          <div className="p-6 grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Plan</p>
              <p className="text-sm font-semibold text-slate-900">{subscription.plan_name}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Amount</p>
              <p className="text-sm font-semibold text-slate-900">
                {formatCurrency(subscription.amount, subscription.currency)}/mo
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Started</p>
              <p className="text-sm font-semibold text-slate-900">{formatDate(subscription.started_at)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Renewal date</p>
              <p className="text-sm font-semibold text-slate-900">
                {formatDate(subscription.next_payment_date)}
              </p>
            </div>
            {subscription.cancelled_at && (
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Cancelled</p>
                <p className="text-sm font-semibold text-slate-900">{formatDate(subscription.cancelled_at)}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Payment history */}
      <Card>
        <CardHeader
          title="Payment History"
          subtitle="All payments including one-off jobs"
          icon={<Receipt className="w-5 h-5" />}
          action={
            <Button size="sm" variant="outline" onClick={() => setPaymentOpen(true)}>
              <Plus className="w-4 h-4" />
              Add payment
            </Button>
          }
        />
        {payments.length === 0 ? (
          <EmptyState
            icon={<CreditCard className="w-6 h-6" />}
            title="No payments recorded"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide px-6 py-3">Invoice</th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide px-6 py-3">Date</th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide px-6 py-3">Description</th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide px-6 py-3">Type</th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide px-6 py-3">Status</th>
                  <th className="text-right text-xs font-medium text-slate-400 uppercase tracking-wide px-6 py-3">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => {
                  const cfg = statusConfig[payment.status] ?? statusConfig.pending;
                  return (
                    <tr key={payment.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">
                        {payment.invoice_number || '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {formatDate(payment.payment_date)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 max-w-[200px]">
                        {payment.description || '—'}
                        {payment.note && (
                          <p className="text-xs text-slate-400 mt-1">{payment.note}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={payment.is_one_off ? 'info' : 'neutral'}>
                          {payment.is_one_off ? 'One-off' : 'Subscription'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={cfg.variant}>
                          {cfg.icon}
                          {cfg.label}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-semibold text-slate-900">
                        {formatCurrency(payment.amount, payment.currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Notes section */}
      <Card>
        <CardHeader
          title="Notes"
          subtitle="Agreements and details about this client"
          icon={<StickyNote className="w-5 h-5" />}
        />
        <div className="p-6 space-y-4">
          {/* Add note */}
          <div className="flex gap-3">
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Write a note about this client..."
              rows={3}
              className="flex-1 px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent resize-none"
            />
            <Button
              onClick={handleAddNote}
              loading={savingNote}
              disabled={!noteContent.trim()}
              className="self-start"
            >
              <Save className="w-4 h-4" />
              Save
            </Button>
          </div>

          {/* Notes list */}
          {notes.length === 0 ? (
            <EmptyState
              icon={<StickyNote className="w-6 h-6" />}
              title="No notes yet"
              description="Write notes about agreements, special arrangements, or client preferences."
            />
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="flex items-start justify-between p-4 rounded-lg bg-slate-50 border border-slate-100"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-900 whitespace-pre-wrap">{note.content}</p>
                    <p className="text-xs text-slate-400 mt-2">
                      {formatDateTime(note.created_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    className="ml-3 p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Add one-off payment modal */}
      <Modal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        title="Add one-off payment"
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          <Input
            label="Amount (£)"
            type="number"
            step="0.01"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            placeholder="150.00"
          />
          <Input
            label="Description"
            type="text"
            value={paymentDescription}
            onChange={(e) => setPaymentDescription(e.target.value)}
            placeholder="SSL certificate installation"
          />
          <Select
            label="Status"
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
          >
            <option value="succeeded">Succeeded</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </Select>
          <Input
            label="Payment date"
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
          />
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setPaymentOpen(false)}>
              Cancel
            </Button>
            <Button loading={savingPayment} onClick={handleAddPayment}>
              Add payment
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit subscription modal */}
      <Modal
        open={subEditOpen}
        onClose={() => setSubEditOpen(false)}
        title="Edit subscription"
      >
        <div className="space-y-4">
          <Select
            label="Status"
            value={subStatus}
            onChange={(e) => setSubStatus(e.target.value)}
          >
            <option value="active">Active</option>
            <option value="cancelled">Cancelled</option>
            <option value="past_due">Past Due</option>
            <option value="suspended">Suspended</option>
          </Select>
          <Input
            label="Monthly amount (£)"
            type="number"
            step="0.01"
            value={subAmount}
            onChange={(e) => setSubAmount(e.target.value)}
          />
          <Input
            label="Next renewal date"
            type="date"
            value={subRenewal}
            onChange={(e) => setSubRenewal(e.target.value)}
          />
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setSubEditOpen(false)}>
              Cancel
            </Button>
            <Button loading={savingSub} onClick={handleSaveSubscription}>
              Save changes
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
