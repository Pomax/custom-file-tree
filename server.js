import http from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";
import express from "express";
import { readdirSync, watch } from "node:fs";
import { resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";

class OTHandler {
  constructor(socket) {
    this.id = new randomUUID();
    this.socket = socket;
  }
  onload() {
    const payload = {
      type: `file-tree:load`,
      detail: {
        paths: dirList,
        id: this.id,
        when: Date.now(),
      },
    };
    this.socket.send(JSON.stringify(payload));
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
}

const dirList = [
  `dist/README.md`,
  `dist/file-tree.esm.js`,
  `dist/file-tree.esm.min.js`,
  `dist/old/README.old`,
  `dist/old/file-tree.esm.js`,
  `dist/old/file-tree.esm.min.js`,
  `public/index.html`,
  `public/index.js`,
  `src/dir-entry.js`,
  `src/file-entry.js`,
  `src/file-tree.css`,
  `src/file-tree.js`,
  `src/utils.js`,
  `test/cake.because.why.not`,
  `test/cake.spec.js`,
  `package.json`,
  `README.md`,
];

const PORT = process.env.PORT ?? 8000;
process.env.PORT = PORT;

const HOSTNAME = process.env.HOSTNAME ?? `localhost`;
process.env.HOSTNAME = HOSTNAME;

const testing = process.argv.includes(`--test`);
const npm = process.platform === `win32` ? `npm.cmd` : `npm`;

// Set up the core server
const app = express();
app.use((req, res, next) => {
  res.setHeader("Surrogate-Control", "no-store");
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.setHeader("Expires", "0");
  next();
});

app.set("etag", false);
app.use((req, res, next) => {
  if (!process.argv.includes(`--test`)) {
    console.log(`[${new Date().toISOString()}] ${req.url}`);
  }
  next();
});

app.get(`/get-dir-listing`, (req, res) => {
  res.setHeader(`Content-Type`, `application/json`);
  res.send(JSON.stringify(dirList));
});

// static routes
app.get(`/`, (req, res) => res.redirect(`/public`));
app.use(`/`, express.static(`.`));
app.use((req, res) => res.status(404).send(`${req.url} not found`));

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
    if (!fn) return console.warn(`Missing implementation for ${handlerName}.`);

    // It is: handle it.
    fn(data.detail);
  });
});

// Run the server, and trigger a client bundle rebuild every time script.js changes.
server.listen(PORT, () => {
  // are we running tests?
  if (testing) {
    console.log(`<< RUNNING SERVER IN TEST MODE >>`);

    const runner = spawn(npm, [`run`, `test:integration`], {
      stdio: `inherit`,
      shell: true,
    });
    runner.on(`close`, () => process.exit());
    runner.on(`error`, () => process.exit(1));
  }

  // we're not, run in watch mode
  else {
    // Generate the server address notice
    const msg = `=   Server running on http://${HOSTNAME}:${PORT}   =`;
    const line = `=`.repeat(msg.length);
    const mid = `=${` `.repeat(msg.length - 2)}=`;
    console.log([``, line, mid, msg, mid, line, ``].join(`\n`));

    try {
      watchForRebuild();
    } catch (e) {
      console.error(e);
    }
  }
});

/**
 * There's a few files we want to watch in order to rebuild the browser bundle.
 */
function watchForRebuild() {
  let rebuilding = false;

  async function rebuild() {
    if (rebuilding) return;
    rebuilding = true;
    console.log(`rebuilding`);
    const start = Date.now();
    spawnSync(npm, [`run`, `build`], { stdio: `inherit` });
    console.log(`Build took ${Date.now() - start}ms`), 8;
    setTimeout(() => (rebuilding = false), 500);
  }

  function watchList(list) {
    list.forEach((filename) => watch(resolve(filename), () => rebuild()));
  }

  watchList(readdirSync(`./src`).map((v) => `./src/${v}`));
}
