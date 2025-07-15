import { expect, test } from "@playwright/test";
import { bootstrapPage } from "./utils.js";

test.describe(`state preservation`, async () => {
  let page;
  let fileTree;
  let utils;

  const randomString = Math.random().toFixed(18).substring(2);

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

  test(`full CRUD round trip check for files`, async () => {
    const listenForFileCreateEvent = utils.listenForEvent(`file:create`);
    const listenForFileRenameEvent = utils.listenForEvent(`file:rename`);
    const listenForFileMoveEvent = utils.listenForEvent(`file:move`);
    const listenForFileDeleteEvent = utils.listenForEvent(`file:delete`);

    async function createFile(dialog) {
      await dialog.accept(`newfile.txt`);

      const qs = `file-entry[path="newfile.txt"]`;
      const fileEntry = await page.locator(qs).first();
      await expect(fileEntry).toHaveAttribute(`name`, `newfile.txt`);

      const { detail } = await listenForFileCreateEvent;
      const { path } = detail;
      expect(path).toBe(`newfile.txt`);
      await utils.entryExists(`newfile.txt`);

      // set state one newly created file entry
      await page.evaluate((randomString) => {
        globalThis.__lastGrantData.setState({ randomString });
      }, randomString);

      // rename the file
      page.once(`dialog`, renameFile);
      await page.locator(`[path="newfile.txt"]`).click();
      await page
        .locator(`[path="newfile.txt"] > .buttons .rename-file`)
        .click();
    }

    async function renameFile(dialog) {
      await dialog.accept(`newfile.md`);
      const qs = `file-entry[path="newfile.md"]`;
      const fileEntry = await page.locator(qs).first();
      await listenForFileRenameEvent;
      await expect(fileEntry).toHaveAttribute(`name`, `newfile.md`);

      // confirm the state is still correct
      expect(
        await page.evaluate(() => globalThis.__lastGrantData.state.randomString)
      ).toBe(randomString);

      // time to move this file!
      const sourcePath = `newfile.md`;
      const targetPath = `dist/`;
      const finalPath = targetPath + sourcePath;
      await utils.entryExists(sourcePath);
      await utils.entryDoesNotExist(finalPath);
      await dragAndDrop(sourcePath, targetPath);
      const { detail } = await listenForFileMoveEvent;
      const { oldPath, newPath } = detail;
      expect(oldPath).toBe(sourcePath);
      expect(newPath).toBe(finalPath);

      // reconfirm the state is correct
      expect(
        await page.evaluate(() => globalThis.__lastGrantData.state.randomString)
      ).toBe(randomString);

      // // Cool. Time to delete it again.
      page.once(`dialog`, deleteFile);

      await page.locator(`[path="dist/newfile.md"]`).click();
      await page
        .locator(`[path="dist/newfile.md"] > .buttons .delete-file`)
        .click();
    }

    async function deleteFile(dialog) {
      await dialog.accept();

      const { detail } = await listenForFileDeleteEvent;
      const { path } = detail;
      expect(path).toBe(`dist/newfile.md`);
      await utils.entryDoesNotExist(`dist/newfile.md`);

      // Even though we deleted it, the entry state
      // should exist until GC cleans up the element:
      expect(
        await page.evaluate(
          () => globalThis.__lastGrantData[0].state.randomString
        )
      ).toBe(randomString);

      // And that's the end of this test.
      page.close();
    }

    page.once(`dialog`, createFile);
    await utils.entryDoesNotExist(`newfile.txt`);
    await page.locator(`[path="."] > .buttons .create-file`).click();
  });

  test(`full CRUD round trip check for directories`, async () => {
    const listenForDirCreateEvent = utils.listenForEvent(`dir:create`);
    const listenForDirRenameEvent = utils.listenForEvent(`dir:rename`);
    const listenForDirMoveEvent = utils.listenForEvent(`dir:move`);
    const listenForDirDeleteEvent = utils.listenForEvent(`dir:delete`);

    async function createDir(dialog) {
      console.log(`createDir`);
      await dialog.accept(`testdir`);

      const qs = `dir-entry[path="testdir/"]`;
      const dirEntry = await page.locator(qs).first();
      await expect(dirEntry).toHaveAttribute(`name`, `testdir`);

      const { detail } = await listenForDirCreateEvent;
      const { path } = detail;
      expect(path).toBe(`testdir/`);
      await utils.entryExists(`testdir/`);

      // set state one newly created file entry
      await page.evaluate((randomString) => {
        globalThis.__lastGrantData.setState({ randomString });
      }, randomString);

      // rename the dir
      page.once(`dialog`, renameDir);
      await page.locator(`[path="testdir/"]`).click();
      await page.locator(`[path="testdir/"] > .buttons .rename-dir`).click();
    }

    async function renameDir(dialog) {
      console.log(`renameDir`);
      await dialog.accept(`newtestdir`);
      const qs = `dir-entry[path="newtestdir/"]`;
      const dirEntry = await page.locator(qs).first();
      await listenForDirRenameEvent;
      await expect(dirEntry).toHaveAttribute(`name`, `newtestdir`);

      // confirm the state is still correct
      expect(
        await page.evaluate(() => globalThis.__lastGrantData.state.randomString)
      ).toBe(randomString);

      // time to move this dir!
      const sourcePath = `newtestdir/`;
      const targetPath = `dist/`;
      const finalPath = targetPath + sourcePath;
      await utils.entryExists(sourcePath);
      await utils.entryDoesNotExist(finalPath);

      await dragAndDrop(sourcePath, targetPath);

      const { detail } = await listenForDirMoveEvent;
      const { oldPath, newPath } = detail;
      expect(oldPath).toBe(sourcePath);
      expect(newPath).toBe(finalPath);

      // reconfirm the state is correct
      expect(
        await page.evaluate(() => globalThis.__lastGrantData.state.randomString)
      ).toBe(randomString);

      // Cool. Time to delete it again.
      page.once(`dialog`, deleteDir);
      await page.locator(`[path="${finalPath}"]`).click();
      await page
        .locator(`[path="${finalPath}"] > .buttons .delete-dir`)
        .click();
    }

    async function deleteDir(dialog) {
      console.log(`deleteDir`);
      await dialog.accept();

      const { detail } = await listenForDirDeleteEvent;
      const { path } = detail;
      expect(path).toBe(`dist/newtestdir/`);
      await utils.entryDoesNotExist(`dist/newtestdir/`);

      // Even though we deleted it, the entry state
      // should exist until GC cleans up the element:
      expect(
        await page.evaluate(
          () => globalThis.__lastGrantData[0].state.randomString
        )
      ).toBe(randomString);

      // End of this test
      page.close();
    }

    page.once(`dialog`, createDir);
    await utils.entryDoesNotExist(`testdir/`);
    await page.locator(`[path="."] > .buttons .create-dir`).click();
  });
});
