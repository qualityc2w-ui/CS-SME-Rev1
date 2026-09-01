-- Roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'qc', 'karyawan');

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nama text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.can_write_inspection(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'qc')
  )
$$;

-- Profile + default role on signup (first ever user becomes admin)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned public.app_role;
BEGIN
  INSERT INTO public.profiles (id, nama, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nama', NEW.raw_user_meta_data ->> 'full_name', split_part(COALESCE(NEW.email, ''), '@', 1)),
    COALESCE(NEW.email, '')
  )
  ON CONFLICT (id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles) THEN
    assigned := 'admin';
  ELSE
    assigned := 'karyawan';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Profiles policies
CREATE POLICY "read own profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "admin update profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- user_roles policies
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

-- Lock down existing tables: remove public/anon access
DROP POLICY IF EXISTS "public access products" ON public.products;
DROP POLICY IF EXISTS "public access inspectors" ON public.inspectors;
DROP POLICY IF EXISTS "public access defects" ON public.defects;
DROP POLICY IF EXISTS "public access dimension_standards" ON public.dimension_standards;
DROP POLICY IF EXISTS "public access visual_standards" ON public.visual_standards;
DROP POLICY IF EXISTS "public access function_standards" ON public.function_standards;
DROP POLICY IF EXISTS "public access inspections" ON public.inspections;
DROP POLICY IF EXISTS "public access pic_accounts" ON public.pic_accounts;

REVOKE ALL ON public.products, public.inspectors, public.defects,
  public.dimension_standards, public.visual_standards, public.function_standards,
  public.inspections, public.pic_accounts FROM anon;

-- Master data: all signed-in users read, admin writes
CREATE POLICY "auth read products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write products" ON public.products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "auth read inspectors" ON public.inspectors FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write inspectors" ON public.inspectors FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "auth read defects" ON public.defects FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write defects" ON public.defects FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "auth read dimension_standards" ON public.dimension_standards FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write dimension_standards" ON public.dimension_standards FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "auth read visual_standards" ON public.visual_standards FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write visual_standards" ON public.visual_standards FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "auth read function_standards" ON public.function_standards FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write function_standards" ON public.function_standards FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Inspections: signed-in users read; admin/qc create & update; admin deletes
CREATE POLICY "auth read inspections" ON public.inspections FOR SELECT TO authenticated USING (true);
CREATE POLICY "qc insert inspections" ON public.inspections FOR INSERT TO authenticated
  WITH CHECK (public.can_write_inspection(auth.uid()));
CREATE POLICY "qc update inspections" ON public.inspections FOR UPDATE TO authenticated
  USING (public.can_write_inspection(auth.uid())) WITH CHECK (public.can_write_inspection(auth.uid()));
CREATE POLICY "admin delete inspections" ON public.inspections FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- PIC accounts: admin only
CREATE POLICY "admin manage pic_accounts" ON public.pic_accounts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
