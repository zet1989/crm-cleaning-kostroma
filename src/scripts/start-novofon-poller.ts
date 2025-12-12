#!/usr/bin/env node
/**
 * Скрипт для запуска Novofon поллера
 * 
 * Использование:
 * npx tsx src/scripts/start-novofon-poller.ts
 * 
 * Или в production:
 * node .next/standalone/scripts/start-novofon-poller.js
 */
// Этот файл больше не используется - переход на webhooks
// Poller был удален, используются Novofon webhooks через /api/webhooks/novofon

/*import { NovofonClient } from '../lib/novofon/client-v2';
// Poller был удален - используются webhooks
// import { getNovofonPoller } from '../lib/novofon/poller';
import Logger from '../lib/logger';

// Загрузка переменных окружения
import dotenv from 'dotenv';
import path from 'path';

// Загружаем .env.local для development
const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

// Создаём логгер
const logger = new Logger('novofon-poller');

console.log('='.repeat(60));
console.log('Novofon Poller Startup');
console.log('='.repeat(60));

// Проверка переменных окружения
const requiredEnvVars = [
  'NOVOFON_ACCESS_TOKEN',
  'NOVOFON_INTERNALS',
  'OPENROUTER_API_KEY',
  'NEXT_PUBLIC_SITE_URL',
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  process.exit(1);
}

console.log('✅ Environment variables validated');
console.log(`   Access Token: ${process.env.NOVOFON_ACCESS_TOKEN?.substring(0, 10)}...`);
console.log(`   Internals: ${process.env.NOVOFON_INTERNALS}`);
console.log(`   Site URL: ${process.env.NEXT_PUBLIC_SITE_URL}`);
console.log('');

// Настройки поллера
const config = {
  intervalMinutes: parseInt(process.env.NOVOFON_POLL_INTERVAL || '2'),
  lookbackMinutes: parseInt(process.env.NOVOFON_POLL_LOOKBACK || '5'),
};

console.log('Poller script is deprecated - use webhooks instead');
console.log('See docs/novofon-integration.md for webhook setup');
process.exit(0);

/*
console.log('Configuration:');
console.log(`   Polling interval: ${config.intervalMinutes} minutes`);
console.log(`   Lookback period: ${config.lookbackMinutes} minutes`);
console.log('');

try {
  // Создание клиента и поллера
  const client = new NovofonClient(process.env.NOVOFON_ACCESS_TOKEN!);
  const poller = getNovofonPoller(client, logger);

  // Запуск поллера с логгером
  poller.start(config.intervalMinutes, config.lookbackMinutes);

  console.log('✅ Novofon poller started successfully');
  console.log('='.repeat(60));
  console.log(`📝 Log file: ${logger.getLogPath()}`);
  console.log('Press Ctrl+C to stop');
  console.log('');

  // Обработка graceful shutdown
  process.on('SIGINT', () => {
    console.log('');
    console.log('Shutting down Novofon poller...');
    poller.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('');
    console.log('Shutting down Novofon poller...');
    poller.stop();
    process.exit(0);
  });

} catch (error) {
  console.error('❌ Failed to start Novofon poller:');
  console.error(error);
  process.exit(1);
}
*/
