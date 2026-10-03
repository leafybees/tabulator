import TabulatorFull from "../../../src/js/core/TabulatorFull";
import SelectRange from "../../../src/js/modules/SelectRange/SelectRange";

describe("SelectRange module", () => {
    /** @type {TabulatorFull} */
    let tabulator;
    /** @type {SelectRange} */
    let selectRangeMod;
    let tableData = [
        { id: 1, name: "John", age: 30, position: "Manager" },
        { id: 2, name: "Jane", age: 25, position: "Developer" },
        { id: 3, name: "Bob", age: 35, position: "Designer" }
    ];
    let tableColumns = [
        { title: "ID", field: "id" },
        { title: "Name", field: "name" },
        { title: "Age", field: "age" },
        { title: "Position", field: "position" }
    ];

    beforeEach(async () => {
        const el = document.createElement("div");
        el.id = "tabulator";
        document.body.appendChild(el);
        tabulator = new TabulatorFull("#tabulator", {
            data: tableData,
            columns: tableColumns,
            selectableRange: true,
        });
        selectRangeMod = tabulator.module("selectRange");
        return new Promise((resolve) => {
            tabulator.on("tableBuilt", () => {
                resolve();
            });
        });
    });

    afterEach(() => {
        tabulator.destroy();
        document.getElementById("tabulator")?.remove();
    });

    it("should have one range initially at the top left", () => {
        const range = selectRangeMod.getRanges()[0]._range;
        expect(range.rect.top).toBe(0);
        expect(range.rect.left).toBe(0);
        expect(range.rect.bottom).toBe(0);
        expect(range.rect.right).toBe(0);
    });

    it("should add a new range when addRange is called", () => {
        const initialRangesCount = selectRangeMod.getRanges().length;
        selectRangeMod.addRange();
        expect(selectRangeMod.getRanges().length).toBe(initialRangesCount + 1);
    });

    it("should reset ranges when resetRanges is called", () => {
        // Add multiple ranges
        selectRangeMod.addRange();
        selectRangeMod.addRange();
        
        // Reset ranges
        const resetRange = selectRangeMod.resetRanges();
        
        // Should have only one range after reset
        expect(selectRangeMod.getRanges().length).toBe(1);
        expect(resetRange).toBe(selectRangeMod.getRanges()[0]._range);
    });

    it("should have correct structure in RangeComponent", () => {
        const rangeComponent = selectRangeMod.getRanges()[0];
        
        // Test component properties
        expect(rangeComponent._range).toBeDefined();
        expect(typeof rangeComponent.getElement).toBe("function");
        expect(typeof rangeComponent.getData).toBe("function");
        expect(typeof rangeComponent.getCells).toBe("function");
        expect(typeof rangeComponent.getRows).toBe("function");
        expect(typeof rangeComponent.getColumns).toBe("function");
    });

    it("should have correct min/max values", () => {
        const range = selectRangeMod.getRanges()[0]._range;
        
        // The min/max values should match the start/end values after they're set
        range.setStart(1, 2);
        range.setEnd(3, 4);
        
        expect(range.rect.top).toBe(1);
        expect(range.rect.bottom).toBe(3);
        expect(range.rect.left).toBe(2);
        expect(range.rect.right).toBe(4);
    });

    it("should handle Range setStart and setEnd", () => {
        const range = selectRangeMod.getRanges()[0]._range;
        
        // Initial values
        expect(range.start.row).toBeUndefined();
        expect(range.start.col).toBeUndefined();
        expect(range.end.row).toBeUndefined();
        expect(range.end.col).toBeUndefined();
        
        // Set start
        range.setStart(1, 2);
        expect(range.start.row).toBe(1);
        expect(range.start.col).toBe(2);
        
        // Set end
        range.setEnd(3, 4);
        expect(range.end.row).toBe(3);
        expect(range.end.col).toBe(4);
    });

    it("should detect overlaps correctly", () => {
        const range = selectRangeMod.getRanges()[0]._range;
        
        // Setup range bounds
        range.rect.top = 1;
        range.rect.bottom = 3;
        range.rect.left = 2;
        range.rect.right = 4;
        
        // Test overlapping case
        expect(range.overlaps(1, 1, 5, 5)).toBe(true);
        expect(range.overlaps(3, 3, 5, 5)).toBe(true);
        
        // Test non-overlapping cases
        expect(range.overlaps(5, 5, 7, 7)).toBe(false);
        expect(range.overlaps(0, 0, 0, 0)).toBe(false);
    });

    it("should handle destroyedGuard", () => {
        const range = selectRangeMod.getRanges()[0]._range;
        
        // Should return true when not destroyed
        expect(range.destroyedGuard("testFunction")).toBe(true);
        
        // Test warning message when destroyed
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        range.destroyed = true;
        expect(range.destroyedGuard("testFunction")).toBe(false);
        expect(consoleWarnSpy).toHaveBeenCalled();
        
        // Clean up
        consoleWarnSpy.mockRestore();
    });
});

