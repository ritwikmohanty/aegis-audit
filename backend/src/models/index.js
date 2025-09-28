const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Market model - stores prediction market information
const Market = sequelize.define('Market', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  contractAddress: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  creator: {
    type: DataTypes.STRING,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('active', 'resolved', 'cancelled'),
    defaultValue: 'active'
  },
  outcome: {
    type: DataTypes.BOOLEAN,
    allowNull: true // null until resolved
  },
  totalYesTokens: {
    type: DataTypes.DECIMAL(20, 8),
    defaultValue: 0
  },
  totalNoTokens: {
    type: DataTypes.DECIMAL(20, 8),
    defaultValue: 0
  },
  resolutionTime: {
    type: DataTypes.DATE,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'markets',
  timestamps: true
});

// Analysis model - stores AI analysis results
const Analysis = sequelize.define('Analysis', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  marketId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Market,
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM('initiated', 'running', 'completed', 'failed'),
    defaultValue: 'initiated'
  },
  progress: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0,
      max: 100
    }
  },
  overallRisk: {
    type: DataTypes.ENUM('minimal', 'low', 'medium', 'high', 'critical'),
    allowNull: true
  },
  totalIssues: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  confidenceScore: {
    type: DataTypes.DECIMAL(3, 2),
    allowNull: true,
    validate: {
      min: 0,
      max: 1
    }
  },
  recommendation: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  slitherResults: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  mythrilResults: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  aiSummary: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'analyses',
  timestamps: true
});

// ContractFile model - stores uploaded contract files
const ContractFile = sequelize.define('ContractFile', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  analysisId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Analysis,
      key: 'id'
    }
  },
  originalName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  filename: {
    type: DataTypes.STRING,
    allowNull: false
  },
  path: {
    type: DataTypes.STRING,
    allowNull: false
  },
  size: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  mimeType: {
    type: DataTypes.STRING,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'contract_files',
  timestamps: true,
  updatedAt: false
});

// AuditLog model - stores HCS audit trail logs
const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  marketId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Market,
      key: 'id'
    }
  },
  sequenceNumber: {
    type: DataTypes.BIGINT,
    allowNull: false
  },
  topicId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  transactionId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  logType: {
    type: DataTypes.ENUM('market_creation', 'analysis_result', 'market_resolution', 'betting_activity'),
    allowNull: false
  },
  logData: {
    type: DataTypes.JSONB,
    allowNull: false
  },
  messageSize: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'audit_logs',
  timestamps: true,
  updatedAt: false
});

// Bet model - stores betting activity
const Bet = sequelize.define('Bet', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  marketId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Market,
      key: 'id'
    }
  },
  user: {
    type: DataTypes.STRING,
    allowNull: false
  },
  side: {
    type: DataTypes.ENUM('yes', 'no'),
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(20, 8),
    allowNull: false
  },
  tokensReceived: {
    type: DataTypes.DECIMAL(20, 8),
    allowNull: false
  },
  transactionId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  blockNumber: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'bets',
  timestamps: true,
  updatedAt: false
});

// Define associations
Market.hasMany(Analysis, { foreignKey: 'marketId', as: 'analyses' });
Analysis.belongsTo(Market, { foreignKey: 'marketId', as: 'market' });

Analysis.hasMany(ContractFile, { foreignKey: 'analysisId', as: 'files' });
ContractFile.belongsTo(Analysis, { foreignKey: 'analysisId', as: 'analysis' });

Market.hasMany(AuditLog, { foreignKey: 'marketId', as: 'auditLogs' });
AuditLog.belongsTo(Market, { foreignKey: 'marketId', as: 'market' });

Market.hasMany(Bet, { foreignKey: 'marketId', as: 'bets' });
Bet.belongsTo(Market, { foreignKey: 'marketId', as: 'market' });

module.exports = {
  Market,
  Analysis,
  ContractFile,
  AuditLog,
  Bet,
  sequelize
};