-- CRM Клининговой Компании
-- Начальная миграция: создание всех таблиц

-- Включаем Row Level Security
-- Создаём типы
CREATE TYPE user_role AS ENUM ('admin', 'manager');
CREATE TYPE call_direction AS ENUM ('incoming', 'outgoing');
CREATE TYPE notification_type AS ENUM ('deal', 'call', 'system');

-- ============================================
-- ПРОФИЛИ ПОЛЬЗОВАТЕЛЕЙ
-- ============================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    phone TEXT,
    roles user_role[] DEFAULT ARRAY['manager']::user_role[],
    salary_percent NUMERIC(5,2) DEFAULT 10.00,
    can_view_analytics BOOLEAN DEFAULT false,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Триггер для автоматического создания профиля
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- КОЛОНКИ КАНБАН-ДОСКИ
-- ============================================
CREATE TABLE columns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366f1',
    position INTEGER NOT NULL DEFAULT 0,
    is_success BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Колонки добавляются в seed.sql

-- ============================================
-- ИСПОЛНИТЕЛИ
-- ============================================
CREATE TABLE executors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    salary_percent NUMERIC(5,2) DEFAULT 40.00,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER executors_updated_at
    BEFORE UPDATE ON executors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- СДЕЛКИ
-- ============================================
CREATE TABLE deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    column_id UUID NOT NULL REFERENCES columns(id) ON DELETE RESTRICT,
    position INTEGER DEFAULT 0,
    client_name TEXT NOT NULL,
    client_phone TEXT NOT NULL,
    address TEXT NOT NULL,
    price NUMERIC(10,2) DEFAULT 0,
    executor_id UUID REFERENCES executors(id) ON DELETE SET NULL,
    manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    scheduled_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    notes TEXT,
    is_repeated_client BOOLEAN DEFAULT false,
    source TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX deals_column_id_idx ON deals(column_id);
CREATE INDEX deals_executor_id_idx ON deals(executor_id);
CREATE INDEX deals_manager_id_idx ON deals(manager_id);
CREATE INDEX deals_client_phone_idx ON deals(client_phone);
CREATE INDEX deals_scheduled_at_idx ON deals(scheduled_at);

CREATE TRIGGER deals_updated_at
    BEFORE UPDATE ON deals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Функция для определения повторного клиента
CREATE OR REPLACE FUNCTION check_repeated_client()
RETURNS TRIGGER AS $$
BEGIN
    -- Проверяем есть ли другие сделки с этим номером телефона
    IF EXISTS (
        SELECT 1 FROM deals 
        WHERE client_phone = NEW.client_phone 
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
        NEW.is_repeated_client := true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_repeated_client_trigger
    BEFORE INSERT OR UPDATE ON deals
    FOR EACH ROW EXECUTE FUNCTION check_repeated_client();

-- Функция для автоматического заполнения completed_at
CREATE OR REPLACE FUNCTION set_completed_at()
RETURNS TRIGGER AS $$
BEGIN
    -- Проверяем, переместилась ли сделка в колонку is_success
    IF NEW.column_id IS DISTINCT FROM OLD.column_id THEN
        -- Проверяем, является ли новая колонка успешной
        IF EXISTS (SELECT 1 FROM columns WHERE id = NEW.column_id AND is_success = true) THEN
            -- Если completed_at ещё не установлено, устанавливаем
            IF NEW.completed_at IS NULL THEN
                NEW.completed_at := NOW();
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_completed_at_trigger
    BEFORE UPDATE ON deals
    FOR EACH ROW EXECUTE FUNCTION set_completed_at();

-- ============================================
-- ЗВОНКИ
-- ============================================
CREATE TABLE calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
    client_phone TEXT NOT NULL,
    direction call_direction NOT NULL,
    duration INTEGER DEFAULT 0,
    recording_url TEXT,
    transcript TEXT,
    ai_summary TEXT,
    is_spam BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX calls_deal_id_idx ON calls(deal_id);
CREATE INDEX calls_client_phone_idx ON calls(client_phone);
CREATE INDEX calls_created_at_idx ON calls(created_at);

-- ============================================
-- КОММЕНТАРИИ К ЗВОНКАМ
-- ============================================
CREATE TABLE call_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX call_comments_call_id_idx ON call_comments(call_id);

-- ============================================
-- БОНУСЫ
-- ============================================
CREATE TABLE bonuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    executor_id UUID REFERENCES executors(id) ON DELETE SET NULL,
    manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
    amount NUMERIC(10,2) NOT NULL,
    reason TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Либо исполнитель, либо менеджер должен быть указан
    CONSTRAINT bonus_recipient_check CHECK (
        (executor_id IS NOT NULL AND manager_id IS NULL) OR
        (executor_id IS NULL AND manager_id IS NOT NULL)
    )
);

CREATE INDEX bonuses_executor_id_idx ON bonuses(executor_id);
CREATE INDEX bonuses_manager_id_idx ON bonuses(manager_id);

-- ============================================
-- УВЕДОМЛЕНИЯ
-- ============================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type notification_type DEFAULT 'system',
    is_read BOOLEAN DEFAULT false,
    deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX notifications_user_id_idx ON notifications(user_id);
CREATE INDEX notifications_is_read_idx ON notifications(is_read);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE executors ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE bonuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Профили: пользователь видит свой профиль, админы видят всех
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND 'admin' = ANY(roles)
        )
    );

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can update all profiles" ON profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND 'admin' = ANY(roles)
        )
    );

-- Колонки: все авторизованные пользователи видят
CREATE POLICY "Authenticated users can view columns" ON columns
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage columns" ON columns
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND 'admin' = ANY(roles)
        )
    );

-- Исполнители: все авторизованные пользователи видят
CREATE POLICY "Authenticated users can view executors" ON executors
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage executors" ON executors
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND 'admin' = ANY(roles)
        )
    );

-- Сделки: все авторизованные видят и редактируют
CREATE POLICY "Authenticated users can view deals" ON deals
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert deals" ON deals
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update deals" ON deals
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Admins can delete deals" ON deals
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND 'admin' = ANY(roles)
        )
    );

-- Звонки: все авторизованные видят
CREATE POLICY "Authenticated users can view calls" ON calls
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert calls" ON calls
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update calls" ON calls
    FOR UPDATE TO authenticated USING (true);

-- Комментарии к звонкам
CREATE POLICY "Authenticated users can view call comments" ON call_comments
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own comments" ON call_comments
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments" ON call_comments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" ON call_comments
    FOR DELETE USING (auth.uid() = user_id);

-- Бонусы: все видят, авторизованные создают
CREATE POLICY "Authenticated users can view bonuses" ON bonuses
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert bonuses" ON bonuses
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admins can manage bonuses" ON bonuses
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND 'admin' = ANY(roles)
        )
    );

-- Уведомления: пользователи видят только свои
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications" ON notifications
    FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================
-- REALTIME
-- ============================================
-- Включаем реалтайм для таблиц
ALTER PUBLICATION supabase_realtime ADD TABLE deals;
ALTER PUBLICATION supabase_realtime ADD TABLE columns;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE calls;
