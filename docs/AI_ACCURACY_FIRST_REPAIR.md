# AI Accuracy-First Repair

## What Regressed

The critical regression was title extraction on recurring schedule utterances such as:

- `接下来一周我每天晚上9点要做30分钟托福`

The old extraction path could collapse this into a shell fragment like:

- `我每天晚上9点要做`

That made the system fast in simple cases but semantically unacceptable in production.

## Root Cause

The regression was not just a prompt problem.

The real causes were:

1. title extraction relied on shell-stripping and crude truncation
2. fast deterministic paths could still execute with malformed titles
3. there was no explicit confidence gate before fast-path writes
4. summary strings were not centralized around actual mutation semantics

Because of that, wrong titles could still be written and then echoed back in success messages.

## Why Prompt-Only Fixes Are Not Enough

Prompt examples help, but they do not prevent:

- malformed regex extraction
- low-confidence fast-path writes
- route-level misclassification
- summaries that describe the wrong entity

So the repair had to change:

- route orchestration
- title extraction
- fast-path safety checks
- execution summaries
- tests

## Canonical AI Path

There are now two thin route adapters:

- web: `/api/ai`
- mobile: `/api/mobile/v1/ai/chat`

Both call the same shared core:

- `src/server/services/ai-chat-service.ts`

That shared core performs:

1. route classification
2. non-db chat or deterministic fast path or full planner
3. deterministic executor
4. centralized summary generation
5. streaming response

This is the canonical path.

## Title Extraction Rules

Implemented in:

- `src/server/ai/title-extractor.ts`

The extractor now removes:

- pronouns
- modal shells
- recurring/frequency shells
- coarse and precise time expressions
- duration expressions

and then extracts a core activity.

Examples:

- `接下来一周我每天晚上9点要做30分钟托福` -> `托福`
- `接下来三天每天早上7点背30分钟单词` -> `单词`
- `未来一周每晚8点练1小时吉他` -> `吉他练习`
- `明天下午三点写报告半小时` -> `写报告`
- `我明天中午十二点要吃药` -> `吃药`

## Fast Path Safety Boundary

Fast path is only allowed when:

- route intent is high confidence
- title extraction confidence is at least `0.95`

If title confidence is lower than that, the request must degrade to the full planner path.

This prevents speed optimizations from writing malformed entities.

## Why `接下来一周我每天晚上9点要做30分钟托福` Must Be a Recurring Schedule

This sentence expresses:

- a repeated cadence
- a specific time of day
- a duration
- a concrete activity

That is a recurring work session, so the correct representation is:

- one clean task title: `托福`
- repeated `TimeBlock`s for the next 7 days
- each block scheduled at local `21:00-21:30`

It is not:

- inbox
- note
- a single unplanned task
- a malformed shell title

## Why Accuracy Still Comes Before Speed

Performance improvements are now constrained by safety:

- obvious reminder/deadline/schedule cases can fast-path
- ambiguous title extraction cannot
- non-db chat skips DB entirely
- full planner only runs when needed

So speed comes from avoiding unnecessary work, not from weakening semantic guarantees.
