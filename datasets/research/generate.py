#!/usr/bin/env python3
"""Deterministic generator for the Deep Research test vault.

The vault is built around traps for a retrieval-based research agent:

  1. Alias trap      - Daily/2025-01-15.md holds a decision ("React") but never
                       says "Alpha"; it only says "A-Project". A content-only
                       search for "Alpha" cannot reach it. A ReAct agent finds it
                       by reading Projects/Alpha.md, noticing "Aliases: A-Project"
                       and searching for that alias.
  2. Temporal contradiction #1 - PostgreSQL (2025-03-20) vs SQLite (2025-05-01).
  3. Temporal contradiction #2 - React (2025-01-15) vs Svelte (2025-06-01).
  4. Noise           - Ideas/Alpha-ideas.md matches "Alpha" but is brainstorming.
  5. Canonical vs stale - Projects/Alpha.md is canonical but says
                       "Frontend: TBD. Backend: TBD"; the real decisions live in
                       other notes.

Usage:
    python datasets/research/generate.py --out ./datasets/research/vault --seed 42
"""

import argparse
import os
import random

NOTES = {
    "Projects/Alpha.md": """# Project Alpha

Project Alpha. Aliases: A-Project, AProj.
Started: 2025-02-10. Owner: me.
Frontend: TBD. Backend: TBD.
This note is the canonical entry point for Alpha; decisions are recorded in the
dated meeting and daily notes, not here.
""",
    "Projects/Beta.md": """# Project Beta

Beta depends on Alpha for auth module.
Beta started: 2025-04-02. Status: active.
""",
    "Meetings/2025-02-10-Alpha-kickoff.md": """# Alpha kickoff

Alpha kickoff meeting. Attendees: me.
Decided: use PostgreSQL for backend.
Open questions: frontend framework, deployment target.
""",
    "Meetings/2025-04-05-Alpha-review.md": """# Alpha review

Alpha review of the current state. No major changes.
Backend stayed on PostgreSQL, frontend still open.
""",
    "Meetings/2025-06-01-Alpha-final.md": """# Alpha final

Alpha final meeting. FINAL decision.
Switched frontend from React to Svelte.
Backend stays on SQLite (changed 2025-05-01).
""",
    "Daily/2025-01-15.md": """# 2025-01-15

Worked on A-Project today. Chose React for frontend.
Also sketched the A-Project data model.
""",
    "Daily/2025-03-20.md": """# 2025-03-20

Alpha update: backend confirmed PostgreSQL.
Wrote the initial schema for Alpha.
""",
    "Daily/2025-05-01.md": """# 2025-05-01

Alpha pivot: switching to SQLite for MVP. Postgres too heavy.
Alpha needs to ship quickly, so SQLite wins for the MVP.
""",
    "Ideas/Alpha-ideas.md": """# Alpha ideas

Brainstorming for Alpha, nothing decided here.
Ideas: maybe use a message queue, maybe try GraphQL, maybe rewrite in Rust.
These are throwaway notes, not decisions.
""",
    "Resources/Zettelkasten.md": """# Zettelkasten

Notes about the Zettelkasten method: atomic notes, links, structure by emergence.
Unrelated to any particular project.
""",
    "Resources/PARA.md": """# PARA

Notes about the PARA method: Projects, Areas, Resources, Archives.
Unrelated to any particular project.
""",
    "Archive/Alpha-v0-archive.md": """# Alpha v0 (archive)

Old archived notes about Alpha v0, the abandoned first attempt.
Backend was going to be MongoDB, frontend was going to be Angular.
Superseded, kept only for history.
""",
}

BRAINSTORM_VARIANTS = {
    0: ["maybe use a message queue", "maybe try GraphQL", "maybe rewrite in Rust"],
    1: ["maybe use a serverless queue", "maybe try gRPC", "maybe rewrite in Go"],
}


def build_notes(seed: int):
    notes = dict(NOTES)
    variant = BRAINSTORM_VARIANTS.get(seed % 2, BRAINSTORM_VARIANTS[0])
    notes["Ideas/Alpha-ideas.md"] = (
        "# Alpha ideas\n\n"
        "Brainstorming for Alpha, nothing decided here.\n"
        + "Ideas: "
        + ", ".join(variant)
        + ".\n"
        + "These are throwaway notes, not decisions.\n"
    )
    # Deterministic shuffle so that the on-disk order never depends on dict order
    rnd = random.Random(seed)
    keys = sorted(notes.keys())
    rnd.shuffle(keys)
    return {k: notes[k] for k in keys}


def main():
    ap = argparse.ArgumentParser(description="Generate the deterministic research test vault")
    ap.add_argument("--out", default="./datasets/research/vault", help="output vault directory")
    ap.add_argument("--seed", type=int, default=42, help="deterministic seed")
    args = ap.parse_args()

    out = os.path.abspath(args.out)
    notes = build_notes(args.seed)

    written = []
    for rel, content in notes.items():
        path = os.path.join(out, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(content)
        written.append(rel)

    print(f"vault: {out}")
    print(f"seed: {args.seed}")
    print(f"notes written: {len(written)}")
    for rel in sorted(written):
        print(f"  - {rel}")


if __name__ == "__main__":
    main()
