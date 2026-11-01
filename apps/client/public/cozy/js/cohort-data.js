// Plain data mirrored from lib/content/canon/cohort.ts (no imports, so eval code
// and node tests can load it). lib/relationship/content.test.ts checks they match.

/** The other foreign trainee: picked per save from nationalities that are not the player's. */
export const FOREIGN_TRAINEES = [
  { id: 'xiaoyu', nationality: '중국', name: { ko: '샤오위', en: 'Xiaoyu' } },
  { id: 'haruna', nationality: '일본', name: { ko: '하루나', en: 'Haruna' } },
  { id: 'mint', nationality: '태국', name: { ko: '민트', en: 'Mint' } },
  { id: 'linh', nationality: '베트남', name: { ko: '린', en: 'Linh' } },
  { id: 'ayu', nationality: '인도네시아', name: { ko: '아유', en: 'Ayu' } },
  { id: 'bea', nationality: '필리핀', name: { ko: '비아', en: 'Bea' } },
];

/** Deterministic: same seed and nationality, same trainee. */
export function pickForeignTrainee(seed, playerNationality) {
  const pool = FOREIGN_TRAINEES.filter((t) => t.nationality !== playerNationality);
  return pool[(seed >>> 0) % pool.length];
}
