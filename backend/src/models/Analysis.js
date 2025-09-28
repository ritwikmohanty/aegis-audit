const mongoose = require('mongoose');
const { Schema } = mongoose;

const VulnerabilitySchema = new Schema({
  type: {
    type: String,
    required: true,
    trim: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true
  },
  confidence: {
    type: String,
    enum: ['low', 'medium', 'high'],
    required: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  location: {
    file: String,
    line: Number,
    column: Number,
    function: String
  },
  recommendation: {
    type: String,
    trim: true
  },
  references: [String]
}, { _id: false });

const ToolResultSchema = new Schema({
  tool: {
    type: String,
    required: true,
    enum: ['slither', 'mythril', 'custom']
  },
  version: String,
  executionTime: Number, // in milliseconds
  exitCode: Number,
  stdout: String,
  stderr: String,
  vulnerabilities: [VulnerabilitySchema],
  summary: {
    totalIssues: { type: Number, default: 0 },
    criticalIssues: { type: Number, default: 0 },
    highIssues: { type: Number, default: 0 },
    mediumIssues: { type: Number, default: 0 },
    lowIssues: { type: Number, default: 0 }
  },
  rawOutput: Schema.Types.Mixed
}, { _id: false });

const AnalysisSchema = new Schema({
  // Basic identification
  analysisId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  marketId: {
    type: String,
    required: false,  // Made optional for AI analysis
    ref: 'Market',
    index: true
  },
  
  // Analysis status and progress
  status: {
    type: String,
    enum: ['initiated', 'uploading', 'preprocessing', 'running', 'analyzing', 'postprocessing', 'completed', 'failed', 'cancelled', 'error'],
    default: 'initiated',
    index: true
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },

  // Submission data for AI analysis
  submissionData: {
    mode: {
      type: String,
      enum: ['repo', 'contract']
    },
    repoUrl: String,
    selectedPath: String,
    contractContent: String,
    contractAddress: String,
    selectedNetwork: {
      id: String,
      name: String,
      explorer: String
    },
    timestamp: Date
  },

  // Individual step tracking for AI agents
  steps: [{
    id: String,
    name: String,
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'error'],
      default: 'pending'
    },
    description: String,
    startedAt: Date,
    completedAt: Date,
    updatedAt: Date
  }],

  // AI Agent Results
  agentResults: {
    agent1: Schema.Types.Mixed, // Static Analysis results
    agent2: Schema.Types.Mixed, // Symbolic & ML Analysis results  
    agent3: Schema.Types.Mixed, // AI Remediation results
    masterOutput: String,
    masterErrors: String,
    processingError: String
  },
  
  // File information
  files: [{
    originalName: {
      type: String,
      required: true
    },
    filename: {
      type: String,
      required: true
    },
    path: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    mimetype: String,
    hash: String
  }],
  
  // Analysis configuration
  config: {
    tools: {
      type: [String],
      default: ['slither', 'mythril']
    },
    parameters: {
      type: Map,
      of: Schema.Types.Mixed,
      default: new Map()
    },
    timeout: {
      type: Number,
      default: 300000 // 5 minutes
    }
  },
  
  // Results from analysis tools
  toolResults: [ToolResultSchema],
  
  // AI-generated summary and scoring
  aiSummary: {
    overallRisk: {
      level: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'low'
      },
      score: {
        type: Number,
        min: 0,
        max: 10000, // Basis points
        default: 0
      }
    },
    keyFindings: [{
      type: String,
      trim: true
    }],
    recommendations: [{
      type: String,
      trim: true
    }],
    confidence: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    summary: {
      type: String,
      trim: true
    }
  },
  
  // Execution information
  execution: {
    startedAt: Date,
    completedAt: Date,
    duration: Number, // in milliseconds
    errorMessage: String,
    workDirectory: String,
    environment: {
      nodeVersion: String,
      platform: String,
      architecture: String
    }
  },
  
  // Metadata and tracking
  createdBy: {
    type: String,
    default: 'system'
  },
  version: {
    type: String,
    default: '1.0'
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
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
AnalysisSchema.index({ marketId: 1, createdAt: -1 });
AnalysisSchema.index({ status: 1, createdAt: -1 });
AnalysisSchema.index({ 'aiSummary.overallRisk.level': 1 });

// Virtual for execution duration
AnalysisSchema.virtual('executionDuration').get(function() {
  if (this.execution.startedAt && this.execution.completedAt) {
    return this.execution.completedAt - this.execution.startedAt;
  }
  return null;
});

// Virtual for total vulnerabilities found
AnalysisSchema.virtual('totalVulnerabilities').get(function() {
  return this.toolResults.reduce((total, result) => {
    return total + (result.vulnerabilities ? result.vulnerabilities.length : 0);
  }, 0);
});

// Instance methods
AnalysisSchema.methods.updateProgress = function(progress, status) {
  this.progress = progress;
  if (status) {
    this.status = status;
  }
  this.updatedAt = new Date();
  return this.save();
};

AnalysisSchema.methods.markCompleted = function(results) {
  this.status = 'completed';
  this.progress = 100;
  this.execution.completedAt = new Date();
  this.execution.duration = this.execution.completedAt - this.execution.startedAt;
  
  if (results) {
    this.toolResults = results.toolResults || [];
    this.aiSummary = results.aiSummary || this.aiSummary;
  }
  
  return this.save();
};

AnalysisSchema.methods.markFailed = function(error) {
  this.status = 'failed';
  this.execution.completedAt = new Date();
  this.execution.errorMessage = error.message || error;
  this.execution.duration = this.execution.completedAt - this.execution.startedAt;
  return this.save();
};

// Static methods
AnalysisSchema.statics.findByMarket = function(marketId) {
  return this.find({ marketId }).sort({ createdAt: -1 });
};

AnalysisSchema.statics.findRunning = function() {
  return this.find({
    status: { $in: ['running', 'preprocessing', 'postprocessing'] }
  });
};

AnalysisSchema.statics.findCompleted = function() {
  return this.find({ status: 'completed' }).sort({ createdAt: -1 });
};

// Pre-save middleware
AnalysisSchema.pre('save', function(next) {
  // Set execution start time if status changed to running
  if (this.isModified('status') && this.status === 'running' && !this.execution.startedAt) {
    this.execution.startedAt = new Date();
  }
  next();
});

const Analysis = mongoose.model('Analysis', AnalysisSchema);

module.exports = Analysis;