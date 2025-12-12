'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatPrice } from '@/lib/utils'
import { Download, TrendingUp, TrendingDown, Users, DollarSign, BarChart3, PieChart, Calendar } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend
} from 'recharts'
import { startOfMonth, endOfMonth, subMonths, subDays, format, parseISO, startOfYear, endOfYear, startOfQuarter, endOfQuarter, subQuarters, subYears } from 'date-fns'
import { ru } from 'date-fns/locale'

interface AnalyticsData {
  totalRevenue: number
  previousRevenue: number
  totalDeals: number
  previousDeals: number
  avgCheck: number
  previousAvgCheck: number
  conversionRate: number
  previousConversion: number
  executorsSalary: number
  managersSalary: number
  bonusesTotal: number
  netProfit: number
  revenueByMonth: { month: string; revenue: number }[]
  dealsByStatus: { status: string; count: number; color: string }[]
  topExecutors: { name: string; deals: number; earnings: number }[]
  topManagers: { name: string; deals: number; earnings: number; conversion: number }[]
  dealsBySource: { source: string; count: number }[]
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('month')
  const [customDateFrom, setCustomDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [customDateTo, setCustomDateTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  // Применённые даты - только они вызывают загрузку
  const [appliedDateFrom, setAppliedDateFrom] = useState(customDateFrom)
  const [appliedDateTo, setAppliedDateTo] = useState(customDateTo)
  const [canViewAnalytics, setCanViewAnalytics] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    // Для произвольного периода загружаем только по применённым датам
    if (period === 'custom') {
      loadAnalytics()
    } else {
      loadAnalytics()
    }
  }, [period, appliedDateFrom, appliedDateTo])

  async function loadAnalytics() {
    setLoading(true)
    
    try {
      // Проверяем доступ к аналитике
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('can_view_analytics')
          .eq('id', user.id)
          .single()
        
        if (profile && !profile.can_view_analytics) {
          setCanViewAnalytics(false)
          setLoading(false)
          return
        }
      }

      const now = new Date()
      let startDate: Date
      let endDate: Date
      let previousStartDate: Date
      let previousEndDate: Date

      if (period === 'custom') {
        startDate = new Date(appliedDateFrom)
        endDate = new Date(appliedDateTo + 'T23:59:59')
        const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        previousStartDate = subDays(startDate, daysDiff)
        previousEndDate = subDays(endDate, daysDiff)
      } else if (period === 'month') {
        startDate = startOfMonth(now)
        endDate = endOfMonth(now)
        previousStartDate = startOfMonth(subMonths(now, 1))
        previousEndDate = endOfMonth(subMonths(now, 1))
      } else if (period === 'quarter') {
        startDate = startOfQuarter(now)
        endDate = endOfQuarter(now)
        previousStartDate = startOfQuarter(subQuarters(now, 1))
        previousEndDate = endOfQuarter(subQuarters(now, 1))
      } else if (period === 'year') {
        startDate = startOfYear(now)
        endDate = endOfYear(now)
        previousStartDate = startOfYear(subYears(now, 1))
        previousEndDate = endOfYear(subYears(now, 1))
      } else if (period === '7days') {
        startDate = subDays(now, 7)
        endDate = now
        previousStartDate = subDays(now, 14)
        previousEndDate = subDays(now, 7)
      } else if (period === '30days') {
        startDate = subDays(now, 30)
        endDate = now
        previousStartDate = subDays(now, 60)
        previousEndDate = subDays(now, 30)
      } else {
        startDate = startOfMonth(now)
        endDate = endOfMonth(now)
        previousStartDate = startOfMonth(subMonths(now, 1))
        previousEndDate = endOfMonth(subMonths(now, 1))
      }

      // Получаем колонку "Оплачено"
      const { data: paidColumn } = await supabase
        .from('columns')
        .select('id')
        .eq('is_success', true)
        .single()

      const paidColumnId = paidColumn?.id

      // Текущий период - оплаченные сделки
      const { data: currentDeals } = await supabase
        .from('deals')
        .select('*, profiles!deals_manager_id_fkey(full_name)')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())

      // Предыдущий период
      const { data: previousDeals } = await supabase
        .from('deals')
        .select('*')
        .gte('created_at', previousStartDate.toISOString())
        .lte('created_at', previousEndDate.toISOString())

