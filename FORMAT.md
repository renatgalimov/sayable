# Phrase-v8 format

This format describes the model in `models/phrase-v8.json`. Its ordered arrays are part of the mapping. It differs from the unreleased historical phrase-v7 prototype; phrases from the two models are not interchangeable.

The input is an unsigned 64-bit integer. Words are ASCII lowercase, joined by exactly one ASCII space. Each phrase uses exactly ten tokens, distributed among three or four words. Each word has 2–4 tokens: one beginning, 0–2 middles and one ending.

Choose the layout using the four least-significant bits as the index into the lexicographically sorted tuples of 2–4, of length at most four, whose sum is ten. There are exactly 16. Then, consuming bits from least significant to most significant, encode each word left-to-right:

1. Consume 7 bits to select an index of the 128-entry `begin` array; that array value is a token ID.
2. For each middle, look up the row for the previous token and consume 6 bits to select one of the 64 IDs in that row of `middle`.
3. Look up the previous token's row and consume 5 bits to select one of the 32 IDs in that row of `end32`.
4. Concatenate token texts after stripping the leading `^` from beginning tokens or trailing `$` from ending tokens.

For each selected beginning the corresponding context row has the same index as its position in `begin`. For each middle token ID 512–1023, its row is `128 + token_id - 512`. `contexts` gives the corresponding token IDs explicitly. `tokens` has 1,024 entries: indices 0–255 are marked beginnings, 256–511 marked endings, and 512–1023 middles. Ordered row values are token IDs, not strings. `banned` and `relaxed` are compiler diagnostics, not encoding inputs; preserve the exact model JSON and its digest for the specified candidate.

A canonical decoder must accept only exact lowercase single-space-separated words, find the uniquely matching token at each position, reject leftover text and invalid layouts, ensure no intermediate shift extends beyond bit 63, and recover the layout index in the low 4 bits. Decoding is reversible encoding, not encryption. Values in language-independent vectors use 16 hexadecimal digits to avoid JavaScript number precision loss.

The shared fixture has a `vectors` array of `value_hex` and `phrase` pairs, and an `invalid` array of named `case` and `phrase` pairs that a decoder must reject. Valid cases include zero, the maximum 64-bit value, every layout and varied token choices. They are not a full proof of all encodings. Filtering is only for the supplied list and its documented matching rules; it does not cover unlisted words, other interpretations, or matches across spaces.
