/**
 * Tencent Cloud Hunyuan 3D API client — full API surface.
 *
 * Services (all async submit+query unless noted):
 *   1. 3D Pro          – text/image → high-quality 3D model
 *   2. 3D Rapid        – text/image → fast 3D model
 *   3. Texture          – 3D model + reference → textured model
 *   4. Reduce Face      – high-poly → low-poly with clean topology
 *   5. UV Unwrap        – 3D model → UV-mapped model
 *   6. Part Generation  – 3D model → auto component split
 *   7. Profile to 3D    – photo + template → 3D character
 *   8. Format Convert   – OBJ/GLB/FBX → STL/USDZ/FBX/MP4/GIF (sync)
 *
 * Auth:
 *   - Pro uses OpenAI-compatible endpoint (API key auth) if TENCENT_HUNYUAN3D_API_KEY is set
 *   - All other APIs use TC3-HMAC-SHA256 signed requests to ai3d.tencentcloudapi.com
 *     (requires TENCENT_SECRET_ID + TENCENT_SECRET_KEY)
 *
 * API keys are read from environment variables and never exposed to the client.
 * Docs: https://cloud.tencent.com/document/product/1729
 */

import crypto from 'node:crypto';

// ── Configuration ────────────────────────────────────────────────────

// OpenAI-compatible endpoint (Pro only)
const COMPAT_API_BASE = 'https://api.ai3d.cloud.tencent.com/v1/ai3d';
const COMPAT_API_KEY = () => process.env.TENCENT_HUNYUAN3D_API_KEY || '';

// Standard TC3 endpoint (all APIs)
const TC3_HOST = 'ai3d.tencentcloudapi.com';
const TC3_SERVICE = 'ai3d';
const TC3_VERSION = '2025-05-13';
const TC3_REGION = () => process.env.TENCENT_AI3D_REGION || 'ap-guangzhou';
const SECRET_ID = () => process.env.TENCENT_SECRET_ID || '';
const SECRET_KEY = () => process.env.TENCENT_SECRET_KEY || '';

// In-memory job store for tracking
const jobs = new Map();

// ── TC3-HMAC-SHA256 Signing ──────────────────────────────────────────

