"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"

export default function BetActions() {
  const router = useRouter()
  const search = useSearchParams()

  const onYes = () => {
    // Navigate or open modal; keep logic entirely client-side
    // Example: carry through repo/deadline if present
    const repo = search.get("repo")
    const deadline = search.get("deadline")
    console.log("[v0] Bet Yes clicked", { repo, deadline }) // remove after debugging
  }

  const onNo = () => {
    const repo = search.get("repo")
    const deadline = search.get("deadline")
    console.log("[v0] Bet No clicked", { repo, deadline }) // remove after debugging
  }

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Bet actions">
      <Button onClick={onYes} className="min-w-24" aria-label="Bet Yes">
        Yes
      </Button>
      <Button variant="secondary" onClick={onNo} className="min-w-24" aria-label="Bet No">
        No
      </Button>
    </div>
  )
}
