-- Mentor availability, shown to founders when they book a meeting.
-- Free-text windows for now (e.g. "Tue and Thu afternoons"); structured slot
-- booking arrives with the Office Hours module in Phase 2.

alter table users add column availability text;
alter table users add column booking_link text;
alter table users add column capacity int not null default 1;

-- Mentors maintain their own availability; staff may correct it.
create policy users_self_update on users for update
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());
