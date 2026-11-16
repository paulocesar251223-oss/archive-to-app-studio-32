DROP POLICY IF EXISTS "games readable" ON public.game_settings;
CREATE POLICY "staff read game settings" ON public.game_settings FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "settings readable" ON public.app_settings;
CREATE POLICY "players read public terms" ON public.app_settings FOR SELECT TO authenticated USING (key = 'mission_terms');
CREATE POLICY "staff read settings" ON public.app_settings FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));