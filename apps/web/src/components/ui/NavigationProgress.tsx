'use client'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

export function NavigationProgress() {
  const pathname = usePathname()
  const prevPathname = useRef(pathname)
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const doneRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const start = () => {
    setVisible(true)
    setProgress(15)
    tickRef.current = setInterval(() => {
      setProgress((p) => (p < 85 ? p + Math.random() * 8 : p))
    }, 250)
  }

  const finish = () => {
    if (tickRef.current) clearInterval(tickRef.current)
    setProgress(100)
    doneRef.current = setTimeout(() => {
      setVisible(false)
      setProgress(0)
    }, 350)
  }

  // Start on any internal link click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as Element).closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href') ?? ''
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto')) return
      if (anchor.getAttribute('target') === '_blank') return
      start()
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  // Finish when pathname changes (navigation settled)
  useEffect(() => {
    if (pathname !== prevPathname.current) {
      prevPathname.current = pathname
      finish()
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
      if (doneRef.current) clearTimeout(doneRef.current)
    }
  }, [pathname])

  if (!visible) return null

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-[9999] h-[3px] pointer-events-none"
    >
      <div
        className="h-full bg-indigo-500 transition-all ease-out"
        style={{
          width: `${progress}%`,
          transitionDuration: progress === 100 ? '200ms' : '250ms',
          boxShadow: '0 0 8px rgba(99,102,241,0.7)',
        }}
      />
    </div>
  )
}