describe("SelectRange with cell editing", () => {
    /** @type {TabulatorFull} */
    let tabulator;
    let offsetSpies;

    beforeAll(() => {
        // jsdom computes no layout, so Tabulator's visibility check would skip
        // rendering the table body, leaving cells detached from the document,
        // which would stop mouse events from bubbling to the table element and
        // stop the editor input from receiving focus
        offsetSpies = [
            jest.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(30),
            jest.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(100),
        ];
    });

    afterAll(() => {
        offsetSpies.forEach((spy) => spy.mockRestore());
    });

    beforeEach(async () => {
        const el = document.createElement("div");
        el.id = "select-range-edit-test";
        document.body.appendChild(el);
        tabulator = new TabulatorFull("#select-range-edit-test", {
            data: [
                { id: 1, name: "John", age: 30 },
                { id: 2, name: "Jane", age: 25 }
            ],
            columns: [
                { title: "ID", field: "id" },
                { title: "Name", field: "name", editor: "input" },
                { title: "Age", field: "age" }
            ],
            selectableRange: true,
            renderVertical: "basic"
        });

        return new Promise((resolve) => {
            tabulator.on("renderComplete", () => {
                resolve();
            });
        });
    });

    afterEach(() => {
        tabulator.destroy();
        document.getElementById("select-range-edit-test")?.remove();
    });

    // https://github.com/tabulator-tables/tabulator/issues/4563
    it("should keep the editor open when the editor input is clicked", () => {
        const cell = tabulator.getRows()[0].getCells()[1];
        const editMod = tabulator.module("edit");

        cell.edit(true);
        expect(editMod.currentCell).toBeTruthy();

        const input = cell.getElement().querySelector("input");
        expect(input).toBeTruthy();

        // clicking inside the editor to place the caret must not start a range
        // selection, the focus transfer that follows would blur and close the editor
        input.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        input.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
        input.dispatchEvent(new MouseEvent("click", { bubbles: true }));

        expect(editMod.currentCell).toBeTruthy();
        expect(cell.getElement().classList.contains("tabulator-editing")).toBe(true);
        expect(cell.getElement().querySelector("input")).toBeTruthy();
    });

    // https://github.com/tabulator-tables/tabulator/issues/4563
    it("should still close the editor when another cell is pressed", () => {
        const cell = tabulator.getRows()[0].getCells()[1];
        const otherCell = tabulator.getRows()[1].getCells()[2];
        const editMod = tabulator.module("edit");

        cell.edit(true);
        expect(editMod.currentCell).toBeTruthy();

        // pressing outside the edited cell starts a new range selection, whose
        // focus transfer blurs the editor input and commits the edit
        otherCell.getElement().dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

        expect(editMod.currentCell).toBeFalsy();
        expect(cell.getElement().querySelector("input")).toBeNull();
    });
});

