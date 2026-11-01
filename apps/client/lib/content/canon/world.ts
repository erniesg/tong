import type { WorldCanon } from '../../relationship/canon-types';

/** Seoul route canon. Fictional agency; real neighbourhoods. */
export const SEOUL_WORLD: WorldCanon = {
  agency: {
    ko: '온새 엔터테인먼트',
    en: 'Onsae Entertainment',
    note: 'Mid-size Hongdae agency with an idol trainee program and a small actor roster. Trainees and actors share the building; that is how Jin is around.',
  },
  calendar: [
    { month: 1, label: 'March: you arrive', eval: 'Placement eval (dance, vocal, Korean)', beats: ['H0 arrival', 'H1 pairing', 'H2 drills'] },
    { month: 2, label: 'April: cherry blossoms', eval: 'Monthly eval', beats: ['H3 sneak-out by accident'] },
    { month: 3, label: 'May', eval: 'Monthly eval; stage check (friend or rival)', beats: ['first rivalry minigame'] },
    { month: 4, label: 'June', eval: 'Monthly eval', beats: ['H4 "나와."'] },
    { month: 5, label: 'July: 장마 (monsoon)', eval: 'Monthly eval', beats: ['H5 tutor / English-lyrics role reversal', 'rain forces proximity'] },
    { month: 6, label: 'August', eval: 'Monthly eval', beats: ['H6 almost caught (stealth)'] },
    { month: 7, label: 'September: 추석 (Chuseok)', eval: 'Monthly eval', beats: ['Chuseok: everyone goes home but Haeun can\'t afford Jeju', 'H7 rooftop'] },
    { month: 8, label: 'October', eval: 'Monthly eval', beats: ['H8 Jeju slips out'] },
    { month: 9, label: 'November', eval: 'Monthly eval', beats: ['H9 the notebook', 'rare fogged window'] },
    { month: 10, label: 'December: 첫눈 (first snow)', eval: 'Monthly eval', beats: ['H10 Sua', 'first snow confession window'] },
    { month: 11, label: 'January', eval: 'Monthly eval', beats: ['H11 the decision'] },
    { month: 12, label: 'February', eval: 'Final evaluation', beats: ['H12 the night before'] },
  ],
  places: [
    { id: 'practice_studio', name: { ko: '연습실', en: 'Practice Studio' }, note: 'Onsae\'s rehearsal floor. Mirror wall, ranking sheet, water bottles with name tags.' },
    { id: 'agency_lockers', name: { ko: '사물함', en: 'Trainee lockers' }, note: 'Corridor outside the studio. Your locker was Sua\'s.' },
    { id: 'convenience_store', name: { ko: '편의점', en: 'Convenience store' }, note: '24h. Plastic chairs outside. The ramyeon ritual.' },
    { id: 'dorm', name: { ko: '숙소', en: 'Trainee dorm' }, note: 'Yeonnam Apartments. Girls and boys on separate floors; curfew 23:00; night check by the dorm manager.' },
    { id: 'dorm_rooftop', name: { ko: '옥상', en: 'Dorm rooftop' }, note: 'Yeonnam Apartments rooftop terrace: 평상, drying rack, string lights. Haeun\'s private place.' },
    { id: 'food_street', name: { ko: '포장마차', en: 'Pojangmacha' }, note: 'Jin\'s onboarding place. Trainees can\'t casually be here; Haeun is never here early.' },
    { id: 'cafe', name: { ko: '카페 봄', en: 'Café Bom' }, note: 'Jin\'s regular spot.' },
    { id: 'han_river', name: { ko: '한강', en: 'Han River' }, note: 'Riverbank, chimaek delivery.' },
    { id: 'yeonnam_cafe', name: { ko: '연남동 카페', en: 'Yeonnam café' }, note: 'Where Sua works now. Not on the route until Act 3.' },
  ],
  people: [
    { id: 'coach_park', name: { ko: '박 코치', en: 'Coach Park' }, relation: 'dance coach', note: 'Blunt, fair. Says "다시." more than Haeun does.' },
    { id: 'manager_choi', name: { ko: '최 실장', en: 'Manager Choi' }, relation: 'dorm/trainee manager', note: 'Night checks with a flashlight. Not cruel, just the system.' },
    { id: 'minji', name: { ko: '민지', en: 'Minji' }, relation: 'trainee', note: 'Gossip. Says the "Sua\'s spot" line in H1.' },
    { id: 'yerin', name: { ko: '예린', en: 'Yerin' }, relation: 'trainee', note: 'Minji\'s shadow.' },
  ],
  rules: [
    'Twelve in-game months, March to February, one evaluation per month. The calendar advances with play, not real time. Learn sessions do not use up nights.',
    'The player is a foreign trainee of either gender (cozy creator). Nothing may depend on sharing a dorm room with Haeun. You inherit Sua\'s lineup spot and her agency locker, not her bed.',
    'Trainees are under a dating ban and a curfew; contracts restrict social media and public appearances.',
    'No masked busking. Haeun\'s defiance is curfew breaks, the convenience store, the rooftop.',
    'Jeju lines (제주어) are written or approved by a Jeju speaker; Tong cannot translate them.',
  ],
};
