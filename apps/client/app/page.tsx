'use client';

import { useState, FormEvent } from 'react';
import Image from 'next/image';

const API_BASE = 'https://tong-api.erniesg.workers.dev';

const FAQ_ITEMS = [
  {
    q: 'Was any AI used in building Tong?',
    a: 'HELL YEAH. Ernie gave ideas, instructions and judgment\u00a0\u2014\u00a0everything else is AI. The NPCs, exercises, code, assets and media are all AI-generated. Every line is open source on GitHub if you want to see how the game is made.',
  },
  {
    q: 'Why are you building Tong?',
    a: 'I just wanted a fun way to learn Korean and Japanese... and now here we are.',
  },
  {
    q: 'When will Tong be available?',
    a: 'We\u2019re building in the open right now. Drop your email above and we\u2019ll ping you when it\u2019s ready.',
  },
  {
    q: 'Is Tong free?',
    a: 'Tong is open source and free to play. Some AI-powered features may cost money down the road\u00a0\u2014\u00a0those generations aren\u2019t free to run\u00a0\u2014\u00a0but the core game will always be free.',
  },
];

const CITIES = [
  { name: 'Shanghai', lang: 'Mandarin', char: '\u4E2D', flag: '\uD83C\uDDE8\uD83C\uDDF3' },
  { name: 'Tokyo', lang: 'Japanese', char: '\u65E5', flag: '\uD83C\uDDEF\uD83C\uDDF5' },
  { name: 'Seoul', lang: 'Korean', char: '\uD55C', flag: '\uD83C\uDDF0\uD83C\uDDF7' },
];

const STEPS = [
  {
    title: 'Live',
    emoji: '\uD83C\uDFAD',
    desc: 'Start as a trainee. Navigate cities, relationships and drama.',
  },
  {
    title: 'Talk',
    emoji: '\uD83D\uDCAC',
    desc: 'Chat with characters who remember you — and unlock new interactions as your relationship grows.',
  },
  {
    title: 'Level up',
    emoji: '\uD83D\uDE80',
    desc: 'Vocab, grammar and pronunciation unlock as you progress the story.',
  },
];

export default function LandingPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || status === 'sending') return;

    setStatus('sending');
    setErrorMsg('');

    try {
      const res = await fetch(`${API_BASE}/api/v1/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Something went wrong');
      }

      setStatus('success');
      setEmail('');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  return (
    <div className="landing">
      {/* Nav */}
      <nav className="landing-nav">
        <a href="/" className="landing-nav-brand">
          <Image
            src="/assets/app/logo_trimmed.png"
            alt="Tong"
            width={30}
            height={30}
            className="landing-nav-logo"
          />
          <div className="landing-brand-cycle">
            <span>tōng</span>
            <span>통</span>
            <span>つう</span>
          </div>
        </a>
        <div className="landing-nav-links">
          <a
            href="https://github.com/erniesg/tong"
            target="_blank"
            rel="noopener noreferrer"
            className="nav-link"
          >
            GitHub
          </a>
          <span className="button landing-play-btn disabled">
            Coming Soon
          </span>
        </div>
      </nav>

      {/* Hero */}
      <section className="landing-hero">
        <h1 className="landing-headline">
          Live the drama.<br />Learn the language.
        </h1>
        <p className="landing-subhead">
          Play as a trainee navigating life in Seoul, Shanghai and Tokyo.
          Learn the language to <span className="landing-build">build</span> relationships — or <span className="landing-burn">burn</span> them. What happens next is up to you.
        </p>

        {status === 'success' ? (
          <div className="landing-signup-success card">
            <p>You're on the list. We'll email you when Tong is ready.</p>
          </div>
        ) : (
          <form className="landing-signup" onSubmit={handleSubmit}>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="landing-email-input"
            />
            <button
              type="submit"
              disabled={status === 'sending'}
              className="landing-signup-btn"
            >
              {status === 'sending' ? 'Sending...' : 'Notify Me'}
            </button>
          </form>
        )}

        {status === 'error' && (
          <p className="landing-error">{errorMsg}</p>
        )}

        {status !== 'success' && (
          <p className="landing-micro">
            We'll email you when Tong is ready.
          </p>
        )}
      </section>

      {/* Cities */}
      <section className="landing-cities">
        {CITIES.map((city) => (
          <div key={city.name} className="card landing-city-card">
            <span className="landing-city-char">{city.char}</span>
            <span className="landing-city-flag">{city.flag}</span>
            <h3>{city.name}</h3>
            <p>{city.lang}</p>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section className="landing-section">
        <span className="kicker">How it works</span>
        <h2 className="landing-section-title">Play. Talk. Remember.</h2>
        <div className="landing-steps">
          {STEPS.map((step, i) => (
            <div key={step.title} className="card landing-step-card" style={{ animationDelay: `${i * 150}ms` }}>
              <span className="landing-step-emoji">{step.emoji}</span>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="landing-section">
        <span className="kicker">FAQ</span>
        <h2 className="landing-section-title">Questions & Answers</h2>
        <div className="landing-faq">
          {FAQ_ITEMS.map((item, i) => (
            <div
              key={i}
              className={`landing-faq-item${openFaq === i ? ' open' : ''}`}
            >
              <button
                className="landing-faq-q"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                aria-expanded={openFaq === i}
              >
                <span>{item.q}</span>
                <span className="landing-faq-chevron">{openFaq === i ? '\u2212' : '+'}</span>
              </button>
              {openFaq === i && (
                <div className="landing-faq-a">
                  <p>{item.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-brand">
          <Image
            src="/assets/app/logo_trimmed.png"
            alt="Tong"
            width={30}
            height={30}
          />
          <span>Tong — Live the drama. Learn the language.</span>
        </div>
        <div className="landing-footer-links">
          <a
            href="https://github.com/erniesg/tong"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          <span className="landing-footer-sep">&middot;</span>
          <span>Built by <a href="https://berlayar.ai" target="_blank" rel="noopener noreferrer">Berlayar</a></span>
        </div>
      </footer>
    </div>
  );
}
