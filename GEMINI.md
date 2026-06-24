<!-- BEGIN CONTEXT NEST (auto-generated, do not edit this section) -->
# My Project Knowledge

This project contains a **Context Nest vault** — a structured knowledge base
you should query before answering questions about this codebase or domain.

## How to Use This Vault

**CLI fallback** — Run `ctx query <selector>` to load context:
```
ctx query "#topic"              # By tag
ctx query "type:document"        # By type
ctx query "pack:pack-name"       # Load a pack
ctx query "#tag" --hops 3        # Deeper graph traversal
ctx query "#tag" --full           # Load everything (large vaults)
```

## Maintaining This Nest

This project has a Context Nest vault for engineering knowledge. As the
agent working with the user on this codebase, YOU are responsible for
KEEPING IT USEFUL. This is not optional — without active maintenance the
nest decays and the user loses the cheaper-agent-sessions, surviving-
tribal-knowledge value they installed it for.

Capture aggressively. Multiple nodes per session is normal and expected.
Under-capture is the failure mode here, not over-capture.

What to capture (engineering specifically):

- **Architecture decisions** — every "we're going to do X because Y" is
  worth a node. Mini-ADRs for the small stuff too, not just the big calls.
- **Things you learned about this codebase** to do the current task —
  conventions, hidden coupling, why a file is structured oddly, what a
  cryptic helper actually does. The next agent session needs to know.
- **Gotchas and surprises** — the env var that breaks things if missing,
  the deploy step that's not in the README, the test that's flaky for a
  specific reason.
- **Answers to questions** the user asked about how something works.
  Capture both the question and the answer so next time you (or another
  teammate's agent) can find it.
- **References** the user shared — PR URLs, Slack threads, related
  files, screenshots — anchor them in a node alongside the why.

How to capture:

- You do not need permission to capture. You may capture without asking.
  Mention what you're capturing in passing if it's substantive — do not
  gate the capture on a yes/no from the user.
- Use `ctx add nodes/<slug> --type document --title "<title>" --tags
  "<tags>"` to create. Write the body with the Write tool. Keep nodes
  tight — 100-300 words is usually plenty.
- Show what you wrote only if asked, or if the content is ambiguous.
- Every change is hash-chained and versioned silently. The user can
  inspect or revert later. There is no cost to capturing too much; there
  is real cost to capturing too little.

## Context Packs

Pre-curated bundles of context for common tasks:

- **Engineering Essentials** (`pack:engineering-essentials`) — Architecture decisions, coding standards, and project knowledge

## Vault Overview

- **11** published documents, **0** drafts
- **0** relationship edges
- Tags: `#a11y`, `#architecture`, `#code-quality`, `#conventions`, `#design-system`, `#getting-started`, `#gotchas`, `#onboarding`, `#overview`, `#product`, `#setup`, `#standards`, `#tech-stack`, `#workflows`

## Rules

1. **Query before answering** — Always check the vault for relevant context before responding to domain questions
2. **Cite sources** — Reference document paths when using vault content
3. **Prefer published** — Use published documents over drafts
4. **Use graph traversal** — Default `ctx query` follows the document graph; increase `--hops` if you need more context

<!-- END CONTEXT NEST -->
