# Historical data provenance review

The historical corpus, blocklist and generated tables are not included here. This
review records evidence, not permission to redistribute them. The repository's
MIT license does not establish the terms of third-party inputs or derived data.

## Blocklist

The historical local `phrase-corpus/build_corpus.py` folds and combines three
sources. Running its blocklist function against the available local raw files
reproduced the decompressed historical blocklist byte-for-byte (5,789 terms).
The following upstream revisions match those raw files byte-for-byte:

- [LDNOOBW](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words/tree/5faf2ba42d7b1c0977169ec3611df25a3c08eb13): all 28 local language files; [CC BY 4.0 license](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words/blob/5faf2ba42d7b1c0977169ec3611df25a3c08eb13/LICENSE).
- [washyourmouthoutwithsoap](https://github.com/thisandagain/washyourmouthoutwithsoap/blob/01f9c4888694aa66a6c2a09576adbdb614d6dec7/data/build.json): `build.json`; [MIT license](https://github.com/thisandagain/washyourmouthoutwithsoap/blob/01f9c4888694aa66a6c2a09576adbdb614d6dec7/LICENSE). Its [README](https://github.com/thisandagain/washyourmouthoutwithsoap/blob/01f9c4888694aa66a6c2a09576adbdb614d6dec7/README.md) describes the English list as based on Google's list and its build process as generating language lists using Google Translate; the underlying provenance and applicable rights require further review.
- [dsojevic/profanity-list](https://github.com/dsojevic/profanity-list/blob/c27924319aa9bd6f917e3782b4f4b6604a50b652/en.json): `en.json`; [MIT license](https://github.com/dsojevic/profanity-list/blob/c27924319aa9bd6f917e3782b4f4b6604a50b652/LICENSE).

These are content-matching revisions, not proof of the originally downloaded
commits: the historical fetcher used mutable URLs. Matching and rebuilding do
not themselves establish redistribution rights.

SHA-256 fingerprints of the local artifacts examined (not shipped here):

- `phrase-words.txt.xz`: `81b47581fda0829392dbd5b9906ee772bbf2a004ddde7931ef44fa06170ad371`
- `blocklist.txt.xz`: `fc14c3796ac6bc37bad81db50ac036ed617ff9bf2dbdc1ca9415b08015ce558b`
- `phrase_model.json`: `d7f5cbae8d307fcb82afb7e48e94f3cd1d502ce739a3393ea100dc738b25e749`
- Raw `manifest.jsonl`: `f74714923d492b40a683d4c3bd98ee89b528efe6301612ee5d1c4800387bcdd9`

## Corpus

The historical local fetcher names FrequencyWords/OpenSubtitles, Leipzig,
Tatoeba, UniMorph, Wiktionary via kaikki.org and Eldamo. Its local manifest has
1,186 records: 994 successes and 192 failures, including optional probes and
retries; these are not counts of missing or used inputs. The exact inputs,
revisions, per-language UniMorph licenses and attribution needed for each output
have not been established.

- [FrequencyWords' README](https://github.com/hermitdave/FrequencyWords/blob/525f9b560de45753a5ea01069454e72e9aa541c6/README.md) distinguishes MIT code from CC BY-SA 4.0 content. This revision is a license reference, not a verified historical input revision.
- [Tatoeba's current downloads page](https://tatoeba.org/en/downloads) states CC BY 2.0 FR for its exports; its [terms](https://tatoeba.org/en/terms_of_use) also discuss CC0 sentences. Determine the actual export and attribution information used; current terms alone do not establish historical terms.
- UniMorph is split across language repositories; check the actual repositories and revisions individually rather than assigning one license to all.
- [Leipzig's current terms](https://wortschatz.uni-leipzig.de/en/usage) offer downloadable text corpora under CC BY 4.0; the general data and applications have separate CC BY-NC terms. The historical archives' applicable terms and underlying-source rights remain to be checked.

## Before publishing historical data or outputs

1. Inventory each output's actual inputs, versions, hashes, transformations and contributors; reconcile manifest failures and retries against files actually used.
2. Verify source and upstream rights, license versions, attribution and notice requirements, including soap's upstream list and each UniMorph and Leipzig corpus. Resolve how those terms apply to each proposed output; obtain permissions or replace inputs where needed.
3. Preserve the evidence and required notices alongside any approved distribution. A reproducible build is useful evidence of inputs, not a rights clearance.
