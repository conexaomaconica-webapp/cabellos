-- Migration 20260918000004: Create system-assets storage bucket and apply RLS policies

BEGIN;

-- 1. Create the 'system-assets' bucket in storage.buckets with public access
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'system-assets',
    'system-assets',
    true,
    10485760, -- 10MB
    ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'video/mp4', 'video/webm', 'image/x-icon', 'image/vnd.microsoft.icon']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. RLS Policies for storage.objects in 'system-assets' bucket
DROP POLICY IF EXISTS "Public Read System Assets" ON storage.objects;
CREATE POLICY "Public Read System Assets" ON storage.objects
    FOR SELECT USING (bucket_id = 'system-assets');

DROP POLICY IF EXISTS "Master Upload System Assets" ON storage.objects;
CREATE POLICY "Master Upload System Assets" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'system-assets' AND
        public.user_is_master(auth.uid())
    );

DROP POLICY IF EXISTS "Master Update System Assets" ON storage.objects;
CREATE POLICY "Master Update System Assets" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'system-assets' AND
        public.user_is_master(auth.uid())
    );

DROP POLICY IF EXISTS "Master Delete System Assets" ON storage.objects;
CREATE POLICY "Master Delete System Assets" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'system-assets' AND
        public.user_is_master(auth.uid())
    );

COMMIT;
