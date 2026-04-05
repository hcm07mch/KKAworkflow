-- =============================================================================
-- Migration: Supabase Storage bucket for project documents (PDF 등)
-- =============================================================================

-- 1) 버킷 생성: project-documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-documents',
  'project-documents',
  false,
  52428800,  -- 50MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 2) RLS 정책: 인증된 사용자만 업로드/조회 가능
-- 업로드 (INSERT)
CREATE POLICY "Authenticated users can upload documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'project-documents');

-- 조회 (SELECT)
CREATE POLICY "Authenticated users can read documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'project-documents');

-- 수정 (UPDATE)
CREATE POLICY "Authenticated users can update documents"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'project-documents');

-- 삭제 (DELETE)
CREATE POLICY "Authenticated users can delete documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'project-documents');
