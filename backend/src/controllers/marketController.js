const express = require('express');
const router = express.Router();
const marketService = require('../services/marketService');

/**
 * GET /api/markets
 * Get all markets
 */
router.get('/', async (req, res) => {
  try {
    const markets = await marketService.getAllMarkets();
    res.json({
      success: true,
      data: markets
    });
  } catch (error) {
    console.error('Error fetching markets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch markets',
      message: error.message
    });
  }
});

/**
 * GET /api/markets/:marketId
 * Get specific market details
 */
router.get('/:marketId', async (req, res) => {
  try {
    const { marketId } = req.params;
    const market = await marketService.getMarketById(marketId);
    
    if (!market) {
      return res.status(404).json({
        success: false,
        error: 'Market not found'
      });
    }

    res.json({
      success: true,
      data: market
    });
  } catch (error) {
    console.error('Error fetching market:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch market',
      message: error.message
    });
  }
});

/**
 * POST /api/markets
 * Create a new market
 */
router.post('/', async (req, res) => {
  try {
    const { question, endTime, contractAddress } = req.body;
    
    if (!question || !endTime || !contractAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: question, endTime, contractAddress'
      });
    }

    const market = await marketService.createMarket({
      question,
      endTime,
      contractAddress
    });

    res.status(201).json({
      success: true,
      data: market
    });
  } catch (error) {
    console.error('Error creating market:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create market',
      message: error.message
    });
  }
});

/**
 * POST /api/markets/:marketId/resolve
 * Resolve a market with outcome
 */
router.post('/:marketId/resolve', async (req, res) => {
  try {
    const { marketId } = req.params;
    const { outcome, analysisResults } = req.body;
    
    if (outcome === undefined || !analysisResults) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: outcome, analysisResults'
      });
    }

    const result = await marketService.resolveMarket(marketId, outcome, analysisResults);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error resolving market:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve market',
      message: error.message
    });
  }
});

/**
 * GET /api/markets/:marketId/bets
 * Get betting history for a market
 */
router.get('/:marketId/bets', async (req, res) => {
  try {
    const { marketId } = req.params;
    const bets = await marketService.getMarketBets(marketId);

    res.json({
      success: true,
      data: bets
    });
  } catch (error) {
    console.error('Error fetching market bets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch market bets',
      message: error.message
    });
  }
});

module.exports = router;