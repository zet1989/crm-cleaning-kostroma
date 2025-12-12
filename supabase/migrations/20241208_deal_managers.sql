-- Связь сделок с менеджерами (множественный выбор)
CREATE TABLE IF NOT EXISTS public.deal_managers (
    deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
    manager_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    earnings_percent DECIMAL(5,2) DEFAULT 100, -- % от ставки менеджера для этой сделки
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (deal_id, manager_id)
);

-- Включаем RLS
ALTER TABLE public.deal_managers ENABLE ROW LEVEL SECURITY;

-- Политики RLS для deal_managers
CREATE POLICY "Админы имеют полный доступ к deal_managers"
ON public.deal_managers
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

CREATE POLICY "Менеджеры могут читать deal_managers"
ON public.deal_managers
FOR SELECT
TO authenticated
USING (true);

-- Индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_deal_managers_deal_id ON public.deal_managers(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_managers_manager_id ON public.deal_managers(manager_id);
