import { Navbar } from "@/components/navbar"
import { OngoingBets } from "@/components/ongoing-bets"
import { UserStats } from "@/components/user-stats"
import { UsdcHbarChart } from "@/components/usdc-hbar-chart"
import { MarketList } from "@/components/market-list"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, DollarSign, Users } from "lucide-react"

export default function Page() {
  return (
    <main className="min-h-dvh flex flex-col">
      <Navbar />
      
      {/* Hero Section */}
      <section className="container mx-auto px-4 pt-6 md:pt-8">
        <div className="text-center space-y-4 mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Smart Contract Security Markets
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Predict vulnerabilities, earn rewards. Community-driven security analysis through prediction markets.
          </p>
        </div>
        <UserStats liveContests={3} totalPoolUSDC={1240.5} />
      </section>

      {/* Featured Markets */}
      <section className="container mx-auto px-4 py-6 md:py-8">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl md:text-3xl font-semibold">Featured Markets</h2>
              <p className="text-muted-foreground mt-1">High-liquidity and recently added markets</p>
            </div>
            <Badge variant="secondary" className="hidden md:flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              High Activity
            </Badge>
          </div>
        </div>
        
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card className="border-2 border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Total Volume
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">$7,585</div>
              <p className="text-sm text-muted-foreground">Across active markets</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Active Traders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1,247</div>
              <p className="text-sm text-muted-foreground">Participating in markets</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Markets Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">12</div>
              <p className="text-sm text-muted-foreground">New markets created</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-12">
          <div className="md:col-span-8">
            <div className="mb-6 md:mb-8">
              <h3 className="text-xl md:text-2xl font-semibold text-pretty">Recent Activity</h3>
              <p className="text-muted-foreground mt-1 md:mt-2">Latest betting opportunities and market updates.</p>
            </div>
            <OngoingBets />
          </div>

          <div className="mb-5 md:col-span-4">
            <UsdcHbarChart />
          </div>
        </div>
      </section>

      {/* All Markets */}
      <section className="container mx-auto px-4 pb-8 md:pb-10">
        <MarketList />
      </section>
    </main>
  )
}
