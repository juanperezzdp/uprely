import { LaptopMinimal, MoonStar, SunMedium } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/use-theme'
import type { Theme } from '@/types/theme'

const themeIcons: Record<Theme, typeof SunMedium> = {
  light: SunMedium,
  dark: MoonStar,
  system: LaptopMinimal,
}

const themeLabels: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
}

const themeOrder: Theme[] = ['dark', 'light', 'system']

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const Icon = themeIcons[theme]

  const handleToggle = () => {
    const currentIndex = themeOrder.indexOf(theme)
    const nextIndex = (currentIndex + 1) % themeOrder.length
    const nextTheme = themeOrder[nextIndex] ?? 'dark'

    setTheme(nextTheme)
  }

  return (
    <Button
      aria-label={`Cambiar tema. Actual: ${themeLabels[theme]}`}
      className="font-mono uppercase tracking-[0.2em]"
      onClick={handleToggle}
      size="sm"
      variant="secondary"
    >
      <Icon className="size-4" />
      {themeLabels[theme]}
    </Button>
  )
}
