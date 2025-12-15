import { query } from '@/lib/db'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatPrice } from '@/lib/utils'
import { Kanban, Users, Phone, TrendingUp } from 'lucide-react'
import Link from 'next/link'

interface Deal {
  id: string
  client_name: string
  address: string
  price: number
  created_at: string
  column_id: string
  column_name: string
  column_color: string
}

interface Column {
  id: string
  name: string
  color: string
  position: number
  deals_count: number
}

export default async function DashboardPage() {
  // Получаем статистику через прямые SQL запросы
  const [
    totalDealsResult,
    executorsResult,
    callsTodayResult,
    recentDealsResult,
    columnsResult,
    totalSumResult,
  ] = await Promise.all([
    // Всего сделок
    query<{ count: string }>('SELECT COUNT(*) as count FROM deals'),
    // Активные исполнители
    query<{ count: string }>('SELECT COUNT(*) as count FROM executors WHERE is_active = true'),
    // Звонки сегодня
    query<{ count: string }>(`SELECT COUNT(*) as count FROM calls WHERE created_at >= CURRENT_DATE`),
    // Последние сделки с информацией о колонках
    query<Deal>(`
      SELECT 
        d.id,
        d.client_name,
        d.address,
        d.price,
        d.created_at,
        d.column_id,
        c.name as column_name,
        c.color as column_color
      FROM deals d
      LEFT JOIN columns c ON d.column_id = c.id
      ORDER BY d.created_at DESC
      LIMIT 5
    `),
    // Колонки с количеством сделок
    query<Column>(`
      SELECT 
        c.id,
        c.name,
        c.color,
        c.position,
        COUNT(d.id)::int as deals_count
      FROM columns c
      LEFT JOIN deals d ON d.column_id = c.id
      GROUP BY c.id, c.name, c.color, c.position
      ORDER BY c.position
    `),
    // Сумма всех сделок
    query<{ total: string }>('SELECT COALESCE(SUM(price), 0) as total FROM deals'),
  ])

  const totalDeals = parseInt(totalDealsResult.rows[0]?.count || '0')
  const executorsCount = parseInt(executorsResult.rows[0]?.count || '0')
  const callsToday = parseInt(callsTodayResult.rows[0]?.count || '0')
  const recentDeals = recentDealsResult.rows
  const columns = columnsResult.rows
  const totalActiveSum = parseFloat(totalSumResult.rows[0]?.total || '0')

  const stats = [
    {
      title: 'Всего сделок',
      value: totalDeals,
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
                const count = column.deals_count || 0
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
                recentDeals?.map((deal) => (
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
                      {deal.column_name && (
                        <div 
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs"
                          style={{ 
                            backgroundColor: `${deal.column_color}20`,
                            color: deal.column_color 
                          }}
                        >
                          {deal.column_name}
                        </div>
                      )}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
