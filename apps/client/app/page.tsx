'use client';

import { useState, useEffect, useRef, useCallback, FormEvent, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

import TongHeroVideo from '@/components/landing/TongHeroVideo';
import SiteFooter from '@/components/site/SiteFooter';
import SiteHeader from '@/components/site/SiteHeader';

const API_BASE = 'https://tong-api.erniesg.workers.dev';

/* ── Language gauge (mirrors game onboarding) ──────────────── */
type CjkLang = 'ko' | 'ja' | 'zh';
type ProficiencyGaugeLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type ProficiencyLevel = 'none' | 'beginner' | 'intermediate' | 'advanced' | 'native';
const MAX_GAUGE: ProficiencyGaugeLevel = 6;
const CJK_LANGS: CjkLang[] = ['ja', 'ko', 'zh'];
const LANG_LABELS: Record<CjkLang, string> = { ko: 'Korean 한국어', ja: 'Japanese 日本語', zh: 'Chinese 中文' };
type ExplainLang = 'en' | 'ko' | 'ja' | 'zh';
const EXPLAIN_OPTIONS: { value: ExplainLang; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
];

function gaugeToProf(level: ProficiencyGaugeLevel): ProficiencyLevel {
  if (level <= 0) return 'none';
  if (level <= 2) return 'beginner';
  if (level <= 4) return 'intermediate';
  if (level === 5) return 'advanced';
  return 'native';
}
function profLabel(level: ProficiencyLevel): string {
  return ({ none: 'None', beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced', native: 'Native' })[level];
}
function profSub(level: ProficiencyLevel): string {
  return ({
    none: 'Starting from zero',
    beginner: 'Basic words and short patterns',
    intermediate: 'Comfortable with short conversations',
    advanced: 'Handle nuanced social talk',
    native: 'Near-native comfort',
  })[level];
}

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

export default function LandingPageWrapper() {
  return (
    <Suspense>
      <LandingPage />
    </Suspense>
  );
}

function LandingPage() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [signedUpEmail, setSignedUpEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  /* ── Preferences panel state ──────────────── */
  const [prefsDone, setPrefsDone] = useState(false);
  const [prefsWereSaved, setPrefsWereSaved] = useState(false);
  const [fromEmail, setFromEmail] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const [gauge, setGauge] = useState<Record<CjkLang, ProficiencyGaugeLevel>>({
    ko: 0, ja: 0, zh: 0,
  });
  const [explainIn, setExplainIn] = useState<Record<CjkLang, ExplainLang>>({
    ko: 'en', ja: 'en', zh: 'en',
  });
  const dirty = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  /* Auto-open prefs if arriving from email link (?prefs=email&ko=2&ja=5) */
  useEffect(() => {
    const prefsEmail = searchParams.get('prefs');
    if (prefsEmail) {
      setSignedUpEmail(prefsEmail);
      setStatus('success');
      setFromEmail(true);
      const ko = searchParams.get('ko');
      const ja = searchParams.get('ja');
      const zh = searchParams.get('zh');
      if (ko || ja || zh) {
        setGauge((prev) => ({
          ko: ko ? Math.max(0, Math.min(MAX_GAUGE, Number(ko))) as ProficiencyGaugeLevel : prev.ko,
          ja: ja ? Math.max(0, Math.min(MAX_GAUGE, Number(ja))) as ProficiencyGaugeLevel : prev.ja,
          zh: zh ? Math.max(0, Math.min(MAX_GAUGE, Number(zh))) as ProficiencyGaugeLevel : prev.zh,
        }));
      }
    }
  }, [searchParams]);

  function showToast(msg: string) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }

  const autoSave = useCallback((g: Record<CjkLang, ProficiencyGaugeLevel>, ex: Record<CjkLang, ExplainLang>) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await fetch(`${API_BASE}/api/v1/signup/preferences`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: signedUpEmail,
            proficiency: { ko: gaugeToProf(g.ko), ja: gaugeToProf(g.ja), zh: gaugeToProf(g.zh) },
            explainIn: { ...ex },
          }),
        });
        setPrefsWereSaved(true);
        showToast('Saved');
      } catch {
        showToast('Could not save — try again');
      }
      dirty.current = false;
    }, 800);
  }, [signedUpEmail]);

  function handleGauge(lang: CjkLang, val: number) {
    const clamped = Math.max(0, Math.min(MAX_GAUGE, Math.round(val))) as ProficiencyGaugeLevel;
    if (clamped === gauge[lang]) return;
    const next = { ...gauge, [lang]: clamped };
    setGauge(next);
    dirty.current = true;
    if (signedUpEmail) autoSave(next, explainIn);
  }
  function handleExplainIn(lang: CjkLang, val: ExplainLang) {
    if (val === explainIn[lang]) return;
    const next = { ...explainIn, [lang]: val };
    setExplainIn(next);
    dirty.current = true;
    if (signedUpEmail) autoSave(gauge, next);
  }

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
      setSignedUpEmail(email);
      setEmail('');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  return (
    <div className="landing">
      {/* Hero */}
      <section className="landing-hero landing-hero--cinematic">
        <TongHeroVideo />
        <div className="landing-hero-scrim" aria-hidden="true" />

        <div className="landing-hero-shell">
          <SiteHeader current="home" tone="dark" variant="home" />

          <div className="landing-hero-stage">
            <div className="landing-hero-copy">
              <span className="kicker landing-hero-kicker">An AI dating sim where language is gameplay.</span>
              <h1 className="landing-headline landing-headline--cinematic">
                <span className="landing-headline-line">Live the drama.</span>
                <span className="landing-headline-line">Learn the language.</span>
              </h1>
              <p className="landing-subhead landing-subhead--cinematic">
                Play as a trainee across Seoul, Shanghai, and Tokyo. <span className="landing-build">Build</span>{' '}
                relationships or <span className="landing-burn">burn</span> them. What happens next is up to you.
              </p>
            </div>

            <div className="landing-hero-panel">
              {status === 'success' ? (
                <div className="landing-prefs-card landing-prefs-card--hero">
                  <p className="landing-prefs-confirmed">You&apos;re on the list.</p>
                  {!prefsDone ? (
                    <>
                      <p className="landing-prefs-hint">
                        Tell us what you already know — we&apos;ll skip the basics when you start playing.
                      </p>
                      <div className="landing-gauge-card">
                        {CJK_LANGS.map((lang) => {
                          const prof = gaugeToProf(gauge[lang]);
                          return (
                            <div key={lang} className="landing-gauge-row">
                              <div className="landing-gauge-head">
                                <strong>{LANG_LABELS[lang]}</strong>
                                <span>{gauge[lang] + 1}/7 · {profLabel(prof)}</span>
                              </div>
                              <input
                                type="range"
                                min={0}
                                max={MAX_GAUGE}
                                step={1}
                                value={gauge[lang]}
                                onChange={(e) => handleGauge(lang, Number(e.target.value))}
                              />
                              <div className="landing-gauge-meta">
                                <small>{profSub(prof)}</small>
                                <span className="landing-explain-in">
                                  <span>learn&nbsp;in</span>
                                  <select
                                    value={explainIn[lang]}
                                    onChange={(e) => handleExplainIn(lang, e.target.value as ExplainLang)}
                                  >
                                    {EXPLAIN_OPTIONS.filter((o) => o.value !== lang).map((o) => (
                                      <option key={o.value} value={o.value}>
                                        {o.label}
                                      </option>
                                    ))}
                                  </select>
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {toast && <p className="landing-toast">{toast}</p>}
                      <div className="landing-prefs-actions">
                        {!fromEmail && (
                          <button
                            type="button"
                            className="landing-prefs-skip"
                            onClick={() => {
                              setPrefsDone(true);
                              if (!prefsWereSaved) {
                                fetch(`${API_BASE}/api/v1/signup/skip-preferences`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ email: signedUpEmail }),
                                }).catch(() => {});
                              }
                            }}
                          >
                            {prefsWereSaved ? 'Done' : 'Skip for now'}
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="landing-prefs-done">
                      {prefsWereSaved ? "Saved — we'll fast-forward your onboarding." : "We'll email you when Tong is ready."}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <form className="landing-signup landing-signup--hero" onSubmit={handleSubmit}>
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

                  {status === 'error' ? <p className="landing-error landing-error--hero">{errorMsg}</p> : null}
                  <p className="landing-micro landing-micro--hero">We&apos;ll email you when Tong is ready.</p>
                </>
              )}
            </div>
          </div>
        </div>
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
      <SiteFooter current="home" variant="home" />
    </div>
  );
}
