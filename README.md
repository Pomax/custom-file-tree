# &lt;file-tree&gt;, the file tree element

This is an HTML custom element for adding file tree visualisation and interaction to your page.

Simply add the element .js and .css files to your page using plain HTML:

```html
<script src="somewhere/file-tree.esm.js" type="module" async></script>
<link rel="stylesheet" href="somewhere/file-tree.css" async />
```

And then you can work with any `<file-tree>` like you would any other HTML element. For example:

```js
// query select, or really any normal way to get an element handle:
const fileTree = document.querySelector(`file-tree`);

// Tell the file tree which files exist
fileTree.setContent({
  files: [
    `README.md`,
    `dist/client.bundle.js`,
    `src/server/index.js`,
    `LICENSE.md`,
    `src/client/index.js`,
    `src/server/middleware.js`,
    `package.json`,
    `dist/client.bundle.min.js`,
  ],
});
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

**However**, touch support can be trivially achieved using the following shim, which has its own repository over on https://github.com/pomax/dragdroptouch (which is a fork of https://github.com/Bernardo-Castilho/dragdroptouch, rewritten as a modern ESM with support for autoloading)

```html
<script
  src="https://pomax.github.io/dragdroptouch/dist/drag-drop-touch.esm.min.js?autoload"
  type="module"
