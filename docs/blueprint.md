# VocabSRS — Bot specification

**Archetype:** education

**Voice:** warm and encouraging — write every user-facing message, button label, error, and empty state in this voice.

A private spaced-repetition vocabulary trainer for Telegram. Users create/import decks, learn up to their daily new-card limit, review due cards with 4-button ratings, and track stats like streaks and learned words. Reminders and session persistence ensure consistent progress.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- individual language learners

## Success criteria

- Users complete daily learning sessions with 80%+ retention based on review ratings
- Users track progress via streak counters and stats dashboards

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open main menu with deck selection and session options
  - inputs: user preferences
  - outputs: main menu
- **New Session** (button, actor: user, callback: session:start) — Begin learning new cards up to daily limit
  - inputs: deck selection
  - outputs: card prompt
- **Review Due** (button, actor: user, callback: review:start) — Start review session for scheduled cards
  - inputs: due cards list
  - outputs: rated card feedback
- **Browse Decks** (button, actor: user, callback: deck:list) — List and manage personal decks
  - inputs: deck metadata
  - outputs: deck cards list
- **/add** (command, actor: user, command: /add) — Add new card via structured flow
  - inputs: word, translation, example
  - outputs: confirmation message

## Flows

### onboarding
_Trigger:_ /start

1. Welcome message
2. Language/deck selection
3. Set daily new-card limit
4. Configure reminders

_Data touched:_ user preferences

### card_adding
_Trigger:_ /add

1. Prompt for word
2. Prompt for translation
3. Optional example input
4. Assign to deck

_Data touched:_ card, deck

### learning_session
_Trigger:_ session:start

1. Show new card prompt
2. Wait for Reveal
3. Collect rating
4. Update card schedule

_Data touched:_ card, session

### review_session
_Trigger:_ review:start

1. Show due card prompt
2. Wait for Reveal
3. Collect rating
4. Update card schedule

_Data touched:_ card, session

### session_resume
_Trigger:_ session:resume

1. Restore last session state
2. Continue from last card

_Data touched:_ session

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **user** _(retention: persistent)_ — Private account with preferences and progress
  - fields: telegram_id, daily_new_limit, notification_schedule, timezone
- **deck** _(retention: persistent)_ — Named card collection with metadata
  - fields: name, card_count, created_at
- **card** _(retention: persistent)_ — Prompt/translation pair with SRS metadata
  - fields: prompt, translation, example, easiness, interval, due_date, review_history
- **session** _(retention: session)_ — Active learning state with progress tracking
  - fields: current_card_index, session_type, last_position

## Integrations

- **Telegram** (required) — Bot API messaging and notifications
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Set daily new-card limit
- Configure reminder schedule
- Manage decks (add/edit/delete)
- View learning stats

## Notifications

- Daily review reminders sent to user's Telegram chat

## Permissions & privacy

- All user data is private and never shared between accounts

## Edge cases

- Mid-session disconnection preserves progress
- Empty deck handling with motivational messages
- Timezone-aware reminder scheduling

## Required tests

- End-to-end learning session with session persistence
- Review session with SM-2 algorithm validation
- Reminder delivery across timezones

## Assumptions

- SM-2 algorithm handles card scheduling
- Default daily limit of 10 cards balances retention
