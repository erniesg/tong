// Romanisation for the hover/tap lookups (apps/client/public/cozy/js/romanize.js): node --test scripts/cozy-romanize.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { romanize, syllables, jamoName } = await import(new URL('../apps/client/public/cozy/js/romanize.js', import.meta.url).href);

const CASES = {
  // liaison into a following ㅇ
  음악: 'eumak', 한국어: 'hangugeo', 붕어빵: 'bungeoppang', 떡볶이: 'tteokbokki', 있어요: 'isseoyo', 없어요: 'eopseoyo', 읽어요: 'ilgeoyo',
  // nasal assimilation
  입니다: 'imnida', 합니다: 'hamnida', 감사합니다: 'gamsahamnida', 십만: 'simman', 국물: 'gungmul', 독립: 'dongnip',
  // ㄹ rules
  신라: 'silla', 종로: 'jongno', 설날: 'seollal', 라면: 'ramyeon', 빨리: 'ppalli',
  // ㅎ
  좋아: 'joa', 좋다: 'jota', 어떻게: 'eotteoke', 놓고: 'noko', 괜찮아요: 'gwaenchanayo', 많다: 'manta', 싫어: 'sireo', 좋습니다: 'joseumnida', 전화: 'jeonhwa',
  // palatalisation
  같이: 'gachi', 굳이: 'guji',
  // no tense marking; g/d/b before vowels, k/t/p finals
  학교: 'hakgyo', 김밥: 'gimbap', 읽다: 'ikda', 여덟: 'yeodeol', 일곱: 'ilgop', 여섯: 'yeoseot', 다섯: 'daseot', 하나: 'hana',
  // day one
  안녕하세요: 'annyeonghaseyo', 홍대입구: 'hongdaeipgu', 연습실: 'yeonseupsil', 출구: 'chulgu', 수아: 'sua', 다온: 'daon', 하은: 'haeun', 저는: 'jeoneun', 아이고: 'aigo', 주세요: 'juseyo', 우유: 'uyu', 의자: 'uija', 왜: 'wae',
};

for (const [ko, rom] of Object.entries(CASES)) test(`${ko} → ${rom}`, () => assert.equal(romanize(ko), rom));

test('sentences keep spaces and punctuation; other scripts pass through', () => {
  assert.equal(romanize('잘 부탁드립니다'), 'jal butakdeurimnida');
  assert.equal(romanize('하나 주세요!'), 'hana juseyo!');
  assert.equal(romanize('저는 Mina입니다.'), 'jeoneun Minaimnida.');
  assert.equal(romanize('OK, 2번 출구?'), 'OK, 2beon chulgu?');
  assert.equal(romanize(''), '');
  assert.equal(romanize('ㅅ + ㅜ'), 'ㅅ + ㅜ');
});

test('syllables() gives each block its letters and its own sound', () => {
  assert.deepEqual(syllables('수아'), [
    { block: '수', lead: 'ㅅ', vowel: 'ㅜ', tail: '', rom: 'su' },
    { block: '아', lead: 'ㅇ', vowel: 'ㅏ', tail: '', rom: 'a' },
  ]);
  assert.deepEqual(syllables('다온!').map((s) => [s.block, s.lead, s.vowel, s.tail, s.rom]), [['다', 'ㄷ', 'ㅏ', '', 'da'], ['온', 'ㅇ', 'ㅗ', 'ㄴ', 'on']]);
  assert.deepEqual(syllables('없').map((s) => [s.tail, s.rom]), [['ㅄ', 'eop']]);
});

test('jamoName() labels a letter by its sound', () => {
  assert.equal(jamoName('ㅏ'), 'ㅏ a');
  assert.equal(jamoName('ㄱ'), 'ㄱ g/k');
  assert.equal(jamoName('ㅇ'), 'ㅇ silent / ng');
  assert.equal(jamoName('ㅇ', 'lead'), 'ㅇ silent');
  assert.equal(jamoName('ㅇ', 'tail'), 'ㅇ ng');
  assert.equal(jamoName('ㅅ'), 'ㅅ s/t');
  assert.equal(jamoName('ㄴ'), 'ㄴ n');
  assert.equal(jamoName('ㄹ'), 'ㄹ r/l');
  assert.equal(jamoName('ㅄ', 'tail'), 'ㅄ p');
});
