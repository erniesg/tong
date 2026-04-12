import { createReadStream } from 'node:fs'
import { access, stat } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]+$/

async function resolveVideosDir(): Promise<string> {
  const candidates = [
    path.resolve(process.cwd(), 'artifacts', 'videos'),
    path.resolve(process.cwd(), '..', '..', 'artifacts', 'videos'),
  ]

  for (const candidate of candidates) {
    try {
      await access(candidate)
      return candidate
    } catch {
      // Keep looking until we find the repo-level artifacts directory.
    }
  }

  return candidates[0]
}

function parseRangeHeader(rangeHeader: string | null, size: number) {
  if (!rangeHeader) return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim())
  if (!match) return 'invalid' as const

  const [, rawStart, rawEnd] = match
  let start = rawStart ? Number(rawStart) : NaN
  let end = rawEnd ? Number(rawEnd) : NaN

  if (Number.isNaN(start) && Number.isNaN(end)) return 'invalid' as const

  if (Number.isNaN(start)) {
    const suffixLength = end
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return 'invalid' as const
    start = Math.max(size - suffixLength, 0)
    end = size - 1
  } else if (Number.isNaN(end)) {
    end = size - 1
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'invalid' as const
  if (start < 0 || end < start || start >= size) return 'invalid' as const

  return { start, end: Math.min(end, size - 1) }
}

export async function GET(
  request: Request,
  { params }: { params: { videoId: string } },
) {
  const { videoId } = params

  if (!VIDEO_ID_PATTERN.test(videoId)) {
    return new Response('Invalid video id', { status: 400 })
  }

  const videosDir = await resolveVideosDir()
  const videoPath = path.join(videosDir, `${videoId}.mp4`)

  let fileStat
  try {
    fileStat = await stat(videoPath)
  } catch {
    return new Response('Video not found', { status: 404 })
  }

  const totalSize = fileStat.size
  const range = parseRangeHeader(request.headers.get('range'), totalSize)

  if (range === 'invalid') {
    return new Response('Requested range not satisfiable', {
      status: 416,
      headers: {
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes */${totalSize}`,
      },
    })
  }

  const start = range?.start ?? 0
  const end = range?.end ?? totalSize - 1
  const chunkSize = end - start + 1
  const stream = createReadStream(videoPath, { start, end })
  const headers = new Headers({
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=3600',
    'Content-Length': String(chunkSize),
    'Content-Type': 'video/mp4',
  })

  if (range) {
    headers.set('Content-Range', `bytes ${start}-${end}/${totalSize}`)
  }

  return new Response(Readable.toWeb(stream) as ReadableStream, {
    status: range ? 206 : 200,
    headers,
  })
}
