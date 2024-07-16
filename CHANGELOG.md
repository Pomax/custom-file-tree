# How this library is versioned

This library _strictly_ adheres to [semver](https://semver.org)'s major.minor.patch versioning:

- patch version changes indicate bug fixes, internal-only changes, and docs updates.
- minor version changes indicate new functionality that does not break backward compatibility,
- major version changes indicate backward-incompatible external API changes, no matter how small.

Note that there may be gaps in the version history, which may happen if a release is pushed to npm but a problem is discovered fast enough to warrant an unpublish.

# Current Version

## v2.0.0 (July 16, 2024)

Full rewrite, with test coverage.

- `setFiles` now clears the tree content, which is a breaking change.
- the top level "." dir no longer shows by default, which is a breaking change.
- The top level "." dir will only show when using the new `show-top-level="true"` attribute on `<file-tree>`
- File and dir entries are no persistent, with a `.state` variable that can be used as a persistent data store for the lifetime of the file tree (or until `setFiles` gets called).
- There is a `setState(update)` function that can be used to  (synchronously) update the `state` variable. Note that this function is not required, you are free to modify `state` directly. (This isn't React, it's an HTML element)
- collapsed directories will now auto-open when selected.

# Previous Versions

## v1.0.x (July 7, 2024)

initial release with a flurry of patch versions for fast-follow-up bug fixes and typos.
