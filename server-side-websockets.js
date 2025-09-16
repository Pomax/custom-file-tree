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

const changelog = {};
const actionIndex = {};
const handlers = {
  sequenceIndex: [],
};

/**
 * ...docs go here...
 */
function addHandler(otHandler) {
  const { basePath } = otHandler;
  handlers[basePath] ??= new Set();
  const set = handlers[basePath];
  set.add(otHandler);
}

/**
 * ...docs go here...
 */
function removeHandler(otHandler) {
  const { basePath } = otHandler;
  handlers[basePath].delete(otHandler);
}

/**
 * ...docs go here...
 */
function addAction({ basePath, id }, action) {
  changelog[basePath] ??= [];
  const list = changelog[basePath];
  const index = handlers.sequenceIndex;
  const when = Date.now();
  actionIndex[when] = index;
  action.from = id;
  action.when = when;
  index.push(action.when);
  list.push(action);
  sendAll(basePath, action);
}

/**
 * ...docs go here...
 */
async function sendAll(basePath, action) {
  handlers[basePath].forEach((handler) => {
    if (handler.unreliable) return;
    /*
      // catch this handler up
      const last = handler.lastSynced;
      const lastIndex = actionIndex[last];
      const actions = changelog[basePath].slice(lastIndex + 1);
      actions.forEach(({ type, ...detail }) => handler.send(type, detail));
    */
    const { action: type, ...detail } = action;
    handler.send(type, detail);
  });
}

/**
 * ...docs go here...
 */
const DEFAULT_HANDLER = function updateHandler(fullPath, type, update) {
  if (type === `jsdiff`) {
    const oldContent = readFileSync(fullPath).toString();
    const newContent = applyPatch(oldContent, update);
    writeFileSync(fullPath, newContent.toString());
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
    // Our websocket based request handler.
    const handler = new OTHandler(socket, contentDir, updateHandler);
    socket.on("error", console.error);

    socket.on("message", (message) => {
      // This will not throw, because a server shouldn't crash out.
      let data = message.toString();
      try {
        data = JSON.parse(data);
      } catch (e) {
        console.warn(
          `Received incompatible data via websocket: message is not JSON.`,
          data
        );
      }
      if (!data) return;

      // Is this something we know how to handle?
      let { type } = data;
      if (!type.startsWith(`file-tree:`)) return;
      type = type.replace(`file-tree:`, ``);
      const handlerName = `on${type}`;
      const fn = handler[handlerName].bind(handler);
      if (!fn)
        return console.warn(`Missing implementation for ${handlerName}.`);

      // It is: handle it.
      fn(data.detail);
    });
  });

  return server;
}

/**
 * ...docs go here...
 */
class OTHandler {
  constructor(socket, contentDir, updateHandler) {
    this.id = randomUUID();
    this.socket = socket;
    this.contentDir = contentDir;
    this.lastSynced = -1;
    this.updateHandler = updateHandler ?? (() => {});
  }

  unload() {
    removeHandler(this);
    this.unreliable = true;
    this.socket.close();
    this.lastSynced = -1;
    delete this.contentDir;
    delete this.basePath;
  }

  // TODO: rather than merely send a payload, what we really need
  //       to do is send any outstanding changes, which may require
  //       change collapsing. We're not doing that right now.

  send(type, detail) {
    try {
      this.socket.send(JSON.stringify({ type: `file-tree:${type}`, detail }));
      if (detail.when) this.lastSynced = detail.when;
    } catch (e) {
      // Well that's a problem...? Make sure we don't
      // try to use this handler anymore because the
      // odds of data integrity are basically zero now.
      this.unload();
    }
  }

  getFullPath(path) {
    if (path.includes(`..`)) return false;
    return join(this.contentDir, this.basePath, path);
  }

  // ==========================================================================

  onload({ basePath }) {
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
    this.send(`load`, { id: this.id, dirs, files });
  }

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
    this.updateHandler(fullPath, type, update);
    addAction(this, { action: `update`, type, path, update });
  }

  async ondelete({ path }) {
    // console.log(`on delete in ${this.basePath}:`, { path });
    const fullPath = this.getFullPath(path);
    if (!fullPath) return;
    rmSync(fullPath);
    addAction(this, { action: `delete`, path, when });
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
