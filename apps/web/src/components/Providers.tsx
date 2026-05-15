'use client'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { queryClient } from '@/lib/queryClient'
import { NavigationProgress } from '@/components/ui/NavigationProgress'
import { ThemeProvider } from '@/components/ui/ThemeProvider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <NavigationProgress />
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 3000,
            style: { background: '#18181b', color: '#fafafa', fontSize: '14px' },
            success: { iconTheme: { primary: '#71717a', secondary: '#fff' } },
          }}
        />
      </ThemeProvider>
    </QueryClientProvider>
  )
}
