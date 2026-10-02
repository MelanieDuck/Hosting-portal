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
  Upload,
  FileArchive,
  Download,
  HardDrive,
} from 'lucide-react';
import {
  supabase,
  type Profile,
  type Subscription,
  type Payment,
  type ClientNote,
  type Backup,
  type DnsRecord,
} from '@/lib/supabase';
import { Card, CardHeader, Badge, Spinner, Button, Modal, Input, Select, EmptyState } from '@/components/ui';
import { formatCurrency, formatDate, formatDateTime, formatFileSize } from '@/lib/format';
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
  const [backups, setBackups] = useState<Backup[]>([]);
  const [dnsRecords, setDnsRecords] = useState<DnsRecord[]>([]);
  const [dnsDraft, setDnsDraft] = useState<{ record_type: string; host_name: string; record_value: string }[]>([
    { record_type: 'A', host_name: '@', record_value: '' },
    { record_type: 'CNAME', host_name: 'www', record_value: '' },
  ]);
  const [savingDns, setSavingDns] = useState(false);
  const [loading, setLoading] = useState(true);

  // Backup upload
  const [uploadingBackup, setUploadingBackup] = useState(false);
  const [backupError, setBackupError] = useState('');

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
    const [profileRes, subRes, paymentsRes, notesRes, backupsRes, dnsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('subscriptions').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('payments').select('*').eq('user_id', userId).order('payment_date', { ascending: false }),
      supabase.from('client_notes').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('backups').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('dns_records').select('*').eq('user_id', userId).order('sort_order', { ascending: true }),
    ]);

    // Fetch email
    const { data: emailData } = await supabase.rpc('get_client_emails');
    const emailEntry = (emailData ?? []).find((r: { id: string }) => r.id === userId);

    setProfile(profileRes.data as Profile | null);
    setEmail(emailEntry?.email ?? '');
    setSubscription(subRes.data as Subscription | null);
    setPayments(paymentsRes.data as Payment[]);
    setNotes(notesRes.data as ClientNote[]);
    setBackups(backupsRes.data as Backup[]);
    const fetchedDns = (dnsRes.data ?? []) as DnsRecord[];
    setDnsRecords(fetchedDns);
    if (fetchedDns.length > 0) {
      setDnsDraft(fetchedDns.map((r) => ({ record_type: r.record_type, host_name: r.host_name, record_value: r.record_value })));
    } else {
      setDnsDraft([
        { record_type: 'A', host_name: '@', record_value: '' },
        { record_type: 'CNAME', host_name: 'www', record_value: '' },
      ]);
    }
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

  const handleUploadBackup = async (file: File) => {
    if (!file) return;
    setUploadingBackup(true);
    setBackupError('');
    try {
      const filePath = `${userId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('backups')
        .upload(filePath, file);
      if (uploadError) throw new Error(uploadError.message);

      const { error: dbError } = await supabase.from('backups').insert({
        user_id: userId,
        filename: file.name,
        file_size: file.size,
        storage_path: filePath,
        backup_type: 'full',
      });
      if (dbError) throw new Error(dbError.message);

      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setBackupError(msg);
    } finally {
      setUploadingBackup(false);
    }
  };

  const handleDeleteBackup = async (backup: Backup) => {
    await supabase.storage.from('backups').remove([backup.storage_path]);
    await supabase.from('backups').delete().eq('id', backup.id);
    await loadData();
  };

  const handleDownloadBackup = async (backup: Backup) => {
    const { data, error: dlError } = await supabase.storage
      .from('backups')
      .createSignedUrl(backup.storage_path, 3600);
    if (dlError || !data) return;
    window.open(data.signedUrl, '_blank');
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

  const handleSaveDns = async () => {
    setSavingDns(true);
    await supabase.from('dns_records').delete().eq('user_id', userId);
    const rows = dnsDraft.map((d, i) => ({
      user_id: userId,
      record_type: d.record_type || 'A',
      host_name: d.host_name || '@',
      record_value: d.record_value || '',
      sort_order: i,
    }));
    if (rows.length > 0) {
      await supabase.from('dns_records').insert(rows);
    }
    await loadData();
    setSavingDns(false);
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
          <CardHeader
            title="Hosting Details"
            subtitle="Domain and DNS records for this client"
            icon={<Server className="w-5 h-5" />}
            action={
              <Button size="sm" variant="outline" loading={savingDns} onClick={handleSaveDns}>
                <Save className="w-4 h-4" />
                Save DNS
              </Button>
            }
          />
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
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">DNS Records</p>
              <div className="space-y-2">
                {dnsDraft.map((draft, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <select
                      value={draft.record_type}
                      onChange={(e) => {
                        const next = [...dnsDraft];
                        next[idx] = { ...next[idx], record_type: e.target.value };
                        setDnsDraft(next);
                      }}
                      className="w-20 px-2 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                    >
                      <option value="A">A</option>
                      <option value="CNAME">CNAME</option>
                      <option value="MX">MX</option>
                      <option value="TXT">TXT</option>
                      <option value="AAAA">AAAA</option>
                    </select>
                    <input
                      type="text"
                      value={draft.host_name}
                      onChange={(e) => {
                        const next = [...dnsDraft];
                        next[idx] = { ...next[idx], host_name: e.target.value };
                        setDnsDraft(next);
                      }}
                      placeholder="@ or www"
                      className="w-24 px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                    />
                    <input
                      type="text"
                      value={draft.record_value}
                      onChange={(e) => {
                        const next = [...dnsDraft];
                        next[idx] = { ...next[idx], record_value: e.target.value };
                        setDnsDraft(next);
                      }}
                      placeholder="192.168.1.1 or example.com"
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                    />
                  </div>
                ))}
              </div>
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
  {payment.invoice_url && (
    <a href={payment.invoice_url} target="_blank" rel="noopener noreferrer" className="block text-xs font-medium text-blue-600 hover:text-blue-800 mt-1">
      View invoice
    </a>
  )}
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

      {/* Backups section */}
      <Card>
        <CardHeader
          title="Website Backups"
          subtitle="Upload and manage backup files for this client"
          icon={<HardDrive className="w-5 h-5" />}
        />
        <div className="p-6 space-y-4">
          {backupError && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-700">{backupError}</p>
            </div>
          )}

          {/* Upload area */}
          <div>
            <input
              type="file"
              id="backup-upload"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUploadBackup(file);
                e.target.value = '';
              }}
            />
            <label
              htmlFor="backup-upload"
              className={`flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-slate-300 cursor-pointer hover:border-slate-400 hover:bg-slate-50 transition-all ${uploadingBackup ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <Upload className="w-6 h-6 text-slate-400" />
              <span className="text-sm font-medium text-slate-700">
                {uploadingBackup ? 'Uploading...' : 'Click to upload a backup file'}
              </span>
              <span className="text-xs text-slate-400">
                ZIP, tar.gz, or any archive format
              </span>
            </label>
          </div>

          {/* Existing backups list */}
          {backups.length === 0 ? (
            <EmptyState
              icon={<FileArchive className="w-6 h-6" />}
              title="No backups uploaded yet"
              description="Uploaded backup files will appear here and be available to the client."
            />
          ) : (
            <div className="space-y-2">
              {backups.map((backup) => (
                <div
                  key={backup.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
                      <FileArchive className="w-4 h-4 text-slate-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {backup.filename}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-slate-400">
                          {formatDateTime(backup.created_at)}
                        </p>
                        <span className="text-slate-300">•</span>
                        <p className="text-xs text-slate-400">
                          {formatFileSize(backup.file_size)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleDownloadBackup(backup)}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteBackup(backup)}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
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
