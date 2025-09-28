import Link from "next/link"
import { Suspense } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Countdown from "@/components/bet-details/countdown"
import RepoInfo from "@/components/bet-details/repo-info"
import BetActions from "@/components/bet-details/bet-actions"
import ContractFileCard from "@/components/bet-details/contract-file-card" // Import ContractFileCard

export default async function BetDetailsPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { repo?: string; deadline?: string }
}) {
  const betId = params.id
  // Optional: repo is "owner/repo" for GitHub info. If omitted, shows placeholders.
  const repoFullName = searchParams.repo || ""
  // Optional deadline ISO string for countdown
  const deadline = searchParams.deadline || ""

  // Mock user-specific stats (replace with real data later)
  const userStats = {
    liveContests: 2,
    totalPoolUSD: 1243.56,
  }

  // Mock code files; replace with real file list later
  const files = [
    {
      name: "Vault.sol",
      code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Vault {
  mapping(address => uint256) public balances;

  function deposit() external payable {
    balances[msg.sender] += msg.value;
  }

  function withdraw(uint256 amount) external {
    require(balances[msg.sender] >= amount, "Insufficient");
    balances[msg.sender] -= amount;
    (bool ok,) = msg.sender.call{value: amount}("");
    require(ok, "Withdraw failed");
  }
}
`,
    },
    {
      name: "BetPool.sol",
      code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract BetPool {
  struct Bet {
    address user;
    uint256 amount;
    bool choice;
  }

  Bet[] public bets;
  uint256 public totalYes;
  uint256 public totalNo;

  function placeBet(bool choice) external payable {
    bets.push(Bet(msg.sender, msg.value, choice));
    if (choice) totalYes += msg.value; else totalNo += msg.value;
  }
}
`,
    },
  ]

  // Mock pool/odds; replace with real on-chain data later
  const pool = { total: 3200, yes: 1900, no: 1300 }
  const yesOdds = pool.total > 0 ? pool.total / Math.max(pool.yes, 1) : 0
  const noOdds = pool.total > 0 ? pool.total / Math.max(pool.no, 1) : 0

  return (
    <main className="container mx-auto max-w-6xl px-4 py-6 space-y-6">
      {/* Back + Optional Countdown */}
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4">
          ← Back to Bets
        </Link>
        {deadline ? (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Time left</Badge>
            <Countdown endAt={deadline} />
          </div>
        ) : null}
      </div>

      {/* User-focused stats */}
      <section aria-label="Your Stats" className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="col-span-1">
          <CardHeader className="pb-2">
            <CardDescription>Live Contests</CardDescription>
            <CardTitle className="text-3xl">{userStats.liveContests}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Contests you’re currently participating in.</p>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardHeader className="pb-2">
            <CardDescription>Your Total Pool</CardDescription>
            <CardTitle className="text-3xl">
              ${userStats.totalPoolUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Combined stake amount across your active bets.</p>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardHeader className="pb-2">
            <CardDescription>Bet ID</CardDescription>
            <CardTitle className="text-3xl">{betId}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Unique identifier for this bet.</p>
          </CardContent>
        </Card>
      </section>

      {/* Repository Info */}
      <section aria-label="Repository Info">
        <Card>
          <CardHeader>
            <CardTitle className="text-balance">Company / Repository</CardTitle>
            <CardDescription>Details from GitHub if available</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="text-sm text-muted-foreground">Loading repository…</div>}>
              <RepoInfo repoFullName={repoFullName} />
            </Suspense>
          </CardContent>
        </Card>
      </section>

      {/* Code Files */}
      <section aria-label="Smart Contract Files" className="space-y-4">
        <h2 className="text-lg font-medium">Smart Contract / Code Files</h2>
        {files.map((f) => (
          <ContractFileCard key={f.name} fileName={f.name} code={f.code} />
        ))}
      </section>

      {/* Betting / Voting */}
      <section aria-label="Betting" className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Do you want to bet on this vulnerability?</CardTitle>
            <CardDescription>Place your position</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              <div>Total pool: ${pool.total.toLocaleString()}</div>
              <div>
                Yes pool: ${pool.yes.toLocaleString()} (approx. 1:{yesOdds.toFixed(2)})
              </div>
              <div>
                No pool: ${pool.no.toLocaleString()} (approx. 1:{noOdds.toFixed(2)})
              </div>
            </div>
            <div className="flex items-center gap-2">
              <BetActions />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Notes & Disclosures</CardTitle>
            <CardDescription>Before you proceed</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Bets are final once submitted. Ensure you’ve reviewed the contracts and repository history.</p>
            <p>Returns depend on total pool distribution at settlement. Gas/fees may apply.</p>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
