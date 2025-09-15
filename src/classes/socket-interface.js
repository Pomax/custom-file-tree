/**
 * This is the superclass that the file tree element expects if
 * you want to take advantage of OT-over-websocket functionaliy.
 *
 * Note that only secure web socket connections are allowed. If
 * you want to use this on localhost, run caddy with a trivial
 * reverse_proxy rule, like:
 *
 * localhost {
 *     reverse_proxy localhost:8000
 * }
 *
 * Done, https: and wss: now works on port 80 even though your
 * actual server's running on port 8000.
 */
export class SocketInterface {
  waitList = {};

  /**
   * Set up a websocket connection to a secure
   * endpoint for a given file tree element.
   */
  constructor(fileTree, url) {
    this.fileTree = fileTree;
    this.connect(url);
  }

  async send(type, detail = {}) {
    detail.id = this.id;
    this.socket.send(JSON.stringify({ type, detail }));
  }

  async markWaiting(path, resolve) {
    this.waitList[path] = resolve;
  }

  async connect(url) {
    url = url.replace(`https://`, `wss://`);
    if (!url.startsWith(`wss://`)) {
      throw new Error(`Only secure URLs are supported.`);
    }

    // Set up our socket connection, and our message handler
    this.wssURL = url;
    const socket = (this.socket = new WebSocket(url));

    // Set up our message handling
    socket.addEventListener(`message`, ({ data }) => {
      // This will throw, which is intentional
      data = JSON.parse(data);

      // Is this something we know how to handle?
      let { type } = data;
      if (!type.startsWith(`file-tree:`)) return;
      type = type.replace(`file-tree:`, ``);
      const handlerName = `on${type}`;
      const handler = this[handlerName].bind(this);
      if (!handler) {
        throw new Error(`Missing implementation for ${handlerName}.`);
      }

      // It is: handle it.
      handler(data.detail);
    });

    // And as last step, request the dir list
    if (await waitForOpenWebSocket(socket)) {
      this.send(`file-tree:load`);
    } else {
      throw new Error(`Could not establish websocket connection.`);
    }
  }

  /**
   * Build a tree off of a set of paths. This happens in
   * response to a message of the form:
   *
   * {
   *    "type": "file-tree:load",
   *    "detail": {
   *       "paths": []
   *    }
   * }
   *
   * where the `paths` payload is an array of strings.
   */
  onload({ paths, id }) {
    this.id = id;
    this.fileTree.setContent(paths, true);
  }

  /**
   * OT operation from file tree: inform the server of a file or dir creation.
   */
  create(path, isFile) {
    this.send(`file-tree:create`, { path, isFile });
  }

  /**
   * This is a special one time (well, ideally) operation for
   * getting file content via websockets rather than via a
   * REST API.
   *
   * The response will either be a string for textual data,
   * or an array of ints for binary data, where each array
   * element represents a byte value.
   */
  read(path) {
    return new Promise((resolve) => {
      this.markWaiting(path, resolve);
      this.send(`file-tree:read`, { path });
    });
  }

  /**
   * OT operation from file tree: inform the server of a path change.
   */
  move(oldPath, newPath) {
    this.send(`file-tree:move`, { oldPath, newPath });
  }

  /**
   * OT operation from file tree: inform the server of a content update.
   */
  update(path, update) {
    this.send(`file-tree:update`, { path, update });
  }

  /**
   * OT operation from file tree: inform the server of a deletion.
   */
  delete(path) {
    this.send(`file-tree:delete`, { path });
  }

  /**
   * Handle a create notification, which will tell us which
   * path got created, and when that creation happened.
   *
   * This happens in response to a message of the form:
   *
   * {
   *    "type": "file-tree:create",
   *    "detail": {
   *       "path": a path string
   *       "isFile": a bool
   *       "when": a server-side datetime int
   *       "by": a uuid string
   *    }
   * }
   */
  oncreate({ path, isFile, when, by }) {
    const { id, fileTree } = this;
    if (by === id) return; // we sent this change
    fileTree.__create(path, isFile, when);
  }

  /**
   * This is a special file content handler that
   * lets the `read` function resolve with the
   * content of the requested file.
   */
  onread({ path, data, when }) {
    const { waitList } = this;
    waitList[path]?.({ data, when });
    delete waitList[path];
  }

  /**
   * Handle a move notification, which will tell us
   * which path to rename, and when that rename happened.
   *
   * This happens in response to a message of the form:
   *
   * {
   *    "type": "file-tree:move",
   *    "detail": {
   *       "oldPath": a path string
   *       "newPath": a path string
   *       "when": a server-side datetime int
   *       "by": a uuid string
   *    }
   * }
   */
  onmove({ oldPath, newPath, when, by }) {
    const { id, fileTree } = this;
    if (by === id) return; // we sent this change
    fileTree.__move(oldPath, newPath, when);
  }

  /**
   * Handle a content update notification, which will tell
   * us which file to update, and when that update happened.
   *
   * This happens in response to a message of the form:
   *
   * {
   *    "type": "file-tree:update",
   *    "detail": {
   *       "path": a path string
   *       "update": an update payload
   *       "when": a server-side datetime int
   *       "by": a uuid string
   *    }
   * }
   */
  onupdate({ path, update, when, by }) {
    const { id, fileTree } = this;
    if (by === id) return; // we sent this change
    fileTree.__update(path, update);
  }

  /**
   * Handle a delete notification, which will tell us
   * which path got deleted, and when that delete happened.
   *
   * This happens in response to a message of the form:
   *
   * {
   *    "type": "file-tree:delete",
   *    "detail": {
   *       "path": a path string
   *       "isFile": a bool
   *       "when": a server-side datetime int
   *       "by": a uuid string
   *    }
   * }
   */
  ondelete({ path, when, by }) {
    const { id, fileTree } = this;
    if (by === id) return; // we sent this change
    fileTree.__delete(path, when);
  }
}

// Simple backing-off, retry-capped socket state monitor
async function waitForOpenWebSocket(socket, retries = 0, interval = 100) {
  if (retries === 10) return false;
  if (socket.readyState === WebSocket.OPEN) return true;
  const retry = () => waitForOpenWebSocket(socket, retries + 1, interval + 100);
  return new Promise((resolve) => setTimeout(() => resolve(retry), interval));
}
