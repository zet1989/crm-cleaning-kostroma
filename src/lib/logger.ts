import fs from 'fs';
import path from 'path';

class Logger {
  private logDir: string;
  private logFile: string;

  constructor(logName: string = 'novofon-poller') {
    this.logDir = path.resolve(process.cwd(), 'logs');
    
    // Создаём директорию если её нет
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    // Имя файла с датой
    const date = new Date().toISOString().split('T')[0];
    this.logFile = path.join(this.logDir, `${logName}-${date}.log`);
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] ${message}`;
  }

  private writeToFile(message: string) {
    try {
      fs.appendFileSync(this.logFile, message + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  info(message: string) {
    const formatted = this.formatMessage('INFO', message);
    console.log(formatted);
    this.writeToFile(formatted);
  }

  success(message: string) {
    const formatted = this.formatMessage('SUCCESS', message);
    console.log(formatted);
    this.writeToFile(formatted);
  }

  error(message: string, error?: any) {
    const formatted = this.formatMessage('ERROR', message);
    console.error(formatted);
    this.writeToFile(formatted);
    
    if (error) {
      const errorDetails = error.stack || error.message || JSON.stringify(error);
      console.error(errorDetails);
      this.writeToFile(errorDetails);
    }
  }

  warn(message: string) {
    const formatted = this.formatMessage('WARN', message);
    console.warn(formatted);
    this.writeToFile(formatted);
  }

  getLogPath(): string {
    return this.logFile;
  }
}

export default Logger;
