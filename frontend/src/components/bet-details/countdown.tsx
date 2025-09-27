"use client"

import { useEffect, useMemo, useState } from "react"
export default function Countdown({ endAt }: { endAt: string }) {
  const end = useMemo(() => new Date(endAt).getTime(), [endAt])
  const [now, setNow] = useState<number>(Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  if (!end || isNaN(end)) return null
  const diff = Math.max(0, end - now)

  const seconds = Math.floor((diff / 1000) % 60)
  const minutes = Math.floor((diff / (1000 * 60)) % 60)
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  return (
    <span className="text-sm text-muted-foreground">
      {days}d {hours}h {minutes}m {seconds}s
    </span>
  )
}
