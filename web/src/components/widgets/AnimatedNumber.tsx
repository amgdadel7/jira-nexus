import { useEffect, useState } from 'react'
import { animate, useReducedMotion } from 'framer-motion'

export function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(reduce ? value : 0)

  useEffect(() => {
    if (reduce) {
      setShown(value)
      return
    }
    const controls = animate(shown, value, {
      duration: 0.55,
      ease: 'easeOut',
      onUpdate: (v) => setShown(Math.round(v)),
    })
    return () => controls.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduce])

  return (
    <span className="mono">
      {shown}
      {suffix}
    </span>
  )
}
