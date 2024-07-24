# &lt;file-tree&gt;, the file tree element

This is an HTML custom element for adding file tree visualisation and interaction to your page.

Simply add the element .js and .css files to your page using plain HTML:

```html
<script src="somewhere/file-tree.esm.js" type="module" async></script>
<link rel="stylesheet" href="somewhere/file-tree.css" async />
```

And then you can work with any `<file-tree>` like you would any other HTML element. For example, if you like working in HTML and you want to bootstrap your file-tree off of an API endpoint:

```html
<file-tree src="./api/v1/dir-listing"></file-tree>
```

or if you prefer to work on the JS side, things are pretty much as expected:

```js
// query select, or really any normal way to get an element handle:
const fileTree = document.querySelector(`file-tree`);

// Bootstrap off of an endpoint:
fileTree.setAttribute(`src`, `./api/v1/dir-listing`);

// Or tell the file tree which files and directories exist directly:
fileTree.setContent([
  `README.md`,
  `dist/client.bundle.js`,
  `src/server/index.js`,
  `LICENSE.md`,
  `src/client/index.js`,
  `src/server/middleware.js`,
  `package.json`,
  `dist/client.bundle.min.js`,
]);
```

After which users can play with the file tree as much as they like: all operations generate "permission-seeking" events, which need to be explicitly granted before the filetree will let them happen, meaning that you have code like:

```js
filetree.addEventListener(`file:rename`, async ({ detail }) => {
  const { oldPath, newPath, grant } = detail;
  // we'll have the API determine whether this operation is allowed or not:
  const result = await api.renameFile(oldPath, newPath);
  if (result.error) {
    warnUser(`An error occurred trying to rename ${oldPath} to ${newPath}.`);
  } else if (result.denied) {
    warnUser(`You do not have permission to rename files.`);
  } else {
    grant();
  }
});
```

