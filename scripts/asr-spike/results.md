# ASR spike results

Generated 2026-11-01T11:57:27.909Z · engines: gpt4o, whisper (Muse skipped: no MODEL_API_KEY) · audio: edge-tts (ko-KR-SunHiNeural; en-US-GuyNeural for the accented line), variants normal/fast/noisy

## Summary by engine and variant

| Engine | Variant | Slot checks passed | Mean jamo error | Phonetic lines normalised to spelling | Transcripts with U+FFFD |
|---|---|---|---|---|---|
| gpt4o | normal | 12/16 (75%) | 0.210 | 2/3 | 6/16 |
| whisper | normal | 12/16 (75%) | 0.247 | 2/3 | 0/16 |
| gpt4o | fast | 12/16 (75%) | 0.210 | 3/3 | 6/16 |
| whisper | fast | 15/16 (94%) | 0.242 | 3/3 | 0/16 |
| gpt4o | noisy | 14/16 (88%) | 0.200 | 3/3 | 6/16 |
| whisper | noisy | 14/16 (88%) | 0.245 | 3/3 | 0/16 |

Mean jamo error is over lines where the audio says the target (wrong-answer and phonetic lines excluded). Wrong-answer lines pass when the checker does *not* find the target slots. U+FFFD (�) in gpt4o-via-Replicate transcripts is a wrapper bug, not the model: slot checks treat it as a wildcard, jamo error counts it as wrong.

## Every transcript

