import { env } from '@/app/env'

type ApiRequestOptions = Omit<RequestInit, 'body' | 'headers'> & {
  body?: BodyInit | null | Record<string, unknown>
  headers?: HeadersInit
}

type ApiErrorPayload = {
  error?: string
  message?: string | string[]
  statusCode?: number
}

type ApiSuccessEnvelope<TData> = {
  success: true
  data: TData
}

export class ApiError extends Error {
  readonly payload: ApiErrorPayload | null
  readonly status: number

  constructor(status: number, message: string, payload: ApiErrorPayload | null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

export function buildApiUrl(path: string): string {
  const baseUrl = env.VITE_API_BASE_URL.trim()
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  if (/^https?:\/\//.test(normalizedBase)) {
    return new URL(normalizedPath, `${normalizedBase}/`).toString()
  }

  return `${normalizedBase}${normalizedPath}`
}

export async function apiClient<TResponse>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<TResponse> {
  const { body, headers, ...requestOptionsWithoutBody } = options
  const normalizedBody = normalizeRequestBody(body)
  const requestOptions: RequestInit = {
    credentials: 'include',
    ...requestOptionsWithoutBody,
    headers: {
      Accept: 'application/json',
      ...normalizedBody.headers,
      ...headers,
    },
  }

  if (normalizedBody.body !== undefined) {
    requestOptions.body = normalizedBody.body
  }

  const response = await fetch(buildApiUrl(path), requestOptions)

  if (!response.ok) {
    throw await createApiError(response)
  }

  if (response.status === 204) {
    return undefined as TResponse
  }

  return (await parseResponseBody(response)) as TResponse
}

async function createApiError(response: Response): Promise<ApiError> {
  const payload = (await safeParseJson(response)) as ApiErrorPayload | null
  const text = payload ? null : await safeReadText(response)
  const payloadMessage = getPayloadMessage(payload)
  const message =
    payloadMessage ?? text ?? `Request failed with status ${response.status}`

  return new ApiError(response.status, message, payload)
}

function getPayloadMessage(payload: ApiErrorPayload | null): string | null {
  if (!payload?.message) {
    return null
  }

  return Array.isArray(payload.message)
    ? payload.message.join(', ')
    : payload.message
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    const payload = (await response.json()) as unknown

    if (isApiSuccessEnvelope(payload)) {
      return payload.data
    }

    return payload
  }

  return response.text()
}

function isApiSuccessEnvelope(payload: unknown): payload is ApiSuccessEnvelope<unknown> {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  return (
    'success' in payload &&
    'data' in payload &&
    (payload as { success?: unknown }).success === true
  )
}

async function safeParseJson(response: Response): Promise<unknown | null> {
  const contentType = response.headers.get('content-type') ?? ''

  if (!contentType.includes('application/json')) {
    return null
  }

  try {
    return await response.json()
  } catch {
    return null
  }
}

async function safeReadText(response: Response): Promise<string | null> {
  try {
    const text = await response.text()

    return text.trim().length > 0 ? text : null
  } catch {
    return null
  }
}

function normalizeRequestBody(body: ApiRequestOptions['body']): {
  body: BodyInit | null | undefined
  headers: HeadersInit
} {
  if (!body) {
    return {
      body,
      headers: {},
    }
  }

  if (
    typeof body === 'string' ||
    body instanceof Blob ||
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    body instanceof ArrayBuffer ||
    body instanceof ReadableStream
  ) {
    return {
      body,
      headers: {},
    }
  }

  return {
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
  }
}
