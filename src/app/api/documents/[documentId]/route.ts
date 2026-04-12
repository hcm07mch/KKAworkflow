/**
 * API Route: Single Document
 * GET    /api/documents/:documentId → 문서 조회
 * PUT    /api/documents/:documentId → 문서 내용 수정 (draft 상태에서만)
 * DELETE /api/documents/:documentId → 문서 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { createSupabaseServiceClient } from '@/lib/infrastructure/supabase';

export async function GET(
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

  return NextResponse.json(doc);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { documentId } = await params;
  const body = await request.json();

  const existing = await auth.services.documentRepo.findById(documentId);
  if (!existing) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: '문서를 찾을 수 없습니다' } },
      { status: 404 },
    );
  }

  if (existing.status !== 'draft' && existing.type !== 'payment') {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: '작성중 상태의 문서만 수정할 수 있습니다' } },
      { status: 403 },
    );
  }

  // 담당자(프로젝트 소유자)만 수정 가능
  const project = await auth.services.projectRepo.findById(existing.project_id);
  if (project && project.owner_id && project.owner_id !== auth.dbUser.id) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: '담당자만 견적서를 수정할 수 있습니다' } },
      { status: 403 },
    );
  }

  const updated = await auth.services.documentRepo.update(documentId, {
    content: body.content,
    ...(body.title ? { title: body.title } : {}),
  });

  return NextResponse.json(updated);
}

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

  // 스토리지 파일 정리
  const content = doc.content as Record<string, unknown>;
  const filePath = content?.file_path as string | undefined;
  if (filePath) {
    try {
      const serviceClient = createSupabaseServiceClient();
      await serviceClient.storage.from('project-documents').remove([filePath]);
    } catch { /* ignore */ }
  }

  // 문서 삭제 (cascade로 approvals도 삭제)
  await auth.services.documentRepo.deleteById(documentId);

  return NextResponse.json({ deleted: documentId });
}
