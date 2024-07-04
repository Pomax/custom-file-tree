# File tree behaviour

- [x] creates file entries
- [x] creates dir entries
- [x] creates empty dir entries
- [x] `remove-empty` removes dirs that are empty after explicit last-file delete.

NOTE: Look out for bugs relating to syncing: there were a few places where the
filename was hardcoded or used from initial scoped rather than looking up the
current value, which leads to errors when a file gets renamed.

# File events

## filetree:file:create

- in root
  - [x] sets `name` attribute
  - [x] sets `path` attribute
  - [x] sets heading text
  - [x] creates tab and editor
  - [x] autofocus on editor
  - [x] edits works

- in dir
  - [x] sets `name` attribute
  - [x] sets `path` attribute
  - [x] sets heading text
  - [x] creates tab and editor
  - [x] autofocus on editor
  - [x] edits works

- in dir, from root
  - [x] sets `name` attribute
  - [x] sets `path` attribute
  - [x] sets heading text
  - [x] creates tab and editor
  - [x] autofocus on editor
  - [x] edits works

- in nested dir
  - [x] sets `name` attribute
  - [x] sets `path` attribute
  - [x] sets heading text
  - [x] creates tab and editor
  - [x] autofocus on editor
  - [x] edits works

- in nested dir, from root
  - [x] sets `name` attribute
  - [x] sets `path` attribute
  - [x] sets heading text
  - [x] creates tab and editor
  - [x] autofocus on editor
  - [x] edits works

## filetree:file:rename

- in root
  - [x] renames file
  - [x] updates `path` attribute
  - [x] updates heading text
  - [x] creates tab and editor
  - [x] autofocus on editor
  - [x] edits works

- in dir
  - [x] renames file
  - [x] updates `path` attribute
  - [x] updates heading text
  - [x] creates tab and editor
  - [x] autofocus on editor
  - [x] edits works

- in nested dir
  - [x] renames file
  - [x] updates `path` attribute
  - [x] updates heading text
  - [x] creates tab and editor
  - [x] autofocus on editor
  - [x] edits works

## filetree:file:upload

- drag-and-drop file in root
  - [x] sets `name` attribute
  - [x] sets `path` attribute
  - [x] sets heading text
  - [x] creates tab and editor
  - [x] autofocus on editor
  - [x] edits works **but causes an initial hash mismatch**

- drag-and-drop file in dir
  - [x] sets `name` attribute
  - [x] sets `path` attribute
  - [x] sets heading text
  - [x] creates tab and editor
  - [x] autofocus on editor
  - [x] edits works **but causes an initial hash mismatch**

- drag-and-drop file in nested dir
  - [x] sets `name` attribute
  - [x] sets `path` attribute
  - [x] sets heading text
  - [x] creates tab and editor
  - [x] autofocus on editor
  - [x] edits works **but causes an initial hash mismatch**

## filetree:file:move

- move file from root to dir

  - [x] sets `name` attribute
  - [x] sets `path` attribute
  - [x] sets heading text
  - [x] creates tab and editor
  - [x] autofocus on editor
  - [x] edits works

- move file from dir to root

  - [x] sets `name` attribute
  - [x] sets `path` attribute
  - [x] sets heading text
  - [x] creates tab and editor
  - [x] autofocus on editor
  - [x] edits works

- move file from root to nested dir

  - [x] sets `name` attribute
  - [x] sets `path` attribute
  - [x] sets heading text
  - [x] creates tab and editor
  - [x] autofocus on editor
  - [x] edits works

- move file from nested dir to root

  - [x] sets `name` attribute
  - [x] sets `path` attribute
  - [x] sets heading text
  - [x] creates tab and editor
  - [x] autofocus on editor
  - [x] edits works

- move file from dir to nested dir

  - [x] sets `name` attribute
  - [x] sets `path` attribute
  - [x] sets heading text
  - [x] creates tab and editor
  - [x] autofocus on editor
  - [x] edits works

- move file from nested dir to dir
  - [x] sets `name` attribute
  - [x] sets `path` attribute
  - [x] sets heading text
  - [x] creates tab and editor
  - [x] autofocus on editor
  - [x] edits works

## filetree:file:delete

- [x] file is removed
- [x] `cmInstances` record is removed

# Dir events

## filetree:dir:create

- [x] in the root
- [x] in another dir

## filetree:dir:rename

- [x] in the root
  - [x] file content updates name/path, heading, and editor bindings
- [x] in another dir
  - [x] file content updates name/path, heading, and editor bindings

## dir related part of filetree:file:upload

- [x] drag-and-drop a file
- [x] drag-and-drop multiple files
- [x] drag-and-drop entire dir with content

## filetree:dir:move

- [x] from the root to another dir
- [x] from a dir to the root

## filetree:dir:delete

- [x] delete empty dir
- [x] delete dir with file content
- [x] delete dir with dir content

