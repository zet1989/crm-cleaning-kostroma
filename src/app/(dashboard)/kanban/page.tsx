import { createClient } from '@/lib/supabase/server'
import { KanbanBoard } from '@/components/kanban/kanban-board'

export default async function KanbanPage() {
  const supabase = await createClient()

  // Получаем колонки и сделки
  const [columnsResult, dealsResult, executorsResult, dealExecutorsResult] = await Promise.all([
    supabase.from('columns').select('*').order('position'),
    supabase.from('deals').select('*, executor:executors!deals_executor_id_fkey(*), manager:profiles!deals_manager_id_fkey(*)').order('position'),
    supabase.from('executors').select('*').eq('is_active', true).order('name'),
    supabase.from('deal_executors').select('deal_id, executor:executors(*)'),
  ])
  
  // Отдельно загружаем deal_managers чтобы не блокировать основной запрос
  const dealManagersResult = await supabase.from('deal_managers').select('deal_id, manager:profiles!deal_managers_manager_id_fkey(*)')

  const columns = columnsResult.data || []
  const deals = dealsResult.data || []
  const executors = executorsResult.data || []
  const dealExecutors = dealExecutorsResult.data || []
  const dealManagers = dealManagersResult.data || []

  // Добавляем всех исполнителей и менеджеров к каждой сделке
  const dealsWithExecutors = deals.map(deal => ({
    ...deal,
    executors: dealExecutors
      .filter(de => de.deal_id === deal.id)
      .map(de => de.executor)
      .filter(Boolean),
    managers: dealManagers
      .filter(dm => dm.deal_id === deal.id)
      .map(dm => dm.manager)
      .filter(Boolean)
  }))

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 pb-0">
        <h1 className="text-2xl font-bold">Канбан-доска</h1>
        <p className="text-muted-foreground">Управление заказами</p>
      </div>
      
      <KanbanBoard 
        initialColumns={columns} 
        initialDeals={dealsWithExecutors}
        executors={executors}
      />
    </div>
  )
}
