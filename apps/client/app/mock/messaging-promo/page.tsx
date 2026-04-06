import { ScriptedMessagingPromoCapture } from '@/components/mock/ScriptedMessagingPromoCapture';

interface MockMessagingPromoPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export default function MockMessagingPromoPage({ searchParams }: MockMessagingPromoPageProps) {
  return <ScriptedMessagingPromoCapture initialSearchParams={searchParams} />;
}
