CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kode text NOT NULL,
  nama text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO anon, authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public access products" ON public.products FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.inspectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text NOT NULL,
  dept text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspectors TO anon, authenticated;
GRANT ALL ON public.inspectors TO service_role;
ALTER TABLE public.inspectors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public access inspectors" ON public.inspectors FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.defects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text NOT NULL,
  tipe text NOT NULL DEFAULT 'Visual',
  kategori text NOT NULL DEFAULT 'Minor',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.defects TO anon, authenticated;
GRANT ALL ON public.defects TO service_role;
ALTER TABLE public.defects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public access defects" ON public.defects FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.dimension_standards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  parameter text NOT NULL,
  nilai_standar numeric NOT NULL,
  toleransi_min numeric NOT NULL DEFAULT 0,
  toleransi_max numeric NOT NULL DEFAULT 0,
  satuan text NOT NULL DEFAULT 'mm',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dimension_standards TO anon, authenticated;
GRANT ALL ON public.dimension_standards TO service_role;
ALTER TABLE public.dimension_standards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public access dimension_standards" ON public.dimension_standards FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.visual_standards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  checklist text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visual_standards TO anon, authenticated;
GRANT ALL ON public.visual_standards TO service_role;
ALTER TABLE public.visual_standards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public access visual_standards" ON public.visual_standards FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.function_standards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  checklist text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.function_standards TO anon, authenticated;
GRANT ALL ON public.function_standards TO service_role;
ALTER TABLE public.function_standards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public access function_standards" ON public.function_standards FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal date NOT NULL DEFAULT current_date,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  inspector_id uuid REFERENCES public.inspectors(id) ON DELETE SET NULL,
  shift text NOT NULL DEFAULT 'Shift 1',
  sesi text NOT NULL DEFAULT 'Start',
  sample integer NOT NULL DEFAULT 1,
  dimensi jsonb NOT NULL DEFAULT '{"hasil":"OK","detail":[],"defectId":"","catatan":""}'::jsonb,
  visual jsonb NOT NULL DEFAULT '{"hasil":"OK","defectId":"","catatan":""}'::jsonb,
  fungsi jsonb NOT NULL DEFAULT '{"hasil":"OK","defectId":"","catatan":""}'::jsonb,
  hasil_akhir text NOT NULL DEFAULT 'Lulus',
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspections TO anon, authenticated;
GRANT ALL ON public.inspections TO service_role;
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public access inspections" ON public.inspections FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.pic_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text NOT NULL,
  role text NOT NULL DEFAULT 'input',
  password text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pic_accounts TO anon, authenticated;
GRANT ALL ON public.pic_accounts TO service_role;
ALTER TABLE public.pic_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public access pic_accounts" ON public.pic_accounts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.products (kode, nama) VALUES
  ('PRD-001','Casing Plastik A'),
  ('PRD-002','Bracket Metal B'),
  ('PRD-003','PCB Modul C');

INSERT INTO public.inspectors (nama, dept) VALUES
  ('Budi Santoso','QC Line 1'),
  ('Siti Aminah','QC Line 2');

INSERT INTO public.defects (nama, tipe, kategori) VALUES
  ('Ukuran Diluar Toleransi','Dimensi','Mayor'),
  ('Ketebalan Tidak Sesuai','Dimensi','Minor'),
  ('Goresan Permukaan','Visual','Minor'),
  ('Warna Tidak Merata','Visual','Minor'),
  ('Komponen Tidak Berfungsi','Fungsi','Kritis'),
  ('Respon Tombol Lambat','Fungsi','Mayor');

INSERT INTO public.dimension_standards (product_id, parameter, nilai_standar, toleransi_min, toleransi_max, satuan)
SELECT p.id, v.parameter, v.nilai, v.tmin, v.tmax, 'mm'
FROM (VALUES
  ('PRD-001','Panjang',50,0.5,0.5),
  ('PRD-001','Lebar',30,0.3,0.3),
  ('PRD-002','Diameter Lubang',12,0.2,0.2)
) AS v(kode, parameter, nilai, tmin, tmax)
JOIN public.products p ON p.kode = v.kode;

INSERT INTO public.pic_accounts (nama, role, password) VALUES
  ('Operator A','input',''),
  ('Viewer B','view',''),
  ('Approver C','approve','');
