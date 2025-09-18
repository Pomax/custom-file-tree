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
  // A list used to await content responses
  // from the server, so that users can just
  // "await" entry.load() calls.
  waitList = {};

  // An "optimistically applied" list of
  // pending actions that have been sent
  // off to the server, and have hopefully
  // been accepted, but may need undoing.
  pending = [];

  /**
   * Set up a websocket connection to a secure
   * endpoint for a given file tree element.
   */
  constructor(fileTree, url, basePath = `.`, keepAliveInterval = 60_000) {
    Object.assign(this, { fileTree, url, basePath, keepAliveInterval });
    this.connect();
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
  async connect(url = this.url, basePath = this.basePath) {
    url = url.replace(`https://`, `wss://`);
    if (!url.startsWith(`wss://`)) {
      throw new Error(`Only secure URLs are supported.`);
    }

    // Set up our socket connection, and our message handler
    const socket = (this.socket = new WebSocket(url));

    // Set up our message handling
    socket.addEventListener(`message`, ({ data }) => {
      // This will throw, which is intentional
      data = JSON.parse(data);

      // Is this something we know how to handle?
      let { type, detail } = data;
      if (!type.startsWith(`file-tree:`)) return;
      type = type.replace(`file-tree:`, ``);
      const handlerName = `on${type}`;
      const handler = this[handlerName].bind(this);
      if (!handler) {
        throw new Error(`Missing implementation for ${handlerName}.`);
      }

      // It is: handle it.
      if (this.checkSync(type, detail.seqnum)) handler(detail);
    });

    // Set up keep-alive functionality
    let keepAliveTimer;
    const keepAlive = () => {
      this.send(`file-tree:keepalive`, { basePath });
      keepAliveTimer = setTimeout(keepAlive, this.keepAliveInterval);
    };

    socket.addEventListener(`close`, () => {
      clearTimeout(keepAliveTimer);
    });

    // And as last step, request the dir list
    if (await waitForOpenWebSocket(socket)) {
      this.send(`file-tree:load`, { basePath });
      keepAlive();
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
    const action = { type, detail };
    this.pending.push(action);
    this.socket.send(JSON.stringify(action));
  }

  /**
   * Verify that we're (a) in sync with respect to the
   * sequence numbering for this folder, and (b) in sync
   * with respect to which operation we thought we were
   * going to see (if we're expecting our own operation(s)
   * as next one(s) in the sequence).
   * @param {*} type
   * @param {*} seqnum
   * @returns
   */
  checkSync(type, seqnum) {
    // loading the dir tree and reading file content
    // should bypass the sequence number check: the
    // first should *set* the sequence number, and
    // the second is not a transform and so is not
    // an action that needs sequence verification.
    if (type === `load`) return true;
    if (type === `read`) return true;

    // Is this in-sequence?
    if (seqnum === this.seqnum + 1) {
      // Are we expecting acknowledgement(s)?
      const { pending } = this;
      if (pending.length) {
        if (pending[0].type === type) {
          pending.shift();
        } else {
          // That's not what we expected, roll back our
          // change(s) because the server didn't okay them.
          this.rollback(pending.reverse());
        }
      }
      return (this.seqnum = seqnum);
    }

    // We're desynced, which means we'll need to ask the
    // server for everything that's happened since our
    // own sequence number, so we can apply those changes
    this.send(`file-tree:sync`, { seqnum: this.seqnum });
  }

  /**
   * Do we need to roll back any optimistic changes?
   */
  rollback(latestToOldest) {
    this.pending = [];
    for (const { type, detail } of latestToOldest) {
      if (type === `create`) {
        this.fileTree.__delete(detail.path);
      }
      if (type === `delete`) {
        this.fileTree.__create(detail.path, detail.isFile);
        this.read(path);
      }
      if (type === `move`) {
        this.fileTree.__move(detail.isFile, detail.newPath, detail.oldPath);
      }
      if (type === `update`) {
        // TODO: add code that lets users specify a content rollback function.
        //       However, for now just reload the file from the server.
        this.read(path);
      }
    }
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
  async move(isFile, oldPath, newPath) {
    this.send(`file-tree:move`, { isFile, oldPath, newPath });
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
  async onload({ id, dirs, files, seqnum }) {
    this.id = id;
    this.seqnum = seqnum;
    this.fileTree.setContent({ dirs, files }, true);
  }

  /**
   * Something has gone horribly wrong, and we need to
   * terminate this connection. If `reconnect` is true
   * we are allowed to reconnect so that we're back
   * in a good state.
   */
  async onterminate({ id, reconnect }) {
    if (this.id !== id) return;
    this.socket.close();
    if (reconnect) this.connect();
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
    const entry = fileTree.__create(path, isFile);
    // Because this bypasses the normal event system,
    // we need a way for user code to know that a file
    // was created by the OT system:
    fileTree.dispatchEvent(
      new CustomEvent(`ot:created`, { detail: { entry, path, isFile } }),
    );
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
    const entries = fileTree.__delete(path);
    // Because this bypasses the normal event system,
    // we need a way for user code to know that a file
    // was deleted by the OT system:
    fileTree.dispatchEvent(
      new CustomEvent(`ot:deleted`, { detail: { entries, path } }),
    );
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
  async onmove({ isFile, oldPath, newPath, from }) {
    const { id, fileTree } = this;
    if (from === id) return; // we sent this change
    const entry = fileTree.__move(isFile, oldPath, newPath);
    // Because this bypasses the normal event system,
    // we need a way for user code to know that a file
    // was moved by the OT system:
    fileTree.dispatchEvent(
      new CustomEvent(`ot:moved`, {
        detail: { entry, isFile, oldPath, newPath },
      }),
    );
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
    fileTree.__update(path, type, update, from === id);
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
