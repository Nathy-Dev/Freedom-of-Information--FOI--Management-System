import { useCallback, useEffect, useRef, useState } from 'react'

export interface AsyncState<T> {
  data: T | undefined
  isLoading: boolean
  error: string | null
  reload: () => void
}

/**
 * Small query hook for the mock API. Every call is asynchronous on purpose so the
 * screens exercise their real loading and empty states before a backend exists.
 */
export function useAsync<T>(factory: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  const latest = useRef(0)

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    latest.current += 1
    const token = latest.current
    let cancelled = false

    setIsLoading(true)
    setError(null)

    factory()
      .then((result) => {
        if (cancelled || token !== latest.current) return
        setData(result)
      })
      .catch((cause: unknown) => {
        if (cancelled || token !== latest.current) return
        setError(cause instanceof Error ? cause.message : 'Something went wrong loading this view.')
      })
      .finally(() => {
        if (cancelled || token !== latest.current) return
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  return { data, isLoading, error, reload }
}

/** Debounces a fast-changing value — used by search boxes and filter inputs. */
export function useDebounced<T>(value: T, delayMs = 260): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}

/** Persists a small piece of UI state (column choices, tab, page size). */
export function useLocalState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(state))
    } catch {
      /* storage is unavailable in private browsing — state stays in memory */
    }
  }, [key, state])

  return [state, setState] as const
}