Thus ensuring that the file tree stays in sync with your real filesystem (whether that's through an api as in the example, or a client-side )

## Demo

There is [a live demo](https://pomax.github.io/custom-file-tree/public/) that shows off the above, with event handling set up to blanket-allow every action a user can take.

## Touch support

Part of the functionality for this element is based on the HTML5 drag-and-drop API (for parts of the file tree itself, as well as dragging files and folders into it from your device), which is notoriously based on "mouse events" rather than "pointer events", meaning there is no touch support out of the box.

However, **touch support can be trivially added** by loading the drag-drop-touch polyfill found over on https://github.com/Bernardo-Castilho/dragdroptouch:

```html
<script src="drag-drop-touch.esm.min.js?autoload" type="module"></script>
```

Load this as first thing on your page, and done: drag-and-drop using touch will now work.

## The &lt;file-tree&gt; API

### Functions

There are three functions supported by `<file-tree>`:

- `.setContent(paths)`,<br>This function sets the file tree content, with `paths` being an array of strings, where each string represents a relative path that uses `/` as path delimiter.
- `.select(path)`,<br>This function allows the programmatic selection of a directory or file entry without the user needing to click the entry. This function will throw if the provided path string does not match any of the paths in the file tree.
- `.unselect()`,<br>This function allows the programmatic unselecting of whichever directory or file entry is currently selected, if there is one.

### Attributes

#### The `src` attribute

Like `<image>` or `<script>`, the `<file-tree>` tag supports the `src` attribute for specifying a URL from which to load content. This content must be JSON data representing an array of strings, with each string representing a file or directory path.

```html
<file-tree src="./api/v1/get-dir"></file-tree>
```

#### The `remove-empty` attribute

Additionally, file trees may specify a `remove-empty` attribute, i.e.

```html
<file-tree remove-empty="true"></file-tree>
```

Setting this attribute tells the file tree that it may delete directories that become empty due to file move/delete operations.

By default, file trees content "normally", even though under the hood all content is wrapped by a directory entry with path "." to act as a root.

#### The `show-top-level` attribute

Finally, file trees specify a `show-top-level` attribute to show this root directory, i.e.

```html
<file-tree show-top-level="true"></file-tree>
```

### File and directory elements have a persistent state

If you wish to associate data with `<file-entry>` and `<dir-entry>` elements, you can do so by adding data to their `.state` property either directly, or by using the `.setState(update)` function, which takes an update object and applies all key:value pairs in the update to the element's state.

```js
const readme = fileTree.querySelector(`[path="README.md"]`);

// This works
readme.state.content = `...some file content...`;
readme.state.hash = `...`;
readme.state.timestamp = Date.now();

// As does this
readme.setState({
  content: `...`,
  hash: `...`,
  timestamp: Date.now(),
});
```

It should go without saying, but: this is an HTML element and state bindings are immediate.

## File tree events

As mentioned above, events are "permission seeking", meaning that they are dispatched _before_ an action is allowed to take place. Your event listener code is responsible for deciding whether or not that action is allowed to take place given the full context of who's performing it on which file/directory.

If an event is not allowed to happen, your code can simply exit the event handler. The file-tree will remain as it was before the user tried to manipulate it.

If an event is allowed to happen, your code must call `event.detail.grant()`, which lets the file tree perform the associated action.

### Events relating to trees:

Events are listed here as `name → detail object content`. Note that unlike regular file and directory events, these events do <em>not</em> come with a `grant()` function, and are informative, not permission-seeking (technically, they come with a no-op `grant()` function; running it will have no effect).

- `tree:add:file` → `{path}`,<br>Dispatched when a file entry is created as part of an initial addPath or src attribute resolution, with `path` representing the full path of the file in question.
- `tree:add:dir` → `{path}`,<br>Dispatched when a directory entry is created as part of an initial addPath or src attribute resolution, with `path` representing the full path of the directory in question.
- `tree:reset` → `{<empty>}`,<br>Dispatched when the file tree is cleared in order to load new content.
- `tree:ready` → `{<empty>}`,<br>Dispatched when the file tree has finished setting (new) content.

### Events relating to files:

Events are listed here as `name → detail object content`, with the `grant()` function omitted from the detail object in the following documentation. All file events come with a grant function.

- `file:click` → `{path}`,<br>Dispatched when a file entry is clicked, with `path` representing the full path of the file in question.<br>Granting this action will assign the `selected` class to the associated file entry.
- `file:create` → `{path, content?}`,<br>Dispatched when a new file is created by name, with `path` being the file's full path. If this file was created through a file "upload", it will also have a `content` value of type [ArrayBuffer](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer) representing the file's byte code.<br>Granting this action will create a new file entry, nested according to the `path` value.
- `file:rename` → `{oldPath, newPath}`,<br>Dispatched when an existing file is renamed by the user, with `oldPath` being the current file path, and `newPath` the desired new path.<br>Granting this action will change the file entry's label and path values.<br><strong>Note</strong>: file renames are (currently) restricted to file names only, as renames that include directory prefixes (including `../`) should be effected by just moving the file to the correct directory.
- `file:move` → `{oldPath, newPath}`,<br>Dispatched when a file gets moved to a different directory, with `oldPath` being the current file path, and `newPath` the desired new path.<br>Granting this action will move the file entry from its current location to the location indicated by `newPath`.
- `file:delete` → `{path}`,<br>Dispatched when a file gets deleted, with `path` representing the full path of the file in question.<br>Granting this action will remove the file entry from the tree.<br><strong>Note</strong>: if this is the only file in a directory, <em>and</em> the `<file-tree>` specifies the `remove-empty` attribute, the now empty directory will also be deleted, gated by a `dir:delete` permission event, but _not_ gated by a `confirm()` dialog to the user.

#### Error events

The following events will be emitted when certain errors occur. All errors have an event detail object that is the same as for the non-error event, with an additional `error` property that has a string value reflecting what went wrong.

- `file:create:error`,<br>Emitted when a file:create has failed.
- `file:rename:error`,<br>Emitted when a file:rename has failed.
- `file:move:error`,<br>Emitted when a file:move has failed.

### Events relating to directories:

Events are listed here as `name → detail object content`, with the `grant()` function omitted from the detail object in the following documentation. All directory events come with a grant function.

- `dir:click` → `{path}`,<br>Dispatched when a directory entry is clicked, with `path` representing the full path of the directory in question.<br>Granting this action will assign the `selected` class to the associated directory entry.
- `dir:toggle` → `{path, currentState}`,<br>Dispatched when a directory icon is clicked, with `path` representing the full path of the directory in question, and `currentState` reflecting whether this directory is currently visualized as `"open"` or `"closed"`, determined by whether or not its class list includes the `closed` class.<br>Granting this action will toggle the `closed` class on the associated directory entry.
- `dir:create` → `{path}`,<br>Dispatched when a directory gets created, with `path` being the directory's full path.<br>Granting this action will create a new directory entry, nested according to the `path` value.
- `dir:rename` → `{oldPath, newPath}`,<br>Dispatched when an existing directory is renamed by the user, with `oldPath` being the current directory path, and `newPath` the desired new path.<br>Granting this action will change the directory entry's label and path values.<br><strong>Note</strong>: directory nesting cannot (currently) be effected by renaming, and should instead be effected by just moving the directory into or out of another directory.
- `dir:move` → `{oldPath, newPath}`,<br>Dispatched when a directory gets moved to a different parent directory, with `oldPath` being the current directory path, and `newPath` the desired new path.<br>Granting this action will move the directory entry from its current location to the location indicated by `newPath`.
- `dir:delete` → `{path}`,<br>Dispatched when a directory gets deleted, with `path` representing the full path of the directory in question.<br>Granting this action will remove the directory entry (including its associated content) from the tree.<br><strong>Note</strong>: this action is gated behind a `confirm()` dialog for the user.

#### Error events

The following events will be emitted when certain errors occur. All errors have an event detail object that is the same as for the non-error event, with an additional `error` property that has a string value reflecting what went wrong.

- `dir:create:error`,<br>Emitted when a dir:create has failed.
- `dir:rename:error`,<br>Emitted when a dir:rename has failed.
- `dir:move:error`,<br>Emitted when a dir:move has failed.

## Customizing the styling

If you don't like the default styling, just override it! This custom element uses normal CSS, so you're under no obligation to load the `file-tree.css` file, either load it and then override the parts you want to customize, or don't even load `file-tree.css` at all and come up with your own styling.

That said, there are a number of CSS variables that you can override on the `file-tree` selector if you just want to tweak things a little, with their current definitions being:

```
file-tree {
  --fallback-icon: "🌲";
  --open-dir-icon: "📒";
  --closed-dir-icon: "📕";
  --file-icon: "📄";

  --dir-touch-padding: 0;
  --open-dir-icon-cursor: pointer;
  --closed-dir-icon-cursor: pointer;
  --dir-heading-cursor: pointer;
  --file-icon-cursor: pointer;
  --file-heading-cursor: pointer;

  --icon-size: 1.25em;
  --line-height: 1.5em;
  --indent: 1em;
  --entry-padding: 0.25em;

  --highlight-background: lightcyan;
  --highlight-border-color: blue;
  --drop-target-color: rgb(205, 255, 242);
}
```

For example, if you just want to customize the icons and colors, load the `file-tree.css` and then load your own overrides that set new values for those CSS variables. Nice and simple!

## Contributing

- If you think you've found a bug, feel free to file it over on the the issue tracker: https://github.com/Pomax/custom-file-tree/issues
- If you have ideas about how `<file-tree>` should work, start a discussion over on: https://github.com/Pomax/custom-file-tree/discussions
- If you just want to leave a transient/drive-by comment, feel free to contact me on mastodon: https://mastodon.social/@TheRealPomax

&mdash; Pomax