function sha256hex(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

function hmacSha256(key, data) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

/**
 * Call the standard Tencent Cloud API with TC3-HMAC-SHA256 signing.
 *
 * @param {string} action  – e.g. 'SubmitHunyuanTo3DProJob'
 * @param {object} params  – request body (PascalCase keys per Tencent API spec)
 * @returns {Promise<object>} parsed JSON response
 */
async function tc3Call(action, params = {}) {
  const secretId = SECRET_ID();
  const secretKey = SECRET_KEY();
  if (!secretId || !secretKey) {
    throw new Error(
      'TENCENT_SECRET_ID and TENCENT_SECRET_KEY are required for this API. ' +
        'Set them in your .env file.',
    );
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const dateStr = new Date(timestamp * 1000).toISOString().slice(0, 10); // YYYY-MM-DD UTC
  const payload = JSON.stringify(params);
  const contentType = 'application/json; charset=utf-8';

  // Step 1: Canonical request
  const hashedPayload = sha256hex(payload);
  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${TC3_HOST}\n` +
    `x-tc-action:${action.toLowerCase()}\n`;
  const signedHeaders = 'content-type;host;x-tc-action';
  const canonicalRequest = [
    'POST',
    '/',
    '',
    canonicalHeaders,
    signedHeaders,
    hashedPayload,
  ].join('\n');

  // Step 2: String to sign
  const credentialScope = `${dateStr}/${TC3_SERVICE}/tc3_request`;
  const stringToSign = [
    'TC3-HMAC-SHA256',
    String(timestamp),
    credentialScope,
    sha256hex(canonicalRequest),
  ].join('\n');

  // Step 3: Signature
  const secretDate = hmacSha256(`TC3${secretKey}`, dateStr);
  const secretService = hmacSha256(secretDate, TC3_SERVICE);
  const secretSigning = hmacSha256(secretService, 'tc3_request');
  const signature = crypto
    .createHmac('sha256', secretSigning)
    .update(stringToSign, 'utf8')
    .digest('hex');

  // Step 4: Authorization header
  const authorization =
    `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(`https://${TC3_HOST}/`, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Type': contentType,
      Host: TC3_HOST,
      'X-TC-Action': action,
      'X-TC-Version': TC3_VERSION,
      'X-TC-Timestamp': String(timestamp),
      'X-TC-Region': TC3_REGION(),
    },
    body: payload,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Tencent AI3D API error (${response.status}): ${text}`);
  }

  const data = await response.json();

  if (data.Response?.Error) {
    throw new Error(
      `${action} failed: ${data.Response.Error.Code} – ${data.Response.Error.Message}`,
    );
  }

  return data;
}

// ── Helpers ──────────────────────────────────────────────────────────

function compatHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: COMPAT_API_KEY(),
  };
}

function normalizeJob(data, service) {
  const resp = data.Response || data;
  return {
    jobId: resp.JobId || null,
    status: resp.Status || null,
    errorCode: resp.ErrorCode || '',
    errorMessage: resp.ErrorMessage || '',
    resultFiles: (resp.ResultFile3Ds || []).map((f) => ({
      type: f.Type,
      url: f.Url,
      previewImageUrl: f.PreviewImageUrl || null,
    })),
    creditConsumed: resp.ResultCreditConsumed ?? null,
    creditDetails: resp.ResultCreditDetails || null,
    requestId: resp.RequestId || null,
    service,
  };
}

function assertInput(args, ...fields) {
  const hasAny = fields.some((f) => args[f]);
  if (!hasAny) {
    throw new Error(`One of ${fields.join(', ')} is required`);
  }
}

/**
 * Generic wait loop for any async job.
 */
async function waitForJob(queryFn, jobId, intervalMs, timeoutMs, label) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const job = await queryFn(jobId);
    if (job.status === 'DONE' || job.status === 'FAIL') return job;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`${label} job ${jobId} timed out after ${timeoutMs}ms`);
}

// ── Status ───────────────────────────────────────────────────────────

export function getHunyuan3dStatus() {
  const apiKey = COMPAT_API_KEY();
  const secretId = SECRET_ID();
  const secretKey = SECRET_KEY();
  return {
    compatEndpoint: {
      configured: !!apiKey,
      keyPrefix: apiKey ? apiKey.slice(0, 8) + '...' : null,
      supports: ['pro'],
    },
    tc3Endpoint: {
      configured: !!(secretId && secretKey),
      secretIdPrefix: secretId ? secretId.slice(0, 8) + '...' : null,
      supports: [
        'pro',
        'rapid',
        'texture',
        'reduceFace',
        'uv',
        'part',
        'profile',
        'convert',
      ],
    },
    activeJobs: jobs.size,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 1. 3D Pro — text/image → high-quality 3D
// ═══════════════════════════════════════════════════════════════════════

export async function submitHunyuan3dProJob(args) {
  // Prefer OpenAI-compatible endpoint if API key available
  if (COMPAT_API_KEY()) {
    return submitProViaCompat(args);
  }
  // Fall back to TC3 signed API
  const params = {};
  if (args.prompt) params.Prompt = args.prompt;
  if (args.imageUrl) params.ImageUrl = args.imageUrl;
  if (args.imageBase64) params.ImageBase64 = args.imageBase64;
  assertInput(params, 'Prompt', 'ImageUrl', 'ImageBase64');
  if (args.model) params.Model = args.model;
  if (args.enablePBR != null) params.EnablePBR = args.enablePBR;
  if (args.faceCount != null) params.FaceCount = args.faceCount;
  if (args.generateType) params.GenerateType = args.generateType;
  if (args.resultFormat) params.ResultFormat = args.resultFormat;
  if (args.polygonType) params.PolygonType = args.polygonType;

  const data = await tc3Call('SubmitHunyuanTo3DProJob', params);
  const job = normalizeJob(data, 'pro');
  if (job.jobId) jobs.set(job.jobId, job);
  return job;
}

async function submitProViaCompat(args) {
  const body = {};
  if (args.prompt) body.Prompt = args.prompt;
  if (args.imageUrl) body.ImageUrl = args.imageUrl;
  if (args.imageBase64) body.ImageBase64 = args.imageBase64;
  assertInput(body, 'Prompt', 'ImageUrl', 'ImageBase64');
  if (args.model) body.Model = args.model;
  if (args.enablePBR != null) body.EnablePBR = args.enablePBR;
  if (args.faceCount != null) body.FaceCount = args.faceCount;
  if (args.generateType) body.GenerateType = args.generateType;
  if (args.resultFormat) body.ResultFormat = args.resultFormat;

  const response = await fetch(`${COMPAT_API_BASE}/submit`, {
    method: 'POST',
    headers: compatHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Hunyuan 3D Pro submit error (${response.status}): ${text}`);
  }
  const data = await response.json();
  if (data.Response?.Error) {
    throw new Error(
      `Hunyuan 3D Pro submit failed: ${data.Response.Error.Code} – ${data.Response.Error.Message}`,
    );
  }
  const job = normalizeJob(data, 'pro');
  if (job.jobId) jobs.set(job.jobId, job);
  return job;
}

