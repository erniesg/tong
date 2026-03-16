import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import type { UserPreferences, LanguageCode } from '@tong/core';

import './styles.css';

const LANGUAGES: { code: LanguageCode; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'zh', name: 'Chinese (Simplified)' },
  { code: 'zh-TW', name: 'Chinese (Traditional)' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
];

function Options() {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_PREFERENCES' });
      if (response.success) {
        setPreferences(response.data);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    if (!preferences) return;

    setSaving(true);
    setMessage(null);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SET_PREFERENCES',
        payload: preferences,
      });

      if (response.success) {
        setMessage('Settings saved successfully!');
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage('Error saving settings');
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      setMessage('Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const updateLanguage = (field: string, value: LanguageCode) => {
    if (!preferences) return;
    setPreferences({
      ...preferences,
      languages: {
        ...preferences.languages,
        [field]: value,
      },
    });
  };

  const updateSubtitle = (field: string, value: unknown) => {
    if (!preferences) return;
    setPreferences({
      ...preferences,
      subtitles: {
        ...preferences.subtitles,
        [field]: value,
      },
    });
  };

  if (loading) {
    return (
      <div className="options">
        <div className="loading">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="options">
      <header className="header">
        <h1>Tong Settings</h1>
        <p>Configure your language learning preferences</p>
      </header>

      <main className="content">
        <section className="section">
          <h2>Language Settings</h2>

          <div className="form-group">
            <label>Learning Language</label>
            <select
              value={preferences?.languages.primaryTarget}
              onChange={(e) =>
                updateLanguage('primaryTarget', (e.target as HTMLSelectElement).value as LanguageCode)
              }
            >
              {LANGUAGES.filter((l) => ['zh', 'zh-TW', 'ja', 'ko'].includes(l.code)).map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Translation Language</label>
            <select
              value={preferences?.languages.translationLanguage}
              onChange={(e) =>
                updateLanguage(
                  'translationLanguage',
                  (e.target as HTMLSelectElement).value as LanguageCode
                )
              }
            >
              {LANGUAGES
                .filter((l) => {
                  const primary = preferences?.languages.primaryTarget || '';
                  if (l.code === primary) return false;
                  // Don't offer zh-TW translation when learning zh, and vice versa
                  if (l.code === 'zh' && primary === 'zh-TW') return false;
                  if (l.code === 'zh-TW' && primary === 'zh') return false;
                  return true;
                })
                .map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
            </select>
          </div>
        </section>

        <section className="section">
          <h2>Subtitle Display</h2>

          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={preferences?.subtitles.showOriginal}
                onChange={(e) =>
                  updateSubtitle('showOriginal', (e.target as HTMLInputElement).checked)
                }
              />
              Show original subtitles
            </label>
          </div>

          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={preferences?.subtitles.showRomanization}
                onChange={(e) =>
                  updateSubtitle('showRomanization', (e.target as HTMLInputElement).checked)
                }
              />
              Show romanization (Pinyin/Romaji/etc.)
            </label>
          </div>

          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={preferences?.subtitles.showTranslation}
                onChange={(e) =>
                  updateSubtitle('showTranslation', (e.target as HTMLInputElement).checked)
                }
              />
              Show translation
            </label>
          </div>

          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={preferences?.subtitles.karaokeEnabled}
                onChange={(e) =>
                  updateSubtitle('karaokeEnabled', (e.target as HTMLInputElement).checked)
                }
              />
              Enable karaoke-style highlighting
            </label>
          </div>

          <div className="form-group">
            <label>Font Size</label>
            <input
              type="range"
              min="16"
              max="48"
              value={preferences?.subtitles.fontSize}
              onChange={(e) =>
                updateSubtitle('fontSize', parseInt((e.target as HTMLInputElement).value))
              }
            />
            <span>{preferences?.subtitles.fontSize}px</span>
          </div>

          <div className="form-group">
            <label>Position</label>
            <select
              value={preferences?.subtitles.position}
              onChange={(e) => updateSubtitle('position', (e.target as HTMLSelectElement).value)}
            >
              <option value="bottom">Bottom</option>
              <option value="top">Top</option>
            </select>
          </div>

          <div className="form-group">
            <label>Highlight Color</label>
            <input
              type="color"
              value={preferences?.subtitles.karaokeHighlightColor}
              onChange={(e) =>
                updateSubtitle('karaokeHighlightColor', (e.target as HTMLInputElement).value)
              }
            />
          </div>
        </section>

        <section className="section">
          <h2>Appearance</h2>

          <div className="form-group">
            <label>Theme</label>
            <select
              value={preferences?.theme}
              onChange={(e) =>
                setPreferences({
                  ...preferences!,
                  theme: (e.target as HTMLSelectElement).value as 'light' | 'dark' | 'system',
                })
              }
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        </section>
      </main>

      <footer className="footer">
        {message && <div className="message">{message}</div>}
        <button className="save-btn" onClick={savePreferences} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </footer>
    </div>
  );
}

render(<Options />, document.getElementById('app')!);
