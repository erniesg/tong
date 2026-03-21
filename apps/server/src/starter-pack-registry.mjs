import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');

function loadJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

const WORLD_MAP_REGISTRY = loadJson('packages/contracts/world-map-registry.sample.json');
const STARTER_CAST_REGISTRY = loadJson('assets/manifest/starter-cast-registry.json');

const STARTER_PACK_DIR = path.join(repoRoot, 'assets/content-packs');
const STARTER_PACKS = fs.readdirSync(STARTER_PACK_DIR)
  .filter((filename) => filename.endsWith('.starter.json') && !filename.includes('.template.'))
  .map((filename) => loadJson(path.join('assets/content-packs', filename)));

const STARTER_PACK_BY_ID = new Map(STARTER_PACKS.map((pack) => [pack.packId, pack]));
const PLAYER_FACING_LABEL_OVERRIDES = new Map([
  ['seoul:practice_studio', 'Chimaek Place'],
]);

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function getWorldMapCityRegistry(cityId) {
  return (WORLD_MAP_REGISTRY.cities || []).find((city) => city.cityId === cityId) || null;
}

export function listWorldMapLocationIds() {
  const ids = new Set();
  for (const city of WORLD_MAP_REGISTRY.cities || []) {
    ids.add(city.defaultMapLocationId);
    for (const location of city.locations || []) {
      ids.add(location.mapLocationId);
      ids.add(location.dagLocationSlot);
      for (const legacyLocationId of location.legacyLocationIds || []) ids.add(legacyLocationId);
    }
  }
  return [...ids];
}

export function resolveWorldMapLocation(cityId, locationId = null) {
  const cityRegistry = getWorldMapCityRegistry(cityId);
  const fallbackLocationId = locationId || cityRegistry?.defaultMapLocationId || 'food_street';

  if (!cityRegistry) {
    return {
      cityId,
      mapLocationId: fallbackLocationId,
      dagLocationSlot: fallbackLocationId,
      label: fallbackLocationId.replace(/_/g, ' '),
      legacyLocationIds: [fallbackLocationId],
    };
  }

  const requestedLocationId = locationId || cityRegistry.defaultMapLocationId;
  const normalized = (cityRegistry.locations || []).find(
    (entry) =>
      entry.mapLocationId === requestedLocationId ||
      entry.dagLocationSlot === requestedLocationId ||
      (entry.legacyLocationIds || []).includes(requestedLocationId),
  );
  const fallback = (cityRegistry.locations || []).find(
    (entry) => entry.mapLocationId === cityRegistry.defaultMapLocationId,
  ) || cityRegistry.locations?.[0];
  const mapLocationId = normalized?.mapLocationId || fallback?.mapLocationId || fallbackLocationId;
  const dagLocationSlot = normalized?.dagLocationSlot || fallback?.dagLocationSlot || fallbackLocationId;

  return {
    cityId,
    mapLocationId,
    dagLocationSlot,
    label:
      normalized?.label ||
      fallback?.label ||
      dagLocationSlot.replace(/_/g, ' '),
    legacyLocationIds: unique([dagLocationSlot, ...((normalized?.legacyLocationIds || []))]),
  };
}

export function inferCityFromLocation(locationId) {
  if (!locationId) return null;
  const matches = [];
  for (const city of WORLD_MAP_REGISTRY.cities || []) {
    if ((city.locations || []).some((entry) =>
      entry.mapLocationId === locationId ||
      entry.dagLocationSlot === locationId ||
      (entry.legacyLocationIds || []).includes(locationId))) {
      matches.push(city.cityId);
    }
  }
  return matches.length === 1 ? matches[0] : null;
}

function getStarterCastCityRegistry(cityId) {
  return (STARTER_CAST_REGISTRY.cities || []).find((city) => city.cityId === cityId) || null;
}

function getPlayerFacingLabel(cityId, mapLocationId, fallbackLabel) {
  return PLAYER_FACING_LABEL_OVERRIDES.get(`${cityId}:${mapLocationId}`) || fallbackLabel;
}

export function resolveStarterPack(cityId, locationId = null) {
  const resolvedLocation = resolveWorldMapLocation(cityId, locationId);
  const castCityRegistry = getStarterCastCityRegistry(cityId);
  const pinEntry = (castCityRegistry?.mapPins || []).find(
    (entry) => entry.mapLocationId === resolvedLocation.mapLocationId,
  ) || null;
  const slotRoster = (castCityRegistry?.slotRosters || []).find(
    (entry) => entry.slotRosterId === pinEntry?.slotRosterId,
  ) || null;
  const pack = pinEntry ? STARTER_PACK_BY_ID.get(pinEntry.packId) || null : null;

  return {
    cityId,
    mapLocationId: resolvedLocation.mapLocationId,
    dagLocationSlot: resolvedLocation.dagLocationSlot,
    registryLabel: resolvedLocation.label,
    playerFacingLabel: getPlayerFacingLabel(cityId, resolvedLocation.mapLocationId, resolvedLocation.label),
    rosterRegistrySource: pack?.rosterRegistrySource || 'assets/manifest/starter-cast-registry.json',
    slotRosterId: pinEntry?.slotRosterId || null,
    packId: pinEntry?.packId || pack?.packId || null,
    pack,
    slotRoster,
    registryResolved: Boolean(pinEntry && pack),
  };
}