export async function queryHunyuan3dProJob(jobId) {
  if (COMPAT_API_KEY()) {
    const response = await fetch(`${COMPAT_API_BASE}/query`, {
      method: 'POST',
      headers: compatHeaders(),
      body: JSON.stringify({ JobId: jobId }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Hunyuan 3D Pro query error (${response.status}): ${text}`);
    }
    const data = await response.json();
    const job = normalizeJob(data, 'pro');
    job.jobId = jobId;
    jobs.set(jobId, job);
    return job;
  }
  const data = await tc3Call('QueryHunyuanTo3DProJob', { JobId: jobId });
  const job = normalizeJob(data, 'pro');
  job.jobId = jobId;
  jobs.set(jobId, job);
  return job;
}

export async function waitForHunyuan3dProJob(jobId, intervalMs = 5000, timeoutMs = 600000) {
  return waitForJob(queryHunyuan3dProJob, jobId, intervalMs, timeoutMs, 'Pro');
}

// ═══════════════════════════════════════════════════════════════════════
// 2. 3D Rapid — text/image → fast 3D
// ═══════════════════════════════════════════════════════════════════════

export async function submitHunyuan3dRapidJob(args) {
  const params = {};
  if (args.prompt) params.Prompt = args.prompt;
  if (args.imageUrl) params.ImageUrl = args.imageUrl;
  if (args.imageBase64) params.ImageBase64 = args.imageBase64;
  assertInput(params, 'Prompt', 'ImageUrl', 'ImageBase64');
  if (args.resultFormat) params.ResultFormat = args.resultFormat;
  if (args.enablePBR != null) params.EnablePBR = args.enablePBR;
  if (args.enableGeometry != null) params.EnableGeometry = args.enableGeometry;

  const data = await tc3Call('SubmitHunyuanTo3DRapidJob', params);
  const job = normalizeJob(data, 'rapid');
  if (job.jobId) jobs.set(job.jobId, job);
  return job;
}

export async function queryHunyuan3dRapidJob(jobId) {
  const data = await tc3Call('QueryHunyuanTo3DRapidJob', { JobId: jobId });
  const job = normalizeJob(data, 'rapid');
  job.jobId = jobId;
  jobs.set(jobId, job);
  return job;
}

export async function waitForHunyuan3dRapidJob(jobId, intervalMs = 3000, timeoutMs = 300000) {
  return waitForJob(queryHunyuan3dRapidJob, jobId, intervalMs, timeoutMs, 'Rapid');
}

// ═══════════════════════════════════════════════════════════════════════
// 3. Texture — 3D model + reference image/text → textured model
// ═══════════════════════════════════════════════════════════════════════

/**
 * @param {object} args
 * @param {object} args.file3d       - { type: 'OBJ'|'GLB', url: '...' }
 * @param {string} [args.prompt]     - Text description for texture
 * @param {object} [args.image]      - { url: '...' } or { base64: '...' } reference image
 * @param {string} [args.model]      - '3.0' | '3.1' (default '3.0')
 * @param {boolean} [args.enablePBR] - Enable PBR material
 */
export async function submitTextureJob(args) {
  if (!args.file3d?.type || !args.file3d?.url) {
    throw new Error('file3d with type and url is required');
  }
  const params = {
    File3D: { Type: args.file3d.type, Url: args.file3d.url },
  };
  if (args.prompt) params.Prompt = args.prompt;
  if (args.image) {
    const img = {};
    if (args.image.url) img.Url = args.image.url;
    if (args.image.base64) img.Base64 = args.image.base64;
    params.Image = img;
  }
  if (args.model) params.Model = args.model;
  if (args.enablePBR != null) params.EnablePBR = args.enablePBR;

  const data = await tc3Call('SubmitTextureTo3DJob', params);
  const job = normalizeJob(data, 'texture');
  if (job.jobId) jobs.set(job.jobId, job);
  return job;
}

export async function queryTextureJob(jobId) {
  const data = await tc3Call('DescribeTextureTo3DJob', { JobId: jobId });
  const job = normalizeJob(data, 'texture');
  job.jobId = jobId;
  jobs.set(jobId, job);
  return job;
}

export async function waitForTextureJob(jobId, intervalMs = 5000, timeoutMs = 600000) {
  return waitForJob(queryTextureJob, jobId, intervalMs, timeoutMs, 'Texture');
}

// ═══════════════════════════════════════════════════════════════════════
// 4. Reduce Face — high-poly → low-poly with clean topology
// ═══════════════════════════════════════════════════════════════════════

/**
 * @param {object} args
 * @param {object} args.file3d       - { type: 'OBJ'|'GLB', url: '...' }
 * @param {string} [args.polygonType] - 'triangle' | 'quadrilateral'
 * @param {string} [args.faceLevel]   - 'high' | 'medium' | 'low'
 */
export async function submitReduceFaceJob(args) {
  if (!args.file3d?.type || !args.file3d?.url) {
    throw new Error('file3d with type and url is required');
  }
  const params = {
    File3D: { Type: args.file3d.type, Url: args.file3d.url },
  };
  if (args.polygonType) params.PolygonType = args.polygonType;
  if (args.faceLevel) params.FaceLevel = args.faceLevel;

  const data = await tc3Call('SubmitReduceFaceJob', params);
  const job = normalizeJob(data, 'reduceFace');
  if (job.jobId) jobs.set(job.jobId, job);
  return job;
}

export async function queryReduceFaceJob(jobId) {
  const data = await tc3Call('DescribeReduceFaceJob', { JobId: jobId });
  const job = normalizeJob(data, 'reduceFace');
  job.jobId = jobId;
  jobs.set(jobId, job);
  return job;
}

export async function waitForReduceFaceJob(jobId, intervalMs = 5000, timeoutMs = 600000) {
  return waitForJob(queryReduceFaceJob, jobId, intervalMs, timeoutMs, 'ReduceFace');
}

// ═══════════════════════════════════════════════════════════════════════
// 5. UV Unwrap — 3D model → UV-mapped model with texture atlas
// ═══════════════════════════════════════════════════════════════════════

/**
 * @param {object} args
 * @param {object} args.file - { type: 'FBX'|'OBJ'|'GLB', url: '...' }
 */
export async function submitUVJob(args) {
  if (!args.file?.type || !args.file?.url) {
    throw new Error('file with type and url is required');
  }
  const params = {
    File: { Type: args.file.type, Url: args.file.url },
  };

  const data = await tc3Call('SubmitHunyuanTo3DUVJob', params);
  const job = normalizeJob(data, 'uv');
  if (job.jobId) jobs.set(job.jobId, job);
  return job;
}

export async function queryUVJob(jobId) {
  const data = await tc3Call('DescribeHunyuanTo3DUVJob', { JobId: jobId });
  const job = normalizeJob(data, 'uv');
  job.jobId = jobId;
  jobs.set(jobId, job);
  return job;
}

export async function waitForUVJob(jobId, intervalMs = 5000, timeoutMs = 600000) {
  return waitForJob(queryUVJob, jobId, intervalMs, timeoutMs, 'UV');
}

// ═══════════════════════════════════════════════════════════════════════
// 6. Part Generation — 3D model → auto component split
// ═══════════════════════════════════════════════════════════════════════

/**
 * @param {object} args
 * @param {object} args.file  - { type: 'FBX', url: '...' }
 * @param {string} [args.model] - '1.5' (default)
 */
export async function submitPartJob(args) {
  if (!args.file?.type || !args.file?.url) {
    throw new Error('file with type and url is required');
  }
  const params = {
    File: { Type: args.file.type, Url: args.file.url },
  };
  if (args.model) params.Model = args.model;

  const data = await tc3Call('SubmitHunyuan3DPartJob', params);
  const job = normalizeJob(data, 'part');
  if (job.jobId) jobs.set(job.jobId, job);
  return job;
}

export async function queryPartJob(jobId) {
  const data = await tc3Call('QueryHunyuan3DPartJob', { JobId: jobId });
  const job = normalizeJob(data, 'part');
  job.jobId = jobId;
  jobs.set(jobId, job);
  return job;
}

export async function waitForPartJob(jobId, intervalMs = 5000, timeoutMs = 600000) {
  return waitForJob(queryPartJob, jobId, intervalMs, timeoutMs, 'Part');
}

// ═══════════════════════════════════════════════════════════════════════
// 7. Profile to 3D — photo + template → 3D character
// ═══════════════════════════════════════════════════════════════════════

/**
 * @param {object} args
 * @param {object} args.profile  - { url: '...' } or { base64: '...' } — head photo
 * @param {string} args.template - template ID (e.g. 'basketball', 'pingpong', 'guitar')
 */
export async function submitProfileTo3dJob(args) {
  if (!args.profile?.url && !args.profile?.base64) {
    throw new Error('profile with url or base64 is required');
  }
  if (!args.template) {
    throw new Error('template is required');
  }
  const params = { Template: args.template };
  const profile = {};
  if (args.profile.url) profile.Url = args.profile.url;
  if (args.profile.base64) profile.Base64 = args.profile.base64;
  params.Profile = profile;

  const data = await tc3Call('SubmitProfileTo3DJob', params);
  const job = normalizeJob(data, 'profile');
  if (job.jobId) jobs.set(job.jobId, job);
  return job;
}

export async function queryProfileTo3dJob(jobId) {
  const data = await tc3Call('DescribeProfileTo3DJob', { JobId: jobId });
  const job = normalizeJob(data, 'profile');
  job.jobId = jobId;
  jobs.set(jobId, job);
  return job;
}

export async function waitForProfileTo3dJob(jobId, intervalMs = 5000, timeoutMs = 600000) {
  return waitForJob(queryProfileTo3dJob, jobId, intervalMs, timeoutMs, 'Profile');
}

// ═══════════════════════════════════════════════════════════════════════
// 8. Format Conversion — sync, returns URL directly
// ═══════════════════════════════════════════════════════════════════════

/**
 * Convert a 3D model to another format.
 *
 * @param {object} args
 * @param {string} args.file3dUrl - URL to source 3D file (OBJ/GLB/FBX, ≤60MB)
 * @param {string} args.format   - Target format: 'STL' | 'USDZ' | 'FBX' | 'MP4' | 'GIF'
 * @returns {Promise<object>} { resultUrl, requestId }
 */
export async function convert3dFormat(args) {
  if (!args.file3dUrl) throw new Error('file3dUrl is required');
  if (!args.format) throw new Error('format is required');

  const data = await tc3Call('Convert3DFormat', {
    File3D: args.file3dUrl,
    Format: args.format,
  });

  const resp = data.Response || data;
  return {
    resultUrl: resp.ResultFile3D || null,
    requestId: resp.RequestId || null,
  };
}
