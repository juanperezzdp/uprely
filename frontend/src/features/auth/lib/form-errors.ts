import type { ZodError } from 'zod'

export type FormErrors<TField extends string> = Partial<Record<TField, string>>

export function getFieldErrors<TField extends string>(
  error: ZodError,
): FormErrors<TField> {
  const fieldErrors: FormErrors<TField> = {}

  for (const issue of error.issues) {
    const field = issue.path[0]

    if (typeof field === 'string' && !fieldErrors[field as TField]) {
      fieldErrors[field as TField] = issue.message
    }
  }

  return fieldErrors
}
