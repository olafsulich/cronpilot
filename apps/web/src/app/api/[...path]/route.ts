import { getServerSession } from '@/lib/auth'
import { type NextRequest, NextResponse } from 'next/server'

function getApiUrl(): string {
  const url = process.env['API_INTERNAL_URL']
  if (!url) throw new Error('API_INTERNAL_URL is not set')
  return url
}

async function proxyRequest(req: NextRequest, params: { path: string[] }) {
  const session = await getServerSession()

  const path = params.path.join('/')
  const search = req.nextUrl.search
  const url = `${getApiUrl()}/${path}${search}`

  // Build headers to forward
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (session?.accessToken) {
    headers['Authorization'] = `Bearer ${session.accessToken}`
  }

  // Forward selected headers from client
  const contentType = req.headers.get('content-type')
  if (contentType) headers['Content-Type'] = contentType

  const fetchOptions: RequestInit = {
    method: req.method,
    headers,
    // Don't cache proxy responses
    cache: 'no-store',
  }

  // Forward body for non-GET/HEAD requests
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const body = await req.text()
    if (body) {
      fetchOptions.body = body
    }
  }

  try {
    const res = await fetch(url, fetchOptions)

    const responseHeaders = new Headers()
    responseHeaders.set('Content-Type', 'application/json')

    const text = await res.text()
    return new NextResponse(text, {
      status: res.status,
      headers: responseHeaders,
    })
  } catch (err: unknown) {
    const error = err as Error
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: error.message ?? 'Proxy error' } },
      { status: 502 },
    )
  }
}

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(req, params)
}

export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(req, params)
}

export async function PATCH(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(req, params)
}

export async function PUT(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(req, params)
}

export async function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(req, params)
}
