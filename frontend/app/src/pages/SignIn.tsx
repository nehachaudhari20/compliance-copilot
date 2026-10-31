import { useState, type FormEvent } from 'react';
import { api, type Role } from '../lib/api';
import { ROLE_LABELS, useSession } from '../session';
import { ErrorNote } from '../components/ui';

const ROLE_HINTS: Record<Role, string> = {
  compliance_officer: 'Ask questions, check policies, follow changes',
  legal: 'Read regulatory text and compare versions',
  risk: 'Find gaps and high-risk areas',
  executive: 'Short answers and the overall picture',
};

type Mode = 'signin' | 'signup';

export function SignIn() {
  const { signIn } = useSession();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [role, setRole] = useState<Role>('compliance_officer');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const session =
        mode === 'signin'
          ? await api.signIn({ email: email.trim(), password })
          : await api.signUp({
              email: email.trim(),
              password,
              name: name.trim(),
              role,
              organization: organization.trim(),
            });
      signIn({
        token: session.token,
        name: session.name,
        role: session.role,
        organization: session.organization,
        isAdmin: session.is_admin,
      });
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setBusy(false);
    }
  };

  const canSubmit =
    email.trim() &&
    password.length >= (mode === 'signup' ? 8 : 1) &&
    (mode === 'signin' || (name.trim() && organization.trim()));

  return (
    <div className="signin">
      <div className="signin-inner">
        <section className="signin-intro">
          <span className="brand"><span className="logo" aria-hidden="true" />Compliance Copilot</span>
          <h1>Answers from RBI and SEBI regulation, on the record.</h1>
          <p className="lede">Ask a question and see the answer first, with the exact words from the circular that back it up, checked against the source page before you see it.</p>
          <figure className="signin-example" style={{ margin: 0 }} aria-label="Example answer">
            <span className="q">How quickly must a listed company disclose a material event?</span>
            <span className="a">Within <mark>30 minutes</mark> of a board decision, <mark>12 hours</mark> if it arises inside the company, <mark>24 hours</mark> if outside.</span>
            <figcaption className="src">SEBI LODR Master Circular · Annexure 18A · page 236</figcaption>
          </figure>
        </section>

        <form className="signin-form" onSubmit={submit}>
          <div className="signin-tabs" role="tablist" aria-label="Account">
            <button
              type="button"
              className={mode === 'signin' ? 'button primary' : 'button'}
              role="tab"
              aria-selected={mode === 'signin'}
              onClick={() => setMode('signin')}
            >
              Sign in
            </button>
            <button
              type="button"
              className={mode === 'signup' ? 'button primary' : 'button'}
              role="tab"
              aria-selected={mode === 'signup'}
              onClick={() => setMode('signup')}
            >
              Sign up
            </button>
          </div>

          <label className="field">
            <span>Email</span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === 'signup' ? 8 : undefined}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
            {mode === 'signup' && <small>At least 8 characters.</small>}
          </label>

          {mode === 'signup' && (
            <>
              <label className="field">
                <span>Your name</span>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} autoComplete="name" />
                <small>Shown on your answers in the audit trail.</small>
              </label>
              <label className="field">
                <span>Organization</span>
                <input className="input" value={organization} onChange={(e) => setOrganization(e.target.value)} required maxLength={200} autoComplete="organization" />
                <small>Your team’s workspace; the first member becomes the administrator.</small>
              </label>
              <fieldset className="role-options">
                <legend>Your role</legend>
                {(Object.keys(ROLE_LABELS) as Role[]).map((value) => (
                  <label key={value} className="role-option">
                    <input type="radio" name="role" value={value} checked={role === value} onChange={() => setRole(value)} />
                    <strong>{ROLE_LABELS[value]}</strong>
                    <span>{ROLE_HINTS[value]}</span>
                  </label>
                ))}
              </fieldset>
            </>
          )}

          {error && <ErrorNote>{error}</ErrorNote>}
          <button className="button primary" type="submit" disabled={busy || !canSubmit}>
            {busy ? (mode === 'signin' ? 'Signing in…' : 'Creating account…') : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}
