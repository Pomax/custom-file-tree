import { expect, test } from "@playwright/test";
import { bootstrapPage } from "./utils.js";

test.describe(`move events`, () => {
  let page;
  let fileTree;
  let utils;

  test.beforeEach(async ({ browser }) => {
    utils = await bootstrapPage(browser);
    page = utils.page;
    fileTree = utils.fileTree;
  });

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

  /**
   * All file:move event code paths
   */
  test.describe(`file:move`, () => {
    const listenForFileMoveEvent = () => utils.listenForEvent(`file:move`);

    test(`move a root file into a subdirectory`, async () => {
      const eventPromise = listenForFileMoveEvent();

      const sourcePath = `package.json`;
      const targetPath = `dist/`;
      const finalPath = targetPath + sourcePath;

      await utils.entryExists(sourcePath);
      await utils.entryDoesNotExist(finalPath);

      await dragAndDrop(sourcePath, targetPath);
      const { detail } = await eventPromise;
      const { oldPath, newPath } = detail;
      expect(oldPath).toBe(sourcePath);
      expect(newPath).toBe(finalPath);

      await utils.entryDoesNotExist(sourcePath);
      await utils.entryExists(finalPath);
    });

    test(`move a subdirectory file to the root`, async () => {
      const eventPromise = listenForFileMoveEvent();

      const sourcePath = `dist/file-tree.esm.min.js`;
      const targetPath = `.`;
      const finalPath = sourcePath.substring(sourcePath.lastIndexOf(`/`) + 1);

      await utils.entryExists(sourcePath);
      await utils.entryDoesNotExist(finalPath);

      await dragAndDrop(sourcePath, targetPath);
      const { detail } = await eventPromise;
      const { oldPath, newPath } = detail;
      expect(oldPath).toBe(sourcePath);
      expect(newPath).toBe(finalPath);

      await utils.entryDoesNotExist(sourcePath);
      await utils.entryExists(finalPath);
    });

    test(`move a subdirectory file deeper`, async () => {
      const eventPromise = listenForFileMoveEvent();

      const sourcePath = `dist/README.md`;
      const targetPath = `dist/old/`;
      const finalPath =
        targetPath + sourcePath.substring(sourcePath.lastIndexOf(`/`) + 1);

      await utils.entryExists(sourcePath);
      await utils.entryDoesNotExist(finalPath);

      await dragAndDrop(sourcePath, targetPath);
      const { detail } = await eventPromise;
      const { oldPath, newPath } = detail;
      expect(oldPath).toBe(sourcePath);
      expect(newPath).toBe(finalPath);

      await utils.entryDoesNotExist(sourcePath);
      await utils.entryExists(finalPath);
    });

    test(`move a deep subdirectory file up`, async () => {
      const eventPromise = listenForFileMoveEvent();

      const sourcePath = `dist/old/README.old`;
      const targetPath = `dist/`;
      const finalPath =
        targetPath + sourcePath.substring(sourcePath.lastIndexOf(`/`) + 1);

      await utils.entryExists(sourcePath);
      await utils.entryDoesNotExist(finalPath);

      await dragAndDrop(sourcePath, targetPath);
      const { detail } = await eventPromise;
      const { oldPath, newPath } = detail;
      expect(oldPath).toBe(sourcePath);
      expect(newPath).toBe(finalPath);

      await utils.entryDoesNotExist(sourcePath);
      await utils.entryExists(finalPath);
    });
  });

  /**
   * All dir:move event code paths
   */
  test.describe(`dir:move`, () => {
    const listenForDirMoveEvent = () => utils.listenForEvent(`dir:move`);

    test(`move a directory into another directory`, async () => {
      const eventPromise = listenForDirMoveEvent();

      const sourcePath = `dist/`;
      const targetPath = `test/`;
      const finalPath = targetPath + sourcePath;

      await utils.entryExists(sourcePath);
      await utils.entryDoesNotExist(finalPath);

      await dragAndDrop(sourcePath, targetPath);
      const { detail } = await eventPromise;
      const { oldPath, newPath } = detail;
      expect(oldPath).toBe(sourcePath);
      expect(newPath).toBe(finalPath);

      await utils.entryDoesNotExist(sourcePath);
      await utils.entryExists(finalPath);

      // confirm all files moved properly, too.
      for await (const old of [
        `dist/README.md`,
        `dist/file-tree.esm.js`,
        `dist/file-tree.esm.min.js`,
        `dist/old/README.old`,
        `dist/old/file-tree.esm.js`,
        `dist/old/file-tree.esm.min.js`,
      ]) {
        await utils.entryDoesNotExist(old);
        await utils.entryExists(`test/${old}`);
      }
    });

    test(`move a nested directory out of its parent`, async () => {
      const eventPromise = listenForDirMoveEvent();

      const sourcePath = `dist/old/`;
      const targetPath = `test/`;
      const finalPath = `test/old/`;

      await utils.entryExists(sourcePath);
      await utils.entryDoesNotExist(finalPath);

      await dragAndDrop(sourcePath, targetPath);
      const { detail } = await eventPromise;
      const { oldPath, newPath } = detail;
      expect(oldPath).toBe(sourcePath);
      expect(newPath).toBe(finalPath);

      await utils.entryDoesNotExist(sourcePath);
      await utils.entryExists(finalPath);

      // confirm all files moved properly, too.
      for await (const old of [
        `dist/old/README.old`,
        `dist/old/file-tree.esm.js`,
        `dist/old/file-tree.esm.min.js`,
      ]) {
        await utils.entryDoesNotExist(old);
        await utils.entryExists(old.replace(`dist/`, `test/`));
      }
    });

    test(`move a directory into the root`, async () => {
      const eventPromise = listenForDirMoveEvent();

      const sourcePath = `dist/old/`;
      const targetPath = `.`;
      const finalPath = `old/`;

      await utils.entryExists(sourcePath);
      await utils.entryDoesNotExist(finalPath);

      await dragAndDrop(sourcePath, targetPath);
      const { detail } = await eventPromise;
      const { oldPath, newPath } = detail;
      expect(oldPath).toBe(sourcePath);
      expect(newPath).toBe(finalPath);

      await utils.entryDoesNotExist(sourcePath);
      await utils.entryExists(finalPath);

      // confirm all files moved properly, too.
      for await (const old of [
        `dist/old/README.old`,
        `dist/old/file-tree.esm.js`,
        `dist/old/file-tree.esm.min.js`,
      ]) {
        await utils.entryDoesNotExist(old);
        await utils.entryExists(old.replace(`dist/`, ``));
      }
    });
  });
});
