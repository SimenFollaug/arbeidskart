-- Allow any authenticated user to delete comments and drawings.
-- Editing remains restricted to the creator (existing update policies).

drop policy if exists "Users can delete their own comments" on public.comments;
create policy "Authenticated users can delete any comment"
  on public.comments for delete
  to authenticated
  using (true);

drop policy if exists "Users can delete their own drawings" on public.map_drawings;
create policy "Authenticated users can delete any drawing"
  on public.map_drawings for delete
  to authenticated
  using (true);
