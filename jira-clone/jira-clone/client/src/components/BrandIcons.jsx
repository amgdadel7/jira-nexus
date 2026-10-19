import React from 'react'

// Official-looking marks for the social sign-in buttons (inline SVG, no network needed).
export function GoogleIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}
export function MicrosoftIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="1" y="1" width="10.5" height="10.5" fill="#F25022" />
      <rect x="12.5" y="1" width="10.5" height="10.5" fill="#7FBA00" />
      <rect x="1" y="12.5" width="10.5" height="10.5" fill="#00A4EF" />
      <rect x="12.5" y="12.5" width="10.5" height="10.5" fill="#FFB900" />
    </svg>
  )
}
export function AppleIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#000" d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.87-.76-1.47.02-2.83.86-3.59 2.18-1.53 2.66-.39 6.6 1.1 8.75.73 1.05 1.6 2.24 2.73 2.2 1.1-.05 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.4 1.2-2.46-.03-.01-2.3-.88-2.32-3.5zM14.2 6.13c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.31-.56.65-1.05 1.68-.92 2.67.97.08 1.96-.49 2.56-1.22z" />
    </svg>
  )
}
export function SlackIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 54 54" aria-hidden="true">
      <path fill="#36C5F0" d="M19.7 3.4a5.6 5.6 0 0 0 0 11.2h5.6V9a5.6 5.6 0 0 0-5.6-5.6zm0 15H4.8a5.6 5.6 0 0 0 0 11.2h14.9a5.6 5.6 0 0 0 0-11.2z" />
      <path fill="#2EB67D" d="M50.6 24a5.6 5.6 0 0 0-11.2 0v5.6H45a5.6 5.6 0 0 0 5.6-5.6zm-15 0V9a5.6 5.6 0 0 0-11.2 0v15a5.6 5.6 0 0 0 11.2 0z" />
      <path fill="#ECB22E" d="M30 50.6a5.6 5.6 0 0 0 0-11.2h-5.6V45a5.6 5.6 0 0 0 5.6 5.6zm0-15h15a5.6 5.6 0 0 0 0-11.2H30a5.6 5.6 0 0 0 0 11.2z" />
      <path fill="#E01E5A" d="M3.4 30a5.6 5.6 0 0 0 11.2 0v-5.6H9A5.6 5.6 0 0 0 3.4 30zm15 0v15a5.6 5.6 0 0 0 11.2 0V30a5.6 5.6 0 0 0-11.2 0z" />
    </svg>
  )
}
export const PROVIDER_ICONS = { google: GoogleIcon, microsoft: MicrosoftIcon, apple: AppleIcon, slack: SlackIcon }

export function CardBrandIcon({ brand, width = 34 }) {
  const b = String(brand || '').toLowerCase()
  const h = Math.round(width * 0.66)
  const box = (fill, children) => <svg width={width} height={h} viewBox="0 0 36 24" aria-label={brand} role="img"><rect width="36" height="24" rx="4" fill={fill} stroke="#DCDFE4" />{children}</svg>
  if (b === 'visa') return box('#fff', <text x="18" y="16.5" textAnchor="middle" fontFamily="Arial" fontWeight="900" fontStyle="italic" fontSize="10.5" fill="#1A1F71">VISA</text>)
  if (b === 'mastercard') return box('#fff', <><circle cx="14.5" cy="12" r="6.5" fill="#EB001B" /><circle cx="21.5" cy="12" r="6.5" fill="#F79E1B" fillOpacity=".9" /></>)
  if (b === 'amex') return box('#2E77BC', <text x="18" y="15.5" textAnchor="middle" fontFamily="Arial" fontWeight="900" fontSize="8" fill="#fff">AMEX</text>)
  if (b === 'discover') return box('#fff', <><text x="15" y="15" textAnchor="middle" fontFamily="Arial" fontWeight="700" fontSize="6.5" fill="#231F20">DISC</text><circle cx="27" cy="12" r="4" fill="#F48120" /></>)
  return box('#F1F2F4', <><rect x="5" y="7" width="26" height="3" fill="#8590A2" /><rect x="5" y="14" width="10" height="3" rx="1" fill="#B3B9C4" /></>)
}
