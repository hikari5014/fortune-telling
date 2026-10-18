-- 福幣錢包：餘額與流水帳。使用者只能「看」自己的資料；所有加減都走下面的函式（security definer），
-- 前端不能直接改表。真正的儲值之後由金流回呼（Edge Function，用 service role）寫入。

create table public.app_config (
  key text primary key,
  value jsonb not null
);
insert into public.app_config(key, value) values
  ('demo_topup', 'true'::jsonb),          -- 示範儲值開關：接上真金流時改成 false
  ('refund_days', '30'::jsonb);

create table public.wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  coins integer not null default 0 check (coins >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null,
  kind text not null check (kind in ('topup', 'demo', 'spend', 'return', 'refund')),
  what text,
  pack text,
  amount_twd integer,                       -- 真的贊助才有
  refundable_until timestamptz,             -- 贊助後 30 天內可無條件退費
  status text not null default 'ok' check (status in ('ok', 'returned', 'refunded')),
  created_at timestamptz not null default now()
);
create index ledger_user_time on public.ledger(user_id, created_at desc);

alter table public.app_config enable row level security;
alter table public.wallets enable row level security;
alter table public.ledger enable row level security;

create policy "read own wallet" on public.wallets for select to authenticated using ((select auth.uid()) = user_id);
create policy "read own ledger" on public.ledger for select to authenticated using ((select auth.uid()) = user_id);
-- app_config 不開放讀寫（只有函式內部用）

-- 讀錢包（沒有就建一個空的）
create or replace function public.wallet_get()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); c integer;
begin
  if uid is null then raise exception 'not signed in'; end if;
  insert into public.wallets(user_id) values (uid) on conflict (user_id) do nothing;
  select coins into c from public.wallets where user_id = uid;
  return jsonb_build_object('coins', c, 'log', coalesce((
    select jsonb_agg(jsonb_build_object('d', l.delta, 'what', l.what, 'at', l.created_at) order by l.created_at desc)
    from (select * from public.ledger where user_id = uid order by created_at desc limit 20) l), '[]'::jsonb));
end $$;

-- 扣幣：餘額不夠就不扣
create or replace function public.wallet_spend(n integer, what text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); c integer;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if n is null or n < 1 or n > 100 then raise exception 'bad amount'; end if;
  update public.wallets set coins = coins - n, updated_at = now()
    where user_id = uid and coins >= n returning coins into c;
  if c is null then return jsonb_build_object('ok', false, 'reason', 'insufficient'); end if;
  insert into public.ledger(user_id, delta, kind, what) values (uid, -n, 'spend', left(what, 60));
  return jsonb_build_object('ok', true, 'coins', c);
end $$;

-- 退回：只能退「兩分鐘內、還沒退過」的那一筆扣幣（例如福幣掉到池外）——不能拿來憑空變出錢
create or replace function public.wallet_return(what text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); sid bigint; amt integer; c integer;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select id, -delta into sid, amt from public.ledger
    where user_id = uid and kind = 'spend' and status = 'ok' and created_at > now() - interval '2 minutes'
    order by created_at desc limit 1 for update;
  if sid is null then return jsonb_build_object('ok', false, 'reason', 'nothing-to-return'); end if;
  update public.ledger set status = 'returned' where id = sid;
  update public.wallets set coins = coins + amt, updated_at = now() where user_id = uid returning coins into c;
  insert into public.ledger(user_id, delta, kind, what) values (uid, amt, 'return', left(what, 60));
  return jsonb_build_object('ok', true, 'coins', c);
end $$;

-- 示範儲值：只在 demo_topup = true 時可用；示範幣累計上限 2000 枚
create or replace function public.wallet_demo_topup(pack text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); n integer; c integer; total integer;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if coalesce((select value from public.app_config where key = 'demo_topup'), 'false'::jsonb) <> 'true'::jsonb then
    return jsonb_build_object('ok', false, 'reason', 'demo-closed');
  end if;
  n := case pack when 'p30' then 30 when 'p120' then 120 when 'p400' then 400 else null end;
  if n is null then return jsonb_build_object('ok', false, 'reason', 'no-pack'); end if;
  select coalesce(sum(delta), 0) into total from public.ledger where user_id = uid and kind = 'demo';
  if total + n > 2000 then return jsonb_build_object('ok', false, 'reason', 'demo-limit'); end if;
  insert into public.wallets(user_id) values (uid) on conflict (user_id) do nothing;
  update public.wallets set coins = coins + n, updated_at = now() where user_id = uid returning coins into c;
  insert into public.ledger(user_id, delta, kind, what, pack) values (uid, n, 'demo', '贊助儲值（示範）', pack);
  return jsonb_build_object('ok', true, 'coins', c);
end $$;

revoke all on function public.wallet_get() from public, anon;
revoke all on function public.wallet_spend(integer, text) from public, anon;
revoke all on function public.wallet_return(text) from public, anon;
revoke all on function public.wallet_demo_topup(text) from public, anon;
grant execute on function public.wallet_get() to authenticated;
grant execute on function public.wallet_spend(integer, text) to authenticated;
grant execute on function public.wallet_return(text) to authenticated;
grant execute on function public.wallet_demo_topup(text) to authenticated;
