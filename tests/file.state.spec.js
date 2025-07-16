import { expect, test } from "@playwright/test";
import { bootstrapPage } from "./utils.js";

const randomString = Math.random().toFixed(18).substring(2);

async function dragAndDrop(page, source, target) {
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

test.describe(`full CRUD round trip check for files`, () => {
  let page;
  let fileTree;
  let utils;

  test.beforeEach(async ({ browser }) => {
    utils = await bootstrapPage(browser);
    page = utils.page;
    fileTree = utils.fileTree;
  });

  const listenForFileCreateEvent = () => utils.listenForEvent(`file:create`);
  const listenForFileRenameEvent = () => utils.listenForEvent(`file:rename`);
  const listenForFileMoveEvent = () => utils.listenForEvent(`file:move`);
  const listenForFileDeleteEvent = () => utils.listenForEvent(`file:delete`);

  test(`file operations`, async () => {
    let eventPromise = listenForFileCreateEvent();

    async function createFile(dialog) {
      await dialog.accept(`newfile.txt`);
      const qs = `file-entry[path="newfile.txt"]`;
      const fileEntry = await page.locator(qs).first();
      await expect(fileEntry).toHaveAttribute(`name`, `newfile.txt`);

      const { detail } = await eventPromise;
      const { path } = detail;
      expect(path).toBe(`newfile.txt`);

      // set state one newly created file entry
      await page.evaluate((randomString) => {
        globalThis.__lastGrantData.setState({ randomString });
        return randomString;
      }, randomString);

      // rename the file
      eventPromise = listenForFileRenameEvent();
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
      await eventPromise;
      await expect(fileEntry).toHaveAttribute(`name`, `newfile.md`);

      // confirm the state is still correct
      expect(
        await page.evaluate(() => globalThis.__lastGrantData.state.randomString)
      ).toBe(randomString);

      // time to move this file!
      eventPromise = listenForFileMoveEvent();

      const sourcePath = `newfile.md`;
      const targetPath = `dist/`;
      const finalPath = targetPath + sourcePath;
      await utils.entryExists(sourcePath);
      await utils.entryDoesNotExist(finalPath);
      await dragAndDrop(page, sourcePath, targetPath);
      const { detail } = await eventPromise;
      const { oldPath, newPath } = detail;
      expect(oldPath).toBe(sourcePath);
      expect(newPath).toBe(finalPath);

      // reconfirm the state is correct
      expect(
        await page.evaluate(() => globalThis.__lastGrantData.state.randomString)
      ).toBe(randomString);

      // // Cool. Time to delete it again.
      eventPromise = listenForFileDeleteEvent();
      page.once(`dialog`, deleteFile);

      await page.locator(`[path="dist/newfile.md"]`).click();
      await page
        .locator(`[path="dist/newfile.md"] > .buttons .delete-file`)
        .click();
    }

    async function deleteFile(dialog) {
      await dialog.accept();

      const { detail } = await eventPromise;
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
    }

    page.once(`dialog`, createFile);
    await utils.entryDoesNotExist(`newfile.txt`);
    await page.locator(`[path="."] > .buttons .create-file`).click();
  });
});
