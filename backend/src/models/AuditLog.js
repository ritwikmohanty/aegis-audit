const mongoose = require('mongoose');
const { Schema } = mongoose;

const AuditLogSchema = new Schema({
  // Basic identification
  logId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  marketId: {
    type: String,
    required: true,
    ref: 'Market',
    index: true
  },
  analysisId: {
    type: String,
    ref: 'Analysis',
    index: true
  },
  
  // HCS-related information
  hcsInfo: {
    topicId: {
      type: String,
      required: true
    },
    sequenceNumber: {
      type: Number,
      sparse: true,
      index: true
    },
    transactionId: {
      type: String,
      sparse: true
    },
    consensusTimestamp: {
      type: Date,
      sparse: true
    },
    runningHash: String,
    messageSize: Number
  },
  
  // Log content and classification
  logType: {
    type: String,
    required: true,
    enum: [
      'market_created',
      'analysis_started',
      'analysis_progress',
      'analysis_completed',
      'vulnerability_detected',
      'market_resolved',
      'bet_placed',
      'winnings_claimed',
      'system_event',
      'error',
      'debug'
    ],
    index: true
  },
  severity: {
    type: String,
    enum: ['debug', 'info', 'warning', 'error', 'critical'],
    default: 'info',
    index: true
  },
  
  // Log data
  data: {
    type: Schema.Types.Mixed,
    required: true
  },
  message: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  
  // Context information
  context: {
    userAddress: String,
    contractAddress: String,
    blockNumber: Number,
    transactionHash: String,
    gasUsed: Number,
    gasPrice: Number
  },
  
  // System information
  system: {
    nodeVersion: String,
    platform: String,
    hostname: String,
    processId: Number,
    memoryUsage: {
      rss: Number,
      heapTotal: Number,
      heapUsed: Number,
      external: Number
    }
  },
  
  // Status and processing
  status: {
    type: String,
    enum: ['pending', 'submitted', 'confirmed', 'failed'],
    default: 'pending',
    index: true
  },
  submissionAttempts: {
    type: Number,
    default: 0,
    min: 0
  },
  lastAttemptAt: Date,
  errorMessage: String,
  
  // Metadata
  tags: [{
    type: String,
    trim: true,
    index: true
  }],
  source: {
    type: String,
    default: 'backend-service'
  },
  version: {
    type: String,
    default: '1.0'
  },
  metadata: {
    type: Map,
    of: Schema.Types.Mixed,
    default: new Map()
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for efficient querying
AuditLogSchema.index({ marketId: 1, createdAt: -1 });
AuditLogSchema.index({ logType: 1, createdAt: -1 });
AuditLogSchema.index({ severity: 1, createdAt: -1 });
AuditLogSchema.index({ status: 1, submissionAttempts: 1 });
AuditLogSchema.index({ 'hcsInfo.topicId': 1, 'hcsInfo.sequenceNumber': 1 });

// TTL index for automatic cleanup (optional - keep logs for 1 year)
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 }); // 365 days

// Virtual for log age
AuditLogSchema.virtual('age').get(function() {
  return new Date() - this.createdAt;
});

// Virtual for processing duration
AuditLogSchema.virtual('processingDuration').get(function() {
  if (this.lastAttemptAt) {
    return this.lastAttemptAt - this.createdAt;
  }
  return null;
});

// Instance methods
AuditLogSchema.methods.markSubmitted = function(hcsInfo) {
  this.status = 'submitted';
  this.hcsInfo.sequenceNumber = hcsInfo.sequenceNumber;
  this.hcsInfo.transactionId = hcsInfo.transactionId;
  this.hcsInfo.consensusTimestamp = hcsInfo.consensusTimestamp;
  this.hcsInfo.runningHash = hcsInfo.runningHash;
  this.lastAttemptAt = new Date();
  return this.save();
};

AuditLogSchema.methods.markConfirmed = function() {
  this.status = 'confirmed';
  return this.save();
};

AuditLogSchema.methods.markFailed = function(error) {
  this.status = 'failed';
  this.errorMessage = error.message || error;
  this.submissionAttempts += 1;
  this.lastAttemptAt = new Date();
  return this.save();
};

AuditLogSchema.methods.retry = function() {
  if (this.submissionAttempts >= 3) {
    throw new Error('Maximum retry attempts exceeded');
  }
  this.status = 'pending';
  this.errorMessage = null;
  return this.save();
};

// Static methods
AuditLogSchema.statics.findByMarket = function(marketId, options = {}) {
  const query = this.find({ marketId });
  
  if (options.logType) {
    query.where('logType').equals(options.logType);
  }
  
  if (options.severity) {
    query.where('severity').equals(options.severity);
  }
  
  if (options.limit) {
    query.limit(options.limit);
  }
  
  if (options.offset) {
    query.skip(options.offset);
  }
  
  return query.sort({ createdAt: -1 });
};

AuditLogSchema.statics.findPending = function() {
  return this.find({ 
    status: 'pending',
    submissionAttempts: { $lt: 3 }
  }).sort({ createdAt: 1 });
};

AuditLogSchema.statics.findFailed = function() {
  return this.find({ 
    status: 'failed',
    submissionAttempts: { $gte: 3 }
  }).sort({ createdAt: -1 });
};

AuditLogSchema.statics.getStatsByMarket = function(marketId) {
  return this.aggregate([
    { $match: { marketId } },
    {
      $group: {
        _id: '$logType',
        count: { $sum: 1 },
        lastLog: { $max: '$createdAt' }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

AuditLogSchema.statics.getLogStats = function(timeRange) {
  const match = {};
  if (timeRange) {
    match.createdAt = { $gte: new Date(Date.now() - timeRange) };
  }
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          logType: '$logType',
          severity: '$severity'
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

// Pre-save middleware
AuditLogSchema.pre('save', function(next) {
  // Set system information if not already set
  if (this.isNew && !this.system.nodeVersion) {
    this.system.nodeVersion = process.version;
    this.system.platform = process.platform;
    this.system.hostname = require('os').hostname();
    this.system.processId = process.pid;
    
    const memUsage = process.memoryUsage();
    this.system.memoryUsage = {
      rss: memUsage.rss,
      heapTotal: memUsage.heapTotal,
      heapUsed: memUsage.heapUsed,
      external: memUsage.external
    };
  }
  
  next();
});

const AuditLog = mongoose.model('AuditLog', AuditLogSchema);

module.exports = AuditLog;