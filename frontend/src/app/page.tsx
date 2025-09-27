import { Navbar } from "@/components/navbar"
import { OngoingBets } from "@/components/ongoing-bets"
import { UserStats } from "@/components/user-stats"
import { UsdcHbarChart } from "@/components/usdc-hbar-chart"

export default function Page() {
  return (
    <main className="min-h-dvh flex flex-col">
      <Navbar />
      <section className="container mx-auto px-4 pt-6 md:pt-8">
        <UserStats liveContests={3} totalPoolUSDC={1240.5} />
      </section>

      <section className="container mx-auto px-4 pb-8 md:pb-10">
        <div className="grid gap-6 md:grid-cols-12">
          <div className="md:col-span-8">
            <div className="mb-6 md:mb-8">
              <h2 className="text-2xl md:text-3xl font-semibold text-pretty">Ongoing Bets</h2>
              <p className="text-muted-foreground mt-1 md:mt-2">Explore active contests and place your bets.</p>
            </div>
            <OngoingBets />
          </div>

          <div className=" mb-5  md:col-span-4">
            <UsdcHbarChart />
          </div>
        </div>
      </section>
    </main>
  )
}