      // Все сделки (для статусов)
      const { data: allDeals } = await supabase
        .from('deals')
        .select('*, columns(name, color)')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())

      // Исполнители
      const { data: executors } = await supabase
        .from('executors')
        .select('id, name')

      // Колонки для статусов
      const { data: columns } = await supabase
        .from('columns')
        .select('id, name, color')
        .order('position')

      // Расчёт метрик
      const paidDeals = currentDeals?.filter(d => d.column_id === paidColumnId) || []
      const previousPaidDeals = previousDeals?.filter(d => d.column_id === paidColumnId) || []

      // Используем price вместо amount
      const totalRevenue = paidDeals.reduce((sum, d) => sum + (d.price || 0), 0)
      const previousRevenue = previousPaidDeals.reduce((sum, d) => sum + (d.price || 0), 0)

      // Получаем данные о выплатах исполнителям из deal_executors
      const paidDealIds = paidDeals.map(d => d.id)
      let executorsSalary = 0
      if (paidDealIds.length > 0) {
        const { data: dealExecutors } = await supabase
          .from('deal_executors')
          .select('deal_id, earnings_percent')
          .in('deal_id', paidDealIds)

        // Рассчитываем выплаты исполнителям
        for (const de of dealExecutors || []) {
          const deal = paidDeals.find(d => d.id === de.deal_id)
          if (deal) {
            executorsSalary += (deal.price || 0) * (de.earnings_percent || 40) / 100
          }
        }
        // Если нет записей в deal_executors, считаем по умолчанию 40%
        if (!dealExecutors || dealExecutors.length === 0) {
          executorsSalary = totalRevenue * 0.4
        }
      }

      // Получаем данные о выплатах менеджерам из deal_managers
      let managersSalary = 0
      if (paidDealIds.length > 0) {
        const { data: dealManagers } = await supabase
          .from('deal_managers')
          .select('deal_id, earnings_percent')
          .in('deal_id', paidDealIds)

        // Рассчитываем выплаты менеджерам
        for (const dm of dealManagers || []) {
          const deal = paidDeals.find(d => d.id === dm.deal_id)
          if (deal) {
            managersSalary += (deal.price || 0) * (dm.earnings_percent || 10) / 100
          }
        }
        // Если нет записей в deal_managers, считаем по умолчанию 10%
        if (!dealManagers || dealManagers.length === 0) {
          managersSalary = totalRevenue * 0.1
        }
      }

      // Премии
      const { data: bonuses } = await supabase
        .from('bonuses')
        .select('amount')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())

      const bonusesTotal = bonuses?.reduce((sum, b) => sum + (b.amount || 0), 0) || 0

      // Сделки по статусам
      const dealsByStatus = columns?.map(col => ({
        status: col.name,
        count: allDeals?.filter(d => d.column_id === col.id).length || 0,
        color: col.color || '#gray'
      })) || []

      // Выручка по месяцам (последние 6 месяцев)
      const revenueByMonth: { month: string; revenue: number }[] = []
      for (let i = 5; i >= 0; i--) {
        const monthStart = startOfMonth(subMonths(now, i))
        const monthEnd = endOfMonth(subMonths(now, i))
        
        const { data: monthDeals } = await supabase
          .from('deals')
          .select('price')
          .eq('column_id', paidColumnId)
          .gte('created_at', monthStart.toISOString())
          .lte('created_at', monthEnd.toISOString())

        revenueByMonth.push({
          month: format(monthStart, 'LLL', { locale: ru }),
          revenue: monthDeals?.reduce((sum, d) => sum + (d.price || 0), 0) || 0
        })
      }

      // Топ исполнителей - из deal_executors
      const topExecutors: { name: string; deals: number; earnings: number }[] = []
      for (const executor of executors || []) {
        // Получаем сделки исполнителя из deal_executors
        const { data: execDealLinks } = await supabase
          .from('deal_executors')
          .select('deal_id, earnings_percent')
          .eq('executor_id', executor.id)

        const execDealIds = execDealLinks?.map(de => de.deal_id) || []
        
        // Получаем оплаченные сделки
        let execDeals: any[] = []
        if (execDealIds.length > 0) {
          const { data } = await supabase
            .from('deals')
            .select('id, price, column_id')
            .in('id', execDealIds)
            .eq('column_id', paidColumnId)
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString())
          execDeals = data || []
        }

        const earnings = execDeals.reduce((sum, d) => {
          const link = execDealLinks?.find(de => de.deal_id === d.id)
          return sum + ((d.price || 0) * (link?.earnings_percent || 40) / 100)
        }, 0)

        // Добавляем всех исполнителей с оплаченными сделками
        if (execDeals.length > 0) {
          topExecutors.push({
            name: executor.name || 'Без имени',
            deals: execDeals.length,
            earnings
          })
        }
      }
      topExecutors.sort((a, b) => b.earnings - a.earnings)

      // Топ менеджеров - из deal_managers
      const { data: managers } = await supabase
        .from('profiles')
        .select('id, full_name')

      const topManagers: { name: string; deals: number; earnings: number; conversion: number }[] = []
      for (const manager of managers || []) {
        // Получаем сделки менеджера из deal_managers
        const { data: mgrDealLinks } = await supabase
          .from('deal_managers')
          .select('deal_id, earnings_percent')
          .eq('manager_id', manager.id)

        const mgrDealIds = mgrDealLinks?.map(dm => dm.deal_id) || []
        
        // Получаем все сделки менеджера за период
        let mgrAllDeals: any[] = []
        let mgrPaidDeals: any[] = []
        if (mgrDealIds.length > 0) {
          const { data: allMgrDeals } = await supabase
            .from('deals')
            .select('id, price, column_id')
            .in('id', mgrDealIds)
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString())
          
          mgrAllDeals = allMgrDeals || []
          mgrPaidDeals = mgrAllDeals.filter(d => d.column_id === paidColumnId)
        }

        const earnings = mgrPaidDeals.reduce((sum, d) => {
          const link = mgrDealLinks?.find(dm => dm.deal_id === d.id)
          return sum + ((d.price || 0) * (link?.earnings_percent || 10) / 100)
        }, 0)

        const conversion = mgrAllDeals.length > 0 
          ? Math.round((mgrPaidDeals.length / mgrAllDeals.length) * 100) 
          : 0

        topManagers.push({
          name: manager.full_name || 'Без имени',
          deals: mgrAllDeals.length,
          earnings,
          conversion
        })
      }
      topManagers.sort((a, b) => b.earnings - a.earnings)

      // Сделки по источникам
      const sources = ['website', 'email', 'call', 'manual']
      const dealsBySource = sources.map(source => ({
        source: source === 'website' ? 'Сайт' 
          : source === 'email' ? 'Email'
          : source === 'call' ? 'Звонок'
          : 'Вручную',
        count: allDeals?.filter(d => d.source === source).length || 0
      }))

      setData({
        totalRevenue,
        previousRevenue,
        totalDeals: paidDeals.length,
        previousDeals: previousPaidDeals.length,
        avgCheck: paidDeals.length > 0 ? totalRevenue / paidDeals.length : 0,
        previousAvgCheck: previousPaidDeals.length > 0 ? previousRevenue / previousPaidDeals.length : 0,
        conversionRate: (currentDeals?.length || 0) > 0 
          ? Math.round((paidDeals.length / (currentDeals?.length || 1)) * 100) 
          : 0,
        previousConversion: (previousDeals?.length || 0) > 0
          ? Math.round((previousPaidDeals.length / (previousDeals?.length || 1)) * 100)
          : 0,
        executorsSalary,
        managersSalary,
        bonusesTotal,
        netProfit: totalRevenue - executorsSalary - managersSalary - bonusesTotal,
        revenueByMonth,
        dealsByStatus,
        topExecutors: topExecutors.slice(0, 5),
        topManagers: topManagers.slice(0, 5),
        dealsBySource
      })
    } catch (error) {
      console.error('Error loading analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  function getChangePercent(current: number, previous: number) {
    if (previous === 0) return current > 0 ? 100 : 0
    return Math.round(((current - previous) / previous) * 100)
  }

  async function exportDeals(type: 'success' | 'failed') {
    const { data: paidColumn } = await supabase
      .from('columns')
      .select('id')
      .eq('is_success', true)
      .single()

    let query = supabase
      .from('deals')
      .select('*, profiles!deals_manager_id_fkey(full_name), columns(name)')
    
    if (type === 'success') {
      query = query.eq('column_id', paidColumn?.id)
    } else {
      query = query.neq('column_id', paidColumn?.id)
    }

    const { data: deals } = await query

    if (!deals) return

    // Создаём CSV
    const headers = ['Дата', 'Клиент', 'Телефон', 'Сумма', 'Тип', 'Менеджер', 'Статус', 'Адрес']
    const rows = deals.map(d => [
      d.created_at ? format(parseISO(d.created_at), 'dd.MM.yyyy') : '',
      d.client_name || '',
      d.client_phone || '',
      d.amount || 0,
      d.cleaning_type || '',
      (d.profiles as any)?.full_name || '',
      (d.columns as any)?.name || '',
      d.address || ''
    ])

    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `deals_${type}_${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
  }

  if (!canViewAnalytics) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Доступ ограничен</CardTitle>
            <CardDescription>
              У вас нет доступа к странице аналитики. Обратитесь к администратору.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      {/* Заголовок и фильтры */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Аналитика</h1>
          <p className="text-muted-foreground">Финансовые показатели и статистика</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Этот месяц</SelectItem>
                <SelectItem value="quarter">Квартал</SelectItem>
                <SelectItem value="year">Год</SelectItem>
                <SelectItem value="custom">Произвольный период</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {period === 'custom' && (
            <>
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">От</Label>
                <Input
                  type="date"
                  value={customDateFrom}
                  onChange={(e) => setCustomDateFrom(e.target.value)}
                  className="w-[150px]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">До</Label>
                <Input
                  type="date"
                  value={customDateTo}
                  onChange={(e) => setCustomDateTo(e.target.value)}
                  className="w-[150px]"
                />
              </div>
              <Button 
                onClick={() => {
                  setAppliedDateFrom(customDateFrom)
                  setAppliedDateTo(customDateTo)
                }}
                disabled={loading}
              >
                Показать
              </Button>
            </>
          )}
          
          <Button variant="outline" onClick={() => exportDeals('success')}>
            <Download className="h-4 w-4 mr-2" />
            Успешные
          </Button>
          <Button variant="outline" onClick={() => exportDeals('failed')}>
            <Download className="h-4 w-4 mr-2" />
            Неуспешные
          </Button>
        </div>
      </div>

      {/* Основные метрики */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Выручка"
          value={formatPrice(data.totalRevenue)}
          change={getChangePercent(data.totalRevenue, data.previousRevenue)}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <MetricCard
          title="Сделок"
          value={data.totalDeals.toString()}
          change={getChangePercent(data.totalDeals, data.previousDeals)}
          icon={<BarChart3 className="h-4 w-4" />}
        />
        <MetricCard
          title="Средний чек"
          value={formatPrice(data.avgCheck)}
          change={getChangePercent(data.avgCheck, data.previousAvgCheck)}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <MetricCard
          title="Конверсия"
          value={`${data.conversionRate}%`}
          change={data.conversionRate - data.previousConversion}
          icon={<PieChart className="h-4 w-4" />}
        />
      </div>

      {/* Финансы */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>ФОТ исполнителей</CardDescription>
            <CardTitle className="text-xl">{formatPrice(data.executorsSalary)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>ФОТ менеджеров</CardDescription>
            <CardTitle className="text-xl">{formatPrice(data.managersSalary)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Премии</CardDescription>
            <CardTitle className="text-xl">{formatPrice(data.bonusesTotal)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Чистая прибыль</CardDescription>
            <CardTitle className="text-xl text-green-600">{formatPrice(data.netProfit)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Графики */}
      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="revenue">Выручка</TabsTrigger>
          <TabsTrigger value="deals">Сделки</TabsTrigger>
          <TabsTrigger value="sources">Источники</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue">
          <Card>
            <CardHeader>
              <CardTitle>Выручка по месяцам</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.revenueByMonth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}к`} />
                    <Tooltip 
                      formatter={(value: number) => [formatPrice(value), 'Выручка']}
                    />
                    <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deals">
          <Card>
            <CardHeader>
              <CardTitle>Сделки по статусам</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={data.dealsByStatus}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="count"
                      nameKey="status"
                    >
                      {data.dealsByStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sources">
          <Card>
            <CardHeader>
              <CardTitle>Лиды по источникам</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.dealsBySource} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="source" type="category" width={80} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Топы */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Топ исполнителей
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.topExecutors.map((exec, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                      {i + 1}
                    </div>
                    <div>
                      <p className="font-medium">{exec.name}</p>
                      <p className="text-sm text-muted-foreground">{exec.deals} заказов</p>
                    </div>
                  </div>
                  <p className="font-medium">{formatPrice(exec.earnings)}</p>
                </div>
              ))}
              {data.topExecutors.length === 0 && (
                <p className="text-muted-foreground text-center py-4">Нет данных</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Топ менеджеров
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.topManagers.map((mgr, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                      {i + 1}
                    </div>
                    <div>
                      <p className="font-medium">{mgr.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {mgr.deals} сделок • {mgr.conversion}% конверсия
                      </p>
                    </div>
                  </div>
                  <p className="font-medium">{formatPrice(mgr.earnings)}</p>
                </div>
              ))}
              {data.topManagers.length === 0 && (
                <p className="text-muted-foreground text-center py-4">Нет данных</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

interface MetricCardProps {
  title: string
  value: string
  change: number
  icon: React.ReactNode
}

function MetricCard({ title, value, change, icon }: MetricCardProps) {
  const isPositive = change >= 0

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardDescription>{title}</CardDescription>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className={`text-xs flex items-center gap-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {isPositive ? '+' : ''}{change}% к прошлому периоду
        </p>
      </CardContent>
    </Card>
  )
}
