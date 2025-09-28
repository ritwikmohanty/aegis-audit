const express = require('express');
const multer = require('multer');
const router = express.Router();
const analysisService = require('../services/analysisService');

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept .sol files and .zip archives
    if (file.mimetype === 'text/plain' || 
        file.originalname.endsWith('.sol') ||
        file.mimetype === 'application/zip' ||
        file.mimetype === 'application/x-zip-compressed') {
      cb(null, true);
    } else {
      cb(new Error('Only .sol files and .zip archives are allowed'), false);
    }
  }
});

/**
 * POST /api/analysis/upload
 * Upload smart contract files for analysis
 */
router.post('/upload', upload.array('contracts', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }

    const { marketId } = req.body;
    if (!marketId) {
      return res.status(400).json({
        success: false,
        error: 'Market ID is required'
      });
    }

    const analysisId = await analysisService.initiateAnalysis(marketId, req.files);

    res.json({
      success: true,
      data: {
        analysisId,
        message: 'Analysis initiated successfully',
        filesUploaded: req.files.length
      }
    });
  } catch (error) {
    console.error('Error uploading files for analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate analysis',
      message: error.message
    });
  }
});

/**
 * GET /api/analysis/:analysisId/status
 * Get analysis status and progress
 */
router.get('/:analysisId/status', async (req, res) => {
  try {
    const { analysisId } = req.params;
    const status = await analysisService.getAnalysisStatus(analysisId);

    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'Analysis not found'
      });
    }

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error fetching analysis status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analysis status',
      message: error.message
    });
  }
});

/**
 * GET /api/analysis/:analysisId/results
 * Get detailed analysis results
 */
router.get('/:analysisId/results', async (req, res) => {
  try {
    const { analysisId } = req.params;
    const results = await analysisService.getAnalysisResults(analysisId);

    if (!results) {
      return res.status(404).json({
        success: false,
        error: 'Analysis results not found'
      });
    }

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Error fetching analysis results:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analysis results',
      message: error.message
    });
  }
});

/**
 * POST /api/analysis/:analysisId/rerun
 * Rerun analysis with different parameters
 */
router.post('/:analysisId/rerun', async (req, res) => {
  try {
    const { analysisId } = req.params;
    const { tools, parameters } = req.body;

    const newAnalysisId = await analysisService.rerunAnalysis(analysisId, {
      tools: tools || ['slither', 'mythril'],
      parameters
    });

    res.json({
      success: true,
      data: {
        newAnalysisId,
        message: 'Analysis rerun initiated successfully'
      }
    });
  } catch (error) {
    console.error('Error rerunning analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to rerun analysis',
      message: error.message
    });
  }
});

/**
 * POST /api/analysis/ai-analyze
 * Start AI-powered analysis using the master agent and all three AI agents
 */
router.post('/ai-analyze', async (req, res) => {
  try {
    const submissionData = req.body;
    
    // Validate submission
    if (!submissionData.mode || (submissionData.mode !== 'repo' && submissionData.mode !== 'contract')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid submission mode. Must be "repo" or "contract"'
      });
    }

    if (submissionData.mode === 'repo' && !submissionData.repoUrl) {
      return res.status(400).json({
        success: false,
        error: 'Repository URL is required for repo mode'
      });
    }

    if (submissionData.mode === 'contract' && !submissionData.contractAddress) {
      return res.status(400).json({
        success: false,
        error: 'Contract address is required for contract mode'
      });
    }

    const analysisId = await analysisService.initiateAIAnalysis(submissionData);

    res.json({
      success: true,
      data: {
        analysisId,
        message: 'AI analysis initiated successfully',
        status: 'initiated'
      }
    });
  } catch (error) {
    console.error('Error starting AI analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start AI analysis',
      message: error.message
    });
  }
});

/**
 * GET /api/analysis/:analysisId/stream
 * Server-sent events stream for real-time analysis progress
 */
router.get('/:analysisId/stream', async (req, res) => {
  const { analysisId } = req.params;
  
  // Set headers for server-sent events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', analysisId })}\n\n`);

  // Poll for updates and send them to client
  const pollInterval = setInterval(async () => {
    try {
      const status = await analysisService.getAnalysisStatus(analysisId);
      if (status) {
        res.write(`data: ${JSON.stringify({ type: 'progress', data: status })}\n\n`);
        
        // Stop streaming when analysis is complete or failed
        if (status.status === 'completed' || status.status === 'error') {
          clearInterval(pollInterval);
          res.write(`data: ${JSON.stringify({ type: 'complete', data: status })}\n\n`);
          res.end();
        }
      }
    } catch (error) {
      console.error('Error in SSE stream:', error);
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      clearInterval(pollInterval);
      res.end();
    }
  }, 2000);

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(pollInterval);
  });
});

/**
 * GET /api/analysis/tools/status
 * Check status of analysis tools (Slither, Mythril, etc.)
 */
router.get('/tools/status', async (req, res) => {
  try {
    const toolsStatus = await analysisService.checkToolsStatus();

    res.json({
      success: true,
      data: toolsStatus
    });
  } catch (error) {
    console.error('Error checking tools status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check tools status',
      message: error.message
    });
  }
});

module.exports = router;