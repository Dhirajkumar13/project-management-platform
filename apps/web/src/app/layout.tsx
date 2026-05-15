'use client'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { queryClient } from '@/lib/queryClient'
import { NavigationProgress } from '@/components/ui/NavigationProgress'
import { ThemeProvider } from '@/components/ui/ThemeProvider'
import './globals.css'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>ProjectFlow</title>
        <meta name="description" content="Multi-tenant project management platform" />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <NavigationProgress />
            {children}
            <Toaster
              position="bottom-right"
              toastOptions={{
                duration: 3000,
                style: { background: '#1e293b', color: '#f8fafc', fontSize: '14px' },
                success: { iconTheme: { primary: '#6366f1', secondary: '#fff' } },
              }}
            />
          </ThemeProvider>
        </QueryClientProvider>
      </body>
    </html>
  )
}
