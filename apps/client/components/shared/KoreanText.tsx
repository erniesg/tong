'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Dictionary lookup for Korean words.
 * Built-in vocabulary for the pojangmacha scene.
 */
const DICTIONARY: Record<string, { romanization: string; translation: string }> = {
  // Greetings & basics
  '포장마차': { romanization: 'pojangmacha', translation: 'street food tent' },
  '안녕하세요': { romanization: 'annyeonghaseyo', translation: 'hello (formal)' },
  '안녕': { romanization: 'annyeong', translation: 'hi / bye' },
  '네': { romanization: 'ne', translation: 'yes' },
  '아니요': { romanization: 'aniyo', translation: 'no' },
  '감사합니다': { romanization: 'gamsahamnida', translation: 'thank you (formal)' },
  '고마워': { romanization: 'gomawo', translation: 'thanks (casual)' },
  '미안해': { romanization: 'mianhae', translation: 'sorry (casual)' },
  '괜찮아': { romanization: 'gwaenchana', translation: "it's okay" },

  // Common expressions
  '준비됐어': { romanization: 'junbidwaesseo', translation: "I'm ready" },
  '잘했어': { romanization: 'jalhaesseo', translation: 'good job!' },
  '대박': { romanization: 'daebak', translation: 'amazing / wow' },
  '화이팅': { romanization: 'hwaiting', translation: 'fighting! (encouragement)' },
  '진짜': { romanization: 'jinjja', translation: 'really / for real' },
  '어서 오세요': { romanization: 'eoseo oseyo', translation: 'welcome (come in)' },

  // Food & ordering
  '떡볶이': { romanization: 'tteokbokki', translation: 'spicy rice cakes' },
  '김밥': { romanization: 'gimbap', translation: 'seaweed rice roll' },
  '라면': { romanization: 'ramyeon', translation: 'ramen noodles' },
  '순대': { romanization: 'sundae', translation: 'blood sausage' },
  '오뎅': { romanization: 'odeng', translation: 'fish cake skewer' },
  '튀김': { romanization: 'twigim', translation: 'fried snacks' },
  '소주': { romanization: 'soju', translation: 'soju (rice liquor)' },
  '막걸리': { romanization: 'makgeolli', translation: 'rice wine' },
  '밥': { romanization: 'bap', translation: 'rice / meal' },
  '주세요': { romanization: 'juseyo', translation: 'please give me' },
  '맛있다': { romanization: 'masitda', translation: 'delicious' },
  '맛있어': { romanization: 'masisseo', translation: "it's delicious" },
  '맵다': { romanization: 'maepda', translation: 'spicy' },
  '매워': { romanization: 'maewo', translation: "it's spicy" },
  '물': { romanization: 'mul', translation: 'water' },
  '메뉴': { romanization: 'menyu', translation: 'menu' },

  // People & relationships
  '선배': { romanization: 'seonbae', translation: 'senior' },
  '후배': { romanization: 'hubae', translation: 'junior' },
  '친구': { romanization: 'chingu', translation: 'friend' },
  '언니': { romanization: 'eonni', translation: 'older sister (f→f)' },
  '오빠': { romanization: 'oppa', translation: 'older brother (f→m)' },
  '아저씨': { romanization: 'ajeossi', translation: 'mister / uncle' },
  '아줌마': { romanization: 'ajumma', translation: "ma'am / auntie" },
  '연습생': { romanization: 'yeonseupssaeng', translation: 'trainee' },

  // Common verbs
  '좋아': { romanization: 'joa', translation: 'good / I like it' },
  '싫어': { romanization: 'sireo', translation: "I don't like it" },
  '몰라': { romanization: 'molla', translation: "I don't know" },
  '할 수 있어': { romanization: 'hal su isseo', translation: 'I can do it' },
  '천천히': { romanization: 'cheoncheonhi', translation: 'slowly' },
  '같이': { romanization: 'gachi', translation: 'together' },
  '여기': { romanization: 'yeogi', translation: 'here' },
  '이거': { romanization: 'igeo', translation: 'this' },
  '뭐': { romanization: 'mwo', translation: 'what' },

  // Scene-specific
  '홍대': { romanization: 'hongdae', translation: 'Hongdae (neighborhood)' },
  '한국어': { romanization: 'hangugeo', translation: 'Korean language' },
  '한국': { romanization: 'hanguk', translation: 'Korea' },
  '연습': { romanization: 'yeonseup', translation: 'practice' },
  '시작': { romanization: 'sijak', translation: 'start / beginning' },
  '잘 먹겠습니다': { romanization: 'jal meokgesseumnida', translation: "I'll eat well (before eating)" },

  // Reactions
  'ㅋㅋ': { romanization: 'kk', translation: 'haha (laughter)' },
  'ㅎㅎ': { romanization: 'hh', translation: 'hehe (soft laugh)' },

  // Useful phrases
  '가자': { romanization: 'gaja', translation: "let's go" },
  '먹자': { romanization: 'meokja', translation: "let's eat" },
};

