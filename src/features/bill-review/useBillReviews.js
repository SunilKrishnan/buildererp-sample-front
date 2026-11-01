import { useEffect, useState } from 'react'
import { getBillReviews } from '../../services/billReviewService.js'

/** Loads supplier bills with their order and site records (demo data). */
export function useBillReviews() {
  const [state, setState] = useState({ status: 'loading', data: null, error: null })
  useEffect(() => {
    let cancelled = false
    getBillReviews()
      .then((data) => !cancelled && setState({ status: 'success', data, error: null }))
      .catch((error) => !cancelled && setState({ status: 'error', data: null, error }))
    return () => { cancelled = true }
  }, [])
  return state
}
