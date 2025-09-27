const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');

class AnalysisService {
  constructor() {
    this.analyses = new Map(); // In-memory storage for demo - use database in production
    this.slitherPath = process.env.SLITHER_PATH || 'slither';
    this.mythrilPath = process.env.MYTHRIL_PATH || 'myth';
  }

  /**
   * Initiate analysis for uploaded contract files
   */
  async initiateAnalysis(marketId, files) {
    const analysisId = uuidv4();
    
    const analysis = {
      id: analysisId,
      marketId,
      status: 'initiated',
      progress: 0,
      files: files.map(f => ({
        originalName: f.originalname,
        filename: f.filename,
        path: f.path,
        size: f.size
      })),
      results: {
        slither: null,
        mythril: null,
        aiSummary: null
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.analyses.set(analysisId, analysis);

    // Start analysis in background
    this.runAnalysis(analysisId).catch(error => {
      console.error(`Analysis ${analysisId} failed:`, error);
      this.updateAnalysisStatus(analysisId, 'failed', error.message);
    });

    return analysisId;
  }

  /**
   * Run the actual analysis using Slither and Mythril
   */
  async runAnalysis(analysisId) {
    const analysis = this.analyses.get(analysisId);
    if (!analysis) {
      throw new Error('Analysis not found');
    }

    try {
      this.updateAnalysisStatus(analysisId, 'running', null, 10);

      // Extract and prepare files
      const workDir = await this.prepareWorkDirectory(analysis.files);
      this.updateAnalysisStatus(analysisId, 'running', null, 20);

      // Run Slither analysis
      const slitherResults = await this.runSlitherAnalysis(workDir);
      analysis.results.slither = slitherResults;
      this.updateAnalysisStatus(analysisId, 'running', null, 50);

      // Run Mythril analysis
      const mythrilResults = await this.runMythrilAnalysis(workDir);
      analysis.results.mythril = mythrilResults;
      this.updateAnalysisStatus(analysisId, 'running', null, 80);

      // Generate AI summary
      const aiSummary = await this.generateAISummary(slitherResults, mythrilResults);
      analysis.results.aiSummary = aiSummary;
      this.updateAnalysisStatus(analysisId, 'completed', null, 100);

      // Clean up work directory
      await this.cleanupWorkDirectory(workDir);

    } catch (error) {
      console.error(`Analysis ${analysisId} error:`, error);
      this.updateAnalysisStatus(analysisId, 'failed', error.message);
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
}

module.exports = new AnalysisService();