import { parseISO, todayISO, diffDays } from './date.js'

// Negative amounts show as −₹1,200 (sign before the currency symbol)
const sign = (n) => (n < 0 && Math.round(Math.abs(n)) !== 0 ? '−' : '')

export const formatINR = (n) =>
  sign(n) + '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.abs(n))

export const formatCr = (n) => `₹${n.toFixed(1)} Cr`

// ₹ amounts in lakh / crore, e.g. ₹4.2 L, ₹12.6 Cr
export function formatCompactINR(n) {
  const abs = Math.abs(n)
  if (abs >= 1e7) return `${sign(n)}₹${(abs / 1e7).toFixed(2)} Cr`
  if (abs >= 1e5) return `${sign(n)}₹${(abs / 1e5).toFixed(1)} L`
  return formatINR(n)
}

export const formatNumber = (n) => new Intl.NumberFormat('en-IN').format(n)

export const formatDate = (iso) =>
  parseISO(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

export const formatDateShort = (iso) =>
  parseISO(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })

export function relativeDay(iso) {
  const d = diffDays(todayISO(), iso.slice(0, 10))
  if (d === 0) return 'Today'
  if (d === -1) return 'Yesterday'
  if (d === 1) return 'Tomorrow'
  return d < 0 ? `${-d} days ago` : `in ${d} days`
}

// "Rupees Five Lakh Twenty Thousand Only" (Indian numbering: crore, lakh, thousand)
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
const twoDigits = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`)
const threeDigits = (n) => [n >= 100 ? `${ONES[Math.floor(n / 100)]} Hundred` : '', twoDigits(n % 100)].filter(Boolean).join(' ')

export function amountInWordsINR(amount) {
  let n = Math.round(Math.abs(amount))
  if (n === 0) return 'Rupees Zero Only'
  const parts = []
  const crore = Math.floor(n / 1e7); n %= 1e7
  const lakh = Math.floor(n / 1e5); n %= 1e5
  const thousand = Math.floor(n / 1e3); n %= 1e3
  if (crore) parts.push(`${crore >= 100 ? threeDigits(crore) : twoDigits(crore)} Crore`)
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`)
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`)
  if (n) parts.push(threeDigits(n))
  return `Rupees ${parts.join(' ')} Only`
}