describe("SelectRange outline drawn on cells", () => {
    /** @type {TabulatorFull} */
    let tabulator;
    let offsetSpies;

    const edgeClasses = ["top", "bottom", "left", "right"].map((edge) => "tabulator-range-" + edge);

    function cellEl(rowIdx, field) {
        return tabulator.getRows()[rowIdx].getCell(field).getElement();
    }

    function edgesOf(el) {
        return edgeClasses.filter((cls) => el.classList.contains(cls)).map((cls) => cls.replace("tabulator-range-", ""));
    }

    // jsdom lays nothing out; defined on the element so other elements keep the mocks above
    function setLayout(el, prop, value) {
        Object.defineProperty(el, prop, { configurable: true, get: () => value });
    }

    async function addRange(startRow, startField, endRow, endField) {
        const rows = tabulator.getRows();
        const range = tabulator.addRange(rows[startRow].getCell(startField), rows[endRow].getCell(endField));
        // addRange sets its bounds in a setTimeout
        await new Promise((resolve) => setTimeout(resolve));
        return range;
    }

    beforeAll(() => {
        // jsdom computes no layout, so without these the table body is never rendered
        offsetSpies = [
            jest.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(30),
            jest.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(100),
        ];
    });

    afterAll(() => {
        offsetSpies.forEach((spy) => spy.mockRestore());
    });

    async function build(options = {}) {
        const el = document.createElement("div");
        el.id = "select-range-outline-test";
        document.body.appendChild(el);
        tabulator = new TabulatorFull("#select-range-outline-test", {
            data: [
                { a: 1, b: 2, c: 3, d: 4 },
                { a: 5, b: 6, c: 7, d: 8 },
                { a: 9, b: 10, c: 11, d: 12 },
                { a: 13, b: 14, c: 15, d: 16 },
            ],
            columns: [
                { field: "a", editor: "input" },
                { field: "b", editor: "input" },
                { field: "c", editor: "input" },
                { field: "d", editor: "input" },
            ],
            selectableRange: true,
            renderVertical: "basic",
            ...options,
        });

        await new Promise((resolve) => tabulator.on("renderComplete", resolve));
    }

    afterEach(() => {
        tabulator.destroy();
        document.getElementById("select-range-outline-test")?.remove();
    });

    // The outline used to be an overlay that was hidden on every scroll and redrawn 200ms after,
    // so it flickered while scrolling. It's now drawn by the cells on the range's edges.
    it("does not add an overlay to the table body", async () => {
        await build();

        expect(tabulator.element.querySelector(".tabulator-range-overlay")).toBeNull();
    });

    it("puts edge classes only on the cells along each edge of the range", async () => {
        await build({ selectableRange: 1 });
        await addRange(1, "b", 2, "c");

        expect(edgesOf(cellEl(1, "b"))).toEqual(["top", "left"]);
        expect(edgesOf(cellEl(1, "c"))).toEqual(["top", "right"]);
        expect(edgesOf(cellEl(2, "b"))).toEqual(["bottom", "left"]);
        expect(edgesOf(cellEl(2, "c"))).toEqual(["bottom", "right"]);

        // cells outside the range, including those next to it
        expect(edgesOf(cellEl(0, "b"))).toEqual([]);
        expect(edgesOf(cellEl(1, "a"))).toEqual([]);
        expect(edgesOf(cellEl(3, "c"))).toEqual([]);
        expect(edgesOf(cellEl(2, "d"))).toEqual([]);
    });

    it("clears edge classes from cells that leave the range", async () => {
        await build({ selectableRange: 1 });
        await addRange(1, "b", 2, "c");
        await addRange(0, "a", 0, "a");

        expect(edgesOf(cellEl(1, "b"))).toEqual([]);
        expect(edgesOf(cellEl(2, "c"))).toEqual([]);
        expect(edgesOf(cellEl(0, "a"))).toEqual(["top", "bottom", "left", "right"]);
    });

    it("draws the edges of every range where ranges overlap", async () => {
        await build({ selectableRange: 2 });
        await addRange(0, "a", 1, "b");
        await addRange(1, "b", 2, "c");

        // bottom right corner of the first range, top left corner of the second
        expect(edgesOf(cellEl(1, "b"))).toEqual(["top", "bottom", "left", "right"]);
    });

    it("keeps the outline on cells that are re-rendered", async () => {
        await build({ selectableRange: 1 });
        await addRange(1, "b", 2, "c");

        tabulator.getRows()[1].getCell("b").setValue(99);

        expect(edgesOf(cellEl(1, "b"))).toEqual(["top", "left"]);
    });

    it("marks only the range's start cell as the active cell", async () => {
        await build({ selectableRange: 1 });
        await addRange(2, "c", 1, "b");

        expect(cellEl(2, "c").classList.contains("tabulator-range-cell-active")).toBe(true);
        expect(tabulator.element.querySelectorAll(".tabulator-range-cell-active").length).toBe(1);
    });

    it("swaps the left and right edge classes in rtl mode", async () => {
        await build({ selectableRange: 1, textDirection: "rtl" });
        await addRange(1, "b", 1, "c");

        expect(edgesOf(cellEl(1, "b"))).toEqual(["top", "bottom", "right"]);
        expect(edgesOf(cellEl(1, "c"))).toEqual(["top", "bottom", "left"]);
    });

    it("puts the fill handle in the row of the range's bottom right cell and moves it with the range", async () => {
        await build({ selectableRange: 1, selectableRangeFill: true });
        const fillHandle = tabulator.module("selectRange").fillHandle;
        await addRange(0, "a", 1, "b");

        let handles = tabulator.element.querySelectorAll(".tabulator-range-fill-handle");
        expect(handles.length).toBe(1);
        expect(handles[0].parentNode).toBe(tabulator.getRows()[1].getElement());
        expect(fillHandle.cell).toBe(tabulator.getRows()[1].getCell("b")._cell);

        await addRange(2, "c", 3, "d");

        handles = tabulator.element.querySelectorAll(".tabulator-range-fill-handle");
        expect(handles.length).toBe(1);
        expect(handles[0].parentNode).toBe(tabulator.getRows()[3].getElement());
        expect(fillHandle.cell).toBe(tabulator.getRows()[3].getCell("d")._cell);
    });

    it("positions the fill handle on the right edge of its cell", async () => {
        await build({ selectableRange: 1, selectableRangeFill: true });
        const fillHandle = tabulator.module("selectRange").fillHandle;
        await addRange(0, "a", 1, "b");

        // jsdom lays nothing out, so give the corner cell a position in its row.
        // offsetWidth is mocked to 100 for every element above.
        setLayout(cellEl(1, "b"), "offsetLeft", 100);
        setLayout(tabulator.getRows()[1].getElement(), "offsetWidth", 400);
        fillHandle.position();

        expect(fillHandle.element.style.left).toBe("200px");
        expect(fillHandle.element.style.bottom).toBe("");
    });

    it("keeps the fill handle inside the table on its last column", async () => {
        await build({ selectableRange: 1, selectableRangeFill: true });
        const fillHandle = tabulator.module("selectRange").fillHandle;
        await addRange(0, "a", 1, "d");

        setLayout(cellEl(1, "d"), "offsetLeft", 300);
        setLayout(tabulator.getRows()[1].getElement(), "offsetWidth", 400);
        fillHandle.position();

        expect(fillHandle.element.style.left).toBe("397px");
    });

    it("keeps the fill handle inside the table on its last row", async () => {
        await build({ selectableRange: 1, selectableRangeFill: true });
        const fillHandle = tabulator.module("selectRange").fillHandle;
        await addRange(2, "a", 3, "b");

        expect(fillHandle.element.style.bottom).toBe("0px");
    });

    it("keeps the fill handle when the corner cell's contents are regenerated", async () => {
        await build({ selectableRange: 1, selectableRangeFill: true });
        await addRange(0, "a", 1, "b");

        tabulator.getRows()[1].getCell("b").setValue(99);

        expect(tabulator.getRows()[1].getElement().querySelector(".tabulator-range-fill-handle")).not.toBeNull();
    });

    it("warns that range getElement is deprecated and returns undefined", async () => {
        await build({ selectableRange: 1 });
        await addRange(0, "a", 0, "a");
        const range = tabulator.getRanges()[0];
        const warn = jest.spyOn(console, "warn").mockImplementation();

        expect(range.getElement()).toBeUndefined();
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("getElement() is deprecated"));

        warn.mockRestore();
    });
});
