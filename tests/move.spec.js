import { expect, test } from "@playwright/test";
import { Strings } from "../src/utils/strings.js";

test.describe(`file events`, () => {
  let page;
  let fileTree;
  let eventPromise;

  async function listenForEvent(eventType) {
    eventPromise = page.evaluate(
      (eventType) =>
        new Promise((resolve) => {
          document
            .querySelector(`file-tree`)
            .addEventListener(eventType, ({ type, detail }) =>
              resolve({ type, detail })
            );
        }),
      eventType
    );
  }

  async function hasEntry(path) {
    return page.evaluate((path) => {
      const { entries } = document.querySelector(`file-tree`);
      const entry = entries[path];
      return !!(entry?.path === path);
    }, path);
  }

  async function entryExists(path) {
    return expect(await hasEntry(path)).toBe(true);
  }

  async function entryDoesNotExist(path) {
    return expect(await hasEntry(path)).toBe(false);
  }

  async function dragAndDrop(source, target) {
    const sourceSelector = `[path="${source}"]`;
    const sourceElement = page.locator(sourceSelector);
    expect(sourceElement).toHaveAttribute(`path`, source);

    const targetSelector = `[path="${target}"]`;
    const targetElement = page.locator(targetSelector);
    expect(targetElement).toHaveAttribute(`path`, target);

    const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
    await page.dispatchEvent(sourceSelector, `dragstart`, { dataTransfer });
    await page.dispatchEvent(targetSelector, `drop`, { dataTransfer });
  }

  test.beforeEach(async ({ browser }) => {
    eventPromise = undefined;
    page = await browser.newPage();
    page.on("console", (msg) => console.log(msg.text()));
    await page.goto(`http://localhost:8000`);
    fileTree = page.locator(`file-tree`).first();
  });

  /**
   * All file:move event code paths
   */
  test.describe(`file:move`, () => {
    const listenForFileMoveEvent = () => listenForEvent(`file:move`);

    test(`move a root file into a subdirectory`, async () => {
      listenForFileMoveEvent();

      const sourcePath = `package.json`;
      const targetPath = `dist/`;
      const finalPath = targetPath + sourcePath;

      await entryExists(sourcePath);
      await entryDoesNotExist(finalPath);

      await dragAndDrop(sourcePath, targetPath);
      const { detail } = await eventPromise;
      const { oldPath, newPath } = detail;
      expect(oldPath).toBe(sourcePath);
      expect(newPath).toBe(finalPath);

      await entryDoesNotExist(sourcePath);
      await entryExists(finalPath);
    });

    test(`move a subdirectory file to the root`, async () => {
      listenForFileMoveEvent();

      const sourcePath = `dist/file-tree.esm.min.js`;
      const targetPath = `.`;
      const finalPath = sourcePath.substring(sourcePath.lastIndexOf(`/`) + 1);

      await entryExists(sourcePath);
      await entryDoesNotExist(finalPath);

      await dragAndDrop(sourcePath, targetPath);
      const { detail } = await eventPromise;
      const { oldPath, newPath } = detail;
      expect(oldPath).toBe(sourcePath);
      expect(newPath).toBe(finalPath);

      await entryDoesNotExist(sourcePath);
      await entryExists(finalPath);
    });

    test(`move a subdirectory file deeper`, async () => {
      listenForFileMoveEvent();

      const sourcePath = `dist/README.md`;
      const targetPath = `dist/old/`;
      const finalPath =
        targetPath + sourcePath.substring(sourcePath.lastIndexOf(`/`) + 1);

      await entryExists(sourcePath);
      await entryDoesNotExist(finalPath);

      await dragAndDrop(sourcePath, targetPath);
      const { detail } = await eventPromise;
      const { oldPath, newPath } = detail;
      expect(oldPath).toBe(sourcePath);
      expect(newPath).toBe(finalPath);

      await entryDoesNotExist(sourcePath);
      await entryExists(finalPath);
    });

    test(`move a deep subdirectory file up`, async () => {
      listenForFileMoveEvent();

      const sourcePath = `dist/old/README.old`;
      const targetPath = `dist/`;
      const finalPath =
        targetPath + sourcePath.substring(sourcePath.lastIndexOf(`/`) + 1);

      await entryExists(sourcePath);
      await entryDoesNotExist(finalPath);

      await dragAndDrop(sourcePath, targetPath);
      const { detail } = await eventPromise;
      const { oldPath, newPath } = detail;
      expect(oldPath).toBe(sourcePath);
      expect(newPath).toBe(finalPath);

      await entryDoesNotExist(sourcePath);
      await entryExists(finalPath);
    });
  });

  /**
   * All dir:move event code paths
   */
  test.describe(`dir:move`, () => {
    const listenForDirMoveEvent = () => listenForEvent(`dir:move`);

    test(`move a directory into another directory`, async () => {
      listenForDirMoveEvent();

      const sourcePath = `dist/`;
      const targetPath = `test/`;
      const finalPath = targetPath + sourcePath;

      await entryExists(sourcePath);
      await entryDoesNotExist(finalPath);

      await dragAndDrop(sourcePath, targetPath);
      const { detail } = await eventPromise;
      const { oldPath, newPath } = detail;
      expect(oldPath).toBe(sourcePath);
      expect(newPath).toBe(finalPath);

      await entryDoesNotExist(sourcePath);
      await entryExists(finalPath);

      // confirm all files moved properly, too.
      for await (const old of [
        `dist/README.md`,
        `dist/file-tree.esm.js`,
        `dist/file-tree.esm.min.js`,
        `dist/old/README.old`,
        `dist/old/file-tree.esm.js`,
        `dist/old/file-tree.esm.min.js`,
      ]) {
        await entryDoesNotExist(old);
        await entryExists(`test/${old}`);
      }
    });

    test(`move a nested directory out of its parent`, async () => {
      listenForDirMoveEvent();

      const sourcePath = `dist/old/`;
      const targetPath = `test/`;
      const finalPath = `test/old/`;

      await entryExists(sourcePath);
      await entryDoesNotExist(finalPath);

      await dragAndDrop(sourcePath, targetPath);
      const { detail } = await eventPromise;
      const { oldPath, newPath } = detail;
      expect(oldPath).toBe(sourcePath);
      expect(newPath).toBe(finalPath);

      await entryDoesNotExist(sourcePath);
      await entryExists(finalPath);

      // confirm all files moved properly, too.
      for await (const old of [
        `dist/old/README.old`,
        `dist/old/file-tree.esm.js`,
        `dist/old/file-tree.esm.min.js`,
      ]) {
        await entryDoesNotExist(old);
        await entryExists(old.replace(`dist/`, `test/`));
      }
    });

    test(`move a directory into the root`, async () => {
      listenForDirMoveEvent();

      const sourcePath = `dist/old/`;
      const targetPath = `.`;
      const finalPath = `old/`;

      await entryExists(sourcePath);
      await entryDoesNotExist(finalPath);

      await dragAndDrop(sourcePath, targetPath);
      const { detail } = await eventPromise;
      const { oldPath, newPath } = detail;
      expect(oldPath).toBe(sourcePath);
      expect(newPath).toBe(finalPath);

      await entryDoesNotExist(sourcePath);
      await entryExists(finalPath);

      // confirm all files moved properly, too.
      for await (const old of [
        `dist/old/README.old`,
        `dist/old/file-tree.esm.js`,
        `dist/old/file-tree.esm.min.js`,
      ]) {
        await entryDoesNotExist(old);
        await entryExists(old.replace(`dist/`, ``));
      }
    });
  });
});