| Line | Eval | Engine | Variant | Said | Heard | Slots | Pass | JER |
|---|---|---|---|---|---|---|---|---|
| e1_order | 1 | gpt4o | normal | 김밥 두 줄하고 떡볶이 일 인분, 라면 두 개 주세요 | 김�� 두 줄하고 ����이 1인분, 라면 두 개 주세요. | 6/6 | ✓ | 0.26 |
| e1_order | 1 | whisper | normal | 김밥 두 줄하고 떡볶이 일 인분, 라면 두 개 주세요 | 김밥 2주라고 떡볶이 1인분, 라면 2개 주세요. | 5/6 | ✗ | 0.17 |
| e1_order | 1 | gpt4o | fast | 김밥 두 줄하고 떡볶이 일 인분, 라면 두 개 주세요 | 김�� 두 줄하고 ����이 1인분, 라면 두 개 주세요. | 6/6 | ✓ | 0.26 |
| e1_order | 1 | whisper | fast | 김밥 두 줄하고 떡볶이 일 인분, 라면 두 개 주세요 | 김밥 2줄하고 떡볶이 1인분, 라면 2개 주세요. | 6/6 | ✓ | 0.15 |
| e1_order | 1 | gpt4o | noisy | 김밥 두 줄하고 떡볶이 일 인분, 라면 두 개 주세요 | 김�� 두 줄하고 ����이 1인분, 라면 두 개 주세요. | 6/6 | ✓ | 0.26 |
| e1_order | 1 | whisper | noisy | 김밥 두 줄하고 떡볶이 일 인분, 라면 두 개 주세요 | 김밥 2줄하고 떡볶이 1인분, 라면 2개 주세요. | 6/6 | ✓ | 0.15 |
| e1_order_wrong_counter | 1 | gpt4o | normal | 김밥 두 개하고 떡볶이 이 인분, 라면 두 개 주세요 | 김�� 두 개하고 ����이 2인분, 라면 두 개 주세요. | 2/2 | ✗ | 0.32 |
| e1_order_wrong_counter | 1 | whisper | normal | 김밥 두 개하고 떡볶이 이 인분, 라면 두 개 주세요 | 김밥 2개하고 떡볶이 2인분, 라면 2개 주세요. | 0/2 | ✓ | 0.21 |
| e1_order_wrong_counter | 1 | gpt4o | fast | 김밥 두 개하고 떡볶이 이 인분, 라면 두 개 주세요 | 김�� 두 개하고 ����이 이 인분, 라면 두 개 주세요. | 2/2 | ✗ | 0.28 |
| e1_order_wrong_counter | 1 | whisper | fast | 김밥 두 개하고 떡볶이 이 인분, 라면 두 개 주세요 | 김밥 2개하고 떡볶이 2인분, 라면 2개 주세요. | 0/2 | ✓ | 0.21 |
| e1_order_wrong_counter | 1 | gpt4o | noisy | 김밥 두 개하고 떡볶이 이 인분, 라면 두 개 주세요 | 김�� 두 개하고 ����이 2인분, 라면 두 개 주세요. | 2/2 | ✗ | 0.32 |
| e1_order_wrong_counter | 1 | whisper | noisy | 김밥 두 개하고 떡볶이 이 인분, 라면 두 개 주세요 | 김밥 2개하고 떡볶이 2인분, 라면 2개 주세요. | 0/2 | ✓ | 0.21 |
| e1_order_accented | 1 | gpt4o | normal | Gimbap du jul hago, tteokbokki il inbun, ramyeon du gae juseyo | 김�� 두 줄 하고, ��배기 아이엘린번, 라면 두 개 주세요. | 4/6 | ✗ | 0.28 |
| e1_order_accented | 1 | whisper | normal | Gimbap du jul hago, tteokbokki il inbun, ramyeon du gae juseyo | 김밥두 July Hago, 택박기 IL Inbun, 래미인두 기 주지요. | 1/6 | ✗ | 0.62 |
| e1_order_accented | 1 | gpt4o | fast | Gimbap du jul hago, tteokbokki il inbun, ramyeon du gae juseyo | 김��도 잘라 하고 �� 바��어야 하는 분, ��인 두기 주시오. | 4/6 | ✗ | 0.55 |
| e1_order_accented | 1 | whisper | fast | Gimbap du jul hago, tteokbokki il inbun, ramyeon du gae juseyo | 김밥두 July Hago, 택박기 IL Inbun, 렌이인두 기 주지요. | 1/6 | ✗ | 0.62 |
| e1_order_accented | 1 | gpt4o | noisy | Gimbap du jul hago, tteokbokki il inbun, ramyeon du gae juseyo | 김�� 두 줄과 하고 ��바키 아이엘린번, 라면 두 개 주세요. | 4/6 | ✗ | 0.34 |
| e1_order_accented | 1 | whisper | noisy | Gimbap du jul hago, tteokbokki il inbun, ramyeon du gae juseyo | 김밥 두 July 하고, 택밖에 아예 은근, 렌이 안 두기 주지요. | 1/6 | ✗ | 0.49 |
| e1_family | 1 | gpt4o | normal | 가족이 네 명이에요 | 가족이 네 명이에요. | 1/1 | ✓ | 0.00 |
| e1_family | 1 | whisper | normal | 가족이 네 명이에요 | 가족이 4명이에요. | 1/1 | ✓ | 0.11 |
| e1_family | 1 | gpt4o | fast | 가족이 네 명이에요 | 가족이 네 명이에요. | 1/1 | ✓ | 0.00 |
| e1_family | 1 | whisper | fast | 가족이 네 명이에요 | 가족이 4명이에요. | 1/1 | ✓ | 0.11 |
| e1_family | 1 | gpt4o | noisy | 가족이 네 명이에요 | 가족이 네 명이에요. | 1/1 | ✓ | 0.00 |
| e1_family | 1 | whisper | noisy | 가족이 네 명이에요 | 가족이 4명이에요. | 1/1 | ✓ | 0.11 |
| e1_weekend | 1 | gpt4o | normal | 주말에 보통 친구하고 영화 봐요 | 주말에 보통 친구하고 영화 ��요. | 3/3 | ✓ | 0.07 |
| e1_weekend | 1 | whisper | normal | 주말에 보통 친구하고 영화 봐요 | 주말에 보통 친구하고 영화 봐요. | 3/3 | ✓ | 0.00 |
| e1_weekend | 1 | gpt4o | fast | 주말에 보통 친구하고 영화 봐요 | 주말에 보통 친구하고 영화 ��요. | 3/3 | ✓ | 0.07 |
| e1_weekend | 1 | whisper | fast | 주말에 보통 친구하고 영화 봐요 | 주말에 보통 친구하고 영화 봐요. | 3/3 | ✓ | 0.00 |
| e1_weekend | 1 | gpt4o | noisy | 주말에 보통 친구하고 영화 봐요 | 주말에 보통 친구하고 영화 ��요. | 3/3 | ✓ | 0.07 |
| e1_weekend | 1 | whisper | noisy | 주말에 보통 친구하고 영화 봐요 | 주말에 보통 친구하고 영화 봐요. | 3/3 | ✓ | 0.00 |
| e2_booking | 2 | gpt4o | normal | 토요일 오후 두 시에 B룸에서 연습해요 | 토요일 오후 두 시에 비룸에서 연습해요. | 4/4 | ✓ | 0.06 |
| e2_booking | 2 | whisper | normal | 토요일 오후 두 시에 B룸에서 연습해요 | 토요일 오후 2시에 빌움에서 연습해요. | 3/4 | ✗ | 0.14 |
| e2_booking | 2 | gpt4o | fast | 토요일 오후 두 시에 B룸에서 연습해요 | 토요일 오후 두 시에 비룸에서 연습해요. | 4/4 | ✓ | 0.06 |
| e2_booking | 2 | whisper | fast | 토요일 오후 두 시에 B룸에서 연습해요 | 토요일 오후 2시에 비룸에서 연습해요. | 4/4 | ✓ | 0.11 |
| e2_booking | 2 | gpt4o | noisy | 토요일 오후 두 시에 B룸에서 연습해요 | 토요일 오후 2시에 비룸에서 연습해요. | 4/4 | ✓ | 0.11 |
| e2_booking | 2 | whisper | noisy | 토요일 오후 두 시에 B룸에서 연습해요 | 토요일 오후 2시에 빌움에서 연습해요. | 3/4 | ✗ | 0.14 |
| e2_booking_wrong | 2 | gpt4o | normal | 일요일 오후 세 시에 B룸에서 연습해요 | 일요일 오후 세 시에 비룸에서 연습해요. | 0/2 | ✓ | 0.20 |
| e2_booking_wrong | 2 | whisper | normal | 일요일 오후 세 시에 B룸에서 연습해요 | 일요일 오후 3시에 빌움에서 연습해요. | 0/2 | ✓ | 0.23 |
| e2_booking_wrong | 2 | gpt4o | fast | 일요일 오후 세 시에 B룸에서 연습해요 | 일요일 오후 세 시에 비룸에서 연습해요. | 0/2 | ✓ | 0.20 |
| e2_booking_wrong | 2 | whisper | fast | 일요일 오후 세 시에 B룸에서 연습해요 | 일요일 오후 3시에 비룸에서 연습해요. | 0/2 | ✓ | 0.20 |
| e2_booking_wrong | 2 | gpt4o | noisy | 일요일 오후 세 시에 B룸에서 연습해요 | 일요일 오후 세 시에 비룸에서 연습해요. | 0/2 | ✓ | 0.20 |
| e2_booking_wrong | 2 | whisper | noisy | 일요일 오후 세 시에 B룸에서 연습해요 | 일요일 오후 3시에 빌움에서 연습해요. | 0/2 | ✓ | 0.23 |
| e2_time | 2 | gpt4o | normal | 세 시 삼십 분 | 세 시 삼십 분. | 2/2 | ✓ | 0.00 |
| e2_time | 2 | whisper | normal | 세 시 삼십 분 | 3시 30분 | 2/2 | ✓ | 0.62 |
| e2_time | 2 | gpt4o | fast | 세 시 삼십 분 | 세시 삼십분. | 2/2 | ✓ | 0.00 |
| e2_time | 2 | whisper | fast | 세 시 삼십 분 | 3시 30분 | 2/2 | ✓ | 0.62 |
| e2_time | 2 | gpt4o | noisy | 세 시 삼십 분 | 세 시 삼십 분. | 2/2 | ✓ | 0.00 |
| e2_time | 2 | whisper | noisy | 세 시 삼십 분 | 3시 30분 | 2/2 | ✓ | 0.62 |
| e3_phone_favour | 3 | gpt4o | normal | 죄송한데 전화 한 통만 써도 될까요? | 죄송한데 전화 한 통만 ��도 될까요? | 4/4 | ✓ | 0.06 |
| e3_phone_favour | 3 | whisper | normal | 죄송한데 전화 한 통만 써도 될까요? | 죄송한데 전화 한 통만 써도 될까요? | 4/4 | ✓ | 0.00 |
| e3_phone_favour | 3 | gpt4o | fast | 죄송한데 전화 한 통만 써도 될까요? | 죄송한데 전화 한 통만 ��도 될까요? | 4/4 | ✓ | 0.06 |
| e3_phone_favour | 3 | whisper | fast | 죄송한데 전화 한 통만 써도 될까요? | 죄송한데 전화 한 통만 써도 될까요? | 4/4 | ✓ | 0.00 |
| e3_phone_favour | 3 | gpt4o | noisy | 죄송한데 전화 한 통만 써도 될까요? | 죄송한데 전화 한 통만 ��도 될까요? | 4/4 | ✓ | 0.06 |
| e3_phone_favour | 3 | whisper | noisy | 죄송한데 전화 한 통만 써도 될까요? | 죄송한데 전화 한 통만 써도 될까요? | 4/4 | ✓ | 0.00 |
| e3_lesson_favour | 3 | gpt4o | normal | 보컬 레슨을 목요일로 바꿔 주실 수 있어요? | 보컬 레슨을 목요일로 바���주실 수 있어요? | 4/4 | ✓ | 0.07 |
| e3_lesson_favour | 3 | whisper | normal | 보컬 레슨을 목요일로 바꿔 주실 수 있어요? | 보컬 레슨을 목요일로 바꿔주실 수 있어요? | 4/4 | ✓ | 0.00 |
| e3_lesson_favour | 3 | gpt4o | fast | 보컬 레슨을 목요일로 바꿔 주실 수 있어요? | 보컬 레슨을 목요일로 바���주실 수 있어요? | 4/4 | ✓ | 0.07 |
| e3_lesson_favour | 3 | whisper | fast | 보컬 레슨을 목요일로 바꿔 주실 수 있어요? | 보컬 레슨을 목요일로 바꿔주실 수 있어요? | 4/4 | ✓ | 0.00 |
| e3_lesson_favour | 3 | gpt4o | noisy | 보컬 레슨을 목요일로 바꿔 주실 수 있어요? | 보컬 레슨을 목요일로 바���주실 수 있어요? | 4/4 | ✓ | 0.07 |
| e3_lesson_favour | 3 | whisper | noisy | 보컬 레슨을 목요일로 바꿔 주실 수 있어요? | 보컬 레슨을 목요일로 바꿔주실 수 있어요. | 4/4 | ✓ | 0.00 |
| e3_code4 | 3 | gpt4o | normal | 공팔이사 별표 | 0824별표. | 2/2 | ✓ | 0.67 |
| e3_code4 | 3 | whisper | normal | 공팔이사 별표 | 0824 별표 | 2/2 | ✓ | 0.67 |
| e3_code4 | 3 | gpt4o | fast | 공팔이사 별표 | 0824별표 | 2/2 | ✓ | 0.67 |
| e3_code4 | 3 | whisper | fast | 공팔이사 별표 | 0824 별표 | 2/2 | ✓ | 0.67 |
| e3_code4 | 3 | gpt4o | noisy | 공팔이사 별표 | 0824별표 | 2/2 | ✓ | 0.67 |
| e3_code4 | 3 | whisper | noisy | 공팔이사 별표 | 0824 별표 | 2/2 | ✓ | 0.67 |
| e3_code6 | 3 | gpt4o | normal | 공팔이사칠일 별표 | 082471별표 | 2/2 | ✓ | 0.76 |
| e3_code6 | 3 | whisper | normal | 공팔이사칠일 별표 | 082471 별표 | 2/2 | ✓ | 0.76 |
| e3_code6 | 3 | gpt4o | fast | 공팔이사칠일 별표 | 08247별표. | 1/2 | ✗ | 0.76 |
| e3_code6 | 3 | whisper | fast | 공팔이사칠일 별표 | 082471 별표 | 2/2 | ✓ | 0.76 |
| e3_code6 | 3 | gpt4o | noisy | 공팔이사칠일 별표 | 082471별표. | 2/2 | ✓ | 0.76 |
| e3_code6 | 3 | whisper | noisy | 공팔이사칠일 별표 | 082471 별표 | 2/2 | ✓ | 0.76 |
| e3_linked | 3 | gpt4o | normal | 같이 있어요 | 가치 있어요. | 1/2 | ✗ | 0.17 |
| e3_linked | 3 | whisper | normal | 같이 있어요 | 같이 있어요. | 2/2 | ✓ | 0.00 |
| e3_linked | 3 | gpt4o | fast | 같이 있어요 | 가치 있어요. | 1/2 | ✗ | 0.17 |
| e3_linked | 3 | whisper | fast | 같이 있어요 | 같이 있어요. | 2/2 | ✓ | 0.00 |
| e3_linked | 3 | gpt4o | noisy | 같이 있어요 | 같이 있어요. | 2/2 | ✓ | 0.00 |
| e3_linked | 3 | whisper | noisy | 같이 있어요 | 같이 있어요. | 2/2 | ✓ | 0.00 |
| phon_gachi | 3 | gpt4o | normal | 가치 이써요 | 가치 있어요. | 1/2 | ✗ | 0.17 |
| phon_gachi | 3 | whisper | normal | 가치 이써요 | 같이 있어요. | 2/2 | ✓ | 0.00 |
| phon_gachi | 3 | gpt4o | fast | 가치 이써요 | 같이 있어요. | 2/2 | ✓ | 0.00 |
| phon_gachi | 3 | whisper | fast | 가치 이써요 | 같이 있어요. | 2/2 | ✓ | 0.00 |
| phon_gachi | 3 | gpt4o | noisy | 가치 이써요 | 같이 있어요. | 2/2 | ✓ | 0.00 |
| phon_gachi | 3 | whisper | noisy | 가치 이써요 | 같이 있어요. | 2/2 | ✓ | 0.00 |
| phon_gamsa | 7 | gpt4o | normal | 감사함니다 | 감사합니다. | 1/1 | ✓ | 0.00 |
| phon_gamsa | 7 | whisper | normal | 감사함니다 | 감사합니다. | 1/1 | ✓ | 0.00 |
| phon_gamsa | 7 | gpt4o | fast | 감사함니다 | 감사합니다. | 1/1 | ✓ | 0.00 |
| phon_gamsa | 7 | whisper | fast | 감사함니다 | 감사합니다. | 1/1 | ✓ | 0.00 |
| phon_gamsa | 7 | gpt4o | noisy | 감사함니다 | 감사합니다. | 1/1 | ✓ | 0.00 |
| phon_gamsa | 7 | whisper | noisy | 감사함니다 | 감사합니다. | 1/1 | ✓ | 0.00 |
| phon_gamsa_stiff | 7 | gpt4o | normal | 감, 사, 합, 니, 다 | 감사합니다. | 1/1 | ✓ | 0.00 |
| phon_gamsa_stiff | 7 | whisper | normal | 감, 사, 합, 니, 다 | 감 자 합 니 다 | 0/1 | ✗ | 0.08 |
| phon_gamsa_stiff | 7 | gpt4o | fast | 감, 사, 합, 니, 다 | 감사합니다. | 1/1 | ✓ | 0.00 |
| phon_gamsa_stiff | 7 | whisper | fast | 감, 사, 합, 니, 다 | 감 사 합 니 다. | 1/1 | ✓ | 0.00 |
| phon_gamsa_stiff | 7 | gpt4o | noisy | 감, 사, 합, 니, 다 | 감사합니다. | 1/1 | ✓ | 0.00 |
| phon_gamsa_stiff | 7 | whisper | noisy | 감, 사, 합, 니, 다 | 감사합니다. | 1/1 | ✓ | 0.00 |

