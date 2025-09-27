import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Activity, ShieldCheck, Sparkles } from "lucide-react"
import { BetCard } from "./bet-card"

export function HeroSection() {
  return (
    <section aria-label="Hero" className="w-full border-b bg-card">
      <div className="container mx-auto px-4 py-10 md:py-14">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
            <span className="font-mono">alpha</span>
            <span className="h-1 w-1 rounded-full bg-foreground/60" />
            <span>Decentralized security wagers</span>
          </div>

          <h1 className="mt-4 text-3xl md:text-5xl font-semibold text-balance">
            Bet on Code Security Outcomes—On‑chain and Transparent
          </h1>
          <p className="mt-3 text-muted-foreground md:text-lg text-pretty">
            Discover live vulnerability contests across open-source repos. Back your insights, support maintainers, and
            track outcomes in real time.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Button asChild className="rounded-md">
              <Link href="#bets">Explore Bets</Link>
            </Button>
            <Button variant="outline" className="rounded-md bg-transparent">
              Create Contest
            </Button>
          </div>

          <div className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Activity className="size-4" />
                Live Contests
              </div>
              <div className="mt-1 text-2xl font-semibold">12</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="size-4" />
                Total Pool
              </div>
              <div className="mt-1 text-2xl font-semibold">7,135 USDC</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Activity className="size-4" />
                Avg. Time Left
              </div>
              <div className="mt-1 text-2xl font-semibold">36h</div>
            </div>
          </div>

          <div className="mt-8">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="size-4" />
              <span>Featured Bet</span>
            </div>
            <div className="mt-3">
              <BetCard
                layout="row"
                className="md:min-h-36"
                bet={{
                  id: "featured",
                  vulnerability: "Time-Of-Check to Time-Of-Use in Oracle Adapter",
                  repository: "oracle/price-adapter",
                  endsAt: new Date(Date.now() + 1000 * 60 * 60 * 30).toISOString(),
                  pool: "Total Pool: 4,250 USDC",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
