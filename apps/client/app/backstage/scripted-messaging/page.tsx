'use client';

import { useMemo, useState } from 'react';
import fixtures from '../../../../../packages/contracts/fixtures/learn.scripted-scenes.sample.json';
import type {
  GraphCityId,
  ScriptedMessagingScene,
  ScriptedMessagingTranslationMode,
} from '../../../../../packages/contracts';
import { ScriptedMessagingPlayer } from '@/components/learn/ScriptedMessagingPlayer';

const MODES: ScriptedMessagingTranslationMode[] = [
  'primary_only',
  'primary_with_english',
  'primary_local_explanation_with_english',
];

export default function ScriptedMessagingBackstagePage() {
  const [city, setCity] = useState<GraphCityId>('seoul');
  const [mode, setMode] = useState<ScriptedMessagingTranslationMode>('primary_only');

  const scene = useMemo(
    () => (fixtures.scenes as ScriptedMessagingScene[]).find((item) => item.cityId === city) ?? (fixtures.scenes[0] as ScriptedMessagingScene),
    [city],
  );

  return (
    <main style={{ maxWidth: 780, margin: '0 auto', padding: 16, display: 'grid', gap: 12 }}>
      <h1 style={{ margin: 0 }}>Scripted Messaging Player</h1>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(['seoul', 'tokyo', 'shanghai'] as GraphCityId[]).map((value) => (
          <button key={value} className="tg-chip" type="button" onClick={() => setCity(value)}>{value}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {MODES.map((value) => (
          <button key={value} className="tg-chip" type="button" onClick={() => setMode(value)}>{value}</button>
        ))}
      </div>

      <ScriptedMessagingPlayer scene={scene} translationMode={mode} />
    </main>
  );
}
