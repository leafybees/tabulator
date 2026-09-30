// @ts-check
import { test, expect } from "@playwright/test";
import { join } from "path";

// The range outline used to be an overlay that was hidden on every scroll and
// only redrawn 200ms after scrolling stopped. It's now drawn by the cells on the
// range's edges, so it has to stay drawn while scrolling and follow the cells
// that virtual rendering adds.
test.describe("Select range while scrolling", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto(`file://${join(__dirname, "select-range-scroll.html")}`);
		await page.waitForSelector(".tabulator-range-cell-active");
	});

	// every cell's text is "<row>:<column>", which stays unique as virtual rendering reorders rows
	function cell(page, rowIndex, field) {
		return page.locator(`.tabulator-cell[tabulator-field="${field}"]:text-is("${rowIndex}:${field.slice(1)}")`);
	}

	function outlineWidths(locator) {
		return locator.evaluate((el) => {
			const style = getComputedStyle(el, "::after");
			return [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth];
		});
	}

	async function selectRange(page, startRow, startField, endRow, endField) {
		await page.evaluate(([startRow, startField, endRow, endField]) => {
			const rows = window.testTable.getRows();
			window.testTable.addRange(rows[startRow].getCell(startField), rows[endRow].getCell(endField));
		}, [startRow, startField, endRow, endField]);
		await expect(cell(page, startRow, startField)).toHaveClass(/tabulator-range-cell-active/);
	}

	async function scrollHolder(page, top, left) {
		await page.evaluate(([top, left]) => {
			const holder = document.querySelector(".tabulator-tableholder");
			holder.scrollTop = top;
			holder.scrollLeft = left;
		}, [top, left]);
	}

	test("the outline stays drawn in the same frame as a scroll", async ({ page }) => {
		await selectRange(page, 2, "c1", 4, "c2");

		const topLeft = cell(page, 2, "c1");

		const widthsDuringScroll = await page.evaluate(() => new Promise((resolve) => {
			const holder = document.querySelector(".tabulator-tableholder");
			holder.addEventListener("scroll", () => {
				const el = document.querySelector(".tabulator-range-top.tabulator-range-left");
				const style = getComputedStyle(el, "::after");
				resolve([style.borderTopWidth, style.borderLeftWidth, getComputedStyle(el).visibility]);
			}, { once: true });
			holder.scrollTop = 20;
		}));

		expect(widthsDuringScroll).toEqual(["2px", "2px", "visible"]);
		expect(await outlineWidths(topLeft)).toEqual(["2px", "2px", "2px", "2px"]);
		expect(await outlineWidths(cell(page, 4, "c2"))).toEqual(["0px", "1px", "1px", "0px"]);
	});

	test("rows rendered by scrolling get the outline of a range that runs into them", async ({ page }) => {
		await selectRange(page, 1, "c1", 200, "c2");

		await page.evaluate(() => window.testTable.scrollToRow(201, "center", false));

		await expect(cell(page, 200, "c1")).toHaveClass(/tabulator-range-bottom/);
		await expect(cell(page, 200, "c1")).toHaveClass(/tabulator-range-left/);
		await expect(cell(page, 200, "c2")).toHaveClass(/tabulator-range-right/);
		await expect(cell(page, 199, "c1")).not.toHaveClass(/tabulator-range-bottom/);
	});

	test("columns rendered by horizontal scrolling get the range outline", async ({ page }) => {
		await selectRange(page, 1, "c1", 3, "c15");

		await scrollHolder(page, 0, 1400);

		await expect(cell(page, 1, "c15")).toHaveClass(/tabulator-range-top/);
		await expect(cell(page, 1, "c15")).toHaveClass(/tabulator-range-right/);
		await expect(cell(page, 3, "c15")).toHaveClass(/tabulator-range-bottom/);
	});

	test("the fill handle comes back into view with its cell", async ({ page }) => {
		await selectRange(page, 1, "c1", 2, "c2");

		await page.evaluate(() => window.testTable.scrollToRow(250, "center", false));
		await expect(cell(page, 250, "c1")).toBeVisible();
		await scrollHolder(page, 0, 0);

		await expect(cell(page, 2, "c2").locator(".tabulator-range-fill-handle")).toBeVisible();
	});
});
