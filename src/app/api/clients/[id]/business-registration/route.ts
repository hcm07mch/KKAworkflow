/**
 * API Route: Client Business Registration File
 * POST   /api/clients/:id/business-registration  → 사업자 등록증 업로드
 * GET    /api/clients/:id/business-registration  → 서명된 URL 반환
 * DELETE /api/clients/:id/business-registration  → 파일 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, verifyClientInOrg } from '@/lib/auth';
import { createSupabaseServiceClient } from '@/lib/infrastructure/supabase/client';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { id } = await params;

  const orgError = await verifyClientInOrg(auth, id);
  if (orgError) return orgError;

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
      { error: { code: 'FILE_TOO_LARGE', message: '파일 크기는 20MB를 초과할 수 없습니다' } },
      { status: 400 },
    );
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: { code: 'INVALID_TYPE', message: '허용되지 않는 파일 형식입니다 (PDF, 이미지만 가능)' } },
      { status: 400 },
    );
  }

  const serviceClient = createSupabaseServiceClient();

  // 기존 파일 삭제
  const { data: existing } = await serviceClient
    .from('workflow_clients')
    .select('business_registration_file_path')
    .eq('id', id)
    .single();

  const existingPath = (existing as { business_registration_file_path: string | null } | null)
    ?.business_registration_file_path;
  if (existingPath) {
    try {
      await serviceClient.storage.from('project-documents').remove([existingPath]);
    } catch (e) {
      console.warn('[client-business-reg] 기존 파일 삭제 실패 (무시):', e);
    }
  }

  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `clients/${id}/business-reg/${Date.now()}_${sanitizedName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await serviceClient.storage
    .from('project-documents')
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error('[client-business-reg] Storage error:', uploadError);
    return NextResponse.json(
      { error: { code: 'UPLOAD_FAILED', message: '파일 업로드에 실패했습니다' } },
      { status: 500 },
    );
  }

  const { data: updated, error: updateError } = await serviceClient
    .from('workflow_clients')
    .update({
      business_registration_file_path: storagePath,
      business_registration_file_name: file.name,
    })
    .eq('id', id)
    .select()
    .single();

  if (updateError || !updated) {
    // 업로드된 파일 롤백
    await serviceClient.storage.from('project-documents').remove([storagePath]).catch(() => {});
    return NextResponse.json(
      { error: { code: 'UPDATE_FAILED', message: updateError?.message ?? '저장에 실패했습니다' } },
      { status: 500 },
    );
  }

  return NextResponse.json({
    file_path: storagePath,
    file_name: file.name,
    file_size: file.size,
    file_type: file.type,
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { id } = await params;

  const orgError = await verifyClientInOrg(auth, id);
  if (orgError) return orgError;

  const serviceClient = createSupabaseServiceClient();
  const { data } = await serviceClient
    .from('workflow_clients')
    .select('business_registration_file_path')
    .eq('id', id)
    .single();

  const filePath = (data as { business_registration_file_path: string | null } | null)
    ?.business_registration_file_path;

  if (!filePath) {
    return NextResponse.json(
      { error: { code: 'NO_FILE', message: '파일이 없습니다' } },
      { status: 404 },
    );
  }

  const { data: signed, error } = await serviceClient.storage
    .from('project-documents')
    .createSignedUrl(filePath, 3600);

  if (error || !signed?.signedUrl) {
    return NextResponse.json(
      { error: { code: 'URL_ERROR', message: '파일 URL 생성에 실패했습니다' } },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: signed.signedUrl });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext();
  if (!auth.success) return auth.response;

  const { id } = await params;

  const orgError = await verifyClientInOrg(auth, id);
  if (orgError) return orgError;

  const serviceClient = createSupabaseServiceClient();
  const { data } = await serviceClient
    .from('workflow_clients')
    .select('business_registration_file_path')
    .eq('id', id)
    .single();

  const filePath = (data as { business_registration_file_path: string | null } | null)
    ?.business_registration_file_path;

  if (filePath) {
    await serviceClient.storage.from('project-documents').remove([filePath]).catch(() => {});
  }

  const { error } = await serviceClient
    .from('workflow_clients')
    .update({
      business_registration_file_path: null,
      business_registration_file_name: null,
    })
    .eq('id', id);

  if (error) {
    return NextResponse.json(
      { error: { code: 'UPDATE_FAILED', message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
