'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Download, Calendar } from 'lucide-react'
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns'

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  columnId: string
  columnName: string
}

export function ExportDialog({ open, onOpenChange, columnId, columnName }: ExportDialogProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'))

  const setPreset = (preset: string) => {
    const now = new Date()
    switch (preset) {
      case '15days':
        setDateFrom(format(subDays(now, 15), 'yyyy-MM-dd'))
        setDateTo(format(now, 'yyyy-MM-dd'))
        break
      case '30days':
        setDateFrom(format(subDays(now, 30), 'yyyy-MM-dd'))
        setDateTo(format(now, 'yyyy-MM-dd'))
        break
      case 'thisMonth':
        setDateFrom(format(startOfMonth(now), 'yyyy-MM-dd'))
        setDateTo(format(endOfMonth(now), 'yyyy-MM-dd'))
        break
      case 'lastMonth':
        const lastMonth = subMonths(now, 1)
        setDateFrom(format(startOfMonth(lastMonth), 'yyyy-MM-dd'))
        setDateTo(format(endOfMonth(lastMonth), 'yyyy-MM-dd'))
        break
      case 'thisYear':
        setDateFrom(format(startOfYear(now), 'yyyy-MM-dd'))
        setDateTo(format(endOfYear(now), 'yyyy-MM-dd'))
        break
    }
  }

  const handleExport = async () => {
    setLoading(true)
    try {
      // Получаем сделки с фильтром по дате
      const { data: deals, error } = await supabase
        .from('deals')
        .select('*, executor:executors!deals_executor_id_fkey(*), manager:profiles!deals_manager_id_fkey(*)')
        .eq('column_id', columnId)
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo + 'T23:59:59')
        .order('created_at', { ascending: false })

      if (error) throw error

      if (!deals || deals.length === 0) {
        alert('Нет сделок за выбранный период')
        setLoading(false)
        return
      }

      // Получаем всех исполнителей для каждой сделки
      const dealIds = deals.map(d => d.id)
      const { data: dealExecutors } = await supabase
        .from('deal_executors')
        .select('deal_id, executor:executors(*), earnings_percent')
        .in('deal_id', dealIds)

      // Получаем всех менеджеров для каждой сделки
      const { data: dealManagers } = await supabase
        .from('deal_managers')
        .select('deal_id, manager:profiles!deal_managers_manager_id_fkey(*), earnings_percent')
        .in('deal_id', dealIds)

      // Получаем премии исполнителей для каждой сделки
      const { data: executorBonuses } = await supabase
        .from('bonuses')
        .select('deal_id, amount, executor_id')
        .in('deal_id', dealIds)
        .not('executor_id', 'is', null)

      // Получаем премии менеджеров для каждой сделки
      const { data: managerBonuses } = await supabase
        .from('bonuses')
        .select('deal_id, amount, manager_id')
        .in('deal_id', dealIds)
        .not('manager_id', 'is', null)

      // Формируем данные для экспорта
      const headers = [
        'Клиент',
        'Телефон',
        'Адрес',
        'Сумма сделки',
        'Исполнители',
        '% исполнителей',
        'Выплата исполнителям',
        'Премия исполнителям',
        'Менеджеры',
        '% менеджеров',
        'Выплата менеджерам',
        'Премия менеджерам',
        'Чистая прибыль',
        'Примечание',
        'Дата создания',
        'Дата выполнения',
        'Источник',
        'Повторный клиент'
      ]

      const rows = deals.map(deal => {
        const price = deal.price || 0

        // Все исполнители сделки
        const executors = dealExecutors?.filter(de => de.deal_id === deal.id) || []
        const executorNames = executors.map(e => {
          const exec = Array.isArray(e.executor) ? e.executor[0] : e.executor
          return exec?.name
        }).filter(Boolean).join(', ') || (deal.executor?.name || '')
        const executorPercents = executors.map(e => `${e.earnings_percent}%`).join(', ') || '40%'
        const executorPayment = executors.length > 0 
          ? executors.reduce((sum, e) => sum + (price * (e.earnings_percent || 40) / 100), 0)
          : (price * 0.4)

        // Премии исполнителям по этой сделке
        const execBonusTotal = executorBonuses?.filter(b => b.deal_id === deal.id).reduce((sum, b) => sum + (b.amount || 0), 0) || 0

        // Все менеджеры сделки
        const managers = dealManagers?.filter(dm => dm.deal_id === deal.id) || []
        const managerNames = managers.map(m => {
          const mgr = Array.isArray(m.manager) ? m.manager[0] : m.manager
          return mgr?.full_name
        }).filter(Boolean).join(', ') || (deal.manager?.full_name || '')
        const managerPercents = managers.map(m => `${m.earnings_percent}%`).join(', ') || '10%'
        const managerPayment = managers.length > 0
          ? managers.reduce((sum, m) => sum + (price * (m.earnings_percent || 10) / 100), 0)
          : (price * 0.1)

        // Премии менеджерам по этой сделке
        const mgrBonusTotal = managerBonuses?.filter(b => b.deal_id === deal.id).reduce((sum, b) => sum + (b.amount || 0), 0) || 0

        // Чистая прибыль (с учётом премий)
        const netProfit = price - executorPayment - managerPayment - execBonusTotal - mgrBonusTotal

        return [
          deal.client_name,
          deal.client_phone,
          deal.address,
          price.toString(),
          executorNames,
          executorPercents,
          executorPayment.toFixed(0),
          execBonusTotal.toFixed(0),
          managerNames,
          managerPercents,
          managerPayment.toFixed(0),
          mgrBonusTotal.toFixed(0),
          netProfit.toFixed(0),
          deal.notes || '',
          deal.created_at ? format(new Date(deal.created_at), 'dd.MM.yyyy HH:mm') : '',
          deal.scheduled_at ? format(new Date(deal.scheduled_at), 'dd.MM.yyyy HH:mm') : '',
          deal.source || '',
          deal.is_repeated_client ? 'Да' : 'Нет'
        ]
      })

      // Добавляем итоговую строку
      const totalPrice = deals.reduce((sum, d) => sum + (d.price || 0), 0)
      const totalExecutorPayment = rows.reduce((sum, row) => sum + (parseFloat(row[6]) || 0), 0)
      const totalExecBonus = rows.reduce((sum, row) => sum + (parseFloat(row[7]) || 0), 0)
      const totalManagerPayment = rows.reduce((sum, row) => sum + (parseFloat(row[10]) || 0), 0)
      const totalMgrBonus = rows.reduce((sum, row) => sum + (parseFloat(row[11]) || 0), 0)
      const totalNetProfit = rows.reduce((sum, row) => sum + (parseFloat(row[12]) || 0), 0)

      rows.push([]) // Пустая строка
      rows.push([
        'ИТОГО:',
        '',
        '',
        totalPrice.toString(),
        '',
        '',
        totalExecutorPayment.toFixed(0),
        totalExecBonus.toFixed(0),
        '',
        '',
        totalManagerPayment.toFixed(0),
        totalMgrBonus.toFixed(0),
        totalNetProfit.toFixed(0),
        '',
        '',
        '',
        '',
        `Сделок: ${deals.length}`
      ])

      // Формируем CSV
      const BOM = '\uFEFF'
      const csvContent = BOM + [
        headers.join(';'),
        ...rows.map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(';'))
      ].join('\n')

      // Скачиваем
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `${columnName}_${dateFrom}_${dateTo}.csv`
      link.click()
      URL.revokeObjectURL(link.href)

      onOpenChange(false)
    } catch (error) {
      console.error('Export error:', error)
      alert('Ошибка экспорта')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Экспорт: {columnName}
          </DialogTitle>
          <DialogDescription>
            Выберите период для экспорта сделок в CSV
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Date range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>С даты</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>По дату</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
              />
            </div>
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setPreset('15days')}>
              15 дней
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPreset('30days')}>
              30 дней
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPreset('thisMonth')}>
              Этот месяц
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPreset('lastMonth')}>
              Прошлый месяц
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPreset('thisYear')}>
              Этот год
            </Button>
          </div>

          {/* Info */}
          <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
            <p className="font-medium mb-1">В файл будут включены:</p>
            <ul className="list-disc list-inside space-y-0.5 text-xs">
              <li>Клиент, телефон, адрес</li>
              <li>Сумма сделки</li>
              <li>Все исполнители и их % / выплаты</li>
              <li>Все менеджеры и их % / выплаты</li>
              <li>Чистая прибыль</li>
              <li>Примечание, источник, даты</li>
              <li>Итоговая строка с суммами</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleExport} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Экспорт...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Скачать CSV
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
