-- NEXMIR · Hotfix de acceso a participantes de Batallas
-- Ejecutar una sola vez en Supabase > SQL Editor.
-- No elimina salas, participantes, respuestas ni usuarios.

begin;

alter table public.battle_participants enable row level security;

-- Retira cualquier política heredada (incluidas políticas RESTRICTIVE con
-- nombres desconocidos) que pueda bloquear el alta del propio jugador.
do $$
declare p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname='public' and tablename='battle_participants'
  loop
    execute format('drop policy if exists %I on public.battle_participants',p.policyname);
  end loop;
end $$;

create policy battle_participants_read_members
on public.battle_participants
for select
to authenticated
using (user_id=auth.uid() or public.nexmir_battle_member(room_id));

create policy battle_participants_join_self
on public.battle_participants
for insert
to authenticated
with check (user_id=auth.uid());

grant select,insert on public.battle_participants to authenticated;

commit;
notify pgrst,'reload schema';

-- Verificación: debe devolver exactamente dos filas y permissive = PERMISSIVE.
select policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname='public' and tablename='battle_participants'
order by policyname;
