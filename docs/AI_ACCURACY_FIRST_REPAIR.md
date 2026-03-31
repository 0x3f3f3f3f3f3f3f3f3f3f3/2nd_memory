# AI Accuracy-First Repair

## Root Cause

The regression was caused by title extraction and fast-path execution being too permissive.

The specific failure:

- `接下来一周我每天晚上9点要做30分钟托福`

could be reduced to a malformed shell title like:

- `我每天晚上9点要做`

That happened because the old fast heuristics stripped surface tokens but did not reliably preserve the semantic object.

## Why Prompt-Only Fixes Are Not Enough

Prompt examples alone cannot fix:

- malformed local title extraction
- unsafe fast-path writes
- route-level over-eager heuristics
- summaries that confirm the wrong title

So the repair had to modify:

- route orchestration
- title extraction
- fast-path confidence gating
- executor action support
- summary generation
- tests

## Canonical AI Path

There are two route adapters:

- web `/api/ai`
- mobile `/api/mobile/v1/ai/chat`

Both now call the same shared core:

- `src/server/services/ai-chat-service.ts`

Canonical flow:

1. route classification
2. `NON_DB_CHAT` or deterministic fast path or `FULL_PLANNER`
3. deterministic executor
4. centralized summary builder
5. streamed response

## Title Extraction Rules

Implemented in:

- `src/server/ai/title-extractor.ts`

The extractor removes:

- pronouns
- modal shells
- recurring shells
- time expressions
- duration expressions

and then extracts a core activity with confidence.

Examples:

- `接下来一周我每天晚上9点要做30分钟托福` -> `托福`
- `接下来三天每天早上7点背30分钟单词` -> `单词`
- `未来一周每晚8点练1小时吉他` -> `吉他练习`
- `明天下午三点写报告半小时` -> `写报告`
- `我明天中午十二点要吃药` -> `吃药`

## Fast Path Safety Boundary

Fast path is only allowed when:

- the route classification is high-confidence
- the extracted title has confidence `>= 0.95`

If title confidence is below that threshold, the request degrades to the richer planner path.

This prevents speed optimizations from writing shell fragments into the database.

## Why `接下来一周我每天晚上9点要做30分钟托福` Must Be a Recurring Schedule

This utterance expresses:

- a recurring cadence
- an explicit execution time
- a duration
- a concrete activity

So the correct data result is:

- task title: `托福`
- seven upcoming time blocks
- each block at local `21:00–21:30`

It is not:

- inbox
- note
- reminder-only
- a malformed shell title

## Why `我明天中午十二点要吃药` Now Enters Plan

The system now distinguishes:

- pure reminder
- timed discrete execution occurrence
- work session

`我明天中午十二点要吃药` is treated as:

- task
- reminderAt
- plan-visible occurrence

That keeps the reminder semantics while also making the action visible in Plan / Timeline.

## Why Accuracy Still Comes Before Speed

Speed improvements now come from skipping unnecessary work safely:

- non-db chat skips Prisma
- obvious fast routes skip full planner LLM
- heavy context only builds when needed

But no fast route may write data when title confidence is low.

So speed comes from smaller safe paths, not from lowering semantic quality.
