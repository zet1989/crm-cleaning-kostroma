# Тестирование Novofon на localhost

## Быстрый старт

### 1. Настройте переменные окружения

Откройте `.env.local` и заполните:

```bash
# Получите из личного кабинета Novofon
NOVOFON_APP_ID=appid_1834174
NOVOFON_SECRET=ваш_секретный_ключ

# Внутренние номера (которые есть в вашей АТС)
NOVOFON_INTERNALS=100,101,102

# OpenRouter для AI (если ещё не заполнено)
OPENROUTER_API_KEY=ваш_ключ_openrouter
```

### 2. Привяжите внутренние номера к менеджерам

Выполните в консоли:

```bash
docker exec supabase_db_crm.loc psql -U postgres -d postgres -c "
UPDATE profiles 
SET novofon_internal = '100' 
WHERE email = 'aleksey.zyryanov.nn@gmail.com';
"
```

Проверьте:
```bash
docker exec supabase_db_crm.loc psql -U postgres -d postgres -c "SELECT email, novofon_internal FROM profiles;"
```

### 3. Запустите приложение

```bash
npm run dev
```

### 4. Настройте Webhook (важно!)

Вместо поллинга используются webhooks:

1. Получите свой webhook URL из CRM: **Настройки → Интеграции → Novofon**
2. Напишите в техподдержку Novofon (support@novofon.com) с запросом на настройку:
   - Укажите ваш внутренний номер АТС (например: 100)
   - Укажите webhook URL
   - Запросите события: **NOTIFY_END**

После настройки webhooks в Novofon, звонки будут создавать сделки автоматически.
```
============================================================
Novofon Poller Startup
============================================================
✅ Environment variables validated
   App ID: appid_1834174
   Internals: 100,101,102
   Site URL: http://localhost:3000

Configuration:
   Polling interval: 2 minutes
   Lookback period: 5 minutes

✅ Novofon poller started successfully
============================================================
Press Ctrl+C to stop

[2024-12-10T15:30:00.000Z] Polling Novofon for new calls...
```

### 5. Сделайте тестовый звонок

Позвоните на ваш номер Novofon с мобильного телефона.

### 6. Ждите 2-5 минут

Поллер проверяет новые звонки каждые 2 минуты. В логах появится:

```
Found 1 recent calls for internal 100
Processing new call: 12345 from 79991234567
Transcription: [текст разговора]
Deal created successfully: uuid-here
Successfully processed call 12345
```

### 7. Проверьте CRM

Откройте http://localhost:3000/dashboard/kanban — должна появиться новая сделка с данными звонка.

---

## Альтернативный способ: через API

Вместо отдельного скрипта можно запускать поллер через API:

**Запуск:**
```bash
curl -X POST http://localhost:3000/api/novofon/poller/start
```

**Остановка:**
```bash
curl -X POST http://localhost:3000/api/novofon/poller/stop
```

**Проверка статуса:**
```bash
curl http://localhost:3000/api/novofon/poller/status
```

---

## Что происходит внутри

1. **Каждые 2 минуты** поллер запрашивает у Novofon звонки за последние 5 минут
2. **Фильтрует входящие** звонки для ваших внутренних номеров
3. **Скачивает запись** звонка (если есть)
4. **Транскрибирует** через Whisper API
5. **Извлекает данные** (имя, телефон, описание) через GPT-4
6. **Создаёт сделку** в CRM с привязкой к менеджеру

---

## Troubleshooting

### Ошибка "Missing required environment variables"

Проверьте, что все переменные заполнены в `.env.local`:
```bash
cat .env.local | grep NOVOFON
cat .env.local | grep OPENROUTER
```

### Поллер не находит звонки

1. Проверьте, что звонок был **входящий** (не исходящий)
2. Убедитесь, что звонок был на номер с вашими внутренними (100, 101, 102)
3. Проверьте логи Novofon в личном кабинете

### Сделка не создаётся

Проверьте логи поллера — там будет ошибка. Частые причины:
- Не заполнен `OPENROUTER_API_KEY`
- Нет баланса на OpenRouter
- Менеджер не привязан к внутреннему номеру

---

## Преимущества vs webhooks

✅ **Работает на localhost** без публичного URL  
✅ **Не требует настройки через техподдержку**  
✅ **Полный контроль** — можно запустить/остановить в любой момент  
✅ **Идеально для разработки и тестирования**  

⚠️ Задержка 2-5 минут (vs реальное время у webhooks)

---

## Production

Для production добавьте в systemd или PM2:

```bash
# PM2
pm2 start src/scripts/start-novofon-poller.ts --name novofon-poller
pm2 save
```

Или используйте webhooks (после настройки через техподдержку).
