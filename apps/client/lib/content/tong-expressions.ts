import { runtimeAssetUrl } from '@/lib/runtime-assets';

export type TongExpression =
  | 'neutral'
  | 'cheerful'
  | 'surprised'
  | 'proud'
  | 'love'
  | 'sad'
  | 'crying'
  | 'amazed'
  | 'excited'
  | 'thinking';

export const TONG_EXPRESSIONS: Record<TongExpression, string> = {
  neutral: runtimeAssetUrl('character.tong.expression.neutral'),
  cheerful: runtimeAssetUrl('character.tong.expression.cheerful'),
  surprised: runtimeAssetUrl('character.tong.expression.surprised'),
  proud: runtimeAssetUrl('character.tong.expression.proud'),
  love: runtimeAssetUrl('character.tong.expression.love'),
  sad: runtimeAssetUrl('character.tong.expression.sad'),
  crying: runtimeAssetUrl('character.tong.expression.crying'),
  amazed: runtimeAssetUrl('character.tong.expression.amazed'),
  excited: runtimeAssetUrl('character.tong.expression.excited'),
  thinking: runtimeAssetUrl('character.tong.expression.thinking'),
};

export function tongExpressionUrl(expression: TongExpression = 'cheerful'): string {
  return TONG_EXPRESSIONS[expression];
}
