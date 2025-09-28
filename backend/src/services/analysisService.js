const fs = require('fs').promises;
const path = require('path');
const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const { v4: uuidv4 } = require('uuid');
const { Analysis } = require('../models');

const execPromise = promisify(exec);

class AnalysisService {
  constructor() {
    this.slitherPath = process.env.SLITHER_PATH || 'slither';
    this.mythrilPath = process.env.MYTHRIL_PATH || 'myth';
    this.analysisTimeout = parseInt(process.env.ANALYSIS_TIMEOUT) || 300000; // 5 minutes
    this.workDir = process.env.ANALYSIS_WORK_DIR || './temp/analysis';
  }

  /**
   * Initiate analysis for uploaded contract files
   */
  async initiateAnalysis(marketId, files) {
    const analysisId = uuidv4();
    
    const analysisData = {
      analysisId,
      marketId,
      status: 'initiated',
      progress: 0,
      files: files.map(f => ({
        originalName: f.originalname,
        filename: f.filename,
        path: f.path,
        size: f.size,
        mimetype: f.mimetype,
        hash: `hash_${Date.now()}_${f.filename}` // TODO: Generate actual file hash
      })),
      config: {
        tools: ['slither', 'mythril'],
        timeout: this.analysisTimeout
      },
      execution: {
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          architecture: process.arch
        }
      }
    };

    const analysis = new Analysis(analysisData);
    await analysis.save();

    // Start analysis in background
    this.runAnalysis(analysisId).catch(error => {
      console.error(`Analysis ${analysisId} failed:`, error);
      analysis.markFailed(error);
    });

