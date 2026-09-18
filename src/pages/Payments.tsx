import { useEffect, useState } from 'react';
import { Receipt, Download, CheckCircle2, XCircle, Clock, RotateCcw } from 'lucide-react';
import { supabase, type Payment } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, Badge, Spinner, EmptyState } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/format';

const statusConfig = {
  succeeded: { variant: 'success' as const, icon: <CheckCircle2 className="w-3 h-3" />, label: 'Succeeded' },
  failed: { variant: 'danger' as const, icon: <XCircle className="w-3 h-3" />, label: 'Failed' },
  pending: { variant: 'warning' as const, icon: <Clock className="w-3 h-3" />, label: 'Pending' },
  refunded: { variant: 'info' as const, icon: <RotateCcw className="w-3 h-3" />, label: 'Refunded' },
};

export function PaymentsPage() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', user.id)
        .order('payment_date', { ascending: false });
      if (!cancelled) {
        setPayments(data as Payment[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) return <Spinner className="py-20" />;

  const totalPaid = payments
    .filter((p) => p.status === 'succeeded')
    .reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Payment History</h1>
        <p className="text-sm text-slate-500 mt-1">
          View all your past payments and invoices
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5">
          <p className="text-sm text-slate-500">Total payments</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{payments.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">Total paid</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {formatCurrency(totalPaid)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">Successful</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">
            {payments.filter((p) => p.status === 'succeeded').length}
          </p>
        </Card>
      </div>

      {/* Payment list */}
      <Card>
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900">All Transactions</h3>
        </div>
        {payments.length === 0 ? (
          <EmptyState
            icon={<Receipt className="w-6 h-6" />}
            title="No payments yet"
            description="Your payment history will appear here once transactions are processed."
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide px-6 py-3">Invoice</th>
                    <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide px-6 py-3">Date</th>
                    <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide px-6 py-3">Method</th>
                    <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide px-6 py-3">Status</th>
                    <th className="text-right text-xs font-medium text-slate-400 uppercase tracking-wide px-6 py-3">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => {
                    const cfg = statusConfig[payment.status] ?? statusConfig.pending;
                    return (
                      <tr
                        key={payment.id}
                        className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-slate-900">
                            {payment.invoice_number || '—'}
                          </p>
                          {payment.description && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              {payment.description}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {formatDate(payment.payment_date)}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {payment.payment_method_label || '—'}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={cfg.variant}>
                            {cfg.icon}
                            {cfg.label}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-semibold text-slate-900">
                            {formatCurrency(payment.amount, payment.currency)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {payments.map((payment) => {
                const cfg = statusConfig[payment.status] ?? statusConfig.pending;
                return (
                  <div key={payment.id} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {payment.invoice_number || 'Payment'}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {formatDate(payment.payment_date)}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-slate-900">
                        {formatCurrency(payment.amount, payment.currency)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">
                        {payment.payment_method_label || '—'}
                      </span>
                      <Badge variant={cfg.variant}>
                        {cfg.icon}
                        {cfg.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
