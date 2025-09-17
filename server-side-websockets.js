import http from "node:http";
import { join } from "node:path";
import { WebSocketServer } from "ws";
import { randomUUID } from "node:crypto";
import { applyPatch } from "./public/jsdiff.js";
import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
  globSync,
  lstatSync,
} from "node:fs";

// Scope all events to the file tree
const FILETREE_PREFIX = `file-tree:`;

/**
 * The default update handler is a diff/patch handler.
 */
const DEFAULT_HANDLER = function updateHandler(fullPath, type, update) {
  if (type === `jsdiff`) {
    const oldContent = readFileSync(fullPath).toString();
    const newContent = applyPatch(oldContent, update);
    writeFileSync(fullPath, newContent.toString());
  } else {
    console.warn(`Unknown update type "${type}" in file:update handler.`);
  }
};

/**
 * ...docs go here...
 */
export function setupFileTreeWebSocket(
  app,
  contentDir,
  updateHandler = DEFAULT_HANDLER
) {
  // Set up websocket functionality
  const server = http.createServer(app);
  const wss = new WebSocketServer({ clientTracking: false, noServer: true });
  server.on("upgrade", (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit(`connection`, ws, request);
    });
  });

  wss.on("connection", (socket, request) => {
    addFileTreeCommunication(socket, contentDir, updateHandler);
  });

  return server;
}

/**
 * Anyone can use this function to tack file-tree compatible
 * message handling to a websocket.
 */
export async function addFileTreeCommunication(
  socket,
  contentDir = `.`,
  updateHandler = DEFAULT_HANDLER,
  warnings = true
) {
  // Our websocket based request handler.
  const otHandler = new OTHandler(socket, contentDir, updateHandler);

  socket.on("message", (message) => {
    // This will not throw, because a server shouldn't crash out.
    let data = message.toString();
    try {
      data = JSON.parse(data);
    } catch (e) {
      if (warnings)
        console.warn(
          `Received incompatible data via websocket: message is not JSON.`,
          data
        );
    }
    if (!data) return;

    // Is this something we know how to handle?
    let { type } = data;
    if (!type.startsWith(FILETREE_PREFIX)) return;
    type = type.replace(FILETREE_PREFIX, ``);
    const handlerName = `on${type}`;
    const handler = otHandler[handlerName].bind(otHandler);
    if (!handler) {
      return console.warn(`Missing implementation for ${handlerName}.`);
    }
    handler(data.detail);
  });
}

// ============================================================================

const seqnums = {};
const changelog = {};
const handlers = {};

/**
 * Ensure we're aware of this path
 */
function init(basePath) {
  if (seqnums[basePath]) return;
  handlers[basePath] ??= new Set();
  changelog[basePath] = [];
  seqnums[basePath] = 1;
}

/**
 * Add a handler for events relating to
 * a specific folder's content.
 */
function addHandler(otHandler) {
  const { basePath } = otHandler;
  init(basePath);
  handlers[basePath].add(otHandler);
}

/**
 * Do the obvious thing
 */
function removeHandler(otHandler) {
  handlers[otHandler.basePath].delete(otHandler);
}

/**
 * Save an action to the list of transformations
 * that have been applied to this folder's content
 * since we started "looking" at it.
 *
 * Each action tracks who initiated it, when the
 * server received it, and which operation in the
 * sequence of transformations this is, so that
 * clients can tell whether or not they missed
 * any operations (and if so, request a full
 * sync via the file-tree:read operations).
 */
function addAction({ basePath, id }, action) {
  action.from = id;
  action.when = Date.now();
  action.seqnum = seqnums[basePath]++;
  changelog[basePath].push(action);
  broadcast(basePath, action);
}

/**
 * Broadcast an action to all listeners,
 * including the sender, so that they know
 * that the server processed it.
 */
async function broadcast(basePath, action) {
  handlers[basePath].forEach((handler) => {
    if (handler.unreliable) return;
    const { action: type, ...detail } = action;
    // console.log(`broadcasting [${basePath}]:[${detail.seqnum}]`)
    handler.send(type, detail);
  });
}

