import { z } from 'zod'

export const statusPageSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(120),
  slug: z
    .string()
    .trim()
    .min(3, 'Slug must be at least 3 characters.')
    .max(64)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Slug must use lowercase letters, numbers and single hyphens.',
    ),
  description: z.string().trim().max(500).optional(),
  isPublic: z.boolean(),
  monitorIds: z.array(z.string().uuid()).max(100),
})

export type StatusPageFormValues = z.infer<typeof statusPageSchema>
