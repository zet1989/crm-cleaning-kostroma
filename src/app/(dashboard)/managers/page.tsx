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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatPrice } from '@/lib/utils'
import { Plus, Pencil, Trash2, Shield, ShieldCheck, BarChart3, Eye, EyeOff, TrendingUp } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import { ManagerStatsDialog } from '@/components/stats/manager-stats-dialog'
import { AllStatsDialog } from '@/components/stats/all-stats-dialog'

interface Manager {
  id: string
  email: string
  full_name: string
  roles: string[]
  salary_percent: number
  can_view_analytics: boolean
  created_at: string
  // Calculated
  totalDeals?: number
  totalEarnings?: number
  conversion?: number
}

export default function ManagersPage() {
  const [managers, setManagers] = useState<Manager[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedManager, setSelectedManager] = useState<Manager | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    roles: ['manager'] as string[],
    salary_percent: 10,
    can_view_analytics: true
  })
  const [saving, setSaving] = useState(false)
  const [statsDialogOpen, setStatsDialogOpen] = useState(false)
  const [statsManager, setStatsManager] = useState<Manager | null>(null)
  const [allStatsDialogOpen, setAllStatsDialogOpen] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const checkAccess = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return false
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('roles')
      .eq('id', user.id)
      .single()

    const hasAdmin = profile?.roles?.includes('admin')
    setIsAdmin(hasAdmin || false)
    
    if (!hasAdmin) {
      router.push('/dashboard')
      return false
    }
    
    return true
  }, [supabase, router])

  const loadManagers = useCallback(async () => {
    setLoading(true)
    try {
      const { data: profilesData, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name')

      if (error) throw error

      // Получаем колонку "Оплачено"
      const { data: paidColumn } = await supabase
        .from('columns')
        .select('id')
        .eq('is_success', true)
        .single()

      // Для каждого менеджера получаем статистику
      const managersWithStats = await Promise.all(
        (profilesData || []).map(async (profile) => {
          // Сделки из deal_managers (новая система)
          const { data: dealManagersData } = await supabase
            .from('deal_managers')
            .select('deal_id, earnings_percent')
            .eq('manager_id', profile.id)

          const dmDealIds = dealManagersData?.map(dm => dm.deal_id) || []

          // Сделки напрямую через manager_id (старая система)
          const { data: directDeals } = await supabase
            .from('deals')
            .select('id, column_id, price')
            .eq('manager_id', profile.id)

          // Сделки из deal_managers
          let dmDeals: any[] = []
          if (dmDealIds.length > 0) {
            const { data } = await supabase
              .from('deals')
              .select('id, column_id, price')
              .in('id', dmDealIds)
            
            // Добавляем earnings_percent к каждой сделке
            dmDeals = (data || []).map(deal => {
              const dm = dealManagersData?.find(d => d.deal_id === deal.id)
              return {
                ...deal,
                earnings_percent: dm?.earnings_percent || profile.salary_percent || 10
              }
            })
          }

          // Объединяем уникальные сделки
          const allDealsMap = new Map()
          for (const deal of [...(directDeals || []).map(d => ({ ...d, earnings_percent: profile.salary_percent || 10 })), ...dmDeals]) {
            if (!allDealsMap.has(deal.id)) {
              allDealsMap.set(deal.id, deal)
            }
          }
          const allDeals = Array.from(allDealsMap.values())

          const totalDeals = allDeals.length
          const paidDeals = allDeals.filter(d => d.column_id === paidColumn?.id)
          // Рассчитываем заработок как процент от суммы сделки
          const totalEarnings = paidDeals.reduce((sum, d) => sum + ((d.price || 0) * (d.earnings_percent || 10) / 100), 0)
          const conversion = totalDeals > 0 ? Math.round((paidDeals.length / totalDeals) * 100) : 0

          return {
            ...profile,
            totalDeals,
            totalEarnings,
            conversion
          }
        })
      )

      setManagers(managersWithStats)
    } catch (error) {
      console.error('Error loading managers:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    checkAccess().then(hasAccess => {
      if (hasAccess) {
        loadManagers()
      }
    })
  }, [checkAccess, loadManagers])

  function openCreateDialog() {
    setSelectedManager(null)
    setFormData({
      email: '',
      password: '',
      full_name: '',
      roles: ['manager'],
      salary_percent: 10,
      can_view_analytics: true
    })
    setDialogOpen(true)
  }

  function openEditDialog(manager: Manager) {
    setSelectedManager(manager)
    setFormData({
      email: manager.email,
      password: '', // Не показываем пароль
      full_name: manager.full_name || '',
      roles: manager.roles || ['manager'],
      salary_percent: manager.salary_percent || 10,
      can_view_analytics: manager.can_view_analytics ?? true
    })
    setDialogOpen(true)
  }

  function openDeleteDialog(manager: Manager) {
    setSelectedManager(manager)
    setDeleteDialogOpen(true)
  }

  function openStatsDialog(manager: Manager) {
    setStatsManager(manager)
    setStatsDialogOpen(true)
  }

  async function handleSave() {
    if (!formData.full_name) return
    if (!selectedManager && (!formData.email || !formData.password)) return

    setSaving(true)
    try {
      if (selectedManager) {
        // Обновление профиля
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: formData.full_name,
            roles: formData.roles,
            salary_percent: formData.salary_percent,
            can_view_analytics: formData.can_view_analytics,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedManager.id)

        if (error) throw error
      } else {
        // Создание нового пользователя через Admin API
        const response = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            full_name: formData.full_name,
            roles: formData.roles,
            salary_percent: formData.salary_percent,
            can_view_analytics: formData.can_view_analytics
          })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.message || 'Failed to create user')
        }
      }

      setDialogOpen(false)
      loadManagers()
    } catch (error) {
      console.error('Error saving manager:', error)
      alert(error instanceof Error ? error.message : 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!selectedManager) return

    setSaving(true)
    try {
      // Удаляем через Admin API
      const response = await fetch(`/api/admin/users/${selectedManager.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete user')
      }

      setDeleteDialogOpen(false)
      loadManagers()
    } catch (error) {
      console.error('Error deleting manager:', error)
      alert('Ошибка удаления пользователя')
    } finally {
      setSaving(false)
    }
  }

  async function toggleAnalyticsAccess(manager: Manager) {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ can_view_analytics: !manager.can_view_analytics })
        .eq('id', manager.id)

      if (error) throw error
      loadManagers()
    } catch (error) {
      console.error('Error toggling access:', error)
    }
  }

  function getRoleBadges(roles: string[]) {
    return roles.map(role => (
      <Badge 
        key={role} 
        variant={role === 'admin' ? 'default' : 'secondary'}
        className="mr-1"
      >
        {role === 'admin' ? (
          <><ShieldCheck className="h-3 w-3 mr-1" /> Админ</>
        ) : (
          <><Shield className="h-3 w-3 mr-1" /> Менеджер</>
        )}
      </Badge>
    ))
  }

  // Статистика
  const stats = {
    total: managers.length,
    admins: managers.filter(m => m.roles?.includes('admin')).length,
    totalEarnings: managers.reduce((sum, m) => sum + (m.totalEarnings || 0), 0),
    avgConversion: managers.length > 0 
      ? Math.round(managers.reduce((sum, m) => sum + (m.conversion || 0), 0) / managers.length)
      : 0
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Менеджеры</h1>
          <p className="text-muted-foreground">Управление пользователями системы</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAllStatsDialogOpen(true)}>
            <BarChart3 className="h-4 w-4 mr-2" />
            Статистика всех
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Добавить менеджера
          </Button>
        </div>
      </div>

      {/* Статистика */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Всего пользователей</CardDescription>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Администраторов</CardDescription>
            <CardTitle className="text-2xl text-primary">{stats.admins}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Средняя конверсия</CardDescription>
            <CardTitle className="text-2xl">{stats.avgConversion}%</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>ФОТ менеджеров</CardDescription>
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
                <TableHead>Email</TableHead>
                <TableHead>Роли</TableHead>
                <TableHead className="text-right">% ЗП</TableHead>
                <TableHead className="text-right">Сделок</TableHead>
                <TableHead className="text-right">Конверсия</TableHead>
                <TableHead className="text-right">Заработок</TableHead>
                <TableHead>Аналитика</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {managers.map(manager => (
                <TableRow key={manager.id}>
                  <TableCell className="font-medium">{manager.full_name}</TableCell>
                  <TableCell className="text-muted-foreground">{manager.email}</TableCell>
                  <TableCell>{getRoleBadges(manager.roles || [])}</TableCell>
                  <TableCell className="text-right">{manager.salary_percent}%</TableCell>
                  <TableCell className="text-right">{manager.totalDeals || 0}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <BarChart3 className="h-3 w-3 text-muted-foreground" />
                      {manager.conversion || 0}%
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatPrice(manager.totalEarnings || 0)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleAnalyticsAccess(manager)}
                      className={manager.can_view_analytics ? 'text-green-600' : 'text-muted-foreground'}
                    >
                      {manager.can_view_analytics ? (
                        <><Eye className="h-4 w-4 mr-1" /> Да</>
                      ) : (
                        <><EyeOff className="h-4 w-4 mr-1" /> Нет</>
                      )}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openStatsDialog(manager)}
                        title="Статистика"
                      >
                        <TrendingUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(manager)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(manager)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {managers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Нет пользователей
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Диалог создания/редактирования */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedManager ? 'Редактировать пользователя' : 'Новый пользователь'}
            </DialogTitle>
            <DialogDescription>
              {selectedManager 
                ? 'Измените данные пользователя' 
                : 'Заполните данные нового пользователя'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">ФИО *</Label>
              <Input
                id="full_name"
                placeholder="Иванов Иван"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              />
            </div>
            
            {!selectedManager && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="manager@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Пароль *</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Минимум 6 символов"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Роли</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.roles.includes('manager')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ ...formData, roles: [...formData.roles, 'manager'] })
                      } else {
                        setFormData({ ...formData, roles: formData.roles.filter(r => r !== 'manager') })
                      }
                    }}
                    className="rounded"
                  />
                  <span>Менеджер</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.roles.includes('admin')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ ...formData, roles: [...formData.roles, 'admin'] })
                      } else {
                        setFormData({ ...formData, roles: formData.roles.filter(r => r !== 'admin') })
                      }
                    }}
                    className="rounded"
                  />
                  <span>Администратор</span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="salary_percent">% зарплаты от сделки</Label>
              <Input
                id="salary_percent"
                type="number"
                min="0"
                max="100"
                value={formData.salary_percent}
                onChange={(e) => setFormData({ ...formData, salary_percent: Number(e.target.value) })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="can_view_analytics">Доступ к аналитике</Label>
              <Switch
                id="can_view_analytics"
                checked={formData.can_view_analytics}
                onCheckedChange={(checked) => setFormData({ ...formData, can_view_analytics: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={saving || !formData.full_name || (!selectedManager && (!formData.email || !formData.password))}
            >
              {saving ? 'Сохранение...' : selectedManager ? 'Сохранить' : 'Создать'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог удаления */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить пользователя?</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите удалить пользователя «{selectedManager?.full_name}»? 
              Это действие нельзя отменить.
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
      <ManagerStatsDialog
        open={statsDialogOpen}
        onOpenChange={setStatsDialogOpen}
        manager={statsManager ? {
          id: statsManager.id,
          full_name: statsManager.full_name,
          salary_percent: statsManager.salary_percent || 10
        } : null}
      />

      {/* Диалог статистики всех менеджеров */}
      <AllStatsDialog
        open={allStatsDialogOpen}
        onOpenChange={setAllStatsDialogOpen}
        type="managers"
        title="Статистика всех менеджеров"
      />
    </div>
  )
}
