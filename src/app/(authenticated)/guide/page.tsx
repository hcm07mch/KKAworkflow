'use client';

import React from 'react';
import {
  LuBuilding2,
  LuFolderOpen,
  LuGitBranch,
  LuArrowRight,
  LuInfo,
  LuUsers,
  LuPrinter,
} from 'react-icons/lu';
import {
  PROJECT_STATUS_GROUPS,
  PROJECT_STATUS_META,
  PROJECT_STATUS_TRANSITIONS,
  PROJECT_TRANSITION_REQUIRED_ROLE,
  SERVICE_TYPE_META,
} from '@/lib/domain/types';
import type { ProjectStatus } from '@/lib/domain/types';
import styles from './guide.module.css';

/* ── helpers ── */

const DOT_CLASS: Record<string, string> = {
  gray: styles.dotGray,
  blue: styles.dotBlue,
  yellow: styles.dotYellow,
  indigo: styles.dotIndigo,
  cyan: styles.dotCyan,
  emerald: styles.dotEmerald,
  orange: styles.dotOrange,
  green: styles.dotGreen,
  red: styles.dotRed,
};

function Dot({ color }: { color: string }) {
  return <span className={`${styles.dot} ${DOT_CLASS[color] ?? styles.dotGray}`} />;
}

/* ── Page ── */

