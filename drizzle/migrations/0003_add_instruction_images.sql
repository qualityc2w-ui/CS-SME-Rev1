ALTER TABLE public.dimension_standards ADD COLUMN IF NOT EXISTS gambar_path text NOT NULL DEFAULT '';
ALTER TABLE public.visual_standards ADD COLUMN IF NOT EXISTS gambar_path text NOT NULL DEFAULT '';
ALTER TABLE public.function_standards ADD COLUMN IF NOT EXISTS gambar_path text NOT NULL DEFAULT '';

DROP POLICY IF EXISTS "auth read instruksi" ON storage.objects;
CREATE POLICY "auth read instruksi" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'instruksi');

DROP POLICY IF EXISTS "admin insert instruksi" ON storage.objects;
CREATE POLICY "admin insert instruksi" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'instruksi' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admin delete instruksi" ON storage.objects;
CREATE POLICY "admin delete instruksi" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'instruksi' AND public.has_role(auth.uid(), 'admin'));