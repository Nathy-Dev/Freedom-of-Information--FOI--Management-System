import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Tailwind-aware class merge. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Stable pseudo-random generator so mock data is identical on every reload. */
export function seededRandom(seed: number) {
  let state = seed % 2147483647
  if (state <= 0) state += 2147483646
  return () => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
}

export function pick<T>(rand: () => number, list: readonly T[]): T {
  return list[Math.floor(rand() * list.length)]
}

export function range(n: number) {
  return Array.from({ length: n }, (_, i) => i)
}

export function unique<T>(list: T[]): T[] {
  return Array.from(new Set(list))
}

export function groupBy<T>(list: T[], key: (item: T) => string): Record<string, T[]> {
  return list.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item)
    ;(acc[k] ||= []).push(item)
    return acc
  }, {})
}

export function sum(list: number[]) {
  return list.reduce((a, b) => a + b, 0)
}

export function average(list: number[]) {
  return list.length ? sum(list) / list.length : 0
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function toggleIn<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

/** Simulated network latency so loading states are exercised in the prototype. */
export function delay(ms = 220) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
}

/** Deterministic id generator (avoids crypto/UUID churn between renders). */
let idCounter = 0
export function nextId(prefix: string) {
  idCounter += 1
  return `${prefix}-${String(idCounter).padStart(5, '0')}`
}

export function downloadTextFile(fileName: string, contents: string, mime = 'text/plain') {
  const blob = new Blob([contents], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

export function toCsv(headers: string[], rows: Array<Array<string | number | boolean | null>>) {
  const escapeCell = (cell: string | number | boolean | null) => {
    const value = cell === null || cell === undefined ? '' : String(cell)
    return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
  }
  return [headers.map(escapeCell).join(','), ...rows.map((row) => row.map(escapeCell).join(','))].join(
    '\n',
  )
}

export function highlight(text: string, term: string) {
  if (!term.trim()) return [{ text, match: false }]
  const parts = text.split(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'))
  return parts
    .filter((part) => part !== '')
    .map((part) => ({ text: part, match: part.toLowerCase() === term.toLowerCase() }))
}
