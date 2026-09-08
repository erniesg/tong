---
title: "Tong Mystery Evidence Graph Diagnosis"
subtitle: "Chen Wei receipt clue failure"
author: "Codex"
date: "2026-05-14"
mainfont: "Helvetica Neue"
CJKmainfont: "PingFang SC"
geometry: "margin=0.8in"
fontsize: "11pt"
colorlinks: true
---

# Tong Mystery Evidence Graph Diagnosis

## What Failed

The issue is in the evidence graph, not primarily in the UI.

The fixture tried to make this chain:

1. Chen says he left at 20:15.
2. A receipt says `麻辣面 20:22`.
3. Fang Auntie knows Chen's order.
4. Therefore, Chen was still there after his claimed departure.

But the player-visible proof does not establish that chain in the right order.

## Failure 1: The Receipt Contradiction Is Allowed Too Early

The contradiction `contr_chen_left_receipt` currently requires only:

```ts
[
  "ev_chen_intro_claim",
  "ev_receipt_2022"
]
```

That proves only this:

> Someone ordered spicy noodles at 20:22.

It does not prove this:

> Chen Wei ordered spicy noodles at 20:22.

So the receipt is only suspicious timing evidence. It is not yet incriminating evidence against Chen.

## Failure 2: The Bridge Evidence Is Too Late

The fixture does contain a bridge card:

```ts
"ev_spicy_order_memory"
```

Its claim is:

> Fang Auntie remembers Chen's regular spicy noodle order.

But that evidence unlocks after the Chen contradiction is already accepted. The runtime lets the player use the receipt to pressure Chen before the player knows why the receipt points to Chen.

## Failure 3: Food-Term Drift

The current fixture says:

```text
麻辣面 20:22
```

If the intended clue is mala tang, the fixture should consistently say:

```text
麻辣烫 20:22
```

Do not mix `麻辣面` and `麻辣烫` unless the distinction is itself part of the mystery.

## Correct Evidence Chain

The intended chain should be explicit:

1. Chen says: `我八点十五就走了。`
2. Receipt says: `麻辣烫 20:22` or `麻辣面 20:22`.
3. Fang Ayi says: `20:22 那单是陈伟常点的，而且我看见他回来拿。`
4. Therefore, Chen's 20:15 alibi is false.

In English:

1. Chen says: "I left at 8:15."
2. The receipt says: "Mala tang / spicy noodles, 20:22."
3. Fang Ayi says: "That 20:22 order is Chen Wei's usual order, and I saw him come back for it."
4. Therefore, Chen was present after 20:15.

## Recommended Fixture Fix

Split the bridge evidence into two clearer cards:

```ts
{
  evidenceId: "ev_chen_regular_order",
  type: "testimony",
  title: "Chen's Regular Order",
  claim: "Fang Ayi says Chen always orders mala tang when he comes to the stall.",
  nativeText: {
    native: "陈伟每次来都点麻辣烫。",
    romanization: "Chen Wei mei ci lai dou dian mala tang.",
    english: "Chen Wei orders mala tang every time he comes."
  }
}
```

```ts
{
  evidenceId: "ev_auntie_saw_chen_2022",
  type: "testimony",
  title: "Fang Ayi Saw Chen at 20:22",
  claim: "Fang Ayi saw Chen return to collect the 20:22 mala tang order.",
  nativeText: {
    native: "八点二十二那单，是陈伟回来拿的。",
    romanization: "Ba dian er shi er na dan, shi Chen Wei hui lai na de.",
    english: "That 20:22 order was picked up by Chen Wei when he came back."
  }
}
```

Then require the bridge evidence for the contradiction:

```ts
[
  "ev_chen_intro_claim",
  "ev_receipt_2022",
  "ev_auntie_saw_chen_2022"
]
```

## Validator Gap

The current validator checks whether referenced IDs exist. It does not check whether a contradiction is logically provable from player-visible evidence.

The validator should add a story-logic check:

```text
Every core contradiction must include evidence for:
1. the disputed statement,
2. the conflicting fact,
3. the identity bridge tying the conflicting fact to the accused cast member.
```

For this case, the identity bridge is the missing fact:

```text
The 20:22 mala order belongs to Chen Wei.
```

Without that bridge, the receipt is a timeline clue, not a solved contradiction.

