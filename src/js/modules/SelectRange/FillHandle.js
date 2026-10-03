import CoreFeature from "../../core/CoreFeature.js";
import Range from "./Range.js";
import Rect from "../../core/tools/Rect.js";

export default class FillHandle extends CoreFeature {
	// Half the handle's size in the stylesheet
	static RADIUS = 3;

	constructor(table, rangeManager) {
		super(table);

		/** @type {import("./SelectRange.js").default} */
		this.rangeManager = rangeManager;
		this.element = null;
		/** @type {Range|null} */
		this.preview = null;
		/** @type {Rect|null} */
		this.source = null;
		this.pointerRow = 0;
		this.pointerCol = 0;
		this.isActive = false;
		/** @type {import("../../core/cell/Cell.js").default|null} */
		this.cell = null;
		this.positionFrame = null;
		this.positionStale = false;

		this.handleMouseDown = this.handleMouseDown.bind(this);
		this.schedulePosition = this.schedulePosition.bind(this);
		this.handleMouseUp = this.handleMouseUp.bind(this);
		this.handleCellMouseMove = this.handleCellMouseMove.bind(this);

		this.element = document.createElement("div");
		this.element.classList.add("tabulator-range-fill-handle");
		this.element.addEventListener("mousedown", this.handleMouseDown);

		// Only the handle's left offset is measured, so only horizontal layout changes move it.
		this.subscribe("scroll-horizontal", this.schedulePosition);
		this.subscribe("column-width", this.schedulePosition);
		this.subscribe("column-moved", this.schedulePosition);
		this.subscribe("column-show", this.schedulePosition);
		this.subscribe("column-hide", this.schedulePosition);
		this.subscribe("table-layout", this.schedulePosition);
		this.subscribe("scroll-vertical", () => {
			if (this.positionStale) {
				this.schedulePosition();
			}
		});
	}

	/**
	 * Place the handle on the corner of the active range's bottom right cell.
	 * It lives in the cell's row rather than the cell, as cells clip their
	 * contents, so it moves with the row as it scrolls.
	 * @param {import("../../core/cell/Cell.js").default} cell
	 */
	attach(cell) {
		const rowElement = cell.row.getElement();

		this.cell = cell;

		if (this.element.parentNode !== rowElement) {
			rowElement.appendChild(this.element);
		}

		// Measured straight away, so the handle is in place as soon as the range changes
		this.position();
	}

	detach() {
		this.cell = null;
		this.element.remove();
	}

	/**
	 * Measure at most once a frame. A frame requested from a scroll or resize
	 * handler runs before that frame is painted, so the handle never lags.
	 */
	schedulePosition() {
		if (this.positionFrame === null) {
			this.positionFrame = requestAnimationFrame(() => this.position());
		}
	}

	position() {
		this.positionFrame = null;

		if (!this.cell) {
			return;
		}

		const cellElement = this.cell.getElement();

		// Its row is outside the virtual DOM, measure once it's scrolled back in
		this.positionStale = !cellElement.isConnected;

		if (this.positionStale) {
			return;
		}

		const rowElement = this.cell.row.getElement();
		const displayRows = this.table.rowManager.getDisplayRows();
		const isLastRow = displayRows[displayRows.length - 1] === this.cell.row;
		let left = this.table.rtl
			? cellElement.offsetLeft
			: cellElement.offsetLeft + cellElement.offsetWidth;

		// On the table's outer edges the handle stays inside, as the overhang
		// would be clipped by, and make scrollable, the table holder.
		left = Math.min(Math.max(left, FillHandle.RADIUS), rowElement.offsetWidth - FillHandle.RADIUS);

		this.element.style.left = left + "px";
		this.element.style.bottom = isLastRow ? "0px" : "";
	}

	handleMouseDown(e) {
		const range = this.rangeManager.activeRange;

		if (e.button !== 0 || !range) {
			return;
		}

		e.preventDefault();
		e.stopPropagation();

		this.isActive = true;
		this.source = range.rect.clone();
		this.pointerRow = this.source.bottom;
		this.pointerCol = this.source.right;

		this.preview = new Range(this.table, this.rangeManager, {
			rect: this.source,
			skipEvents: true,
		});

		this.rangeManager.layoutElement(true);
		this.subscribe("cell-mousemove", this.handleCellMouseMove);
		document.addEventListener("mouseup", this.handleMouseUp);
	}

