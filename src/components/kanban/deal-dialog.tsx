'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Column, Deal, Executor, Profile } from '@/lib/supabase/database.types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { 
  Loader2, 
  Trash2, 
  Phone, 
  Clock, 
  Play, 
  FileText, 
  History,
  Calendar,
  RefreshCw,
  MessageSquare,
  Send,
  Percent,
  Gift,
  Plus,
  User2,
  Sparkles
} from 'lucide-react'
import { cn, formatPrice } from '@/lib/utils'

type DealWithRelations = Deal & {
  executor: Executor | null
  manager: Profile | null
}

interface Call {
  id: string
  client_phone: string
  direction: 'incoming' | 'outgoing'
  duration: number
  recording_url: string | null
  transcript: string | null
  ai_summary: string | null
  is_spam: boolean
  created_at: string
}

interface CallComment {
  id: string
  call_id: string
  user_id: string
  comment: string
  created_at: string
  user?: { full_name: string }
}

interface ClientHistory {
  id: string
  client_name: string
  address: string
  price: number
  scheduled_at: string | null
  completed_at: string | null
  column: { name: string; color: string } | null
  created_at: string
}

interface ExecutorPercent {
  executor_id: string
  percent: number
}

interface ManagerPercent {
  manager_id: string
  percent: number
}

interface Bonus {
  id: string
  deal_id: string
  recipient_type: 'executor' | 'manager'
  executor_id: string | null
  manager_id: string | null
  amount: number
  reason: string | null
  created_at: string
  executor?: { name: string } | null
  manager?: { full_name: string } | null
}

interface DealDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  deal: DealWithRelations | null
  columnId: string | null
  columns: Column[]
  executors: Executor[]
  onDealSaved?: () => void
}

