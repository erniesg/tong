// Fixed looks for the Onsae cohort and staff (canon/cohort.ts), in the
// creator's look format (characters.js LOOK_OPTIONS), so the studio and the
// dorm show the same person every time instead of a random pedestrian.
// Chosen from each canon role; nothing here is canon. Trainees are in practice
// clothes (no skirts on the floor). Tested in scripts/cozy-cohort-looks.test.mjs.

const F = { gender: 'f', eyes: 1, hood: 'down', hat: 'none', glasses: false, marks: 'none', browThick: 0.95, browLen: 1, lashLen: 0.5, lashThick: 0.9 };

export const COHORT_LOOKS = {
  // 15, the youngest; middle school in the morning, idolises Ha-eun.
  daon: { ...F, skin: 0, hair: 0, hairStyle: 'pigtails', brows: 'soft', nose: 'button', mouth: 'small', lids: 'double', topStyle: 'hoodie', top: 2, bottom: 'shorts', bottomColor: 2, shoes: 0, lashLen: 0.4 },
  // 22, seven years in, strong dancer who is slipping; looks after the dorm.
  boram: { ...F, skin: 2, hair: 1, hairStyle: 'short', brows: 'straight', nose: 'soft', mouth: 'classic', lids: 'single', marks: 'mole', topStyle: 'tee', top: 4, bottom: 'slacks', bottomColor: 2, shoes: 1, browThick: 1.15, lashLen: 0.3 },
  // 18, ex-survival-show favourite; camera-ready.
  dohee: { ...F, skin: 0, hair: 4, hairStyle: 'wavy', brows: 'arched', nose: 'line', mouth: 'full', lids: 'double', topStyle: 'knit', top: 0, bottom: 'slacks', bottomColor: 3, shoes: 0, lashLen: 0.8, lashThick: 1.1 },
  // The gossip.
  minji: { ...F, skin: 1, hair: 2, hairStyle: 'bob', brows: 'natural', nose: 'dot', mouth: 'cat', lids: 'double', marks: 'freckles', topStyle: 'hoodie', top: 3, bottom: 'jeans', bottomColor: 0, shoes: 3 },
  // Minji's echo; quietly the best vocalist.
  yerin: { ...F, skin: 1, hair: 0, hairStyle: 'ponytail', brows: 'soft', nose: 'button', mouth: 'small', lids: 'single', glasses: true, topStyle: 'tee', top: 1, bottom: 'slacks', bottomColor: 0, shoes: 0 },
  // 19, the rich kid; flawless honorifics.
  yunseo: { ...F, skin: 0, hair: 0, hairStyle: 'long', brows: 'arched', nose: 'line', mouth: 'classic', lids: 'double', topStyle: 'jacket', top: 0, bottom: 'slacks', bottomColor: 3, shoes: 2, lashLen: 0.7 },
  // The dorm and trainee manager: night checks with a flashlight. (Gender is a proposal, tbc.)
  manager_choi: { ...F, skin: 2, hair: 1, hairStyle: 'bun', brows: 'straight', nose: 'soft', mouth: 'classic', lids: 'hooded', glasses: true, topStyle: 'jacket', top: 4, bottom: 'slacks', bottomColor: 2, shoes: 1, lashLen: 0.2 },
  // Blunt, fair, says "다시." (canon: he).
  coach_park: { gender: 'm', skin: 3, hair: 0, hairStyle: 'buzz', eyes: 1, brows: 'straight', nose: 'soft', mouth: 'wide', lids: 'single', marks: 'none', topStyle: 'tee', hood: 'down', top: 4, bottom: 'slacks', bottomColor: 2, shoes: 0, hat: 'cap', glasses: false, browThick: 1.4, browLen: 1.1, lashLen: 0, lashThick: 0.8 },
};

