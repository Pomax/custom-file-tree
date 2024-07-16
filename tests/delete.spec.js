import { expect, test } from "@playwright/test";
import { Strings } from "../src/utils/strings.js";

test.describe(`delete events`, () => {
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

  test.beforeEach(async ({ browser }) => {
    eventPromise = undefined;
    page = await browser.newPage();
    page.on("console", (msg) => console.log(msg.text()));
    await page.goto(`http://localhost:8000`);
    fileTree = page.locator(`file-tree`).first();
  });

  /**
   * All file:delete event code paths
   */
  test.describe(`file:delete`, () => {
    const listenForFileDeleteEvent = () => listenForEvent(`file:delete`);

    test(`deleting a file at the root location`, async () => {
      listenForFileDeleteEvent();

      page.on(`dialog`, async (dialog) => {
        await dialog.accept();

        const { detail } = await eventPromise;
        const { path } = detail;
        await expect(path).toBe(`README.md`);
        await entryDoesNotExist(`README.md`);
      });

      await entryExists(`README.md`);
      await page.locator(`[path="README.md"]`).click();
      const qs = `[path="README.md"] button[title="${Strings.DELETE_FILE}"]`;
      const btn = page.locator(qs).first();
      await btn.click();
    });

    test(`deleting a file in a subdirectory`, async () => {
      listenForFileDeleteEvent();

      page.on(`dialog`, async (dialog) => {
        await dialog.accept();

        const { detail } = await eventPromise;
        const { path } = detail;
        await expect(path).toBe(`dist/README.md`);
        await entryDoesNotExist(`dist/README.md`);
      });

      await entryExists(`dist/README.md`);
      await page.locator(`[path="dist/README.md"]`).click();
      const qs = `[path="dist/README.md"] button[title="${Strings.DELETE_FILE}"]`;
      const btn = page.locator(qs).first();
      await btn.click();
    });
  });

  /**
   * All dir:delete event code paths
   */
  test.describe(`dir:delete`, () => {
    const listenForDirDeleteEvent = () => listenForEvent(`dir:delete`);

    test(`deleting a dir at the root location`, async () => {
      listenForDirDeleteEvent();

      page.on(`dialog`, async (dialog) => {
        await dialog.accept();

        const { detail } = await eventPromise;
        const { path } = detail;
        await expect(path).toBe(`dist/`);
        await entryDoesNotExist(`dist/`);

        // verify no entries start with this path anymore
        const keys = await page.evaluate(() =>
          Object.keys(document.querySelector(`file-tree`).entries)
        );
        expect(!keys.some((v) => v.startsWith(`dist/`))).toBe(true);
      });

      await entryExists(`dist/`);
      await page.locator(`[path="dist/"] > entry-heading`).click();
      const qs = `dir-entry[path="dist/"] button[title="${Strings.DELETE_DIRECTORY}"]`;
      const btn = page.locator(qs).first();
      await btn.click();
    });

    test(`deleting a dir in another directory`, async () => {
      listenForDirDeleteEvent();

      page.on(`dialog`, async (dialog) => {
        await dialog.accept();

        const { detail } = await eventPromise;
        const { path } = detail;
        await expect(path).toBe(`dist/old/`);
        await entryDoesNotExist(`dist/old/`);

        // verify no entries start with this path anymore
        const keys = await page.evaluate(() =>
          Object.keys(document.querySelector(`file-tree`).entries)
        );
        expect(!keys.some((v) => v.startsWith(`dist/old/`))).toBe(true);
        expect(keys.some((v) => v.startsWith(`dist/`))).toBe(true);
      });

      await entryExists(`dist/old/`);
      await page.locator(`[path="dist/old/"] > entry-heading`).click();
      const qs = `[path="dist/old/"] button[title="${Strings.DELETE_DIRECTORY}"]`;
      const btn = page.locator(qs).first();
      await btn.click();
    });
  });
});
