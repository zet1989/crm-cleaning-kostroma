# 🔗 Интеграция внешних источников заявок

## Обзор системы

Новые заявки в CRM автоматически попадают в колонку "Новые" из трёх источников:
1. **Сайт** - через форму заявки
2. **Телефония** - входящие звонки через Novofon
3. **Email** - письма на корпоративную почту

Все источники работают через **Webhooks API** → n8n обрабатывает данные → создаёт сделку в Supabase.

---

## 📊 Архитектура потока данных

```
┌─────────────┐
│   САЙТ      │ → POST /api/webhooks/site
├─────────────┤
│  NOVOFON    │ → POST /api/webhooks/novofon
├─────────────┤
│   EMAIL     │ → POST /api/webhooks/email
└─────────────┘
       ↓
┌─────────────────────────────────────────┐
│         Next.js API Routes              │
│  - Валидация входящих данных            │
│  - Базовая аутентификация (API ключ)    │
│  - Передача в n8n                       │
└─────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────┐
│             n8n Workflow                │
│  - AI фильтрация спама (OpenRouter)     │
│  - Определение типа уборки              │
│  - Извлечение данных (имя, телефон...)  │
│  - Создание записи в Supabase           │
└─────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────┐
│           Supabase Database             │
│  INSERT INTO deals (                    │
│    column_id = 'ID колонки Новые',      │
│    source = 'website'/'call'/'email',   │
│    client_phone, client_name, ...       │
│  )                                      │
└─────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────┐
│      CRM (Real-time обновление)         │
│  - Supabase Realtime подписка           │
│  - Новая карточка появляется в канбане  │
│  - Toast уведомление менеджерам         │
│  - Звуковой сигнал                      │
└─────────────────────────────────────────┘
```

---

## 🌐 1. Заявки с сайта

### Форма на сайте
```html
<form action="https://crm.yourdomain.com/api/webhooks/site" method="POST">
  <input name="name" placeholder="Ваше имя" required>
  <input name="phone" type="tel" placeholder="+7 (999) 123-45-67" required>
  <input name="email" type="email" placeholder="Email">
  <textarea name="message" placeholder="Описание задачи"></textarea>
  <select name="cleaning_type">
    <option value="standard">Стандартная уборка</option>
    <option value="deep">Генеральная уборка</option>
    <option value="after_repair">После ремонта</option>
  </select>
  <button type="submit">Отправить заявку</button>
</form>
```

### API Endpoint: `/api/webhooks/site`

**Входящие данные (POST JSON):**
```json
{
  "name": "Иван Иванов",
  "phone": "+79991234567",
  "email": "ivan@example.com",
  "message": "Нужна генеральная уборка 3-х комнатной квартиры",
  "cleaning_type": "deep",
  "address": "ул. Ленина 123, кв. 45"
}
```

**Логика обработки:**
1. Валидация обязательных полей (phone, name)
2. Нормализация телефона (убрать пробелы, скобки)
3. Проверка API ключа в заголовке `X-API-Key`
4. Отправка в n8n для дальнейшей обработки

---

## 📞 2. Входящие звонки (Novofon)

### Настройка Novofon
1. В личном кабинете Novofon → **Настройки** → **API и Webhooks**
2. Добавить webhook URL: `https://crm.yourdomain.com/api/webhooks/novofon`
3. События: `call_incoming`, `call_finished`

### API Endpoint: `/api/webhooks/novofon`

**Входящие данные (от Novofon):**
```json
{
  "event": "call_finished",
  "call_id": "abc123def456",
  "direction": "incoming",
  "from": "+79991234567",
  "to": "+74951234567",
  "duration": 180,
  "recording_url": "https://novofon.com/recordings/abc123.mp3",
  "answered": true,
  "manager_ext": "101"
}
```

**Логика обработки:**
1. Проверка типа события (`call_finished`)
2. Создание записи в таблице `calls`
3. Если клиент новый → создать лид в колонке "Новые"
4. Если повторный клиент → привязать звонок к существующей сделке
5. Скачать запись звонка → сохранить в Supabase Storage
6. Отправить запись на транскрипцию (AI)

---

## 📧 3. Заявки с Email

### Настройка Email forwarding
- Настроить правило пересылки на специальный адрес n8n
- Или использовать IMAP подключение в n8n

### n8n Workflow для Email

**n8n узлы:**
1. **Email Trigger (IMAP)** - подключение к почте `orders@yourdomain.com`
2. **Extract Data** - парсинг письма (имя, телефон, текст)
3. **OpenRouter AI** - извлечение структурированных данных
4. **Supabase Insert** - создание сделки

**Пример письма:**
```
От: ivan@example.com
Тема: Заявка на уборку

Здравствуйте!
Меня зовут Иван Петров, телефон +7 999 123-45-67.
Нужна уборка квартиры после ремонта, 70 кв.м.
Адрес: ул. Радионова 178, кв. 14
```

