import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Tailwind-aware class merge. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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

export function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
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
