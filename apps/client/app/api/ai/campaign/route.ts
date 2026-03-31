import { streamText, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * Campaign ideation AI — takes trend data + game content catalog,
 * outputs campaign concepts with per-platform variants and asset lists.
 *
 * Input body:
 *   trends: array of signal objects from /api/v1/signals/latest
 *   cities: array of city IDs to consider (default: all)
 *   platforms: target platforms (default: ['tiktok', 'instagram', 'xiaohongshu', 'x'])
 *   brief: optional creative brief / focus area
 */

const SYSTEM_PROMPT = `You are a creative campaign strategist for Tong — a dating-sim style language learning game set in Seoul, Tokyo, and Shanghai.

Your job: take social media trend data and the game's content catalog, then generate campaign concepts that can be produced as short-form video content.

The game features:
- Dating sim hangout scenes with NPC characters in each city
- Language learning exercises (pronunciation, kanji/hanzi tracing, sentence building)
- City-specific messaging skins (KakaoTalk for Seoul, LINE for Tokyo, WeChat for Shanghai)
- CJK language learning (Korean, Japanese, Chinese)
- Anime/VN aesthetic with warm orange accent color

When proposing campaigns:
1. Ground every concept in a specific trend (cite which trend inspired it)
2. Describe the hook (first 1-3 seconds) explicitly — this makes or breaks short-form
3. Specify which existing game assets can be reused vs what needs generation
4. Give per-platform adaptations (TikTok needs sound-first, IG needs visual-first, XHS needs aesthetic-first, X needs text hook)
5. Estimate production effort: low (existing assets only), medium (some generation), high (full production)

Use the tools to output structured campaign concepts.`;

export async function POST(req: Request) {
  const body = await req.json();
  const { trends, cities, platforms, brief, messages } = body;

  const trendContext = trends?.length
    ? `Current trending data:\n${JSON.stringify(trends, null, 2)}`
    : 'No trend data provided — propose evergreen campaign concepts.';

  const platformContext = platforms?.length
    ? `Target platforms: ${platforms.join(', ')}`
    : 'Target platforms: TikTok, Instagram Reels, Xiaohongshu, X';

  const cityContext = cities?.length
    ? `Focus cities: ${cities.join(', ')}`
    : 'All cities: Seoul (Korean), Tokyo (Japanese), Shanghai (Chinese)';

  const briefContext = brief ? `Creative brief: ${brief}` : '';

  const systemMessage = [
    SYSTEM_PROMPT,
    '',
    trendContext,
    platformContext,
    cityContext,
    briefContext,
  ].join('\n');

  const result = streamText({
    model: openai('gpt-4o'),
    system: systemMessage,
    messages: messages || [
      { role: 'user', content: 'Generate 3-5 campaign concepts based on the provided trend data. Use the propose_campaign tool for each concept.' },
    ],
    tools: {
      propose_campaign: tool({
        description: 'Propose a campaign concept with per-platform variants and asset requirements',
        parameters: z.object({
          name: z.string().describe('Short punchy campaign name'),
          concept: z.string().describe('1-2 sentence concept description'),
          inspiredBy: z.object({
            trendName: z.string(),
            platform: z.string(),
            why: z.string().describe('Why this trend works for Tong'),
          }),
          hook: z.object({
            description: z.string().describe('What happens in the first 1-3 seconds'),
            type: z.enum(['question', 'reveal', 'pov', 'challenge', 'storytime', 'transformation', 'duet', 'sound_sync']),
          }),
          scenes: z.array(z.object({
            order: z.number(),
            description: z.string(),
            duration: z.number().describe('Seconds'),
            assetType: z.enum(['existing_scene', 'messaging_skin', 'exercise_capture', 'generated_video', 'generated_image', 'text_overlay']),
            city: z.string().optional(),
            locationId: z.string().optional(),
            generationPrompt: z.string().optional().describe('If asset needs generation, the prompt to use'),
          })),
          platformVariants: z.array(z.object({
            platform: z.enum(['tiktok', 'instagram', 'xiaohongshu', 'x']),
            format: z.string().describe('e.g. "9:16 Reel", "carousel", "text post with image"'),
            captionStyle: z.string(),
            hashtags: z.array(z.string()),
            soundStrategy: z.string().describe('trending sound, original VO, music, silent'),
            adaptationNotes: z.string(),
          })),
          production: z.object({
            effort: z.enum(['low', 'medium', 'high']),
            existingAssets: z.array(z.string()).describe('What can be reused from the game'),
            newAssets: z.array(z.string()).describe('What needs to be generated'),
            estimatedClips: z.number(),
          }),
          targetAudience: z.string(),
          callToAction: z.string(),
        }),
        execute: async (params) => {
          // Tool execution is a no-op — the structured output IS the result
          return { status: 'proposed', campaign: params };
        },
      }),

      suggest_backstage_brief: tool({
        description: 'Suggest content that should be generated in backstage to support campaigns',
        parameters: z.object({
          city: z.string(),
          contentType: z.enum(['backdrop', 'character', 'hangout_scene', 'messaging_script']),
          description: z.string(),
          aesthetic: z.string().describe('Visual style / mood aligned with trending aesthetics'),
          priority: z.enum(['must_have', 'nice_to_have']),
          relatedCampaigns: z.array(z.string()).describe('Which campaign names this supports'),
        }),
        execute: async (params) => {
          return { status: 'briefed', content: params };
        },
      }),
    },
    maxSteps: 10,
  });

  return result.toDataStreamResponse();
}
