import { useCallback, useEffect, useState } from 'react'
import { getAccountantDashboard } from '../../services/accountantService.js'

/**
 * Loads Accountant Dashboard data for the given filters.
 * `preview` ('loading' | 'error' | 'empty') forces a UI state, for design review only.
 */
export function useAccountantDashboard(filters, preview) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, status: 'loading', error: null }))
    if (preview === 'loading') return undefined

    const request =
      preview === 'error'
        ? Promise.reject(new Error('Preview of the error state. No request was made.'))
        : getAccountantDashboard(preview === 'empty' ? { ...filters, projectId: '__none__' } : filters)

    request
      .then((data) => !cancelled && setState({ status: 'success', data, error: null }))
      .catch((error) => !cancelled && setState({ status: 'error', data: null, error }))

    return () => { cancelled = true }
  }, [filters, preview, attempt])

  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  return { ...state, reload }
}
