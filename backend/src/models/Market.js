const mongoose = require('mongoose');
const { Schema } = mongoose;

const MarketSchema = new Schema({
  // Basic market information
  marketId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  question: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  contractAddress: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^0x[a-fA-F0-9]{40}$/.test(v);
      },
      message: 'Invalid Ethereum address format'
    }
  },
  
  // Blockchain-related fields
  blockchainMarketAddress: {
    type: String,
    sparse: true, // Allows multiple null values
    validate: {
      validator: function(v) {
        return !v || /^0x[a-fA-F0-9]{40}$/.test(v);
      },
      message: 'Invalid blockchain market address format'
    }
  },
  yesTokenAddress: {
    type: String,
    sparse: true
  },
  noTokenAddress: {
    type: String,
    sparse: true
  },
  
  // Market timing
  endTime: {
    type: Date,
    required: true,
    validate: {
      validator: function(v) {
        return v > new Date();
      },
      message: 'End time must be in the future'
    }
  },
  
  // Market status and resolution
  status: {
    type: String,
    enum: ['pending', 'active', 'resolved', 'cancelled', 'expired'],
    default: 'pending',
    index: true
  },
  outcome: {
    type: String,
    enum: ['yes', 'no', 'invalid', null],
    default: null
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  
  // AI Analysis integration
  contractHash: {
    type: String,
    required: true,
    index: true
  },
  confidenceScore: {
    type: Number,
    min: 0,
    max: 10000, // Basis points (0-100%)
    default: 0
  },
  analysisReportHash: {
    type: String,
    default: null
  },
  
  // Market statistics
  totalYesShares: {
    type: Number,
    default: 0,
    min: 0
  },
  totalNoShares: {
    type: Number,
    default: 0,
    min: 0
  },
  totalCollateral: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Oracle information
  oracle: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^0x[a-fA-F0-9]{40}$/.test(v);
      },
      message: 'Invalid oracle address format'
    }
  },
  
  // Metadata
  createdBy: {
    type: String,
    default: 'system'
  },
  tags: [{
    type: String,
    trim: true
  }],
  metadata: {
    type: Map,
    of: Schema.Types.Mixed,
    default: new Map()
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
MarketSchema.index({ status: 1, createdAt: -1 });
MarketSchema.index({ contractAddress: 1, contractHash: 1 });
MarketSchema.index({ endTime: 1, status: 1 });

// Virtual for market duration
MarketSchema.virtual('duration').get(function() {
  return this.endTime - this.createdAt;
});

// Virtual for time remaining
MarketSchema.virtual('timeRemaining').get(function() {
  const now = new Date();
  return Math.max(0, this.endTime - now);
});

// Virtual for market age
MarketSchema.virtual('age').get(function() {
  return new Date() - this.createdAt;
});

// Instance methods
MarketSchema.methods.isExpired = function() {
  return new Date() > this.endTime;
};

MarketSchema.methods.canBet = function() {
  return this.status === 'active' && !this.isExpired();
};

MarketSchema.methods.resolve = function(outcome, analysisResults) {
  this.outcome = outcome;
  this.status = 'resolved';
  this.resolvedAt = new Date();
  if (analysisResults) {
    this.metadata.set('analysisResults', analysisResults);
  }
  return this.save();
};

// Static methods
MarketSchema.statics.findActive = function() {
  return this.find({
    status: 'active',
    endTime: { $gt: new Date() }
  });
};

MarketSchema.statics.findByContract = function(contractAddress) {
  return this.find({ contractAddress });
};

MarketSchema.statics.findExpired = function() {
  return this.find({
    status: { $in: ['active', 'pending'] },
    endTime: { $lt: new Date() }
  });
};

// Pre-save middleware
MarketSchema.pre('save', function(next) {
  // Auto-expire markets
  if (this.isExpired() && this.status === 'active') {
    this.status = 'expired';
  }
  next();
});

const Market = mongoose.model('Market', MarketSchema);

module.exports = Market;