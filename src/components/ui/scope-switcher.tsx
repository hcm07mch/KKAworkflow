'use client';

/**
 * ScopeSwitcher - 본사 계정 전용. 본사업무/지사업무 전환 드롭다운.
 * 쿠키 active-scope를 설정하고 라우터를 refresh하여 서버 컴포넌트 재평가.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LuBuilding2, LuChevronDown } from 'react-icons/lu';
import styles from './scope-switcher.module.css';

interface OrgOption {
  id: string;
  name: string;
  parent_id: string | null;
}

interface ScopeInfo {
  isRootOrg: boolean;
  activeScope: string | null;
  orgs: OrgOption[];
}

export function ScopeSwitcher() {
  const [info, setInfo] = useState<ScopeInfo | null>(null);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/scope')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setInfo(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!info || !info.isRootOrg || info.orgs.length <= 1) return null;

  const rootOrg = info.orgs.find((o) => !o.parent_id);
  const branchOrgs = info.orgs.filter((o) => o.parent_id);
  const activeOrg = info.activeScope
    ? info.orgs.find((o) => o.id === info.activeScope)
    : rootOrg;
  const activeLabel = info.activeScope && activeOrg?.parent_id
    ? `${activeOrg.name} 업무`
    : '본사 업무';

  async function switchTo(orgId: string | null) {
    if (switching) return;
    setSwitching(true);
    try {
      await fetch('/api/scope', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      });
      setOpen(false);
      router.refresh();
      // 페이지 컴포넌트에서 fetch로 가져온 데이터를 재로드하도록 전체 새로고침
      window.location.reload();
    } catch {
      // ignore
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div className={styles.wrapper} ref={ref}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((o) => !o)}
      >
        <LuBuilding2 size={14} />
        <span>{activeLabel}</span>
        <LuChevronDown size={14} />
      </button>
      {open && (
        <div className={styles.dropdown}>
          {rootOrg && (
            <button
              type="button"
              className={`${styles.option} ${!info.activeScope ? styles.optionActive : ''}`}
              onClick={() => switchTo(rootOrg.id)}
              disabled={switching}
            >
              <span className={styles.optionLabel}>본사 업무</span>
              <span className={styles.optionDesc}>{rootOrg.name}</span>
            </button>
          )}
          {branchOrgs.map((org) => (
            <button
              key={org.id}
              type="button"
              className={`${styles.option} ${info.activeScope === org.id ? styles.optionActive : ''}`}
              onClick={() => switchTo(org.id)}
              disabled={switching}
            >
              <span className={styles.optionLabel}>{org.name} 업무</span>
              <span className={styles.optionDesc}>지사</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
