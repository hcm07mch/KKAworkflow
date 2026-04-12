'use client';

/**
 * EstimateEditor — 견적서 작성/수정
 *
 * 좌측 사이드 패널(아코디언 섹션) + 우측 미리보기(A4 상 표시) 구조.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { LuPlus, LuTrash2, LuChevronUp, LuSettings2, LuFileText, LuListOrdered, LuBookOpen, LuGripVertical, LuX, LuSend, LuRotateCcw, LuDownload } from 'react-icons/lu';
import { ActionButton, useFeedback } from '@/components/ui';
import type { EstimateContent } from '@/lib/domain/types';
import { PAYMENT_TYPE_META, PAYMENT_TYPES } from '@/lib/domain/types';
import { EstimatePreview } from './estimate-preview';
import { ApprovalPanel, ApprovalHistoryPanel } from './approval-panel';
import s from './estimate-editor.module.css';

// ── Types ────────────────────────────────────────────────

interface EstimateDetail {
  title: string;
  descriptions: string[];
}

interface EstimateItemData {
  no: number;
  category: string;
  details: EstimateDetail[];
  unit_price: number;
  note: string;
  options: Array<{ name: string; price: number }>;
}

export interface EstimateEditorProps {
  mode: 'new' | 'edit';
  initialData?: EstimateContent;
  documentId?: string;
  defaultClientId?: string;
  readOnly?: boolean;
  documentStatus?: string;
  onSave?: (data: EstimateContent) => void;
  onSubmit?: (data: EstimateContent) => void;
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
  return `KKA-${y}-${m}${d}-${seq}`;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtKRW(n: number) {
  return new Intl.NumberFormat('ko-KR').format(n) + ' 원';
}

// ── Client type ──────────────────────────────────────────

interface ClientOption {
  id: string;
  name: string;
}

const DEFAULT_NOTES = [
  '본 견적서의 유효기간은 발행일로부터 14일입니다.',
  '상기 금액은 부가세(VAT) 별도 금액이며, 세금계산서 발행 가능합니다.',
  '광고 매체비(충전금)는 별도이며, 광고주가 직접 충전합니다.',
];

const DEFAULT_COMPANY = {
  name: '킹콩애드 주식회사',
  address: '경기도 화성시 동탄기흥로 594-7, 1214호',
  representative: '김연수',
};

// ── Service Catalog ──────────────────────────────────────

interface CatalogOption {
  name: string;
  price: number;
}

interface ServiceCatalogItem {
  id: string;
  group: string;
  category: string;
  details: EstimateDetail[];
  base_price: number;
  note: string;
  options: CatalogOption[];
}

const SERVICE_CATALOG: ServiceCatalogItem[] = [
  {
    id: 'sa-naver',
    group: '퍼포먼스 광고',
    category: '네이버 SA 광고',
    details: [
      { title: '네이버 검색광고 세팅 및 운영 관리', descriptions: ['키워드 발굴 & 그룹 세팅', '입찰가 최적화 & A/B 소재 관리', '주간 성과 리포트 제공'] },
    ],
    base_price: 500000,
    note: '월 정기결제',
    options: [
      { name: '브랜드 검색 광고 세팅', price: 200000 },
      { name: '쇼핑 검색 광고 추가', price: 300000 },
    ],
  },
  {
    id: 'meta-ad',
    group: '퍼포먼스 광고',
    category: 'Meta 광고 운영',
    details: [
      { title: 'Meta(Facebook/Instagram) 광고 운영', descriptions: ['타겟 오디언스 설계', '크리에이티브 소재 제작 & 테스트', '전환 최적화 & 리타겟팅'] },
    ],
    base_price: 600000,
    note: '월 정기결제',
    options: [
      { name: '리스/릴스 소재 제작 (월 4건)', price: 400000 },
    ],
  },
  {
    id: 'google-ad',
    group: '퍼포먼스 광고',
    category: 'Google Ads 운영',
    details: [
      { title: 'Google 검색 및 디스플레이 광고 운영', descriptions: ['캠페인 구조 설계 및 키워드 리서치', 'GDN 배너 & 반응형 광고 관리', '전환 추적 세팅 & 성과 분석'] },
    ],
    base_price: 500000,
    note: '월 정기결제',
    options: [
      { name: 'YouTube 영상 광고 추가', price: 300000 },
    ],
  },
  {
    id: 'viral-blog',
    group: '바이럴 마케팅',
    category: '블로그 바이럴',
    details: [
      { title: '네이버 블로그 체험단 / 기자단 운영', descriptions: ['인플루언서 섭외 & 가이드라인 제공', '콘텐츠 품질 검수 & 발행 관리', '월 10건 기준'] },
    ],
    base_price: 800000,
    note: '월 정기결제',
    options: [
      { name: '추가 10건', price: 500000 },
    ],
  },
  {
    id: 'viral-sns',
    group: '바이럴 마케팅',
    category: 'SNS 콘텐츠 운영',
    details: [
      { title: 'Instagram / TikTok 채널 운영 대행', descriptions: ['콘텐츠 기획 & 제작 (월 12건)', '해시태그 전략 & 커뮤니티 관리', '주간 인사이트 리포트'] },
    ],
    base_price: 1000000,
    note: '월 정기결제',
    options: [
      { name: '숏폼 영상 제작 추가 (월 4건)', price: 600000 },
    ],
  },
  {
    id: 'brand-design',
    group: '브랜딩 / 디자인',
    category: '브랜딩 패키지 디자인',
    details: [
      { title: '브랜딩 아이덴티티 & 마케팅 디자인', descriptions: ['로고 & BI 가이드 제작', '마케팅 디자인 주요 산출물', '배너/상세페이지 템플릿'] },
    ],
    base_price: 2000000,
    note: '1회성',
    options: [
      { name: '상세페이지 제작 추가', price: 500000 },
      { name: '촬영 프로덕션 포함', price: 800000 },
    ],
  },
  {
    id: 'landing-page',
    group: '브랜딩 / 디자인',
    category: '랜딩페이지 제작',
    details: [
      { title: '전환 최적화 랜딩페이지 기획 & 제작', descriptions: ['기획 & 와이어프레임', '반응형 웹 디자인 & 퍼블리싱', 'A/B 테스트용 변형 1종 포함'] },
    ],
    base_price: 1500000,
    note: '1회성',
    options: [
      { name: '추가 변형 페이지', price: 500000 },
    ],
  },
];

// ── Drawer sections ──────────────────────────────────────

type DrawerSection = 'info' | 'items' | 'notes' | null;

const PANEL_STORAGE_KEY = 'kka-estimate-panel-width';
const PANEL_MIN = 280;
const PANEL_MAX = 560;
const PANEL_DEFAULT = 340;

// ── Component ────────────────────────────────────────────

function CatalogCard({ item, onAdd, onDragStart }: {
  item: ServiceCatalogItem;
  onAdd: (item: ServiceCatalogItem, opts: number[]) => void;
  onDragStart: (e: React.DragEvent, item: ServiceCatalogItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [checkedOpts, setCheckedOpts] = useState<number[]>([]);

  const toggleOpt = (idx: number) => {
    setCheckedOpts((prev) => (prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]));
  };

  const handleAdd = () => {
    onAdd(item, checkedOpts);
    setCheckedOpts([]);
    setExpanded(false);
  };

  return (
    <div className={s.catalogCard} draggable={!expanded} onDragStart={(e) => { if (!expanded) onDragStart(e, item); }}>
      <div className={s.catalogCardHeader} onClick={() => setExpanded(!expanded)}>
        <span className={s.catalogDragHandle}><LuGripVertical size={12} /></span>
        <div className={s.catalogCardInfo}>
          <span className={s.catalogCardName}>{item.category}</span>
          <span className={s.catalogCardPrice}>{fmtKRW(item.base_price)}</span>
        </div>
        <LuChevronUp size={12} className={`${s.sectionChevron} ${expanded ? s.chevronOpen : ''}`} />
      </div>
      {expanded && (
        <div className={s.catalogCardBody}>
          <div className={s.catalogDetails}>
            {item.details.map((d, di) => (
              <div key={di} className={s.catalogDetailItem}>
                <span className={s.catalogDetailTitle}>{d.title}</span>
                {d.descriptions.map((desc, dsi) => (
                  <span key={dsi} className={s.catalogDetailDesc}>· {desc}</span>
                ))}
              </div>
            ))}
          </div>
          {item.options.length > 0 && (
            <div className={s.catalogOptions}>
              <span className={s.catalogOptionsLabel}>옵션 선택</span>
              {item.options.map((opt, oi) => (
                <label key={oi} className={s.catalogOptionCheck}>
                  <input type="checkbox" checked={checkedOpts.includes(oi)} onChange={() => toggleOpt(oi)} />
                  <span className={s.catalogOptionName}>{opt.name}</span>
                  <span className={s.catalogOptionPrice}>+{fmtKRW(opt.price)}</span>
                </label>
              ))}
            </div>
          )}
          <button type="button" className={s.catalogAddBtn} onClick={handleAdd}>
            <LuPlus size={12} /> 견적에 추가
          </button>
        </div>
      )}
    </div>
  );
}

export function EstimateEditor({ mode, initialData, documentId, defaultClientId, readOnly, documentStatus, onSave, onSubmit, onRedraft, onStatusChange, onCancel }: EstimateEditorProps) {
  const { toast } = useFeedback();
  const previewRef = useRef<HTMLDivElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [openDrawer, setOpenDrawer] = useState<DrawerSection>(mode === 'new' ? 'info' : null);
  const [clients, setClients] = useState<ClientOption[]>([]);

  // Fetch real clients from API
  useEffect(() => {
    fetch('/api/clients')
      .then((r) => r.ok ? r.json() : [])
      .then((data: any[]) => {
        setClients(data.map((c) => ({ id: c.id, name: c.name })));
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

    const onUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      // persist final width
      const finalW = Math.min(PANEL_MAX, Math.max(PANEL_MIN, dragStartW.current + (lastX - dragStartX.current)));
      try { localStorage.setItem(PANEL_STORAGE_KEY, String(Math.round(finalW))); } catch { /* ignore */ }
    };

    let lastX = e.clientX;
    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      lastX = ev.clientX;
      const newW = Math.min(PANEL_MAX, Math.max(PANEL_MIN, dragStartW.current + (ev.clientX - dragStartX.current)));
      setPanelWidth(newW);
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [panelWidth]);

  // Basic info
  const [docNumber, setDocNumber] = useState(initialData?.document_number || generateDocNumber());
  const [issuedDate, setIssuedDate] = useState(initialData?.issued_date || todayISO());
  const [clientId, setClientId] = useState(() => {
    if (defaultClientId) return defaultClientId;
    if (!initialData?.recipient) return '';
    return '';
  });
  const [recipient, setRecipient] = useState(initialData?.recipient || '');
  const [projectName, setProjectName] = useState(initialData?.project_name || '');

  const [taxRate, setTaxRate] = useState(initialData?.tax_rate ?? 10);
  const [paymentType, setPaymentType] = useState(initialData?.payment_type || 'per_invoice');
  const [paymentMonths, setPaymentMonths] = useState(initialData?.payment_months ?? 1);

  // Items
  const [items, setItems] = useState<EstimateItemData[]>(() => {
    if (initialData?.items && initialData.items.length > 0) {
      return initialData.items.map((item, i) => ({
        no: item.no ?? i + 1,
        category: item.category ?? '',
        details: (item.details ?? []).map((d) => ({
          title: d.title ?? '',
          descriptions: d.descriptions?.length ? d.descriptions : [''],
        })),
        unit_price: item.unit_price ?? 0,
        note: item.note ?? '',
        options: (item.options ?? []).map((o) => ({ name: o.name ?? '', price: o.price ?? 0 })),
      }));
    }
    return [{ no: 1, category: '', details: [{ title: '', descriptions: [''] }], unit_price: 0, note: '월 정기결제', options: [] }];
  });

  // Notes
  const [notes, setNotes] = useState<string[]>(
    initialData?.notes?.length ? [...initialData.notes] : [...DEFAULT_NOTES],
  );

  // Company info
  const [companyName] = useState(initialData?.company_name || DEFAULT_COMPANY.name);
  const [companyAddress] = useState(initialData?.company_address || DEFAULT_COMPANY.address);
  const [companyRep] = useState(initialData?.company_representative || DEFAULT_COMPANY.representative);

  // Auto-fill recipient when client changes
  useEffect(() => {
    const client = clients.find((c) => c.id === clientId);
    if (client) setRecipient(`${client.name} 귀하`);
  }, [clientId, clients]);

  // ── Item CRUD ──

  const addItem = useCallback(() => {
    setItems((prev) => [
      ...prev,
      { no: prev.length + 1, category: '', details: [{ title: '', descriptions: [''] }], unit_price: 0, note: '', options: [] },
    ]);
  }, []);

  const removeItem = useCallback((idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx).map((item, i) => ({ ...item, no: i + 1 })));
  }, []);

  const updateItem = useCallback((idx: number, field: keyof EstimateItemData, value: unknown) => {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  }, []);

  // ── Detail CRUD ──

  const addDetail = useCallback((itemIdx: number) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === itemIdx ? { ...item, details: [...item.details, { title: '', descriptions: [''] }] } : item,
      ),
    );
  }, []);

  const removeDetail = useCallback((itemIdx: number, detailIdx: number) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === itemIdx ? { ...item, details: item.details.filter((_, di) => di !== detailIdx) } : item,
      ),
    );
  }, []);

  const updateDetailTitle = useCallback((itemIdx: number, detailIdx: number, title: string) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === itemIdx
          ? { ...item, details: item.details.map((d, di) => (di === detailIdx ? { ...d, title } : d)) }
          : item,
      ),
    );
  }, []);

  // ── Description CRUD ──

  const addDescription = useCallback((itemIdx: number, detailIdx: number) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === itemIdx
          ? {
              ...item,
              details: item.details.map((d, di) =>
                di === detailIdx ? { ...d, descriptions: [...d.descriptions, ''] } : d,
              ),
            }
          : item,
      ),
    );
  }, []);

  const removeDescription = useCallback((itemIdx: number, detailIdx: number, descIdx: number) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === itemIdx
          ? {
              ...item,
              details: item.details.map((d, di) =>
                di === detailIdx ? { ...d, descriptions: d.descriptions.filter((_, ddi) => ddi !== descIdx) } : d,
              ),
            }
          : item,
      ),
    );
  }, []);

  const updateDescription = useCallback(
    (itemIdx: number, detailIdx: number, descIdx: number, value: string) => {
      setItems((prev) =>
        prev.map((item, i) =>
          i === itemIdx
            ? {
                ...item,
                details: item.details.map((d, di) =>
                  di === detailIdx
                    ? { ...d, descriptions: d.descriptions.map((desc, ddi) => (ddi === descIdx ? value : desc)) }
                    : d,
                ),
              }
            : item,
        ),
      );
    },
    [],
  );

  // ── Option CRUD ──

  const addOption = useCallback((itemIdx: number) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === itemIdx ? { ...item, options: [...item.options, { name: '', price: 0 }] } : item,
      ),
    );
  }, []);

  const removeOption = useCallback((itemIdx: number, optIdx: number) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === itemIdx ? { ...item, options: item.options.filter((_, oi) => oi !== optIdx) } : item,
      ),
    );
  }, []);

  const updateOption = useCallback((itemIdx: number, optIdx: number, field: 'name' | 'price', value: string | number) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === itemIdx
          ? { ...item, options: item.options.map((o, oi) => (oi === optIdx ? { ...o, [field]: value } : o)) }
          : item,
      ),
    );
  }, []);

  // ── Notes CRUD ──

  const addNote = useCallback(() => setNotes((prev) => [...prev, '']), []);
  const removeNote = useCallback((idx: number) => setNotes((prev) => prev.filter((_, i) => i !== idx)), []);
  const updateNote = useCallback((idx: number, value: string) => setNotes((prev) => prev.map((n, i) => (i === idx ? value : n))), []);

  // ── Catalog → Add to items ──

  const addFromCatalog = useCallback((catalogItem: ServiceCatalogItem, selectedOptions: number[]) => {
    setItems((prev) => {
      const nextNo = prev.length > 0 ? Math.max(...prev.map((it) => it.no)) + 1 : 1;
      const newItem: EstimateItemData = {
        no: nextNo,
        category: catalogItem.category,
        details: catalogItem.details.map((d) => ({ title: d.title, descriptions: [...d.descriptions] })),
        unit_price: catalogItem.base_price,
        note: catalogItem.note,
        options: selectedOptions.map((oi) => ({ ...catalogItem.options[oi] })),
      };
      return [...prev, newItem];
    });
    setOpenDrawer('items');
  }, []);

  // ── Catalog flyout & Drag-and-drop ──

  const [catalogOpen, setCatalogOpen] = useState(false);
  const [dragOverItems, setDragOverItems] = useState(false);

  const handleCatalogDragStart = useCallback((e: React.DragEvent, catalogItem: ServiceCatalogItem) => {
    e.dataTransfer.setData('application/x-catalog-id', catalogItem.id);
    e.dataTransfer.effectAllowed = 'copy';
    setOpenDrawer('items');
  }, []);

  const handleItemsDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-catalog-id')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setDragOverItems(true);
    }
  }, []);

  const handleItemsDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverItems(false);
    }
  }, []);

  const handleItemsDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOverItems(false);
    const catalogId = e.dataTransfer.getData('application/x-catalog-id');
    const catalogItem = SERVICE_CATALOG.find((c) => c.id === catalogId);
    if (catalogItem) {
      const allOpts = catalogItem.options.map((_, i) => i);
      addFromCatalog(catalogItem, allOpts);
    }
  }, [addFromCatalog]);

  // ── Computed ──

  const subtotal = items.reduce((sum, item) => {
    const optionsTotal = item.options.reduce((os, o) => os + (o.price || 0), 0);
    return sum + (item.unit_price || 0) + optionsTotal;
  }, 0);
  const tax = Math.round(subtotal * (taxRate / 100));
  const total = subtotal + tax;

  // ── Build preview data ──

  const previewData: EstimateContent = {
    document_number: docNumber,
    recipient,
    sender: companyName,
    project_name: projectName,

    issued_date: issuedDate,
    items: items.map((item) => ({
      no: item.no,
      category: item.category,
      details: item.details,
      unit_price: item.unit_price,
      note: item.note,
      options: item.options.filter((o) => o.name || o.price),
    })),
    subtotal,
    tax_rate: taxRate,
    tax,
    total,
    payment_type: paymentType,
    payment_months: (paymentType === 'monthly' || paymentType === 'deposit') ? paymentMonths : undefined,
    notes: notes.filter(Boolean),
    company_name: companyName,
    company_address: companyAddress,
    company_representative: companyRep,
  };

  // ── Submit ──

  function handleSave() {
    if (!clientId) { toast({ title: '고객사를 선택하세요', variant: 'warning' }); return; }
    if (!projectName) { toast({ title: '프로젝트명을 입력하세요', variant: 'warning' }); return; }
    onSave?.(previewData);
  }

  async function handleSubmit() {
    if (!clientId) { toast({ title: '고객사를 선택하세요', variant: 'warning' }); return; }
    if (!projectName) { toast({ title: '프로젝트명을 입력하세요', variant: 'warning' }); return; }
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
    if (!printWindow) {
      toast({ title: '팝업이 차단되었습니다. 팝업을 허용해주세요.', variant: 'warning' });
      return;
    }

    const styleSheets = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((el) => el.outerHTML)
      .join('\n');

    printWindow.document.write(`<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>견적서</title>
${styleSheets}
<style>
  @page { size: A4; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body > div { display: flex; flex-direction: column; }
  [class*="a4PageOuter"] {
    width: 794px !important; height: 1123px !important;
    overflow: hidden; border-radius: 0;
    break-after: page; page-break-after: always;
  }
  [class*="a4Page"] {
    transform: none !important; box-shadow: none !important;
    width: 794px !important; height: 1123px !important;
  }
</style>
</head><body>
<div>${el.innerHTML}</div>
<script>window.onload=function(){window.print();}<\/script>
</body></html>`);
    printWindow.document.close();
  }

  async function handleDownloadPdf() {
    if (!documentId) return;
    setPdfDownloading(true);
    try {
      let res = await fetch(`/api/documents/${documentId}/pdf`);
      if (!res.ok) {
        res = await fetch(`/api/documents/${documentId}/pdf/generate`, { method: 'POST' });
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: err?.error?.message || 'PDF 다운로드에 실패했습니다', variant: 'error' });
        return;
      }
      const { url } = await res.json();
      window.open(url, '_blank');
    } catch {
      toast({ title: 'PDF 다운로드 중 오류가 발생했습니다', variant: 'error' });
    } finally {
      setPdfDownloading(false);
    }
  }

  // ── Drawer toggle ──

  function toggleDrawer(section: DrawerSection) {
    setOpenDrawer((prev) => (prev === section ? null : section));
  }

  // =============== RENDER ===============

  return (
    <div className={s.editorRoot}>
      {/* ═══ Side Panel ═══ */}
      <aside className={s.sidePanel} style={{ width: panelWidth }}>
        {/* 헤더: 금액 요약 + 액션 */}
        <div className={s.panelHeader}>
          <div className={s.panelAmountRow}>
            <span className={s.panelAmountLabel}>총 결제금액</span>
            <span className={s.panelAmountValue}>{fmtKRW(total)}</span>
          </div>
          {readOnly ? (
            <>
              <div className={s.panelActions}>
                {documentStatus === 'in_review' && onRedraft && (
                  <ActionButton
                    label="견적서 재작성"
                    variant="ghost"
                    size="sm"
                    onClick={onRedraft}
                    icon={<LuRotateCcw size={13} />}
                  />
                )}
                <ActionButton
                  label={pdfDownloading ? 'PDF 생성 중...' : '견적서 다운로드'}
                  variant="ghost-filled"
                  size="sm"
                  onClick={handleDownloadPdf}
                  disabled={pdfDownloading}
                  icon={<LuDownload size={13} />}
                />
              </div>
            </>
          ) : (
            <div className={s.panelActions}>
              {(mode === 'new' || onSave) && (
                <ActionButton label={mode === 'new' ? '저장' : '수정 저장'} variant="primary" size="sm" onClick={handleSave} />
              )}
              {mode === 'edit' && onSubmit && (
                <ActionButton
                  label={submitting ? '제출 중...' : '견적서 제출'}
                  variant="primary"
                  size="sm"
                  onClick={handleSubmit}
                  disabled={submitting}
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
                      <th>고객사 *</th>
                      <td>
                        <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="form-input" disabled={readOnly}>
                          <option value="">고객사를 선택하세요</option>
                          {clients.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <th>수신</th>
                      <td>
                        <input type="text" value={recipient} onChange={(e) => setRecipient(e.target.value)} className="form-input" readOnly={readOnly} />
                      </td>
                    </tr>
                    <tr>
                      <th>문서번호</th>
                      <td>
                        <input type="text" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} className="form-input" readOnly={readOnly} />
                      </td>
                    </tr>
                    <tr>
                      <th>작성일자</th>
                      <td>
                        <input type="date" value={issuedDate} onChange={(e) => setIssuedDate(e.target.value)} className="form-input" readOnly={readOnly} />
                      </td>
                    </tr>
                    <tr>
                      <th>프로젝트명 *</th>
                      <td>
                        <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} className="form-input" readOnly={readOnly} />
                      </td>
                    </tr>

                    <tr>
                      <th>부가세율</th>
                      <td>
                        <div className={s.inputWithUnit}>
                          <input type="number" min={0} max={100} value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} className="form-input" readOnly={readOnly} />
                          <span className={s.inputUnit}>%</span>
                        </div>
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
                      <tr>
                        <th>{paymentType === 'deposit' ? '선수금 기간' : '결제 기간'}</th>
                        <td>
                          <div className={s.inputWithUnit}>
                            <input type="number" min={1} value={paymentMonths} onChange={(e) => setPaymentMonths(Number(e.target.value) || 1)} className="form-input" readOnly={readOnly} />
                            <span className={s.inputUnit}>개월</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── 견적 항목 ── */}
          <div
            className={`${s.section} ${dragOverItems ? s.sectionDropTarget : ''}`}
            onDragOver={handleItemsDragOver}
            onDragLeave={handleItemsDragLeave}
            onDrop={handleItemsDrop}
          >
            <div className={s.sectionHeader}>
              <button type="button" className={s.sectionToggle} onClick={() => toggleDrawer('items')}>
                <span className={s.sectionIcon}><LuListOrdered size={14} /></span>
                <span className={s.sectionLabel}>견적 항목</span>
                <LuChevronUp size={14} className={`${s.sectionChevron} ${openDrawer === 'items' ? s.chevronOpen : ''}`} />
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
            {openDrawer === 'items' && (
              <div className={s.sectionBody}>
                {items.map((item, itemIdx) => (
                  <div key={itemIdx} className={s.itemCard}>
                    <div className={s.itemHeader}>
                      <span className={s.itemNo}>{item.no}</span>
                      {!readOnly && items.length > 1 && (
                        <button type="button" className={s.removeBtn} onClick={() => removeItem(itemIdx)} title="항목 삭제">
                          <LuTrash2 size={14} />
                        </button>
                      )}
                    </div>

                    <table className={s.formTable}>
                      <tbody>
                        <tr>
                          <th>카테고리</th>
                          <td>
                            <input type="text" value={item.category} onChange={(e) => updateItem(itemIdx, 'category', e.target.value)} className="form-input" readOnly={readOnly} />
                          </td>
                        </tr>
                        <tr>
                          <th>단가</th>
                          <td>
                            <div className={s.inputWithUnit}>
                              <input type="number" value={item.unit_price || ''} onChange={(e) => updateItem(itemIdx, 'unit_price', Number(e.target.value))} className="form-input" readOnly={readOnly} />
                              <span className={s.inputUnit}>원/월</span>
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <th>비고</th>
                          <td>
                            <input type="text" value={item.note} onChange={(e) => updateItem(itemIdx, 'note', e.target.value)} className="form-input" readOnly={readOnly} />
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* 세부 항목 */}
                    {item.details.map((detail, detailIdx) => (
                      <div key={detailIdx} className={s.detailSection}>
                        <div className={s.detailHeaderRow}>
                          <span className={s.detailLabel}>세부 항목 {detailIdx + 1}</span>
                          {!readOnly && item.details.length > 1 && (
                            <button type="button" className={s.smallBtn} onClick={() => removeDetail(itemIdx, detailIdx)} title="세부 삭제">
                              <LuTrash2 size={12} />
                            </button>
                          )}
                        </div>
                        <table className={s.formTable}>
                          <tbody>
                            <tr>
                              <th>항목명</th>
                              <td>
                                <input type="text" value={detail.title} onChange={(e) => updateDetailTitle(itemIdx, detailIdx, e.target.value)} className="form-input" readOnly={readOnly} />
                              </td>
                            </tr>
                            {detail.descriptions.map((desc, descIdx) => (
                              <tr key={descIdx}>
                                <th>{descIdx === 0 ? '설명' : ''}</th>
                                <td>
                                  <div className={s.descriptionRow}>
                                    <span className={s.descBullet}>·</span>
                                    <input type="text" value={desc} onChange={(e) => updateDescription(itemIdx, detailIdx, descIdx, e.target.value)} className="form-input" readOnly={readOnly} />
                                    {!readOnly && detail.descriptions.length > 1 && (
                                      <button type="button" className={s.smallBtn} onClick={() => removeDescription(itemIdx, detailIdx, descIdx)}>×</button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {!readOnly && (
                          <button type="button" className={s.addDescBtn} onClick={() => addDescription(itemIdx, detailIdx)}>
                            <LuPlus size={10} /> 설명 추가
                          </button>
                        )}
                      </div>
                    ))}
                    {!readOnly && (
                      <button type="button" className={s.addDetailBtn} onClick={() => addDetail(itemIdx)} style={{ marginTop: 6 }}>
                        <LuPlus size={11} /> 세부 항목 추가
                      </button>
                    )}

                    {/* 옵션 */}
                    {item.options.length > 0 && (
                      <div className={s.optionSection}>
                        <table className={s.formTable}>
                          <tbody>
                            {item.options.map((opt, optIdx) => (
                              <tr key={optIdx}>
                                <th>{optIdx === 0 ? '옵션' : ''}</th>
                                <td>
                                  <div className={s.optionRow}>
                                    <input type="text" value={opt.name} onChange={(e) => updateOption(itemIdx, optIdx, 'name', e.target.value)} className="form-input" style={{ flex: 2 }} readOnly={readOnly} />
                                    <input type="number" value={opt.price || ''} onChange={(e) => updateOption(itemIdx, optIdx, 'price', Number(e.target.value))} className="form-input" style={{ flex: 1 }} readOnly={readOnly} />
                                    {!readOnly && (
                                      <button type="button" className={s.smallBtn} onClick={() => removeOption(itemIdx, optIdx)} title="옵션 삭제">
                                        <LuTrash2 size={12} />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {!readOnly && (
                      <button type="button" className={s.addDescBtn} onClick={() => addOption(itemIdx)} style={{ marginTop: 4 }}>
                        <LuPlus size={10} /> 옵션 추가
                      </button>
                    )}
                  </div>
                ))}
                {!readOnly && (
                  <button type="button" className={s.addItemBtn} onClick={addItem}>
                    <LuPlus size={14} /> 카테고리 추가
                  </button>
                )}
              </div>
            )}
            {dragOverItems && (
              <div className={s.dropIndicator}>
                <LuPlus size={16} />
                <span>카탈로그 항목을 여기에 놓으세요</span>
              </div>
            )}
          </div>

          {/* ── 참고 사항 ── */}
          <div className={s.section}>
            <button type="button" className={s.sectionToggle} onClick={() => toggleDrawer('notes')}>
              <span className={s.sectionIcon}><LuFileText size={14} /></span>
              <span className={s.sectionLabel}>참고 사항</span>
              <LuChevronUp size={14} className={`${s.sectionChevron} ${openDrawer === 'notes' ? s.chevronOpen : ''}`} />
            </button>
            {openDrawer === 'notes' && (
              <div className={s.sectionBody}>
                {notes.map((note, idx) => (
                  <div key={idx} className={s.noteRow}>
                    <span className={s.noteNo}>{idx + 1}.</span>
                    <input type="text" value={note} onChange={(e) => updateNote(idx, e.target.value)} className="form-input" style={{ fontSize: 12 }} readOnly={readOnly} />
                    {!readOnly && (
                      <button type="button" className={s.smallBtn} onClick={() => removeNote(idx)}>
                        <LuTrash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
                {!readOnly && (
                  <button type="button" className={s.addDescBtn} onClick={addNote}>
                    <LuPlus size={10} /> 참고 사항 추가
                  </button>
                )}
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
          {documentId && documentStatus && documentStatus !== 'draft' && (
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

      {/* ═══ Preview (A4 상 표시) ═══ */}
      <div className={s.previewScroll} ref={previewRef}>
        <EstimatePreview data={previewData} />
      </div>

      {/* ═══ Catalog Flyout ═══ */}
      {!readOnly && catalogOpen && (
        <div className={s.catalogFlyout} style={{ left: panelWidth + 5 }}>
          <div className={s.catalogFlyoutHeader}>
            <LuBookOpen size={14} />
            <span className={s.catalogFlyoutTitle}>서비스 카탈로그</span>
            <button type="button" className={s.catalogFlyoutClose} onClick={() => setCatalogOpen(false)}>
              <LuX size={14} />
            </button>
          </div>
          <p className={s.catalogFlyoutHint}>드래그하여 견적 항목에 추가하세요</p>
          <div className={s.catalogFlyoutBody}>
            {Array.from(new Set(SERVICE_CATALOG.map((c) => c.group))).map((group) => (
              <div key={group} className={s.catalogGroup}>
                <span className={s.catalogGroupLabel}>{group}</span>
                {SERVICE_CATALOG.filter((c) => c.group === group).map((ci) => (
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
