export const STORY = {
  zh: {
    label: "Mandarin Chinese",
    npcName: "Lin",
    npcTitle: "Tea shop regular",
    scenes: [
      {
        line: "你今天想喝什么？",
        romanization: "Ni3 jintian1 xiang3 he1 shen2me?",
        translation: "What do you want to drink today?",
        choices: [
          {
            text: "我想喝乌龙茶。",
            romanization: "Wo3 xiang3 he1 wu1long2 cha2.",
            translation: "I want oolong tea.",
            affinityDelta: 2,
            xpDelta: 15,
            feedback: "Natural and specific. Great response."
          },
          {
            text: "随便。",
            romanization: "Sui2bian4.",
            translation: "Anything is fine.",
            affinityDelta: 0,
            xpDelta: 8,
            feedback: "Understandable, but not very engaging."
          },
          {
            text: "我不喜欢茶。",
            romanization: "Wo3 bu4 xi3huan1 cha2.",
            translation: "I don't like tea.",
            affinityDelta: -1,
            xpDelta: 6,
            feedback: "Grammatically okay, but awkward in this context."
          }
        ]
      },
      {
        line: "周末你一般做什么？",
        romanization: "Zhou1mo4 ni3 yi4ban1 zuo4 shen2me?",
        translation: "What do you usually do on weekends?",
        choices: [
          {
            text: "我喜欢看电影，也喜欢散步。",
            romanization: "Wo3 xi3huan1 kan4 dian4ying3, ye3 xi3huan1 san4bu4.",
            translation: "I like watching movies, and I like taking walks.",
            affinityDelta: 2,
            xpDelta: 18,
            feedback: "Balanced sentence with clear detail."
          },
          {
            text: "我睡觉。",
            romanization: "Wo3 shui4jiao4.",
            translation: "I sleep.",
            affinityDelta: 0,
            xpDelta: 9,
            feedback: "Correct but minimal."
          },
          {
            text: "我很忙，不知道。",
            romanization: "Wo3 hen3 mang2, bu4 zhi1dao4.",
            translation: "I'm very busy, I don't know.",
            affinityDelta: -1,
            xpDelta: 7,
            feedback: "A little distant for a warm conversation."
          }
        ]
      },
      {
        line: "下次我们一起去公园，好吗？",
        romanization: "Xia4ci4 wo3men yi4qi3 qu4 gong1yuan2, hao3 ma?",
        translation: "Shall we go to the park together next time?",
        choices: [
          {
            text: "好啊，我很期待！",
            romanization: "Hao3 a, wo3 hen3 qi1dai4!",
            translation: "Sure, I'm looking forward to it!",
            affinityDelta: 3,
            xpDelta: 20,
            feedback: "Excellent acceptance with emotional nuance."
          },
          {
            text: "可以。",
            romanization: "Ke3yi3.",
            translation: "Okay.",
            affinityDelta: 1,
            xpDelta: 10,
            feedback: "Valid but short."
          },
          {
            text: "我再想想。",
            romanization: "Wo3 zai4 xiang3xiang3.",
            translation: "I'll think about it.",
            affinityDelta: -1,
            xpDelta: 8,
            feedback: "Soft refusal tone; less romantic momentum."
          }
        ]
      }
    ]
  },
  ja: {
    label: "Japanese",
    npcName: "Aoi",
    npcTitle: "Cafe barista",
    scenes: [
      {
        line: "今日は何を飲みたいですか？",
        romanization: "Kyo wa nani o nomitai desu ka?",
        translation: "What would you like to drink today?",
        choices: [
          {
            text: "抹茶ラテをお願いします。",
            romanization: "Matcha rate o onegaishimasu.",
            translation: "Matcha latte, please.",
            affinityDelta: 2,
            xpDelta: 15,
            feedback: "Polite and natural ordering phrase."
          },
          {
            text: "なんでもいいです。",
            romanization: "Nan demo ii desu.",
            translation: "Anything is fine.",
            affinityDelta: 0,
            xpDelta: 8,
            feedback: "Common but less expressive."
          },
          {
            text: "飲み物は嫌いです。",
            romanization: "Nomimono wa kirai desu.",
            translation: "I dislike drinks.",
            affinityDelta: -1,
            xpDelta: 6,
            feedback: "Correct grammar, unusual meaning."
          }
        ]
      },
      {
        line: "週末は何をしていますか？",
        romanization: "Shumatsu wa nani o shiteimasu ka?",
        translation: "What do you do on weekends?",
        choices: [
          {
            text: "映画を見たり、散歩したりします。",
            romanization: "Eiga o mitari, sanpo shitari shimasu.",
            translation: "I watch movies and go for walks.",
            affinityDelta: 2,
            xpDelta: 18,
            feedback: "Great use of pattern for listing activities."
          },
          {
            text: "よく寝ます。",
            romanization: "Yoku nemasu.",
            translation: "I sleep a lot.",
            affinityDelta: 0,
            xpDelta: 9,
            feedback: "Totally valid, very short answer."
          },
          {
            text: "忙しいので、わかりません。",
            romanization: "Isogashii node, wakarimasen.",
            translation: "I'm busy, so I don't know.",
            affinityDelta: -1,
            xpDelta: 7,
            feedback: "Sounds distant in this social context."
          }
        ]
      },
      {
        line: "今度いっしょに公園へ行きませんか？",
        romanization: "Kondo issho ni koen e ikimasen ka?",
        translation: "Would you like to go to the park together next time?",
        choices: [
          {
            text: "ぜひ、行きたいです！",
            romanization: "Zehi, ikitai desu!",
            translation: "Definitely, I'd love to go!",
            affinityDelta: 3,
            xpDelta: 20,
            feedback: "Warm and enthusiastic acceptance."
          },
          {
            text: "いいですよ。",
            romanization: "Ii desu yo.",
            translation: "Sure.",
            affinityDelta: 1,
            xpDelta: 10,
            feedback: "Friendly but neutral tone."
          },
          {
            text: "ちょっと考えます。",
            romanization: "Chotto kangaemasu.",
            translation: "I'll think about it.",
            affinityDelta: -1,
            xpDelta: 8,
            feedback: "Soft hesitation; lower romantic momentum."
          }
        ]
      }
    ]
  },
  ko: {
    label: "Korean",
    npcName: "Minseo",
    npcTitle: "Bookstore regular",
    scenes: [
      {
        line: "오늘 뭐 마시고 싶어요?",
        romanization: "Oneul mwo masigo sipeoyo?",
        translation: "What do you want to drink today?",
        choices: [
          {
            text: "우롱차 마시고 싶어요.",
            romanization: "Urongcha masigo sipeoyo.",
            translation: "I want to drink oolong tea.",
            affinityDelta: 2,
            xpDelta: 15,
            feedback: "Natural and polite response."
          },
          {
            text: "아무거나 괜찮아요.",
            romanization: "Amugeona gwaenchanayo.",
            translation: "Anything is fine.",
            affinityDelta: 0,
            xpDelta: 8,
            feedback: "Common response, but not very personal."
          },
          {
            text: "차 싫어해요.",
            romanization: "Cha silheohaeyo.",
            translation: "I dislike tea.",
            affinityDelta: -1,
            xpDelta: 6,
            feedback: "Works grammatically, rough for this setting."
          }
        ]
      },
      {
        line: "주말에 보통 뭐 해요?",
        romanization: "Jumare botong mwo haeyo?",
        translation: "What do you usually do on weekends?",
        choices: [
          {
            text: "영화도 보고 산책도 해요.",
            romanization: "Yeonghwado bogo sanchaekdo haeyo.",
            translation: "I watch movies and take walks.",
            affinityDelta: 2,
            xpDelta: 18,
            feedback: "Great balanced answer using -do pattern."
          },
          {
            text: "잠을 많이 자요.",
            romanization: "Jameul mani jayo.",
            translation: "I sleep a lot.",
            affinityDelta: 0,
            xpDelta: 9,
            feedback: "Correct and natural, just short."
          },
          {
            text: "바빠서 잘 모르겠어요.",
            romanization: "Bappaseo jal moreugesseoyo.",
            translation: "I'm busy, so I'm not sure.",
            affinityDelta: -1,
            xpDelta: 7,
            feedback: "A bit cold in a dating context."
          }
        ]
      },
      {
        line: "다음에 같이 공원 갈래요?",
        romanization: "Daeume gachi gongwon gallaeyo?",
        translation: "Do you want to go to the park together next time?",
        choices: [
          {
            text: "네, 정말 기대돼요!",
            romanization: "Ne, jeongmal gidaedwaeyo!",
            translation: "Yes, I'm really excited!",
            affinityDelta: 3,
            xpDelta: 20,
            feedback: "Warm and enthusiastic acceptance."
          },
          {
            text: "좋아요.",
            romanization: "Joayo.",
            translation: "Sounds good.",
            affinityDelta: 1,
            xpDelta: 10,
            feedback: "Friendly but simple."
          },
          {
            text: "생각해 볼게요.",
            romanization: "Saenggakhae bolgeyo.",
            translation: "I'll think about it.",
            affinityDelta: -1,
            xpDelta: 8,
            feedback: "Soft hesitation; less chemistry gain."
          }
        ]
      }
    ]
  }
};
