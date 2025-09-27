import { BetCard } from "./bet-card"

const bets = [
  {
    id: "1",
    vulnerability: "Reentrancy Vulnerability in Payment Module",
    repository: "org/payments-service",
    endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2 + 1000 * 45).toISOString(),
    pool: "Total Pool: 3400 USDC",
  },
  {
    id: "2",
    vulnerability: "Improper Input Validation — Auth Bypass",
    repository: "acme/auth-gateway",
    endsAt: new Date(Date.now() + 1000 * 60 * 60 * 8).toISOString(),
    pool: "Total Pool: 1275 USDC",
  },
  {
    id: "3",
    vulnerability: "Race Condition in Staking Rewards",
    repository: "dao/staking-contracts",
    endsAt: new Date(Date.now() + 1000 * 60 * 60 * 48 + 1000 * 60 * 15).toISOString(),
    pool: "Total Pool: 910 USDC",
  },
  {
    id: "4",
    vulnerability: "Privilege Escalation via Role Misconfig",
    repository: "monorepo/iam-service",
    endsAt: new Date(Date.now() + 1000 * 60 * 20).toISOString(),
    pool: "Total Pool: 550 USDC",
  },
]

export function OngoingBets() {
  return (
    <div id="bets" className="space-y-4">
      {bets.map((bet) => (
        <BetCard key={bet.id} bet={bet} layout="row" className="md:min-h-32" />
      ))}
    </div>
  )
}
