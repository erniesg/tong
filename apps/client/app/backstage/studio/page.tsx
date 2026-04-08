'use client';

import { useCallback, useRef, useState } from 'react';
import { useChat } from 'ai/react';

const PLATFORM_FORMATS = [
  { id: 'instagram-story', label: 'IG Story', platform: 'instagram', dims: '1080×1920' },
  { id: 'instagram-post', label: 'IG Post', platform: 'instagram', dims: '1080×1080' },
  { id: 'instagram-reel', label: 'IG Reel', platform: 'instagram', dims: '1080×1920' },
  { id: 'tiktok-video', label: 'TikTok', platform: 'tiktok', dims: '1080×1920' },
  { id: 'linkedin-post', label: 'LinkedIn', platform: 'linkedin', dims: '1200×628' },
  { id: 'linkedin-carousel', label: 'LI Carousel', platform: 'linkedin', dims: '1080×1080' },
  { id: 'twitter-post', label: 'X Post', platform: 'twitter', dims: '1600×900' },
  { id: 'youtube-thumbnail', label: 'YT Thumb', platform: 'youtube', dims: '1280×720' },
  { id: 'youtube-short', label: 'YT Short', platform: 'youtube', dims: '1080×1920' },
  { id: 'xiaohongshu-post', label: 'XHS', platform: 'xiaohongshu', dims: '1080×1440' },
];

const PLATFORMS = [...new Set(PLATFORM_FORMATS.map(f => f.platform))];

interface RenderOutput {
  format: string;
  outputPath: string;
  width: number;
  height: number;
}

