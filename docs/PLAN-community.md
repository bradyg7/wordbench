# Proposal: studying together (community, coordination, a group feed)

Status: an idea for the person to decide on (2026-11-02). Nothing here is built. The mock is
[ui/prototypes/community.html](../ui/prototypes/community.html). Pictures of its three views are in
[prototypes/](prototypes/): [this week](prototypes/community-week.png), [the group page](prototypes/community-page.png)
and [the plan](prototypes/community-plan.png). Open the mock with `npm run dev`, then
`http://127.0.0.1:1420/prototypes/community.html`.

## The tension, first

Three rules in [PLAN.md](PLAN.md) section 1 stand in the way of an ordinary social app:

- **Distraction-free.** "No notifications, no feeds, no accounts beyond the person's own sync remote."
- **The Berean rule.** The app shows source text and the person's own work; it offers no interpretation. Other people's
  notes *are* interpretation, so if they appear at all, they must be plainly someone's own words, never the app's.
- **Works with no network,** and the study folder is the person's own plain files.

So this proposal is a **small, invited, quiet** form of studying together, and it keeps all three rules:

- a study group, a family or a church small group
- no public profiles, no discovery, no followers
- no likes, counts, streaks or leaderboards
- no feed that ranks or never ends: the group page is in time order and ends with "You're caught up"
- no notifications by default: a quiet dot on the Group tab, and an optional weekly summary the person turns on
- nothing shared unless the person shares it, item by item
- scripture travels as references only: each member's app fills in the verse from its own database, so it is always
  verbatim and can never be edited, misquoted or paraphrased in passing
- no AI summaries of other people's notes

If the person would rather keep the app strictly personal, the reading plans (just built) stand on their own, and this
can stay a proposal.

## What it would do

| | What | How it keeps the rules |
|---|---|---|
| **A group reading plan** | Everyone on the same plan (any plan the app can make, or one imported). Each member can choose to show the group that they read today's portion | Opt-in per member. No ranks; a missed day shows as nothing, not as red |
| **This week's study** | The next meeting: when, the passage, and the questions to think about before it. It can be built from a lesson file or from the Notebook's questions | The questions are the leader's own words; the passage is a reference |
| **Questions on a passage** | A member asks a question at a verse; others answer in their own words | The app never answers. Each answer is signed, and the verse stays the source |
| **Shared threads** | A group thread that every member can add places to, with their reason (the same files threads use now) | The same thread format; each place says who added it |
| **The group page** | What members chose to share, in time order: notes at a verse, questions, answers, plan check-ins. Tapping one opens the verse, and "Back to …" returns, as everywhere else | No ranking and an end to the list. No likes |
| **Share one thing** | Send a note, a thread or a passage to one person (a file through the share sheet: message, email, AirDrop) | No account or group needed |

**Left out on purpose:**
- public posting, profiles, followers, discovery
- reaction counts
- direct messages: a messaging app already does that better
- prayer-request lists: a group can keep one in its own notes; the app would only add pressure to it

## How it would travel (the choice that matters)

1. **A shared git repository per group (recommended, if this goes ahead).** It is the same sync the app already uses for
   the person's own folder (PLAN.md section 4), so it needs no server of our own and works offline. Each member writes
   only in their own folder, so members never conflict. The leader invites people by giving them access to the group
   repository. The cost is that everyone needs an account at the same git host (or the group uses one shared token),
   which is harder for people who are not technical.

   ```
   group.json                    the group's name, its members (id, the name they go by), its plan
   plan.json                     the shared reading plan (the same format as reading/plans/*.json)
   meetings/2026-11-05.md        a meeting: when, the passage (a reference), the questions
   members/<id>/shared/*.md      what that member shared: notes, questions, answers (the note format, plus "by")
   members/<id>/log.jsonl        their plan check-ins, if they chose to share them
   threads/*.md                  shared threads (members' places carry "by")
   ```

2. **A small hosted service** with accounts, invitations and sync. It would be the easiest for members who are not
   technical. But it is the "accounts" and "server" the plan rules out, and someone has to run and pay for it, and
   keep it private. Not recommended for a personal tool.

3. **Files only, through the share sheet** ("Share one thing" above). It is the simplest form and needs no group at all.
   Worth building on its own whatever happens with the rest.

## Where it would sit

- **Phone:** a Group tab would replace one of the five (or Group would sit under More, if the person rarely uses it).
  The mock shows the tab.
- **Desktop:** a Group pane, docked like the Notebook.
- **Order of work:** after phase 3, since it rides on sync, and only if the person decides for it. "Share one thing"
  could come earlier, with phase 5's documents.

## Decisions for the person

1. **Whether to study together in the app at all,** or keep it strictly personal (the plan's rule today).
2. **If yes, how it travels:** a group git repository, files only, or a hosted service.
3. **Which pieces:** a group plan, the week's study, questions, shared threads, the group page.
4. **How quiet:** no notifications at all, or an optional weekly summary.
