'use client';

/**
 * CampaignPlanEditor — 캠페인 진행안(사전보고서) 작성/수정
 *
 * 견적서 에디터와 동일한 사이드패널 + A4 미리보기 구조.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { LuPlus, LuTrash2, LuChevronUp, LuChevronDown, LuSettings2, LuListOrdered, LuBookOpen, LuGripVertical, LuX, LuSend, LuRotateCcw, LuDownload, LuLayers } from 'react-icons/lu';
import { ActionButton, useFeedback } from '@/components/ui';
import type { PreReportContent } from '@/lib/domain/types';
import { CampaignPlanPreview } from './campaign-plan-preview';
import { ApprovalPanel, ApprovalHistoryPanel } from '../estimates/approval-panel';
import s from '../estimates/estimate-editor.module.css';

// ── Types ────────────────────────────────────────────────

interface ServiceField {
  label: string;
  value: string;
}

interface ServiceItem {
  icon: string;
  name: string;
  fields: ServiceField[];
  subtotal: number;
}

export interface CampaignPlanEditorProps {
  mode: 'new' | 'edit';
  initialData?: PreReportContent;
  documentId?: string;
  readOnly?: boolean;
  documentStatus?: string;
  defaultClientName?: string;
  defaultProjectName?: string;
  onSave?: (data: PreReportContent) => void;
  onSubmit?: (data: PreReportContent) => void;
  onRedraft?: () => void;
  onStatusChange?: (newStatus: string) => void;
  onCancel?: () => void;
}

// ── Helpers ──────────────────────────────────────────────

function generateDocNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
  return `KKA-CP-${y}-${m}${d}-${seq}`;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtKRW(n: number) {
  return new Intl.NumberFormat('ko-KR').format(n) + ' 원';
}

// ── Service Icon Catalog ─────────────────────────────────

const SERVICE_ICONS: { id: string; label: string; emoji: string }[] = [
  { id: 'shopping_reward', label: '쇼핑 리워드', emoji: '🛒' },
  { id: 'cafe_viral', label: '맘카페 바이럴', emoji: '💬' },
  { id: 'blog_viral', label: '블로그 바이럴', emoji: '📝' },
  { id: 'sns', label: 'SNS 운영', emoji: '📱' },
  { id: 'sa_ad', label: 'SA 광고', emoji: '🔍' },
  { id: 'meta_ad', label: 'Meta 광고', emoji: '📣' },
  { id: 'google_ad', label: 'Google 광고', emoji: '🌐' },
  { id: 'design', label: '디자인', emoji: '🎨' },
  { id: 'video', label: '영상 제작', emoji: '🎬' },
  { id: 'other', label: '기타', emoji: '📋' },
];

function getServiceEmoji(iconId: string): string {
  return SERVICE_ICONS.find((i) => i.id === iconId)?.emoji ?? '📋';
}

const DEFAULT_COMPANY = '킹콩애드 주식회사';

// ── IconPicker (collapsible) ─────────────────────────────

function IconPicker({ value, readOnly, onChange }: { value: string; readOnly?: boolean; onChange: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`${s.iconPicker} ${expanded ? s.iconPickerExpanded : ''}`}>
      <div className={s.iconPickerRow}>
        {SERVICE_ICONS.map((ic) => (
          <button
            key={ic.id}
            type="button"
            className={`${s.iconBtn} ${value === ic.id ? s.iconBtnActive : ''}`}
            onClick={() => !readOnly && onChange(ic.id)}
          >{ic.emoji}</button>
        ))}
      </div>
      <button type="button" className={s.iconExpandBtn} onClick={() => setExpanded((v) => !v)}>
        <LuChevronUp size={12} className={`${s.sectionChevron} ${expanded ? s.chevronOpen : ''}`} />
      </button>
    </div>
  );
}

// ── Service Catalog (집행 진행안용) ──────────────────────

interface CampaignCatalogItem {
  id: string;
  group: string;
  icon: string;
  name: string;
  fields: ServiceField[];
  subtotal: number;
}

// Hardcoded fallback removed — catalog loaded from DB via API

// ── CatalogCard ──────────────────────────────────────────

function CatalogCard({ item, onAdd, onDragStart }: {
  item: CampaignCatalogItem;
  onAdd: (item: CampaignCatalogItem) => void;
  onDragStart: (e: React.DragEvent, item: CampaignCatalogItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const icon = SERVICE_ICONS.find((i) => i.id === item.icon);

  return (
    <div className={s.catalogCard} draggable={!expanded} onDragStart={(e) => { if (!expanded) onDragStart(e, item); }}>
      <div className={s.catalogCardHeader} onClick={() => setExpanded(!expanded)}>
        <span className={s.catalogDragHandle}><LuGripVertical size={12} /></span>
        <div className={s.catalogCardInfo}>
          <span className={s.catalogCardName}>{icon?.emoji} {item.name}</span>
          <span className={s.catalogCardPrice}>{fmtKRW(item.subtotal)}</span>
        </div>
        <LuChevronUp size={12} className={`${s.sectionChevron} ${expanded ? s.chevronOpen : ''}`} />
      </div>
      {expanded && (
        <div className={s.catalogCardBody}>
          <div className={s.catalogDetails}>
            {item.fields.map((f, fi) => (
              <div key={fi} className={s.catalogDetailItem}>
                <span className={s.catalogDetailTitle}>{f.label}</span>
                <span className={s.catalogDetailDesc}>{f.value}</span>
              </div>
            ))}
          </div>
          <button type="button" className={s.catalogAddBtn} onClick={() => { onAdd(item); setExpanded(false); }}>
            <LuPlus size={12} /> 진행안에 추가
          </button>
        </div>
      )}
    </div>
  );
}

// ── Drawer sections ──────────────────────────────────────

type DrawerSection = 'info' | 'services' | null;

const PANEL_STORAGE_KEY = 'kka-campaign-plan-panel-width';
const PANEL_MIN = 280;
const PANEL_MAX = 560;
const PANEL_DEFAULT = 340;

// ── Component ────────────────────────────────────────────

export function CampaignPlanEditor({
  mode, initialData, documentId, readOnly, documentStatus,
  defaultClientName, defaultProjectName,
  onSave, onSubmit, onRedraft, onStatusChange, onCancel,
}: CampaignPlanEditorProps) {
  const { toast } = useFeedback();
  const previewRef = useRef<HTMLDivElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [openDrawer, setOpenDrawer] = useState<DrawerSection>(mode === 'new' ? 'info' : null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [dragOverServices, setDragOverServices] = useState(false);
  const [campaignCatalog, setCampaignCatalog] = useState<CampaignCatalogItem[]>([]);

  // Fetch catalog from DB
  useEffect(() => {
    fetch('/api/settings/catalogs?type=execution')
      .then((r) => r.ok ? r.json() : [])
      .then((data: any[]) => {
        setCampaignCatalog(data.map((item: any) => ({
          id: item.id,
          group: item.group_name,
          icon: item.content?.icon ?? 'other',
          name: item.name,
          fields: (item.content?.fields ?? []).map((f: any) => ({ label: f.label ?? '', value: f.value ?? '' })),
          subtotal: item.base_price ?? 0,
        })));
      })
      .catch(() => {});
  }, []);

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

  // ── Basic info ──
  const [docNumber, setDocNumber] = useState(initialData?.document_number || generateDocNumber());
  const [issuedDate, setIssuedDate] = useState(initialData?.issued_date || todayISO());
  const [recipient, setRecipient] = useState(initialData?.recipient || defaultClientName || '');
  const [projectName, setProjectName] = useState(initialData?.project_name || defaultProjectName || '');
  const [executionMonths, setExecutionMonths] = useState(initialData?.execution_months ?? 1);
  const [executionPeriodUnit, setExecutionPeriodUnit] = useState<'month' | 'week'>(initialData?.execution_period_unit ?? 'month');
  const [executionNote, setExecutionNote] = useState(initialData?.execution_note || '');
  const [companyName] = useState(initialData?.company_name || DEFAULT_COMPANY);
  const [vatNote] = useState(initialData?.vat_note || 'VAT 별도');

  // ── Services ──
  const [services, setServices] = useState<ServiceItem[]>(() => {
    if (initialData?.services && initialData.services.length > 0) {
      return initialData.services.map((svc) => ({
        icon: svc.icon || 'other',
        name: svc.name || '',
        fields: (svc.fields ?? []).map((f) => ({ label: f.label, value: f.value })),
        subtotal: svc.subtotal ?? 0,
      }));
    }
    return [];
  });

  // ── Service CRUD ──

  const addService = useCallback(() => {
    setServices((prev) => [...prev, { icon: 'other', name: '', fields: [{ label: '', value: '' }], subtotal: 0 }]);
  }, []);

  const addFromCatalog = useCallback((catalogItem: CampaignCatalogItem) => {
    setServices((prev) => [
      ...prev,
      {
        icon: catalogItem.icon,
        name: catalogItem.name,
        fields: catalogItem.fields.map((f) => ({ ...f })),
        subtotal: catalogItem.subtotal,
      },
    ]);
    setOpenDrawer('services');
  }, []);

  const handleCatalogDragStart = useCallback((e: React.DragEvent, item: CampaignCatalogItem) => {
    e.dataTransfer.setData('application/x-campaign-catalog-id', item.id);
    e.dataTransfer.effectAllowed = 'copy';
    setOpenDrawer('services');
  }, []);

  const handleServicesDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-campaign-catalog-id')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setDragOverServices(true);
    }
  }, []);

  const handleServicesDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOverServices(false);
    const catalogId = e.dataTransfer.getData('application/x-campaign-catalog-id');
    if (!catalogId) return;
    const found = campaignCatalog.find((c) => c.id === catalogId);
    if (found) addFromCatalog(found);
  }, [addFromCatalog, campaignCatalog]);

  const removeService = useCallback((idx: number) => {
    setServices((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const moveService = useCallback((idx: number, direction: 'up' | 'down') => {
    setServices((prev) => {
      const target = direction === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }, []);

  const updateService = useCallback((idx: number, field: keyof ServiceItem, value: unknown) => {
    setServices((prev) => prev.map((svc, i) => (i === idx ? { ...svc, [field]: value } : svc)));
  }, []);

  // ── Field CRUD ──

  const addField = useCallback((svcIdx: number) => {
    setServices((prev) =>
      prev.map((svc, i) =>
        i === svcIdx ? { ...svc, fields: [...svc.fields, { label: '', value: '' }] } : svc,
      ),
    );
  }, []);

  const removeField = useCallback((svcIdx: number, fieldIdx: number) => {
    setServices((prev) =>
      prev.map((svc, i) =>
        i === svcIdx ? { ...svc, fields: svc.fields.filter((_, fi) => fi !== fieldIdx) } : svc,
      ),
    );
  }, []);

  const updateField = useCallback((svcIdx: number, fieldIdx: number, key: 'label' | 'value', val: string) => {
    setServices((prev) =>
      prev.map((svc, i) =>
        i === svcIdx
          ? { ...svc, fields: svc.fields.map((f, fi) => (fi === fieldIdx ? { ...f, [key]: val } : f)) }
          : svc,
      ),
    );
  }, []);

  // ── Computed ──

  const totalMonthly = services.reduce((sum, svc) => sum + (svc.subtotal || 0), 0);

  // ── Build preview data ──

  const previewData: PreReportContent = {
    document_number: docNumber,
    recipient,
    project_name: projectName,
    issued_date: issuedDate,
    execution_months: executionMonths,
    execution_period_unit: executionPeriodUnit,
    execution_note: executionNote,
    services: services.map((svc) => ({
      icon: svc.icon,
      name: svc.name,
      fields: svc.fields.filter((f) => f.label || f.value),
      subtotal: svc.subtotal,
    })),
    total_monthly: totalMonthly,
    company_name: companyName,
    vat_note: vatNote,
  };

  // ── Submit ──

  function handleSave() {
    if (!recipient) { toast({ title: '고객사명을 입력하세요', variant: 'warning' }); return; }
    onSave?.(previewData);
  }

  async function handleSubmit() {
    if (!recipient) { toast({ title: '고객사명을 입력하세요', variant: 'warning' }); return; }
    if (submitting) return;
    setSubmitting(true);
    try {
      onSubmit?.(previewData);
    } finally {
      setSubmitting(false);
    }
  }

  function handlePrint() {
    const el = previewRef.current;
    if (!el) { toast({ title: '미리보기를 불러올 수 없습니다', variant: 'error' }); return; }

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) { toast({ title: '팝업이 차단되었습니다', variant: 'warning' }); return; }

    const styleSheets = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((el) => el.outerHTML).join('\n');

    printWindow.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>캠페인 진행안</title>${styleSheets}
<style>
  @page { size: A4; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body > div { display: flex; flex-direction: column; }
  [class*="a4PageOuter"] { width: 794px !important; height: 1123px !important; overflow: hidden; border-radius: 0; break-after: page; page-break-after: always; }
  [class*="a4Page"] { transform: none !important; box-shadow: none !important; width: 794px !important; height: 1123px !important; }
</style>
</head><body><div>${el.innerHTML}</div>
<script>window.onload=function(){window.print();}<\/script>
</body></html>`);
    printWindow.document.close();
  }

  async function handleDownloadPdf() {
    if (!documentId) return;
    setPdfDownloading(true);
    try {
      let res = await fetch(`/api/documents/${documentId}/pdf`);
      if (!res.ok) res = await fetch(`/api/documents/${documentId}/pdf/generate`, { method: 'POST' });
      if (!res.ok) { toast({ title: 'PDF 다운로드에 실패했습니다', variant: 'error' }); return; }
      const { url } = await res.json();
      window.open(url, '_blank');
    } catch {
      toast({ title: 'PDF 다운로드 중 오류가 발생했습니다', variant: 'error' });
    } finally {
      setPdfDownloading(false);
    }
  }

  function toggleDrawer(section: DrawerSection) {
    setOpenDrawer((prev) => (prev === section ? null : section));
  }

  // =============== RENDER ===============

  return (
    <div className={s.editorRoot}>
      {/* ═══ Side Panel ═══ */}
      <aside className={s.sidePanel} style={{ width: panelWidth }}>
        <div className={s.panelHeader}>
          <div className={s.panelAmountRow}>
            <span className={s.panelAmountLabel}>총 집행 금액</span>
            <span className={s.panelAmountValue}>{fmtKRW(totalMonthly)}</span>
          </div>
          {readOnly ? (
            <div className={s.panelActions}>
              {documentStatus === 'in_review' && onRedraft && (
                <ActionButton label="재작성" variant="ghost" size="sm" onClick={onRedraft} icon={<LuRotateCcw size={13} />} />
              )}
              <ActionButton
                label={pdfDownloading ? 'PDF 생성 중...' : '다운로드'}
                variant="ghost-filled" size="sm"
                onClick={handleDownloadPdf} disabled={pdfDownloading}
                icon={<LuDownload size={13} />}
              />
            </div>
          ) : (
            <div className={s.panelActions}>
              {(mode === 'new' || onSave) && (
                <ActionButton label={mode === 'new' ? '저장' : '수정 저장'} variant="primary" size="sm" onClick={handleSave} />
              )}
              {mode === 'edit' && onSubmit && (
                <ActionButton
                  label={submitting ? '제출 중...' : '진행안 제출'}
                  variant="primary" size="sm"
                  onClick={handleSubmit} disabled={submitting}
                  icon={<LuSend size={13} />}
                />
              )}
            </div>
          )}
        </div>

        {/* 섹션 목록 */}
        <div className={s.panelSections}>
          {/* ── 기본 정보 ── */}
          <div className={s.section}>
            <button type="button" className={s.sectionToggle} onClick={() => toggleDrawer('info')}>
              <span className={s.sectionIcon}><LuSettings2 size={14} /></span>
              <span className={s.sectionLabel}>기본 정보</span>
              <LuChevronUp size={14} className={`${s.sectionChevron} ${openDrawer === 'info' ? s.chevronOpen : ''}`} />
            </button>
            {openDrawer === 'info' && (
              <div className={s.sectionBody}>
                <table className={s.formTable}>
                  <tbody>
                    <tr>
                      <th>고객사명 *</th>
                      <td><input type="text" value={recipient} onChange={(e) => setRecipient(e.target.value)} className="form-input" readOnly={readOnly} /></td>
                    </tr>
                    <tr>
                      <th>프로젝트명</th>
                      <td><input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} className="form-input" readOnly={readOnly} /></td>
                    </tr>
                    <tr>
                      <th>문서번호</th>
                      <td><input type="text" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} className="form-input" readOnly={readOnly} /></td>
                    </tr>
                    <tr>
                      <th>작성일자</th>
                      <td><input type="date" value={issuedDate} onChange={(e) => setIssuedDate(e.target.value)} className="form-input" readOnly={readOnly} /></td>
                    </tr>
                    <tr>
                      <th>집행 기간</th>
                      <td>
                        <div className={s.inputWithUnit}>
                          <input type="number" min={1} value={executionMonths} onChange={(e) => setExecutionMonths(Number(e.target.value) || 1)} className="form-input" readOnly={readOnly} />
                          <select value={executionPeriodUnit} onChange={(e) => setExecutionPeriodUnit(e.target.value as 'month' | 'week')} className="form-input" disabled={readOnly} style={{ width: 60, flex: 'none' }}>
                            <option value="month">월</option>
                            <option value="week">주</option>
                          </select>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <th>기간 비고</th>
                      <td><input type="text" value={executionNote} onChange={(e) => setExecutionNote(e.target.value)} className="form-input" placeholder="예: 계약 완료" readOnly={readOnly} /></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── 서비스 구성 ── */}
          <div className={s.section}>
            <div className={s.sectionHeader}>
              <button type="button" className={s.sectionToggle} onClick={() => toggleDrawer('services')}>
                <span className={s.sectionIcon}><LuListOrdered size={14} /></span>
                <span className={s.sectionLabel}>서비스 구성</span>
                <LuChevronUp size={14} className={`${s.sectionChevron} ${openDrawer === 'services' ? s.chevronOpen : ''}`} />
              </button>
              {!readOnly && (
                <button
                  type="button"
                  className={`${s.catalogToggleBtn} ${catalogOpen ? s.catalogToggleBtnActive : ''}`}
                  onClick={() => setCatalogOpen((v) => !v)}
                  title="서비스 카탈로그"
                >
                  <LuBookOpen size={13} />
                </button>
              )}
            </div>
            {openDrawer === 'services' && (
              <div
                className={`${s.sectionBody} ${dragOverServices ? s.sectionDropTarget : ''}`}
                onDragOver={handleServicesDragOver}
                onDragLeave={() => setDragOverServices(false)}
                onDrop={handleServicesDrop}
              >
                {dragOverServices && (
                  <div className={s.dropIndicator}>
                    <LuPlus size={14} /> 여기에 놓아서 서비스 추가
                  </div>
                )}
                {services.map((svc, svcIdx) => (
                  <div key={svcIdx} className={s.itemCard}>
                    <div className={s.itemHeader}>
                      <span className={s.itemHeaderLeft}>
                        <span className={s.itemNo}>{svcIdx + 1}</span>
                        {!readOnly && services.length > 1 && (
                          <span className={s.reorderBtns}>
                            <button type="button" className={s.reorderBtn} onClick={() => moveService(svcIdx, 'up')} disabled={svcIdx === 0} title="위로 이동">
                              <LuChevronUp size={13} />
                            </button>
                            <button type="button" className={s.reorderBtn} onClick={() => moveService(svcIdx, 'down')} disabled={svcIdx === services.length - 1} title="아래로 이동">
                              <LuChevronDown size={13} />
                            </button>
                          </span>
                        )}
                      </span>
                      {!readOnly && (
                        <button type="button" className={s.removeBtn} onClick={() => removeService(svcIdx)} title="서비스 삭제">
                          <LuTrash2 size={12} />
                        </button>
                      )}
                    </div>

                    <table className={s.formTable}>
                      <tbody>
                        <tr>
                          <th style={{ verticalAlign: 'top', paddingTop: 7 }}>아이콘</th>
                          <td>
                            <IconPicker
                              value={svc.icon}
                              readOnly={readOnly}
                              onChange={(id) => updateService(svcIdx, 'icon', id)}
                            />
                          </td>
                        </tr>
                        <tr>
                          <th>서비스명 *</th>
                          <td><input type="text" value={svc.name} onChange={(e) => updateService(svcIdx, 'name', e.target.value)} className="form-input" readOnly={readOnly} /></td>
                        </tr>
                        <tr>
                          <th>소계</th>
                          <td>
                            <div className={s.inputWithUnit}>
                              <input type="number" value={svc.subtotal || ''} onChange={(e) => updateService(svcIdx, 'subtotal', Number(e.target.value))} className="form-input" readOnly={readOnly} />
                              <span className={s.inputUnit}>원</span>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* 상세 필드 */}
                    <div className={s.subSectionArea}>
                      <div className={s.subSectionTitle}>
                        <LuLayers size={10} /> 상세
                      </div>
                      <div className={s.detailSection}>
                        <table className={s.formTable}>
                          <tbody>
                            {svc.fields.map((field, fIdx) => (
                              <tr key={fIdx}>
                                <th>{fIdx === 0 ? '필드' : ''}</th>
                                <td>
                                  <div className={s.descriptionRow}>
                                    <input type="text" value={field.label} onChange={(e) => updateField(svcIdx, fIdx, 'label', e.target.value)} className="form-input" style={{ flex: 1 }} placeholder="필드명" readOnly={readOnly} />
                                    <input type="text" value={field.value} onChange={(e) => updateField(svcIdx, fIdx, 'value', e.target.value)} className="form-input" style={{ flex: 1 }} placeholder="값" readOnly={readOnly} />
                                    {!readOnly && svc.fields.length > 1 && (
                                      <button type="button" className={s.smallBtn} onClick={() => removeField(svcIdx, fIdx)}>×</button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                            {!readOnly && (
                              <tr>
                                <th></th>
                                <td>
                                  <button type="button" className={s.addDescInlineBtn} onClick={() => addField(svcIdx)}>
                                    <LuPlus size={10} />
                                  </button>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ))}
                {!readOnly && (
                  <button type="button" className={s.addItemBtn} onClick={addService}>
                    <LuPlus size={14} /> 서비스 추가
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── 승인 현황 ── */}
          {documentId && documentStatus && documentStatus !== 'draft' && (
            <div className={s.section}>
              <ApprovalPanel documentId={documentId} documentStatus={documentStatus} onStatusChange={onStatusChange} />
            </div>
          )}

          {/* ── 승인 이력 ── */}
          {documentId && documentStatus && documentStatus !== 'draft' && (
            <div className={s.section}>
              <ApprovalHistoryPanel documentId={documentId} documentStatus={documentStatus} onRevert={() => onStatusChange?.('in_review')} />
            </div>
          )}
        </div>
      </aside>

      {/* ═══ Resize Handle ═══ */}
      <div className={s.resizeHandle} onMouseDown={onResizeStart} />

      {/* ═══ Preview ═══ */}
      <div className={s.previewScroll} ref={previewRef}>
        <CampaignPlanPreview data={previewData} />
      </div>

      {/* ═══ Service Catalog Flyout ═══ */}
      {!readOnly && catalogOpen && (
        <div className={s.catalogFlyout} style={{ left: panelWidth + 5 }}>
          <div className={s.catalogFlyoutHeader}>
            <LuBookOpen size={14} />
            <span className={s.catalogFlyoutTitle}>서비스 카탈로그</span>
            <button type="button" className={s.catalogFlyoutClose} onClick={() => setCatalogOpen(false)}>
              <LuX size={14} />
            </button>
          </div>
          <p className={s.catalogFlyoutHint}>드래그하여 서비스 구성에 추가하세요</p>
          <div className={s.catalogFlyoutBody}>
            {Array.from(new Set(campaignCatalog.map((c) => c.group))).map((group) => (
              <div key={group} className={s.catalogGroup}>
                <span className={s.catalogGroupLabel}>{group}</span>
                {campaignCatalog.filter((c) => c.group === group).map((ci) => (
                  <CatalogCard key={ci.id} item={ci} onAdd={addFromCatalog} onDragStart={handleCatalogDragStart} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
