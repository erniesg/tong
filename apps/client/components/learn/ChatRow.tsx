'use client';

import type { ReactNode } from 'react';

interface ChatRowProps {
  side: 'left' | 'right';
  avatarEmoji?: string;
  avatarUrl?: string;
  name?: string;
  children: ReactNode;
}

export function ChatRow({ side, avatarEmoji, avatarUrl, name, children }: ChatRowProps) {
  return (
    <div className={`chat-row chat-row--${side}`}>
      {side === 'left' && (
        <div className="chat-row__avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt={name ?? 'Tong'} />
          ) : (
            avatarEmoji ?? '🐾'
          )}
        </div>
      )}
      <div className="chat-row__body">
        {side === 'left' && name && <span className="chat-row__name">{name}</span>}
        {children}
      </div>
    </div>
  );
}
