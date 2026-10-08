-- NEXMIR · Corrección INSERT ... RETURNING en battle_participants
-- Ejecutar en Supabase > SQL Editor.
-- No elimina ni modifica datos.

begin;

drop policy if exists battle_participants_read_members
on public.battle_participants;

create policy battle_participants_read_members
on public.battle_participants
for select
to authenticated
using (
  user_id=auth.uid()
  or public.nexmir_battle_member(room_id)
);

commit;
notify pgrst,'reload schema';

select policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname='public' and tablename='battle_participants'
order by policyname;
