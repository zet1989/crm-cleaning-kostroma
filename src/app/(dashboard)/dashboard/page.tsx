import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatPrice } from '@/lib/utils'
import { Kanban, Users, Phone, TrendingUp } from 'lucide-react'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Получаем статистику
  const [
    { count: totalDeals },
    { count: activeDeals },
    { count: executorsCount },
    { count: callsToday },
    { data: recentDeals, error: recentDealsError },
    { data: columns },
  ] = await Promise.all([
    supabase.from('deals').select('*', { count: 'exact', head: true }),
    supabase.from('deals').select('*', { count: 'exact', head: true })
      .not('column_id', 'in', '(select id from columns where name in (\'Завершено\', \'Отменено\'))'),
    supabase.from('executors').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('calls').select('*', { count: 'exact', head: true })
      .gte('created_at', new Date().toISOString().split('T')[0]),
    supabase.from('deals').select(`
      id,
      client_name,
      address,
      price,
      created_at,
      column:columns(id, name, color)
    `).order('created_at', { ascending: false }).limit(5),
    supabase.from('columns').select('*, deals:deals(count)').order('position'),
  ])
  
  // Debug
  if (recentDealsError) {
    console.error('Recent deals error:', recentDealsError)
  }

  // Считаем сумму активных сделок
  const { data: activeDealsSum } = await supabase
    .from('deals')
    .select('price')
  
  const totalActiveSum = activeDealsSum?.reduce((sum, deal) => sum + (deal.price || 0), 0) || 0

  const stats = [
    {
      title: 'Всего сделок',
      value: totalDeals || 0,
      icon: Kanban,
      href: '/kanban',
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Активные исполнители',
      value: executorsCount || 0,
      icon: Users,
      href: '/executors',
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Звонков сегодня',
      value: callsToday || 0,
      icon: Phone,
      href: '/calls',
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      title: 'Сумма сделок',
      value: formatPrice(totalActiveSum),
      icon: TrendingUp,
      href: '/analytics',
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Обзор</h1>
        <p className="text-muted-foreground">Добро пожаловать в CRM систему</p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.title} href={stat.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Pipeline overview */}
        <Card>
          <CardHeader>
            <CardTitle>Воронка продаж</CardTitle>
            <CardDescription>Распределение сделок по этапам</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {columns?.map((column) => {
                const count = (column.deals as { count: number }[])?.[0]?.count || 0
                const percentage = totalDeals ? Math.round((count / totalDeals) * 100) : 0
                
                return (
                  <div key={column.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: column.color }}
                        />
                        <span>{column.name}</span>
                      </div>
                      <span className="font-medium">{count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all"
                        style={{ 
                          width: `${percentage}%`,
                          backgroundColor: column.color 
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recent deals */}
        <Card>
          <CardHeader>
            <CardTitle>Последние сделки</CardTitle>
            <CardDescription>Недавно созданные заказы</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentDeals?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Пока нет сделок. <Link href="/kanban" className="text-primary hover:underline">Создайте первую</Link>
                </p>
              ) : (
                recentDeals?.map((deal) => {
                  const column = Array.isArray(deal.column) ? deal.column[0] : deal.column
                  return (
                    <Link 
                      key={deal.id} 
                      href={`/kanban?deal=${deal.id}`}
                      className="flex items-center justify-between hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors"
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{deal.client_name}</p>
                        <p className="text-xs text-muted-foreground">{deal.address}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{formatPrice(deal.price)}</p>
                        {column && (
                          <div 
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs"
                            style={{ 
                              backgroundColor: `${column.color}20`,
                              color: column.color 
                            }}
                          >
                            {column.name}
                          </div>
                        )}
                      </div>
                    </Link>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
