# Datasets

## Sources
- **obsidian-second-brain** style corpus (idea) — generator `datasets/generate_synthetic_vault.py`
- **Synthetic vault** for controlled experiments (reproducible)
- **Real vault** (plan) — to validate on actual notes later

## Versioning
Fix seed/config to ensure reproducibility. Record dataset version in experiment results.

## Synthetic generation
```bash
python datasets/generate_synthetic_vault.py --out ./datasets/samples --notes 20 --seed 12345
```
(Skeleton only — no generation logic.)
