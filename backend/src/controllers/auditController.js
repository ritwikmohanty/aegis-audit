const express = require('express');
const router = express.Router();
const auditService = require('../services/auditService');

/**
 * POST /api/audit/log
 * Submit audit log to Hedera Consensus Service
 */
router.post('/log', async (req, res) => {
  try {
    const { marketId, analysisId, logData, logType } = req.body;
    
    if (!marketId || !logData || !logType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: marketId, logData, logType'
      });
    }

    const result = await auditService.submitAuditLog({
      marketId,
      analysisId,
      logData,
      logType,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error submitting audit log:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit audit log',
      message: error.message
    });
  }
});

/**
 * GET /api/audit/logs/:marketId
 * Get audit logs for a specific market
 */
router.get('/logs/:marketId', async (req, res) => {
  try {
    const { marketId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const logs = await auditService.getAuditLogs(marketId, {
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit logs',
      message: error.message
    });
  }
});

/**
 * GET /api/audit/topic/info
 * Get HCS topic information
 */
router.get('/topic/info', async (req, res) => {
  try {
    const topicInfo = await auditService.getTopicInfo();

    res.json({
      success: true,
      data: topicInfo
    });
  } catch (error) {
    console.error('Error fetching topic info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch topic info',
      message: error.message
    });
  }
});

/**
 * POST /api/audit/topic/create
 * Create a new HCS topic for audit logging
 */
router.post('/topic/create', async (req, res) => {
  try {
    const { memo, adminKey } = req.body;

    const topicId = await auditService.createAuditTopic({
      memo: memo || 'Aegis Audit Trail Topic',
      adminKey
    });

    res.json({
      success: true,
      data: {
        topicId,
        message: 'Audit topic created successfully'
      }
    });
  } catch (error) {
    console.error('Error creating audit topic:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create audit topic',
      message: error.message
    });
  }
});

/**
 * GET /api/audit/verify/:sequenceNumber
 * Verify audit log integrity using sequence number
 */
router.get('/verify/:sequenceNumber', async (req, res) => {
  try {
    const { sequenceNumber } = req.params;
    
    const verification = await auditService.verifyAuditLog(sequenceNumber);

    res.json({
      success: true,
      data: verification
    });
  } catch (error) {
    console.error('Error verifying audit log:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify audit log',
      message: error.message
    });
  }
});

/**
 * GET /api/audit/stats
 * Get audit trail statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await auditService.getAuditStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching audit stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit stats',
      message: error.message
    });
  }
});

module.exports = router;