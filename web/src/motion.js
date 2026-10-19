// Motion helpers modelled on Atlassian Design System motion tokens
// (https://atlassian.design/foundations/motion):
//   durations  xxshort 50 · xshort 100 · short 150 · medium 200 · long 250 · xlong 400 ms
//   easings    out.bold (0,.4,0,1) · inout.bold (.4,0,0,1) · in.practical (.6,0,.8,.6) · out.practical (.4,1,.6,1)
// Entrances use bold curves and longer durations; exits are shorter with the practical ease-in.
import { useLayoutEffect, useRef } from 'react'

export const DUR = { xxshort: 50, xshort: 100, short: 150, medium: 200, long: 250, xlong: 400 }
export const EASE = {
  outBold: 'cubic-bezier(0, 0.4, 0, 1)',
  inoutBold: 'cubic-bezier(0.4, 0, 0, 1)',
  inPractical: 'cubic-bezier(0.6, 0, 0.8, 0.6)',
  outPractical: 'cubic-bezier(0.4, 1, 0.6, 1)',
}

export function reducedMotion() {
  if (document.documentElement.classList.contains('reduce-motion')) return true
  return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/* ------------------------------------------------------------------ exit "ghosts"
 * React unmounts popovers, modals and flags immediately. To animate them out without changing any
 * caller, we clone the DOM node at unmount and play the exit animation on the clone. The clone lives
 * in a *closed* shadow root so it never shows up in document queries, accessibility tree or tests. */
let ghostSheet = null
function sheet() {
  if (ghostSheet) return ghostSheet
  try {
    const css = [...document.styleSheets].map((s) => { try { return [...s.cssRules].map((r) => r.cssText).join('\n') } catch { return '' } }).join('\n')
    ghostSheet = new CSSStyleSheet()
    ghostSheet.replaceSync(css)
  } catch { ghostSheet = null }
  return ghostSheet
}
if (import.meta.hot) import.meta.hot.on('vite:afterUpdate', () => { ghostSheet = null })

/**
 * Plays an exit animation on a copy of `el`.
 * @param {Element} el       element that is about to be removed (still attached or just detached)
 * @param {object} o         { className: class added to the clone (drives the CSS exit animation), duration, pin }
 *                           pin = keep the clone at the element's current viewport position (for in-flow items)
 */
export function ghostOut(el, { className = 'ghost-exit', duration = DUR.medium, pin = false, rect: knownRect } = {}) {
  if (!el || reducedMotion() || !el.isConnected && !knownRect) return
  try {
    const rect = knownRect || el.getBoundingClientRect()
    if (!rect.width && !rect.height) return
    const host = document.createElement('div')
    host.setAttribute('aria-hidden', 'true')
    host.inert = true
    host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483000;contain:layout style;'
    const root = host.attachShadow({ mode: 'closed' })
    const s = sheet()
    if (s) root.adoptedStyleSheets = [s]
    const clone = el.cloneNode(true)
    // keep scroll positions (cloneNode doesn't copy them)
    const src = [el, ...el.querySelectorAll('*')]
    const dst = [clone, ...clone.querySelectorAll('*')]
    const scrolls = []
    src.forEach((n, i) => { if (n.scrollTop || n.scrollLeft) scrolls.push([dst[i], n.scrollTop, n.scrollLeft]) })
    if (pin) Object.assign(clone.style, { position: 'fixed', top: `${rect.top}px`, left: `${rect.left}px`, width: `${rect.width}px`, height: `${rect.height}px`, margin: '0', zIndex: '1' })
    clone.classList.add(className)
    root.appendChild(clone)
    document.body.appendChild(host)
    scrolls.forEach(([n, t, l]) => { n.scrollTop = t; n.scrollLeft = l })
    setTimeout(() => host.remove(), duration + 40)
  } catch { /* motion is decoration only */ }
}

/** Hook: when the component unmounts, animate its root element out with a ghost. */
export function useExitGhost(ref, options) {
  const opts = useRef(options)
  opts.current = options
  useLayoutEffect(() => {
    const el = ref.current
    return () => {
      // capture geometry now: the node is still in the document during layout-effect cleanup
      let rect = null
      try { rect = el?.getBoundingClientRect() } catch { /* ignore */ }
      ghostOut(el, { ...opts.current, rect })
    }
  }, [ref])
}

/* ------------------------------------------------------------------ FLIP reposition
 * Smoothly moves children (with data-flip-key) from their previous to their new position after a
 * re-render, e.g. flags shifting when one is dismissed (motion.flag.reposition). */
export function useFlip(containerRef, deps, { duration = DUR.long, easing = EASE.inoutBold } = {}) {
  const last = useRef(new Map())
  useLayoutEffect(() => {
    const box = containerRef.current
    if (!box) return
    const next = new Map()
    box.querySelectorAll('[data-flip-key]').forEach((n) => next.set(n.dataset.flipKey, n.getBoundingClientRect()))
    if (!reducedMotion()) {
      box.querySelectorAll('[data-flip-key]').forEach((n) => {
        const prev = last.current.get(n.dataset.flipKey)
        const now = next.get(n.dataset.flipKey)
        if (!prev || !now) return
        const dx = prev.left - now.left; const dy = prev.top - now.top
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return
        n.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration, easing })
      })
    }
    last.current = next
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
}

/* ------------------------------------------------------------------ flash
 * Brief highlight after something moved or was created (Jira's post-drop "flash"). Waits for the
 * element to render (up to ~1.5 s) so callers can fire it right after a mutation. */
export function flash(selectorOrEl, { className = 'motion-flash', duration = 1200 } = {}) {
  let tries = 0
  const run = () => {
    const el = typeof selectorOrEl === 'string' ? document.querySelector(selectorOrEl) : selectorOrEl
    if (!el) { if (tries++ < 30) setTimeout(run, 50); return }
    el.classList.remove(className)
    void el.offsetWidth // restart the animation
    el.classList.add(className)
    setTimeout(() => el.classList.remove(className), duration)
  }
  run()
}
export const flashIssue = (key) => {
  const sel = `[data-issue-key="${String(key).replace(/"/g, '')}"]`
  flash(sel)
}

/* ------------------------------------------------------------------ tooltips
 * ADS-style tooltips for every element with a `title`: dark, small, 300 ms show delay, instant when
 * moving between tooltipped elements, fade + 4px slide. The native title is moved aside only while
 * our tooltip is visible (so selectors like button[title=…] keep working) and restored on hide. */
export function installTooltips() {
  if (window.__masarTooltips) return
  window.__masarTooltips = true
  const SHOW_DELAY = 300
  let timer = null; let hideTimer = null; let current = null; let tip = null; let lastHidden = 0
  const suppressed = new WeakSet() // pressed elements don't re-show until the pointer leaves

  const restore = (el) => {
    if (!el) return
    const t = el.getAttribute('data-tip-title')
    if (t !== null) {
      if (!el.hasAttribute('title')) el.setAttribute('title', t)
      el.removeAttribute('data-tip-title')
    }
  }
  const hide = (immediate = false) => {
    clearTimeout(timer); timer = null
    if (current) { restore(current); lastHidden = Date.now() }
    current = null
    if (tip) {
      const t = tip; tip = null
      if (immediate || reducedMotion()) t.remove()
      else { t.classList.add('leaving'); setTimeout(() => t.remove(), DUR.xshort + 20) }
    }
  }
  const place = (el, node) => {
    const r = el.getBoundingClientRect()
    const w = node.offsetWidth; const h = node.offsetHeight
    let top = r.bottom + 6; let side = 'bottom'
    if (top + h > window.innerHeight - 4) { top = r.top - h - 6; side = 'top' }
    let left = r.left + r.width / 2 - w / 2
    left = Math.max(4, Math.min(left, window.innerWidth - w - 4))
    node.style.top = `${Math.round(top)}px`; node.style.left = `${Math.round(left)}px`
    node.dataset.side = side
  }
  const show = (el) => {
    if (!el.isConnected) return
    const text = el.getAttribute('title')
    if (!text || !text.trim()) return
    hide(true)
    current = el
    el.setAttribute('data-tip-title', text)
    el.removeAttribute('title')
    tip = document.createElement('div')
    tip.className = 'masar-tooltip'
    tip.setAttribute('role', 'tooltip')
    tip.textContent = text
    document.body.appendChild(tip)
    place(el, tip)
  }
  const target = (e) => {
    const el = e.target?.closest?.('[title], [data-tip-title]')
    if (!el || el.closest('svg') === el || el.tagName === 'IFRAME' || el.hasAttribute('data-no-tooltip')) return null
    return el
  }
  document.addEventListener('mouseover', (e) => {
    const el = target(e)
    if (el === current && el) return
    if (!el) { if (current || timer) { clearTimeout(hideTimer); hideTimer = setTimeout(() => hide(), 0) } return }
    if (suppressed.has(el)) return
    clearTimeout(hideTimer)
    if (current && current !== el) hide(true)
    clearTimeout(timer)
    const quick = Date.now() - lastHidden < 400 // moving along a toolbar: show immediately
    timer = setTimeout(() => show(el), quick ? 0 : SHOW_DELAY)
  }, true)
  document.addEventListener('mouseout', (e) => {
    const el = target(e)
    if (!el) return
    if (e.relatedTarget && el.contains(e.relatedTarget)) return
    suppressed.delete(el)
    if (el === current || timer) hide()
  }, true)
  const pressHide = (e) => { const el = target(e); if (el) suppressed.add(el); hide(true) }
  document.addEventListener('mousedown', pressHide, true)
  document.addEventListener('keydown', () => hide(true), true)
  document.addEventListener('scroll', () => hide(true), true)
  window.addEventListener('blur', () => hide(true))
  // if the hovered element disappears (re-render, navigation), drop the tooltip
  setInterval(() => { if (current && !current.isConnected) hide(true) }, 500)
}

/* ------------------------------------------------------------------ theme */
export function applyTheme(theme, { animate = false } = {}) {
  const root = document.documentElement
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches)
  if (animate && !reducedMotion()) {
    root.classList.add('theme-transition')
    setTimeout(() => root.classList.remove('theme-transition'), 450)
  }
  root.dataset.theme = dark ? 'dark' : 'light'
  root.style.colorScheme = dark ? 'dark' : 'light'
  try { localStorage.setItem('masar.theme', theme) } catch { /* ignore */ }
}
export function applyReduceMotion(on) {
  document.documentElement.classList.toggle('reduce-motion', !!on)
  try { localStorage.setItem('masar.reduceMotion', on ? '1' : '0') } catch { /* ignore */ }
}
