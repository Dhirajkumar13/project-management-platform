'use client'
import { useState, useRef, useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SelectOption {
  label: string
  value: string
  color?: string
}

interface Props {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  variant?: 'chip' | 'field'
  className?: string
  triggerClassName?: string
  disabled?: boolean
}

export function SelectDropdown({
  value, options, onChange, placeholder, variant = 'field', className, triggerClassName, disabled,
}: Props) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [coords, setCoords] = useState({ top: 0, left: 0, minWidth: 0 })
  const wrapperRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()

  const allOptions: SelectOption[] = placeholder
    ? [{ label: placeholder, value: '' }, ...options]
    : options

  const current = allOptions.find((o) => o.value === value)
  const isActive = !!value && variant === 'chip'
  const displayLabel = current?.label ?? placeholder ?? ''

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (!wrapperRef.current?.contains(t) && !dropdownRef.current?.contains(t)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Reset active index when opening
  useEffect(() => {
    if (open) {
      const currentIdx = allOptions.findIndex((o) => o.value === value)
      setActiveIndex(currentIdx >= 0 ? currentIdx : 0)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setCoords({ top: rect.bottom + 4, left: rect.left, minWidth: rect.width })
    }
    setOpen((o) => !o)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        handleToggle()
      }
      return
    }
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); btnRef.current?.focus(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, allOptions.length - 1)); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); return }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (activeIndex >= 0) { onChange(allOptions[activeIndex].value); setOpen(false); btnRef.current?.focus() }
    }
    if (e.key === 'Home') { e.preventDefault(); setActiveIndex(0) }
    if (e.key === 'End') { e.preventDefault(); setActiveIndex(allOptions.length - 1) }
  }

  const select = (optValue: string) => {
    onChange(optValue)
    setOpen(false)
    btnRef.current?.focus()
  }

  const dropdown = open ? (
    <div
      ref={dropdownRef}
      role="listbox"
      id={listboxId}
      aria-label="Options"
      style={{ position: 'fixed', top: coords.top, left: coords.left, minWidth: Math.max(coords.minWidth, 120), zIndex: 9999 }}
      className="bg-white dark:bg-surface-card rounded-xl shadow-xl border border-gray-200 dark:border-white/[0.1] overflow-hidden"
    >
      {allOptions.map((opt, idx) => (
        <div
          key={opt.value}
          role="option"
          aria-selected={opt.value === value}
          onMouseDown={(e) => { e.preventDefault(); select(opt.value) }}
          onMouseEnter={() => setActiveIndex(idx)}
          className={cn(
            'flex items-center justify-between gap-3 w-full px-4 py-2.5 text-sm cursor-pointer transition-colors whitespace-nowrap',
            idx === activeIndex ? 'bg-zinc-100 dark:bg-surface-elevated' : 'hover:bg-gray-50 dark:hover:bg-surface-elevated',
            opt.value === value ? 'text-zinc-900 dark:text-white font-medium' : opt.value === '' ? 'text-gray-400' : 'text-gray-700 dark:text-zinc-200'
          )}
        >
          <span className="flex items-center gap-2">
            {opt.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: opt.color }} />}
            {opt.label}
          </span>
          {opt.value === value && opt.value !== '' && <Check className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100 flex-shrink-0" aria-hidden="true" />}
        </div>
      ))}
    </div>
  ) : null

  return (
    <div ref={wrapperRef} className={cn('relative', variant === 'chip' && 'w-fit', className)}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        className={cn(
          'flex items-center gap-1.5 transition-colors disabled:opacity-50',
          triggerClassName ?? (
            variant === 'chip'
              ? cn(
                  'text-sm font-medium px-3 py-1.5 rounded-lg border',
                  isActive
                    ? 'bg-zinc-900 border-zinc-800 text-white dark:bg-zinc-100 dark:border-zinc-200 dark:text-zinc-900'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:bg-surface-elevated dark:border-white/[0.1] dark:text-zinc-300'
                )
              : 'text-sm font-medium w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:border-gray-300 justify-between dark:bg-surface-elevated dark:border-white/[0.1] dark:text-zinc-200'
          )
        )}
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDown className={cn('w-3 h-3 flex-shrink-0 transition-transform opacity-50', open && 'rotate-180')} aria-hidden="true" />
      </button>

      {typeof window !== 'undefined' && createPortal(dropdown, document.body)}
    </div>
  )
}
