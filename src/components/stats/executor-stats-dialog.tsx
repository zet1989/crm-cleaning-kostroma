'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, ExternalLink, Calendar, TrendingUp, Wallet, ClipboardList } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { ru } from 'date-fns/locale'
import Link from 'next/link'

interface Deal {
  id: string
  client_name: string
  address: string
  price: number
  scheduled_at: string | null
  completed_at: string | null
  created_at: string
  column: { name: string; color: string } | null
  earnings_percent?: number
}

interface ExecutorStatsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  executor: {
    id: string
    name: string
    salary_percent?: number
  } | null
}

export function ExecutorStatsDialog({ open, onOpenChange, executor }: ExecutorStatsDialogProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [deals, setDeals] = useState<Deal[]>([])
  const [dateFrom, setDateFrom] = useState(() => format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  
  // Stats
  const [stats, setStats] = useState({
    totalDeals: 0,
    totalEarnings: 0,
    avgEarnings: 0
  })

  useEffect(() => {
    if (open && executor) {
      loadStats()
    }
  }, [open, executor, dateFrom, dateTo])

  const loadStats = async () => {
    if (!executor) return
    
    setLoading(true)
    try {
      // Получаем сделки исполнителя из deal_executors с earnings_percent
      const { data: dealExecutors } = await supabase
        .from('deal_executors')
        .select('deal_id, earnings_percent')
        .eq('executor_id', executor.id)

      if (!dealExecutors || dealExecutors.length === 0) {
        setDeals([])
        setStats({ totalDeals: 0, totalEarnings: 0, avgEarnings: 0 })
        setLoading(false)
        return
      }

      const dealIds = dealExecutors.map(de => de.deal_id)
      
      // Получаем детали сделок
      const { data: dealsData } = await supabase
        .from('deals')
        .select('id, client_name, address, price, scheduled_at, completed_at, created_at, column:columns(name, color)')
        .in('id', dealIds)
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo + 'T23:59:59')
        .order('created_at', { ascending: false })

      if (dealsData) {
        // Добавляем earnings_percent к каждой сделке
        const dealsWithPercent = dealsData.map(deal => {
          const de = dealExecutors.find(d => d.deal_id === deal.id)
          return {
            ...deal,
            column: Array.isArray(deal.column) ? deal.column[0] : deal.column,
            earnings_percent: de?.earnings_percent || 40
          }
        })
        
        setDeals(dealsWithPercent)
        
        // Рассчитываем статистику
        const totalDeals = dealsWithPercent.length
        const totalEarnings = dealsWithPercent.reduce((sum, deal) => {
          return sum + ((deal.price || 0) * (deal.earnings_percent || 40) / 100)
        }, 0)
        const avgEarnings = totalDeals > 0 ? totalEarnings / totalDeals : 0
        
        setStats({ totalDeals, totalEarnings, avgEarnings })
      }
    } catch (error) {
      console.error('Error loading executor stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const setCurrentMonth = () => {
    setDateFrom(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
    setDateTo(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  }

  const setPreviousMonth = () => {
    const prevMonth = subMonths(new Date(), 1)
    setDateFrom(format(startOfMonth(prevMonth), 'yyyy-MM-dd'))
    setDateTo(format(endOfMonth(prevMonth), 'yyyy-MM-dd'))
  }

  if (!executor) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Статистика: {executor.name}
          </DialogTitle>
        </DialogHeader>

        {/* Фильтр по дате */}
        <div className="flex flex-wrap items-end gap-4 pb-4 border-b">
          <div className="space-y-1">
            <Label className="text-xs">Период с</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">по</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={setCurrentMonth}>
              Текущий месяц
            </Button>
            <Button variant="outline" size="sm" onClick={setPreviousMonth}>
              Прошлый месяц
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Карточки статистики */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1">
                    <ClipboardList className="h-3 w-3" />
                    Заказов
                  </CardDescription>
                  <CardTitle className="text-2xl">{stats.totalDeals}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1">
                    <Wallet className="h-3 w-3" />
                    Заработок
                  </CardDescription>
                  <CardTitle className="text-2xl text-green-600">{formatPrice(stats.totalEarnings)}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Средний заработок
                  </CardDescription>
                  <CardTitle className="text-2xl">{formatPrice(stats.avgEarnings)}</CardTitle>
                </CardHeader>
              </Card>
            </div>

            {/* Таблица сделок */}
            <div>
              <h3 className="font-medium mb-2">Сделки за период ({deals.length})</h3>
              <div className="border rounded-md max-h-[250px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Дата</TableHead>
                      <TableHead>Клиент</TableHead>
                      <TableHead>Адрес</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead className="text-right">Сумма</TableHead>
                      <TableHead className="text-right">%</TableHead>
                      <TableHead className="text-right">Заработок</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deals.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          Нет сделок за выбранный период
                        </TableCell>
                      </TableRow>
                    ) : (
                      deals.map(deal => (
                        <TableRow key={deal.id}>
                          <TableCell className="text-sm">
                            {format(parseISO(deal.created_at), 'd MMM yyyy', { locale: ru })}
                          </TableCell>
                          <TableCell className="font-medium">{deal.client_name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                            {deal.address}
                          </TableCell>
                          <TableCell>
                            {deal.column && (
                              <Badge 
                                variant="outline"
                                style={{ 
                                  borderColor: deal.column.color,
                                  color: deal.column.color 
                                }}
                              >
                                {deal.column.name}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{formatPrice(deal.price || 0)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {deal.earnings_percent}%
                          </TableCell>
                          <TableCell className="text-right font-medium text-green-600">
                            {formatPrice((deal.price || 0) * (deal.earnings_percent || 40) / 100)}
                          </TableCell>
                          <TableCell>
                            <Link href={`/kanban?deal=${deal.id}`} target="_blank">
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
