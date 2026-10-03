const winston = require('winston');
const path = require('path');

// Formato padrão para as mensagens do logger
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(info => `${info.timestamp} [${info.level.toUpperCase()}]: ${info.message}`)
);

const logger = winston.createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    // Grava apenas erros no error.log
    new winston.transports.File({ 
        filename: path.join(__dirname, '../logs/error.log'), 
        level: 'error' 
    }),
    // Grava todos os logs em combined.log
    new winston.transports.File({ 
        filename: path.join(__dirname, '../logs/combined.log') 
    })
  ]
});

// Em modo de desenvolvimento ou testes, exibe no Console também, com cores
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      logFormat
    )
  }));
}

module.exports = logger;
