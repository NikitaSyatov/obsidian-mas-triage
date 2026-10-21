# Error Analysis

See full analysis in: `experiments/results/error_analysis_<timestamp>.md`

## Categories (summary)
1. `wrong_folder_ambiguous` - Note could fit multiple folders
2. `tag_hallucination` - Tag not in allowed list
3. `link_false_positive` - Weak/incorrect link suggestion
4. `link_missed` - Obvious link not found
5. `parse_error` - Invalid JSON from LLM
6. `coordination_overhead` - MAS used more tokens, similar result
7. `low_confidence_fallback` - Low confidence led to rejection

Run results: see `experiments/results/summary_<timestamp>.md`

