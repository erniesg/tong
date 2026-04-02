import DemoPasswordBar from '@/components/demo-password-bar';
import { PlaytestWrapper } from '@/components/playtest/PlaytestWrapper';

export const dynamic = 'force-dynamic';

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DemoPasswordBar />
      <PlaytestWrapper>{children}</PlaytestWrapper>
    </>
  );
}
