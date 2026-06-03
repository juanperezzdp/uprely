export const themeValues = ['light', 'dark', 'system'] as const

export type Theme = (typeof themeValues)[number]
export type ResolvedTheme = Exclude<Theme, 'system'>
