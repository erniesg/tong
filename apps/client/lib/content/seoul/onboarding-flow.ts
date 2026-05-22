import { runtimeAssetUrl } from '@/lib/runtime-assets';
import type { ExerciseData, DialogueChoice } from '@/lib/types/hangout';

export interface SeoulOnboardingChoice {
  id: string;
  text: string;
  subtext: string;
  reply: string;
  translation: string;
}

export interface SeoulOnboardingDialogueBeat {
  id: string;
  speaker: 'jin' | 'you';
  text: string;
  translation?: string;
  choices?: SeoulOnboardingChoice[];
  tongTip?: string;
  exerciseAfter?: ExerciseData;
}

export interface SeoulJinOnboardingFlow {
  id: string;
  sceneId: string;
  cityId: 'seoul';
  locationId: 'cafe';
  npcId: 'jin';
  backdropUrl: string;
  backdropVideoUrl: string;
  cinematicVideoUrl: string;
  cinematicCaption: string;
  cinematicCaptionTranslation: string;
  jinSpriteUrl: string;
  tongIntroLines: string[];
  dialogueBeats: SeoulOnboardingDialogueBeat[];
  completionTongLine: string;
  rewards: {
    xp: number;
    sp: number;
    rp: number;
  };
}

export const SEOUL_JIN_ONBOARDING_OBJECTIVE_ID = 'ko-onboarding-seoul-jin-care-check';

export const SEOUL_JIN_CARE_CHECK_EXERCISE: ExerciseData = {
  type: 'multiple_choice',
  id: 'seoul-jin-onboarding-care-check',
  objectiveId: SEOUL_JIN_ONBOARDING_OBJECTIVE_ID,
  difficulty: 1,
  prompt: 'When Jin asks “밥 먹었어요?”, what is he doing?',
  options: [
    { id: 'care', text: 'Checking if you are okay' },
    { id: 'schedule', text: 'Asking for the practice schedule' },
    { id: 'name', text: 'Asking for your Korean name' },
  ],
  correctOptionId: 'care',
  explanation: '밥 먹었어요? can literally mean “Did you eat?” but often works like a warm care-check.',
};

export const SEOUL_JIN_REPLY_CHOICES: SeoulOnboardingChoice[] = [
  {
    id: 'ate-little',
    text: '조금 먹었어요.',
    subtext: 'I ate a little.',
    reply: '조금 먹었어요. 감사합니다, 진 선배님.',
    translation: 'I ate a little. Thank you, Jin sunbae.',
  },
  {
    id: 'not-yet',
    text: '아직 안 먹었어요.',
    subtext: 'I have not eaten yet.',
    reply: '아직 안 먹었어요. 같이 가도 돼요?',
    translation: 'I have not eaten yet. Is it okay if I go with you?',
  },
  {
    id: 'nervous',
    text: '긴장돼서 못 먹었어요.',
    subtext: 'I was too nervous to eat.',
    reply: '긴장돼서 못 먹었어요. 그래도 해 볼게요.',
    translation: 'I was too nervous to eat. I will still try.',
  },
];

export function toDialogueChoices(choices: SeoulOnboardingChoice[]): DialogueChoice[] {
  return choices.map((choice) => ({
    id: choice.id,
    text: choice.text,
    subtext: choice.subtext,
    affinityHint: 'positive',
  }));
}

export function getSelectedReply(
  choices: SeoulOnboardingChoice[],
  selectedChoiceId: string | null,
): SeoulOnboardingChoice {
  return choices.find((choice) => choice.id === selectedChoiceId) ?? choices[0];
}

export function getSeoulJinOnboardingFlow(playerName = 'trainee'): SeoulJinOnboardingFlow {
  const safeName = playerName.trim() || 'trainee';

  return {
    id: 'seoul-jin-h1-onboarding',
    sceneId: 'seoul/h1-jin-cafe-care-check',
    cityId: 'seoul',
    locationId: 'cafe',
    npcId: 'jin',
    backdropUrl: runtimeAssetUrl('city.seoul.location.cafe.backdrop.default'),
    backdropVideoUrl: runtimeAssetUrl('city.seoul.map.video.default'),
    cinematicVideoUrl: runtimeAssetUrl('cinematic.jin.intro.1'),
    cinematicCaption: '괜찮아요. 천천히 와요.',
    cinematicCaptionTranslation: 'It is okay. Come slowly.',
    jinSpriteUrl: runtimeAssetUrl('character.jin.portrait.eye-front-casual'),
    tongIntroLines: [
      `${safeName}, Seoul starts softer than you expect.`,
      'Jin is a senior trainee here. Listen for how care sounds before it becomes a lesson.',
      'When he appears, answer in Korean. I will only nudge when the phrase carries more than the literal words.',
    ],
    dialogueBeats: [
      {
        id: 'jin-greeting',
        speaker: 'jin',
        text: '안녕하세요. 새로 온 연습생이죠? 저는 진이에요.',
        translation: 'Hello. You are the new trainee, right? I am Jin.',
      },
      {
        id: 'jin-care-check',
        speaker: 'jin',
        text: '긴장하지 마요. 먼저... 밥 먹었어요?',
        translation: 'Do not be nervous. First... did you eat?',
        choices: SEOUL_JIN_REPLY_CHOICES,
        tongTip: '밥 먹었어요? is not only about food here. Jin is checking whether you are okay.',
      },
      {
        id: 'you-reply',
        speaker: 'you',
        text: '',
      },
      {
        id: 'jin-lesson-bridge',
        speaker: 'jin',
        text: '좋아요. 오늘은 메뉴 읽는 것부터 시작해요. 제가 옆에 있을게요.',
        translation: 'Good. Today we start with reading the menu. I will be beside you.',
        exerciseAfter: SEOUL_JIN_CARE_CHECK_EXERCISE,
      },
      {
        id: 'jin-exists',
        speaker: 'jin',
        text: '이제 서울에서 저를 찾으면 돼요. 힘들면 맛있는 거 먹자.',
        translation: 'Now you can find me in Seoul. If it gets hard, let us eat something good.',
      },
    ],
    completionTongLine: 'Jin is now in your Seoul circle: cafe unlocked, first care-check phrase saved, and your next Seoul hangout has a real person waiting.',
    rewards: {
      xp: 60,
      sp: 25,
      rp: 12,
    },
  };
}
