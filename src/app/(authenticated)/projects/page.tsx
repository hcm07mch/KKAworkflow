'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { LuFolderOpen, LuPlus, LuPanelLeftOpen, LuPanelLeftClose } from 'react-icons/lu';
import { StatusBadge, ActionButton } from '@/components/ui';
import type { ProjectStatus, ServiceType, DocumentStatus, DocumentType } from '@/lib/domain/types';
import {
  PROJECT_STATUS_META, PROJECT_STATUS_GROUPS, PROJECT_STATUS_TRANSITIONS,
  SERVICE_TYPE_META, DOCUMENT_TYPE_META,
} from '@/lib/domain/types';
import { WorkflowProgress } from './[id]/components';
import panel from '../panel-layout.module.css';

// ── Types ────────────────────────────────────────────────

interface ProjectItem {
  id: string;
  code: string;
  title: string;
  clientName: string;
  status: ProjectStatus;
  serviceType: ServiceType;
  ownerName: string;
  totalAmount: number | null;
  startDate: string | null;
  endDate: string | null;
  updatedAt: string;
}

interface ProjectDetail {
  id: string;
  code: string | null;
  title: string;
  description: string | null;
  status: ProjectStatus;
  service_type: ServiceType;
  total_amount: number | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  client: { id: string; name: string; contact_name: string | null };
  owner: { id: string; name: string } | null;
  documents: {
    id: string;
    type: DocumentType;
    status: DocumentStatus;
    version: number;
    title: string;
    updated_at: string;
  }[];
}

function formatCurrency(amount: number | null) {
  if (amount == null) return '-';
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(amount);
}

