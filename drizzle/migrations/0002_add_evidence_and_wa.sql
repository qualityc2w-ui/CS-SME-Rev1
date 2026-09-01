ALTER TABLE public.inspections ADD COLUMN IF NOT EXISTS evidence jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.pic_accounts ADD COLUMN IF NOT EXISTS nomor_wa text NOT NULL DEFAULT '';
ALTER TABLE public.inspectors ADD COLUMN IF NOT EXISTS nomor_wa text NOT NULL DEFAULT '';

DROP POLICY IF EXISTS "auth read evidence" ON storage.objects;
CREATE POLICY "auth read evidence" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'evidence');

DROP POLICY IF EXISTS "qc upload evidence" ON storage.objects;
CREATE POLICY "qc upload evidence" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'evidence' AND public.can_write_inspection(auth.uid()));

DROP POLICY IF EXISTS "qc delete evidence" ON storage.objects;
CREATE POLICY "qc delete evidence" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'evidence' AND public.can_write_inspection(auth.uid()));