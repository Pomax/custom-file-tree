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

The filetree will emit events based on the _intent_ of performing operations. All events come with an `event.detail.commit` that is a function that must be called to allow the filetree to perform the operation it wanted to perform. For example, a file rename will not "just happen" and then you get told about it, instead a `filetree:file:rename` event gets generated, and your own code will be responsible for deciding whether that rename is allowed. If it is, you call `evt.detail.commit()` to tell the file tree to go ahead with that operation.

Events relating to files:

  - [ ] filetree:file:create, dispatched when a new file is created by name, without content yet.
  - [ ] filetree:file:rename, dispatched when an existing file is renamed by the user.
  - [ ] filetree:file:upload, dispatched when a new file is created by drag-and-drop, with content.
  - [ ] filetree:file:move, dispatched when a file gets moved to a different directory
  - [ ] filetree:file:delete, dispatched when a file gets deleted.

Events relating to directories:

  - [ ] filetree:dir:create, dispatched when a directory gets created.
  - [ ] filetree:dir:rename, dispatched when a directory gets renamed.
  - [ ] filetree:dir:move, dispatched when a directory gets moved
  - [ ] filetree:dir:delete, dispatched when a directory gets deleted.

File tree tags may also specify a "remove-empty" attribute, i.e. `<file-tree remove-empty></file-tree>` in which case deleting the last file in a directory  also dispatches a dir-deletion event.
