import DemoPasswordBar from '@/components/demo-password-bar';

export const dynamic = 'force-dynamic';

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DemoPasswordBar />
      {children}
    </>
  );
}
