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
  neutral:   '/assets/characters/tong/tong_neutral.png',
  cheerful:  '/assets/characters/tong/tong_cheerful.png',
  surprised: '/assets/characters/tong/tong_surprised.png',
  proud:     '/assets/characters/tong/tong_proud.png',
  love:      '/assets/characters/tong/tong_love.png',
  sad:       '/assets/characters/tong/tong_sad.png',
  crying:    '/assets/characters/tong/tong_crying.png',
  amazed:    '/assets/characters/tong/tong_amazed.png',
  excited:   '/assets/characters/tong/tong_excited.png',
  thinking:  '/assets/characters/tong/tong_thinking.png',
};

export function tongExpressionUrl(expression: TongExpression = 'cheerful'): string {
  return TONG_EXPRESSIONS[expression];
}
