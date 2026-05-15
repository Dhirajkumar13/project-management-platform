'use client'
import { useState, useRef, useEffect } from 'react'
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
  disabled?: boolean
}

export function SelectDropdown({
  value, options, onChange, placeholder, variant = 'field', className, disabled,
}: Props) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0, minWidth: 0 })
  const wrapperRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const current = options.find((o) => o.value === value)
  const isActive = !!value && variant === 'chip'
  const displayLabel = current?.label ?? placeholder ?? ''

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (!wrapperRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleToggle = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setCoords({ top: rect.bottom + 4, left: rect.left, minWidth: rect.width })
    }
    setOpen((o) => !o)
  }

  const allOptions: SelectOption[] = placeholder
    ? [{ label: placeholder, value: '' }, ...options]
    : options

  const dropdown = open ? (
    <div
      ref={dropdownRef}
      style={{ position: 'fixed', top: coords.top, left: coords.left, minWidth: Math.max(coords.minWidth, 120), zIndex: 9999 }}
      className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden"
    >
      {allOptions.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => { onChange(opt.value); setOpen(false) }}
          className={cn(
            'flex items-center justify-between gap-3 w-full px-4 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors whitespace-nowrap',
            opt.value === value ? 'text-indigo-600 font-medium' : opt.value === '' ? 'text-gray-400' : 'text-gray-700'
          )}
        >
          <span className="flex items-center gap-2">
            {opt.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: opt.color }} />}
            {opt.label}
          </span>
          {opt.value === value && opt.value !== '' && <Check className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />}
        </button>
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
        className={cn(
          'flex items-center gap-1.5 text-sm font-medium transition-colors disabled:opacity-50',
          variant === 'chip'
            ? cn(
                'px-3 py-1.5 rounded-lg border',
                isActive
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
              )
            : 'w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:border-gray-300 justify-between'
        )}
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDown className={cn('w-3.5 h-3.5 flex-shrink-0 transition-transform text-gray-400', open && 'rotate-180')} />
      </button>

      {typeof window !== 'undefined' && createPortal(dropdown, document.body)}
    </div>
  )
}
