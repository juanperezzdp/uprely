import { themeValues, type Theme } from '@/types/theme'

const THEME_COOKIE_NAME = 'uptimewatch-theme'
const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365

export function readThemeCookie(): Theme | null {
  if (typeof document === 'undefined') {
    return null
  }

  const cookieValue = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${THEME_COOKIE_NAME}=`))
    ?.split('=')[1]

  if (!cookieValue) {
    return null
  }

  const decodedTheme = decodeURIComponent(cookieValue)

  return themeValues.includes(decodedTheme as Theme)
    ? (decodedTheme as Theme)
    : null
}

export function writeThemeCookie(theme: Theme) {
  if (typeof document === 'undefined') {
    return
  }

  document.cookie = `${THEME_COOKIE_NAME}=${encodeURIComponent(theme)}; path=/; max-age=${ONE_YEAR_IN_SECONDS}; samesite=lax`
}
