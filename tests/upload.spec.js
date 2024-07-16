import { expect, test } from "@playwright/test";
import { setupHelpers } from "./utils.js";

test.describe(`upload events`, () => {
  let page;
  let fileTree;
  let utils;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    page.on("console", (msg) => console.log(msg.text()));
    await page.goto(`http://localhost:8000`);
    utils = setupHelpers(page);
    fileTree = page.locator(`file-tree`).first();
  });

  /**
   * All file upload code paths, with associated file:create events
   */
  test.describe(`file:upload`, () => {
    const listenForFileCreateEvent = () => utils.listenForEvent(`file:create`);

    test(`dropping a file on the root "uploads" it there`, async () => {
      const eventPromise = listenForFileCreateEvent();
      const targetPath = `.`;
      await utils.entryDoesNotExist(`test.file`);
      await utils.dragAndDropFiles(targetPath, [`test.file`]);
      const { detail } = await eventPromise;
      const { path, content } = detail;
      expect(path).toBe(`test.file`);
      const contentBytes = [...`test data`].map((v) => v.charCodeAt(0));
      expect(content).toEqual(contentBytes);
      await utils.entryExists(`test.file`);
    });

    test(`dropping multiple files "uploads" all of them`, async () => {
      const targetPath = `.`;
      const files = [
        `test.1.file`,
        `test.2.file`,
        `test.3.file`,
        `test.4.file`,
        `test.5.file`,
      ];
      for (const fileName of files) await utils.entryDoesNotExist(fileName);
      await utils.dragAndDropFiles(targetPath, files);
      for (const fileName of files) await utils.entryExists(fileName);
    });

    test(`dropping a file on a directory "uploads" it there`, async () => {
      const eventPromise = listenForFileCreateEvent();
      const targetPath = `dist/`;
      await utils.entryDoesNotExist(`test.file`);
      await utils.dragAndDropFiles(targetPath, [`test.file`]);
      const { detail } = await eventPromise;
      const { path, content } = detail;
      expect(path).toBe(`dist/test.file`);
      const contentBytes = [...`test data`].map((v) => v.charCodeAt(0));
      expect(content).toEqual(contentBytes);
      await utils.entryExists(`dist/test.file`);
    });
  });

  /**
   * All directory upload code paths, with associated dir:create events
   */
  test.describe(`dir:upload`, () => {
    const listenForFileCreateEvent = () => utils.listenForEvent(`file:create`);

    test(`dropping a dir on the root "uploads" it there`, async () => {
      const fileEventPromise = listenForFileCreateEvent();
      const targetPath = `.`;
      await utils.entryDoesNotExist(`temp/`);
      await utils.entryDoesNotExist(`temp/test.file`);
      await utils.dragAndDropFiles(targetPath, {}); // TODO: move dummy data here
      const { detail } = await fileEventPromise;
      const { path, content } = detail;
      expect(path).toBe(`temp/test.file`);
      const contentBytes = [...`test data`].map((v) => v.charCodeAt(0));
      expect(content).toEqual(contentBytes);
      await utils.entryExists(`temp/test.file`);
    });
  });
});
