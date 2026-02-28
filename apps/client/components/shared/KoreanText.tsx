'use client';

const GLOSSARY: Record<string, { romanization: string; translation: string }> = {
  포장마차: { romanization: 'pojangmacha', translation: 'street food tent' },
  떡볶이: { romanization: 'tteokbokki', translation: 'spicy rice cakes' },
  김밥: { romanization: 'gimbap', translation: 'seaweed rice roll' },
  라면: { romanization: 'ramyeon', translation: 'instant noodles' },
  메뉴: { romanization: 'menyu', translation: 'menu' },
  주문: { romanization: 'jumun', translation: 'order' },
  주세요: { romanization: 'juseyo', translation: 'please give me' },
  감사합니다: { romanization: 'gamsahamnida', translation: 'thank you' },
  보통: { romanization: 'botong', translation: 'normal / medium' },
  맵기: { romanization: 'maepgi', translation: 'spice level' },
  맵게: { romanization: 'maepge', translation: 'spicy' },
  안: { romanization: 'an', translation: 'not' },
  덜: { romanization: 'deol', translation: 'less' },
  많이: { romanization: 'mani', translation: 'a lot' },
  여기: { romanization: 'yeogi', translation: 'here' },
  유명해: { romanization: 'yumyeonghae', translation: 'is famous' },
  어서: { romanization: 'eoseo', translation: 'quickly / welcome' },
  와요: { romanization: 'wayo', translation: 'come (polite)' },
  오늘: { romanization: 'oneul', translation: 'today' },
  뭐: { romanization: 'mwo', translation: 'what' },
  먹고: { romanization: 'meokgo', translation: 'eat and...' },
  싶어요: { romanization: 'sipeoyo', translation: 'want to...' },
  물: { romanization: 'mul', translation: 'water' },
};

const PARTICLES = ['을', '를', '이', '가', '은', '는', '에', '에서', '도', '와', '과', '로', '으로'];

function isHangulToken(token: string): boolean {
  return /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(token);
}

function lookupGloss(token: string): { romanization: string; translation: string } | null {
  const cleaned = token.trim();
  if (!cleaned) return null;
  if (GLOSSARY[cleaned]) return GLOSSARY[cleaned];

  for (const particle of PARTICLES) {
    if (cleaned.endsWith(particle) && cleaned.length > particle.length) {
      const stem = cleaned.slice(0, -particle.length);
      if (GLOSSARY[stem]) return GLOSSARY[stem];
    }
  }

  return null;
}

interface KoreanTextProps {
  text: string;
}

export function KoreanText({ text }: KoreanTextProps) {
  const parts = text.split(/([가-힣ㄱ-ㅎㅏ-ㅣ]+)/g);
  return (
    <>
      {parts.map((part, index) => {
        if (!part) return null;
        if (!isHangulToken(part)) return <span key={`${part}_${index}`}>{part}</span>;
        const gloss = lookupGloss(part);
        const tooltip = gloss ? `${gloss.romanization} · ${gloss.translation}` : 'Korean text';
        return (
          <span key={`${part}_${index}`} className="ko-token" data-tooltip={tooltip}>
            {part}
          </span>
        );
      })}
    </>
  );
}
