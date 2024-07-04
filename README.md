Events relating to file elements:

  - [ ] filetree:file:create, dispatched when a new file is created by name, without content yet.
  - [ ] filetree:file:rename, dispatched when an existing file is renamed by the user.
  - [ ] filetree:file:upload, dispatched when a new file is created by drag-and-drop, with content.
  - [ ] filetree:file:move, dispatched when a file gets moved to a different directory
  - [ ] filetree:file:delete, dispatched when a file gets deleted.

Events relating to dir elements:

  - [ ] filetree:dir:create, dispatched when a directory gets created.
  - [ ] filetree:dir:rename, dispatched when a directory gets renamed.
  - [ ] filetree:dir:move, dispatched when a directory gets moved
  - [ ] filetree:dir:delete, dispatched when a directory gets deleted.

File tree elements may also specify a "remove-empty" attribute, in which case deleting the last file in a dir also dispatches a dir-deletion event.

The file tree can be instantiated by feeding it a flat file list using .setFiles(arr):

  - for Windows, that's "dir /b/o/s dirname", as an array
  - for everything else, that's "find dirname", as an array
  