></script>
```

Load this as first thing on your page, and done: drag-and-drop using touch will now work.

## File tree elements have a persistent state

If you wish to associate data with `<file-entry>` and `<dir-entry>` elements, you can do so by adding data to their `.state` property either directly, or by using the `.setState(update)` function, which takes an update object and applies all key:value pairs in the update to the element's state.

While in HTML context this should be obvious: this is done synchronously, unlike the similarly named function that you might be familiar with from frameworks like React or Preact. The `<file-tree>` is a normal HTML element and updates take effect immediately.

# File tree element properties

There are three elements that make up a file tree, namely the `<file-tree>`, the `<dir-entry>`, and the `<file-entry>`, each with a set of JS properties and methods that you can use to "do things" with your file tree:

## File tree properties and methods

- `.root` returns a reference to itself
- `.parentDir()` returns the top-level directory entry in this tree
- `.clear()` removes everything from this tree and then adds a new top-level dir.
- `.setContent({ dirs, files })` adds all dirs and files to this tree. Both values should be arrays of strings, and `dirs` is _only_ required for dirs that do not have any files in them. Every other dir will automatically be found based on parsing file paths.
- `.createEntry(path, isFile, content, bulk)` adds a single entry to the file tree, where `path` is the file or dir path, `isFile` is a boolean to indicate whether this is a file (true) or dir (false), `content` is the file content, left undefined if there is no content known ahead of time, and `bulk` is a flag that you can pass to indicate whether or not this is part of a larger bulk insertion process, which gets passed along as part of the `file:create` event so your code can decide what to do in response to that.
- `.loadEntry(path)` load a file's content if there is a websocket connection to a server available.
- `.updateEntry(path, type, update)` notifies the server of a file content change, if there is a websocket connection to a server available. `path` is the file path, `type` is a free-form string identifier for you to make sure that your client and server both know how to work with "whatever `update` is". E.g. you could use text diffs where `update` is a string representing a diff patch, and so you use the type `"diff"` so that the server can make sure not to do anything with updates that don't use that as a type indicator.
- `.renameEntry(entry, newname)` rename an entry.
- `.moveEntry(entry, newpath)` moves an entry from one location in the tree to another
- `.removeEntry(entry)` remove an entry from three
- `.select(path)` select an entry in the tree by path
- `.unselect()` unselect the currently selected entry (if there is one)
- `.toggleDirectory(entry)` fold an open dir, or open a folder dir (see the `entry.closed` property to figure out which state it's in first =)
- `.toJSON()` get a JSON-serialized representation of this tree.

## Shared dir and file entry properties and methods

- `.state` a convenient place to put data that you need associated with file tree entries, persistent across renames/moves.
- `.setState(update)` _synchronously_ update the state object, based on a property copy operation.
- `.name` the name part of this entry's path
- `.path` the full path for this entry
- `.root` the `<file-tree>` element that this entry is in
- `.parentDir` the parent dir entry that this entry is nested under
- `.dirPath` the path of the dir that this entry is nested in
- `.select()` select this entry

There are also three convenience functions akin to query selecting:

- `.find(qs)` finds the first HTML element that matches the given query selector scoped to this element
- `.findAll(qs)` finds all HTML elements that match the given query selector scoped to this element, and returns them as an array.
- `.findAllInTree(qs)` finds all HTML elements that match the given query selector scoped to the entire tree, and returns them as an array.

## Dir entry properties and methods

- `.isDir` a convenient check flag, always `true` for directories.
- `.toggle(closed)` fold or open this dir, where `closed` is a boolean value.
- `.toJSON()` get a JSON-serialized representation of this directory.

## File entry properties and methods

- `.isFile` a convenient check flag, always `true` for files.
- `.extension` the file extension part of this file's path, if there is one
- `.load()` an convenience function that falls through to the file tree's `loadEntry` method.
- `.updateContent(type, update)` a convenience function that falls through to the file tree's `updateEntry` method.
- `.toJSON()` get a JSON-serialized representation of this file.

# File tree events

As mentioned above, events are "permission seeking", meaning that they are dispatched _before_ an action is allowed to take place. Your event listener code is responsible for deciding whether or not that action is allowed to take place given the full context of who's performing it on which file/directory.

If an event is not allowed to happen, your code can simply exit the event handler. The file-tree will remain as it was before the user tried to manipulate it.

If an event is allowed to happen, your code must call `event.detail.grant()`, which lets the file tree perform the associated action.

If you wish to receive a signal for when the tree has "in principle" finished building itself (because file/dir add operations may still be pending grants), you can listen for the `tree:ready` event.

## Events relating to files:

Events are listed here as `name → detail object content`, with the `grant` function omitted from the detail object, as by definition all events come with a grant function.

- `file:click` → `{element, path}`,<br>Dispatched when a file entry is clicked, with `path` representing the full path of the file in question.<br>Granting this action will assign the `selected` class to the associated file entry.
- `file:create` → `{path, content?, bulk?}`,<br>Dispatched when a new file is created by name, with `element` being the file tree element, and `path` being the file's full path. If this file was created through a file "upload", it will also have a `content` value of type [ArrayBuffer](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer) representing the file's byte code. If the `bulk` flag is set to `true` then this was part of a bulk insertion (e.g. a folder upload).<br>Granting this action will create a new file entry, nested according to the `path` value.
- `file:rename` → `{oldPath, newPath}`,<br>Dispatched when an existing file is renamed by the user, with `oldPath` being the current file path, and `newPath` the desired new path.<br>Granting this action will change the file entry's label and path values.<br><strong>Note</strong>: file renames are (currently) restricted to file names only, as renames that include directory prefixes (including `../`) should be effected by just moving the file to the correct directory.
- `file:move` → `{oldPath, newPath}`,<br>Dispatched when a file gets moved to a different directory, with `oldPath` being the current file path, and `newPath` the desired new path.<br>Granting this action will move the file entry from its current location to the location indicated by `newPath`.
- `file:delete` → `{path}`,<br>Dispatched when a file gets deleted, with `path` representing the full path of the file in question.<br>Granting this action will remove the file entry from the tree.<br><strong>Note</strong>: if this is the only file in a directory, <em>and</em> the `<file-tree>` specifies the `remove-empty` attribute, the now empty directory will also be deleted, gated by a `dir:delete` permission event, but _not_ gated by a `confirm()` dialog to the user.

## Events relating to directories:

- `dir:click` → `{path}`,<br>Dispatched when a directory entry is clicked, with `path` representing the full path of the directory in question.<br>Granting this action will assign the `selected` class to the associated directory entry.
- `dir:toggle` → `{path, currentState}`,<br>Dispatched when a directory icon is clicked, with `path` representing the full path of the directory in question, and `currentState` reflecting whether this directory is currently visualized as `"open"` or `"closed"`, determined by whether or not its class list includes the `closed` class.<br>Granting this action will toggle the `closed` class on the associated directory entry.
- `dir:create` → `{path}`,<br>Dispatched when a directory gets created, with `path` being the directory's full path.<br>Granting this action will create a new directory entry, nested according to the `path` value.
- `dir:rename` → `{oldPath, newPath}`,<br>Dispatched when an existing directory is renamed by the user, with `oldPath` being the current directory path, and `newPath` the desired new path.<br>Granting this action will change the directory entry's label and path values.<br><strong>Note</strong>: directory nesting cannot (currently) be effected by renaming, and should instead be effected by just moving the directory into or out of another directory.
- `dir:move` → `{oldPath, newPath}`,<br>Dispatched when a directory gets moved to a different parent directory, with `oldPath` being the current directory path, and `newPath` the desired new path.<br>Granting this action will move the directory entry from its current location to the location indicated by `newPath`.
- `dir:delete` → `{path}`,<br>Dispatched when a directory gets deleted, with `path` representing the full path of the directory in question.<br>Granting this action will remove the directory entry (including its associated content) from the tree.<br><strong>Note</strong>: this action is gated behind a `confirm()` dialog for the user.

## Special attributes

File tree tags may specify a "remove-empty" attribute, i.e.

```html
<file-tree remove-empty="true"></file-tree>
```

Setting this attribute tells the file tree that it may delete directories that become empty due to file move/delete operations.

By default, file trees content "normally", even though under the hood all content is wrapped by a directory entry with path "." to act as a root. File tree tags may specify a "show-top-level" attribute to show this root directory, i.e.

```html
<file-tree show-top-level="true"></file-tree>
```

## Connecting via Websocket

The `<file-tree>` element can be told to connect via a secure websocket, rather than using REST operations, in which case things may change "on their own".

Any "create", "move" ("rename"), and "delete" operations that were initiated remotely will be automatically applied to your `<file-tree>` (bypassing the `grant` mechanism) in order to keep you in sync with the remote.

The "update" operation is somewhat special, as `<file-tree>` is agnostic about how you're dealing with file content, instead relying on you to hook into the `file:click` event to do whatever you want to do. However, file content changes _can_ be initiated by the server, in which case the relevant `<file-entry>` will generate a `content:update` event that you can listen for in your code:

```js
const content = {};

