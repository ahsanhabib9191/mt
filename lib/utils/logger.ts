import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const isProd = process.env.NODE_ENV === 'production';
const level = process.env.LOG_LEVEL || (isProd ? 'info' : 'debug');

const formatter = isProd
  ? winston.format.combine(winston.format.timestamp(), winston.format.json())
  : winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp(),
      winston.format.printf(({ level, message, timestamp, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `[${timestamp}] ${level}: ${message}${metaStr}`;
      })
    );

const transports: winston.transport[] = [
  new winston.transports.Console({ level })
];

transports.push(
  new DailyRotateFile({
    dirname: 'logs',
    filename: 'error-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    level: 'error'
  }),
  new DailyRotateFile({
    dirname: 'logs',
    filename: 'combined-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    level
  })
);

export const logger = winston.createLogger({
  level,
  format: formatter,
  transports
});

export default logger;
