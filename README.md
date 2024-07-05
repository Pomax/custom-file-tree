# &lt;file-tree&gt;, the file tree element

Add the custom element to your page context using plain old HTML:

```html
<script src="somewhere/file-tree.esm.js" type="module" async></script>
<link rel="stylesheet" href="somewhere/file-tree.css" async>
```

And then you can load content into any `<file-tree>` using

```js
// query select, or really any normal way to get an element handle:
const fileTree = document.querySelector(`file-tree`);

// Tell the file tree which files exist
fileTree.setFiles([
  `some.array`,
  `of/files.with`,
  `arbitrarily/deep.nesting`
]);
```

## Some Details

### [For instance, a live demo](https://pomax.github.io/custom-file-tree/public/).

The file tree will emit events based on the _intent_ of performing operations. All events come with an `event.detail.grant` that is a function that must be called to allow the filetree to perform the operation it wanted to perform. For example, a file rename will not "just happen" and then you get told about it, instead a `file:rename` event gets generated, and your own code will be responsible for deciding whether that rename is allowed. If it is, you call `evt.detail.grant()` to tell the file tree to go ahead with that operation.

And while part of the functionality for this element is based on drag-and-drop (for parts of the file tree itself, as well as dragging files and folders into it from your device), and that part of the web stack usually doesn't play nice with touch events, we can trivially "make it work for touch devices" by adding a simple shim:

```html
<script src="https://pomax.github.io/dragdroptouch/dist/drag-drop-touch.esm.min.js?autoload" type="module"></script>
```

Done, touch now works.

## Events

Events relating to files:

  - `file:click`, dispatched when a file entry is clicked.
  - `file:create`, dispatched when a new file is created by name, without content yet.
  - `file:rename`, dispatched when an existing file is renamed by the user.
  - `file:upload`, dispatched when a new file is created by drag-and-drop, with content.
  - `file:move`, dispatched when a file gets moved to a different directory
  - `file:delete`, dispatched when a file gets deleted.

Events relating to directories:

  - `dir:click`, dispatched when a directory heading is clicked.
  - `dir:create`, dispatched when a directory gets created.
  - `dir:rename`, dispatched when a directory gets renamed.
  - `dir:move`, dispatched when a directory gets moved
  - `dir:delete`, dispatched when a directory gets deleted.

File tree tags may also specify a "remove-empty" attribute, i.e. `<file-tree remove-empty></file-tree>`, in which case deleting the last file in a directory removes that directory.
