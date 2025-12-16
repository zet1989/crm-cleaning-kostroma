'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  rectIntersection,
  getFirstCollision,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  type CollisionDetection,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { Column, Deal, Executor, Profile } from '@/lib/supabase/database.types'
import { KanbanColumn } from './kanban-column'
import { DealCard } from './deal-card'
import { DealDialog } from './deal-dialog'
import { Button } from '@/components/ui/button'
import { Plus, Bell, BellOff } from 'lucide-react'

type DealWithRelations = Deal & {
  executor: Executor | null
  manager: Profile | null
}

interface KanbanBoardProps {
  initialColumns: Column[]
  initialDeals: DealWithRelations[]
  executors: Executor[]
}

export function KanbanBoard({ initialColumns, initialDeals, executors }: KanbanBoardProps) {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false)
  const [columns, setColumns] = useState(initialColumns)
  const [deals, setDeals] = useState(initialDeals)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedDeal, setSelectedDeal] = useState<DealWithRelations | null>(null)
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('soundEnabled') === 'true'
    }
    return false
  })

  // Функция для перезагрузки сделок
  const refreshDeals = async () => {
    const { data } = await supabase
      .from('deals')
      .select('*, executor:executors!deals_executor_id_fkey(*), manager:profiles!deals_manager_id_fkey(*)')
      .order('position')
    
    if (data) {
      setDeals(data)
    }
  }

  // Fix hydration mismatch - only render DnD on client
  useEffect(() => {
    setMounted(true)
    
    // Слушаем изменения soundEnabled из других вкладок
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'soundEnabled') {
        setSoundEnabled(e.newValue === 'true')
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  // Handle URL parameter to open deal dialog
  useEffect(() => {
    const dealId = searchParams.get('deal')
    if (dealId && mounted) {
      const deal = deals.find(d => d.id === dealId)
      if (deal) {
        setSelectedDeal(deal)
        setDialogOpen(true)
        // Clear URL parameter
        window.history.replaceState({}, '', '/kanban')
      }
    }
  }, [searchParams, deals, mounted])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Кастомная функция обнаружения коллизий
  const collisionDetectionStrategy: CollisionDetection = (args) => {
    // Сначала проверяем коллизии с колонками
    const pointerCollisions = pointerWithin(args)
    
    if (pointerCollisions.length > 0) {
      // Если курсор над колонкой, используем её
      const columnCollision = pointerCollisions.find(collision => 
        columns.some(col => col.id === collision.id)
      )
      if (columnCollision) {
        return [columnCollision]
      }
      return pointerCollisions
    }
    
    // Запасной вариант - rectIntersection
    return rectIntersection(args)
  }

  // Realtime подписка
  useEffect(() => {
    const channel = supabase
      .channel('deals-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deals' },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const { data: newDeal } = await supabase
              .from('deals')
              .select('*, executor:executors!deals_executor_id_fkey(*), manager:profiles!deals_manager_id_fkey(*)')
              .eq('id', payload.new.id)
              .single()
            if (newDeal) {
              setDeals(prev => [...prev, newDeal])
              
              // Уведомление и звук для новой заявки
              toast.success('🔔 Новая заявка!', {
                description: `${newDeal.client_name} - ${newDeal.client_phone}`,
                duration: 5000,
              })
              
              // Звуковой сигнал (только если включен)
              if (soundEnabled) {
                try {
                  const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZSA0PVqzn77BdGAg+ltryxnMnBSuAy/Hfljwp')
                  audio.volume = 0.7
                  audio.play().catch(err => console.log('Audio play failed:', err))
                } catch (err) {
                  console.log('Audio creation failed:', err)
                }
              }
            }
          } else if (payload.eventType === 'UPDATE') {
            const { data: updatedDeal } = await supabase
              .from('deals')
              .select('*, executor:executors!deals_executor_id_fkey(*), manager:profiles!deals_manager_id_fkey(*)')
              .eq('id', payload.new.id)
              .single()
            if (updatedDeal) {
              setDeals(prev => prev.map(d => d.id === updatedDeal.id ? updatedDeal : d))
            }
          } else if (payload.eventType === 'DELETE') {
            setDeals(prev => prev.filter(d => d.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, soundEnabled])

  const activeDeal = activeId ? deals.find(d => d.id === activeId) : null

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    // Не обрабатываем, если перетаскиваем над собой
    if (activeId === overId) return

    const activeDeal = deals.find(d => d.id === activeId)
    if (!activeDeal) return

    // Определяем целевую колонку
    let targetColumnId: string | null = null

    // Проверяем, перетаскиваем ли мы над колонкой
    const overColumn = columns.find(c => c.id === overId)
    if (overColumn) {
      targetColumnId = overColumn.id
    } else {
      // Или над другой карточкой
      const overDeal = deals.find(d => d.id === overId)
      if (overDeal) {
        targetColumnId = overDeal.column_id
      }
    }

    // Обновляем позицию карточки, если колонка изменилась
    if (targetColumnId && activeDeal.column_id !== targetColumnId) {
      setDeals(prev => prev.map(d => 
        d.id === activeId ? { ...d, column_id: targetColumnId! } : d
      ))
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const activeDeal = deals.find(d => d.id === activeId)
    if (!activeDeal) return

    // Определяем целевую колонку
    let targetColumnId = activeDeal.column_id
    const overColumn = columns.find(c => c.id === overId)
    const overDeal = deals.find(d => d.id === overId)

    if (overColumn) {
      targetColumnId = overColumn.id
    } else if (overDeal) {
      targetColumnId = overDeal.column_id
    }

    // Получаем сделки в целевой колонке
    const columnDeals = deals
      .filter(d => d.column_id === targetColumnId)
      .sort((a, b) => a.position - b.position)

    // Вычисляем новую позицию
    let newPosition = 0
    if (overDeal) {
      const overIndex = columnDeals.findIndex(d => d.id === overId)
      const activeIndex = columnDeals.findIndex(d => d.id === activeId)
      
      if (activeIndex !== -1 && overIndex !== -1) {
        const reordered = arrayMove(columnDeals, activeIndex, overIndex)
        newPosition = overIndex
        
        // Обновляем позиции всех карточек в колонке
        reordered.forEach(async (deal, index) => {
          if (deal.position !== index) {
            await supabase.from('deals').update({ position: index }).eq('id', deal.id)
          }
        })
      } else {
        newPosition = overIndex >= 0 ? overIndex : columnDeals.length
      }
    } else {
      newPosition = columnDeals.length
    }

    // Обновляем в БД
    const { error } = await supabase
      .from('deals')
      .update({ column_id: targetColumnId, position: newPosition })
      .eq('id', activeId)

    if (error) {
      toast.error('Ошибка при перемещении сделки')
      // Откатываем изменения
      setDeals(initialDeals)
    }
  }

  const handleAddDeal = (columnId: string) => {
    setSelectedColumnId(columnId)
    setSelectedDeal(null)
    setDialogOpen(true)
  }

  const handleEditDeal = (deal: DealWithRelations) => {
    setSelectedDeal(deal)
    setSelectedColumnId(deal.column_id)
    setDialogOpen(true)
  }

  const getDealsForColumn = (columnId: string) => {
    const columnDeals = deals.filter(d => d.column_id === columnId)
    const column = columns.find(c => c.id === columnId)
    
    // Для колонки "Назначено" - сортируем по дате scheduled_at (ближайшая дата вверху)
    if (column?.name === 'Назначено') {
      return columnDeals.sort((a, b) => {
        if (!a.scheduled_at) return 1
        if (!b.scheduled_at) return -1
        return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
      })
    }
    
    // Для колонки "Новые" - сортируем по дате создания (новые вверху)
    if (column?.name === 'Новые') {
      return columnDeals.sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
    }
    
    // Для колонки "Оплачено" - сортируем по дате completed_at (новые вверху)
    if (column?.name === 'Оплачено') {
      return columnDeals.sort((a, b) => {
        if (!a.completed_at) return 1
        if (!b.completed_at) return -1
        return new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
      })
    }
    
    // Для остальных колонок - по позиции
    return columnDeals.sort((a, b) => a.position - b.position)
  }

  // Show loading skeleton until client-side hydration is complete
  if (!mounted) {
    return (
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-4 h-full min-w-max">
          {columns.map(column => (
            <div key={column.id} className="w-80 flex-shrink-0 flex flex-col rounded-lg bg-muted/50 p-2">
              <div className="flex items-center justify-between p-2 mb-2">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: column.color }}
                  />
                  <span className="font-medium">{column.name}</span>
                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {getDealsForColumn(column.id).length}
                  </span>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                {getDealsForColumn(column.id).map(deal => (
                  <div key={deal.id} className="p-3 rounded-xl border bg-card shadow-sm animate-pulse">
                    <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetectionStrategy}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-4 h-full min-w-max">
          <SortableContext items={columns.map(c => c.id)} strategy={horizontalListSortingStrategy}>
            {columns.map(column => (
              <KanbanColumn
                key={column.id}
                column={column}
                deals={getDealsForColumn(column.id)}
                onAddDeal={() => handleAddDeal(column.id)}
                onEditDeal={handleEditDeal}
              />
            ))}
          </SortableContext>
        </div>
      </div>

      <DragOverlay>
        {activeDeal ? (
          <DealCard deal={activeDeal} isDragging />
        ) : null}
      </DragOverlay>

      <DealDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        deal={selectedDeal}
        columnId={selectedColumnId}
        columns={columns}
        executors={executors}
        onDealSaved={refreshDeals}
      />
    </DndContext>
  )
}
