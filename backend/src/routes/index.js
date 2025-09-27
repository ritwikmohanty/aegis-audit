const express = require('express');
const marketController = require('../controllers/marketController');
const analysisController = require('../controllers/analysisController');
const auditController = require('../controllers/auditController');

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'Aegis Audit Backend'
  });
});

// Market routes
router.get('/markets', marketController.getAllMarkets);
router.get('/markets/:id', marketController.getMarketById);
router.post('/markets', marketController.createMarket);
router.post('/markets/:id/resolve', marketController.resolveMarket);
router.get('/markets/:id/bets', marketController.getBettingHistory);

// Analysis routes
router.post('/analysis/upload', analysisController.uploadContract);
router.post('/analysis/initiate', analysisController.initiateAnalysis);
router.get('/analysis/:id/status', analysisController.getAnalysisStatus);
router.get('/analysis/:id/results', analysisController.getAnalysisResults);
router.post('/analysis/:id/rerun', analysisController.rerunAnalysis);
router.get('/analysis/tools/status', analysisController.getToolsStatus);

// Audit routes
router.post('/audit/submit', auditController.submitLog);
router.get('/audit/logs/:marketId', auditController.getLogsByMarket);
router.get('/audit/topic/info', auditController.getTopicInfo);
router.post('/audit/topic/create', auditController.createTopic);
router.get('/audit/verify/:sequenceNumber', auditController.verifyLogIntegrity);
router.get('/audit/stats', auditController.getAuditStats);

module.exports = router;