	handleCellMouseMove(e, cell) {
		if (cell.column === this.rangeManager.rowHeader) {
			return;
		}

		const row = cell.row.position - 1;
		const col = cell.column.getPosition() - 1;

		if (row === this.pointerRow && col === this.pointerCol) {
			return;
		}

		this.pointerRow = row;
		this.pointerCol = col;

		const rect = FillHandle.extendAlongAxis(
			this.source,
			this.pointerRow,
			this.pointerCol,
		);

		this.preview.setRect(rect);
		this.rangeManager.layoutElement(true);
	}

	async handleMouseUp() {
		this.isActive = false;

		this.unsubscribe("cell-mousemove", this.handleCellMouseMove);
		document.removeEventListener("mouseup", this.handleMouseUp);

		this.rangeManager.clearRanges();

		const range = await this.addInitializedRange(
			this.preview.getStartCell(),
			this.preview.getEndCell()
		);

		const data = this.buildFillData(
			this.source,
			this.pointerRow,
			this.pointerCol,
		);

		range.setData(data);

		this.preview.destroy();
		this.preview = null;
		this.rangeManager.layoutElement();
	}

	/**
	 * The data, in Range.setData shape, for the cells a drag from `source` to
	 * (pointerRow, pointerCol) covers, repeating the source's values.
	 * @param {Rect} source
	 * @param {number} pointerRow
	 * @param {number} pointerCol
	 */
	buildFillData(source, pointerRow, pointerCol) {
		const target = FillHandle.extendAlongAxis(source, pointerRow, pointerCol);
		const height = source.bottom - source.top + 1;
		const width = source.right - source.left + 1;

		const rows = this.rangeManager.getTableRows();
		const columns = this.rangeManager.getTableColumns();
		const data = [];

		for (let y = target.top; y <= target.bottom; y++) {
			const rowData = [];

			for (let x = target.left; x <= target.right; x++) {
				const sourceRowPos =
					source.top + ((((y - source.top) % height) + height) % height);
				const sourceColPos =
					source.left + ((((x - source.left) % width) + width) % width);
				const sourceRow = rows[sourceRowPos];
				const sourceCol = columns[sourceColPos];

				rowData.push(sourceRow.getData()[sourceCol.getField()]);
			}

			data.push(rowData);
		}

		return data;
	}

	addInitializedRange(start, end) {
		const range = this.rangeManager.addRange(start, end);

		if (!range.initialized) {
			return new Promise((resolve) => {
				const handleRangeAdded = (promisedRange) => {
					if (promisedRange !== range) {
						return;
					}
					this.unsubscribe("range-added", handleRangeAdded);
					resolve(range);
				};

				this.subscribe("range-added", handleRangeAdded);
			});
		}

		return Promise.resolve(range);
	}

	/**
	 * The rect a fill from `source` covers when the pointer is over (row, col).
	 * @param {Rect} source
	 * @param {number} row
	 * @param {number} col
	 */
	static extendAlongAxis(source, row, col) {
		let rowDelta = 0;
		let colDelta = 0;
		let top = source.top;
		let bottom = source.bottom;
		let left = source.left;
		let right = source.right;

		if (row < source.top) {
			rowDelta = source.top - row;
		} else if (row > source.bottom) {
			rowDelta = row - source.bottom;
		}

		if (col < source.left) {
			colDelta = source.left - col;
		} else if (col > source.right) {
			colDelta = col - source.right;
		}

		// Like a spreadsheet, a fill only ever grows along one axis: whichever the pointer has strayed further on.
		if (rowDelta && rowDelta >= colDelta) {
			top = Math.min(top, row);
			bottom = Math.max(bottom, row);
		} else if (colDelta) {
			left = Math.min(left, col);
			right = Math.max(right, col);
		}

		return new Rect(top, bottom, left, right);
	}

	destroy() {
		document.removeEventListener("mouseup", this.handleMouseUp);
		cancelAnimationFrame(this.positionFrame);
		this.positionFrame = null;
		this.detach();
		this.preview?.destroy();
		this.preview = null;
	}
}
