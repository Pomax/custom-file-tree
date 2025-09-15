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
export class WebSocketInterface {
  waitList = {};

  /**
   * Set up a websocket connection to a secure
   * endpoint for a given file tree element.
   */
  constructor(fileTree, url, basePath = `.`) {
    this.fileTree = fileTree;
    this.connect(url, basePath);
  }

  /**
   * Connect to a websocket server and let it know which
   * base path this file tree wants to be linked to, so
   * that it can be joined up with every other file tree
   * that's looking at/working with the same base path.
   *
   * @param {*} url
   * @param {*} basePath
   */
  async connect(url, basePath) {
    url = url.replace(`https://`, `wss://`);
    if (!url.startsWith(`wss://`)) {
      throw new Error(`Only secure URLs are supported.`);
    }

    // Set up our socket connection, and our message handler
    this.basePath = basePath;
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
      this.send(`file-tree:load`, { basePath });
    } else {
      throw new Error(`Could not establish websocket connection.`);
    }
  }

  /**
   * Mark a specific path as awaiting a "read" result.
   */
  async markWaiting(path, resolve) {
    this.waitList[path] = resolve;
  }

  /**
   * Send a message to the server
   */
  async send(type, detail = {}) {
    this.socket.send(JSON.stringify({ type, detail }));
  }

  // ==========================================================================

  /**
   * OT operation from file tree: inform the server of a file or dir creation.
   */
  async create(path, isFile, content) {
    this.send(`file-tree:create`, { path, isFile, content });
  }

  /**
   * OT operation from file tree: inform the server of a deletion.
   */
  async delete(path) {
    this.send(`file-tree:delete`, { path });
  }

  /**
   * OT operation from file tree: inform the server of a path change.
   */
  async move(oldPath, newPath) {
    this.send(`file-tree:move`, { oldPath, newPath });
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
  async read(path) {
    return new Promise((resolve) => {
      this.markWaiting(path, resolve);
      this.send(`file-tree:read`, { path });
    });
  }

  /**
   * OT operation from file tree: inform the server of a content update.
   */
  async update(path, type, update) {
    this.send(`file-tree:update`, { path, type, update });
  }

  // ==========================================================================

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
  async onload({ id, paths }) {
    this.id = id;
    this.fileTree.setContent(paths, true);
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
  async oncreate({ path, isFile, from }) {
    const { id, fileTree } = this;
    if (from === id) return; // we sent this change
    fileTree.__create(path, isFile);
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
  async ondelete({ path, from }) {
    const { id, fileTree } = this;
    if (from === id) return; // we sent this change
    fileTree.__delete(path);
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
  async onmove({ oldPath, newPath, from }) {
    const { id, fileTree } = this;
    if (from === id) return; // we sent this change
    fileTree.__move(oldPath, newPath);
  }

  /**
   * This is a special file content handler that
   * lets the `read` function resolve with the
   * content of the requested file.
   */
  async onread({ path, data }) {
    const { waitList } = this;
    waitList[path]?.({ data });
    delete waitList[path];
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
  async onupdate({ path, type, update, from }) {
    const { id, fileTree } = this;
    if (from === id) return; // we sent this change
    fileTree.__update(path, type, update);
  }
}

/**
 * Simple backing-off, retry-capped socket state monitor.
 * Eventually returns either true if the socket's ready
 * to receive data, or false if the socket is not working.
 */
async function waitForOpenWebSocket(socket, retries = 0, interval = 100) {
  if (retries === 10) return false;
  if (socket.readyState === WebSocket.OPEN) return true;
  const retry = () => waitForOpenWebSocket(socket, retries + 1, interval + 100);
  return new Promise((resolve) => setTimeout(() => resolve(retry), interval));
}
