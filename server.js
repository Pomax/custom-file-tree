import express from "express";
import { watch } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";


const PORT = process.env.PORT ?? 8000;
process.env.PORT = PORT;

const HOSTNAME = process.env.HOSTNAME ?? `localhost`;
process.env.HOSTNAME = HOSTNAME;

const npm = process.platform === `win32` ? `npm.cmd` : `npm`;

// Set up the core server
const app = express();
app.set("etag", false);
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.url}`);
  next();
});

// static routes
app.get(`/`, (req, res) => res.redirect(`/public`));
app.use(`/`, express.static(`.`));
app.use((req, res) => {
  if (req.query.preview) {
    res.status(404).send(`Preview not found`);
  } else {
    res.status(404).send(`${req.url} not found`);
  }
});

// Run the server, and trigger a client bundle rebuild every time script.js changes.
app.listen(PORT, () => {
  console.log(`Server running on http://${HOSTNAME}:${PORT}\n`);
  try { watchForRebuild(); } catch (e) { console.error(e); }
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

  watchList([
    `./src/dir-entry.js`,
    `./src/file-entry.js`,
    `./src/file-tree.css`,
    `./src/file-tree.js`,
    `./src/utils.js`,
  ]);

  rebuild();
}
