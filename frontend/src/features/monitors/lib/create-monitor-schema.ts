import { z } from 'zod'
import type { CreateMonitorPayload } from '@/services/monitors/monitor-service'

export const monitorFormTypeValues = ['HTTP', 'HTTPS', 'TCP', 'SSL', 'KEYWORD'] as const

export type MonitorFormType = (typeof monitorFormTypeValues)[number]

export type MonitorFormValues = {
  name: string
  type: MonitorFormType
  url: string
  intervalSeconds: string
  timeoutMs: string
  keywordExpected: string
  keywordMatchMode: 'must-exist' | 'must-not-exist'
  consecutiveFailuresThreshold: string
}

export function getDefaultMonitorFormValues(minIntervalSeconds: number): MonitorFormValues {
  return {
    name: '',
    type: 'HTTPS',
    url: '',
    intervalSeconds: String(Math.max(300, minIntervalSeconds)),
    timeoutMs: '10000',
    keywordExpected: '',
    keywordMatchMode: 'must-exist',
    consecutiveFailuresThreshold: '2',
  }
}

export function createMonitorSchema(minIntervalSeconds: number) {
  return z
    .object({
      name: z.string().trim().min(2, 'Name must have at least 2 characters.').max(120),
      type: z.enum(monitorFormTypeValues),
      url: z.string().trim().min(1, 'URL or target is required.').max(2048),
      intervalSeconds: z.coerce
        .number()
        .int('Interval must be an integer.')
        .min(
          minIntervalSeconds,
          `Interval must be at least ${minIntervalSeconds} seconds for your plan.`,
        ),
      timeoutMs: z.coerce
        .number()
        .int('Timeout must be an integer.')
        .min(100, 'Timeout must be at least 100 ms.')
        .max(120000, 'Timeout must be less than or equal to 120000 ms.'),
      keywordExpected: z.string().trim().max(2000),
      keywordMatchMode: z.enum(['must-exist', 'must-not-exist']),
      consecutiveFailuresThreshold: z.coerce
        .number()
        .int('Failure threshold must be an integer.')
        .min(1, 'Failure threshold must be at least 1.')
        .max(10, 'Failure threshold must be less than or equal to 10.'),
    })
    .superRefine((values, context) => {
      if (values.type === 'TCP') {
        if (!isTcpTarget(values.url)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['url'],
            message: 'TCP monitors require host:port or tcp://host:port.',
          })
        }

        return
      }

      const normalizedUrl = normalizeUrlByType(values.type, values.url)

      try {
        const parsedUrl = new URL(normalizedUrl)

        if (values.type === 'SSL' && parsedUrl.protocol !== 'https:') {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['url'],
            message: 'SSL monitors require an https URL.',
          })
        }

        if (
          (values.type === 'HTTP' || values.type === 'HTTPS' || values.type === 'KEYWORD') &&
          !['http:', 'https:'].includes(parsedUrl.protocol)
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['url'],
            message: 'The URL must use http or https.',
          })
        }
      } catch {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['url'],
          message: 'Enter a valid absolute URL.',
        })
      }

      if (values.type === 'KEYWORD' && values.keywordExpected.trim().length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['keywordExpected'],
          message: 'Keyword text is required for KEYWORD monitors.',
        })
      }
    })
}

export function toCreateMonitorPayload(values: MonitorFormValues): CreateMonitorPayload {
  const normalizedUrl = normalizeUrlByType(values.type, values.url)

  const payload: CreateMonitorPayload = {
    name: values.name.trim(),
    type: values.type === 'HTTPS' ? 'HTTP' : values.type,
    url: normalizedUrl,
    intervalSeconds: Number(values.intervalSeconds),
    timeoutMs: Number(values.timeoutMs),
    consecutiveFailuresThreshold: Number(values.consecutiveFailuresThreshold),
    isActive: true,
  }

  if (values.type === 'KEYWORD') {
    payload.keywordExpected = values.keywordExpected.trim()
    payload.keywordMustExist = values.keywordMatchMode === 'must-exist'
  }

  return payload
}

export function getMonitorTypeHelperText(type: MonitorFormType): string {
  switch (type) {
    case 'HTTP':
      return 'Checks HTTP targets. If you omit the protocol, http:// is applied.'
    case 'HTTPS':
      return 'Uses the HTTP monitor type with an https:// URL.'
    case 'TCP':
      return 'Checks host and port reachability, for example api.example.com:443.'
    case 'SSL':
      return 'Validates SSL certificates using an https:// URL.'
    case 'KEYWORD':
      return 'Fetches an HTTP page and verifies whether the keyword exists or not.'
  }
}

export function getMonitorTypePlaceholder(type: MonitorFormType): string {
  switch (type) {
    case 'HTTP':
      return 'http://example.com/health'
    case 'HTTPS':
      return 'https://example.com/health'
    case 'TCP':
      return 'api.example.com:443'
    case 'SSL':
      return 'https://example.com'
    case 'KEYWORD':
      return 'https://example.com/status'
  }
}

function normalizeUrlByType(type: MonitorFormType, rawValue: string): string {
  const trimmedValue = rawValue.trim()

  if (type === 'TCP') {
    return trimmedValue
  }

  if (/^[a-z]+:\/\//i.test(trimmedValue)) {
    return trimmedValue
  }

  if (type === 'HTTP') {
    return `http://${trimmedValue}`
  }

  return `https://${trimmedValue}`
}

function isTcpTarget(value: string): boolean {
  const normalizedValue = value.startsWith('tcp://') ? value : `tcp://${value}`

  try {
    const parsedUrl = new URL(normalizedValue)
    const port = Number(parsedUrl.port)

    return Boolean(parsedUrl.hostname) && Number.isInteger(port) && port >= 1 && port <= 65535
  } catch {
    return false
  }
}
