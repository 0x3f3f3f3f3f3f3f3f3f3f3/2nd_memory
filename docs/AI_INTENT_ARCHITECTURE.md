# AI Intent Architecture

## Overview

The AI stack now follows a two-stage pipeline:

1. `planner`
   - Produces a strictly typed `AiIntentPlan`
   - Uses rule-first heuristics for high-confidence common cases
   - Falls back to structured LLM planning via `chat.completions.parse + zodResponseFormat`

2. `executor`
   - Resolves existing entities
   - Applies deterministic create/update/link rules
   - Enforces time semantics and idempotency
   - Generates the final user-facing summary after mutations

This replaces the old design where the model directly decided low-level write tools in multiple rounds.

## Ontology

### Task

Use `Task` for:

- obligations
- todos
- discrete actions that need completion
- reminders such as taking medicine, paying a bill, making a call

### dueAt

`dueAt` means deadline:

- latest acceptable completion time
- triggered by phrases like `截止`, `最晚`, `之前`, `by`, `due`, `deadline`, `提交前`

Date-only deadlines default to local `23:59:59`.

### reminderAt

`reminderAt` means reminder point:

- a moment to prompt the user to do the action
- ideal for medicine, calls, fees, appointments, meetings

Date-only reminders default to local `09:00`.

### TimeBlock

`TimeBlock` means planned work session:

- a scheduled block of effort
- should only exist when the user is talking about allocating time
- does not imply a deadline

### Note

Use `Note` for:

- ideas
- hypotheses
- insights
- lessons
- reflections
- knowledge capture

Notes are enriched into structured Markdown instead of storing only the raw sentence.

### Inbox

Inbox is only allowed when:

1. the user explicitly asks for quick capture / later triage
2. the user explicitly says they do not want structure yet

Inbox is not the default fallback.

## Planner / Executor

### Planner

Planner output is defined in `src/server/ai/contracts.ts`.

Top-level contract:

- `mode`
- `intentSummary`
- `confidence`
- `assumptions`
- `actions`
- `userFacingSummary`

Action types:

- `upsert_task`
- `schedule_task`
- `create_recurring_schedule`
- `bulk_create_discrete_tasks`
- `upsert_note`
- `link_note_to_note`
- `capture_to_inbox`

### Executor

Executor is deterministic:

- resolves tasks/notes by exact title, normalized title, and search-like matching
- enriches or updates existing entities where appropriate
- avoids duplicate task occurrences and duplicate time blocks
- applies note-note links through `NoteLink`

The executor uses a repository abstraction so tests can run entirely in memory.

## Time Semantics

Implemented in `src/server/ai/time-semantics.ts`.

### Deadline rules

If the utterance expresses a latest completion moment:

- create/update `Task`
- set `dueAt`
- do not create `TimeBlock` by default

### Reminder / discrete obligation rules

If the utterance expresses a reminder-style obligation:

- create/update `Task`
- set `reminderAt`
- do not create `TimeBlock` by default

This is why `吃药` becomes `task + reminderAt`, not inbox.

### Schedule rules

If the utterance expresses work allocation:

- reuse an existing task when possible
- otherwise create the task
- create `TimeBlock`
- do not set `dueAt` unless the utterance independently contains a deadline phrase

### Coarse time mapping

Defaults:

- morning -> `09:00`
- forenoon -> `10:00`
- noon -> `12:00`
- afternoon -> `15:00`
- dusk -> `18:00`
- evening / tonight -> `20:00`

### Recurring discrete task vs recurring time block

`接下来一周每天中午吃药`

- expanded into multiple discrete task occurrences
- each occurrence carries `reminderAt`
- no recurring work session is created

`接下来一周每天早上八点跑步`

- represented as repeated scheduled sessions
- one task can own multiple repeated time blocks

This distinction prevents reminder-style obligations from being mis-modeled as calendar work sessions.

## Note Enrichment

Idea-like inputs are expanded into structured Markdown sections:

1. 原始想法
2. 核心命题
3. 可能机制 / 解释框架
4. 值得验证的问题
5. 可能的实验 / 下一步
6. 风险 / 反例 / 不确定点

Generated content explicitly marks uncertain claims as assumptions or items to verify.

## Inbox Policy

Inbox is only used when explicitly requested. Otherwise:

- task-like input -> task
- note-like input -> note
- compound note + task input -> both

This avoids the previous behavior where ambiguity silently degraded into inbox capture.

## Why “吃药” Is Task + reminderAt

`吃药` is:

- a discrete obligation
- usually something the user must remember at a specific moment
- not a deadline
- not a work session
- not default inbox material

So the correct representation is:

- `Task`
- `reminderAt`
- optional repetition expansion if recurring

That keeps the system semantically correct and allows downstream reminder behavior without polluting the calendar or inbox.
