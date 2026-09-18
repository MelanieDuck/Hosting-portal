import { useEffect, useState } from 'react';
import {
  CreditCard,
  Building2,
  Plus,
  Trash2,
  Star,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { supabase, type PaymentMethod } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  Card,
  CardHeader,
  Button,
  Badge,
  Spinner,
  Modal,
  Input,
  Select,
  EmptyState,
} from '@/components/ui';

export function PaymentMethodsPage() {
  const { user } = useAuth();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [type, setType] = useState<'card' | 'direct_debit'>('card');
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear] = useState('');
  const [ddName, setDdName] = useState('');
  const [ddSortCode, setDdSortCode] = useState('');
  const [ddAccount, setDdAccount] = useState('');
  const [saving, setSaving] = useState(false);

  const loadMethods = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    setMethods(data as PaymentMethod[]);
    setLoading(false);
  };

  useEffect(() => {
    loadMethods();
  }, [user]);

  const detectBrand = (num: string): string => {
    const clean = num.replace(/\s/g, '');
    if (clean.startsWith('4')) return 'Visa';
    if (clean.startsWith('5') || clean.startsWith('2')) return 'Mastercard';
    if (clean.startsWith('3')) return 'American Express';
    return 'Card';
  };

  const handleAdd = async () => {
    setError('');
    setSaving(true);
    try {
      if (!user) return;

      let label: string;
      let brand: string | null = null;
      let last4: string | null = null;
      let sortCodeMasked: string | null = null;

      if (type === 'card') {
        const clean = cardNumber.replace(/\s/g, '');
        if (clean.length < 16) {
          setError('Please enter a valid 16-digit card number');
          setSaving(false);
          return;
        }
        last4 = clean.slice(-4);
        brand = detectBrand(clean);
        label = `${brand} ending ${last4}`;
      } else {
        if (!ddName || !ddSortCode || !ddAccount) {
          setError('Please fill in all direct debit fields');
          setSaving(false);
          return;
        }
        // Mask sort code: show only last 2 digits
        const sc = ddSortCode.replace(/[-\s]/g, '');
        sortCodeMasked = `XX-XX-${sc.slice(-2)}`;
        label = `Direct Debit (${ddAccount.replace(/\d(?=\d{2})/g, 'X')})`;
      }

      // Unset previous defaults
      if (methods.length === 0) {
        // First method becomes default
      }

      const { error: insertError } = await supabase
        .from('payment_methods')
        .insert({
          user_id: user.id,
          type,
          label,
          brand,
          last4,
          expiry_month: expiryMonth ? parseInt(expiryMonth) : null,
          expiry_year: expiryYear ? parseInt(expiryYear) : null,
          account_name: type === 'direct_debit' ? ddName : null,
          sort_code_masked: sortCodeMasked,
          is_default: methods.length === 0,
        });

      if (insertError) throw insertError;

      // Reset form
      setCardNumber('');
      setCardName('');
      setExpiryMonth('');
      setExpiryYear('');
      setDdName('');
      setDdSortCode('');
      setDdAccount('');
      setAddOpen(false);
      setSuccess('Payment method added successfully');
      setTimeout(() => setSuccess(''), 3000);
      await loadMethods();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to add payment method';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    if (!user) return;
    // Unset all defaults
    await supabase
      .from('payment_methods')
      .update({ is_default: false })
      .eq('user_id', user.id);
    // Set the new default
    await supabase
      .from('payment_methods')
      .update({ is_default: true })
      .eq('id', id);
    await loadMethods();
  };

  const handleDelete = async () => {
    if (!deleteId || !user) return;
    await supabase.from('payment_methods').delete().eq('id', deleteId);
    setDeleteId(null);
    await loadMethods();
  };

  const formatCardInput = (value: string) => {
    return value
      .replace(/\s/g, '')
      .replace(/(\d{4})/g, '$1 ')
      .trim()
      .slice(0, 19);
  };

  if (loading) return <Spinner className="py-20" />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payment Methods</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your card and direct debit details
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} size="sm">
          <Plus className="w-4 h-4" />
          Add method
        </Button>
      </div>

      {success && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <p className="text-sm text-emerald-700">{success}</p>
        </div>
      )}

      {methods.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CreditCard className="w-6 h-6" />}
            title="No payment methods"
            description="Add a card or set up direct debit to manage your subscription payments."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {methods.map((method) => (
            <Card key={method.id} className="overflow-hidden">
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                      {method.type === 'card' ? (
                        <CreditCard className="w-5 h-5 text-slate-600" />
                      ) : (
                        <Building2 className="w-5 h-5 text-slate-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {method.label}
                      </p>
                      <p className="text-xs text-slate-400 capitalize mt-0.5">
                        {method.type === 'card' ? 'Card' : 'Direct Debit'}
                      </p>
                    </div>
                  </div>
                  {method.is_default && (
                    <Badge variant="success">
                      <Star className="w-3 h-3" />
                      Default
                    </Badge>
                  )}
                </div>

                {method.type === 'card' && (
                  <div className="space-y-1 text-sm text-slate-500">
                    {method.brand && <p>Brand: {method.brand}</p>}
                    {method.last4 && <p>Last 4 digits: {method.last4}</p>}
                    {method.expiry_month && method.expiry_year && (
                      <p>
                        Expires: {String(method.expiry_month).padStart(2, '0')}/
                        {String(method.expiry_year).slice(-2)}
                      </p>
                    )}
                  </div>
                )}
                {method.type === 'direct_debit' && (
                  <div className="space-y-1 text-sm text-slate-500">
                    {method.account_name && <p>Account: {method.account_name}</p>}
                    {method.sort_code_masked && <p>Sort code: {method.sort_code_masked}</p>}
                  </div>
                )}

                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100">
                  {!method.is_default && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetDefault(method.id)}
                    >
                      Set as default
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteId(method.id)}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add method modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add payment method"
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
            <button
              onClick={() => setType('card')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all ${
                type === 'card'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              Card
            </button>
            <button
              onClick={() => setType('direct_debit')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all ${
                type === 'direct_debit'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Building2 className="w-4 h-4" />
              Direct Debit
            </button>
          </div>

          {type === 'card' ? (
            <>
              <Input
                label="Card number"
                type="text"
                inputMode="numeric"
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCardInput(e.target.value))}
                placeholder="4242 4242 4242 4242"
              />
              <Input
                label="Name on card"
                type="text"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                placeholder="Jane Smith"
              />
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Expiry month"
                  value={expiryMonth}
                  onChange={(e) => setExpiryMonth(e.target.value)}
                >
                  <option value="">Month</option>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {String(i + 1).padStart(2, '0')}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Expiry year"
                  value={expiryYear}
                  onChange={(e) => setExpiryYear(e.target.value)}
                >
                  <option value="">Year</option>
                  {Array.from({ length: 10 }, (_, i) => {
                    const y = new Date().getFullYear() + i;
                    return (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    );
                  })}
                </Select>
              </div>
            </>
          ) : (
            <>
              <Input
                label="Account holder name"
                type="text"
                value={ddName}
                onChange={(e) => setDdName(e.target.value)}
                placeholder="Jane Smith"
              />
              <Input
                label="Sort code"
                type="text"
                value={ddSortCode}
                onChange={(e) => setDdSortCode(e.target.value)}
                placeholder="12-34-56"
              />
              <Input
                label="Account number"
                type="text"
                inputMode="numeric"
                value={ddAccount}
                onChange={(e) => setDdAccount(e.target.value)}
                placeholder="12345678"
              />
            </>
          )}

          <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
            <AlertTriangle className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-slate-500">
              Only the last 4 digits of your card and masked account details are stored. Full card numbers are never saved.
            </p>
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={handleAdd}>
              Save payment method
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Remove payment method"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to remove this payment method? This action cannot be undone.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Remove
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
