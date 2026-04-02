import { streamText, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * AI keyword/hashtag generator for the signals pipeline.
 *
 * Two modes:
 *   1. Autonomous — AI generates keyword sets based on game content catalog
 *   2. Directed — user provides topics/competitors, AI expands into platform-specific search terms
 *
 * Output: structured keyword sets per platform, ready to feed into signals scraper.
 */

const SYSTEM_PROMPT = `You are a social media research strategist for Tong — a dating-sim language learning game with cities in Seoul, Tokyo, and Shanghai.

Your job: generate targeted keyword sets and hashtags that the signals scraper will use to find relevant content on TikTok, Instagram, and Xiaohongshu.

Game context:
- Dating sim / visual novel aesthetic with anime-style characters
- CJK language learning (Korean, Japanese, Chinese)
- City-specific messaging skins (KakaoTalk, LINE, WeChat)
- Target audience: 18-35, interested in Asian languages, K-pop, anime, travel
- Game characters are romanceable NPCs in each city

When generating keywords:
1. Cover multiple angles: language learning, dating sims, the specific languages, cultural content, competitor apps, aesthetic trends
2. Include BOTH English and native-language hashtags (Korean/Japanese/Chinese)
3. Think about what CREATORS post, not just what users search
4. Include competitor/adjacent app names where relevant (Duolingo, Drops, etc.)
5. Add format-specific terms ("language POV", "learn Korean challenge", etc.)
6. For each platform, adapt to its culture:
   - TikTok: trending sounds, challenges, POV content
   - Instagram: aesthetic, carousel, Reels hooks
   - Xiaohongshu: lifestyle aesthetic, 笔记 style, 种草

Use the emit_keyword_set tool for EACH thematic cluster of keywords.`;

export async function POST(req: Request) {
  const body = await req.json();
  const { topics, competitors, languages, mode, messages } = body;

  const contextParts = [];
  if (topics?.length) contextParts.push(`User-specified topics to research: ${topics.join(', ')}`);
  if (competitors?.length) contextParts.push(`Competitors/adjacent brands to monitor: ${competitors.join(', ')}`);
  if (languages?.length) contextParts.push(`Focus languages: ${languages.join(', ')}`);
  if (mode === 'autonomous') contextParts.push('Mode: autonomous — generate a comprehensive daily keyword set covering all angles.');

  const systemMessage = [SYSTEM_PROMPT, '', ...contextParts].join('\n');

  const defaultPrompt = mode === 'autonomous'
    ? 'Generate a comprehensive set of keyword clusters for today\'s signal scraping. Cover language learning, dating sims, CJK culture, competitor landscape, and trending formats. Emit 5-8 keyword sets.'
    : `Generate targeted keyword sets for the specified topics. Emit a keyword set for each topic cluster.`;

  const result = streamText({
    model: openai('gpt-4o-mini'),
    system: systemMessage,
    messages: messages || [{ role: 'user', content: defaultPrompt }],
    tools: {
      emit_keyword_set: tool({
        description: 'Emit a themed cluster of search keywords and hashtags for the signals scraper',
        parameters: z.object({
          theme: z.string().describe('Short name for this keyword cluster, e.g. "korean_language_learning", "dating_sim_aesthetic"'),
          description: z.string().describe('What this cluster is designed to find'),
          keywords: z.object({
            global: z.array(z.string()).describe('English keywords that work across platforms'),
            tiktok: z.array(z.string()).describe('TikTok-specific hashtags and search terms'),
            instagram: z.array(z.string()).describe('Instagram hashtags and search terms'),
            xiaohongshu: z.array(z.string()).describe('XHS hashtags in Chinese + English'),
          }),
          priority: z.enum(['high', 'medium', 'low']).describe('How important this cluster is for today'),
          languages: z.array(z.string()).describe('Which target languages this covers: ko, ja, zh, en'),
          expectedContentTypes: z.array(z.string()).describe('What kind of content we expect to find: tutorial, entertainment, aesthetic, challenge, review'),
        }),
        execute: async (params) => ({ status: 'emitted', set: params }),
      }),
    },
    maxSteps: 12,
  });

  return result.toDataStreamResponse();
}
