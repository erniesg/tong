import { streamText, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * Studio AI — Agentic route that orchestrates multi-format content creation.
 *
 * The AI decides which tools to call based on the user's brief and inputs.
 * It can: segment subjects, generate backgrounds, compute layouts,
 * compose layers, and render to multiple platform formats.
 *
 * Input body:
 *   messages: chat messages
 *   brief: text description of what to create
 *   formats: array of format keys (e.g. ['instagram-story', 'linkedin-post'])
 *   subjectImageBase64?: base64 user photo (optional)
 *   characterAsset?: character asset path (optional)
 */

const SERVER_BASE = process.env.TONG_SERVER_URL || 'http://localhost:8787';

async function invokeServerTool(toolName: string, args: Record<string, unknown>) {
  const resp = await fetch(`${SERVER_BASE}/api/v1/tools/invoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool: toolName, args }),
  });
  return resp.json();
}

const SYSTEM_PROMPT = `You are an AI creative director for Tong Studio. You create multi-format visual content (posters, social media posts, thumbnails) by orchestrating tools.

You have access to these capabilities:
1. **Segment**: Extract subjects from photos (faces, people, objects) with SAM2
2. **Contour**: Generate outline/contour effects from segmentation masks
3. **Generate**: Create AI-generated backgrounds and images (via Seedream/Gemini)
4. **Layout**: Compute where subjects and text should be placed
5. **Composite**: Layer multiple elements (backgrounds, subjects, contours) together
6. **Render**: Output final compositions at exact platform dimensions via Remotion

When the user provides a brief:
1. Analyze what's needed — is there a subject photo? Multiple subjects? Just text?
2. Plan the composition — decide subject positions, text placement, effects
3. Execute the pipeline — call tools in the right sequence
4. Report results with the output formats

Key principles:
- Subject photos are NEVER sent to AI image generation — they're segmented and composited separately
- Text is always programmatic (via Remotion), never baked into generated images
- Always compute text-safe zones to avoid overlapping subjects
- Think creatively about composition: contour lines, drop shadows, multiple subjects at different scales

Available platform formats: instagram-story (1080x1920), instagram-post (1080x1080), instagram-reel (1080x1920), tiktok-video (1080x1920), linkedin-post (1200x628), linkedin-carousel (1080x1080), facebook-post (1200x628), facebook-story (1080x1920), twitter-post (1600x900), twitter-header (1500x500), youtube-thumbnail (1280x720), youtube-short (1080x1920), xiaohongshu-post (1080x1440).`;

export async function POST(req: Request) {
  const body = await req.json();
  const { messages, brief, formats, subjectImageBase64, characterAsset } = body;

  const contextParts = [SYSTEM_PROMPT];
  if (formats?.length) {
    contextParts.push(`\nTarget formats: ${formats.join(', ')}`);
  }
  if (subjectImageBase64) {
    contextParts.push('\nUser has provided a subject photo (available as subjectImageBase64 in context). Use segment.extract to process it.');
  }
  if (characterAsset) {
    contextParts.push(`\nCharacter asset requested: ${characterAsset}`);
  }

  const result = streamText({
    model: openai('gpt-4o'),
    system: contextParts.join('\n'),
    messages: messages || [
      { role: 'user', content: brief || 'Help me create multi-format content.' },
    ],
    tools: {
      // ── Planning tools ──────────────────────────────────────────
      plan_composition: tool({
        description: 'Plan the composition by computing subject layouts, text zones, and background requirements. Call this first to decide the approach.',
        parameters: z.object({
          formats: z.array(z.string()).describe('Target format keys'),
          subjects: z.array(z.object({
            id: z.string(),
            gravity: z.string().describe('Placement: bottom-center, center-left, center-right, etc.'),
            scale: z.number().describe('Fraction of canvas height (0.3 = small, 0.8 = large)'),
            type: z.enum(['user_photo', 'character_asset', 'extracted_object']),
          })).describe('Subjects to place in the composition'),
          textBlocks: z.array(z.object({
            content: z.string(),
            role: z.enum(['title', 'subtitle', 'body', 'cta']),
          })).describe('Text content to add'),
          backgroundPrompt: z.string().optional().describe('Prompt for AI-generated background'),
          style: z.string().optional().describe('Overall visual style'),
        }),
        execute: async (params) => {
          // Compute layouts for the first format (representative)
          const primaryFormat = params.formats[0] || 'instagram-story';
          const formatInfo = await invokeServerTool('compose.format_size', { format: primaryFormat });

          // Get format dimensions from compositor
          const formatsData = await invokeServerTool('compositor.formats.list', {});
          const fmtData = formatsData?.payload?.result?.find((f: any) => f.id === primaryFormat);
          const canvasWidth = fmtData?.width || 1080;
          const canvasHeight = fmtData?.height || 1920;

          // Compute subject layouts
          const subjectLayouts = params.subjects.length > 0
            ? await invokeServerTool('compose.multi_subject_layout', {
                subjects: params.subjects.map(s => ({
                  id: s.id,
                  gravity: s.gravity,
                  scale: s.scale,
                  aspect: s.type === 'character_asset' ? 0.56 : 0.65,
                })),
                canvasWidth,
                canvasHeight,
              })
            : { payload: { result: [] } };

          // Compute text-safe zones
          const layouts = subjectLayouts?.payload?.result || [];
          const textZones = await invokeServerTool('compose.text_safe_zones', {
            subjectLayouts: layouts,
            canvasWidth,
            canvasHeight,
          });

          // Build spatial prompt if background generation needed
          let spatialPrompt = null;
          if (params.backgroundPrompt && params.subjects.length > 0) {
            const primarySubject = params.subjects[0];
            const sp = await invokeServerTool('compose.spatial_prompt', {
              prompt: params.backgroundPrompt,
              subjectGravity: primarySubject.gravity,
              subjectScale: primarySubject.scale,
            });
            spatialPrompt = sp?.payload?.result?.enhancedPrompt;
          }

          return {
            status: 'planned',
            primaryFormat,
            canvasWidth,
            canvasHeight,
            subjectLayouts: layouts,
            textSafeZones: textZones?.payload?.result || [],
            spatialPrompt: spatialPrompt || params.backgroundPrompt,
            formatInfo: formatInfo?.payload?.result,
          };
        },
      }),

      // ── Rendering tools ─────────────────────────────────────────
      render_still: tool({
        description: 'Render a composition as a PNG at a specific platform format. Call after planning.',
        parameters: z.object({
          compositionId: z.enum(['EventPoster', 'SocialCard']),
          format: z.string().describe('Platform format key'),
          backgroundImageUrl: z.string().default('').describe('URL or empty for default gradient'),
          subjectImageUrl: z.string().optional().describe('Extracted subject PNG URL'),
          subjectGravity: z.string().default('bottom-center'),
          subjectScale: z.number().default(0.6),
          textBlocks: z.array(z.object({
            content: z.string(),
            fontSize: z.number().default(48),
            fontWeight: z.number().default(700),
            color: z.string().default('#FFFFFF'),
            x: z.number().default(0.5).describe('Normalized 0-1'),
            y: z.number().default(0.5).describe('Normalized 0-1'),
            textTransform: z.enum(['none', 'uppercase', 'lowercase']).default('none'),
          })),
          gradientEnabled: z.boolean().default(true),
          showSafeZones: z.boolean().default(false),
        }),
        execute: async (params) => {
          const result = await invokeServerTool('compositor.render.still', {
            compositionId: params.compositionId,
            format: params.format,
            background: { imageUrl: params.backgroundImageUrl },
            subject: params.subjectImageUrl ? {
              imageUrl: params.subjectImageUrl,
              gravity: params.subjectGravity,
              scale: params.subjectScale,
            } : undefined,
            text: params.textBlocks.map(t => ({
              content: t.content,
              fontSize: t.fontSize,
              fontWeight: t.fontWeight,
              color: t.color,
              position: { x: t.x, y: t.y, anchor: 'center' },
              textTransform: t.textTransform,
            })),
            gradient: params.gradientEnabled ? {
              enabled: true,
              direction: 'bottom-up',
              color: 'rgba(0,0,0,0.7)',
              height: 0.5,
            } : undefined,
            showSafeZones: params.showSafeZones,
          });
          return result?.payload || { ok: false, error: 'render failed' };
        },
      }),

      render_batch: tool({
        description: 'Render the same composition across multiple platform formats. Returns all output paths.',
        parameters: z.object({
          compositionId: z.enum(['EventPoster', 'SocialCard']),
          formats: z.array(z.string()),
          backgroundImageUrl: z.string().default(''),
          subjectImageUrl: z.string().optional(),
          subjectGravity: z.string().default('bottom-center'),
          subjectScale: z.number().default(0.6),
          textBlocks: z.array(z.object({
            content: z.string(),
            fontSize: z.number().default(48),
            fontWeight: z.number().default(700),
            color: z.string().default('#FFFFFF'),
            x: z.number().default(0.5),
            y: z.number().default(0.5),
            textTransform: z.enum(['none', 'uppercase', 'lowercase']).default('none'),
          })),
        }),
        execute: async (params) => {
          const result = await invokeServerTool('compositor.render.batch', {
            compositionId: params.compositionId,
            formats: params.formats,
            background: { imageUrl: params.backgroundImageUrl },
            subject: params.subjectImageUrl ? {
              imageUrl: params.subjectImageUrl,
              gravity: params.subjectGravity,
              scale: params.subjectScale,
            } : undefined,
            text: params.textBlocks.map(t => ({
              content: t.content,
              fontSize: t.fontSize,
              fontWeight: t.fontWeight,
              color: t.color,
              position: { x: t.x, y: t.y, anchor: 'center' },
              textTransform: t.textTransform,
            })),
          });
          return result?.payload || { ok: false, error: 'batch render failed' };
        },
      }),

      list_formats: tool({
        description: 'List available platform formats with dimensions',
        parameters: z.object({
          platform: z.string().optional().describe('Filter by platform'),
        }),
        execute: async (params) => {
          const result = await invokeServerTool('compositor.formats.list', {
            platform: params.platform,
          });
          return result?.payload?.result || [];
        },
      }),
    },
    maxSteps: 15,
  });

  return result.toDataStreamResponse();
}
