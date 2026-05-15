'use client'
import { useEffect } from 'react'
import { useThemeStore, resolveTheme } from '@/store/theme.store'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const preference = useThemeStore((s) => s.preference)

  useEffect(() => {
    const apply = () => {
      const resolved = resolveTheme(preference)
      document.documentElement.classList.toggle('dark', resolved === 'dark')
    }

    apply()

    if (preference === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    }
  }, [preference])

  return <>{children}</>
}
