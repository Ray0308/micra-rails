# Project instructions

## Release version

The user requires a visible version in the upper-right corner on all screens, starting at 0.1.0.
For each subsequent user-facing update/deployment, increment the last component once, regardless of the number of commits. Each component rolls over at 10: 0.1.9 becomes 0.2.0; 0.9.9 becomes 1.0.0. Do not apply standard semantic-versioning increments.
The current version is documented in README.md and the version-badge in index.html. Keep the badge, its aria-label, stylesheet/script cache query versions, and README current version consistent. An update consisting of multiple file commits is a single version increment.
