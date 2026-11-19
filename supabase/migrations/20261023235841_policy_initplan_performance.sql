SET lock_timeout='10s';
ALTER POLICY profiles_update_own ON public.profiles
 USING (id=(select auth.uid()) AND account_id=(select public.current_user_account_id()))
 WITH CHECK (id=(select auth.uid()) AND account_id=(select public.current_user_account_id()) AND (active_organization_id IS NULL OR public.user_can_access_organization(active_organization_id)));
ALTER POLICY support_ticket_messages_insert_salon ON public.support_ticket_messages
 WITH CHECK (author_kind='salon' AND created_by=(select auth.uid()) AND EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id=support_ticket_messages.ticket_id AND t.organization_id=(select public.current_user_organization_id())));
ALTER POLICY accounts_update_admin ON public.accounts
 USING (id=(select public.current_user_account_id()) AND EXISTS (SELECT 1 FROM public.account_memberships m WHERE m.user_id=(select auth.uid()) AND m.account_id=accounts.id AND m.role='admin'))
 WITH CHECK (id=(select public.current_user_account_id()));
ALTER POLICY retail_weekly_offers_org_members_read ON public.retail_weekly_offers
 USING (organization_id IS NULL OR organization_id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id=(select auth.uid())));