function formatDate(d: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Page ─────────────────────────────────────────────────

export default function ProjectsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('projects_ownerFilter') ?? 'all';
    }
    return 'all';
  });
  const [selected, setSelected] = useState<ProjectItem | null>(null);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch('/api/projects?limit=200')
      .then((r) => r.json())
      .then((res) => {
        const items: ProjectItem[] = (res.data ?? []).map((p: any) => ({
          id: p.id,
          code: p.code ?? '',
          title: p.title,
          clientName: p.client?.name ?? '',
          status: p.status,
          serviceType: p.service_type,
          ownerName: p.owner?.name ?? '-',
          totalAmount: p.total_amount,
          startDate: p.start_date,
          endDate: p.end_date,
          updatedAt: p.updated_at,
        }));
        setProjects(items);
        setLoading(false);

        const selectedId = searchParams.get('selected')
          ?? localStorage.getItem('projects_selectedId');
        if (selectedId) {
          const target = items.find((p) => p.id === selectedId);
          if (target) selectProject(target);
        }
      })
      .catch(() => setLoading(false));
  }, []);

  const selectProject = useCallback((p: ProjectItem) => {
    setSelected(p);
    localStorage.setItem('projects_selectedId', p.id);
    setDetail(null);
    setDetailLoading(true);
    fetch(`/api/projects/${p.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error();
        setDetail(data);
      })
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  }, []);

  function handleTransition(toStatus: ProjectStatus) {
    if (!detail) return;

    // 영업 → 견적 작성: 견적서 자동 생성 + 견적서 작성 페이지 이동 안내
    if (selected?.status === 'A_sales' && toStatus === 'B1_estimate_draft') {
      if (!confirm('견적 단계로 전환하면 견적서가 자동 생성됩니다.\n견적서 작성 페이지로 이동하시겠습니까?')) return;
      fetch(`/api/projects/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: toStatus }),
      })
        .then((r) => r.json())
        .then(() => {
          // 견적서 생성 후 프로젝트 상세의 문서 목록에서 견적서 ID를 가져와 이동
          return fetch(`/api/projects/${detail.id}`).then((r) => r.json());
        })
        .then((proj) => {
          const estimate = proj?.documents?.find((d: any) => d.type === 'estimate');
          if (estimate) {
            router.push(`/projects/${detail.id}/documents/${estimate.id}`);
          } else {
            // 문서 페이지가 없으면 프로젝트 상세 갱신
            if (selected) selectProject({ ...selected, status: toStatus });
          }
        })
        .catch(() => alert('상태 변경에 실패했습니다.'));
      return;
    }

    const label = PROJECT_STATUS_META[toStatus]?.label ?? toStatus;
    if (!confirm(`상태를 "${label}"(으)로 변경하시겠습니까?`)) return;
    fetch(`/api/projects/${detail.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: toStatus }),
    })
      .then((r) => r.json())
      .then(() => {
        if (selected) selectProject({ ...selected, status: toStatus });
      })
      .catch(() => alert('상태 변경에 실패했습니다.'));
  }

  const ownerNames = Array.from(new Set(projects.map((p) => p.ownerName).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ko'));

  const filtered = projects.filter((p) => {
    if (groupFilter !== 'all') {
      const group = PROJECT_STATUS_GROUPS.find(g => g.key === groupFilter);
      if (group && !group.statuses.includes(p.status)) return false;
    }
    if (ownerFilter !== 'all' && p.ownerName !== ownerFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.title.toLowerCase().includes(q) || p.clientName.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
    }
    return true;
  });

  if (loading) {
    return (
      <div className={panel.wrapper}>
        <div className={panel.leftPanel}>
          <div className={panel.leftHeader}>
            <span className={panel.leftTitle}>프로젝트</span>
            <div className={panel.searchInput} style={{ opacity: 0.5 }} />
          </div>
          <div className={panel.itemList}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={panel.skeletonItem}>
                <div className={panel.skeletonBar} style={{ width: '70%' }} />
                <div className={panel.skeletonBar} style={{ width: '45%', height: 8 }} />
              </div>
            ))}
          </div>
        </div>
        <div className={panel.rightPanel}>
          <div className={panel.emptyState}>
            <span className={panel.emptyIcon}><LuFolderOpen size={32} /></span>
            <span>프로젝트를 선택하세요</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={panel.wrapper}>
      {/* ── Left Panel ── */}
      <div className={`${panel.leftPanel} ${expanded ? panel.leftPanelExpanded : ''}`}>
        <div className={panel.leftHeader}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className={panel.leftTitle}>프로젝트</span>
            <button
              type="button"
              className={panel.expandBtn}
              onClick={() => setExpanded((v) => !v)}
              title={expanded ? '접기' : '펼치기'}
            >
              {expanded ? <LuPanelLeftClose size={16} /> : <LuPanelLeftOpen size={16} />}
            </button>
          </div>
          <input
            className={panel.searchInput}
            placeholder="프로젝트명, 고객사 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className={panel.sortRow}>
            <select
              className={panel.sortSelect}
              value={ownerFilter}
              onChange={(e) => {
                const v = e.target.value;
                setOwnerFilter(v);
                localStorage.setItem('projects_ownerFilter', v);
              }}
            >
              <option value="all">담당자: 전체</option>
              {ownerNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          {!expanded && (
            <div className={panel.filterTabs}>
              <button
                type="button"
                className={`${panel.filterTab} ${groupFilter === 'all' ? panel.filterTabActive : ''}`}
                onClick={() => setGroupFilter('all')}
              >전체</button>
              {PROJECT_STATUS_GROUPS.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  className={`${panel.filterTab} ${groupFilter === g.key ? panel.filterTabActive : ''}`}
                  onClick={() => setGroupFilter(g.key)}
                >{g.label}</button>
              ))}
            </div>
          )}
        </div>

        {expanded ? (
          /* ── Expanded: Kanban Columns ── */
          <div className={panel.boardColumns}>
            {PROJECT_STATUS_GROUPS.map((group) => {
              const searchFiltered = projects.filter((p) => {
                if (!group.statuses.includes(p.status)) return false;
                if (ownerFilter !== 'all' && p.ownerName !== ownerFilter) return false;
                if (search) {
                  const q = search.toLowerCase();
                  return p.title.toLowerCase().includes(q) || p.clientName.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
                }
                return true;
              });
              return (
                <div key={group.key} className={panel.boardColumn}>
                  <div className={panel.boardColumnHeader}>
                    <span className={panel.boardColumnTitle}>{group.label}</span>
                    <span className={panel.boardColumnCount}>{searchFiltered.length}</span>
                  </div>
                  <div className={panel.boardColumnBody}>
                    {searchFiltered.length === 0 ? (
                      <div className={panel.boardEmpty}>프로젝트 없음</div>
                    ) : (
                      searchFiltered.map((p) => (
                        <div
                          key={p.id}
                          className={`${panel.boardCard} ${selected?.id === p.id ? panel.boardCardActive : ''}`}
                          onClick={() => { selectProject(p); setExpanded(false); }}
                        >
                          <div className={panel.boardCardTitle}>{p.title}</div>
                          <div className={panel.boardCardMeta}>
                            <span>{p.clientName}</span>
                            <span>·</span>

                            <StatusBadge status={p.status} type="project" />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── Collapsed: Normal List ── */
          <>
            <div className={panel.itemList}>
              <Link href="/projects/new" className={panel.addItem}>
                <LuPlus size={14} /> 새 프로젝트
              </Link>
              {filtered.map((p) => (
                <div
                  key={p.id}
                  className={`${panel.item} ${selected?.id === p.id ? panel.itemActive : ''}`}
                  onClick={() => selectProject(p)}
                >
                  <span className={panel.itemName}>{p.title}</span>
                  <span className={panel.itemMeta}>
                    <span>{p.clientName}</span>
                    <span>·</span>
                    <StatusBadge status={p.status} type="project" />
                  </span>
                </div>
              ))}
            </div>
            <div className={panel.leftFooter}>{filtered.length}개 프로젝트</div>
          </>
        )}
      </div>

      {/* ── Right Panel ── */}
      {!expanded && (
      <div className={panel.rightPanel}>
        {!selected ? (
          <div className={panel.emptyState}>
            <span className={panel.emptyIcon}><LuFolderOpen size={32} /></span>
            <span>프로젝트를 선택하세요</span>
          </div>
        ) : (
          <>
            <div className={panel.detailHeader}>
              <div>
                <div className={panel.detailTitle}>{selected.title}</div>
                <div className={panel.detailSubtitle}>
                  {selected.code} · {selected.clientName}
                </div>
              </div>
              <div className={panel.detailActions}>
                {(() => {
                  const nextStatuses = PROJECT_STATUS_TRANSITIONS[selected.status] ?? [];
                  return nextStatuses.map((next) => {
                    // 영업 단계에서 견적/종료 버튼 라벨 커스텀
                    let label = `${PROJECT_STATUS_META[next]?.label ?? next}(으)로 변경`;
                    let variant: 'primary' | 'secondary' | 'danger' = 'secondary';
                    if (selected.status === 'A_sales' && next === 'B1_estimate_draft') {
                      label = '견적서 작성';
                      variant = 'primary';
                    } else if (next === 'F1_refund' || next === 'F2_closed') {
                      variant = 'danger';
                      if (selected.status === 'A_sales' && next === 'F2_closed') {
                        label = '영업 종료';
                      }
                    }
                    return (
                      <ActionButton
                        key={next}
                        label={label}
                        variant={variant}
                        size="sm"
                        onClick={() => handleTransition(next)}
                      />
                    );
                  });
                })()}
              </div>
            </div>

            {/* 프로젝트 기본 정보 */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className={panel.formTable}>
                <tbody>
                  <tr>
                    <th>상태</th>
                    <td><StatusBadge status={selected.status} type="project" size="md" /></td>
                  </tr>
                  <tr>
                    <th>고객사</th>
                    <td><span className={panel.fieldValue}>{detail?.client?.name ?? selected.clientName}</span></td>
                  </tr>
                  <tr>
                    <th>서비스 유형</th>
                    <td><span className={panel.fieldValue}>{SERVICE_TYPE_META[selected.serviceType]?.label ?? '-'}</span></td>
                  </tr>
                  <tr>
                    <th>담당자</th>
                    <td><span className={panel.fieldValue}>{detail?.owner?.name ?? selected.ownerName}</span></td>
                  </tr>
                  <tr>
                    <th>계약 금액</th>
                    <td><span className={panel.fieldValue}>{formatCurrency(selected.totalAmount)}</span></td>
                  </tr>
                  <tr>
                    <th>기간</th>
                    <td><span className={panel.fieldValue}>{formatDate(selected.startDate)} ~ {formatDate(selected.endDate)}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 워크플로우 진행 현황 */}
            <div className={panel.detailSection}>
              <WorkflowProgress
                serviceType={selected.serviceType}
                projectStatus={selected.status}
              />
            </div>

            {/* 문서 목록 */}
            <div className={panel.detailSection}>
              <div className={panel.detailSectionTitle}>문서 목록</div>
              {detailLoading ? (
                <div className="card" style={{ padding: '16px', fontSize: 13, color: 'var(--color-text-muted)' }}>
                  문서를 불러오는 중...
                </div>
              ) : !detail?.documents?.length ? (
                <div className="card" style={{ padding: '16px', fontSize: 13, color: 'var(--color-text-muted)' }}>
                  등록된 문서가 없습니다.
                </div>
              ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>구분</th>
                        <th>제목</th>
                        <th>상태</th>
                        <th>버전</th>
                        <th>최종 수정</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.documents.map((doc) => (
                        <tr key={doc.id}>
                          <td>{DOCUMENT_TYPE_META[doc.type]?.label ?? doc.type}</td>
                          <td style={{ fontWeight: 500 }}>{doc.title}</td>
                          <td><StatusBadge status={doc.status} type="document" /></td>
                          <td>v{doc.version}</td>
                          <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{formatDateTime(doc.updated_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 활동 로그 */}
            <div className={panel.detailSection}>
              <div className={panel.detailSectionTitle}>활동 로그</div>
              <div className="card" style={{ padding: '16px', fontSize: 13, color: 'var(--color-text-muted)' }}>
                최근 활동이 여기에 표시됩니다.
              </div>
            </div>
          </>
        )}
      </div>
      )}
    </div>
  );
}