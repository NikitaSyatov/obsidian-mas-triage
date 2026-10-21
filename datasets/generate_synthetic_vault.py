#!/usr/bin/env python3
import argparse
import json
import os
import random


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate synthetic Obsidian vault for triage experiments")
    parser.add_argument("--out", required=True, help="Output directory")
    parser.add_argument("--notes", type=int, default=50, help="Number of notes to generate")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    args = parser.parse_args()

    random.seed(args.seed)
    out = args.out
    os.makedirs(out, exist_ok=True)
    os.makedirs(os.path.join(out, "00-Inbox"), exist_ok=True)
    for d in ["Projects", "Areas", "Resources", "Archive", "Daily"]:
        os.makedirs(os.path.join(out, d), exist_ok=True)
    gold_dir = os.path.join(os.path.dirname(out), "gold")
    os.makedirs(gold_dir, exist_ok=True)

    # Create some existing notes with known titles
    existing = [
        ("Projects/Project Alpha.md", "# Project Alpha\nDetails about alpha project.\n"),
        ("Projects/Project Beta.md", "# Project Beta\nDetails about beta project.\n"),
        ("Areas/Health.md", "# Health\nFitness and wellness.\n"),
        ("Areas/Finance.md", "# Finance\nBudget notes.\n"),
        ("Resources/Zettelkasten.md", "# Concept: Zettelkasten\nLinking ideas.\n"),
        ("Resources/Reading List.md", "# Reading List\nBooks to read.\n"),
        ("Daily/2025-03-15.md", "# Meeting 2025-03-15\nNotes from meeting.\n"),
        ("Archive/Old Idea.md", "# Old Idea\nArchived.\n"),
    ]
    for rel, content in existing:
        path = os.path.join(out, rel)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)

    # Generate inbox notes
    inbox_titles_existing = ["Project Alpha", "Project Beta", "Meeting 2025-03-15", "Concept: Zettelkasten"]
    inbox_list = []
    for i in range(min(15, max(10, args.notes // 4))):
        title = f"Inbox Note {i+1}"
        # mention some existing
        mention = random.choice(inbox_titles_existing)
        content = f"# {title}\n\nNeed to triage this note. Related to [[{mention}]].\nAlso mentions проект.\n"
        path = os.path.join(out, "00-Inbox", f"inbox_{i+1}.md")
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        # gold
        if mention == "Project Alpha":
            gold = {"expectedFolder": "Projects", "expectedTags": ["project"], "expectedLinks": ["Project Alpha"]}
        elif mention == "Project Beta":
            gold = {"expectedFolder": "Projects", "expectedTags": ["project"], "expectedLinks": ["Project Beta"]}
        elif mention == "Meeting 2025-03-15":
            gold = {"expectedFolder": "Daily", "expectedTags": [], "expectedLinks": ["Meeting 2025-03-15"]}
        elif mention == "Concept: Zettelkasten":
            gold = {"expectedFolder": "Resources", "expectedTags": [], "expectedLinks": ["Concept: Zettelkasten"]}
        else:
            gold = {"expectedFolder": "Notes", "expectedTags": [], "expectedLinks": []}
        gold_path = os.path.join(gold_dir, f"inbox_{i+1}.json")
        with open(gold_path, "w", encoding="utf-8") as f:
            json.dump(gold, f, ensure_ascii=False, indent=2)
        inbox_list.append(path)

    print(f"Generated synthetic vault at {out} with {len(inbox_list)} inbox notes")


if __name__ == "__main__":
    main()
