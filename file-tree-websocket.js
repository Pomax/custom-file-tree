import http from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";

let dirList;

class OTHandler {
  constructor(socket) {
    this.id = new randomUUID();
    this.socket = socket;
  }
  onload() {
    this.send(`load`, { paths: dirList });
  }
  send(type, detail = {}) {
    if (!detail.when) detail.when = Date.now();
    detail.id = this.id;
    this.socket.send(JSON.stringify({ type: `file-tree:${type}`, detail }));
  }
  oncreate({ id, path, isFile }) {
    console.log(`on create`, { path, isFile });
    // make that "happen" and then notify all listeners
  }
  onmove({ id, oldPath, newPath }) {
    console.log(`on move`, { oldPath, newPath });
    // make that "happen" and then notify all listeners
  }
  onupdate({ id, path, update }) {
    console.log(`on update`, { path, update });
    // make that "happen" and then notify all listeners
  }
  ondelete({ id, path, removeParent }) {
    console.log(`on delete`, { path, removeParent });
    // make that "happen" and then notify all listeners
  }
  // This is not a broadcast reply:
  onread({ id, path }) {
    console.log(`on read`, { path });
    const data = readFileSync(path).toString();
    this.send(`read`, { path, data });
  }
}

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
