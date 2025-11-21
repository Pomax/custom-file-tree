# How this library is versioned

This library _strictly_ adheres to [semver](https://semver.org)'s major.minor.patch versioning:

- patch version changes indicate bug fixes, internal-only changes, and docs updates.
- minor version changes indicate new functionality that does not break backward compatibility,
- major version changes indicate backward-incompatible external API changes, no matter how small.

Note that there may be gaps in the version history, which may happen if a release is pushed to npm but a problem is discovered fast enough to warrant an unpublish.

# Current Version

## v7.0.1 (November 21, 2025)

- The underlying way in which elements are constructed was changed so that constructors do not take any arguments, which means that `document.createElement` can be used to create individual dir and file entries, detached from any tree, and can be appended to a file tree the same way you'd append a child to any other DOM node.

This is a breaking change, and any code that relied on `new FileEntry(...)` or `new DirEntry(...)` will need to be rewritten to match the standard HTML "create new instance, assign properties, add to intended parent" pattern.

# Previous Versions

## v6.1.0 (October 14, 2025)

- You can now use `<file-tree readonly>`, where the `readonly` attribute prevents operations beyond selection and toggling folder state from getting bound for file tree content. Note that because of this, changing the attribute after you've loaded your file tree content will "do nothing" until you set new content.

## v6.0.1 (October 12, 2025)

- File entries now include their extension as an HTML element attribute, so that users can style entries based on extension (e.g. making sure to show appropriate entry header icons for different content types)

## v6.0.0 (October 12, 2025)

- Selecting a file entry in a closed folder chain will open all folders to that file entry. **This is a breaking change.**
- File entries now have an `.extension` property for work based on file extensions.
- `file:create` events now have a `bulk` flag that indicates whether this was a single file create/upload or whether this was a multi-file operations.
- added websocket support to allow for real time, collaborative file system work by letting you connect the `<file-tree>` to a websocket server (as long as it speaks the correct "protocol").
- added support for empty dirs by rewriting how `setContent` works, which now takes an object `{ dirs: [...], files: [...]}`. Technically both are optional, and the `dirs` list is only required if you need to bootstrap the file tree with empty directories (dirs with files in them will automatically get added in order to correctly place those files in the tree). **This is a breaking change.**

## v5.3.0 (August 21, 2025)

- added an optional value to &lt;dir-entry&gt;.toggle() so that you can explicity set a dir to open (`toggle(true)`) or closed (`toggle(false)`), to align it with the standard DOM classList.toggle

## v5.2.3 (August 4, 2025)

- fixed bug that prevented renaming a file by adding text to the end of the filename.

## v5.2.2 (August 3, 2025)

- fixed bug that would show dot-dirs as both a directory and a (broken) file entry.

## v5.2.0 (July 15, 2025)

Granting events now returns the element(s) involved:

- granting a `click` event returns the file or dir entry in question,
- granting a `create` event returns the file or dir entry in question,
- granting a `rename` event returns the file or dir entry in question,
- granting a `move` event returns the file or dir entry in question,
- granting a `delete` event returns an _array_ of entries, containing either a single element at index 0 if a file got deleted, or the dir entry at index 0 _plus all descendants_ in the subsequent indices, if a dir got deleted.

Additionally, the `show-top-level` attribute was missing CSS to change the styling, which has been fixed. This introduces the `--highlight-background-bw` CSS variable for controlling the color of the button bar when the top level "." path is hidden.

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

Similarly, any code that you've written for automatic button interaction using `querySelector` will need selectors like `[path="..."] > .create-dir` changed to `[path="..."] > .buttons .create-dir` instead.

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
