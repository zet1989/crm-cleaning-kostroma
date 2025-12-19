SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('columns', 'deals', 'calls');