const JAMO_DICT: Record<string, { romanization: string; name: string }> = {
  'ㄱ': { romanization: 'g/k', name: 'giyeok' },
  'ㄴ': { romanization: 'n', name: 'nieun' },
  'ㄷ': { romanization: 'd/t', name: 'digeut' },
  'ㄹ': { romanization: 'r/l', name: 'rieul' },
  'ㅁ': { romanization: 'm', name: 'mieum' },
  'ㅂ': { romanization: 'b/p', name: 'bieup' },
  'ㅅ': { romanization: 's', name: 'siot' },
  'ㅇ': { romanization: 'ng/silent', name: 'ieung' },
  'ㅈ': { romanization: 'j', name: 'jieut' },
  'ㅊ': { romanization: 'ch', name: 'chieut' },
  'ㅋ': { romanization: 'k', name: 'kieuk' },
  'ㅌ': { romanization: 't', name: 'tieut' },
  'ㅍ': { romanization: 'p', name: 'pieup' },
  'ㅎ': { romanization: 'h', name: 'hieut' },
  'ㅏ': { romanization: 'a', name: 'a' },
  'ㅓ': { romanization: 'eo', name: 'eo' },
  'ㅗ': { romanization: 'o', name: 'o' },
  'ㅜ': { romanization: 'u', name: 'u' },
  'ㅡ': { romanization: 'eu', name: 'eu' },
  'ㅣ': { romanization: 'i', name: 'i' },
  'ㅐ': { romanization: 'ae', name: 'ae' },
  'ㅔ': { romanization: 'e', name: 'e' },
};

function isKorean(char: string): boolean {
  const code = char.charCodeAt(0);
  return (
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0x3131 && code <= 0x3163) ||
    (code >= 0x1100 && code <= 0x11ff)
  );
}

function segmentText(text: string): { text: string; isKorean: boolean }[] {
  if (!text) return [];
  const segments: { text: string; isKorean: boolean }[] = [];
  let current = '';
  let currentIsKorean = false;

  for (const char of text) {
    const charIsKorean = isKorean(char);
    if (current.length === 0) {
      current = char;
      currentIsKorean = charIsKorean;
    } else if (charIsKorean === currentIsKorean) {
      current += char;
    } else {
      segments.push({ text: current, isKorean: currentIsKorean });
      current = char;
      currentIsKorean = charIsKorean;
    }
  }
  if (current) {
    segments.push({ text: current, isKorean: currentIsKorean });
  }
  return segments;
}

function lookupWord(word: string): { romanization: string; translation: string } | null {
  if (DICTIONARY[word]) return DICTIONARY[word];
  const particles = ['을', '를', '이', '가', '는', '은', '에', '서', '도', '의', '와', '과', '로'];
  for (const p of particles) {
    if (word.endsWith(p) && word.length > p.length) {
      const stem = word.slice(0, -p.length);
      if (DICTIONARY[stem]) return DICTIONARY[stem];
    }
  }
  if (word.length === 1 && JAMO_DICT[word]) {
    const j = JAMO_DICT[word];
    return { romanization: j.romanization, translation: j.name };
  }
  return null;
}

