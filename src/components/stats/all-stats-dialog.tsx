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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, TrendingUp, Wallet, ClipboardList, Users, Download } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, subQuarters, startOfYear, endOfYear, subYears, subDays } from 'date-fns'
import { ru } from 'date-fns/locale'

interface PersonStats {
  id: string
  name: string
  totalDeals: number
  paidDeals: number
  totalEarnings: number
  bonuses: number
  totalIncome: number
}

interface AllStatsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: 'executors' | 'managers'
  title: string
}

export function AllStatsDialog({ open, onOpenChange, type, title }: AllStatsDialogProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<PersonStats[]>([])
  const [period, setPeriod] = useState('month')
  const [customDateFrom, setCustomDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [customDateTo, setCustomDateTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [appliedDateFrom, setAppliedDateFrom] = useState(customDateFrom)
  const [appliedDateTo, setAppliedDateTo] = useState(customDateTo)
  
  // Totals
  const [totals, setTotals] = useState({
    totalDeals: 0,
    paidDeals: 0,
    totalEarnings: 0,
    bonuses: 0,
    totalIncome: 0
  })

  useEffect(() => {
    if (open) {
      loadStats()
    }
  }, [open, period, appliedDateFrom, appliedDateTo])

  const getDateRange = () => {
    const now = new Date()
    let startDate: Date
    let endDate: Date

    if (period === 'custom') {
      startDate = new Date(appliedDateFrom)
      endDate = new Date(appliedDateTo + 'T23:59:59')
    } else if (period === 'month') {
      startDate = startOfMonth(now)
      endDate = endOfMonth(now)
    } else if (period === 'quarter') {
      startDate = startOfQuarter(now)
      endDate = endOfQuarter(now)
    } else {
      startDate = startOfYear(now)
      endDate = endOfYear(now)
    }

    return { startDate, endDate }
  }

  const loadStats = async () => {
    setLoading(true)
    try {
      const { startDate, endDate } = getDateRange()

      // Получаем колонку "Оплачено"
      const { data: paidColumn } = await supabase
        .from('columns')
        .select('id')
        .eq('is_success', true)
        .single()

      const paidColumnId = paidColumn?.id

      if (type === 'executors') {
        // Загружаем всех исполнителей
        const { data: executors } = await supabase
          .from('executors')
          .select('id, name')
          .eq('is_active', true)
          .order('name')

        const statsData: PersonStats[] = []

        for (const executor of executors || []) {
          // Получаем связи исполнителя со сделками
          const { data: dealExecutors } = await supabase
            .from('deal_executors')
            .select('deal_id, earnings_percent')
            .eq('executor_id', executor.id)

          const dealIds = dealExecutors?.map(de => de.deal_id) || []

          let totalDeals = 0
          let paidDeals = 0
          let totalEarnings = 0

          if (dealIds.length > 0) {
            // Все сделки за период
            const { data: allDeals } = await supabase
              .from('deals')
              .select('id, price, column_id')
              .in('id', dealIds)
              .gte('created_at', startDate.toISOString())
              .lte('created_at', endDate.toISOString())

            totalDeals = allDeals?.length || 0

            // Оплаченные сделки
            const paidDealsData = allDeals?.filter(d => d.column_id === paidColumnId) || []
            paidDeals = paidDealsData.length

            // Заработок
            totalEarnings = paidDealsData.reduce((sum, deal) => {
              const link = dealExecutors?.find(de => de.deal_id === deal.id)
              return sum + ((deal.price || 0) * (link?.earnings_percent || 40) / 100)
            }, 0)
          }

          // Бонусы
          const { data: bonusesData } = await supabase
            .from('bonuses')
            .select('amount')
            .eq('executor_id', executor.id)
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString())

          const bonuses = bonusesData?.reduce((sum, b) => sum + (b.amount || 0), 0) || 0

          statsData.push({
            id: executor.id,
            name: executor.name,
            totalDeals,
            paidDeals,
            totalEarnings,
            bonuses,
            totalIncome: totalEarnings + bonuses
          })
        }

        setStats(statsData)
        
        // Подсчёт итогов
        setTotals({
          totalDeals: statsData.reduce((sum, s) => sum + s.totalDeals, 0),
          paidDeals: statsData.reduce((sum, s) => sum + s.paidDeals, 0),
          totalEarnings: statsData.reduce((sum, s) => sum + s.totalEarnings, 0),
          bonuses: statsData.reduce((sum, s) => sum + s.bonuses, 0),
          totalIncome: statsData.reduce((sum, s) => sum + s.totalIncome, 0)
        })

      } else {
        // Загружаем всех менеджеров
        const { data: managers } = await supabase
          .from('profiles')
          .select('id, full_name')
          .order('full_name')

        const statsData: PersonStats[] = []

        for (const manager of managers || []) {
          // Получаем связи менеджера со сделками
          const { data: dealManagers } = await supabase
            .from('deal_managers')
            .select('deal_id, earnings_percent')
            .eq('manager_id', manager.id)

          const dealIds = dealManagers?.map(dm => dm.deal_id) || []

          let totalDeals = 0
          let paidDeals = 0
          let totalEarnings = 0

          if (dealIds.length > 0) {
            // Все сделки за период
            const { data: allDeals } = await supabase
              .from('deals')
              .select('id, price, column_id')
              .in('id', dealIds)
              .gte('created_at', startDate.toISOString())
              .lte('created_at', endDate.toISOString())

            totalDeals = allDeals?.length || 0

            // Оплаченные сделки
            const paidDealsData = allDeals?.filter(d => d.column_id === paidColumnId) || []
            paidDeals = paidDealsData.length

            // Заработок
            totalEarnings = paidDealsData.reduce((sum, deal) => {
              const link = dealManagers?.find(dm => dm.deal_id === deal.id)
              return sum + ((deal.price || 0) * (link?.earnings_percent || 10) / 100)
            }, 0)
          }

          // Бонусы
          const { data: bonusesData } = await supabase
            .from('bonuses')
            .select('amount')
            .eq('manager_id', manager.id)
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString())

          const bonuses = bonusesData?.reduce((sum, b) => sum + (b.amount || 0), 0) || 0

          if (totalDeals > 0 || bonuses > 0) {
            statsData.push({
              id: manager.id,
              name: manager.full_name || 'Без имени',
              totalDeals,
              paidDeals,
              totalEarnings,
              bonuses,
              totalIncome: totalEarnings + bonuses
            })
          }
        }

        setStats(statsData)
        
        // Подсчёт итогов
        setTotals({
          totalDeals: statsData.reduce((sum, s) => sum + s.totalDeals, 0),
          paidDeals: statsData.reduce((sum, s) => sum + s.paidDeals, 0),
          totalEarnings: statsData.reduce((sum, s) => sum + s.totalEarnings, 0),
          bonuses: statsData.reduce((sum, s) => sum + s.bonuses, 0),
          totalIncome: statsData.reduce((sum, s) => sum + s.totalIncome, 0)
        })
      }

    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportToCSV = () => {
    const { startDate, endDate } = getDateRange()
    const headers = ['Имя', 'Всего сделок', 'Оплачено', 'Заработок', 'Бонусы', 'Итого']
    const rows = stats.map(s => [
      s.name,
      s.totalDeals,
      s.paidDeals,
      s.totalEarnings,
      s.bonuses,
      s.totalIncome
    ])
    
    // Добавляем итоговую строку
    rows.push([
      'ИТОГО',
      totals.totalDeals,
      totals.paidDeals,
      totals.totalEarnings,
      totals.bonuses,
      totals.totalIncome
    ])

    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${type}_stats_${format(startDate, 'yyyy-MM-dd')}_${format(endDate, 'yyyy-MM-dd')}.csv`
    a.click()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {title}
          </DialogTitle>
        </DialogHeader>

        {/* Фильтры */}
        <div className="flex flex-wrap items-end gap-2 py-2 border-b">
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
                  className="w-[140px]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">До</Label>
                <Input
                  type="date"
                  value={customDateTo}
                  onChange={(e) => setCustomDateTo(e.target.value)}
                  className="w-[140px]"
                />
              </div>
              <Button 
                size="sm"
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

          <div className="ml-auto">
            <Button variant="outline" size="sm" onClick={exportToCSV} disabled={loading || stats.length === 0}>
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
          </div>
        </div>

        {/* Итоговые карточки */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 py-2">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Всего сделок</p>
                  <p className="text-lg font-bold">{totals.totalDeals}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Оплачено</p>
                  <p className="text-lg font-bold">{totals.paidDeals}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-yellow-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Заработок</p>
                  <p className="text-lg font-bold">{formatPrice(totals.totalEarnings)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-purple-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Итого с бонусами</p>
                  <p className="text-lg font-bold">{formatPrice(totals.totalIncome)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Таблица */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : stats.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Нет данных за выбранный период
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Имя</TableHead>
                  <TableHead className="text-right">Сделок</TableHead>
                  <TableHead className="text-right">Оплачено</TableHead>
                  <TableHead className="text-right">Заработок</TableHead>
                  <TableHead className="text-right">Бонусы</TableHead>
                  <TableHead className="text-right">Итого</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.map((person) => (
                  <TableRow key={person.id}>
                    <TableCell className="font-medium">{person.name}</TableCell>
                    <TableCell className="text-right">{person.totalDeals}</TableCell>
                    <TableCell className="text-right">{person.paidDeals}</TableCell>
                    <TableCell className="text-right">{formatPrice(person.totalEarnings)}</TableCell>
                    <TableCell className="text-right">{formatPrice(person.bonuses)}</TableCell>
                    <TableCell className="text-right font-medium">{formatPrice(person.totalIncome)}</TableCell>
                  </TableRow>
                ))}
                {/* Итоговая строка */}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell>ИТОГО</TableCell>
                  <TableCell className="text-right">{totals.totalDeals}</TableCell>
                  <TableCell className="text-right">{totals.paidDeals}</TableCell>
                  <TableCell className="text-right">{formatPrice(totals.totalEarnings)}</TableCell>
                  <TableCell className="text-right">{formatPrice(totals.bonuses)}</TableCell>
                  <TableCell className="text-right">{formatPrice(totals.totalIncome)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
