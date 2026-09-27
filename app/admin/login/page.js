'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }
      router.push('/admin/dashboard');
      router.refresh();
    } catch (e) {
      setError('Network error — please try again');
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      <form className="login-box" onSubmit={handleLogin}>
        <div style={{ fontFamily: "'Rozha One',serif", fontSize: 26 }}>Admin sign-in</div>
        <label>Username</label>
        <input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required />
        <label>Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
        {error && <div className="err" style={{ marginTop: 10 }}>{error}</div>}
        <button className="save-btn" style={{ width: '100%', marginTop: 16 }} disabled={loading}>
          {loading ? 'Signing in…' : 'Log in'}
        </button>
        <a className="back-link" href="/">Back to store</a>
      </form>
    </div>
  );
}
