Add the custom element to your page context using plain old HTML:

```html
<script src="somewhere/file-tree/index.js" type="module" async></script>
```

And then you can load content into any `<file-tree>` using

```js
const filetree = get a reference to your element
filetree.setFiles([
  `some.array`,
  `of/files.with`,
  `arbitrarily/deep.nesting`
]);
```

[There's even a live demo](https://pomax.github.io/custom-file-tree/public/).

The file tree will emit events based on the _intent_ of performing operations. All events come with an `event.detail.grant` that is a function that must be called to allow the filetree to perform the operation it wanted to perform. For example, a file rename will not "just happen" and then you get told about it, instead a `file:rename` event gets generated, and your own code will be responsible for deciding whether that rename is allowed. If it is, you call `evt.detail.grant()` to tell the file tree to go ahead with that operation.

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
