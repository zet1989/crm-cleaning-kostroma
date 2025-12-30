/**
 * Email Listener - автоматический прием заявок с почты
 * Проверяет IMAP почту каждые 5 минут и создает сделки в CRM
 * 
 * Запуск: node email-listener.js
 */

const Imap = require('node-imap');
const { simpleParser } = require('mailparser');
const fetch = require('node-fetch');

// Настройки почты
const IMAP_CONFIG = {
  user: process.env.EMAIL_USER || 'info@клининг-кострома.рф',
  password: process.env.EMAIL_PASSWORD || '',
  host: process.env.EMAIL_HOST || 'imap.beget.com',
  port: 993,
  tls: true,
  tlsOptions: { rejectUnauthorized: false }
};

// Настройки CRM
const CRM_WEBHOOK = process.env.CRM_WEBHOOK || 'http://localhost:3000/api/webhooks/email';
const API_KEY = process.env.WEBHOOK_API_KEY || '';

// Интервал проверки (5 минут)
const CHECK_INTERVAL = 5 * 60 * 1000;

console.log('[EMAIL-LISTENER] Запуск сервиса...');
console.log(`[EMAIL-LISTENER] Почта: ${IMAP_CONFIG.user}`);
console.log(`[EMAIL-LISTENER] IMAP: ${IMAP_CONFIG.host}:${IMAP_CONFIG.port}`);
console.log(`[EMAIL-LISTENER] Webhook: ${CRM_WEBHOOK}`);
console.log(`[EMAIL-LISTENER] Интервал проверки: ${CHECK_INTERVAL / 1000} сек`);

// Извлечение телефона из текста
function extractPhone(text) {
  const patterns = [
    /(?:\+7|8)?[\s\-]?\(?(\d{3})\)?[\s\-]?(\d{3})[\s\-]?(\d{2})[\s\-]?(\d{2})/,
    /(?:\+7|8)?\s?\(?\d{3}\)?\s?\d{3}[-\s]?\d{2}[-\s]?\d{2}/
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0].replace(/\D/g, '');
    }
  }
  return '';
}

// Извлечение имени из текста
function extractName(text) {
  const patterns = [
    /(?:Имя|Name|ФИО|Клиент):\s*(.+)/i,
    /Меня зовут\s+(.+)/i,
    /^([А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+)/m
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim().split('\n')[0];
    }
  }
  return 'Клиент';
}

// Обработка письма
async function processEmail(mail) {
  try {
    const parsed = await simpleParser(mail.body);
    
    const subject = parsed.subject || 'Без темы';
    const fromEmail = parsed.from?.value?.[0]?.address || '';
    const text = parsed.text || parsed.html || '';
    
    // Извлекаем данные
    const phone = extractPhone(text);
    const name = extractName(text);
    
    console.log(`\n[EMAIL] Обработка письма:`);
    console.log(`  От: ${fromEmail}`);
    console.log(`  Тема: ${subject}`);
    console.log(`  Имя: ${name}`);
    console.log(`  Телефон: ${phone || 'не найден'}`);
    
    // Отправляем в CRM
    const payload = {
      name: name,
      phone: phone,
      email: fromEmail,
      subject: subject,
      message: text.substring(0, 500) // Первые 500 символов
    };
    
    const response = await fetch(CRM_WEBHOOK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify(payload)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`  ✅ Сделка создана: ${result.deal_id}`);
      return true;
    } else {
      const error = await response.text();
      console.error(`  ❌ Ошибка CRM (${response.status}):`, error);
      return false;
    }
  } catch (error) {
    console.error('[EMAIL] Ошибка обработки:', error.message);
    return false;
  }
}

// Проверка новых писем
function checkMail() {
  return new Promise((resolve, reject) => {
    const imap = new Imap(IMAP_CONFIG);
    let processed = 0;
    
    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err, box) => {
        if (err) {
          imap.end();
          return reject(err);
        }
        
        // Ищем непрочитанные письма
        imap.search(['UNSEEN'], async (err, results) => {
          if (err) {
            imap.end();
            return reject(err);
          }
          
          if (!results || results.length === 0) {
            console.log(`[${new Date().toLocaleString()}] Новых писем нет`);
            imap.end();
            return resolve(0);
          }
          
          console.log(`\n[${new Date().toLocaleString()}] Найдено новых писем: ${results.length}`);
          
          const fetch = imap.fetch(results, { bodies: '' });
          const emails = [];
          
          fetch.on('message', (msg, seqno) => {
            const emailData = { seqno, body: '' };
            
            msg.on('body', (stream) => {
              let buffer = '';
              stream.on('data', (chunk) => buffer += chunk.toString('utf8'));
              stream.once('end', () => emailData.body = buffer);
            });
            
            msg.once('end', () => emails.push(emailData));
          });
          
          fetch.once('error', reject);
          
          fetch.once('end', async () => {
            // Обрабатываем письма последовательно
            for (const email of emails) {
              const success = await processEmail(email);
              if (success) {
                // Помечаем как прочитанное
                imap.addFlags(email.seqno, ['\\Seen'], (err) => {
                  if (err) console.error('Ошибка пометки письма:', err);
                });
                processed++;
              }
            }
            
            imap.end();
            resolve(processed);
          });
        });
      });
    });
    
    imap.once('error', (err) => {
      console.error('[IMAP] Ошибка подключения:', err.message);
      reject(err);
    });
    
    imap.connect();
  });
}

// Основной цикл
async function mainLoop() {
  try {
    const count = await checkMail();
    if (count > 0) {
      console.log(`✅ Обработано писем: ${count}\n`);
    }
  } catch (error) {
    console.error('[ERROR]', error.message);
  }
  
  // Следующая проверка через интервал
  setTimeout(mainLoop, CHECK_INTERVAL);
}

// Обработка сигналов завершения
process.on('SIGINT', () => {
  console.log('\n[EMAIL-LISTENER] Остановка сервиса...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[EMAIL-LISTENER] Остановка сервиса...');
  process.exit(0);
});

// Запуск
console.log('[EMAIL-LISTENER] Сервис запущен\n');
mainLoop();
