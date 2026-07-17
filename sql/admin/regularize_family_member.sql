-- Administrative, idempotent regularization of one existing member.
-- Run only after migration 20260717141228 has been applied.
--
-- The values below are the approved first execution for Rodrigo. To reuse the
-- script, replace only family_id, email and role; no product rule is hardcoded
-- in private.regularize_family_member.
-- The function requires:
--   1 confirmed auth.users row for the normalized email;
--   1 active people row in the selected family;
--   no conflicting person/user link.
-- It creates or repairs family_members and records an audit event.

begin;

select private.regularize_family_member(
  '3cf2f9ef-5ada-4572-806f-b4d5a5610d25'::uuid, -- target family_id
  'ralves.seixas@gmail.com',                     -- confirmed login email
  'member'::public.family_role
) as membership_id;

-- Postcondition: exactly one active membership must be returned.
do $verify$
declare
  matching_memberships integer;
begin
  select count(*)
    into matching_memberships
  from public.family_members fm
  join auth.users u on u.id = fm.user_id
  where fm.family_id = '3cf2f9ef-5ada-4572-806f-b4d5a5610d25'::uuid
    and lower(u.email) = lower('ralves.seixas@gmail.com')
    and fm.status = 'active';

  if matching_memberships <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'regularization_postcondition_failed',
      detail = format('active_memberships=%s', matching_memberships);
  end if;
end
$verify$;

commit;