export function DealDialog({ open, onOpenChange, deal, columnId, columns, executors, onDealSaved }: DealDialogProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [activeTab, setActiveTab] = useState('main')
  
  // Form data
  const [formData, setFormData] = useState({
    client_name: '',
    client_phone: '',
    address: '',
    price: '',
    column_id: '',
    scheduled_at: '',
    notes: '',
    source: '',
  })
  
  // Source options
  const sourceOptions = [
    { value: 'none', label: 'Не указан' },
    { value: 'site', label: 'Сайт' },
    { value: 'phone', label: 'Звонок' },
    { value: 'email', label: 'Почта' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'telegram', label: 'Telegram' },
    { value: 'avito', label: 'Авито' },
    { value: 'recommendation', label: 'Рекомендация' },
    { value: 'repeat', label: 'Повторный клиент' },
    { value: 'other', label: 'Другое' },
  ]
  
  // Selected executors (множественный выбор)
  const [selectedExecutors, setSelectedExecutors] = useState<string[]>([])
  
  // Selected managers (множественный выбор)
  const [selectedManagers, setSelectedManagers] = useState<string[]>([])
  const [managers, setManagers] = useState<Profile[]>([])
  const [managerPercents, setManagerPercents] = useState<ManagerPercent[]>([])
  
  // History data
  const [clientHistory, setClientHistory] = useState<ClientHistory[]>([])
  const [clientCalls, setClientCalls] = useState<Call[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  
  // Call comments
  const [callComments, setCallComments] = useState<Record<string, CallComment[]>>({})
  const [newComment, setNewComment] = useState<Record<string, string>>({})
  const [playingCall, setPlayingCall] = useState<string | null>(null)
  
  // Executor percentages
  const [executorPercents, setExecutorPercents] = useState<ExecutorPercent[]>([])
  
  // Bonuses
  const [bonuses, setBonuses] = useState<Bonus[]>([])
  const [newBonus, setNewBonus] = useState({
    recipient_type: 'executor' as 'executor' | 'manager',
    executor_id: '',
    manager_id: '',
    amount: '',
    reason: '',
  })
  const [loadingBonuses, setLoadingBonuses] = useState(false)
  
  // Deal history (changes log)
  const [dealHistory, setDealHistory] = useState<{
    id: string
    action: string
    changes: any
    created_at: string
    user?: { full_name: string } | null
  }[]>([])
  const [loadingDealHistory, setLoadingDealHistory] = useState(false)
  
  // AI Processing
  const [processingAI, setProcessingAI] = useState(false)
  
  // Load managers list
  useEffect(() => {
    const loadManagers = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name')
      
      if (data) {
        setManagers(data)
      }
    }
    loadManagers()
  }, [supabase])

  // Reset form
  useEffect(() => {
    if (open) {
      if (deal) {
        setFormData({
          client_name: deal.client_name,
          client_phone: deal.client_phone,
          address: deal.address,
          price: deal.price?.toString() || '',
          column_id: deal.column_id,
          scheduled_at: deal.scheduled_at?.slice(0, 16) || '',
          notes: deal.notes || '',
          source: deal.source || '',
        })
        // Load selected executors and managers
        loadDealExecutors(deal.id)
        loadDealManagers(deal.id)
      } else {
        setFormData({
          client_name: '',
          client_phone: '',
          address: '',
          price: '',
          column_id: columnId || columns[0]?.id || '',
          scheduled_at: '',
          notes: '',
          source: '',
        })
        setSelectedExecutors([])
        setSelectedManagers([])
        setExecutorPercents([])
        setManagerPercents([])
        setBonuses([])
      }
      setActiveTab('main')
      setClientHistory([])
      setClientCalls([])
      setBonuses([])
      
      // Auto-load client history and calls when deal has phone
      if (deal?.client_phone) {
        // Async load without blocking
        (async () => {
          const phone = deal.client_phone.replace(/\D/g, '')
          if (phone.length >= 10) {
            // Load calls
            const { data: callsData } = await supabase
              .from('calls')
              .select('*')
              .eq('client_phone', phone)
              .order('created_at', { ascending: false })
            
            if (callsData) {
              setClientCalls(callsData)
            }
            
            // Load other deals from same client
            const { data: dealsData } = await supabase
              .from('deals')
              .select('*')
              .eq('client_phone', deal.client_phone)
              .order('created_at', { ascending: false })
            
            if (dealsData) {
              setClientHistory(dealsData)
            }
          }
        })()
      }
    }
  }, [open, deal, columnId, columns, managers, supabase])

  // Load deal executors with percentages
  const loadDealExecutors = async (dealId: string) => {
    const { data } = await supabase
      .from('deal_executors')
      .select('executor_id, earnings_percent')
      .eq('deal_id', dealId)
    
    if (data) {
      setSelectedExecutors(data.map(d => d.executor_id))
      setExecutorPercents(data.map(d => ({
        executor_id: d.executor_id,
        percent: d.earnings_percent || 100
      })))
    }
    
    // Load bonuses
    loadBonuses(dealId)
  }
  
  // Load deal managers with percentages
  const loadDealManagers = async (dealId: string) => {
    const { data } = await supabase
      .from('deal_managers')
      .select('manager_id, earnings_percent')
      .eq('deal_id', dealId)
    
    if (data && data.length > 0) {
      setSelectedManagers(data.map(d => d.manager_id))
      setManagerPercents(data.map(d => {
        // Если процент не сохранён, берём из глобальных настроек менеджера
        if (!d.earnings_percent) {
          const manager = managers.find(m => m.id === d.manager_id)
          return {
            manager_id: d.manager_id,
            percent: manager?.salary_percent || DEFAULT_MANAGER_PERCENT
          }
        }
        return {
          manager_id: d.manager_id,
          percent: d.earnings_percent
        }
      }))
    } else if (deal?.manager_id) {
      // Fallback: use deal.manager_id for backward compatibility
      // Берём процент из глобальных настроек менеджера
      const manager = managers.find(m => m.id === deal.manager_id)
      const managerPercent = manager?.salary_percent || DEFAULT_MANAGER_PERCENT
      setSelectedManagers([deal.manager_id])
      setManagerPercents([{ manager_id: deal.manager_id, percent: managerPercent }])
    }
  }
  
  // Load bonuses for deal
  const loadBonuses = async (dealId: string) => {
    setLoadingBonuses(true)
    
    // Сначала загружаем бонусы
    const { data: bonusesData, error } = await supabase
      .from('bonuses')
      .select('*')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false })
    
    console.log('loadBonuses result:', { bonusesData, error, dealId })
    
    if (bonusesData && bonusesData.length > 0) {
      // Получаем данные исполнителей и менеджеров отдельно
      const executorIds = bonusesData.filter(b => b.executor_id).map(b => b.executor_id)
      const managerIds = bonusesData.filter(b => b.manager_id).map(b => b.manager_id)
      
      let executorsMap: Record<string, string> = {}
      let managersMap: Record<string, string> = {}
      
      if (executorIds.length > 0) {
        const { data: execs } = await supabase
          .from('executors')
          .select('id, name')
          .in('id', executorIds)
        if (execs) {
          executorsMap = Object.fromEntries(execs.map(e => [e.id, e.name]))
        }
      }
      
      if (managerIds.length > 0) {
        const { data: mgrs } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', managerIds)
        if (mgrs) {
          managersMap = Object.fromEntries(mgrs.map(m => [m.id, m.full_name]))
        }
      }
      
      // Собираем данные
      const enrichedBonuses = bonusesData.map(b => ({
        ...b,
        recipient_type: b.executor_id ? 'executor' : 'manager',
        executor: b.executor_id ? { name: executorsMap[b.executor_id] || 'Неизвестный' } : null,
        manager: b.manager_id ? { full_name: managersMap[b.manager_id] || 'Неизвестный' } : null,
      }))
      
      setBonuses(enrichedBonuses as Bonus[])
    } else {
      setBonuses([])
    }
    setLoadingBonuses(false)
  }
  
  // Load deal history (changes log)
  const loadDealHistory = async (dealId: string) => {
    setLoadingDealHistory(true)
    const { data } = await supabase
      .from('deal_history')
      .select('*, user:profiles(full_name)')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false })
    
    if (data) {
      setDealHistory(data)
    }
    setLoadingDealHistory(false)
  }
  
  // Record deal history
  const recordHistory = async (dealId: string, action: string, changes: any) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    
    await supabase
      .from('deal_history')
      .insert({
        deal_id: dealId,
        user_id: user.id,
        action,
        changes
      })
  }
  
  // Add bonus
  const addBonus = async () => {
    if (!deal?.id || !newBonus.amount) return
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    
    // Проверяем, что указан получатель
    if (newBonus.recipient_type === 'executor' && !newBonus.executor_id) {
      toast.error('Выберите исполнителя')
      return
    }
    if (newBonus.recipient_type === 'manager' && !newBonus.manager_id) {
      toast.error('Выберите менеджера')
      return
    }
    
    const bonusData: any = {
      deal_id: deal.id,
      amount: parseFloat(newBonus.amount),
      reason: newBonus.reason || 'Премия',
      created_by: user.id,
    }
    
    if (newBonus.recipient_type === 'executor' && newBonus.executor_id) {
      bonusData.executor_id = newBonus.executor_id
    } else if (newBonus.recipient_type === 'manager' && newBonus.manager_id) {
      bonusData.manager_id = newBonus.manager_id
    }
    
    const { error } = await supabase
      .from('bonuses')
      .insert(bonusData)
    
    if (!error) {
      toast.success('Премия добавлена')
      loadBonuses(deal.id)
      setNewBonus({ recipient_type: 'executor', executor_id: '', manager_id: '', amount: '', reason: '' })
    } else {
      console.error('Bonus insert error:', error)
      toast.error('Ошибка при добавлении премии: ' + error.message)
    }
  }
  
  // Delete bonus
  const deleteBonus = async (bonusId: string) => {
    if (!confirm('Удалить премию?')) return
    
    const { error } = await supabase
      .from('bonuses')
      .delete()
      .eq('id', bonusId)
    
    if (!error) {
      toast.success('Премия удалена')
      setBonuses(prev => prev.filter(b => b.id !== bonusId))
    }
  }
  
  // Default percentages from settings
  const DEFAULT_EXECUTOR_TOTAL_PERCENT = 40 // 40% на всех исполнителей
  const DEFAULT_MANAGER_PERCENT = 10 // 10% для каждого менеджера
  
  // Update executor percent
  const updateExecutorPercent = (executorId: string, percent: number) => {
    setExecutorPercents(prev => {
      const existing = prev.find(p => p.executor_id === executorId)
      if (existing) {
        return prev.map(p => p.executor_id === executorId ? { ...p, percent } : p)
      }
      return [...prev, { executor_id: executorId, percent }]
    })
  }
  
  // Update manager percent
  const updateManagerPercent = (managerId: string, percent: number) => {
    setManagerPercents(prev => {
      const existing = prev.find(p => p.manager_id === managerId)
      if (existing) {
        return prev.map(p => p.manager_id === managerId ? { ...p, percent } : p)
      }
      return [...prev, { manager_id: managerId, percent }]
    })
  }
  
  // Toggle manager selection
  const toggleManager = (managerId: string) => {
    setSelectedManagers(prev => {
      if (prev.includes(managerId)) {
        setManagerPercents(mp => mp.filter(p => p.manager_id !== managerId))
        return prev.filter(id => id !== managerId)
      }
      // Берём процент из глобальных настроек менеджера
      const manager = managers.find(m => m.id === managerId)
      const managerPercent = manager?.salary_percent || DEFAULT_MANAGER_PERCENT
      setManagerPercents(mp => [...mp, { manager_id: managerId, percent: managerPercent }])
      return [...prev, managerId]
    })
  }

  // Toggle executor selection and recalculate percentages
  const toggleExecutor = (executorId: string) => {
    setSelectedExecutors(prev => {
      const newSelection = prev.includes(executorId)
        ? prev.filter(id => id !== executorId)
        : [...prev, executorId]
      
      // Recalculate percentages for all executors
      if (newSelection.length > 0) {
        const percentPerExecutor = DEFAULT_EXECUTOR_TOTAL_PERCENT / newSelection.length
        setExecutorPercents(newSelection.map(id => ({
          executor_id: id,
          percent: Math.round(percentPerExecutor * 100) / 100
        })))
      } else {
        setExecutorPercents([])
      }
      
      return newSelection
    })
  }

  // Load client history when phone changes or tab switches
  const loadClientHistory = useCallback(async (phone: string) => {
    if (!phone || phone.length < 5) return
    
    setLoadingHistory(true)
    try {
      // Previous orders
      const { data: orders } = await supabase
        .from('deals')
        .select('id, client_name, address, price, scheduled_at, completed_at, created_at, column:columns(name, color)')
        .eq('client_phone', phone)
        .neq('id', deal?.id || '')
        .order('created_at', { ascending: false })
        .limit(10)
      
      if (orders) {
        // Transform array to single object for column
        const transformedOrders = orders.map(order => ({
          ...order,
          column: Array.isArray(order.column) ? order.column[0] : order.column
        }))
        setClientHistory(transformedOrders as ClientHistory[])
      }
      
      // Calls history
      const { data: calls } = await supabase
        .from('calls')
        .select('*')
        .eq('client_phone', phone)
        .order('created_at', { ascending: false })
        .limit(20)
      
      if (calls) {
        setClientCalls(calls)
        // Load comments for each call
        for (const call of calls) {
          loadCallComments(call.id)
        }
      }
    } catch (error) {
      console.error('Error loading history:', error)
    } finally {
      setLoadingHistory(false)
    }
  }, [deal?.id, supabase])

  // Load call comments
  const loadCallComments = async (callId: string) => {
    const { data } = await supabase
      .from('call_comments')
      .select('*, user:profiles(full_name)')
      .eq('call_id', callId)
      .order('created_at', { ascending: true })
    
    if (data) {
      setCallComments(prev => ({ ...prev, [callId]: data }))
    }
  }

  // Add comment to call
  const addComment = async (callId: string) => {
    const comment = newComment[callId]?.trim()
    if (!comment) return
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    
    const { error } = await supabase
      .from('call_comments')
      .insert({
        call_id: callId,
        user_id: user.id,
        comment,
      })
    
    if (!error) {
      setNewComment(prev => ({ ...prev, [callId]: '' }))
      loadCallComments(callId)
      toast.success('Комментарий добавлен')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const dealData = {
        client_name: formData.client_name,
        client_phone: formData.client_phone,
        address: formData.address,
        price: parseFloat(formData.price) || 0,
        executor_id: selectedExecutors[0] || null, // Primary executor
        manager_id: selectedManagers[0] || null, // Primary manager
        column_id: formData.column_id,
        scheduled_at: formData.scheduled_at || null,
        notes: formData.notes || null,
        source: formData.source || null,
      }

      let dealId = deal?.id

      if (deal) {
        // Собираем изменения для истории
        const changes: Record<string, { old: any, new: any }> = {}
        if (deal.client_name !== dealData.client_name) {
          changes.client_name = { old: deal.client_name, new: dealData.client_name }
        }
        if (deal.client_phone !== dealData.client_phone) {
          changes.client_phone = { old: deal.client_phone, new: dealData.client_phone }
        }
        if (deal.address !== dealData.address) {
          changes.address = { old: deal.address, new: dealData.address }
        }
        if (deal.price !== dealData.price) {
          changes.price = { old: deal.price, new: dealData.price }
        }
        if (deal.column_id !== dealData.column_id) {
          const oldColumn = columns.find(c => c.id === deal.column_id)
          const newColumn = columns.find(c => c.id === dealData.column_id)
          changes.column = { old: oldColumn?.name, new: newColumn?.name }
        }
        if (deal.scheduled_at !== dealData.scheduled_at) {
          changes.scheduled_at = { old: deal.scheduled_at, new: dealData.scheduled_at }
        }
        if ((deal.source || '') !== (dealData.source || '')) {
          const oldSourceLabel = sourceOptions.find(o => o.value === deal.source)?.label || deal.source || 'Не указан'
          const newSourceLabel = sourceOptions.find(o => o.value === dealData.source)?.label || dealData.source || 'Не указан'
          changes.source = { old: oldSourceLabel, new: newSourceLabel }
        }
        
        // Update
        const { error } = await supabase
          .from('deals')
          .update(dealData)
          .eq('id', deal.id)

        if (error) throw error
        
        // Записываем историю изменений
        if (Object.keys(changes).length > 0) {
          await recordHistory(deal.id, 'update', changes)
        }
      } else {
        // Create
        const { data, error } = await supabase
          .from('deals')
          .insert(dealData)
          .select('id')
          .single()

        if (error) throw error
        dealId = data.id
        
        // Записываем историю создания
        if (dealId) {
          await recordHistory(dealId, 'create', {
            client_name: dealData.client_name,
            client_phone: dealData.client_phone,
            price: dealData.price,
          })
        }
      }

      // Update deal_executors
      if (dealId) {
        // Delete old executors
        await supabase
          .from('deal_executors')
          .delete()
          .eq('deal_id', dealId)
        
        // Insert new executors with custom percentages
        if (selectedExecutors.length > 0) {
          const executorInserts = selectedExecutors.map(executorId => {
            const customPercent = executorPercents.find(p => p.executor_id === executorId)?.percent
            return {
              deal_id: dealId,
              executor_id: executorId,
              earnings_percent: customPercent ?? 100,
            }
          })
          
          await supabase
            .from('deal_executors')
            .insert(executorInserts)
        }
        
        // Update deal_managers
        // Delete old managers
        await supabase
          .from('deal_managers')
          .delete()
          .eq('deal_id', dealId)
        
        // Insert new managers with custom percentages
        if (selectedManagers.length > 0) {
          const managerInserts = selectedManagers.map(managerId => {
            const customPercent = managerPercents.find(p => p.manager_id === managerId)?.percent
            return {
              deal_id: dealId,
              manager_id: managerId,
              earnings_percent: customPercent ?? 100,
            }
          })
          
          await supabase
            .from('deal_managers')
            .insert(managerInserts)
        }
      }

      toast.success(deal ? 'Сделка обновлена' : 'Сделка создана')
      onOpenChange(false)
      // Вызываем callback для обновления списка сделок
      if (onDealSaved) {
        onDealSaved()
      }
    } catch (error) {
      toast.error('Ошибка при сохранении')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleAIProcess = async () => {
    if (!deal) return
    
    setProcessingAI(true)
    try {
      const response = await fetch('/api/ai/process-deal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deal_id: deal.id })
      })
      
      if (!response.ok) {
        throw new Error('AI processing failed')
      }
      
      const result = await response.json()
      
      // Обновляем форму с данными от AI
      if (result.ai_result) {
        setFormData(prev => ({
          ...prev,
          client_name: result.ai_result.client_name || prev.client_name,
          client_phone: result.ai_result.client_phone || prev.client_phone,
          address: result.ai_result.address || prev.address,
          price: result.ai_result.price?.toString() || prev.price,
          scheduled_at: result.ai_result.scheduled_at || prev.scheduled_at,
        }))
        
        toast.success('✨ AI обработка завершена!', {
          description: 'Поля заполнены автоматически'
        })
      }
    } catch (error) {
      console.error('AI processing error:', error)
      toast.error('Ошибка AI обработки', {
        description: 'Попробуйте позже или заполните вручную'
      })
    } finally {
      setProcessingAI(false)
    }
  }

  const handleDelete = async () => {
    if (!deal || !confirm('Удалить эту сделку?')) return
    
    setDeleting(true)
    try {
      // Записываем историю удаления перед удалением
      await recordHistory(deal.id, 'delete', {
        client_name: deal.client_name,
        price: deal.price,
      })
      
      const { error } = await supabase
        .from('deals')
        .delete()
        .eq('id', deal.id)

      if (error) throw error
      
      toast.success('Сделка удалена')
      onOpenChange(false)
    } catch (error) {
      toast.error('Ошибка при удалении')
    } finally {
      setDeleting(false)
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              {deal ? 'Редактирование сделки' : 'Новая сделка'}
              {deal?.is_repeated_client && (
                <Badge variant="secondary" className="ml-2">
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Повторный клиент
                </Badge>
              )}
            </div>
            {deal && deal.notes && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAIProcess}
                disabled={processingAI}
                className="ml-auto"
              >
                {processingAI ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Обработка...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    AI Заполнить
                  </>
                )}
              </Button>
            )}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {deal ? 'Форма редактирования информации о сделке' : 'Форма создания новой сделки'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
            <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="main">Основное</TabsTrigger>
            <TabsTrigger 
              value="history" 
              onClick={() => loadClientHistory(formData.client_phone)}
            >
              Клиент
            </TabsTrigger>
            <TabsTrigger 
              value="calls"
              onClick={() => loadClientHistory(formData.client_phone)}
            >
              Звонки
            </TabsTrigger>
            <TabsTrigger value="salary">
              Зарплата
            </TabsTrigger>
            <TabsTrigger 
              value="deal-history"
              onClick={() => deal && loadDealHistory(deal.id)}
              disabled={!deal}
            >
              Изменения
            </TabsTrigger>
          </TabsList>

          {/* Main Tab */}
          <TabsContent value="main" className="space-y-4 mt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="client_name">Имя клиента *</Label>
                  <Input
                    id="client_name"
                    value={formData.client_name}
                    onChange={e => setFormData(prev => ({ ...prev, client_name: e.target.value }))}
                    placeholder="Иван Иванов"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="client_phone">Телефон *</Label>
                  <Input
                    id="client_phone"
                    value={formData.client_phone}
                    onChange={e => setFormData(prev => ({ ...prev, client_phone: e.target.value }))}
                    placeholder="+7 (999) 123-45-67"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Адрес *</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="г. Москва, ул. Примерная, д. 1"
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="price">Стоимость</Label>
                  <Input
                    id="price"
                    type="number"
                    value={formData.price}
                    onChange={e => setFormData(prev => ({ ...prev, price: e.target.value }))}
                    placeholder="5000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="column_id">Статус</Label>
                  <Select
                    value={formData.column_id}
                    onValueChange={value => setFormData(prev => ({ ...prev, column_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите статус" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map(column => (
                        <SelectItem key={column.id} value={column.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-2 h-2 rounded-full" 
                              style={{ backgroundColor: column.color }}
                            />
                            {column.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Multiple executors selection */}
              <div className="space-y-2">
                <Label>Исполнители</Label>
                <div className="border rounded-md p-3 space-y-2 max-h-32 overflow-y-auto">
                  {executors.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Нет доступных исполнителей</p>
                  ) : (
                    executors.map(executor => (
                      <div key={executor.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`executor-${executor.id}`}
                          checked={selectedExecutors.includes(executor.id)}
                          onCheckedChange={() => toggleExecutor(executor.id)}
                        />
                        <label
                          htmlFor={`executor-${executor.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {executor.name}
                        </label>
                      </div>
                    ))
                  )}
                </div>
                {selectedExecutors.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Выбрано: {selectedExecutors.length} исполнител{selectedExecutors.length === 1 ? 'ь' : 'я'}
                  </p>
                )}
              </div>

              {/* Multiple managers selection */}
              <div className="space-y-2">
                <Label>Менеджеры</Label>
                <div className="border rounded-md p-3 space-y-2 max-h-32 overflow-y-auto">
                  {managers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Нет доступных менеджеров</p>
                  ) : (
                    managers.map(manager => (
                      <div key={manager.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`manager-${manager.id}`}
                          checked={selectedManagers.includes(manager.id)}
                          onCheckedChange={() => toggleManager(manager.id)}
                        />
                        <label
                          htmlFor={`manager-${manager.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {manager.full_name || manager.email}
                        </label>
                      </div>
                    ))
                  )}
                </div>
                {selectedManagers.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Выбрано: {selectedManagers.length} менеджер{selectedManagers.length === 1 ? '' : 'а'}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="scheduled_at">Дата выполнения</Label>
                <Input
                  id="scheduled_at"
                  type="datetime-local"
                  value={formData.scheduled_at}
                  onChange={e => setFormData(prev => ({ ...prev, scheduled_at: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="source">Источник заявки</Label>
                <Select
                  value={formData.source || 'none'}
                  onValueChange={value => setFormData(prev => ({ ...prev, source: value === 'none' ? '' : value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите источник" />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Примечания</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Дополнительная информация..."
                  rows={3}
                />
              </div>

              <div className="flex justify-between pt-4">
                {deal && (
                  <Button 
                    type="button" 
                    variant="destructive" 
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Удалить
                  </Button>
                )}
                
                <div className="flex gap-2 ml-auto">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Отмена
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {deal ? 'Сохранить' : 'Создать'}
                  </Button>
                </div>
              </div>
            </form>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="mt-4">
            <ScrollArea className="h-[400px] pr-4">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : clientHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>История заказов пуста</p>
                  <p className="text-sm">Это первый заказ клиента</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground mb-4">
                    Всего заказов: {clientHistory.length}
                  </p>
                  {clientHistory.map(order => (
                    <div 
                      key={order.id}
                      className="border rounded-lg p-3 space-y-2 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{order.price?.toLocaleString('ru-RU')} ₽</span>
                        {order.column && (
                          <Badge 
                            variant="outline"
                            style={{ borderColor: order.column.color, color: order.column.color }}
                          >
                            {order.column.name}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm">{order.address}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(order.created_at)}
                        </span>
                        {order.scheduled_at && (
                          <span>Запланировано: {formatDate(order.scheduled_at)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Calls Tab */}
          <TabsContent value="calls" className="mt-4">
            <ScrollArea className="h-[400px] pr-4">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : clientCalls.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Phone className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>История звонков пуста</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {clientCalls.map(call => (
                    <div key={call.id} className="border rounded-lg p-3 space-y-3">
                      {/* Call header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Phone className={cn(
                            "h-4 w-4",
                            call.direction === 'incoming' ? 'text-green-500' : 'text-blue-500'
                          )} />
                          <span className="text-sm font-medium">
                            {call.direction === 'incoming' ? 'Входящий' : 'Исходящий'}
                          </span>
                          {call.is_spam && (
                            <Badge variant="destructive" className="text-xs">Спам</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDuration(call.duration)}
                        </div>
                      </div>
                      
                      <div className="text-xs text-muted-foreground">
                        {formatDate(call.created_at)}
                      </div>

                      {/* Recording */}
                      {call.recording_url && (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPlayingCall(playingCall === call.id ? null : call.id)}
                          >
                            <Play className="h-3 w-3 mr-1" />
                            {playingCall === call.id ? 'Остановить' : 'Прослушать'}
                          </Button>
                          {playingCall === call.id && (
                            <audio 
                              src={call.recording_url} 
                              autoPlay 
                              controls 
                              className="h-8 flex-1"
                              onEnded={() => setPlayingCall(null)}
                            />
                          )}
                        </div>
                      )}

                      {/* Transcript */}
                      {call.transcript && (
                        <div className="bg-muted/50 rounded p-2">
                          <div className="flex items-center gap-1 text-xs font-medium mb-1">
                            <FileText className="h-3 w-3" />
                            Расшифровка
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{call.transcript}</p>
                        </div>
                      )}

                      {/* AI Summary */}
                      {call.ai_summary && (
                        <div className="bg-blue-50 dark:bg-blue-950/20 rounded p-2">
                          <div className="flex items-center gap-1 text-xs font-medium mb-1 text-blue-600">
                            AI Анализ
                          </div>
                          <p className="text-sm">{call.ai_summary}</p>
                        </div>
                      )}

                      {/* Comments */}
                      <Separator />
                      <div className="space-y-2">
                        <div className="flex items-center gap-1 text-xs font-medium">
                          <MessageSquare className="h-3 w-3" />
                          Комментарии ({callComments[call.id]?.length || 0})
                        </div>
                        
                        {callComments[call.id]?.map(comment => (
                          <div key={comment.id} className="bg-muted/30 rounded p-2 text-sm">
                            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                              <span>{comment.user?.full_name || 'Пользователь'}</span>
                              <span>{formatDate(comment.created_at)}</span>
                            </div>
                            <p>{comment.comment}</p>
                          </div>
                        ))}

                        <div className="flex gap-2">
                          <Input
                            placeholder="Добавить комментарий..."
                            value={newComment[call.id] || ''}
                            onChange={e => setNewComment(prev => ({ ...prev, [call.id]: e.target.value }))}
                            onKeyDown={e => e.key === 'Enter' && addComment(call.id)}
                            className="text-sm"
                          />
                          <Button 
                            size="sm" 
                            onClick={() => addComment(call.id)}
                            disabled={!newComment[call.id]?.trim()}
                          >
                            <Send className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
          
          {/* Salary & Bonuses Tab */}
          <TabsContent value="salary" className="mt-4">
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-6">
                {/* Executor Percentages */}
                <div className="space-y-3">
                  <h3 className="font-medium flex items-center gap-2">
                    <Percent className="h-4 w-4" />
                    Процент зарплаты исполнителей
                  </h3>
                  
                  {selectedExecutors.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-4 text-center">
                      Сначала выберите исполнителей во вкладке "Основное"
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedExecutors.map(executorId => {
                        const executor = executors.find(e => e.id === executorId)
                        const currentPercent = executorPercents.find(p => p.executor_id === executorId)?.percent ?? 100
                        const dealPrice = parseFloat(formData.price) || 0
                        const earnings = (dealPrice * currentPercent) / 100
                        return (
                          <div key={executorId} className="flex items-center gap-3 p-3 border rounded-lg">
                            <User2 className="h-4 w-4 text-muted-foreground" />
                            <span className="flex-1 font-medium">{executor?.name || 'Неизвестный'}</span>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                value={currentPercent}
                                onChange={e => updateExecutorPercent(executorId, parseInt(e.target.value) || 0)}
                                className="w-20 text-center"
                              />
                              <span className="text-muted-foreground">%</span>
                              <span className="text-green-600 font-medium min-w-[80px] text-right">
                                {formatPrice(earnings)}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Manager Percentages */}
                <div className="space-y-3">
                  <h3 className="font-medium flex items-center gap-2">
                    <Percent className="h-4 w-4" />
                    Процент зарплаты менеджеров
                  </h3>
                  
                  {selectedManagers.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-4 text-center">
                      Сначала выберите менеджеров во вкладке "Основное"
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedManagers.map(managerId => {
                        const manager = managers.find(m => m.id === managerId)
                        const currentPercent = managerPercents.find(p => p.manager_id === managerId)?.percent ?? 100
                        const dealPrice = parseFloat(formData.price) || 0
                        const earnings = (dealPrice * currentPercent) / 100
                        return (
                          <div key={managerId} className="flex items-center gap-3 p-3 border rounded-lg">
                            <User2 className="h-4 w-4 text-muted-foreground" />
                            <span className="flex-1 font-medium">{manager?.full_name || manager?.email || 'Неизвестный'}</span>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                value={currentPercent}
                                onChange={e => updateManagerPercent(managerId, parseInt(e.target.value) || 0)}
                                className="w-20 text-center"
                              />
                              <span className="text-muted-foreground">%</span>
                              <span className="text-green-600 font-medium min-w-[80px] text-right">
                                {formatPrice(earnings)}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Bonuses */}
                <div className="space-y-3">
                  <h3 className="font-medium flex items-center gap-2">
                    <Gift className="h-4 w-4" />
                    Премии по сделке
                  </h3>
                  
                  {!deal?.id ? (
                    <div className="text-sm text-muted-foreground py-4 text-center">
                      Сохраните сделку, чтобы добавить премии
                    </div>
                  ) : (
                    <>
                      {/* Add bonus form */}
                      <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                        <div className="text-sm font-medium">Добавить премию</div>
                        
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Тип получателя</Label>
                            <Select
                              value={newBonus.recipient_type}
                              onValueChange={(value: 'executor' | 'manager') => 
                                setNewBonus(prev => ({ ...prev, recipient_type: value, executor_id: '' }))
                              }
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="executor">Исполнитель</SelectItem>
                                <SelectItem value="manager">Менеджер</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          {newBonus.recipient_type === 'executor' && (
                            <div className="space-y-1">
                              <Label className="text-xs">Исполнитель</Label>
                              <Select
                                value={newBonus.executor_id}
                                onValueChange={value => setNewBonus(prev => ({ ...prev, executor_id: value }))}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Выберите..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {selectedExecutors.map(exId => {
                                    const ex = executors.find(e => e.id === exId)
                                    return (
                                      <SelectItem key={exId} value={exId}>
                                        {ex?.name || 'Неизвестный'}
                                      </SelectItem>
                                    )
                                  })}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          
                          {newBonus.recipient_type === 'manager' && (
                            <div className="space-y-1">
                              <Label className="text-xs">Менеджер</Label>
                              <Select
                                value={newBonus.manager_id}
                                onValueChange={value => setNewBonus(prev => ({ ...prev, manager_id: value }))}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Выберите..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {selectedManagers.map(mgrId => {
                                    const mgr = managers.find(m => m.id === mgrId)
                                    return (
                                      <SelectItem key={mgrId} value={mgrId}>
                                        {mgr?.full_name || mgr?.email || 'Неизвестный'}
                                      </SelectItem>
                                    )
                                  })}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                        
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Сумма ₽</Label>
                            <Input
                              type="number"
                              value={newBonus.amount}
                              onChange={e => setNewBonus(prev => ({ ...prev, amount: e.target.value }))}
                              placeholder="1000"
                              className="h-9"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Причина</Label>
                            <Input
                              value={newBonus.reason}
                              onChange={e => setNewBonus(prev => ({ ...prev, reason: e.target.value }))}
                              placeholder="За качество работы"
                              className="h-9"
                            />
                          </div>
                        </div>
                        
                        <Button 
                          size="sm" 
                          onClick={addBonus}
                          disabled={!newBonus.amount || (newBonus.recipient_type === 'executor' && !newBonus.executor_id) || (newBonus.recipient_type === 'manager' && !newBonus.manager_id)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Добавить премию
                        </Button>
                      </div>

                      {/* Bonuses list */}
                      {loadingBonuses ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : bonuses.length === 0 ? (
                        <div className="text-sm text-muted-foreground py-4 text-center">
                          Премий пока нет
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {bonuses.map(bonus => (
                            <div key={bonus.id} className="flex items-center gap-3 p-3 border rounded-lg">
                              <Gift className="h-4 w-4 text-green-500" />
                              <div className="flex-1">
                                <div className="font-medium">
                                  {bonus.amount.toLocaleString()} ₽
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {bonus.recipient_type === 'executor' 
                                    ? `Исполнитель: ${bonus.executor?.name || 'Неизвестный'}`
                                    : `Менеджер: ${bonus.manager?.full_name || 'Неизвестный'}`
                                  }
                                  {bonus.reason && ` • ${bonus.reason}`}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {formatDate(bonus.created_at)}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteBonus(bonus.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Deal History Tab */}
          <TabsContent value="deal-history" className="mt-4">
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground text-center pb-2">
                  История изменений сделки
                </div>
                
                {dealHistory.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    История изменений пуста
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dealHistory.map((entry) => {
                      const changes = entry.changes || {}
                      const fieldLabels: Record<string, string> = {
                        client_name: 'Имя клиента',
                        client_phone: 'Телефон',
                        address: 'Адрес',
                        price: 'Сумма',
                        column: 'Статус',
                        scheduled_at: 'Дата',
                      }
                      
                      return (
                        <div key={entry.id} className="border rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className={`text-sm font-medium ${
                              entry.action === 'create' ? 'text-green-600' :
                              entry.action === 'delete' ? 'text-red-600' :
                              'text-blue-600'
                            }`}>
                              {entry.action === 'create' && '✨ Создание'}
                              {entry.action === 'update' && '✏️ Изменение'}
                              {entry.action === 'delete' && '🗑️ Удаление'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(entry.created_at).toLocaleString('ru-RU')}
                            </span>
                          </div>
                          
                          {entry.user?.full_name && (
                            <div className="text-xs text-muted-foreground">
                              Пользователь: {entry.user.full_name}
                            </div>
                          )}
                          
                          {entry.action === 'update' && Object.keys(changes).length > 0 && (
                            <div className="space-y-1">
                              {Object.entries(changes).map(([field, values]: [string, any]) => (
                                <div key={field} className="text-sm border-l-2 border-blue-200 pl-2">
                                  <span className="font-medium">{fieldLabels[field] || field}:</span>
                                  <div className="flex gap-2 text-xs">
                                    <span className="line-through text-red-500">{String(values.old || '—')}</span>
                                    <span>→</span>
                                    <span className="text-green-600">{String(values.new || '—')}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {entry.action === 'create' && Object.keys(changes).length > 0 && (
                            <div className="text-sm text-muted-foreground">
                              {changes.client_name && <div>Клиент: {changes.client_name}</div>}
                              {changes.price && <div>Сумма: {changes.price} ₽</div>}
                            </div>
                          )}
                          
                          {entry.action === 'delete' && Object.keys(changes).length > 0 && (
                            <div className="text-sm text-muted-foreground">
                              {changes.client_name && <div>Клиент: {changes.client_name}</div>}
                              {changes.price && <div>Сумма: {changes.price} ₽</div>}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
