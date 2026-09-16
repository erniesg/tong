'use client';

import { ShanghaiAuctionRoom } from '@/components/shanghai/ShanghaiAuctionRoom';

export default function ShanghaiLiveAuctionPage() {
  return (
    <div className="scene-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="game-frame">
        <ShanghaiAuctionRoom />
      </div>
    </div>
  );
}