**AI извлекает:**
- Имя: Иван Петров
- Телефон: +7 999 123-45-67
- Тип: После ремонта
- Адрес: ул. Радионова 178, кв. 14
- Площадь: 70 кв.м

---

## 🔧 Реализация в Next.js

### Структура API Routes
```
src/app/api/webhooks/
├── site/
│   └── route.ts          # Заявки с сайта
├── novofon/
│   └── route.ts          # Звонки Novofon
└── email/
    └── route.ts          # Email заявки (опционально)
```

### Пример кода: `/api/webhooks/site/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    // 1. Проверка API ключа
    const apiKey = request.headers.get('X-API-Key')
    if (apiKey !== process.env.WEBHOOK_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Парсинг данных
    const body = await request.json()
    const { name, phone, email, message, cleaning_type, address } = body

    // 3. Валидация
    if (!name || !phone) {
      return NextResponse.json(
        { error: 'Name and phone are required' }, 
        { status: 400 }
      )
    }

    // 4. Получаем ID колонки "Новые"
    const supabase = await createClient()
    const { data: newColumn } = await supabase
      .from('columns')
      .select('id')
      .eq('name', 'Новые')
      .single()

    if (!newColumn) {
      throw new Error('Column "Новые" not found')
    }

    // 5. Создаём сделку
    const { data: deal, error } = await supabase
      .from('deals')
      .insert({
        column_id: newColumn.id,
        client_name: name,
        client_phone: phone.replace(/\D/g, ''), // Только цифры
        address: address || '',
        notes: message,
        source: 'website',
        position: 0 // В начало колонки
      })
      .select()
      .single()

    if (error) throw error

    // 6. Отправка уведомлений (опционально через n8n)
    // await fetch(process.env.N8N_WEBHOOK_URL, {
    //   method: 'POST',
    //   body: JSON.stringify({ event: 'new_lead', deal_id: deal.id })
    // })

    return NextResponse.json({ 
      success: true, 
      deal_id: deal.id,
      message: 'Заявка принята!' 
    })

  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}
```

---

## 🔐 Безопасность

### 1. API ключи
Добавить в `.env.local`:
```bash
WEBHOOK_API_KEY=your_secret_key_here
N8N_WEBHOOK_URL=http://localhost:5678/webhook/...
```

### 2. Rate Limiting
Использовать middleware для ограничения запросов (защита от DDoS).

### 3. Проверка источника
Для Novofon проверять IP адреса в whitelist.

---

## 📱 Real-time обновления в CRM

### Supabase Realtime подписка

В компоненте `KanbanBoard.tsx`:

```typescript
useEffect(() => {
  const supabase = createClient()
  
  // Подписка на новые сделки
  const channel = supabase
    .channel('deals_changes')
    .on(
      'postgres_changes',
      { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'deals' 
      },
      (payload) => {
        // Новая заявка!
        const newDeal = payload.new
        
        // Добавить в канбан
        setDeals(prev => [newDeal, ...prev])
        
        // Уведомление
        toast.success('Новая заявка!', {
          description: `${newDeal.client_name} - ${newDeal.client_phone}`
        })
        
        // Звуковой сигнал
        new Audio('/notification.mp3').play()
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [])
```

---

## 📋 Следующие шаги

### ✅ Что уже сделано:
- [x] База данных с полем `source` в таблице `deals`
- [x] Канбан с поддержкой real-time обновлений
- [x] Структура для хранения звонков

### 🔨 Что нужно сделать:

1. **Создать API endpoints для webhooks** (Фаза 6.2-6.4)
   - `/api/webhooks/site` - форма сайта
   - `/api/webhooks/novofon` - телефония
   - `/api/webhooks/email` - почта (опционально)

2. **Настроить n8n workflows** (Фаза 6.1)
   - Установить n8n (Docker)
   - Создать workflow для каждого источника
   - Подключить AI для обработки данных

3. **Добавить real-time уведомления** (Фаза 8.1)
   - Supabase Realtime подписка
   - Toast уведомления
   - Звуковые сигналы

4. **AI обработка** (Фаза 7)
   - Транскрипция звонков (Whisper)
   - Фильтрация спама
   - Автозаполнение полей

---

## 🎯 Приоритет разработки

**Сейчас рекомендую начать с:**

### Фаза 6.4 - Webhook для сайта (самое простое)
Это даст вам быстрый результат и позволит тестировать весь flow:
1. Создать `/api/webhooks/site/route.ts`
2. Тестовая HTML форма для проверки
3. Добавить real-time подписку в канбан

### Фаза 6.2 - Интеграция Novofon (средняя сложность)
После webhook сайта переходите к телефонии:
1. Настроить webhook в Novofon
2. Создать `/api/webhooks/novofon/route.ts`
3. Сохранение записей звонков

### Фаза 8.1 - Real-time уведомления
Параллельно с webhooks добавить:
1. Supabase Realtime подписку
2. Toast уведомления при новых заявках
3. Звуковой сигнал

---

**Хотите начать с создания webhook endpoints?** 🚀
