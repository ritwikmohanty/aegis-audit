"use client"

import { useState } from "react"
import { Navbar } from "@/components/navbar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { CheckCircle, Clock, AlertCircle, Loader2, ExternalLink, FileCode, Eye } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

type SubmissionStatus = "idle" | "submitting" | "analyzing" | "completed" | "error"
type SubmissionMode = "repo" | "contract"

interface AnalysisStep {
  id: string
  name: string
  status: "pending" | "running" | "completed" | "error"
  description: string
}

interface SolidityFile {
  path: string
  code: string
  size?: number
}

const networks = [
  { id: "ethereum", name: "Ethereum Mainnet", explorer: "https://etherscan.io" },
  { id: "hedera-testnet", name: "Hedera Testnet", explorer: "https://hashscan.io/testnet" },
  { id: "hedera-mainnet", name: "Hedera Mainnet", explorer: "https://hashscan.io/mainnet" },
  { id: "polygon", name: "Polygon", explorer: "https://polygonscan.com" },
  { id: "bsc", name: "BSC", explorer: "https://bscscan.com" },
]

export default function SubmitPage() {
  const [mode, setMode] = useState<SubmissionMode>("repo")
  const [repoUrl, setRepoUrl] = useState("")
  const [contractAddress, setContractAddress] = useState("")
  const [selectedNetwork, setSelectedNetwork] = useState(networks[0])
  const [status, setStatus] = useState<SubmissionStatus>("idle")
  const [marketId, setMarketId] = useState<string | null>(null)
  const [analysisSteps, setAnalysisSteps] = useState<AnalysisStep[]>([])
  
  // Solidity file handling
  const [solLoading, setSolLoading] = useState(false)
  const [solError, setSolError] = useState<string | null>(null)
  const [solFiles, setSolFiles] = useState<SolidityFile[]>([])
  const [selectedPath, setSelectedPath] = useState<string>("")
  const [previewCode, setPreviewCode] = useState<string>("")
  const [showCodePreview, setShowCodePreview] = useState(false)

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
      const files = (data?.files || []) as SolidityFile[]
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation based on mode
    if (mode === "contract" && !contractAddress.trim()) return
    if (mode === "repo" && !parseOwnerRepo(repoUrl)) return

    setStatus("submitting")
    
    // Initialize analysis steps
    const steps: AnalysisStep[] = [
      { id: "1", name: "Contract Validation", status: "running", description: "Verifying contract exists and is accessible" },
      { id: "2", name: "Static Analysis (Agent 1)", status: "pending", description: "Running automated security analysis" },
      { id: "3", name: "Symbolic & ML Analysis (Agent 2)", status: "pending", description: "Deep symbolic execution and ML assessment" },
      { id: "4", name: "AI Remediation (Agent 3)", status: "pending", description: "AI-powered vulnerability remediation" },
      { id: "5", name: "Report Generation", status: "pending", description: "Generating comprehensive security report" },
    ]
    setAnalysisSteps(steps)

    try {
      // Prepare submission data
      const submissionData: any = {
        mode,
        timestamp: new Date().toISOString()
      }

      if (mode === "repo") {
        submissionData.repoUrl = repoUrl
        submissionData.selectedPath = selectedPath
        submissionData.contractContent = previewCode
        submissionData.repoInfo = parseOwnerRepo(repoUrl)
      } else {
        submissionData.contractAddress = contractAddress
        submissionData.selectedNetwork = selectedNetwork
      }

      console.log("Submitting analysis request:", submissionData)

      // Get backend URL from environment
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

      // Call the AI analysis API
      const response = await fetch(`${backendUrl}/api/analysis/ai-analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submissionData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      const analysisId = result.data.analysisId

      console.log("Analysis started with ID:", analysisId)
      setStatus("analyzing")

      // Poll for analysis progress
      await pollAnalysisProgress(analysisId)
      
    } catch (error) {
      console.error("Submission failed:", error)
      setStatus("error")
    }
  }

  // Helper function to poll analysis progress
  const pollAnalysisProgress = async (analysisId: string) => {
    const pollInterval = 2000 // Poll every 2 seconds
    const maxPolls = 150 // Maximum 5 minutes of polling
    let pollCount = 0

    const poll = async () => {
      try {
        if (pollCount >= maxPolls) {
          throw new Error("Analysis timeout - maximum polling time exceeded")
        }

        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'
        const response = await fetch(`${backendUrl}/api/analysis/${analysisId}/status`)
        if (!response.ok) {
          throw new Error(`Failed to fetch analysis status: ${response.status}`)
        }

        const result = await response.json()
        const analysis = result.data

        console.log("Analysis status update:", analysis)

        // Update progress
        if (analysis.progress !== undefined) {
          // Don't update steps here as we'll get them from the detailed status
        }

        // Update individual steps if available
        if (analysis.steps) {
          setAnalysisSteps(prevSteps => 
            prevSteps.map(step => {
              const serverStep = analysis.steps.find((s: any) => s.id === step.id)
              if (serverStep) {
                return { ...step, status: serverStep.status }
              }
              return step
            })
          )
        }

        if (analysis.status === "completed") {
          setStatus("completed")
          setMarketId(`mk_${analysisId}`)
          return // Stop polling
        } else if (analysis.status === "error") {
          setStatus("error")
          return // Stop polling
        }

        // Continue polling
        pollCount++
        setTimeout(poll, pollInterval)

      } catch (error) {
        console.error("Error polling analysis progress:", error)
        setStatus("error")
      }
    }

    // Start polling
    setTimeout(poll, pollInterval)
  }

  const getStatusIcon = (stepStatus: AnalysisStep["status"]) => {
    switch (stepStatus) {
      case "completed":
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case "running":
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
      case "error":
        return <AlertCircle className="h-5 w-5 text-red-500" />
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />
    }
  }

  const getStatusBadge = () => {
    switch (status) {
      case "submitting":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Submitting</Badge>
      case "analyzing":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Analyzing</Badge>
      case "completed":
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Completed</Badge>
      case "error":
        return <Badge variant="destructive">Error</Badge>
      default:
        return null
    }
  }

  return (
    <main className="min-h-screen flex flex-col">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              Submit Contract for Analysis
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Enter a smart contract address to initiate security analysis and create a prediction market
            </p>
          </div>

          {/* Submission Form */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Contract Submission
                {getStatusBadge()}
              </CardTitle>
              <CardDescription>
                Provide the contract address and network to begin the analysis process
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Mode selection tabs */}
                <Tabs value={mode} onValueChange={(v) => setMode(v as SubmissionMode)} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="repo">GitHub Repository</TabsTrigger>
                    <TabsTrigger value="contract">Contract Address</TabsTrigger>
                  </TabsList>

                  <TabsContent value="repo" className="mt-6 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="repo-url">GitHub Repository URL</Label>
                      <Input
                        id="repo-url"
                        placeholder="https://github.com/org/repo"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        disabled={status === "submitting" || status === "analyzing"}
                      />
                      <p className="text-xs text-muted-foreground">
                        Enter a public GitHub repository URL to analyze the smart contracts
                      </p>
                    </div>

                    {/* Fetch Solidity files */}
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={fetchSolidityFiles}
                        disabled={!parseOwnerRepo(repoUrl) || solLoading || status === "submitting" || status === "analyzing"}
                      >
                        {solLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Fetching...
                          </>
                        ) : (
                          <>
                            <FileCode className="mr-2 h-4 w-4" />
                            Fetch Solidity Files
                          </>
                        )}
                      </Button>
                      {solFiles.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          Found {solFiles.length} .sol file{solFiles.length === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>

                    {solError && (
                      <p className="text-xs text-destructive">{solError}</p>
                    )}

                    {/* File selection and preview */}
                    {solFiles.length > 0 && (
                      <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="primary-file">Primary Contract File</Label>
                            <select
                              id="primary-file"
                              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm"
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
                          </div>
                          
                          <div className="space-y-2">
                            <Label>File Preview</Label>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setShowCodePreview(!showCodePreview)}
                              className="w-full"
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              {showCodePreview ? "Hide" : "Show"} Code Preview
                            </Button>
                          </div>
                        </div>

                        {showCodePreview && previewCode && (
                          <div className="space-y-2">
                            <Label>Code Preview - {selectedPath}</Label>
                            <div className="bg-muted rounded-md p-4 max-h-96 overflow-auto">
                              <pre className="text-xs font-mono whitespace-pre-wrap">
                                {previewCode.slice(0, 2000)}
                                {previewCode.length > 2000 && "\n\n... (truncated for preview)"}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="contract" className="mt-6">
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="contract-address">Contract Address</Label>
                        <Input
                          id="contract-address"
                          placeholder="0x1234...abcd or 0.0.123456"
                          value={contractAddress}
                          onChange={(e) => setContractAddress(e.target.value)}
                          className="font-mono"
                          disabled={status === "submitting" || status === "analyzing"}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="network">Network</Label>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="outline" 
                              className="w-full justify-between"
                              disabled={status === "submitting" || status === "analyzing"}
                            >
                              {selectedNetwork.name}
                              <ExternalLink className="h-4 w-4 opacity-50" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-full">
                            {networks.map((network) => (
                              <DropdownMenuItem
                                key={network.id}
                                onSelect={() => setSelectedNetwork(network)}
                              >
                                {network.name}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                <Button 
                  type="submit" 
                  size="lg" 
                  className="w-full"
                  disabled={
                    (mode === "contract" && !contractAddress.trim()) ||
                    (mode === "repo" && !parseOwnerRepo(repoUrl)) ||
                    status === "submitting" || 
                    status === "analyzing"
                  }
                >
                  {status === "submitting" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting to Backend...
                    </>
                  ) : (
                    "Submit for Analysis"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Analysis Progress */}
          {analysisSteps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Analysis Progress</CardTitle>
                <CardDescription>
                  Real-time status of your contract analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analysisSteps.map((step, index) => (
                    <div key={step.id} className="flex items-start gap-4 p-4 rounded-lg border bg-card">
                      <div className="flex-shrink-0 mt-0.5">
                        {getStatusIcon(step.status)}
                      </div>
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{step.name}</h3>
                          <Badge 
                            variant={step.status === "completed" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {step.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Success State */}
          {status === "completed" && marketId && (
            <Card className="border-green-200 bg-green-50/50">
              <CardHeader>
                <CardTitle className="text-green-800 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Analysis Complete - Market Created!
                </CardTitle>
                <CardDescription className="text-green-700">
                  Your contract has been analyzed and a prediction market has been created
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {mode === "repo" ? (
                    <>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-green-800">Repository</Label>
                        <div className="text-sm p-2 bg-white rounded border">
                          {parseOwnerRepo(repoUrl)}
                        </div>
                      </div>
                      {selectedPath && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-green-800">Primary Contract</Label>
                          <div className="text-sm p-2 bg-white rounded border">
                            {selectedPath}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-green-800">Contract Address</Label>
                        <div className="font-mono text-sm p-2 bg-white rounded border">
                          {contractAddress}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-green-800">Network</Label>
                        <div className="text-sm p-2 bg-white rounded border">
                          {selectedNetwork.name}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                
                <div className="flex gap-3">
                  <Button asChild>
                    <a href={`/market/${marketId}`}>
                      View Market
                    </a>
                  </Button>
                  {mode === "contract" && (
                    <Button variant="outline" asChild>
                      <a href={`${selectedNetwork.explorer}/address/${contractAddress}`} target="_blank" rel="noopener">
                        View on Explorer
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  {mode === "repo" && (
                    <Button variant="outline" asChild>
                      <a href={repoUrl} target="_blank" rel="noopener">
                        View Repository
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error State */}
          {status === "error" && (
            <Card className="border-red-200 bg-red-50/50">
              <CardHeader>
                <CardTitle className="text-red-800 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Analysis Failed
                </CardTitle>
                <CardDescription className="text-red-700">
                  There was an error processing your contract. Please try again.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setStatus("idle")
                    setAnalysisSteps([])
                    setMarketId(null)
                  }}
                >
                  Try Again
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </main>
  )
}
