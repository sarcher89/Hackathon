'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'

export interface ComboboxOption {
  id: string
  label: string
  group?: string
}

interface Props {
  value: string
  onChange: (id: string) => void
  options: ComboboxOption[]
  placeholder?: string
  disabled?: boolean
}

export default function Combobox({
  value,
  onChange,
  options,
  placeholder = '—',
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const [mounted, setMounted] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, [])

  const selectedLabel = options.find(o => o.id === value)?.label ?? ''

  const filtered = query
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  function openDropdown() {
    if (!wrapperRef.current) return
    const rect = wrapperRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + 2, left: rect.left, width: rect.width })
    setQuery('')
    setHighlightedId(value || filtered[0]?.id || null)
    setOpen(true)
  }

  function closeDropdown() {
    setOpen(false)
    setQuery('')
  }

  function selectOption(id: string) {
    onChange(id)
    setOpen(false)
    setQuery('')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        openDropdown()
        e.preventDefault()
      }
      return
    }

    if (e.key === 'Escape') {
      closeDropdown()
      e.preventDefault()
      return
    }

    if (e.key === 'Enter') {
      if (highlightedId) selectOption(highlightedId)
      e.preventDefault()
      return
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const ids = filtered.map(o => o.id)
      const idx = highlightedId ? ids.indexOf(highlightedId) : -1
      const next =
        e.key === 'ArrowDown'
          ? Math.min(idx + 1, ids.length - 1)
          : Math.max(idx - 1, 0)
      const nextId = ids[next]
      setHighlightedId(nextId ?? null)
      const el = listRef.current?.querySelector<HTMLElement>(`[data-id="${nextId}"]`)
      el?.scrollIntoView({ block: 'nearest' })
    }
  }

  // Close on outside click (document-level, since dropdown is portalled)
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (wrapperRef.current?.contains(e.target as Node)) return
      if (listRef.current?.contains(e.target as Node)) return
      closeDropdown()
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  function renderItems() {
    if (filtered.length === 0) {
      return (
        <li className="px-3 py-2 text-xs text-slate-400 italic select-none">
          No matches
        </li>
      )
    }

    const items: React.ReactNode[] = []
    let lastGroup: string | undefined

    for (const opt of filtered) {
      if (opt.group && opt.group !== lastGroup) {
        lastGroup = opt.group
        items.push(
          <li
            key={`grp-${opt.group}`}
            className="sticky top-0 px-3 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wide bg-slate-50 select-none pointer-events-none"
          >
            {opt.group}
          </li>
        )
      }
      items.push(
        <li
          key={opt.id}
          data-id={opt.id}
          // preventDefault keeps focus on input so blur doesn't fire prematurely
          onMouseDown={e => {
            e.preventDefault()
            selectOption(opt.id)
          }}
          onMouseEnter={() => setHighlightedId(opt.id)}
          className={[
            'px-3 py-1.5 text-xs cursor-pointer select-none',
            highlightedId === opt.id ? 'bg-blue-50 text-blue-700' : 'text-slate-700',
            value === opt.id ? 'font-semibold' : '',
          ].join(' ')}
        >
          {opt.label}
        </li>
      )
    }

    return items
  }

  const dropdown =
    open && mounted
      ? createPortal(
          <ul
            ref={listRef}
            style={{ top: pos.top, left: pos.left, width: pos.width }}
            className="fixed z-50 max-h-52 overflow-y-auto rounded border border-slate-200 bg-white shadow-lg"
          >
            {renderItems()}
          </ul>,
          document.body
        )
      : null

  return (
    <div ref={wrapperRef}>
      <input
        ref={inputRef}
        type="text"
        value={open ? query : selectedLabel}
        placeholder={open ? selectedLabel || placeholder : placeholder}
        disabled={disabled}
        onFocus={openDropdown}
        onBlur={closeDropdown}
        onChange={e => {
          const q = e.target.value
          setQuery(q)
          const next = q
            ? options.filter(o => o.label.toLowerCase().includes(q.toLowerCase()))
            : options
          setHighlightedId(next[0]?.id ?? null)
        }}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        spellCheck={false}
        className={[
          'w-full rounded border px-2 py-1 text-xs transition-colors',
          'focus:outline-none focus:ring-1',
          'disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed',
          open
            ? 'border-blue-400 ring-1 ring-blue-400'
            : 'border-slate-200 focus:border-blue-400 focus:ring-blue-400',
        ].join(' ')}
      />
      {dropdown}
    </div>
  )
}