function romanizeSyllable(char: string): string | null {
  const code = char.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return null;
  const INITIALS = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'];
  const MEDIALS = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'];
  const FINALS = ['', 'g', 'kk', 'gs', 'n', 'nj', 'nh', 'd', 'l', 'lg', 'lm', 'lb', 'ls', 'lt', 'lp', 'lh', 'm', 'b', 'bs', 's', 'ss', 'ng', 'j', 'ch', 'k', 't', 'p', 'h'];
  const offset = code - 0xac00;
  const initial = Math.floor(offset / (21 * 28));
  const medial = Math.floor((offset % (21 * 28)) / 28);
  const final = offset % 28;
  return `${INITIALS[initial]}${MEDIALS[medial]}${FINALS[final]}`;
}

function getTooltipInfo(word: string): { romanization: string; translation?: string } | null {
  const dictResult = lookupWord(word);
  if (dictResult) return dictResult;
  const chars = [...word];
  const romanized = chars.map((ch) => {
    if (JAMO_DICT[ch]) return JAMO_DICT[ch].romanization;
    return romanizeSyllable(ch) ?? ch;
  }).join('');
  if (romanized && romanized !== word) {
    return { romanization: romanized };
  }
  return null;
}

interface KoreanTextProps {
  text: string;
}

export function KoreanText({ text }: KoreanTextProps) {
  const [activeWord, setActiveWord] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [tooltipInfo, setTooltipInfo] = useState<{ romanization: string; translation?: string } | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const showTooltip = useCallback((word: string, target: HTMLElement) => {
    const info = getTooltipInfo(word.trim());
    if (!info) return;
    const rect = target.getBoundingClientRect();
    setActiveWord(word);
    setTooltipInfo(info);
    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
  }, []);

  const hideTooltip = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => { setActiveWord(null); }, 150);
  }, []);

  const handleMouseEnter = useCallback((word: string, e: React.MouseEvent) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    showTooltip(word, e.currentTarget as HTMLElement);
  }, [showTooltip]);

  const handleTap = useCallback((word: string, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (activeWord === word) { setActiveWord(null); return; }
    showTooltip(word, e.currentTarget as HTMLElement);
  }, [activeWord, showTooltip]);

  const segments = segmentText(text);
  const tooltipVisible = activeWord && tooltipInfo && tooltipPos;

  return (
    <>
      <span className="relative inline">
        {segments.map((seg, i) => {
          if (!seg.isKorean) {
            return <span key={i}>{seg.text}</span>;
          }
          return (
            <span
              key={i}
              onClick={(e) => handleTap(seg.text.trim(), e)}
              onMouseEnter={(e) => handleMouseEnter(seg.text.trim(), e)}
              onMouseLeave={hideTooltip}
              data-korean
              className="text-ko cursor-pointer border-b border-dotted border-[var(--color-accent-gold)]/40 hover:border-[var(--color-accent-gold)] active:border-[var(--color-accent-gold)]"
            >
              {seg.text}
            </span>
          );
        })}
      </span>

      {mounted && tooltipVisible && createPortal(
        <div
          className="korean-tooltip fade-in pointer-events-auto"
          onMouseEnter={() => { if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current); }}
          onMouseLeave={hideTooltip}
          style={{
            position: 'fixed',
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y - 8}px`,
            transform: 'translate(-50%, -100%)',
            zIndex: 99999,
          }}
        >
          <div className="rounded-lg bg-[#16213e] border border-[var(--color-accent-gold)]/40 px-3 py-2 shadow-lg text-left min-w-[140px]">
            <p className="text-sm font-medium text-[var(--color-accent-gold)] m-0">{activeWord}</p>
            {tooltipInfo.romanization && (
              <p className="text-xs text-[var(--color-text-muted)] m-0">{tooltipInfo.romanization}</p>
            )}
            {tooltipInfo.translation && (
              <p className="text-xs text-[var(--color-text)] mt-0.5 m-0">{tooltipInfo.translation}</p>
            )}
          </div>
          <div className="flex justify-center">
            <div className="w-2 h-2 rotate-45 bg-[#16213e] border-r border-b border-[var(--color-accent-gold)]/40 -mt-1" />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
