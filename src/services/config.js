// Where the dashboard gets its data from.
// 'demo' = local illustrative fixtures (this phase). No backend exists yet.
export const DATA_SOURCE = import.meta.env.VITE_DATA_SOURCE || 'demo'
export const IS_DEMO = DATA_SOURCE === 'demo'

// Base URL for the future backend, e.g. VITE_API_BASE_URL=https://erp.example.com/api
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
