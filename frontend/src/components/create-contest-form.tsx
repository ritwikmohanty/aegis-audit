"use client"

import * as React from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

type Mode = "repo" | "contract"
type FieldErrors = {
  company?: string
  deadline?: string
  pool?: string
  repoUrl?: string
  contractAddress?: string
}

export function CreateContestForm() {
  const [mode, setMode] = React.useState<Mode>("repo")
  const [company, setCompany] = React.useState("")
  const [repoUrl, setRepoUrl] = React.useState("")
  const [contractAddress, setContractAddress] = React.useState("")
  const [deadline, setDeadline] = React.useState("")
  const [pool, setPool] = React.useState<string>("")
  const [loading, setLoading] = React.useState(false)
  const [success, setSuccess] = React.useState(false)
  const [errors, setErrors] = React.useState<FieldErrors>({})
  const [solLoading, setSolLoading] = React.useState(false)
  const [solError, setSolError] = React.useState<string | null>(null)
  const [solFiles, setSolFiles] = React.useState<Array<{ path: string; code: string; size?: number }>>([])
  const [selectedPath, setSelectedPath] = React.useState<string>("")
  const [previewCode, setPreviewCode] = React.useState<string>("")

  function resetForm() {
    setCompany("")
    setRepoUrl("")
    setContractAddress("")
    setDeadline("")
    setPool("")
    setMode("repo")
    setSuccess(false)
    setErrors({})
    setSolLoading(false)
    setSolError(null)
    setSolFiles([])
    setSelectedPath("")
    setPreviewCode("")
  }

  function parseOwnerRepo(url: string) {
    try {
      const u = new URL(url)
      if (u.hostname !== "github.com") return null
      const parts = u.pathname.split("/").filter(Boolean)
      if (parts.length < 2) return null
      return `${parts[0]}/${parts[1]}`
    } catch {
      return null
    }
  }

  async function fetchSolidityFiles() {
    setSolError(null)
    setSolLoading(true)
    try {
      const res = await fetch("/api/fetch-sol", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || `Failed to fetch Solidity files (${res.status})`)
      }
      const data = await res.json()
      const files = (data?.files || []) as Array<{ path: string; code: string; size?: number }>
      setSolFiles(files)
      if (files.length > 0) {
        setSelectedPath(files[0].path)
        setPreviewCode(files[0].code)
      } else {
        setSelectedPath("")
        setPreviewCode("")
      }
    } catch (err: any) {
      setSolError(err?.message || "Unexpected error while fetching Solidity files.")
      setSolFiles([])
      setSelectedPath("")
      setPreviewCode("")
    } finally {
      setSolLoading(false)
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const nextErrors: FieldErrors = {}

    if (!company.trim()) {
      nextErrors.company = "Please add a company or project name."
    }
    if (!deadline) {
      nextErrors.deadline = "Please select a contest deadline."
    }
    if (!pool || Number.isNaN(Number(pool)) || Number(pool) <= 0) {
      nextErrors.pool = "Please enter a positive USDC amount."
    }
    if (mode === "repo") {
      const or = parseOwnerRepo(repoUrl)
      if (!or) {
        nextErrors.repoUrl = "Provide a valid GitHub URL like https://github.com/org/repo"
      }
    } else {
      if (!contractAddress.trim()) {
        nextErrors.contractAddress = "Please enter a valid smart contract address."
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    setLoading(true)
    await new Promise((r) => setTimeout(r, 900))
    setLoading(false)
    setSuccess(true)

    if (mode === "repo" && selectedPath) {
      const selected = solFiles.find((f) => f.path === selectedPath)
      console.log("[v0] Selected primary .sol:", {
        path: selected?.path,
        size: selected?.size,
        snippet: selected?.code?.slice(0, 200),
      })
    }
  }

  return (
    <Card className="border-border bg-card text-card-foreground">
      <CardHeader>
        <CardTitle className="text-lg">Contest details</CardTitle>
        <CardDescription className="text-muted-foreground">
          Choose how you want to reference the project, then add required details.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-6">
          {/* Shared fields */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="company">Company / Project name</Label>
              <Input
                id="company"
                placeholder="Acme Protocol"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="bg-background"
                aria-invalid={!!errors.company}
                aria-describedby={errors.company ? "company-error" : undefined}
                required
              />
              {errors.company && (
                <p id="company-error" className="text-xs text-destructive">
                  {errors.company}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="deadline">Deadline</Label>
              <Input
                id="deadline"
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="bg-background"
                aria-invalid={!!errors.deadline}
                aria-describedby={errors.deadline ? "deadline-error" : undefined}
                required
              />
              {errors.deadline && (
                <p id="deadline-error" className="text-xs text-destructive">
                  {errors.deadline}
                </p>
              )}
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="pool">Initial Pool (USDC)</Label>
              <Input
                id="pool"
                inputMode="decimal"
                placeholder="e.g. 5000"
                value={pool}
                onChange={(e) => setPool(e.target.value)}
                className="bg-background"
                aria-invalid={!!errors.pool}
                aria-describedby={errors.pool ? "pool-error" : undefined}
                required
              />
              {errors.pool && (
                <p id="pool-error" className="text-xs text-destructive">
                  {errors.pool}
                </p>
              )}
            </div>
          </div>

          {/* Mode selection */}
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="repo">By GitHub Repo</TabsTrigger>
              <TabsTrigger value="contract">By Contract Address</TabsTrigger>
            </TabsList>

            <TabsContent value="repo" className="mt-4">
              <div className="grid gap-2">
                <Label htmlFor="repoUrl">GitHub Repository URL</Label>
                <Input
                  id="repoUrl"
                  placeholder="https://github.com/org/repo"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="bg-background"
                  aria-invalid={!!errors.repoUrl}
                  aria-describedby={errors.repoUrl ? "repoUrl-error" : undefined}
                />
                {errors.repoUrl && (
                  <p id="repoUrl-error" className="text-xs text-destructive">
                    {errors.repoUrl}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  We will associate the contest with the repository activity and metadata.
                </p>

                <div className="mt-3 flex items-center gap-3">
                  <Button
                    type="button"
                    onClick={fetchSolidityFiles}
                    disabled={!parseOwnerRepo(repoUrl) || solLoading}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    aria-busy={solLoading}
                  >
                    {solLoading ? "Fetching..." : "Fetch Solidity Files"}
                  </Button>
                  {solFiles.length > 0 && (
                    <span className="text-xs text-muted-foreground" aria-live="polite">
                      Found {solFiles.length} .sol file{solFiles.length === 1 ? "" : "s"}
                    </span>
                  )}
                </div>

                {solError && (
                  <p className="text-xs text-destructive mt-2" role="alert">
                    {solError}
                  </p>
                )}

                {solFiles.length > 0 && (
                  <div className="mt-4 grid gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="primarySol">Primary Contract File</Label>
                      {/* native select to avoid extra dependencies */}
                      <select
                        id="primarySol"
                        className="bg-background border-border rounded-md px-3 py-2 text-sm"
                        value={selectedPath}
                        onChange={(e) => {
                          const path = e.target.value
                          setSelectedPath(path)
                          const file = solFiles.find((f) => f.path === path)
                          setPreviewCode(file?.code || "")
                        }}
                      >
                        {solFiles.map((f) => (
                          <option key={f.path} value={f.path}>
                            {f.path}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-muted-foreground">
                        We’ll use this file as the main reference for contest details.
                      </p>
                    </div>

                    
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="contract" className="mt-4">
              <div className="grid gap-2">
                <Label htmlFor="contractAddress">Smart Contract Address</Label>
                <Input
                  id="contractAddress"
                  placeholder="0x… or Hedera ID"
                  value={contractAddress}
                  onChange={(e) => setContractAddress(e.target.value)}
                  className="bg-background"
                  aria-invalid={!!errors.contractAddress}
                  aria-describedby={errors.contractAddress ? "contractAddress-error" : undefined}
                />
                {errors.contractAddress && (
                  <p id="contractAddress-error" className="text-xs text-destructive">
                    {errors.contractAddress}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Paste the deployed contract address (e.g., Hedera or EVM-compatible address).
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={loading} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {loading ? "Creating..." : "Create Contest"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={resetForm}
              className="border-border text-foreground bg-transparent"
            >
              Reset
            </Button>
          </div>

          {success && (
            <Alert className="mt-2 border-primary/30 bg-primary/10 text-foreground">
              <AlertTitle className="font-semibold">Contest created</AlertTitle>
              <AlertDescription className="text-sm">
                Your contest has been created successfully. You can manage it from the dashboard or share the link with
                participants.
              </AlertDescription>
            </Alert>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
