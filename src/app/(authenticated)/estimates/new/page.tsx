'use client';

/**
 * /estimates/new → /estimates 페이지로 리다이렉트
 * 견적서 작성은 /estimates 페이지 내 right panel에서 처리됩니다.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function NewEstimateRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/estimates');
  }, [router]);
  return null;
}
