'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Download, Filter, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

interface Profile {
  id: string
  full_name: string
  roles: string[]
  salary_percent: number
}

interface SalaryEntry {
  id: string
  type: 'deal' | 'bonus'
  date: string
  description: string
  amount: number
  percent?: number
  deal_price?: number
  person_id: string
  person_name: string
  person_role: 'executor' | 'manager'
}

export default function SalariesPage() {
  const [entries, setEntries] = useState<SalaryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [executors, setExecutors] = useState<{ id: string; name: string }[]>([])
  
  // Filters
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const [selectedPerson, setSelectedPerson] = useState<string>('all')
  const [selectedRole, setSelectedRole] = useState<string>('all')
  
  const supabase = createClient()

  useEffect(() => {
    loadProfiles()
    loadExecutors()
  }, [])

  useEffect(() => {
    loadSalaryData()
  }, [dateFrom, dateTo, selectedPerson, selectedRole])

  const loadProfiles = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, roles, salary_percent')
      .order('full_name')
    
    if (data) {
      setProfiles(data)
    }
  }

  const loadExecutors = async () => {
    const { data } = await supabase
      .from('executors')
      .select('id, name')
      .order('name')
    
    if (data) {
      setExecutors(data)
    }
  }

  const loadSalaryData = async () => {
    setLoading(true)
    const entries: SalaryEntry[] = []
    
    try {
      // Get paid/completed column (by is_success flag or name)
      const { data: completedColumn } = await supabase
        .from('columns')
        .select('id')
        .eq('is_success', true)
        .single()
      
      if (!completedColumn) {
        // Fallback - try to find by name
        const { data: fallbackColumn } = await supabase
          .from('columns')
          .select('id')
          .or('name.eq.Завершено,name.eq.Оплачено,name.eq.Выполнено')
          .single()
        
        if (!fallbackColumn) {
          toast.error('Не найдена колонка оплаченных сделок')
          setLoading(false)
          return
        }
        
        // Use fallback
        return loadSalaryDataWithColumn(fallbackColumn.id, entries)
      }
      
      await loadSalaryDataWithColumn(completedColumn.id, entries)
    } catch (error) {
      console.error('Error loading salary data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSalaryDataWithColumn = async (columnId: string, entries: SalaryEntry[]) => {
    // First, load completed deals in date range
    const { data: completedDeals, error: dealsError } = await supabase
      .from('deals')
      .select('id, client_name, price, completed_at')
      .eq('column_id', columnId)
      .gte('completed_at', dateFrom)
      .lte('completed_at', dateTo + 'T23:59:59')
    
    if (dealsError) {
      console.error('Deals query error:', dealsError)
    }
    
    const dealIds = completedDeals?.map(d => d.id) || []
    const dealMap = new Map(completedDeals?.map(d => [d.id, d]) || [])

    // Parse selected person filter
    const isExecutorFilter = selectedPerson.startsWith('exec-')
    const isManagerFilter = selectedPerson.startsWith('mgr-')
    const filteredPersonId = selectedPerson.replace(/^(exec-|mgr-)/, '')

      // Load executor earnings from deals
      if (dealIds.length > 0 && (selectedRole === 'all' || selectedRole === 'executor') && !isManagerFilter) {
        let executorQuery = supabase
          .from('deal_executors')
          .select(`
            deal_id,
            executor_id,
            earnings_percent,
            executor:executors(id, name)
          `)
          .in('deal_id', dealIds)
        
        if (isExecutorFilter) {
          executorQuery = executorQuery.eq('executor_id', filteredPersonId)
        }
        
        const { data: executorData, error: executorError } = await executorQuery
        
        if (executorError) {
          console.error('Executor query error:', executorError)
        }
        
        if (executorData) {
          for (const item of executorData) {
            const deal = dealMap.get(item.deal_id)
            const executor = item.executor as any
            if (deal && executor) {
              const percent = item.earnings_percent || 100
              const amount = (deal.price * percent) / 100
              entries.push({
                id: `exec-${item.deal_id}-${item.executor_id}`,
                type: 'deal',
                date: deal.completed_at!,
                description: `Сделка: ${deal.client_name}`,
                amount,
                percent,
                deal_price: deal.price,
                person_id: executor.id,
                person_name: executor.name,
                person_role: 'executor'
              })
            }
          }
        }
      }
      
      // Load manager earnings from deals
      if (dealIds.length > 0 && (selectedRole === 'all' || selectedRole === 'manager') && !isExecutorFilter) {
        let managerQuery = supabase
          .from('deal_managers')
          .select(`
            deal_id,
            manager_id,
            earnings_percent,
            manager:profiles(id, full_name)
          `)
          .in('deal_id', dealIds)
        
        if (isManagerFilter) {
          managerQuery = managerQuery.eq('manager_id', filteredPersonId)
        }
        
        const { data: managerData, error: managerError } = await managerQuery
        
        if (managerError) {
          console.error('Manager query error:', managerError)
        }
        
        if (managerData) {
          for (const item of managerData) {
            const deal = dealMap.get(item.deal_id)
            const manager = item.manager as any
            if (deal && manager) {
              const percent = item.earnings_percent || 100
              const amount = (deal.price * percent) / 100
              entries.push({
                id: `mgr-${item.deal_id}-${item.manager_id}`,
                type: 'deal',
                date: deal.completed_at!,
                description: `Сделка: ${deal.client_name}`,
                amount,
                percent,
                deal_price: deal.price,
                person_id: manager.id,
                person_name: manager.full_name,
                person_role: 'manager'
              })
            }
          }
        }
      }
      
      // Load bonuses - separate queries for executors and managers
      if (selectedRole === 'all' || selectedRole === 'executor') {
        // Executor bonuses
        let execBonusQuery = supabase
          .from('bonuses')
          .select(`
            id,
            amount,
            reason,
            created_at,
            executor_id,
            executor:executors(id, name)
          `)
          .not('executor_id', 'is', null)
          .gte('created_at', dateFrom)
          .lte('created_at', dateTo + 'T23:59:59')
        
        if (isExecutorFilter) {
          execBonusQuery = execBonusQuery.eq('executor_id', filteredPersonId)
        }
        
        const { data: execBonusData, error: execBonusError } = await execBonusQuery
        
        if (execBonusError) {
          console.error('Executor bonus query error:', execBonusError)
        }
        
        if (execBonusData) {
          for (const bonus of execBonusData) {
            const executor = bonus.executor as any
            if (executor) {
              entries.push({
                id: `bonus-exec-${bonus.id}`,
                type: 'bonus',
                date: bonus.created_at,
                description: bonus.reason || 'Премия',
                amount: bonus.amount,
                person_id: executor.id,
                person_name: executor.name,
                person_role: 'executor'
              })
            }
          }
        }
      }
      
      if (selectedRole === 'all' || selectedRole === 'manager') {
        // Manager bonuses
        let mgrBonusQuery = supabase
          .from('bonuses')
          .select(`
            id,
            amount,
            reason,
            created_at,
            manager_id,
            manager:profiles!bonuses_manager_id_fkey(id, full_name)
          `)
          .not('manager_id', 'is', null)
          .gte('created_at', dateFrom)
          .lte('created_at', dateTo + 'T23:59:59')
        
        if (isManagerFilter) {
          mgrBonusQuery = mgrBonusQuery.eq('manager_id', filteredPersonId)
        }
        
        const { data: mgrBonusData, error: mgrBonusError } = await mgrBonusQuery
        
        if (mgrBonusError) {
          console.error('Manager bonus query error:', mgrBonusError)
        }
        
        if (mgrBonusData) {
          for (const bonus of mgrBonusData) {
            const manager = bonus.manager as any
            if (manager) {
              entries.push({
                id: `bonus-mgr-${bonus.id}`,
                type: 'bonus',
                date: bonus.created_at,
                description: bonus.reason || 'Премия',
                amount: bonus.amount,
                person_id: manager.id,
                person_name: manager.full_name,
                person_role: 'manager'
              })
            }
          }
        }
      }
      
      // Sort by date descending
      entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      
      setEntries(entries)
  }

  const exportToCSV = () => {
    if (entries.length === 0) {
      toast.error('Нет данных для экспорта')
      return
    }

    const headers = ['Дата', 'Сотрудник', 'Роль', 'Тип', 'Описание', 'Сумма сделки', 'Процент', 'За сделку', 'Премия', 'Итого начисление']
    const rows = entries.map(entry => [
      new Date(entry.date).toLocaleDateString('ru-RU'),
      entry.person_name,
      entry.person_role === 'executor' ? 'Исполнитель' : 'Менеджер',
      entry.type === 'deal' ? 'Сделка' : 'Премия',
      entry.description,
      entry.deal_price?.toFixed(2) || '',
      entry.percent ? `${entry.percent}%` : '',
      entry.type === 'deal' ? entry.amount.toFixed(2) : '',
      entry.type === 'bonus' ? entry.amount.toFixed(2) : '',
      entry.amount.toFixed(2)
    ])

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\n')

    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `salaries_${dateFrom}_${dateTo}.csv`
    link.click()
    URL.revokeObjectURL(url)
    
    toast.success('Отчёт экспортирован')
  }

  const totalAmount = entries.reduce((sum, e) => sum + e.amount, 0)
  const executorTotal = entries.filter(e => e.person_role === 'executor').reduce((sum, e) => sum + e.amount, 0)
  const managerTotal = entries.filter(e => e.person_role === 'manager').reduce((sum, e) => sum + e.amount, 0)
  const bonusTotal = entries.filter(e => e.type === 'bonus').reduce((sum, e) => sum + e.amount, 0)

  // Group by person for summary
  const personSummary = entries.reduce((acc, entry) => {
    const key = entry.person_id
    if (!acc[key]) {
      acc[key] = {
        name: entry.person_name,
        role: entry.person_role,
        deals: 0,
        bonuses: 0,
        total: 0
      }
    }
    if (entry.type === 'deal') {
      acc[key].deals += entry.amount
    } else {
      acc[key].bonuses += entry.amount
    }
    acc[key].total += entry.amount
    return acc
  }, {} as Record<string, { name: string; role: string; deals: number; bonuses: number; total: number }>)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Отчёт по зарплатам</h1>
          <p className="text-muted-foreground">Начисления сотрудникам за период</p>
        </div>
        <Button onClick={exportToCSV} disabled={entries.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Экспорт CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Фильтры
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Дата с</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Дата по</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Роль</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Все" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="executor">Исполнители</SelectItem>
                  <SelectItem value="manager">Менеджеры</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Сотрудник</Label>
              <Select value={selectedPerson} onValueChange={setSelectedPerson}>
                <SelectTrigger>
                  <SelectValue placeholder="Все" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  {selectedRole !== 'manager' && executors.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs text-muted-foreground">Исполнители</div>
                      {executors.map(e => (
                        <SelectItem key={`exec-${e.id}`} value={`exec-${e.id}`}>{e.name}</SelectItem>
                      ))}
                    </>
                  )}
                  {selectedRole !== 'executor' && profiles.filter(p => p.roles?.includes('manager')).length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs text-muted-foreground">Менеджеры</div>
                      {profiles.filter(p => p.roles?.includes('manager')).map(p => (
                        <SelectItem key={`mgr-${p.id}`} value={`mgr-${p.id}`}>{p.full_name}</SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Всего начислено</CardDescription>
            <CardTitle className="text-2xl">{totalAmount.toLocaleString('ru-RU')} ₽</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Исполнителям</CardDescription>
            <CardTitle className="text-2xl text-blue-600">{executorTotal.toLocaleString('ru-RU')} ₽</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Менеджерам</CardDescription>
            <CardTitle className="text-2xl text-green-600">{managerTotal.toLocaleString('ru-RU')} ₽</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Премий</CardDescription>
            <CardTitle className="text-2xl text-purple-600">{bonusTotal.toLocaleString('ru-RU')} ₽</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Summary by Person */}
      {Object.keys(personSummary).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Итого по сотрудникам</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Сотрудник</TableHead>
                  <TableHead>Роль</TableHead>
                  <TableHead className="text-right">За сделки</TableHead>
                  <TableHead className="text-right">Премии</TableHead>
                  <TableHead className="text-right">Итого</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.values(personSummary)
                  .sort((a, b) => b.total - a.total)
                  .map((person, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{person.name}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs ${
                          person.role === 'executor' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {person.role === 'executor' ? 'Исполнитель' : 'Менеджер'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{person.deals.toLocaleString('ru-RU')} ₽</TableCell>
                      <TableCell className="text-right">{person.bonuses.toLocaleString('ru-RU')} ₽</TableCell>
                      <TableCell className="text-right font-bold">{person.total.toLocaleString('ru-RU')} ₽</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Детализация начислений</span>
            <Button variant="outline" size="sm" onClick={loadSalaryData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Обновить
            </Button>
          </CardTitle>
          <CardDescription>Всего записей: {entries.length}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Нет начислений за выбранный период
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Сотрудник</TableHead>
                  <TableHead>Роль</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead>Описание</TableHead>
                  <TableHead className="text-right">Сумма сделки</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead className="text-right">Начисление</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell>{new Date(entry.date).toLocaleDateString('ru-RU')}</TableCell>
                    <TableCell className="font-medium">{entry.person_name}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs ${
                        entry.person_role === 'executor' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {entry.person_role === 'executor' ? 'Исполн.' : 'Менедж.'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs ${
                        entry.type === 'deal' ? 'bg-gray-100 text-gray-800' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {entry.type === 'deal' ? 'Сделка' : 'Премия'}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate" title={entry.description}>
                      {entry.description}
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.deal_price ? `${entry.deal_price.toLocaleString('ru-RU')} ₽` : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.percent ? `${entry.percent}%` : '—'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {entry.amount.toLocaleString('ru-RU')} ₽
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