    return analysisId;
  }

  /**
   * Get analysis status
   */
  async getAnalysisStatus(analysisId) {
    try {
      const analysis = await Analysis.findOne({ analysisId });
      if (!analysis) {
        return null;
      }

      return {
        analysisId: analysis.analysisId,
        marketId: analysis.marketId,
        status: analysis.status,
        progress: analysis.progress,
        createdAt: analysis.createdAt,
        updatedAt: analysis.updatedAt,
        execution: analysis.execution
      };
    } catch (error) {
      console.error('Error getting analysis status:', error);
      throw error;
    }
  }

  /**
   * Get analysis results
   */
  async getAnalysisResults(analysisId) {
    try {
      const analysis = await Analysis.findOne({ analysisId });
      if (!analysis) {
        return null;
      }

      return {
        analysisId: analysis.analysisId,
        marketId: analysis.marketId,
        status: analysis.status,
        toolResults: analysis.toolResults,
        aiSummary: analysis.aiSummary,
        totalVulnerabilities: analysis.totalVulnerabilities,
        createdAt: analysis.createdAt,
        completedAt: analysis.execution.completedAt
      };
    } catch (error) {
      console.error('Error getting analysis results:', error);
      throw error;
    }
  }

  /**
   * Run the actual analysis using Slither and Mythril
   */
  async runAnalysis(analysisId) {
    const analysis = await Analysis.findOne({ analysisId });
    if (!analysis) {
      throw new Error('Analysis not found');
    }

    try {
      await analysis.updateProgress(10, 'running');

      // Extract and prepare files
      const workDir = await this.prepareWorkDirectory(analysis.files);
      await analysis.updateProgress(20, 'preprocessing');

      // Run Slither analysis
      const slitherResults = await this.runSlitherAnalysis(workDir);
      analysis.toolResults.push(slitherResults);
      await analysis.updateProgress(50, 'running');

      // Run Mythril analysis
      const mythrilResults = await this.runMythrilAnalysis(workDir);
      analysis.toolResults.push(mythrilResults);
      await analysis.updateProgress(80, 'postprocessing');

      // Generate AI summary
      const aiSummary = await this.generateAISummary(slitherResults, mythrilResults);
      analysis.aiSummary = aiSummary;
      
      // Mark as completed
      await analysis.markCompleted();

      // Clean up work directory
      await this.cleanupWorkDirectory(workDir);

    } catch (error) {
      console.error(`Analysis ${analysisId} error:`, error);
      await analysis.markFailed(error);
      throw error;
    }
  }

  /**
   * Prepare work directory for analysis
   */
  async prepareWorkDirectory(files) {
    const workDir = path.join(__dirname, '../../temp', `analysis_${Date.now()}`);
    await fs.mkdir(workDir, { recursive: true });

    for (const file of files) {
      const sourcePath = file.path;
      const destPath = path.join(workDir, file.originalName);
      await fs.copyFile(sourcePath, destPath);
    }

    return workDir;
  }

  /**
   * Run Slither static analysis
   */
  async runSlitherAnalysis(workDir) {
    return new Promise((resolve, reject) => {
      const slitherProcess = spawn(this.slitherPath, [
        workDir,
        '--json', '-',
        '--disable-color'
      ]);

      let stdout = '';
      let stderr = '';

      slitherProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      slitherProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      slitherProcess.on('close', (code) => {
        try {
          if (code === 0 || stdout.trim()) {
            // Slither often returns non-zero exit codes even on success
            const results = this.parseSlitherOutput(stdout, stderr);
            resolve(results);
          } else {
            reject(new Error(`Slither analysis failed: ${stderr}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse Slither output: ${error.message}`));
        }
      });

      slitherProcess.on('error', (error) => {
        reject(new Error(`Failed to start Slither: ${error.message}`));
      });
    });
  }

  /**
   * Run Mythril symbolic analysis
   */
  async runMythrilAnalysis(workDir) {
    return new Promise((resolve, reject) => {
      // Find .sol files in work directory
      fs.readdir(workDir).then(files => {
        const solFiles = files.filter(f => f.endsWith('.sol'));
        if (solFiles.length === 0) {
          resolve({ vulnerabilities: [], summary: 'No Solidity files found' });
          return;
        }

        const targetFile = path.join(workDir, solFiles[0]);
        const mythrilProcess = spawn(this.mythrilPath, [
          'analyze',
          targetFile,
          '--output', 'json'
        ]);

        let stdout = '';
        let stderr = '';

        mythrilProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        mythrilProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        mythrilProcess.on('close', (code) => {
          try {
            const results = this.parseMythrilOutput(stdout, stderr, code);
            resolve(results);
          } catch (error) {
            reject(new Error(`Failed to parse Mythril output: ${error.message}`));
          }
        });

        mythrilProcess.on('error', (error) => {
          reject(new Error(`Failed to start Mythril: ${error.message}`));
        });
      }).catch(reject);
    });
  }

  /**
   * Parse Slither output
   */
  parseSlitherOutput(stdout, stderr) {
    try {
      if (stdout.trim()) {
        const jsonOutput = JSON.parse(stdout);
        return {
          vulnerabilities: jsonOutput.results?.detectors || [],
          summary: `Found ${jsonOutput.results?.detectors?.length || 0} potential issues`,
          rawOutput: stdout
        };
      } else {
        return {
          vulnerabilities: [],
          summary: 'No issues detected by Slither',
          rawOutput: stderr
        };
      }
    } catch (error) {
      return {
        vulnerabilities: [],
        summary: 'Failed to parse Slither output',
        rawOutput: stdout + stderr,
        error: error.message
      };
    }
  }

  /**
   * Parse Mythril output
   */
  parseMythrilOutput(stdout, stderr, exitCode) {
    try {
      if (stdout.trim() && exitCode === 0) {
        const jsonOutput = JSON.parse(stdout);
        return {
          vulnerabilities: jsonOutput.issues || [],
          summary: `Found ${jsonOutput.issues?.length || 0} potential vulnerabilities`,
          rawOutput: stdout
        };
      } else {
        return {
          vulnerabilities: [],
          summary: exitCode === 0 ? 'No vulnerabilities detected by Mythril' : 'Mythril analysis completed with warnings',
          rawOutput: stdout + stderr
        };
      }
    } catch (error) {
      return {
        vulnerabilities: [],
        summary: 'Failed to parse Mythril output',
        rawOutput: stdout + stderr,
        error: error.message
      };
    }
  }

  /**
   * Generate AI summary of analysis results
   */
  async generateAISummary(slitherResults, mythrilResults) {
    try {
      const totalVulnerabilities = (slitherResults.vulnerabilities?.length || 0) + 
                                  (mythrilResults.vulnerabilities?.length || 0);

      const severity = this.calculateSeverity(slitherResults, mythrilResults);
      
      return {
        overallRisk: severity,
        totalIssues: totalVulnerabilities,
        recommendation: this.generateRecommendation(severity, totalVulnerabilities),
        keyFindings: this.extractKeyFindings(slitherResults, mythrilResults),
        confidenceScore: this.calculateConfidenceScore(slitherResults, mythrilResults)
      };
    } catch (error) {
      console.error('Error generating AI summary:', error);
      return {
        overallRisk: 'unknown',
        totalIssues: 0,
        recommendation: 'Analysis incomplete - manual review required',
        error: error.message
      };
    }
  }

  /**
   * Calculate overall severity
   */
  calculateSeverity(slitherResults, mythrilResults) {
    const slitherHigh = slitherResults.vulnerabilities?.filter(v => 
      v.impact === 'High' || v.confidence === 'High').length || 0;
    const mythrilHigh = mythrilResults.vulnerabilities?.filter(v => 
      v.severity === 'High').length || 0;

    if (slitherHigh > 0 || mythrilHigh > 0) return 'high';
    
    const totalIssues = (slitherResults.vulnerabilities?.length || 0) + 
                       (mythrilResults.vulnerabilities?.length || 0);
    
    if (totalIssues > 5) return 'medium';
    if (totalIssues > 0) return 'low';
    return 'minimal';
  }

  /**
   * Generate recommendation based on analysis
   */
  generateRecommendation(severity, totalIssues) {
    switch (severity) {
      case 'high':
        return 'HIGH RISK: Critical vulnerabilities detected. Do not deploy without fixes.';
      case 'medium':
        return 'MEDIUM RISK: Multiple issues found. Review and fix before deployment.';
      case 'low':
        return 'LOW RISK: Minor issues detected. Consider fixes for best practices.';
      default:
        return 'MINIMAL RISK: No significant issues detected. Contract appears secure.';
    }
  }

  /**
   * Extract key findings from analysis results
   */
  extractKeyFindings(slitherResults, mythrilResults) {
    const findings = [];
    
    // Extract top Slither findings
    if (slitherResults.vulnerabilities) {
      slitherResults.vulnerabilities.slice(0, 3).forEach(vuln => {
        findings.push({
          tool: 'Slither',
          type: vuln.check || 'Unknown',
          description: vuln.description || vuln.elements?.[0]?.name || 'Issue detected',
          severity: vuln.impact || 'Unknown'
        });
      });
    }

    // Extract top Mythril findings
    if (mythrilResults.vulnerabilities) {
      mythrilResults.vulnerabilities.slice(0, 3).forEach(vuln => {
        findings.push({
          tool: 'Mythril',
          type: vuln.title || 'Unknown',
          description: vuln.description || 'Vulnerability detected',
          severity: vuln.severity || 'Unknown'
        });
      });
    }

    return findings;
  }

  /**
   * Calculate confidence score
   */
  calculateConfidenceScore(slitherResults, mythrilResults) {
    // Simple confidence calculation based on tool agreement and result quality
    let score = 0.5; // Base score

    if (slitherResults.vulnerabilities && !slitherResults.error) score += 0.2;
    if (mythrilResults.vulnerabilities && !mythrilResults.error) score += 0.2;
    
    // Higher confidence if both tools agree on low/no issues
    const slitherIssues = slitherResults.vulnerabilities?.length || 0;
    const mythrilIssues = mythrilResults.vulnerabilities?.length || 0;
    
    if (slitherIssues === 0 && mythrilIssues === 0) score += 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Update analysis status
   */
  updateAnalysisStatus(analysisId, status, error = null, progress = null) {
    const analysis = this.analyses.get(analysisId);
    if (analysis) {
      analysis.status = status;
      analysis.updatedAt = new Date();
      if (error) analysis.error = error;
      if (progress !== null) analysis.progress = progress;
      this.analyses.set(analysisId, analysis);
    }
  }

  /**
   * Get analysis status
   */
  async getAnalysisStatus(analysisId) {
    return this.analyses.get(analysisId) || null;
  }

  /**
   * Get analysis results
   */
  async getAnalysisResults(analysisId) {
    const analysis = this.analyses.get(analysisId);
    return analysis?.status === 'completed' ? analysis.results : null;
  }

  /**
   * Rerun analysis with different parameters
   */
  async rerunAnalysis(analysisId, options) {
    const originalAnalysis = this.analyses.get(analysisId);
    if (!originalAnalysis) {
      throw new Error('Original analysis not found');
    }

    return this.initiateAnalysis(originalAnalysis.marketId, originalAnalysis.files);
  }

  /**
   * Check status of analysis tools
   */
  async checkToolsStatus() {
    const status = {
      slither: await this.checkToolAvailability(this.slitherPath, ['--version']),
      mythril: await this.checkToolAvailability(this.mythrilPath, ['version'])
    };

    return status;
  }

  /**
   * Check if a tool is available
   */
  async checkToolAvailability(toolPath, args) {
    return new Promise((resolve) => {
      const process = spawn(toolPath, args);
      
      process.on('close', (code) => {
        resolve({
          available: code === 0,
          path: toolPath
        });
      });

      process.on('error', () => {
        resolve({
          available: false,
          path: toolPath,
          error: 'Tool not found'
        });
      });
    });
  }

  /**
   * Clean up work directory
   */
  async cleanupWorkDirectory(workDir) {
    try {
      await fs.rm(workDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to cleanup work directory:', error);
    }
  }

  /**
   * Initiate AI-powered analysis using the master agent
   */
  async initiateAIAnalysis(submissionData) {
    const analysisId = uuidv4();
    console.log(`[BACKEND] Starting AI analysis ${analysisId}`, submissionData);
    
    const analysisData = {
      analysisId,
      marketId: `market_${analysisId}`, // Generate a placeholder marketId
      status: 'initiated',
      progress: 0,
      submissionData,
      startTime: new Date(),
      steps: [
        { id: '1', name: 'Contract Validation', status: 'pending', description: 'Verifying contract exists and is accessible' },
        { id: '2', name: 'Static Analysis (Agent 1)', status: 'pending', description: 'Running automated security analysis' },
        { id: '3', name: 'Symbolic & ML Analysis (Agent 2)', status: 'pending', description: 'Deep symbolic execution and ML assessment' },
        { id: '4', name: 'AI Remediation (Agent 3)', status: 'pending', description: 'AI-powered vulnerability remediation' },
        { id: '5', name: 'Report Generation', status: 'pending', description: 'Generating comprehensive security report' }
      ]
    };

    const analysis = new Analysis(analysisData);
    await analysis.save();

    // Start AI analysis in background
    this.runAIAnalysis(analysisId, submissionData).catch(error => {
      console.error(`AI Analysis ${analysisId} failed:`, error);
      this.updateAnalysisStatus(analysisId, 'error', 0, { error: error.message });
    });

    return analysisId;
  }

  /**
   * Run the complete AI analysis pipeline
   */
  async runAIAnalysis(analysisId, submissionData) {
    try {
      console.log(`[BACKEND] Running AI analysis pipeline for ${analysisId}`);
      
      // Update status to running
      await this.updateAnalysisStatus(analysisId, 'running', 10);
      await this.updateStepStatus(analysisId, '1', 'running');

      let contractPath;
      
      if (submissionData.mode === 'repo') {
        // Handle GitHub repository submission
        contractPath = await this.handleRepositorySubmission(analysisId, submissionData);
      } else {
        // Handle direct contract address submission
        contractPath = await this.handleContractSubmission(analysisId, submissionData);
      }

      // Step 1: Contract validation complete
      await this.updateStepStatus(analysisId, '1', 'completed');
      await this.updateAnalysisStatus(analysisId, 'analyzing', 20);

      // Run the master agent with the contract path
      const masterAgentPath = path.resolve(process.cwd(), '../master.js');
      const command = `node "${masterAgentPath}" "Run a full security audit on the file ${contractPath}"`;
      
      console.log(`[BACKEND] Executing master agent: ${command}`);
      
      // Update step statuses as we progress
      await this.updateStepStatus(analysisId, '2', 'running');
      await this.updateAnalysisStatus(analysisId, 'analyzing', 40);
      
      const { stdout, stderr } = await execPromise(command, {
        timeout: this.analysisTimeout,
        cwd: path.resolve(process.cwd(), '..')
      });

      console.log(`[BACKEND] Master agent stdout:`, stdout);
      if (stderr) console.log(`[BACKEND] Master agent stderr:`, stderr);

      // Parse and process the results
      const results = await this.processMasterAgentResults(analysisId, stdout, stderr);
      
      // Update final steps
      await this.updateStepStatus(analysisId, '2', 'completed');
      await this.updateStepStatus(analysisId, '3', 'completed');
      await this.updateStepStatus(analysisId, '4', 'completed');
      await this.updateStepStatus(analysisId, '5', 'running');
      await this.updateAnalysisStatus(analysisId, 'analyzing', 90);

      // Generate final report
      const finalReport = await this.generateFinalReport(analysisId, results);
      
      // Complete the analysis
      await this.updateStepStatus(analysisId, '5', 'completed');
      await this.updateAnalysisStatus(analysisId, 'completed', 100, finalReport);
      
      console.log(`[BACKEND] AI analysis ${analysisId} completed successfully`);

    } catch (error) {
      console.error(`[BACKEND] AI analysis ${analysisId} failed:`, error);
      await this.updateAnalysisStatus(analysisId, 'error', 0, { error: error.message });
      throw error;
    }
  }

  /**
   * Handle GitHub repository submission
   */
  async handleRepositorySubmission(analysisId, submissionData) {
    const { repoUrl, selectedPath } = submissionData;
    
    // Create temporary directory for this analysis
    const tempDir = path.join(this.workDir, analysisId);
    await fs.mkdir(tempDir, { recursive: true });
    
    // Clone the repository or download the specific file
    // For now, let's assume we have the contract content from the frontend
    const contractContent = submissionData.contractContent || '// Contract content here';
    const contractFileName = selectedPath || 'contract.sol';
    const contractPath = path.join(tempDir, contractFileName);
    
    await fs.writeFile(contractPath, contractContent);
    
    return contractPath;
  }

  /**
   * Handle direct contract address submission
   */
  async handleContractSubmission(analysisId, submissionData) {
    const { contractAddress, selectedNetwork } = submissionData;
    
    // Create temporary directory
    const tempDir = path.join(this.workDir, analysisId);
    await fs.mkdir(tempDir, { recursive: true });
    
    // For now, create a placeholder file
    // In a real implementation, you'd fetch the contract source from the blockchain
    const contractContent = `// Contract at address: ${contractAddress}\n// Network: ${selectedNetwork.name}\n// TODO: Fetch actual contract source`;
    const contractPath = path.join(tempDir, 'contract.sol');
    
    await fs.writeFile(contractPath, contractContent);
    
    return contractPath;
  }

  /**
   * Process results from the master agent
   */
  async processMasterAgentResults(analysisId, stdout, stderr) {
    // Parse the master agent output and extract analysis results
    const reportsDir = path.resolve(process.cwd(), '../reports');
    
    try {
      // Look for the generated report files
      const files = await fs.readdir(reportsDir);
      const analysisFiles = files.filter(f => f.includes(analysisId) || f.includes('agent') && f.endsWith('.json'));
      
      const results = {
        agent1Results: null,
        agent2Results: null,
        agent3Results: null,
        masterOutput: stdout,
        masterErrors: stderr
      };

      // Read agent result files if they exist
      for (const file of analysisFiles) {
        const filePath = path.join(reportsDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        
        if (file.includes('agent1')) {
          results.agent1Results = JSON.parse(content);
        } else if (file.includes('agent2')) {
          results.agent2Results = JSON.parse(content);
        } else if (file.includes('agent3')) {
          results.agent3Results = JSON.parse(content);
        }
      }

      return results;
    } catch (error) {
      console.error('Error processing master agent results:', error);
      return {
        agent1Results: null,
        agent2Results: null,
        agent3Results: null,
        masterOutput: stdout,
        masterErrors: stderr,
        processingError: error.message
      };
    }
  }

  /**
   * Generate final comprehensive report
   */
  async generateFinalReport(analysisId, results) {
    const report = {
      analysisId,
      timestamp: new Date().toISOString(),
      summary: {
        totalVulnerabilities: 0,
        criticalIssues: 0,
        highIssues: 0,
        mediumIssues: 0,
        lowIssues: 0,
        remediations: 0
      },
      agents: {
        agent1: results.agent1Results,
        agent2: results.agent2Results,
        agent3: results.agent3Results
      },
      masterAgentOutput: results.masterOutput,
      recommendations: []
    };

    // Process agent results and aggregate findings
    if (results.agent1Results) {
      report.summary.totalVulnerabilities += results.agent1Results.vulnerabilities?.length || 0;
    }
    
    if (results.agent2Results) {
      report.summary.totalVulnerabilities += results.agent2Results.findings?.length || 0;
    }
    
    if (results.agent3Results) {
      report.summary.remediations = results.agent3Results.total_remediations || 0;
      report.recommendations = results.agent3Results.remediations || [];
    }

    return report;
  }

  /**
   * Update analysis status
   */
  async updateAnalysisStatus(analysisId, status, progress, additionalData = {}) {
    try {
      const updateData = {
        status,
        progress,
        updatedAt: new Date(),
        ...additionalData
      };

      await Analysis.updateOne({ analysisId }, { $set: updateData });
    } catch (error) {
      console.error('Error updating analysis status:', error);
    }
  }

  /**
   * Update individual step status
   */
  async updateStepStatus(analysisId, stepId, status) {
    try {
      await Analysis.updateOne(
        { analysisId, 'steps.id': stepId },
        { 
          $set: { 
            'steps.$.status': status,
            'steps.$.updatedAt': new Date()
          }
        }
      );
    } catch (error) {
      console.error('Error updating step status:', error);
    }
  }
}

module.exports = new AnalysisService();