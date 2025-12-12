# 🎨 UI компоненты для CRM

## Рекомендуемые компоненты из @reui

### Для дашборда аналитики

```bash
# Статистические карточки
npx shadcn@latest add @reui/statistic-card-1
npx shadcn@latest add @reui/statistic-card-2
npx shadcn@latest add @reui/statistic-card-3

# Графики
npx shadcn@latest add @reui/area-chart-1
npx shadcn@latest add @reui/line-chart-1
npx shadcn@latest add @reui/line-chart-2
```

### Для таблиц и списков

```bash
# Data Grid с drag-and-drop
npx shadcn@latest add @reui/data-grid-table
npx shadcn@latest add @reui/data-grid-table-dnd
npx shadcn@latest add @reui/sortable

# Стандартные таблицы
npx shadcn@latest add @reui/table
npx shadcn@latest add @reui/table-default
```

### Для форм

```bash
# Базовые UI компоненты
npx shadcn@latest add @reui/dialog
npx shadcn@latest add @reui/alert-dialog
npx shadcn@latest add @reui/base-autocomplete-default
```

### Для канбана (Sortable)

```bash
# Sortable компоненты для drag-and-drop
npx shadcn@latest add @reui/sortable
npx shadcn@latest add @reui/sortable-grid
npx shadcn@latest add @reui/sortable-nested
```

---

## Альтернативные библиотеки для канбана

Для канбан-доски рекомендую использовать:

### Вариант 1: @dnd-kit (рекомендуется)

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Преимущества:
- Отличная поддержка React 18+
- Высокая производительность
- Хорошая документация
- Поддержка keyboard navigation

### Вариант 2: react-beautiful-dnd

```bash
npm install react-beautiful-dnd
npm install @types/react-beautiful-dnd # для TypeScript
```

### Вариант 3: @hello-pangea/dnd (форк react-beautiful-dnd)

```bash
npm install @hello-pangea/dnd
```

Преимущества:
- Активно поддерживается
- Совместим с React 18+
- Drop-in замена react-beautiful-dnd

---

## Графики для аналитики

### Recharts (рекомендуется)

```bash
npm install recharts
```

Используется в shadcn/ui по умолчанию.

### Пример графика выручки по месяцам:

```tsx
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { month: 'Янв', revenue: 150000 },
  { month: 'Фев', revenue: 180000 },
  { month: 'Мар', revenue: 220000 },
  // ...
];

export function RevenueChart() {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip />
        <Area 
          type="monotone" 
          dataKey="revenue" 
          stroke="#8884d8" 
          fill="#8884d8" 
          fillOpacity={0.3}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

---

## Установка базовых компонентов shadcn/ui

```bash
# Инициализация (если ещё не сделано)
npx shadcn@latest init

# Базовые компоненты
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add dialog
npx shadcn@latest add dropdown-menu
npx shadcn@latest add input
npx shadcn@latest add label
npx shadcn@latest add select
npx shadcn@latest add table
npx shadcn@latest add tabs
npx shadcn@latest add toast
npx shadcn@latest add avatar
npx shadcn@latest add badge
npx shadcn@latest add calendar
npx shadcn@latest add popover
npx shadcn@latest add separator
npx shadcn@latest add sheet
npx shadcn@latest add skeleton
npx shadcn@latest add scroll-area

# Для боковой панели
npx shadcn@latest add sidebar

# Для форм
npx shadcn@latest add form
npx shadcn@latest add checkbox
npx shadcn@latest add switch
npx shadcn@latest add textarea

# Для графиков
npx shadcn@latest add chart
```

---

## Цветовая схема для дней недели

Добавьте в `globals.css`:

```css
:root {
  /* День недели - цвета для канбан карточек */
  --day-monday: hsl(0, 72%, 51%);      /* Красный */
  --day-tuesday: hsl(25, 95%, 53%);    /* Оранжевый */
  --day-wednesday: hsl(48, 96%, 53%);  /* Жёлтый */
  --day-thursday: hsl(142, 71%, 45%);  /* Зелёный */
  --day-friday: hsl(217, 91%, 60%);    /* Синий */
  --day-saturday: hsl(271, 91%, 65%);  /* Фиолетовый */
  --day-sunday: hsl(0, 0%, 64%);       /* Серый */
}
```

---

## Пример структуры компонентов

```
components/
├── ui/                    # shadcn/ui компоненты
│   ├── button.tsx
│   ├── card.tsx
│   └── ...
├── kanban/
│   ├── board.tsx          # Канбан доска
│   ├── column.tsx         # Колонка канбана
│   ├── deal-card.tsx      # Карточка сделки
│   └── deal-modal.tsx     # Модальное окно сделки
├── analytics/
│   ├── revenue-chart.tsx  # График выручки
│   ├── stats-cards.tsx    # Статистические карточки
│   └── executor-table.tsx # Таблица исполнителей
├── layout/
│   ├── sidebar.tsx        # Боковая панель
│   ├── header.tsx         # Шапка
│   └── nav.tsx            # Навигация
└── shared/
    ├── loading.tsx        # Скелетоны загрузки
    └── error-boundary.tsx # Обработка ошибок
```