export default function StudioPage() {
  const [brief, setBrief] = useState('');
  const [selectedFormats, setSelectedFormats] = useState<string[]>(['instagram-story', 'linkedin-post', 'youtube-thumbnail']);
  const [subjectImage, setSubjectImage] = useState<string | null>(null);
  const [subjectPreview, setSubjectPreview] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<RenderOutput[]>([]);
  const [plan, setPlan] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const processedCalls = useRef(new Set<string>());

  const { messages, append, isLoading } = useChat({
    api: '/api/ai/studio',
    body: {
      brief,
      formats: selectedFormats,
      subjectImageBase64: subjectImage || undefined,
    },
    onToolCall({ toolCall }) {
      if (processedCalls.current.has(toolCall.toolCallId)) return;
      processedCalls.current.add(toolCall.toolCallId);

      if (toolCall.toolName === 'plan_composition') {
        // Plan will be in the tool result
      }
      if (toolCall.toolName === 'render_still') {
        const result = toolCall.args as any;
        if (result?.ok && result?.result) {
          setOutputs(prev => [...prev, result.result]);
        }
      }
      if (toolCall.toolName === 'render_batch') {
        const result = toolCall.args as any;
        if (result?.ok && result?.result?.outputs) {
          setOutputs(prev => [...prev, ...result.result.outputs]);
        }
      }
    },
  });

  const toggleFormat = (id: string) => {
    setSelectedFormats(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const togglePlatform = (platform: string) => {
    const platformFmts = PLATFORM_FORMATS.filter(f => f.platform === platform).map(f => f.id);
    const allSelected = platformFmts.every(id => selectedFormats.includes(id));
    if (allSelected) {
      setSelectedFormats(prev => prev.filter(f => !platformFmts.includes(f)));
    } else {
      setSelectedFormats(prev => [...new Set([...prev, ...platformFmts])]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setSubjectPreview(result);
      // Strip data URL prefix for base64
      setSubjectImage(result.split(',')[1] || '');
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = useCallback(() => {
    setOutputs([]);
    setPlan(null);
    processedCalls.current.clear();

    const formatList = selectedFormats.join(', ');
    const subjectNote = subjectImage
      ? ' I have uploaded a subject photo — extract it and composite it into the designs.'
      : '';
    const prompt = brief
      ? `Create multi-format content: ${brief}. Target formats: ${formatList}.${subjectNote}`
      : `Create a sample event poster for all selected formats: ${formatList}.${subjectNote}`;

    append({ role: 'user', content: prompt });
  }, [append, brief, selectedFormats, subjectImage]);

  return (
    <div>
      {/* Header */}
      <div className="backstage-section-header">
        <h2 className="backstage-section-title">Studio</h2>
        <p className="triage-muted">Multi-format content generation with AI orchestration</p>
      </div>

      {/* Brief input */}
      <div className="signals-controls" style={{ marginBottom: 16 }}>
        <input
          className="triage-select"
          style={{ flex: 1, minWidth: 300 }}
          placeholder="Describe what you want to create (e.g. 'event poster for my AI talk featuring tong')..."
          value={brief}
          onChange={e => setBrief(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleGenerate(); }}
        />
        <button
          className="triage-btn-analyze"
          onClick={handleGenerate}
          disabled={isLoading}
        >
          {isLoading ? 'Creating...' : 'Create'}
        </button>
      </div>

      {/* Subject photo upload */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'flex-start' }}>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
          <button
            className="triage-btn-analyze"
            style={{ background: subjectImage ? 'var(--mint)' : undefined }}
            onClick={() => fileInputRef.current?.click()}
          >
            {subjectImage ? 'Photo uploaded' : 'Upload subject photo (optional)'}
          </button>
          {subjectImage && (
            <button
              className="triage-btn-analyze"
              style={{ marginLeft: 8, background: 'var(--muted)' }}
              onClick={() => { setSubjectImage(null); setSubjectPreview(null); }}
            >
              Clear
            </button>
          )}
        </div>
        {subjectPreview && (
          <img
            src={subjectPreview}
            alt="Subject preview"
            style={{ height: 80, borderRadius: 8, border: '1px solid var(--border)' }}
          />
        )}
      </div>

      {/* Format selector */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 8, color: 'var(--muted)' }}>
          Output Formats ({selectedFormats.length} selected)
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {PLATFORMS.map(platform => (
            <div key={platform}>
              <button
                onClick={() => togglePlatform(platform)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--muted)',
                  fontSize: '0.7rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                  padding: '2px 0',
                  marginBottom: 4,
                }}
              >
                {platform}
              </button>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {PLATFORM_FORMATS.filter(f => f.platform === platform).map(fmt => {
                  const selected = selectedFormats.includes(fmt.id);
                  return (
                    <button
                      key={fmt.id}
                      onClick={() => toggleFormat(fmt.id)}
                      className={selected ? 'triage-auto-badge' : 'triage-issue-time'}
                      style={{
                        cursor: 'pointer',
                        padding: '4px 10px',
                        fontSize: '0.75rem',
                        opacity: selected ? 1 : 0.5,
                        border: selected ? '1px solid var(--accent)' : '1px solid var(--border)',
                      }}
                    >
                      {fmt.label} <span style={{ opacity: 0.6 }}>{fmt.dims}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI conversation */}
      {messages.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 8, color: 'var(--muted)' }}>
            AI Director
          </p>
          <div style={{
            maxHeight: 300,
            overflowY: 'auto',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 12,
          }}>
            {messages.filter(m => m.role === 'assistant' && m.content).map((m, i) => (
              <div key={i} style={{ fontSize: '0.8rem', marginBottom: 8, lineHeight: 1.5 }}>
                {m.content}
              </div>
            ))}
            {isLoading && (
              <div style={{ fontSize: '0.8rem', color: 'var(--accent)', animation: 'pulse 1.5s infinite' }}>
                Orchestrating tools...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Render outputs */}
      {outputs.length > 0 && (
        <div>
          <div className="backstage-section-header">
            <h3 className="backstage-section-title" style={{ fontSize: '1rem' }}>
              Outputs ({outputs.length})
            </h3>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 12,
          }}>
            {outputs.map((out, i) => {
              const fmt = PLATFORM_FORMATS.find(f => f.id === out.format);
              const isPortrait = out.height > out.width;
              return (
                <div
                  key={i}
                  className="triage-issue"
                  style={{ padding: 8 }}
                >
                  <div style={{
                    width: '100%',
                    aspectRatio: `${out.width}/${out.height}`,
                    maxHeight: isPortrait ? 280 : 180,
                    background: 'linear-gradient(135deg, #1a1a2e, #0f3460)',
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--muted)',
                    fontSize: '0.7rem',
                    marginBottom: 8,
                    overflow: 'hidden',
                  }}>
                    {out.width}×{out.height}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="triage-auto-badge" style={{ fontSize: '0.7rem' }}>
                      {fmt?.label || out.format}
                    </span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>
                      {out.outputPath.split('/').pop()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {outputs.length === 0 && !isLoading && messages.length === 0 && (
        <div className="triage-empty">
          <p>Describe what you want to create, select output formats, and optionally upload a subject photo.</p>
          <p style={{ marginTop: 8, fontSize: '0.8rem' }}>
            Examples: "event poster for my AI talk" · "social media announcement with tong character" · "youtube thumbnail with contour effect"
          </p>
        </div>
      )}
    </div>
  );
}
