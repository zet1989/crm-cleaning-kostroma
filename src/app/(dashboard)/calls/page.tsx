'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Search, RefreshCw, Play, Pause, FileText, ChevronDown, ChevronUp } from 'lucide-react'

interface Call {
  id: string
  client_phone: string
  direction: 'incoming' | 'outgoing'
  duration: number
  recording_url?: string
  transcript?: string
  ai_summary?: string
  is_spam: boolean
  deal_id?: string
  created_at: string
  deal?: {
    client_name: string
  } | null
}

export default function CallsPage() {
  const [calls, setCalls] = useState<Call[]>([])
  const [loading, setLoading] = useState(true)
  const [searchPhone, setSearchPhone] = useState('')
  const [playingCallId, setPlayingCallId] = useState<string | null>(null)
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null)
  const [selectedCall, setSelectedCall] = useState<Call | null>(null)
  
  const supabase = createClient()

  useEffect(() => {
    loadCalls()
  }, [])

  const loadCalls = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('calls')
        .select(`
          id,
          client_phone,
          direction,
          duration,
          recording_url,
          transcript,
          ai_summary,
          is_spam,
          deal_id,
          created_at,
          deal:deals(client_name)
        `)
        .order('created_at', { ascending: false })
        .limit(100)
      
      if (error) {
        console.error('Error loading calls:', error)
      }
      
      if (data) {
        // Map data to handle deal array from supabase
        const mappedCalls = data.map((call: any) => ({
          ...call,
          deal: Array.isArray(call.deal) ? call.deal[0] : call.deal
        }))
        setCalls(mappedCalls as Call[])
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredCalls = calls.filter(call => 
    !searchPhone || call.client_phone.includes(searchPhone)
  )

  const formatDuration = (seconds: number) => {
    if (!seconds) return '—'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getDirectionIcon = (direction: string, duration: number) => {
    // If no duration - likely missed
    if (direction === 'incoming' && duration === 0) {
      return <PhoneMissed className="h-4 w-4 text-red-500" />
    }
    if (direction === 'incoming') {
      return <PhoneIncoming className="h-4 w-4 text-blue-500" />
    }
    return <PhoneOutgoing className="h-4 w-4 text-green-500" />
  }

  const toggleExpand = (callId: string) => {
    setExpandedCallId(expandedCallId === callId ? null : callId)
  }

  const totalCalls = calls.length
  const incomingCalls = calls.filter(c => c.direction === 'incoming').length
  const outgoingCalls = calls.filter(c => c.direction === 'outgoing').length
  const totalDuration = calls.reduce((sum, c) => sum + (c.duration || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Звонки</h1>
          <p className="text-muted-foreground">История звонков из телефонии</p>
        </div>
        <Button onClick={loadCalls} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Обновить
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Всего звонков</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Phone className="h-5 w-5" />
              {totalCalls}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Входящие</CardDescription>
            <CardTitle className="text-2xl text-blue-600">{incomingCalls}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Исходящие</CardDescription>
            <CardTitle className="text-2xl text-green-600">{outgoingCalls}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Общее время</CardDescription>
            <CardTitle className="text-2xl">{formatDuration(totalDuration)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Поиск
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="phone">Номер телефона</Label>
              <Input
                id="phone"
                placeholder="Введите номер..."
                value={searchPhone}
                onChange={e => setSearchPhone(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calls Table */}
      <Card>
        <CardHeader>
          <CardTitle>История звонков</CardTitle>
          <CardDescription>Показано {filteredCalls.length} из {calls.length} звонков</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
          ) : filteredCalls.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {calls.length === 0 ? 'Нет звонков' : 'Звонки не найдены'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Направление</TableHead>
                  <TableHead>Номер телефона</TableHead>
                  <TableHead>Клиент</TableHead>
                  <TableHead>Длительность</TableHead>
                  <TableHead>Запись</TableHead>
                  <TableHead>Дата</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCalls.map(call => (
                  <>
                    <TableRow 
                      key={call.id} 
                      className={`${call.is_spam ? 'opacity-50' : ''} ${(call.transcript || call.ai_summary) ? 'cursor-pointer hover:bg-muted/50' : ''}`}
                      onClick={() => (call.transcript || call.ai_summary) && toggleExpand(call.id)}
                    >
                      <TableCell>
                        {(call.transcript || call.ai_summary) && (
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            {expandedCallId === call.id ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getDirectionIcon(call.direction, call.duration)}
                          <span className="text-sm">
                            {call.direction === 'incoming' ? 'Входящий' : 'Исходящий'}
                          </span>
                          {call.is_spam && (
                            <Badge variant="destructive" className="text-xs">Спам</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">{call.client_phone}</TableCell>
                      <TableCell>
                        {call.deal?.client_name || '—'}
                      </TableCell>
                      <TableCell>{formatDuration(call.duration)}</TableCell>
                      <TableCell>
                        {call.recording_url ? (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                setPlayingCallId(playingCallId === call.id ? null : call.id)
                              }}
                            >
                              {playingCallId === call.id ? (
                                <>
                                  <Pause className="h-3 w-3 mr-1" />
                                  Стоп
                                </>
                              ) : (
                                <>
                                  <Play className="h-3 w-3 mr-1" />
                                  Слушать
                                </>
                              )}
                            </Button>
                            {call.transcript && (
                              <Badge variant="secondary" className="text-xs">
                                <FileText className="h-3 w-3 mr-1" />
                                Расшифровка
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(call.created_at).toLocaleString('ru-RU')}
                      </TableCell>
                    </TableRow>
                    
                    {/* Expanded row with audio player and transcription */}
                    {(expandedCallId === call.id || playingCallId === call.id) && (
                      <TableRow key={`${call.id}-expanded`}>
                        <TableCell colSpan={7} className="bg-muted/30 p-4">
                          <div className="space-y-4">
                            {/* Audio Player */}
                            {call.recording_url && playingCallId === call.id && (
                              <div className="flex items-center gap-4">
                                <span className="text-sm font-medium">Запись звонка:</span>
                                <audio 
                                  src={call.recording_url} 
                                  controls 
                                  autoPlay
                                  className="flex-1 h-10"
                                  onEnded={() => setPlayingCallId(null)}
                                />
                              </div>
                            )}
                            
                            {/* Transcript */}
                            {call.transcript && expandedCallId === call.id && (
                              <div className="bg-background rounded-lg p-4 border">
                                <div className="flex items-center gap-2 text-sm font-medium mb-2">
                                  <FileText className="h-4 w-4" />
                                  Расшифровка разговора
                                </div>
                                <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                                  {call.transcript}
                                </p>
                              </div>
                            )}
                            
                            {/* AI Summary */}
                            {call.ai_summary && expandedCallId === call.id && (
                              <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                                <div className="flex items-center gap-2 text-sm font-medium mb-2 text-blue-700 dark:text-blue-300">
                                  🤖 AI Анализ
                                </div>
                                <p className="text-sm text-blue-900 dark:text-blue-100">
                                  {call.ai_summary}
                                </p>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Call Details Dialog */}
      <Dialog open={!!selectedCall} onOpenChange={() => setSelectedCall(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Детали звонка</DialogTitle>
          </DialogHeader>
          {selectedCall && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Номер телефона</Label>
                  <p className="font-mono">{selectedCall.client_phone}</p>
                </div>
                <div>
                  <Label>Направление</Label>
                  <p>{selectedCall.direction === 'incoming' ? 'Входящий' : 'Исходящий'}</p>
                </div>
                <div>
                  <Label>Длительность</Label>
                  <p>{formatDuration(selectedCall.duration)}</p>
                </div>
                <div>
                  <Label>Дата</Label>
                  <p>{new Date(selectedCall.created_at).toLocaleString('ru-RU')}</p>
                </div>
              </div>
              
              {selectedCall.recording_url && (
                <div>
                  <Label>Запись</Label>
                  <audio src={selectedCall.recording_url} controls className="w-full mt-2" />
                </div>
              )}
              
              {selectedCall.transcript && (
                <div>
                  <Label>Расшифровка</Label>
                  <div className="bg-muted rounded p-3 mt-2 max-h-64 overflow-y-auto">
                    <p className="text-sm whitespace-pre-wrap">{selectedCall.transcript}</p>
                  </div>
                </div>
              )}
              
              {selectedCall.ai_summary && (
                <div>
                  <Label>AI Анализ</Label>
                  <div className="bg-blue-50 dark:bg-blue-950/20 rounded p-3 mt-2">
                    <p className="text-sm">{selectedCall.ai_summary}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}