import { runtimeAssetUrl } from '@/lib/runtime-assets';

export const SHANGHAI_H1_PLACEHOLDER_ASSET_KEY = 'story.shanghai.h1.placeholder';

export function getShanghaiH1PanelAssetKey(index: number): string {
  if (index >= 0 && index <= 6) {
    return `story.shanghai.h1.panel-${index}`;
  }

  return SHANGHAI_H1_PLACEHOLDER_ASSET_KEY;
}

export function getShanghaiH1PanelAssetUrl(index: number): string {
  return runtimeAssetUrl(getShanghaiH1PanelAssetKey(index));
}

export function getShanghaiH1PlaceholderAssetUrl(): string {
  return runtimeAssetUrl(SHANGHAI_H1_PLACEHOLDER_ASSET_KEY);
}
