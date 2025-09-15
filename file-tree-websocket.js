import http from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";

let dirList;

const handlers = [];
const changelog = {};

/**
 * ...docs go here...
 */
function sendAll(type, by, detail) {
  detail.by = by;
  handlers.forEach((handler) => {
    handler.send(type, detail);
  });
}

/**
 * ...docs go here...
 */
class OTHandler {
  constructor(socket) {
    this.id = randomUUID();
    this.socket = socket;
    this.lastSync = Date.now();
  }

  onload() {
    this.send(`load`, { paths: dirList });
  }

  send(type, detail = {}) {
    if (!detail.when) detail.when = Date.now();
    detail.id = this.id;
    // TODO: rather than merely send this payload, what we really need
    //       to do is send any outstanding changes, which may require
    //       change collapsing. We're not doing that right now.
    this.socket.send(JSON.stringify({ type: `file-tree:${type}`, detail }));
    this.lastSync = detail.when;
  }

  oncreate({ id, path, isFile }) {
    const when = Date.now();
    console.log(`on create`, { path, isFile });
    // TODO: actually do something
    changelog[path] ??= [];
    changelog[path].push({ op: `create`, when });
    sendAll(`create`, id, { path, isFile, when });
  }

  onmove({ id, oldPath, newPath }) {
    const when = Date.now();
    console.log(`on move`, { oldPath, newPath });
    // TODO: actually do something
    changelog[oldPath] ??= [];
    changelog[oldPath].push({ op: `move`, to: newPath, when });
    changelog[newPath] ??= [];
    changelog[newPath].push({ op: `move`, from: oldPath, when });
    sendAll(`move`, id, { oldPath, newPath, when });
  }

  onupdate({ id, path, update }) {
    const when = Date.now();
    console.log(`on update`, { path, update });
    // TODO: actually do something
    changelog[path] ??= [];
    changelog[path].push({ op: `update`, update, when });
    sendAll(`update`, id, { path, newPath, when });
  }

  ondelete({ id, path }) {
    const when = Date.now();
    console.log(`on delete`, { path });
    // TODO: actually do something
    changelog[path] ??= [];
    changelog[path].push({ op: `delete`, when });
    sendAll(`delete`, id, { path, when });
  }

  // This is not a broadcast reply:
  onread({ id, path }) {
    console.log(`on read`, { path });
    const data = readFileSync(path).toString();
    this.send(`read`, { path, data });
  }
}

/**
 * ...docs go here...
 */
export function setupFileTreeWebSocket(app, list) {
  dirList = list;

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
    const handler = new OTHandler(socket);
    handlers.push(handler);

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
