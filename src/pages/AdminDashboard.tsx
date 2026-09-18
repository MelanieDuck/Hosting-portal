import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Users,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronRight,
  UserPlus,
  Copy,
  RefreshCw,
  Clock,
  Mail,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import {
  supabase,
  type Profile,
  type Subscription,
  type Payment,
  type PendingClient,
  type InviteToken,
} from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, Badge, Spinner, EmptyState, Button, Modal, Input } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/format';

type ClientRow = {
  profile: Profile;
  email: string;
  subscription: Subscription | null;
  lastPayment: Payment | null;
  firstPayment: Payment | null;
};

type PendingRow = {
  client: PendingClient;
  token: InviteToken | null;
};

export function AdminDashboardPage({
  onSelectClient,
}: {
  onSelectClient: (userId: string) => void;
}) {
  const { user } = useAuth();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [pendingClients, setPendingClients] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Add client modal
  const [addOpen, setAddOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  // Success modal with invite link
  const [successOpen, setSuccessOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);

  // Copy feedback per-row
  const [copiedRow, setCopiedRow] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [profilesRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('is_admin', false)
        .order('created_at', { ascending: false }),
    ]);

    const profiles = (profilesRes.data ?? []) as Profile[];

    // Fetch all client emails via admin-only RPC
    const { data: emailData } = await supabase.rpc('get_client_emails');
    const emailMap = new Map<string, string>(
      (emailData ?? []).map((r: { id: string; email: string }) => [r.id, r.email]),
    );

    const rows: ClientRow[] = [];
    for (const profile of profiles) {
      const [subRes, paymentsRes] = await Promise.all([
        supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })
          .maybeSingle(),
        supabase
          .from('payments')
          .select('*')
          .eq('user_id', profile.id)
          .order('payment_date', { ascending: false }),
      ]);

      const payments = (paymentsRes.data ?? []) as Payment[];
      const lastPayment = payments.length > 0 ? payments[0] : null;
      const firstPayment = payments.length > 0 ? payments[payments.length - 1] : null;

      rows.push({
        profile,
        email: emailMap.get(profile.id) ?? '',
        subscription: subRes.data as Subscription | null,
        lastPayment,
        firstPayment,
      });
    }
    setClients(rows);

    // Load pending clients + their tokens
    const { data: pendingData } = await supabase
      .from('pending_clients')
      .select('*')
      .in('status', ['pending', 'invited'])
      .order('created_at', { ascending: false });

    const pending = (pendingData ?? []) as PendingClient[];
    const pendingRows: PendingRow[] = [];
    for (const pc of pending) {
      const { data: tokenData } = await supabase
        .from('invite_tokens')
        .select('*')
        .eq('client_id', pc.id)
        .is('used_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      pendingRows.push({ client: pc, token: tokenData as InviteToken | null });
    }
    setPendingClients(pendingRows);

    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    if (!search) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      (c) =>
        c.profile.full_name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.profile.company_name?.toLowerCase().includes(q) ||
        c.profile.website_url?.toLowerCase().includes(q),
    );
  }, [clients, search]);

  const filteredPending = useMemo(() => {
    if (!search) return pendingClients;
    const q = search.toLowerCase();
    return pendingClients.filter(
      (p) =>
        p.client.full_name?.toLowerCase().includes(q) ||
        p.client.email?.toLowerCase().includes(q),
    );
  }, [pendingClients, search]);

  const buildInviteLink = (token: string) => {
    const origin = window.location.origin;
    return `${origin}/#/setup?token=${token}`;
  };

  const handleAddClient = async () => {
    if (!formName.trim() || !formEmail.trim() || !user) return;
    setAdding(true);
    setAddError('');
    try {
      const { data: clientData, error: clientError } = await supabase
        .from('pending_clients')
        .insert({
          full_name: formName.trim(),
          email: formEmail.trim(),
          notes: formNotes.trim() || null,
          status: 'invited',
          created_by: user.id,
        })
        .select()
        .single();

      if (clientError) throw clientError;

      const { data: tokenData, error: tokenError } = await supabase
        .from('invite_tokens')
        .insert({
          client_id: (clientData as PendingClient).id,
          created_by: user.id,
        })
        .select()
        .single();

      if (tokenError) throw tokenError;

      const link = buildInviteLink((tokenData as InviteToken).token);
      setInviteLink(link);
      setSuccessOpen(true);
      setAddOpen(false);
      setFormName('');
      setFormEmail('');
      setFormNotes('');
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to add client';
      setAddError(msg);
    } finally {
      setAdding(false);
    }
  };

  const handleCopy = async (text: string, rowId?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      if (rowId) {
        setCopiedRow(rowId);
        setTimeout(() => setCopiedRow(null), 2000);
      } else {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Fallback for browsers without clipboard API
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      if (rowId) {
        setCopiedRow(rowId);
        setTimeout(() => setCopiedRow(null), 2000);
      } else {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  const handleRegenerateToken = async (clientId: string) => {
    if (!user) return;
    // Expire old tokens by setting used_at (they're not actually used, but this invalidates them)
    await supabase
      .from('invite_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('client_id', clientId)
      .is('used_at', null);

    // Create a new token
    const { data: tokenData, error } = await supabase
      .from('invite_tokens')
      .insert({
        client_id: clientId,
        created_by: user.id,
      })
      .select()
      .single();

    if (!error && tokenData) {
      const link = buildInviteLink((tokenData as InviteToken).token);
      setInviteLink(link);
      setSuccessOpen(true);
      await loadData();
    }
  };

  if (loading) return <Spinner className="py-20" />;

  const activeCount = clients.filter((c) => c.subscription?.status === 'active').length;
  const cancelledCount = clients.filter((c) => c.subscription?.status === 'cancelled').length;
  const failedLastPayment = clients.filter((c) => c.lastPayment?.status === 'failed').length;
  const pendingCount = pendingClients.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Client List</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage all your hosting clients and their subscriptions
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <UserPlus className="w-4 h-4" />
          Add Client
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Total clients</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{clients.length}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Active</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600">{activeCount}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Pending</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Cancelled</span>
            <XCircle className="w-4 h-4 text-red-400" />
          </div>
          <p className="text-2xl font-bold text-red-500">{cancelledCount}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Failed payments</span>
            <AlertCircle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-600">{failedLastPayment}</p>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name, email, company, or domain..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
        />
      </div>

      {/* Pending clients section */}
      {filteredPending.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
            Pending Invitations
          </h2>
          {filteredPending.map((row) => {
            const link = row.token ? buildInviteLink(row.token.token) : '';
            const isExpired = row.token
              ? new Date(row.token.expires_at).getTime() < Date.now()
              : false;
            return (
              <Card key={row.client.id} className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-900">
                          {row.client.full_name}
                        </p>
                        <Badge variant="warning">
                          <Clock className="w-3 h-3" />
                          Pending
                        </Badge>
                        {isExpired && (
                          <Badge variant="danger">Expired</Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {row.client.email}
                        {row.token && !isExpired && (
                          <span className="ml-2">
                            Expires {formatDate(row.token.expires_at)}
                          </span>
                        )}
                      </p>
                      {row.client.notes && (
                        <p className="text-xs text-slate-400 mt-1 max-w-md truncate">
                          {row.client.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {link && !isExpired && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(link, row.client.id)}
                      >
                        {copiedRow === row.client.id ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copy Invite Link
                          </>
                        )}
                      </Button>
                    )}
                    {(isExpired || !link) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRegenerateToken(row.client.id)}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Regenerate Link
                      </Button>
                    )}
                    {link && isExpired && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(link, row.client.id)}
                      >
                        {copiedRow === row.client.id ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copy Old Link
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Active/cancelled client list */}
      {filtered.length === 0 && filteredPending.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users className="w-6 h-6" />}
            title="No clients found"
            description={search ? 'No clients match your search.' : 'Clients will appear here when they sign up.'}
          />
        </Card>
      ) : filtered.length > 0 ? (
        <Card className="overflow-hidden">
          {/* Desktop table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide px-6 py-3">Client</th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide px-6 py-3">Domain</th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide px-6 py-3">Hosting</th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide px-6 py-3">Subscription</th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide px-6 py-3">Last Payment</th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide px-6 py-3">Since</th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide px-6 py-3">Renewal</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((client) => (
                  <tr
                    key={client.profile.id}
                    onClick={() => onSelectClient(client.profile.id)}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-slate-900">
                        {client.profile.full_name || 'Unnamed'}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{client.email || '—'}</p>
                      {client.profile.phone && (
                        <p className="text-xs text-slate-400 mt-0.5">{client.profile.phone}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-700 truncate max-w-[160px]">
                        {client.profile.website_url || '—'}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-700">
                        {client.profile.website_server || '—'}
                      </p>
                      {client.profile.website_ip && (
                        <p className="text-xs text-slate-400 mt-0.5">{client.profile.website_ip}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {client.subscription ? (
                        <div className="flex flex-col gap-1">
                          <Badge variant={client.subscription.status === 'active' ? 'success' : 'danger'}>
                            {client.subscription.status === 'active' ? 'Active' : 'Cancelled'}
                          </Badge>
                          <span className="text-xs text-slate-400">
                            {formatCurrency(client.subscription.amount, client.subscription.currency)}/mo
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">No plan</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {client.lastPayment ? (
                        <div className="flex flex-col gap-1">
                          <Badge variant={client.lastPayment.status === 'succeeded' ? 'success' : client.lastPayment.status === 'failed' ? 'danger' : 'warning'}>
                            {client.lastPayment.status}
                          </Badge>
                          <span className="text-xs text-slate-400">
                            {formatDate(client.lastPayment.payment_date)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">No payments</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-700">
                        {client.firstPayment ? formatDate(client.firstPayment.payment_date) : '—'}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Joined {formatDate(client.profile.created_at)}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-700">
                        {client.subscription?.next_payment_date
                          ? formatDate(client.subscription.next_payment_date)
                          : '—'}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <ChevronRight className="w-5 h-5 text-slate-300" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden divide-y divide-slate-100">
            {filtered.map((client) => (
              <div
                key={client.profile.id}
                onClick={() => onSelectClient(client.profile.id)}
                className="p-4 cursor-pointer hover:bg-slate-50/50"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {client.profile.full_name || 'Unnamed'}
                    </p>
                    <p className="text-xs text-slate-400">{client.email || '—'}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {client.subscription && (
                    <Badge variant={client.subscription.status === 'active' ? 'success' : 'danger'}>
                      {client.subscription.status === 'active' ? 'Active' : 'Cancelled'}
                    </Badge>
                  )}
                  {client.lastPayment && (
                    <Badge variant={client.lastPayment.status === 'succeeded' ? 'success' : 'danger'}>
                      Last: {client.lastPayment.status}
                    </Badge>
                  )}
                  <span className="text-xs text-slate-400">
                    {client.profile.website_url || 'No domain'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {/* Add Client Modal */}
      <Modal
        open={addOpen}
        onClose={() => { setAddOpen(false); setAddError(''); }}
        title="Add New Client"
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Create a client record and generate a secure invite link. No login is created
            yet — the client will set up their own account using the link.
          </p>
          <Input
            label="Client Name"
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="John Smith"
          />
          <Input
            label="Email"
            type="email"
            value={formEmail}
            onChange={(e) => setFormEmail(e.target.value)}
            placeholder="john@example.com"
          />
          <div className="w-full">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Notes (optional)
            </label>
            <textarea
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Any notes about this client..."
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent resize-none"
            />
          </div>
          {addError && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-700">{addError}</p>
            </div>
          )}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => { setAddOpen(false); setAddError(''); }}>
              Cancel
            </Button>
            <Button
              loading={adding}
              disabled={!formName.trim() || !formEmail.trim()}
              onClick={handleAddClient}
            >
              <UserPlus className="w-4 h-4" />
              Add Client & Generate Link
            </Button>
          </div>
        </div>
      </Modal>

      {/* Invite Link Success Modal */}
      <Modal
        open={successOpen}
        onClose={() => setSuccessOpen(false)}
        title="Client Added"
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-50 border border-emerald-200">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-emerald-900">
                Client created successfully
              </p>
              <p className="text-sm text-emerald-700 mt-0.5">
                Share this secure invite link with your client so they can complete their account setup.
              </p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Invite Link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={inviteLink}
                className="flex-1 px-3.5 py-2.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-900 text-sm font-mono"
              />
              <Button onClick={() => handleCopy(inviteLink)} disabled={copied}>
                {copied ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy Link
                  </>
                )}
              </Button>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
            <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              This link expires in 7 days. The client must use it to set up their account
              before it expires. You can regenerate it from the client list if needed.
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setSuccessOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
