import { redirect } from 'next/navigation';

interface SeoulOnboardingPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function SeoulOnboardingPage({ searchParams }: SeoulOnboardingPageProps) {
  const params = new URLSearchParams();
  const npc = firstParam(searchParams?.npc) || 'jin';
  const name = firstParam(searchParams?.name) || firstParam(searchParams?.playerName) || 'Player';
  const chineseName = firstParam(searchParams?.cn_name);
  const lang = firstParam(searchParams?.lang) || 'en';
  const qaRunId = firstParam(searchParams?.qa_run_id);
  const qaTrace = firstParam(searchParams?.qa_trace);
  const devAct = firstParam(searchParams?.dev_act);

  params.set('dev_intro', '1');
  params.set('npc', npc);
  params.set('name', name);
  params.set('lang', lang);

  if (chineseName) params.set('cn_name', chineseName);
  if (qaRunId) params.set('qa_run_id', qaRunId);
  if (qaTrace) params.set('qa_trace', qaTrace);
  if (devAct) params.set('dev_act', devAct);

  redirect(`/game?${params.toString()}`);
}
