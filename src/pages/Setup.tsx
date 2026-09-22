import { useEffect, useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  CreditCard,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { supabase, type PendingClient, type InviteToken } from '@/lib/supabase';
import { Button, Input } from '@/components/ui';
import { Logo } from '@/components/Logo';

const STRIPE_PRICE_ID = import.meta.env.VITE_STRIPE_PRICE_ID ?? '';

type TokenState = 'checking' | 'valid' | 'invalid' | 'expired' | 'used';
type SetupStep = 'checkout' | 'password' | 'activating' | 'done' | 'error';

export function SetupPage() {
  const [tokenState, setTokenState] = useState<TokenState>('checking');
  const [client, setClient] = useState<PendingClient | null>(null);
  const [token, setToken] = useState<InviteToken | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [step, setStep] = useState<SetupStep>('checkout');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [activationError, setActivationError] = useState('');

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const queryStart = hash.indexOf('?');
    const params = queryStart >= 0
      ? new URLSearchParams(hash.slice(queryStart + 1))
      : new URLSearchParams();
    const tokenParam = params.get('token');
    const statusParam = params.get('status');

    if (!tokenParam) {
      setTokenState('invalid');
      return;
    }

    validateToken(tokenParam, statusParam);
  }, []);

  const validateToken = async (tokenValue: string, status?: string | null) => {
    try {
      const { data, error } = await supabase
        .rpc('validate_invite_token', { p_token: tokenValue })
        .maybeSingle();

      const result = data as {
        token_valid: boolean;
        token_used: boolean;
        token_expired: boolean;
        client_id: string;
        full_name: string;
        email: string;
        notes: string | null;
      } | null;

      if (error || !result || !result.token_valid) {
        setTokenState('invalid');
        return;
      }

      if (result.token_used && status !== 'success') {
        setTokenState('used');
        return;
      }

      if (result.token_expired) {
        setTokenState('expired');
        return;
      }

      setClient({
        id: result.client_id,
        full_name: result.full_name,
        email: result.email,
        notes: result.notes,
      } as PendingClient);
      setToken({ token: tokenValue } as InviteToken);
      setTokenState('valid');

      // If returning from Stripe with status=success, jump to password step
      if (status === 'success') {
        setStep('password');
      }
    } catch {
      setTokenState('invalid');
    }
  };

  const handleCheckout = async () => {
    if (!client || !token) return;
    setRedirecting(true);
    setCheckoutError('');
    try {
      if (!STRIPE_PRICE_ID) {
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
               'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            price_id: STRIPE_PRICE_ID,
            success_url: `${origin}/#/setup?token=${token.token}&status=success`,
            cancel_url: `${origin}/#/setup?token=${token.token}`,
            mode: 'subscription',
            pending_client_id: client.id,
            invite_token: token.token,
          }),
        },
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to start checkout');
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start checkout';
      setCheckoutError(msg);
    } finally {
      setRedirecting(false);
    }
  };

  const handleSetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!client || !token) return;
    setActivationError('');

    if (password.length < 6) {
      setActivationError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setActivationError('Passwords do not match.');
      return;
    }

    setStep('activating');

    try {
      // 1. Create the auth account
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: client.email,
        password,
        options: { data: { full_name: client.full_name } },
      });

      if (signUpError) {
        throw new Error(
          signUpError.message.includes('already registered')
            ? 'An account with this email already exists. Please sign in.'
            : signUpError.message,
        );
      }

      // 2. Activate: wire up Stripe customer + subscription + payment records
      const { error: activateError } = await supabase
        .rpc('activate_pending_client', { p_email: client.email });

      if (activateError) {
        console.error('Activation failed:', activateError);
        throw new Error('Your account was created but we could not link your subscription. Please contact support.');
      }

      setStep('done');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong during activation';
      setActivationError(msg);
      setStep('error');
    }
  };

  // Checking token state
  if (tokenState === 'checking') {
    return (
      <SetupShell>
        <div className="flex flex-col items-center py-12">
          <Loader2 className="w-8 h-8 text-slate-400 animate-spin mb-4" />
          <p className="text-sm text-slate-500">Verifying your invite link...</p>
        </div>
      </SetupShell>
    );
  }

  // Invalid token
  if (tokenState === 'invalid') {
    return (
      <SetupShell>
        <ErrorCard
          icon={<XCircle className="w-8 h-8 text-red-500" />}
          title="This link isn't valid"
          message="We couldn't find a matching invite. Please check that you copied the full link, or contact us for a new one."
        />
      </SetupShell>
    );
  }

  // Expired token
  if (tokenState === 'expired') {
    return (
      <SetupShell>
        <ErrorCard
          icon={<Clock className="w-8 h-8 text-amber-500" />}
          title="This link has expired"
          message="For security, invite links expire after 7 days. Please contact us and we'll send you a new one."
        />
      </SetupShell>
    );
  }

  // Already used token
  if (tokenState === 'used') {
    return (
      <SetupShell>
        <ErrorCard
          icon={<CheckCircle2 className="w-8 h-8 text-slate-400" />}
          title="This link has already been used"
          message="Your account setup is already complete. Please sign in to access your hosting portal."
        >
          <a
            href="/#/login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            Go to sign in
            <ArrowRight className="w-4 h-4" />
          </a>
        </ErrorCard>
      </SetupShell>
    );
  }

  // --- DONE step: account activated, redirect to login ---
  if (step === 'done') {
    return (
      <SetupShell>
        <div className="text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Your account is ready</h1>
            <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
              Your subscription is active and your first payment has been recorded.
              Sign in to access your hosting portal.
            </p>
          </div>
          <a
            href="/#/login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            Sign in to your portal
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </SetupShell>
    );
  }

  // --- PASSWORD step: set password after returning from Stripe ---
  if (step === 'password' || step === 'activating' || step === 'error') {
    return (
      <SetupShell>
        <div className="space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">
              Payment complete — set your password
            </h1>
            <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
              Your payment was successful. Now create a password to access your hosting portal.
              {client?.email && (
                <>
                  <br />
                  <span className="font-medium text-slate-700">{client.email}</span>
                </>
              )}
            </p>
          </div>

          {activationError && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{activationError}</p>
            </div>
          )}

          <form onSubmit={handleSetPassword} className="space-y-4">
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              autoFocus
            />
            <Input
              label="Confirm password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="•••••••••"
              required
              minLength={6}
            />

            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={step === 'activating'}
            >
              {step === 'activating' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Activating your account...
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  Create account & activate
                </>
              )}
            </Button>
          </form>

          {step === 'error' && (
            <p className="text-center text-sm text-slate-500">
              You can try again, or{' '}
              <a href="/#/login" className="font-medium text-slate-900 underline hover:no-underline">
                sign in
              </a>{' '}
              if you already have an account.
            </p>
          )}
        </div>
      </SetupShell>
    );
  }

  // --- CHECKOUT step: initial landing, show welcome + checkout button ---
  const firstName = client?.full_name?.split(' ')[0] || 'there';

  return (
    <SetupShell>
      <div className="space-y-6">
        {/* Welcome header */}
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-8 h-8 text-slate-700" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            Hi {firstName}, let's get your hosting subscription set up
          </h1>
          <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
            {client?.email && (
              <>
                Confirming email: <span className="font-medium text-slate-700">{client.email}</span>
                <br />
              </>
            )}
            You'll be redirected to Stripe's secure checkout to add your payment details.
            Your card or Direct Debit will be set up for monthly billing.
          </p>
        </div>

        {/* What happens next */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">What happens next</h2>
          <div className="space-y-3">
            <Step
              num={1}
              title="Click 'Set Up Payment'"
              description="You'll be redirected to Stripe's secure checkout page."
            />
            <Step
              num={2}
              title="Enter your payment details"
              description="Add a card or set up Direct Debit. Your details are handled securely by Stripe."
            />
            <Step
              num={3}
              title="Set your password"
              description="After payment, you'll set a password to access your hosting portal."
            />
          </div>
        </div>

        {/* Checkout error */}
        {checkoutError && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-900">Checkout failed</p>
              <p className="text-sm text-red-700 mt-0.5">{checkoutError}</p>
            </div>
          </div>
        )}

        {/* Action button */}
        <div className="flex flex-col items-center gap-3">
          <Button
            size="lg"
            onClick={handleCheckout}
            disabled={redirecting}
            className="w-full sm:w-auto"
          >
            {redirecting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Redirecting to Stripe...
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5" />
                Set Up Payment
              </>
            )}
          </Button>
          <p className="text-xs text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Secured by Stripe
          </p>
        </div>

        {/* Notes from admin */}
        {client?.notes && (
          <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
            <p className="text-xs font-medium text-blue-900 uppercase tracking-wide mb-1">
              Note from your host
            </p>
            <p className="text-sm text-blue-800">{client.notes}</p>
          </div>
        )}
      </div>
    </SetupShell>
  );
}

function SetupShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <div className="flex flex-col items-center mb-6">
          <Logo className="w-12 h-12 mb-3" />
          <p className="text-xs text-slate-400">HostPortal Client Setup</p>
        </div>
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          {children}
        </div>
      </div>
    </div>
  );
}

function ErrorCard({
  icon,
  title,
  message,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="text-center space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto">
        {icon}
      </div>
      <h1 className="text-xl font-bold text-slate-900">{title}</h1>
      <p className="text-sm text-slate-500 max-w-sm mx-auto">{message}</p>
      {children && <div className="pt-2">{children}</div>}
    </div>
  );
}

function Step({
  num,
  title,
  description,
}: {
  num: number;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-900 text-white text-sm font-semibold flex items-center justify-center">
        {num}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-900">{title}</p>
        <p className="text-sm text-slate-500 mt-0.5">{description}</p>
      </div>
    </div>
  );
}
