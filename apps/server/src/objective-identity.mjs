import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');

const objectiveIdentityMap = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'packages/contracts/objective-identity-map.sample.json'), 'utf8'),
);

const identityByCanonical = new Map();
const canonicalByAnyId = new Map();

for (const identity of objectiveIdentityMap.objectives ?? []) {
  identityByCanonical.set(identity.canonicalObjectiveId, identity);
  canonicalByAnyId.set(identity.canonicalObjectiveId, identity.canonicalObjectiveId);
  for (const legacyId of identity.legacyObjectiveIds ?? []) {
    canonicalByAnyId.set(legacyId, identity.canonicalObjectiveId);
  }
}

export function resolveObjectiveIdentity(objectiveId) {
  if (typeof objectiveId !== 'string' || objectiveId.length === 0) {
    return {
      objectiveId,
      canonicalObjectiveId: objectiveId,
      legacyObjectiveId: null,
      objectiveAliasIds: [],
    };
  }

  const canonicalObjectiveId = canonicalByAnyId.get(objectiveId) ?? objectiveId;
  const identity = identityByCanonical.get(canonicalObjectiveId);
  const legacyObjectiveId = identity?.legacyObjectiveIds?.[0] ?? null;
  const objectiveAliasIds = identity?.legacyObjectiveIds ? [...identity.legacyObjectiveIds] : [];

  return {
    objectiveId: canonicalObjectiveId,
    canonicalObjectiveId,
    legacyObjectiveId,
    objectiveAliasIds,
    identity,
  };
}

export function withObjectiveIdentity(payload = {}, objectiveId) {
  const resolved = resolveObjectiveIdentity(objectiveId);
  return {
    ...payload,
    objectiveId: resolved.objectiveId,
    canonicalObjectiveId: resolved.canonicalObjectiveId,
    legacyObjectiveId: resolved.legacyObjectiveId,
    objectiveAliasIds: resolved.objectiveAliasIds,
  };
}

export function canonicalObjectiveNodeId(objectiveId) {
  return `objective:${resolveObjectiveIdentity(objectiveId).canonicalObjectiveId}`;
}

export function objectiveMatchesLanguage(objectiveId, lang) {
  return typeof resolveObjectiveIdentity(objectiveId).canonicalObjectiveId === 'string' &&
    resolveObjectiveIdentity(objectiveId).canonicalObjectiveId.startsWith(`${lang}-`);
}

export function defaultObjectiveIdForLang(lang, fallbackObjectiveId = null) {
  if (typeof fallbackObjectiveId === 'string' && fallbackObjectiveId.length > 0) {
    const fallbackCanonicalId = resolveObjectiveIdentity(fallbackObjectiveId).canonicalObjectiveId;
    if (typeof fallbackCanonicalId === 'string' && fallbackCanonicalId.startsWith(`${lang}-`)) {
      return fallbackCanonicalId;
    }
  }

  for (const identity of objectiveIdentityMap.objectives ?? []) {
    if (identity.lang === lang) {
      return identity.canonicalObjectiveId;
    }
  }
  return fallbackObjectiveId;
}

export { objectiveIdentityMap };
