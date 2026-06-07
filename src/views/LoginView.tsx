import { useState } from 'react';

interface LoginViewProps {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
}

export function LoginView({ onSignIn, onSignUp }: LoginViewProps) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      if (mode === 'sign-in') {
        await onSignIn(email, password);
      } else {
        await onSignUp(email, password);
        setMessage('Account created. Check your email to confirm, then sign in.');
        setMode('sign-in');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-[15px] font-medium tracking-tight">MyNvoice</h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            {mode === 'sign-in' ? 'Sign in to your account' : 'Create an account'}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-[13px] text-muted-foreground mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-3 py-2 text-[13px] border border-border rounded bg-background outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-[13px] text-muted-foreground mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              className="w-full px-3 py-2 text-[13px] border border-border rounded bg-background outline-none focus:border-primary"
            />
          </div>

          {error && <p className="text-[13px] text-destructive">{error}</p>}
          {message && <p className="text-[13px] text-[#34C759]">{message}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-9 text-[13px] bg-primary text-primary-foreground rounded hover:opacity-90 font-medium disabled:opacity-50"
          >
            {submitting ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
            setError(null);
            setMessage(null);
          }}
          className="mt-4 text-[13px] text-muted-foreground hover:text-foreground"
        >
          {mode === 'sign-in' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}
