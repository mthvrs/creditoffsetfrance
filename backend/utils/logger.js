import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import axios from 'axios';

const DISCORD_LOGS_WEBHOOK = process.env.DISCORD_WEBHOOK_LOGS;

// Create logger with daily rotation
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    // Console output
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    // Rotating file - keeps last 48 hours
    new DailyRotateFile({
      filename: 'logs/creditoffset-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '2d', // Keep last 2 days
      zippedArchive: true,
    }),
    // Error log
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '2d',
      zippedArchive: true,
    }),
  ],
});

// Send errors to Discord
// Send errors to Discord
logger.on('logged', async (info) => {  // CHANGE: 'data' -> 'logged'
  if (info.level === 'error' && DISCORD_LOGS_WEBHOOK) {
    try {
      await axios.post(DISCORD_LOGS_WEBHOOK, {
        embeds: [{
          title: '🚨 Backend Error',
          color: 15158332,
          fields: [
            { name: 'Message', value: info.message?.substring(0, 1000) || 'No message', inline: false },
            { name: 'Stack', value: info.stack ? `\`\`\`${info.stack.substring(0, 1000)}\`\`\`` : 'No stack', inline: false },
            { name: 'IP', value: info.ip || 'Unknown', inline: true },
            { name: 'Timestamp', value: info.timestamp, inline: true },
          ],
        }],
      });
    } catch (err) {
      console.error('Failed to send error to Discord:', err);
    }
  }
});


export default logger;
