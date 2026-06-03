import { z } from 'zod'
import type { AlertContactType } from '@/types/alert'

const emailValueSchema = z
  .string()
  .trim()
  .min(1, 'Value is required.')
  .email('Enter a valid email address.')

const smsValueSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, 'Enter a valid E.164 phone number.')

const webhookValueSchema = z
  .string()
  .trim()
  .url('Enter a valid absolute URL.')
  .refine((value) => value.startsWith('http://') || value.startsWith('https://'), {
    message: 'Webhook URLs must use http or https.',
  })

export const alertContactSchema = z
  .object({
    type: z.enum(['EMAIL', 'SMS', 'WEBHOOK']),
    value: z.string().trim().min(1, 'Value is required.'),
  })
  .superRefine((values, context) => {
    const schema = getValueSchemaByType(values.type)
    const result = schema.safeParse(values.value)

    if (!result.success) {
      for (const issue of result.error.issues) {
        context.addIssue({
          code: 'custom',
          path: ['value'],
          message: issue.message,
        })
      }
    }
  })

export type AlertContactFormValues = z.infer<typeof alertContactSchema>

export function getPlaceholderByType(type: AlertContactType): string {
  switch (type) {
    case 'EMAIL':
      return 'alerts@company.com'
    case 'SMS':
      return '+15551234567'
    case 'WEBHOOK':
      return 'https://example.com/hooks/uprely'
  }
}

function getValueSchemaByType(type: AlertContactType) {
  switch (type) {
    case 'EMAIL':
      return emailValueSchema
    case 'SMS':
      return smsValueSchema
    case 'WEBHOOK':
      return webhookValueSchema
  }
}
