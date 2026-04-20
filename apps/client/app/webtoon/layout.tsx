import { PlaytestWrapper } from '@/components/playtest/PlaytestWrapper';

export const dynamic = 'force-dynamic';

export default function WebtoonLayout({ children }: { children: React.ReactNode }) {
  return <PlaytestWrapper>{children}</PlaytestWrapper>;
}
