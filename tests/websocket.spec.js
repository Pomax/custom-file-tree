import { expect, test } from "@playwright/test";
import { exec } from "node:child_process";

const websocketURL = `https://localhost/public/websocket.html`;

/**
 * IFFE wrapped because we don't want these tests to run if
 * the github actions env var is set. We can't run caddy in
 * that environment, so there's no point even trying to run
 * these can-only-fail-without-https tests =)
 */
(function () {
  if (process.env.RUNNING_GITHUB_ACTION) {
    return console.log(
      `Running GitHub action: not running secure websocket tests.`
    );
  }

  // These tests all use two "tabs" to confirm that synchronization works.
  let page1, page2;
  let editor1, editor2;

  test.describe(`Websocket tests`, () => {
    test.beforeAll(() => exec(`caddy start`));
    test.afterAll(() => exec(`caddy stop`));

    test.beforeEach(async ({ browser }) => {
      const context = [await browser.newContext(), await browser.newContext()];
      [page1, page2] = [await context[0].newPage(), await context[1].newPage()];
      page1.on("console", (msg) => console.log(msg.text()));
      page2.on("console", (msg) => console.log(msg.text()));
      await page1.goto(websocketURL);
      await page2.goto(websocketURL);
      editor1 = page1.locator(`#editor`);
      editor2 = page1.locator(`#editor`);
    });

    test(`Both browsers see the same data`, async () => {
      await page1.locator(`[path="dist/file-tree.css"]`).click();
      await page2.locator(`[path="dist/file-tree.css"]`).click();

      await Promise.all([
        expect(editor1).not.toHaveValue(``, { timeout: 1000 }),
        expect(editor2).not.toHaveValue(``, { timeout: 1000 }),
      ]);

      const v1 = await editor1.inputValue();
      const v2 = await editor2.inputValue();

      expect(v1).not.toBe(``);
      expect(v2).not.toBe(``);
      expect(v1).toEqual(v2);
    });

    test(`Creating a file in one creates it in the other`, async () => {
      page1.on(`dialog`, async (dialog) => {
        await dialog.accept(`newfile.txt`);

        // confirm the file exists in both tabs:
        const qs = `file-entry[path="newfile.txt"]`;
        expect(page1.locator(qs)).toBeVisible({ timeout: 1000 });
        expect(page2.locator(qs)).toBeVisible({ timeout: 1000 });
      });

      await page1.locator(`[path="."] > .buttons .create-file`).click();
    });

    test(`Renaming a file in one renames it in the other`, async () => {
      page1.on(`dialog`, async (dialog) => {
        await dialog.accept(`file-tree-2.css`);
        // confirm the file got renamed in both tabs:
        const qs = `file-entry[path="dist/file-tree-2.css"]`;
        expect(page1.locator(qs)).toBeVisible({ timeout: 1000 });
        expect(page2.locator(qs)).toBeVisible({ timeout: 1000 });
      });

      const e = await page1.locator(`[path="dist/file-tree.css"]`);
      await e.click();
      await e.locator(`.buttons .rename-file`).click();
    });

    test(`Moving a file in one moves it in the other`, async () => {
      // ...ideally we have a test here, but if everything else
      //    passes, then we can be reasonably sure this passes...
    });

    test(`Updating a file in one updates it in the other`, async () => {
      await page1.locator(`[path="dist/file-tree.css"]`).click();
      await page2.locator(`[path="dist/file-tree.css"]`).click();

      await Promise.all([
        expect(editor1).not.toHaveValue(``, { timeout: 1000 }),
        expect(editor2).not.toHaveValue(``, { timeout: 1000 }),
      ]);

      const newContent = `Change the file content: ${Date.now()}:${Math.random()}.`;
      await editor1.fill(newContent);
      await expect(editor2).toHaveValue(newContent, { timeout: 1000 });
    });

    test(`Deleting a file in one deletes it in the other`, async () => {
      page1.on(`dialog`, async (dialog) => {
        await dialog.accept();

        // confirm the file is gone in both tabs:
        const qs = `file-entry[path="dist/file-tree.esm.js"]`;
        const e1 = await page1.locator(qs);
        await expect(e1).not.toBeVisible({ timeout: 1000 });
        const e2 = await page2.locator(qs);
        await expect(e2).not.toBeVisible({ timeout: 1000 });
      });

      const e2 = await page2.locator(`[path="dist/file-tree.esm.js"]`);
      await expect(e2).toBeVisible();

      const e1 = await page1.locator(`[path="dist/file-tree.esm.js"]`);
      await e1.click();
      await e1.locator(`.buttons .delete-file`).click();
    });
  });

  // TODO: we need more test before we can be confident everything works

  /*
    - equivalent tests for directories
    - failure modes:
      - bad sequencing
      - rejected actions
      - rejected content edits
  */

})();
