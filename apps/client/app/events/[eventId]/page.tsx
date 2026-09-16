import { redirect } from 'next/navigation';

type EventPageProps = {
  params: {
    eventId: string;
  };
  searchParams?: Record<string, string | string[] | undefined>;
};

function pickFirst(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default function EventPage({ params, searchParams }: EventPageProps) {
  const next = new URLSearchParams({
    phase: 'auction',
    city: 'shanghai',
  });

  const admin = pickFirst(searchParams?.admin);
  if (admin === '1') {
    next.set('admin', '1');
  }

  const role = pickFirst(searchParams?.role);
  if (role === 'admin') {
    next.set('admin', '1');
  }

  const qaRunId = pickFirst(searchParams?.qa_run_id);
  if (qaRunId) next.set('qa_run_id', qaRunId);

  const qaTrace = pickFirst(searchParams?.qa_trace);
  if (qaTrace === '1') next.set('qa_trace', '1');

  next.set('eventId', params.eventId);

  redirect(`/game?${next.toString()}`);
}
