# Model sources and licenses

The phrase-v8 model, corpus and blocklist are distributed under [CC BY-SA 4.0](licenses/cc-by-sa-40.txt) for copyright and database rights in the combined and modified data. The original inputs retain their respective licenses. The compiler and other project code remain under the [MIT license](../LICENSE). These credits do not imply endorsement by the sources.

I built the corpus by extracting word forms and frequencies, transliterating, normalizing, filtering, ranking and combining the inputs. I folded and combined the blocklists, then compiled the model from the resulting corpus and blocklist. [inputs.csv](sources/inputs.csv) identifies every raw input, its source, local snapshot hash and declared license. The [contribution index](sources/contributions.csv.xz) maps selected words to matching inputs. Matches can overlap, and inputs without selected matches can still affect ranking and filtering. Hashes identify the retained compressed snapshots: a source URL can point to an uncompressed or newer file. In particular, the exact historical Wiktionary dump date is not known.

## Corpus

- **Leipzig Corpora Collection, Universität Leipzig:** downloadable text corpora, [CC BY 4.0](licenses/CC-BY-4.0.txt). The [source-list index](sources/leipzig-sources.csv) identifies the source list in each archive, its hash and the archive URL. The lists themselves are in the downloaded archives. [Provider and license information](https://wortschatz.uni-leipzig.de/en/usage).
- **Tatoeba contributors:** the separate [CC0 sentence export](https://tatoeba.org/en/downloads), [CC0 1.0](licenses/CC0-1.0.txt). The ordinary Tatoeba export was not used.
- **FrequencyWords contributors and OpenSubtitles:** [2018 word-frequency lists](https://github.com/hermitdave/FrequencyWords/tree/525f9b560de45753a5ea01069454e72e9aa541c6/content/2018), [CC BY-SA 4.0](licenses/cc-by-sa-40.txt). FrequencyWords describes its content as CC BY-SA 4.0 and its code separately as MIT. The `ze` list was not read by the normalizer.
- **English Wiktionary contributors, via Kaikki.org and Wiktextract by Tatu Ylonen:** [CC BY-SA 4.0](licenses/cc-by-sa-40.txt) for the selected Wiktionary license route. The [entry attribution index](sources/kaikki-entry-attribution.csv.xz) links source entries and their contributor histories. See [Kaikki](https://kaikki.org/dictionary/), [Wiktionary copyright terms](https://en.wiktionary.org/wiki/Wiktionary:Copyrights), and Ylonen, *Wiktextract: Wiktionary as Machine-Readable Structured Data*, LREC 2022, pp. 1317–1325.
- **UniMorph contributors:** per-language repositories under CC BY-SA 3.0, CC BY-SA 4.0 or CC BY 4.0, as identified in the input inventory. The [retained repository notices](sources/unimorph-notices.tar.xz) identify the individual creators and sources. Original CC BY-SA 3.0 inputs retain their terms; the combined material uses the later CC BY-SA 4.0 license.
- **Paul Strack, Eldamo:** © 2008–2026 Paul Strack, [CC BY 4.0](licenses/CC-BY-4.0.txt); see the [original notice](licenses/eldamo-license-excerpt.txt) and [source](https://github.com/pfstrack/eldamo/blob/35c48268993dcab6365c731d7b04883f3166a644/src/data/eldamo-data.xml). Eldamo includes Tolkien-related lexical material.

## Blocklist

- **LDNOOBW contributors:** [List of Dirty, Naughty, Obscene, and Otherwise Bad Words](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words/tree/5faf2ba42d7b1c0977169ec3611df25a3c08eb13), [CC BY 4.0](licenses/LDNOOBW-LICENSE).
- **David Sojevic:** [profanity-list](https://github.com/dsojevic/profanity-list/tree/c27924319aa9bd6f917e3782b4f4b6604a50b652), © 2021, [MIT](licenses/DSOJEVIC-LICENSE).
- **Andrew Sliwinski and washyourmouthoutwithsoap contributors:** [washyourmouthoutwithsoap](https://github.com/thisandagain/washyourmouthoutwithsoap/tree/01f9c4888694aa66a6c2a09576adbdb614d6dec7), © 2018, [MIT](licenses/soap-MIT.txt). Its README describes a Google-derived English list and translated language lists.

The matching rules are described in the repository README. The list does not cover every offensive word, language or interpretation.
