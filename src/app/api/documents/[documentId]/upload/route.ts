/**
 * API Route: Contract File Upload
 * POST /api/documents/:documentId/upload
 *
 * 계약서 파일 업로드 → Supabase Storage에 저장 후 문서 content에 파일 경로 기록
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, verifyDocumentInOrg } from '@/lib/auth';
import { createSupabaseServiceClient } from '@/lib/infrastructure/supabase';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/haansofthwp',
  'application/x-hwp',
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { documentId } = await params;

  const orgError = await verifyDocumentInOrg(auth, documentId);
  if (orgError) return orgError;

  // 1) 문서 존재 확인 + 권한 검증
  const doc = await auth.services.documentRepo.findById(documentId);
  if (!doc) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: '문서를 찾을 수 없습니다' } },
      { status: 404 },
    );
  }

  if (doc.status !== 'draft') {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: '작성중 상태의 문서만 파일을 업로드할 수 있습니다' } },
      { status: 403 },
    );
  }

  // 담당자(프로젝트 소유자)만 업로드 가능
  const project = await auth.services.projectRepo.findById(doc.project_id);
  if (project && project.owner_id && project.owner_id !== auth.dbUser.id) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: '담당자만 파일을 업로드할 수 있습니다' } },
      { status: 403 },
    );
  }

  // 2) FormData에서 파일 추출
  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json(
      { error: { code: 'NO_FILE', message: '파일이 필요합니다' } },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: { code: 'FILE_TOO_LARGE', message: '파일 크기는 50MB를 초과할 수 없습니다' } },
      { status: 400 },
    );
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: { code: 'INVALID_TYPE', message: '허용되지 않는 파일 형식입니다 (PDF, 이미지, Word, HWP만 가능)' } },
      { status: 400 },
    );
  }

  // 3) 기존 파일이 있으면 삭제
  const existingContent = doc.content as Record<string, unknown>;
  const existingPath = existingContent?.file_path as string | undefined;
  if (existingPath) {
    try {
      const serviceClient = createSupabaseServiceClient();
      await serviceClient.storage.from('project-documents').remove([existingPath]);
    } catch (e) {
      console.warn('[upload] 기존 파일 삭제 실패 (무시):', e);
    }
  }

  // 4) Supabase Storage에 업로드
  const ext = file.name.split('.').pop() || 'pdf';
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `contracts/${doc.project_id}/${documentId}/${Date.now()}_${sanitizedName}`;

  const serviceClient = createSupabaseServiceClient();
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await serviceClient.storage
    .from('project-documents')
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error('[upload] Storage error:', uploadError);
    return NextResponse.json(
      { error: { code: 'UPLOAD_FAILED', message: '파일 업로드에 실패했습니다' } },
      { status: 500 },
    );
  }

  // 5) 문서 content 업데이트 (기존 메타 정보 유지 + 파일 정보 추가)
  const updatedContent = {
    ...existingContent,
    file_path: storagePath,
    file_name: file.name,
    file_size: file.size,
    file_type: file.type,
  };

  const updated = await auth.services.documentRepo.update(documentId, {
    content: updatedContent as any,
  });

  return NextResponse.json({
    document: updated,
    file: {
      path: storagePath,
      name: file.name,
      size: file.size,
      type: file.type,
    },
  });
}

/**
 * DELETE /api/documents/:documentId/upload
 * 계약서 파일 삭제
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { documentId } = await params;

  const doc = await auth.services.documentRepo.findById(documentId);
  if (!doc) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: '문서를 찾을 수 없습니다' } },
      { status: 404 },
    );
  }

  if (doc.status !== 'draft') {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: '작성중 상태의 문서만 파일을 삭제할 수 있습니다' } },
      { status: 403 },
    );
  }

  const content = doc.content as Record<string, unknown>;
  const filePath = content?.file_path as string | undefined;

  if (filePath) {
    try {
      const serviceClient = createSupabaseServiceClient();
      await serviceClient.storage.from('project-documents').remove([filePath]);
    } catch (e) {
      console.warn('[upload] 파일 삭제 실패 (무시):', e);
    }
  }

  // content에서 파일 정보 제거
  const { file_path, file_name, file_size, file_type, ...rest } = content;
  const updated = await auth.services.documentRepo.update(documentId, {
    content: rest as any,
  });

  return NextResponse.json({ document: updated });
}
