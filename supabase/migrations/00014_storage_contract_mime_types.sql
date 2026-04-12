-- =============================================================================
-- Migration: Add contract file MIME types to project-documents bucket
-- =============================================================================

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/haansofthwp',
  'application/x-hwp'
]
WHERE id = 'project-documents';