// ============================================================================

/**
 * An "operational transform" handler for file system operations,
 * with a "change type agnostic" file content update handling
 * mechanism that signals content updates, but does not process
 * them itself, instead relying on the `updateHandler` function
 * provided as part of the constructor call.
 */
class OTHandler {
  constructor(socket, contentDir, updateHandler = () => {}) {
    this.id = randomUUID();
    Object.assign(this, { socket, contentDir, updateHandler });
  }

  unload() {
    removeHandler(this);
    this.unreliable = true;
    this.socket.close();
    delete this.contentDir;
    delete this.basePath;
  }

  send(type, detail) {
    type = FILETREE_PREFIX + type;
    try {
      this.socket.send(JSON.stringify({ type, detail }));
    } catch (e) {
      // Well that's a problem...? Make sure we don't
      // try to use this handler anymore because the
      // odds of data integrity are basically zero now.
      this.unload();
    }
  }

  getFullPath(path) {
    if ([`..`, `:`].some((e) => path.includes(e))) return false;
    return join(this.contentDir, this.basePath, path);
  }

  // ==========================================================================

  async onload({ basePath, reconnect }) {
    this.basePath = basePath;
    addHandler(this);
    const dirs = [];
    const files = globSync(`./**/*`, { cwd: this.contentDir }).filter(
      (path) => {
        const s = lstatSync(join(this.contentDir, path));
        if (s.isFile()) return true;
        dirs.push(path);
        return false;
      }
    );
    const seqnum = seqnums[basePath] - 1;
    this.send(`load`, { id: this.id, dirs, files, seqnum, reconnect });
  }

  async onsync({ seqnum }) {
    if (seqnum > seqnums[this.basePath]) {
      // this shouldn't be possible. Whatever this client
      // is doing, it needs to stop and reconnect.
      this.send(`terminate`, { reconnect: true });
      this.unload();
    }

    // build the list of "messages missed":
    const actions = changelog[this.basePath]
      .filter((a) => a.seqnum > seqnum)
      .sort((a, b) => a.seqnum - b.seqnum);

    // Then send those at 15ms intervals so the (hopefully!)
    // arrive in sequence with plenty of time to process them.
    for (const { type, detail } of actions) {
      this.send(type, detail);
      await new Promise((resolve) => resolve, 15);
    }
  }

  // ==========================================================================

  async oncreate({ path, isFile, content = `` }) {
    // console.log(`on create in ${this.basePath}:`, { path, isFile });
    const fullPath = this.getFullPath(path);
    if (!fullPath) return;
    if (isFile) {
      writeFileSync(fullPath, content);
    } else {
      mkdirSync(fullPath, { recursive: true });
    }
    addAction(this, { action: `create`, path, isFile, content });
  }

  async onmove({ isFile, oldPath, newPath }) {
    // console.log(`on move in ${this.basePath}:`, { oldPath, newPath });
    const fullOldPath = this.getFullPath(oldPath);
    if (!fullOldPath) return;
    const fullNewPath = this.getFullPath(newPath);
    if (!fullNewPath) return;
    renameSync(fullOldPath, fullNewPath);
    addAction(this, { action: `move`, isFile, oldPath, newPath });
  }

  async onupdate({ path, type, update }) {
    // console.log(`on update in ${this.basePath}:`, { path, update });
    const fullPath = this.getFullPath(path);
    if (!fullPath) return;
    // pass this update on to the update handler function
    this.updateHandler(fullPath, type, update);
    addAction(this, { action: `update`, type, path, update });
  }

  async ondelete({ path }) {
    // console.log(`on delete in ${this.basePath}:`, { path });
    const fullPath = this.getFullPath(path);
    if (!fullPath) return;
    rmSync(fullPath);
    addAction(this, { action: `delete`, path });
  }

  // This is not a transform, and so does not require
  // recording or broadcasting to other subscribers.
  async onread({ path }) {
    // console.log(`on read`, { path });
    const fullPath = this.getFullPath(path);
    if (!fullPath) return;
    const data = readFileSync(fullPath).toString();
    this.send(`read`, { path, data });
  }
}
