'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { formatPrice, formatPhone } from '@/lib/utils'
import { Plus, Pencil, Trash2, Phone, User, TrendingUp, Calendar, BarChart3 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { ExecutorStatsDialog } from '@/components/stats/executor-stats-dialog'
import { AllStatsDialog } from '@/components/stats/all-stats-dialog'

interface Executor {
  id: string
  name: string
  phone: string
  is_active: boolean
  salary_percent?: number
  created_at: string
  // Calculated fields
  totalDeals?: number
  totalEarnings?: number
  lastDealDate?: string
}

export default function ExecutorsPage() {
  const [executors, setExecutors] = useState<Executor[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedExecutor, setSelectedExecutor] = useState<Executor | null>(null)
  const [formData, setFormData] = useState({ name: '', phone: '', is_active: true })
  const [saving, setSaving] = useState(false)
  const [statsDialogOpen, setStatsDialogOpen] = useState(false)
  const [statsExecutor, setStatsExecutor] = useState<Executor | null>(null)
  const [allStatsDialogOpen, setAllStatsDialogOpen] = useState(false)
  const supabase = createClient()

  const loadExecutors = useCallback(async () => {
    setLoading(true)
    try {
      // Получаем исполнителей
      const { data: executorsData, error } = await supabase
        .from('executors')
        .select('*')
        .order('name')

      if (error) throw error

      // Для каждого исполнителя получаем статистику
      const executorsWithStats = await Promise.all(
        (executorsData || []).map(async (executor) => {
          // Получаем сделки этого исполнителя
          const { data: executorDeals } = await supabase
            .from('deals')
            .select('id, price, created_at')
            .eq('executor_id', executor.id)

          const totalDeals = executorDeals?.length || 0
          // Примерный расчёт заработка (40% от суммы сделок)
          const totalEarnings = executorDeals?.reduce((sum, d) => sum + ((d.price || 0) * 0.4), 0) || 0
          
          // Находим дату последней сделки
          let lastDealDate: string | undefined
          if (executorDeals && executorDeals.length > 0) {
            const dates = executorDeals
              .map(d => d.created_at)
              .filter(Boolean)
              .sort()
              .reverse()
            lastDealDate = dates[0]
          }

          return {
            ...executor,
            totalDeals,
            totalEarnings,
            lastDealDate
          }
        })
      )

      setExecutors(executorsWithStats)
    } catch (error) {
      console.error('Error loading executors:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    loadExecutors()
  }, [loadExecutors])

  function openCreateDialog() {
    setSelectedExecutor(null)
    setFormData({ name: '', phone: '', is_active: true })
    setDialogOpen(true)
  }

  function openEditDialog(executor: Executor) {
    setSelectedExecutor(executor)
    setFormData({
      name: executor.name,
      phone: executor.phone,
      is_active: executor.is_active
    })
    setDialogOpen(true)
  }

  function openDeleteDialog(executor: Executor) {
    setSelectedExecutor(executor)
    setDeleteDialogOpen(true)
  }

  function openStatsDialog(executor: Executor) {
    setStatsExecutor(executor)
    setStatsDialogOpen(true)
  }

  async function handleSave() {
    if (!formData.name || !formData.phone) return

    setSaving(true)
    try {
      if (selectedExecutor) {
        // Обновление
        const { error } = await supabase
          .from('executors')
          .update({
            name: formData.name,
            phone: formData.phone,
            is_active: formData.is_active,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedExecutor.id)

        if (error) throw error
      } else {
        // Создание
        const { error } = await supabase
          .from('executors')
          .insert({
            name: formData.name,
            phone: formData.phone,
            is_active: formData.is_active
          })

        if (error) throw error
      }

      setDialogOpen(false)
      loadExecutors()
    } catch (error) {
      console.error('Error saving executor:', error)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!selectedExecutor) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('executors')
        .delete()
        .eq('id', selectedExecutor.id)

      if (error) throw error

      setDeleteDialogOpen(false)
      loadExecutors()
    } catch (error) {
      console.error('Error deleting executor:', error)
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(executor: Executor) {
    try {
      const { error } = await supabase
        .from('executors')
        .update({ is_active: !executor.is_active })
        .eq('id', executor.id)

      if (error) throw error
      loadExecutors()
    } catch (error) {
      console.error('Error toggling executor:', error)
    }
  }

  // Статистика
  const stats = {
    total: executors.length,
    active: executors.filter(e => e.is_active).length,
    totalEarnings: executors.reduce((sum, e) => sum + (e.totalEarnings || 0), 0),
    totalDeals: executors.reduce((sum, e) => sum + (e.totalDeals || 0), 0)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Исполнители</h1>
          <p className="text-muted-foreground">Управление клинерами</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAllStatsDialogOpen(true)}>
            <BarChart3 className="h-4 w-4 mr-2" />
            Статистика всех
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Добавить исполнителя
          </Button>
        </div>
      </div>

      {/* Статистика */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Всего исполнителей</CardDescription>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Активных</CardDescription>
            <CardTitle className="text-2xl text-green-600">{stats.active}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Всего заказов</CardDescription>
            <CardTitle className="text-2xl">{stats.totalDeals}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Выплачено</CardDescription>
            <CardTitle className="text-2xl">{formatPrice(stats.totalEarnings)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Таблица */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Имя</TableHead>
                <TableHead>Телефон</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Заказов</TableHead>
                <TableHead className="text-right">Заработок</TableHead>
                <TableHead>Последний заказ</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {executors.map(executor => (
                <TableRow key={executor.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-4 w-4" />
                      </div>
                      <span className="font-medium">{executor.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {formatPhone(executor.phone)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={executor.is_active ? 'default' : 'secondary'}>
                      {executor.is_active ? 'Активен' : 'Неактивен'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <TrendingUp className="h-3 w-3 text-muted-foreground" />
                      {executor.totalDeals || 0}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatPrice(executor.totalEarnings || 0)}
                  </TableCell>
                  <TableCell>
                    {executor.lastDealDate ? (
                      <div className="flex items-center gap-1 text-muted-foreground text-sm">
                        <Calendar className="h-3 w-3" />
                        {format(parseISO(executor.lastDealDate), 'd MMM yyyy', { locale: ru })}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openStatsDialog(executor)}
                        title="Статистика"
                      >
                        <BarChart3 className="h-4 w-4" />
                      </Button>
                      <Switch
                        checked={executor.is_active}
                        onCheckedChange={() => toggleActive(executor)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(executor)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(executor)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {executors.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Нет исполнителей. Нажмите «Добавить исполнителя» чтобы создать первого.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Диалог создания/редактирования */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedExecutor ? 'Редактировать исполнителя' : 'Новый исполнитель'}
            </DialogTitle>
            <DialogDescription>
              {selectedExecutor 
                ? 'Измените данные исполнителя' 
                : 'Заполните данные нового исполнителя'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">ФИО *</Label>
              <Input
                id="name"
                placeholder="Иванов Иван Иванович"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Телефон *</Label>
              <Input
                id="phone"
                placeholder="+7 900 123-45-67"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Активен</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={saving || !formData.name || !formData.phone}>
              {saving ? 'Сохранение...' : selectedExecutor ? 'Сохранить' : 'Создать'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог удаления */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить исполнителя?</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите удалить исполнителя «{selectedExecutor?.name}»? 
              Это действие нельзя отменить. История заказов этого исполнителя также будет удалена.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? 'Удаление...' : 'Удалить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог статистики */}
      <ExecutorStatsDialog
        open={statsDialogOpen}
        onOpenChange={setStatsDialogOpen}
        executor={statsExecutor ? {
          id: statsExecutor.id,
          name: statsExecutor.name,
          salary_percent: statsExecutor.salary_percent || 40
        } : null}
      />

      {/* Диалог статистики всех исполнителей */}
      <AllStatsDialog
        open={allStatsDialogOpen}
        onOpenChange={setAllStatsDialogOpen}
        type="executors"
        title="Статистика всех исполнителей"
      />
    </div>
  )
}