fileTree.addEventListener(`file:click`, async ({ detail }) => {
  // Get this file's content from the server
  const entry = detail.entry ?? detail.grant();
  const data = (content[entry.path] ??= (await entry.load()).data);
  currentEntry = entry;

  // And then let's assume we do something with that
  // content, like showing it in a code editor
  updateEditor(currentEntry, data);

  // We then make sure to listen to content updates
  // from the server, so we can update our local
  // copy to reflect the remote copy:
  entry.addEventListener(`content:update`, async (evt) => {
    const { type, update } = evt.detail;
    if (type === `some agreed upon mechanism name`) {
      // Do we have a local copy of this file?
      const { path } = entry;
      if (!content[path]) return;

      // We do: update our local copy to be in sync
      // with the remote copy at the server:
      const oldContent = content[path];
      const newContent = updateLocalCopy(oldContent, update);
      content[path] = newContent;

      // And then if we were viewing this entry in our
      // code editor, update that:
      if (entry === currentEntry) {
        updateEditor(currentEntry, newContent);
      }
    }
  });
});
```

See the websocket demo for a much more detailed, and fully functional, example of how you might want to use this.

### Connecting a file tree via websockets: client-side

To use "out of the box" websocket functionality, create your `<file-tree>` element with a `websocket` attribute. With that set up, you can connect your tree to websocket endpoint using:

```js
if (fileTree.hasAttribute(`websocket`)) {
  // What URL do we want to connect to?
  const url = `https://server.example.com`;

  // Which basepath should this file tree be looking at?
  // For example, if the server has a `content` dir that
  // is filled with project dirs, then a file tree connection
  // "for a specific project" makes far more sense than a
  // conection that shows every single project dir.
  //
  // Note that this can be omitted if that path is `.`
  const basePath = `.`;

  // Let's connect!
  fileTree.connectViaWebSocket(url, basePath);
}
```

The url can be either `https:` or `wss:`, but it _must_ be a secure URL. For what are hopefully incredibly obvious security reasons, websocket traffic for file tree operations will not work using insecure plain text transmission.

When a connection is established, the file tree will automatically populate by sending a JSON-encoded `{ type: "file-tree:load" }` object to the server, and then waiting for the server to respond with a JSON-encoded `{ type: "file-tree:load", detail: { dirs: [...], files: [...] }}` where the `{ dirs, files }` content is the same as is used by the `setContent` function.

#### Responding to OT changes

While the regular file tree events are for local user initiated actions, there are additional events for when changes are made due to remote changes. These events are generated _after_ the file tree gets updated and do no have a "grant" mechanism (you don't get a choice in terms of whether to stay in sync with the remote server of course)

- `ot:created` with event details `{ entry, path, isFile }` where `entry` is the new entry in the file tree
- `ot:moved` with event details `{ entry, isFile, oldPath, newPath }` where `entry` is the moved entry in the file tree. Note that this even is generated in response to a rename as well as a move, as those are the same operation under the hood.
- `ot:deleted` with event details `{ entries, path }` where `path` is the deleted path, and `entries` is an array of one or more entries that were removed from the file tree as a result.

### Connecting a file tree via websockets: server-side

In order for a `<file-tree>` to talk to your server over websockets, you will need to implement the following contract, where each event is sent as a JSON encoded message:

On connect, the server should generate a unique `id` that it can use to track call origins, so that it can track what to send to whom. When file trees connect, they will send a JSON-encoded `{ type: "file-tree:load" }` object, which should trigger a server response that is a a JSON-encoded `{ type: "file-tree:load", detail: { id, paths: [...] }}` where the `paths` content is an array of path strings, and the `id` is the unique `id` that was generated when the connection was established, so that clients know their server-side identity.

#### Create

Create calls are sent by the client as:

```
{
  type: "file-tree:create",
  detail: {
    id: the client's id,
    path: "the entry's path string",
    isFile: true if file creation, false if dir creation
  }
}
```

and should be transmitted to clients as:

```
{
  type: "file-tree:create",
  detail: {
    from: id of the origin
    path: "the entry's path string",
    isFile: true if file, false if dir
    when: the datetime int for when the server applied the create
  }
}
```

The `id` can be used in your code to identify other clients (e.g. to show "X did Y" notifications), and the `when` argument is effectively the server-side sequence number. Actions will always be applied in chronological order by the server, and clients can use the `when` value as a way to tell whether they're out of sync or not.

#### Move/rename

Move/rename calls are sent by the client as:

```
{
  type: "file-tree:move",
  detail: {
    id: the client's id,
    oldPath: "the entry's path string",
    newPath: "the entry's path string"
  }
}
```

and should be transmitted to clients as:

```
{
  type: "file-tree:move",
  detail: { from, oldPath, newPath, when }
}
```

#### Update

Update calls are sent by the client as:

```
{
  type: "file-tree:update",
  detail: {
    id: the client's id,
    path: "the entry's path string",
    update: the update payload
  }
}
```

Note that the update payload is up to whoever implements this client/server contract, because there are a million and one ways to "sync" content changes, from full-fat content updates to sending diff patches to sending operation transforms to even more creative solutions.

Updates should be transmitted to clients as:

```
{
  type: "file-tree:update",
  detail: { from, path, update, when }
}
```

#### Delete

Delete calls are sent by the client as:

```
{
  type: "file-tree:delete",
  detail: {
    id: the client's id,
    path: "the entry's path string",
  }
}
```

Deletes should be transmitted to clients as:

```
{
  type: "file-tree:update",
  detail: { from, path, when }
}
```

Note that deletes from the server to the client don't need to say whether to remove an empty dir: if the dir got removed, then the delete that clients will receive is for that dir, not the file whose removal triggered the empty dir deletion

#### Read

There is a special `read` event that gets sent by the client as

```
{
  type: "file-tree:read",
  detail {
    path: "the file's path"
  }
}
```

This is a request for the server to send the entire file's content back using the format:

```
{
  type: "file-tree:read",
  details { path, data, when }
}
```

In this response `data` is either a string or an array of ints. If the latter, this is binary data, where each array element represents a byte value.

This call is (obviously) not forwarded to any other clients, and exists purely as a way to bootstrap a file's content synchronization, pending future `file-tree:update` messages.

### Keep-alive functionality

Websocket clients send a keep-alive signal in the form of a message that takes the form:

```
{
  type: `file-tree:keepalive`,
  detail: {
    basePath: `the base path that this client was registered for`
  }
}
```

This can be ignored, or you can use it as a way to make sure that "whatever needs to be running" stays running while there's an active websocket connection, rather than going to sleep, getting shut down, or otherwise being made unavailable. Note that this is a one way message, no response is expected.

By default the send interval for this message is 60 seconds, but this can be changed by passing an interval in milliseconds as third argument to the `connectViaWebSocket` function:

```js
if (fileTree.hasAttribute(`websocket`)) {
  // Our websocket server
  const url = `wss://server.example.com`;
  
  // The remote dir we want to watch:
  const basePath = `experimental`;

  // With a keepalive signal sent every 4 minutes and 33 seconds:
  const keepAliveInterval = 273_000;

  fileTree.connectViaWebSocket(url, basePath, keelAliveInterval);
}
```

## Customizing the styling

If you don't like the default styling, just override it! This custom element uses normal CSS, so you're under no obligation to load the `file-tree.css` file, either load it and then override the parts you want to customize, or don't even load `file-tree.css` at all and come up with your own styling.

That said, there are a number of CSS variables that you override on the `file-tree` selector if you just want to tweak things a little, with their current definitions being:

```
file-tree {
  --fallback-icon: "🌲";
  --open-dir-icon: "📒";
  --closed-dir-icon: "📕";
  --file-icon: "📄";

  --icon-size: 1.25em;
  --line-height: 1.5em;
  --indent: 1em;
  --entry-padding: 0.25em;
  --highlight-background: lightcyan;
  --highlight-background-bw: #ddd;
  --highlight-border-color: blue;
  --drop-target-color: rgb(205, 255, 242);
}
```

For example, if you just want to customize the icons and colors, load the `file-tree.css` and then load your own overrides that set new values for those CSS variables. Nice and simple!

# Contributing

- If you think you've found a bug, feel free to file it over on the the issue tracker: https://github.com/Pomax/custom-file-tree/issues
- If you have ideas about how `<file-tree>` should work, start a discussion over on: https://github.com/Pomax/custom-file-tree/discussions
- If you just want to leave a transient/drive-by comment, feel free to contact me on mastodon: https://mastodon.social/@TheRealPomax

&mdash; Pomax