## Conclusion

Run of 2026-11-01. **Muse was not tested: there is no `MODEL_API_KEY` on this host.** The audio is TTS (edge-tts), not learners. OpenAI direct has no credit, so gpt-4o-transcribe ran through Replicate, whose wrapper corrupts some Hangul syllables to U+FFFD. Whisper large-v3 ran through Replicate.

1. **Content and slot checks work for evals 1–3.** The intended answer was recognised in every case except two: one Whisper mis-hearing of 두 줄 (normal speed only), and "B룸", which came back as 빌움 or 비룸. Items, counters (줄/개/인분), day and time, and the fast door code (0824*, 082471*) all came through. Every wrong-counter and wrong-day answer was rejected. Engines write numbers as digits (2줄, 3시 30분, 0824), so slot matching must accept both forms. Room names and other Latin-letter tokens should be tapped, not spoken.
2. **ASR text cannot judge pronunciation.** Spoken from the spellings 가치 이써요 and 감사함니다, the audio came back as 같이 있어요 / 감사합니다 in 16 of 18 runs. gpt-4o also wrote a correctly spoken 같이 as 가치 (the word for "value"). Correct sound and "wrong" sound map to the same text. Scoring should compare in pronunciation space: run g2p on both target and transcript. Eval 3's "write the real spelling" dictation (hearing [가치 이써요] and writing 같이 있어요) is a *typing* task and needs no ASR.
3. **An English-accented romanised attempt** fails clearly on Whisper (1/6 slots: "July Hago", "택박기"). gpt-4o gets 4/6 at every speed. It rebuilds 두 줄 and 라면 두 개 주세요 from heavily accented audio, so a language-model ASR is generous to learners. That is fine for "did they communicate", but it overstates accuracy. Whether real beginners who are accented rather than romanising pass needs **real recordings** (`--wav-dir`).
4. **What Muse would add:** streaming at 80 ms with end-of-speech detection, which suits the eval 3 phone call and a natural turn-taking interview. It also offers `keywords` biasing toward the menu or slot vocabulary, cheap pricing ($0.18/h), and Korean among its 25 validated languages.
5. **What Muse lacks for this use (per docs):** no confidence scores, no word-level timestamps, no phoneme output, and keywords can't force spelling. It is a slot and intelligibility checker, not a pronunciation scorer, which is the same limit as the baselines. Phoneme-level scoring (eval 7 shout-in-silence, vocal rounds) still needs a pronunciation-assessment service or forced alignment. Next step: set `MODEL_API_KEY` and rerun, then record 5–10 real learners per line.
