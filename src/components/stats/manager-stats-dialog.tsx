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
import { Loader2, ExternalLink, TrendingUp, Wallet, ClipboardList, Gift, Percent } from 'lucide-react'
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
  column: { name: string; color: string; is_success?: boolean } | null
  earnings_percent?: number
  manager_earnings?: number
}

interface Bonus {
  id: string
  amount: number
  reason: string | null
  created_at: string
  deal?: { client_name: string } | null
}

interface ManagerStatsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  manager: {
    id: string
    full_name: string
    salary_percent: number
  } | null
}

export function ManagerStatsDialog({ open, onOpenChange, manager }: ManagerStatsDialogProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [deals, setDeals] = useState<Deal[]>([])
  const [bonuses, setBonuses] = useState<Bonus[]>([])
  const [dateFrom, setDateFrom] = useState(() => format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  
  // Stats
  const [stats, setStats] = useState({
    totalDeals: 0,
    paidDeals: 0,
    totalEarnings: 0,
    totalBonuses: 0,
    conversion: 0
  })

  useEffect(() => {
    if (open && manager) {
      loadStats()
    }
  }, [open, manager, dateFrom, dateTo])

  const loadStats = async () => {
    if (!manager) return
    
    setLoading(true)
    try {
      // Получаем сделки менеджера из deal_managers с earnings_percent
      const { data: dealManagers } = await supabase
        .from('deal_managers')
        .select('deal_id, earnings_percent')
        .eq('manager_id', manager.id)

      // Также получаем сделки где manager_id напрямую (для обратной совместимости)
      const { data: directDeals } = await supabase
        .from('deals')
        .select('id, client_name, address, price, scheduled_at, completed_at, created_at, column:columns(name, color, is_success)')
        .eq('manager_id', manager.id)
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo + 'T23:59:59')
        .order('created_at', { ascending: false })

      // Собираем все ID сделок из deal_managers
      const dmDealIds = dealManagers?.map(dm => dm.deal_id) || []
      
      // Получаем детали этих сделок
      let dealsFromDM: any[] = []
      if (dmDealIds.length > 0) {
        const { data } = await supabase
          .from('deals')
          .select('id, client_name, address, price, scheduled_at, completed_at, created_at, column:columns(name, color, is_success)')
          .in('id', dmDealIds)
          .gte('created_at', dateFrom)
          .lte('created_at', dateTo + 'T23:59:59')
          .order('created_at', { ascending: false })
        
        if (data) {
          dealsFromDM = data.map(deal => {
            const dm = dealManagers?.find(d => d.deal_id === deal.id)
            return {
              ...deal,
              column: Array.isArray(deal.column) ? deal.column[0] : deal.column,
              earnings_percent: dm?.earnings_percent || manager.salary_percent
            }
          })
        }
      }

      // Объединяем сделки (убираем дубликаты)
      const allDeals: Deal[] = []
      const seenIds = new Set<string>()
      
      for (const deal of dealsFromDM) {
        if (!seenIds.has(deal.id)) {
          seenIds.add(deal.id)
          allDeals.push(deal)
        }
      }
      
      for (const deal of (directDeals || [])) {
        if (!seenIds.has(deal.id)) {
          seenIds.add(deal.id)
          allDeals.push({
            ...deal,
            column: Array.isArray(deal.column) ? deal.column[0] : deal.column,
            earnings_percent: manager.salary_percent
          })
        }
      }

      // Сортируем по дате
      allDeals.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      
      setDeals(allDeals)

      // Получаем премии менеджера
      const { data: bonusesData } = await supabase
        .from('bonuses')
        .select('id, amount, reason, created_at, deal:deals(client_name)')
        .eq('manager_id', manager.id)
        .eq('recipient_type', 'manager')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo + 'T23:59:59')
        .order('created_at', { ascending: false })

      if (bonusesData) {
        setBonuses(bonusesData.map(b => ({
          ...b,
          deal: Array.isArray(b.deal) ? b.deal[0] : b.deal
        })))
      }

      // Рассчитываем статистику
      const totalDeals = allDeals.length
      const paidDeals = allDeals.filter(d => d.column?.is_success).length
      const totalEarnings = allDeals
        .filter(d => d.column?.is_success)
        .reduce((sum, deal) => {
          return sum + ((deal.price || 0) * (deal.earnings_percent || manager.salary_percent) / 100)
        }, 0)
      const totalBonuses = bonusesData?.reduce((sum, b) => sum + b.amount, 0) || 0
      const conversion = totalDeals > 0 ? Math.round((paidDeals / totalDeals) * 100) : 0
      
      setStats({ totalDeals, paidDeals, totalEarnings, totalBonuses, conversion })
    } catch (error) {
      console.error('Error loading manager stats:', error)
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

  if (!manager) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Статистика: {manager.full_name}
          </DialogTitle>
        </DialogHeader>

        {/* Фильтр по дате */}
        <div className="flex flex-wrap items-end gap-4 pb-4 border-b flex-shrink-0">
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
            <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
              <Card>
                <CardHeader className="p-3">
                  <CardDescription className="text-xs truncate">
                    Всего
                  </CardDescription>
                  <CardTitle className="text-lg">{stats.totalDeals}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="p-3">
                  <CardDescription className="text-xs truncate">
                    Оплачено
                  </CardDescription>
                  <CardTitle className="text-lg text-green-600">{stats.paidDeals}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="p-3">
                  <CardDescription className="text-xs truncate">
                    Конверсия
                  </CardDescription>
                  <CardTitle className="text-lg">{stats.conversion}%</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="p-3">
                  <CardDescription className="text-xs truncate">
                    Заработок
                  </CardDescription>
                  <CardTitle className="text-lg text-green-600">{formatPrice(stats.totalEarnings)}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="p-3">
                  <CardDescription className="text-xs truncate">
                    Премии
                  </CardDescription>
                  <CardTitle className="text-lg text-blue-600">{formatPrice(stats.totalBonuses)}</CardTitle>
                </CardHeader>
              </Card>
            </div>

            {/* Таблица сделок */}
            <div>
              <h3 className="font-medium mb-2">Сделки за период ({deals.length})</h3>
              <div className="border rounded-md max-h-[200px] overflow-auto">
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
                          <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate">
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
                          <TableCell className="text-right font-medium">
                            {deal.column?.is_success ? (
                              <span className="text-green-600">
                                {formatPrice((deal.price || 0) * (deal.earnings_percent || manager.salary_percent) / 100)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
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

            {/* Таблица премий */}
            {bonuses.length > 0 && (
              <div>
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  <Gift className="h-4 w-4" />
                  Премии за период ({bonuses.length})
                </h3>
                <div className="border rounded-md max-h-[120px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Дата</TableHead>
                        <TableHead>Сделка</TableHead>
                        <TableHead>Причина</TableHead>
                        <TableHead className="text-right">Сумма</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bonuses.map(bonus => (
                        <TableRow key={bonus.id}>
                          <TableCell className="text-sm">
                            {format(parseISO(bonus.created_at), 'd MMM yyyy', { locale: ru })}
                          </TableCell>
                          <TableCell>{bonus.deal?.client_name || '—'}</TableCell>
                          <TableCell className="text-muted-foreground">{bonus.reason || '—'}</TableCell>
                          <TableCell className="text-right font-medium text-blue-600">
                            {formatPrice(bonus.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
