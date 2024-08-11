# How this library is versioned

This library _strictly_ adheres to [semver](https://semver.org)'s major.minor.patch versioning:

- patch version changes indicate bug fixes, internal-only changes, and docs updates.
- minor version changes indicate new functionality that does not break backward compatibility,
- major version changes indicate backward-incompatible external API changes, no matter how small.

Note that there may be gaps in the version history, which may happen if a release is pushed to npm but a problem is discovered fast enough to warrant an unpublish.

# Current Version

## v5.0.0 (August 11, 2024)

- wrapped `<dir-entry>` and `<file-entry>` buttons in a `<span class="buttons">` element so that folks can more easily move the entire button collection around in their own CSS. **This is a breaking change** if you have CSS in place for overriding the default button placement.

The relevant CSS rule changes are that the previous:

```css
file-tree {
  ...

  & button {
    ...
  }

  & .selected > button,
  & [path="."] > button {
    ...
  }

  ...
}
```

has become:

```css
file-tree {
  ...

  & .buttons {
    ...
  }

  & .selected > .buttons,
  & [path="."] > .buttons {
    ...
  }

  ...
}
```

So you will have to update your own CSS accordingly.

# Previous Versions

## v4.0.0 (July 23, 2024)

- Added support for the `src` attribute so the file tree can be bootstrapped purely in HTML, with changes to the attribute triggering reloads.
- Related, the `.setFiles` function was renamed to `.setContent`. **This is a breaking change.**
- Related, the file tree now generates events during `setContent()` and `src` attribute resolution, generating `tree:add:file` and `tree:add:dir` events. The documentation has been updated to include these events.
- The file tree now generates a `tree:reset` event when a clear happens prior to assigning new content. There is, admittedly very little use for this event, but it's there now.
- The file tree also generates a `tree:ready` event when it has finished building its content.

## v3.3.0 (July 23, 2024)

- Added `.unselect()` to force a highlight reset.

## v3.2.6 (July 22, 2024)

- [bugfix] The filetree `.select(path)` function generated a click event instead of selecting the relevant entry

## v3.2.5 (July 22, 2024)

- [bugfix] Paths that don't end in `/` could lead to duplicate dir entries, breaking dir moving in the process.

## v3.2.3 (July 20, 2024)

- [bugfix] The `file:click` and `dir:click` no longer double-wrap their event details (i.e. they no longer contain `{ detail: { detail: ... }}`).
- touch event tests were added to the build/test runner.

## v3.2.0 (July 17, 2024)

- Documented the `setFiles` and `select` functions on FileTree.
- [bugfix/feature] errors are now `...:error` events rather than `throw`s, because the code was throwing errors in code paths where they could not be caught.
- Dev dependencies cleanup

## v3.1.0 (July 17, 2024)

- New CSS variables for ease-of-customization
- Directories automatically get more padding on touch devices to make drag-and-drop of entire dirs easier (you could too easily accidentally start dragging a file instead of a dir)
- [bugfix] File tree elements correctly clone now, no longer breaking the drag and drop shim

## v3.0.0 (July 16, 2024)

- Collapsed directories will now auto-open when selected.
- The CSS was completely rewritten, which is a breaking change.

## v2.0.0 (July 16, 2024)

Full rewrite, with test coverage.

- `setFiles` now clears the tree content, which is a breaking change.
- The top level "." dir no longer shows by default, which is a breaking change.
- The top level "." dir will only show when using the new `show-top-level="true"` attribute on `<file-tree>`
- File and dir entries are now persistent, with a `.state` variable that can be used as a persistent data store for the lifetime of the file tree (or until `setFiles` gets called).
- There is a `setState(update)` function that can be used to (synchronously) update the `state` variable. Note that this function is not required, you are free to modify `state` directly. (This isn't React, it's an HTML element)

## v1.0.x (July 7, 2024)

Initial release with a flurry of patch versions for fast-follow-up bug fixes and typos.
