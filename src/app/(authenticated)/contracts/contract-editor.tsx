'use client';

/**
 * ContractEditor — 계약서 업로드/관리
 *
 * 좌측 사이드 패널(메타 정보 + 승인 현황) + 우측 파일 업로드/미리보기 구조.
 * 향후 직접 생성 모드 추가 시 mode를 확장할 수 있도록 설계.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  LuUpload,
  LuFileText,
  LuTrash2,
  LuChevronUp,
  LuSettings2,
  LuSend,
  LuRotateCcw,
  LuDownload,
  LuExternalLink,
  LuShieldCheck,
  LuStickyNote,
  LuLoader,
} from 'react-icons/lu';
import { ActionButton, useFeedback } from '@/components/ui';
import type { ContractContent } from '@/lib/domain/types';
import { PAYMENT_TYPE_META, PAYMENT_TYPES } from '@/lib/domain/types';
import { ApprovalPanel, ApprovalHistoryPanel } from '../estimates/approval-panel';
import s from './contract-editor.module.css';

// ── Types ────────────────────────────────────────────────

export interface ContractEditorProps {
  mode: 'upload'; // 향후 'create' 모드 확장 가능
  initialData?: ContractContent;
  documentId?: string;
  clientName?: string;
  readOnly?: boolean;
  documentStatus?: string;
  onSave?: (data: ContractContent) => void;
  onSubmit?: (data: ContractContent) => void;
  onRedraft?: () => void;
  onStatusChange?: (newStatus: string) => void;
  onFileUploaded?: () => void;
}

type DrawerSection = 'info' | 'notes' | null;

const PANEL_STORAGE_KEY = 'kka-contract-panel-width';
const PANEL_MIN = 280;
const PANEL_MAX = 560;
const PANEL_DEFAULT = 340;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtKRW(n: number) {
  return new Intl.NumberFormat('ko-KR').format(n) + ' 원';
}

function fmtFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function getFileTypeLabel(type: string) {
  if (type.includes('pdf')) return 'PDF';
  if (type.includes('image')) return '이미지';
  if (type.includes('word') || type.includes('document')) return 'Word';
  if (type.includes('hwp') || type.includes('haansoft')) return 'HWP';
  return '파일';
}

// ── Component ────────────────────────────────────────────

export function ContractEditor({
  mode,
  initialData,
  documentId,
  clientName,
  readOnly,
  documentStatus,
  onSave,
  onSubmit,
  onRedraft,
  onStatusChange,
  onFileUploaded,
}: ContractEditorProps) {
  const { toast } = useFeedback();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [openDrawer, setOpenDrawer] = useState<DrawerSection>('info');

  // ── Resizable panel ──
  const [panelWidth, setPanelWidth] = useState(PANEL_DEFAULT);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartW = useRef(0);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PANEL_STORAGE_KEY);
      if (saved) {
        const w = parseInt(saved, 10);
        if (w >= PANEL_MIN && w <= PANEL_MAX) setPanelWidth(w);
      }
    } catch { /* ignore */ }
  }, []);

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartW.current = panelWidth;

    let lastX = e.clientX;
    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      lastX = ev.clientX;
      const newW = Math.min(PANEL_MAX, Math.max(PANEL_MIN, dragStartW.current + (ev.clientX - dragStartX.current)));
      setPanelWidth(newW);
    };
    const onUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      const finalW = Math.min(PANEL_MAX, Math.max(PANEL_MIN, dragStartW.current + (lastX - dragStartX.current)));
      try { localStorage.setItem(PANEL_STORAGE_KEY, String(Math.round(finalW))); } catch { /* ignore */ }
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [panelWidth]);

  // ── Meta fields ──
  const [contractDate, setContractDate] = useState(initialData?.contract_date || todayISO());
  const [effectiveDate, setEffectiveDate] = useState(initialData?.effective_date || '');
  const [expiryDate, setExpiryDate] = useState(initialData?.expiry_date || '');
  const [parties, setParties] = useState(initialData?.parties || clientName || '');
  const [monthlyAmount, setMonthlyAmount] = useState(initialData?.monthly_amount ?? 0);
  const [contractMonths, setContractMonths] = useState(initialData?.contract_months ?? 3);
  const [paymentType, setPaymentType] = useState(initialData?.payment_type || 'monthly');
  const [notes, setNotes] = useState(initialData?.notes || '');

  // ── File state ──
  const [filePath, setFilePath] = useState(initialData?.file_path || '');
  const [fileName, setFileName] = useState(initialData?.file_name || '');
  const [fileSize, setFileSize] = useState(initialData?.file_size ?? 0);
  const [fileType, setFileType] = useState(initialData?.file_type || '');
  const [dragOver, setDragOver] = useState(false);

  // File preview URL
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!filePath || !documentId) {
      setPreviewUrl(null);
      return;
    }
    // Fetch signed URL from storage
    fetch(`/api/documents/${documentId}/file-url`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.url) setPreviewUrl(data.url);
      })
      .catch(() => setPreviewUrl(null));
  }, [filePath, documentId]);

  // ── Build content ──
  const buildContent = useCallback((): ContractContent => ({
    file_path: filePath,
    file_name: fileName,
    file_size: fileSize,
    file_type: fileType,
    contract_date: contractDate,
    effective_date: effectiveDate,
    expiry_date: expiryDate,
    parties,
    payment_type: paymentType,
    monthly_amount: (paymentType === 'monthly' || paymentType === 'deposit') ? monthlyAmount : undefined,
    contract_months: (paymentType === 'monthly' || paymentType === 'deposit') ? contractMonths : undefined,
    total_amount: paymentType === 'per_invoice' ? monthlyAmount : monthlyAmount * contractMonths,
    notes,
  }), [filePath, fileName, fileSize, fileType, contractDate, effectiveDate, expiryDate, parties, paymentType, monthlyAmount, contractMonths, notes]);

  // ── File Upload ──
  const handleFileUpload = useCallback(async (file: File) => {
    if (!documentId) {
      toast({ title: '문서 ID가 없습니다', variant: 'error' });
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/documents/${documentId}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: err?.error?.message || '파일 업로드에 실패했습니다', variant: 'error' });
        return;
      }

      const data = await res.json();
      setFilePath(data.file.path);
      setFileName(data.file.name);
      setFileSize(data.file.size);
      setFileType(data.file.type);
      toast({ title: '파일이 업로드되었습니다', variant: 'success' });
      onFileUploaded?.();
    } catch {
      toast({ title: '파일 업로드 중 오류가 발생했습니다', variant: 'error' });
    } finally {
      setUploading(false);
    }
  }, [documentId, toast, onFileUploaded]);

  const handleFileDelete = useCallback(async () => {
    if (!documentId) return;
    try {
      const res = await fetch(`/api/documents/${documentId}/upload`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: err?.error?.message || '파일 삭제에 실패했습니다', variant: 'error' });
        return;
      }
      setFilePath('');
      setFileName('');
      setFileSize(0);
      setFileType('');
      setPreviewUrl(null);
      toast({ title: '파일이 삭제되었습니다', variant: 'success' });
    } catch {
      toast({ title: '파일 삭제 중 오류가 발생했습니다', variant: 'error' });
    }
  }, [documentId, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
    e.target.value = '';
  }, [handleFileUpload]);

  // ── Save / Submit ──
  function handleSave() {
    onSave?.(buildContent());
  }

  async function handleSubmit() {
    if (!filePath) {
      toast({ title: '계약서 파일을 먼저 업로드해주세요', variant: 'warning' });
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      onSubmit?.(buildContent());
    } finally {
      setSubmitting(false);
    }
  }

  // ── Drawer toggle ──
  function toggleDrawer(section: DrawerSection) {
    setOpenDrawer((prev) => (prev === section ? null : section));
  }

  const totalAmount = paymentType === 'per_invoice' ? monthlyAmount : monthlyAmount * contractMonths;

  // ═══ RENDER ═══
  return (
    <div className={s.editorRoot}>
      {/* ═══ Side Panel ═══ */}
      <aside className={s.sidePanel} style={{ width: panelWidth }}>
        {/* 헤더 */}
        <div className={s.panelHeader}>
          <div className={s.panelInfoRow}>
            <span className={s.panelInfoLabel}>총 계약금액</span>
            <span className={s.panelInfoValue}>{fmtKRW(totalAmount)}</span>
          </div>
          {readOnly ? (
            <div className={s.panelActions}>
              {documentStatus === 'in_review' && onRedraft && (
                <ActionButton
                  label="계약서 재작성"
                  variant="ghost"
                  size="sm"
                  onClick={onRedraft}
                  icon={<LuRotateCcw size={13} />}
                />
              )}
              {filePath && (
                <ActionButton
                  label="파일 다운로드"
                  variant="ghost-filled"
                  size="sm"
                  onClick={() => previewUrl && window.open(previewUrl, '_blank')}
                  icon={<LuDownload size={13} />}
                />
              )}
            </div>
          ) : (
            <div className={s.panelActions}>
              {onSave && (
                <ActionButton label="저장" variant="primary" size="sm" onClick={handleSave} />
              )}
              {onSubmit && (
                <ActionButton
                  label={submitting ? '제출 중...' : '계약서 제출'}
                  variant="primary"
                  size="sm"
                  onClick={handleSubmit}
                  disabled={submitting || !filePath}
                  icon={<LuSend size={13} />}
                />
              )}
            </div>
          )}
        </div>

        {/* 섹션 목록 */}
        <div className={s.panelSections}>
          {/* ── 계약 정보 ── */}
          <div className={s.section}>
            <button type="button" className={s.sectionToggle} onClick={() => toggleDrawer('info')}>
              <span className={s.sectionIcon}><LuSettings2 size={14} /></span>
              <span className={s.sectionLabel}>계약 정보</span>
              <LuChevronUp size={14} className={`${s.sectionChevron} ${openDrawer === 'info' ? s.chevronOpen : ''}`} />
            </button>
            {openDrawer === 'info' && (
              <div className={s.sectionBody}>
                <table className={s.formTable}>
                  <tbody>
                    <tr>
                      <th>계약 당사자</th>
                      <td>
                        <input type="text" value={parties} onChange={(e) => setParties(e.target.value)} className="form-input" placeholder="갑: OOO / 을: 킹콩애드" readOnly={readOnly} />
                      </td>
                    </tr>
                    <tr>
                      <th>계약일</th>
                      <td>
                        <input type="date" value={contractDate} onChange={(e) => setContractDate(e.target.value)} className="form-input" readOnly={readOnly} />
                      </td>
                    </tr>
                    <tr>
                      <th>시작일</th>
                      <td>
                        <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className="form-input" readOnly={readOnly} />
                      </td>
                    </tr>
                    <tr>
                      <th>종료일</th>
                      <td>
                        <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="form-input" readOnly={readOnly} />
                      </td>
                    </tr>
                    <tr>
                      <th>결제 방식</th>
                      <td>
                        <select value={paymentType} onChange={(e) => setPaymentType(e.target.value)} className="form-input" disabled={readOnly}>
                          {PAYMENT_TYPES.map((pt) => (
                            <option key={pt} value={pt}>{PAYMENT_TYPE_META[pt].label}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                    {(paymentType === 'monthly' || paymentType === 'deposit') && (
                      <>
                        <tr>
                          <th>월 금액</th>
                          <td>
                            <div className={s.inputWithUnit}>
                              <input type="number" value={monthlyAmount || ''} onChange={(e) => setMonthlyAmount(Number(e.target.value))} className="form-input" readOnly={readOnly} />
                              <span className={s.inputUnit}>원/월</span>
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <th>{paymentType === 'deposit' ? '선수금 기간' : '계약 기간'}</th>
                          <td>
                            <div className={s.inputWithUnit}>
                              <input type="number" min={1} value={contractMonths} onChange={(e) => setContractMonths(Number(e.target.value) || 1)} className="form-input" readOnly={readOnly} />
                              <span className={s.inputUnit}>개월</span>
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <th>총 금액</th>
                          <td>
                            <input type="text" value={fmtKRW(totalAmount)} className="form-input" readOnly style={{ fontWeight: 700 }} />
                          </td>
                        </tr>
                      </>
                    )}
                    {paymentType === 'per_invoice' && (
                      <tr>
                        <th>결제 금액</th>
                        <td>
                          <div className={s.inputWithUnit}>
                            <input type="number" value={monthlyAmount || ''} onChange={(e) => setMonthlyAmount(Number(e.target.value))} className="form-input" readOnly={readOnly} />
                            <span className={s.inputUnit}>원</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── 비고 ── */}
          <div className={s.section}>
            <button type="button" className={s.sectionToggle} onClick={() => toggleDrawer('notes')}>
              <span className={s.sectionIcon}><LuStickyNote size={14} /></span>
              <span className={s.sectionLabel}>비고</span>
              <LuChevronUp size={14} className={`${s.sectionChevron} ${openDrawer === 'notes' ? s.chevronOpen : ''}`} />
            </button>
            {openDrawer === 'notes' && (
              <div className={s.sectionBody}>
                <textarea
                  className="form-input"
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="특약사항, 메모 등..."
                  readOnly={readOnly}
                  style={{ fontSize: 12, resize: 'vertical', width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--color-border)' }}
                />
              </div>
            )}
          </div>

          {/* ── 승인 현황 ── */}
          {documentId && documentStatus && documentStatus !== 'draft' && (
            <div className={s.section}>
              <ApprovalPanel
                documentId={documentId}
                documentStatus={documentStatus}
                onStatusChange={onStatusChange}
              />
            </div>
          )}

          {/* ── 승인 이력 ── */}
          {documentId && documentStatus && (
            <div className={s.section}>
              <ApprovalHistoryPanel
                documentId={documentId}
                documentStatus={documentStatus}
                onRevert={() => onStatusChange?.('in_review')}
              />
            </div>
          )}
        </div>
      </aside>

      {/* ═══ Resize Handle ═══ */}
      <div className={s.resizeHandle} onMouseDown={onResizeStart} />

      {/* ═══ Preview Area ═══ */}
      <div className={s.previewScroll}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.hwp"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />

        {uploading ? (
          <div className={s.uploading}>
            <div className={s.uploadingSpinner} />
            <span>파일 업로드 중...</span>
          </div>
        ) : !filePath ? (
          /* ── Upload Zone ── */
          <div
            className={`${s.uploadZone} ${dragOver ? s.uploadZoneDragOver : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !readOnly && fileInputRef.current?.click()}
          >
            <div className={s.uploadIcon}>
              <LuUpload size={40} />
            </div>
            <div className={s.uploadTitle}>계약서 파일을 업로드하세요</div>
            <div className={s.uploadDesc}>
              PDF, 이미지, Word, HWP 파일을 지원합니다 (최대 50MB)
            </div>
            {!readOnly && (
              <button type="button" className={s.uploadBtn} onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                <LuUpload size={14} /> 파일 선택
              </button>
            )}
          </div>
        ) : (
          /* ── File Card + Preview ── */
          <div className={s.fileCard}>
            <div className={s.fileCardHeader}>
              <div className={s.fileIcon}>
                <LuFileText size={20} />
              </div>
              <div className={s.fileInfo}>
                <div className={s.fileName}>{fileName}</div>
                <div className={s.fileMeta}>
                  {getFileTypeLabel(fileType)} · {fmtFileSize(fileSize)}
                </div>
              </div>
              <div className={s.fileActions}>
                {previewUrl && (
                  <button
                    type="button"
                    className={s.fileActionBtn}
                    title="새 탭에서 열기"
                    onClick={() => window.open(previewUrl, '_blank')}
                  >
                    <LuExternalLink size={14} />
                  </button>
                )}
                {!readOnly && (
                  <>
                    <button
                      type="button"
                      className={s.fileActionBtn}
                      title="파일 교체"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <LuUpload size={14} />
                    </button>
                    <button
                      type="button"
                      className={`${s.fileActionBtn} ${s.fileActionBtnDanger}`}
                      title="파일 삭제"
                      onClick={handleFileDelete}
                    >
                      <LuTrash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className={s.filePreviewArea}>
              {previewUrl && fileType.includes('pdf') ? (
                <iframe src={previewUrl} title="계약서 미리보기" />
              ) : previewUrl && fileType.includes('image') ? (
                <img src={previewUrl} alt={fileName} />
              ) : (
                <div className={s.filePreviewPlaceholder}>
                  <LuFileText size={48} />
                  <span>미리보기를 지원하지 않는 파일 형식입니다</span>
                  {previewUrl && (
                    <ActionButton
                      label="파일 열기"
                      variant="ghost-filled"
                      size="sm"
                      onClick={() => window.open(previewUrl, '_blank')}
                      icon={<LuExternalLink size={13} />}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
