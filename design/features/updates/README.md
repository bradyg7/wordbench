# Updates

**State:** exploring · **Sheets:** none yet (round 1 to draw: `python design/features/updates/updates.py` will write
`updates.figcraft` and `updates.pdf`) · Nothing here is built yet.

How the app tells the person a newer Bible Workbench is ready, and what happens when they take it: the notice, what
changed, installing, restarting. Asked for by the person on 2026-11-13 ("documentation that lays out what an update
popup looks like on the app"). Today nothing in the window speaks of updates: `codex/installer-port` (`248c45a`) has an
optional Tauri updater in the shell only, with no UI, and its signed update path is unverified (see the
[spec](../../../docs/SPEC.md)).

## Leading design

| Part | Leading | Superseded (and by what) |
|---|---|---|
| The notice that an update is ready | to draw | |
| What changed (the notes) | to draw | |
| Installing and restarting | to draw | |
| Checking by hand, and the setting | to draw | |

## Decisions

None yet.

## Open questions

- Where the notice sits: a quiet toast, a dot on the ⋯ menu, a line in Settings, or a window on start? It must never
  cover the reader or take the reader's place.
- Does the app look for updates by itself, and how often, or only when asked? The pilot is permanent offline use after
  activation (spec), so checking must be optional and never needed to keep studying.
- What the notes say and where they come from (the release metadata), in plain words.
- Install now / on the next start / later; what the app does with unsaved writing before it restarts.
- What the person sees when an update fails or is refused (signature, no network), and that the old app keeps working.
- The `wb` command for it (`wb update check`, `wb update install`?).

## Rounds

| Round | Date | Windows | What it tried | Review |
|---|---|---|---|---|
| 1 | | | the first drawing | to draw |

## What the build must satisfy

Written once the person accepts a direction. Known already:

- [ ] Studying never waits on an update or a network.
- [ ] The person's writing is saved before any restart, and the reader's place is kept across it.
- [ ] Every action has a `wb` command.

## Overlaps

[settings](../settings/README.md) (where the update setting lives), [command](../command/README.md) (the ⋯ menu).
