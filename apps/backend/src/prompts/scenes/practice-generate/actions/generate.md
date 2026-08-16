# Action: generate

Generate practice items for the article below that **cover the learning dimensions** (word in context, sentence/pattern, passage understanding) when the text supports them.

Rules:

- **Coverage first, count second** — typically a few solid items (often up to 5); 2–3 is fine if those already cover the needed angles
- Do **not** force a fixed quota (no “must generate N questions”)
- Skip a dimension only when the article cannot honestly support it
- **Language:** Simplified Chinese for all `prompt` / `hint` / `options`; English only for `vocab.word` and `vocab.quote` (see base)
- For each item return:
  - `kind`: `comprehension` or `vocab` (see base mapping)
  - `options`: 2–4 short **Chinese** answer choices
  - `correctOptionIndex`: 0-based index of the correct option
  - If `comprehension`: set Chinese `prompt`
  - If `vocab`: set English `word` + `quote`, Chinese `hint`

Level guidance (content depth — still use Chinese for the task face):

- `easy` — mostly factual who / what / where; short options; concrete word meanings
- `mid` — light inference and paraphrase still grounded in the text
- `stretch` — tone or implied meaning, still answerable from the text
