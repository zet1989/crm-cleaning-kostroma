-- Связь сделок с исполнителями (множественный выбор)
CREATE TABLE IF NOT EXISTS public.deal_executors (
    deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
    executor_id UUID REFERENCES public.executors(id) ON DELETE CASCADE,
    earnings_percent DECIMAL(5,2) DEFAULT 100, -- % от ставки исполнителя для этой сделки
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (deal_id, executor_id)
);

-- Включаем RLS
ALTER TABLE public.deal_executors ENABLE ROW LEVEL SECURITY;

-- Политики RLS для deal_executors
CREATE POLICY deal_executors_admin_policy
ON public.deal_executors
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND 'admin' = ANY(roles)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND 'admin' = ANY(roles)
    )
);

CREATE POLICY deal_executors_select_policy
ON public.deal_executors
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY deal_executors_insert_policy
ON public.deal_executors
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY deal_executors_update_policy
ON public.deal_executors
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY deal_executors_delete_policy
ON public.deal_executors
FOR DELETE
TO authenticated
USING (true);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_deal_executors_deal_id ON public.deal_executors(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_executors_executor_id ON public.deal_executors(executor_id);
