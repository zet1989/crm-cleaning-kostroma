'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Deal, Executor, Profile } from '@/lib/supabase/database.types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatPrice, formatDateTime } from '@/lib/utils'
import { Calendar, MapPin, Phone, User, Users, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getDay, parseISO, format } from 'date-fns'
import { ru } from 'date-fns/locale'

// Функция для форматирования даты без сдвига часового пояса
function formatScheduledDate(dateString: string): string {
  try {
    // Парсим как ISO строку
    const date = parseISO(dateString)
    
    // Если время 00:00, показываем только дату
    if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0) {
      return format(date, 'd MMM', { locale: ru })
    }
    
    // Иначе показываем дату и время в UTC (без конвертации в локальное время)
    const hours = String(date.getUTCHours()).padStart(2, '0')
    const minutes = String(date.getUTCMinutes()).padStart(2, '0')
    return `${format(date, 'd MMM', { locale: ru })}, ${hours}:${minutes}`
  } catch {
    return dateString
  }
}

type DealWithRelations = Deal & {
  executor: Executor | null
  manager: Profile | null
  executors?: Executor[] // Множественные исполнители
}

interface DealCardProps {
  deal: DealWithRelations
  isDragging?: boolean
  onClick?: () => void
}

// Цвета по дням недели (0 = воскресенье, 1 = понедельник, и т.д.)
const dayColors: Record<number, { bg: string; border: string; label: string }> = {
  0: { bg: 'bg-gray-100', border: 'border-l-gray-400', label: 'Вс' },
  1: { bg: 'bg-red-50', border: 'border-l-red-400', label: 'Пн' },
  2: { bg: 'bg-orange-50', border: 'border-l-orange-400', label: 'Вт' },
  3: { bg: 'bg-yellow-50', border: 'border-l-yellow-400', label: 'Ср' },
  4: { bg: 'bg-green-50', border: 'border-l-green-400', label: 'Чт' },
  5: { bg: 'bg-blue-50', border: 'border-l-blue-400', label: 'Пт' },
  6: { bg: 'bg-purple-50', border: 'border-l-purple-400', label: 'Сб' },
}

function getDayColorClass(date: string | null): { bg: string; border: string; dayLabel: string } | null {
  if (!date) return null
  try {
    const dayOfWeek = getDay(parseISO(date))
    const color = dayColors[dayOfWeek]
    return { 
      bg: color.bg, 
      border: color.border,
      dayLabel: color.label
    }
  } catch {
    return null
  }
}

export function DealCard({ deal, isDragging, onClick }: DealCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: deal.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // Получаем цвет по дню недели запланированной даты
  const dayColor = getDayColorClass(deal.scheduled_at)

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow border-l-4',
        dayColor?.bg || 'bg-card',
        dayColor?.border || 'border-l-transparent',
        (isDragging || isSortableDragging) && 'opacity-50 shadow-lg rotate-2',
        onClick && 'cursor-pointer'
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate">{deal.client_name}</h4>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <Phone className="h-3 w-3" />
            {deal.client_phone}
          </p>
        </div>
        <div className="text-right">
          <p className="font-bold text-sm">{formatPrice(deal.price)}</p>
        </div>
      </div>

      {/* Address */}
      <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
        <MapPin className="h-3 w-3 flex-shrink-0" />
        <span className="truncate">{deal.address}</span>
      </p>

      {/* Badges & Info */}
      <div className="flex flex-wrap items-center gap-1.5">
        {deal.is_repeated_client && (
          <Badge variant="secondary" className="text-xs gap-1">
            <RotateCcw className="h-3 w-3" />
            Повторный
          </Badge>
        )}
        
        {/* Показываем всех исполнителей */}
        {deal.executors && deal.executors.length > 0 ? (
          <Badge variant="outline" className="text-xs gap-1">
            {deal.executors.length === 1 ? (
              <>
                <User className="h-3 w-3" />
                {deal.executors[0].name.split(' ')[0]}
              </>
            ) : (
              <>
                <Users className="h-3 w-3" />
                {deal.executors.map(e => e.name.split(' ')[0]).join(', ')}
              </>
            )}
          </Badge>
        ) : deal.executor && (
          <Badge variant="outline" className="text-xs gap-1">
            <User className="h-3 w-3" />
            {deal.executor.name.split(' ')[0]}
          </Badge>
        )}

        {deal.scheduled_at && (
          <Badge variant="outline" className="text-xs gap-1">
            <Calendar className="h-3 w-3" />
            {dayColor?.dayLabel}, {formatScheduledDate(deal.scheduled_at)}
          </Badge>
        )}
      </div>

      {/* Notes preview */}
      {deal.notes && (
        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
          {deal.notes}
        </p>
      )}
    </Card>
  )
}
