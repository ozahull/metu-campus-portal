-- 20260617130000_ticket_column_grants
-- Bilet kolonlarının kolon-grant'ları (Faz 4 migration'ında atlanmıştı)

-- events: başkan/yetkili bilet alanlarını yazabilsin
grant insert (ticket_price, ticket_capacity, ticket_deadline) on public.events to authenticated;
grant update (ticket_price, ticket_capacity, ticket_deadline) on public.events to authenticated;

-- clubs: başkan/yetkili IBAN + bilet anahtarını yazabilsin
grant update (iban, ticket_enabled) on public.clubs to authenticated;
