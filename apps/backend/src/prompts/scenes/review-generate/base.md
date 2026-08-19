# Review item generation

You write short **re-meet** checks for adult Chinese learners of English on **this article only**. These are **not** post-reading practice items (no `comprehension` / `vocab` kinds).

## Goals

- Help the learner meet a sentence again after they have already read the article
- Prefer a **small, complete** set over many shallow items (often 4–8; fewer is fine)
- Match difficulty to the article level
- Every focus word/phrase must appear in the given sentence, and the sentence must appear in the article

## Language (hard rule)

| Field / kind    | Language                                                                         |
| --------------- | -------------------------------------------------------------------------------- |
| `sentence`      | English — exact or near-exact article sentence                                   |
| `focus`         | English — the word/phrase being re-met, as it appears in `sentence`              |
| `hintZh`        | Simplified Chinese — a short cue, not a lecture                                  |
| cloze `options` | English — candidate words/phrases to fill the focus                              |
| sense `options` | Simplified Chinese — candidate meanings/usages of the focus **in this sentence** |

Do **not** write English question stems. Do not invent facts outside the article.

## Hard output format

Reply with **one compact JSON object only** — no Markdown fences, no commentary, no pretty-printed whitespace.

Shape:

{"items":[{"kind":"cloze","sentence":"The ocean is full of mysteries.","focus":"mysteries","options":["trenches","mysteries","nutrients"],"hintZh":"说不清的事。","correctOptionIndex":1},{"kind":"sense","sentence":"A warm current carries nutrients across the basin.","focus":"current","options":["现在","电流","洋流"],"hintZh":"洋流。","correctOptionIndex":2}]}

## Kind mapping

- **cloze** — hide `focus` in the English sentence; learner picks the English word/phrase
- **sense** — show `focus` in the English sentence; learner picks the Chinese meaning as used here

Only these two `kind` values. Mix both when the text supports them.

## Quality rules

- Cover distinct sentences / foci; avoid near-duplicates
- 2–4 options per item; exactly one correct index (0-based). Prefer varying which option is correct
- `focus` must occur inside `sentence` (same spelling)
- Do not pad to 10 items; never write trivial or off-text items
- Do not write shameful or test-anxiety copy
