import PlaytestPageClient from './PlaytestPageClient';

export const dynamicParams = false;

export function generateStaticParams() {
  return [{ id: '__static__' }];
}

export default function PlaytestPage() {
  return <PlaytestPageClient />;
}
