# Plan

Each step gets its own pull request:

1. Project plan and license.
2. Repository guardrails: pre-commit checks, CI, and contributor setup.
3. Model generation: define the shared format, build the model, document data sources and licenses, and add reproducibility checks and reference vectors.
4. Rust implementation.
5. Python implementation.
6. JavaScript implementation.
7. Elm implementation.

## Format and compatibility

- Use shared, versioned data and test vectors so implementations agree. A custom meta-language is not planned.
- Explore words of one to five tokens before choosing the 1.0 format.
- Give each format version its own import path. The 0.9 mapping can change before 1.0; starting with 1.0, keep each major version's mapping unchanged.
- Improve filtering of known offensive terms with each new format version. No filter can cover every language or context.
- Consider dynamic-length encodings after 1.0, not as part of 1.0.

## Data and licensing

Before including corpus data or generated tables, identify the source versions, check their terms, and include required attribution and notices. Do not assume the project's MIT license covers third-party data.
