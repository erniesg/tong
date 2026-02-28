'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  clearStoredDemoPassword,
  getStoredDemoPassword,
  setStoredDemoPassword,
} from '@/lib/api';

const HINT_TEXT =
  process.env.NEXT_PUBLIC_TONG_DEMO_PASSWORD_HINT ||
  'Ask the Tong team for the demo password.';

function maskPassword(value: string) {
  if (!value) return '';
  if (value.length <= 3) return '***';
  return `${'*'.repeat(Math.max(1, value.length - 3))}${value.slice(-3)}`;
}

export default function DemoPasswordBar() {
  const pathname = usePathname();
  const [input, setInput] = useState('');
  const [savedPassword, setSavedPassword] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = (params.get('demo') || '').trim();
    if (fromQuery) {
      setStoredDemoPassword(fromQuery);
      params.delete('demo');
      const query = params.toString();
      const cleanUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
      window.history.replaceState({}, '', cleanUrl);
    }

    const existing = getStoredDemoPassword();
    setSavedPassword(existing);
    setInput(existing);
  }, []);

  const statusText = useMemo(() => {
    if (!savedPassword) return 'Locked';
    return `Unlocked (${maskPassword(savedPassword)})`;
  }, [savedPassword]);

  function savePassword() {
    setStoredDemoPassword(input);
    const current = getStoredDemoPassword();
    setSavedPassword(current);
    setInput(current);
  }

  function clearPassword() {
    clearStoredDemoPassword();
    setSavedPassword('');
    setInput('');
  }

  /* Hide the bar on the immersive game page and root redirect */
  if (pathname === '/game' || pathname === '/') return null;

  return (
    <div className="demo-access-bar">
      <div className="demo-access-row">
        <strong>Demo Access</strong>
        <span className="pill">{statusText}</span>
      </div>
      <div className="demo-access-row">
        <input
          type="password"
          value={input}
          placeholder="Enter demo password"
          onChange={(event) => setInput(event.target.value)}
        />
        <button onClick={savePassword} disabled={!input.trim()}>
          Save
        </button>
        <button className="secondary" onClick={clearPassword}>
          Clear
        </button>
      </div>
      <p className="demo-access-hint">{HINT_TEXT}</p>
    </div>
  );
}