export default function GuidePage() {
  return (
    <div className={styles.page} id="guide-content">
      <div className={styles.pageHeaderRow}>
        <div>
          <h1 className={styles.pageTitle}>워크플로우 가이드</h1>
          <p className={styles.pageSub}>
            고객 등록부터 프로젝트 종료까지의 업무 흐름과 데이터 구조를 안내합니다.
          </p>
        </div>
        <button
          className={styles.printBtn}
          onClick={() => window.print()}
          title="PDF로 저장"
        >
          <LuPrinter size={15} /> PDF 출력
        </button>
      </div>

      {/* ────────────────────────────────────────────────── */}
      {/* 1. 전체 워크플로우 */}
      {/* ────────────────────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <LuGitBranch size={18} /> 전체 워크플로우
        </h2>
        <p className={styles.sectionDesc}>
          모든 프로젝트는 아래 6개 단계(A~F) 17개 상태를 순서대로 거칩니다.
          서비스 유형에 따라 일부 단계를 건너뛸 수 있습니다.
        </p>

        <div className={styles.flowWrap}>
          {PROJECT_STATUS_GROUPS.map((group) => (
            <div key={group.key} style={{ display: 'flex', alignItems: 'flex-start' }}>
              <div className={styles.flowGroup}>
                <span className={styles.flowGroupLabel}>{group.key}. {group.label}</span>
                <div className={styles.flowSteps}>
                  {group.statuses.map((s, si) => {
                    const meta = PROJECT_STATUS_META[s];
                    return (
                      <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
                        {si > 0 && <span className={styles.flowArrow}>→</span>}
                        <div className={styles.flowNode}>
                          <span className={styles.flowNodeCode}>{s.split('_')[0]}</span>
                          <span className={styles.flowNodeLabel}>
                            <Dot color={meta.color} />
                            {meta.shortLabel}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.note}>
          <span className={styles.noteTitle}>서비스 유형별 차이</span>
          <strong>바이럴</strong>: B4(견적 응답) → D1(입금 대기)로 직행, C단계(계약) 생략 가능<br />
          <strong>퍼포먼스 / 바이럴+퍼포먼스</strong>: 계약 단계(C1~C4) 필수
        </div>
      </section>

      {/* ────────────────────────────────────────────────── */}
      {/* 2. 고객 · 프로젝트 구조 */}
      {/* ────────────────────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <LuUsers size={18} /> 고객 · 프로젝트 구조
        </h2>
        <p className={styles.sectionDesc}>
          고객(Client) 1명에 여러 프로젝트가 연결되는 1:N 관계입니다.
          고객이 등록되면 기본 프로젝트가 자동 생성되며, 이후 추가 프로젝트를 생성할 수 있습니다.
        </p>

        {/* 관계도 */}
        <div className={styles.relationWrap}>
          <div className={`${styles.relationBox} ${styles.relationBoxActive}`}>
            <LuBuilding2 size={24} style={{ marginBottom: 4, color: 'var(--color-primary)' }} />
            <span className={styles.relationBoxLabel}>고객 (Client)</span>
            <span className={styles.relationBoxSub}>1개 레코드</span>
          </div>
          <div className={styles.relationArrow}>
            <span className={styles.relationArrowLine}>―――▶</span>
            <span className={styles.relationArrowLabel}>1 : N</span>
          </div>
          <div className={`${styles.relationBox} ${styles.relationBoxActive}`}>
            <LuFolderOpen size={24} style={{ marginBottom: 4, color: '#6366f1' }} />
            <span className={styles.relationBoxLabel}>프로젝트 (Project)</span>
            <span className={styles.relationBoxSub}>N개 레코드</span>
          </div>
        </div>

        {/* 엔티티 카드 */}
        <div className={styles.entityGrid}>
          {/* 고객 */}
          <div className={styles.entityCard}>
            <div className={styles.entityHeader}>
              <div className={`${styles.entityIcon} ${styles.entityIconClient}`}>
                <LuBuilding2 size={18} />
              </div>
              <div>
                <div className={styles.entityName}>고객 (Client)</div>
                <div className={styles.entitySub}>고객사 기본 정보</div>
              </div>
            </div>
            <ul className={styles.fieldList}>
              <li><span className={styles.fieldName}>name</span> <span className={styles.fieldDesc}>고객사명</span></li>
              <li><span className={styles.fieldName}>contact_name</span> <span className={styles.fieldDesc}>담당자 이름</span></li>
              <li><span className={styles.fieldName}>contact_email</span> <span className={styles.fieldDesc}>담당자 이메일</span></li>
              <li><span className={styles.fieldName}>contact_phone</span> <span className={styles.fieldDesc}>연락처</span></li>
              <li><span className={styles.fieldName}>service_type</span> <span className={styles.fieldDesc}>바이럴 / 퍼포먼스 / 복합</span></li>
              <li><span className={styles.fieldName}>payment_type</span> <span className={styles.fieldDesc}>선입금 / 건별결제</span></li>
              <li><span className={styles.fieldName}>tier</span> <span className={styles.fieldDesc}>일반 / 우수 고객</span></li>
            </ul>
          </div>
          {/* 프로젝트 */}
          <div className={styles.entityCard}>
            <div className={styles.entityHeader}>
              <div className={`${styles.entityIcon} ${styles.entityIconProject}`}>
                <LuFolderOpen size={18} />
              </div>
              <div>
                <div className={styles.entityName}>프로젝트 (Project)</div>
                <div className={styles.entitySub}>업무 단위 관리</div>
              </div>
            </div>
            <ul className={styles.fieldList}>
              <li><span className={styles.fieldName}>title</span> <span className={styles.fieldDesc}>프로젝트명</span></li>
              <li><span className={styles.fieldName}>code</span> <span className={styles.fieldDesc}>프로젝트 코드 (PRJ-YYYY-NNNN)</span></li>
              <li><span className={styles.fieldName}>status</span> <span className={styles.fieldDesc}>현재 워크플로우 상태 (17단계)</span></li>
              <li><span className={styles.fieldName}>service_type</span> <span className={styles.fieldDesc}>서비스 유형 (고객에서 상속 가능)</span></li>
              <li><span className={styles.fieldName}>owner_id</span> <span className={styles.fieldDesc}>프로젝트 담당자</span></li>
              <li><span className={styles.fieldName}>start / end_date</span> <span className={styles.fieldDesc}>프로젝트 기간</span></li>
              <li><span className={styles.fieldName}>total_amount</span> <span className={styles.fieldDesc}>총 금액 (KRW)</span></li>
            </ul>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────── */}
      {/* 3. 프로젝트 상태값 상세 */}
      {/* ────────────────────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <LuInfo size={18} /> 프로젝트 상태값 상세
        </h2>
        <p className={styles.sectionDesc}>
          총 17개 상태가 6개 그룹으로 나뉘며, 각 상태에서 전환 가능한 다음 상태가 정해져 있습니다.
          일부 전환은 매니저 이상의 권한이 필요합니다.
        </p>

        <table className={styles.statusTable}>
          <thead>
            <tr>
              <th style={{ width: '28%' }}>상태</th>
              <th style={{ width: '32%' }}>설명</th>
              <th style={{ width: '28%' }}>전환 가능</th>
              <th style={{ width: '12%' }}>필요 권한</th>
            </tr>
          </thead>
          <tbody>
            {PROJECT_STATUS_GROUPS.map((group) => (
              <React.Fragment key={group.key}>
                <tr className={styles.statusGroupRow}>
                  <td colSpan={4}>{group.key}. {group.label}</td>
                </tr>
                {group.statuses.map((s) => {
                  const meta = PROJECT_STATUS_META[s];
                  const transitions = PROJECT_STATUS_TRANSITIONS[s] ?? [];
                  const requiredRole = PROJECT_TRANSITION_REQUIRED_ROLE[s];
                  return (
                    <tr key={s}>
                      <td>
                        <span className={styles.badge}>
                          <Dot color={meta.color} />
                          {meta.label}
                        </span>
                      </td>
                      <td>{meta.description}</td>
                      <td>
                        {transitions.length === 0
                          ? <span style={{ color: 'var(--color-text-muted)' }}>— 최종 상태</span>
                          : transitions.map((t, i) => (
                              <span key={t}>
                                {i > 0 && <span className={styles.transArrow}>&ensp;/&ensp;</span>}
                                <span className={styles.transTarget}>
                                  {PROJECT_STATUS_META[t].shortLabel}
                                </span>
                              </span>
                            ))
                        }
                      </td>
                      <td>
                        {requiredRole
                          ? <span className={styles.badge} style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>매니저↑</span>
                          : <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>

        <div className={styles.note}>
          <span className={styles.noteTitle}>상태 히스토리</span>
          모든 상태 전환은 <code>workflow_project_status_history</code> 테이블에 자동 기록됩니다.
          변경 사유(note), 변경자(changed_by), 이전/이후 상태가 함께 저장됩니다.
        </div>
      </section>

      {/* ────────────────────────────────────────────────── */}
      {/* 4. 서비스 유형 */}
      {/* ────────────────────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <LuArrowRight size={18} /> 서비스 유형별 경로
        </h2>

        <table className={styles.statusTable}>
          <thead>
            <tr>
              <th>서비스 유형</th>
              <th>설명</th>
              <th>계약 단계</th>
              <th>주요 경로</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(SERVICE_TYPE_META).map(([key, meta]) => (
              <tr key={key}>
                <td><strong>{meta.label}</strong></td>
                <td>{meta.description}</td>
                <td>
                  {meta.requiresContract
                    ? <span className={styles.badge} style={{ background: '#dbeafe', color: '#1d4ed8' }}>필수</span>
                    : <span className={styles.badge} style={{ background: '#fef3c7', color: '#92400e' }}>생략 가능</span>
                  }
                </td>
                <td style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                  {meta.requiresContract
                    ? 'A → B1~B4 → C1~C4 → D1~D2 → E1~E4 → F'
                    : 'A → B1~B4 → D1~D2 → E4 → F'
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}