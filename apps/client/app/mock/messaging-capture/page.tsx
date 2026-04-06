import { MessagingCapturePageClient } from './page-client';

interface MockMessagingCapturePageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

function asSingleValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default function MockMessagingCapturePage({ searchParams }: MockMessagingCapturePageProps) {
  return <MessagingCapturePageClient searchParams={Object.fromEntries(Object.entries(searchParams).map(([key, value]) => [key, asSingleValue(value)]))} />;
}
