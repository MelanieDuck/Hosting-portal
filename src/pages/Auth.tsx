import { useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button, Input } from '@/components/ui';
import { Logo } from '@/components/Logo';

type Mode = 'login' | 'signup';

export function AuthPage({ mode }: { mode: Mode }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (signUpError) throw signUpError;
        setSuccess(true);
      } else {
        const { error: signInError } =
          await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setError(
        msg.includes('Invalid login')
          ? 'Incorrect email or password'
          : msg.includes('already registered')
            ? 'An account with this email already exists'
            : msg,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResetRequest = async (e: FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetLoading(true);
    try {
      // No hash path here on purpose — the app listens for Supabase's
      // PASSWORD_RECOVERY event directly, rather than a dedicated hash route,
      // to avoid clashing with the app's own hash-based routing.
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: window.location.origin,
      });
      if (resetErr) throw resetErr;
      setResetSent(true);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Failed to send reset email');
    } finally {
      setResetLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
            <Logo className="w-14 h-14 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-slate-900 mb-2">
              Account created
            </h1>
            <p className="text-sm text-slate-600">
              Your account has been set up. Please sign in to access your hosting
              portal.
            </p>
            <a
              href="/login"
              className="inline-block mt-6 text-sm font-medium text-slate-900 underline hover:no-underline"
            >
              Go to sign in
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Forgot password: request screen
  if (showForgotPassword) {
    if (resetSent) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 mb-2">Check your email</h1>
              <p className="text-sm text-slate-600">
                If an account exists for {resetEmail}, we've sent a link to reset your password.
              </p>
              <button
                onClick={() => {
                  setShowForgotPassword(false);
                  setResetSent(false);
                  setResetEmail('');
                }}
                className="inline-block mt-6 text-sm font-medium text-slate-900 underline hover:no-underline"
              >
                Back to sign in
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="flex flex-col items-center mb-8">
            <Logo className="w-14 h-14 mb-4" />
            <h1 className="text-2xl font-bold text-slate-900">Reset your password</h1>
            <p className="text-sm text-slate-500 mt-1">
              Enter your email and we'll send you a reset link
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
            <form onSubmit={handleResetRequest} className="space-y-4">
              <Input
                label="Email"
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
              />

              {resetError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{resetError}</p>
                </div>
              )}

              <Button type="submit" loading={resetLoading} className="w-full" size="lg">
                Send reset link
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => setShowForgotPassword(false)}
                className="text-sm font-medium text-slate-900 underline hover:no-underline"
              >
                Back to sign in
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="flex flex-col items-center mb-8">
          <Logo className="w-14 h-14 mb-4" />
          <h1 className="text-2xl font-bold text-slate-900">
            {mode === 'login' ? 'Client Portal' : 'Create account'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {mode === 'login'
              ? 'Sign in to manage your hosting subscription'
              : 'Sign up to access your hosting dashboard'}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <Input
                label="Full name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Smith"
                required
              />
            )}
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
            />

            {mode === 'login' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm font-medium text-slate-500 hover:text-slate-900"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full" size="lg">
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500">
              {mode === 'login' ? (
                <>
                  Don't have an account?{' '}
                  <a
                    href="/signup"
                    className="font-medium text-slate-900 underline hover:no-underline"
                  >
                    Sign up
                  </a>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <a
                    href="/login"
                    className="font-medium text-slate-900 underline hover:no-underline"
                  >
                    Sign in
                  </a>
                </>
              )}
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Secure client portal for hosting service management
        </p>
      </div>
    </div>
  );
}
