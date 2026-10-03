import CoreFeature from '../../core/CoreFeature.js';
import RangeComponent from "./RangeComponent";
import Rect from "../../core/tools/Rect.js";

export default class Range extends CoreFeature{
	/**
	 * @param {{start?: Cell|Column, end?: Cell|Column, rect?: Rect, skipEvents?: boolean}} options
	 */
	constructor(table, rangeManager, options) {
		super(table);
		
		this.rangeManager = rangeManager;
		this.initialized = false;
		this.initializing = {
			start:false,
			end:false,
		};
		this.destroyed = false;
		this.skipEvents = options.skipEvents || false;
		
		this.rect = options.rect ? options.rect.clone() : Rect.zero();
		
		this.table = table;
		this.modifiedCells = [];
		this.start = {row:undefined, col:undefined};
		this.end = {row:undefined, col:undefined};

		if (options.rect) {
			this.start.row = options.rect.top;
			this.start.col = options.rect.left;
			this.end.row = options.rect.bottom;
			this.end.col = options.rect.right;
		} else if (this.rangeManager.rowHeader){
			this.rect.left = 1;
			this.rect.right = 1;
			this.start.col = 1;
			this.end.col = 1;
		}
		
		if (!options.rect) {
			setTimeout(() => {
				this.initBounds(options.start, options.end);
			});
		}
	}
	
	initBounds(start, end){
		this._updateMinMax();

		if(start){
			this.setBounds(start, end || start);
		}
	}
	
	///////////////////////////////////
	///////   Boundary Setup    ///////
	///////////////////////////////////
	
	setStart(row, col) {
		if(this.start.row !== row || this.start.col !== col){
			this.start.row = row;
			this.start.col = col;
			
			this.initializing.start = true;
			this._updateMinMax();
		}
	}
	
	setEnd(row, col) {
		if(this.end.row !== row || this.end.col !== col){
			this.end.row = row;
			this.end.col = col;
			
			this.initializing.end = true;
			this._updateMinMax();
		}
	}

	/**
	 * @param {Rect} rect
	 */
	setRect(rect) {
		const startRow = this.start.row === this.rect.top ? rect.top : rect.bottom;
		const startCol = this.start.col === this.rect.left ? rect.left : rect.right;

		this.setStart(startRow, startCol);
		this.setEnd(
			startRow === rect.top ? rect.bottom : rect.top,
			startCol === rect.left ? rect.right : rect.left,
		);
	}

	setBounds(start, end, visibleRows){
		if(start){
			this.setStartBound(start);
		}
		
		this.setEndBound(end || start);
		this.rangeManager.layoutElement(visibleRows);
	}
	
	setStartBound(element){
		var row, col;
		
		if (element.type === "column") {
			if(this.rangeManager.columnSelection){
				this.setStart(0, element.getPosition() - 1);
			}
		}else{
			row = element.row.position - 1;
			col = element.column.getPosition() - 1;
			
			if (element.column === this.rangeManager.rowHeader) {
				this.setStart(row, 1);
			} else {
				this.setStart(row, col);
			}
		}
	}
	
	setEndBound(element){
		var rowsCount = this._getTableRows().length,
		row, col, isRowHeader;
		
		if (element.type === "column") {
			if(this.rangeManager.columnSelection){
				if (this.rangeManager.selecting === "column") {
					this.setEnd(rowsCount - 1, element.getPosition() - 1);
				} else if (this.rangeManager.selecting === "cell") {
					this.setEnd(0, element.getPosition() - 1);
				}
			}
		}else{
			row = element.row.position - 1;
			col = element.column.getPosition() - 1;
			isRowHeader = element.column === this.rangeManager.rowHeader;
			
			if (this.rangeManager.selecting === "row") {
				this.setEnd(row, this._getTableColumns().length - 1);
			} else if (this.rangeManager.selecting !== "row" && isRowHeader) {
				this.setEnd(row, 0);
			} else if (this.rangeManager.selecting === "column") {
				this.setEnd(rowsCount - 1, col);
			} else {
				this.setEnd(row, col);
			}
		}
	}
	
	_updateMinMax() {
		this.rect.top = Math.min(this.start.row, this.end.row);
		this.rect.bottom = Math.max(this.start.row, this.end.row);
		this.rect.left = Math.min(this.start.col, this.end.col);
		this.rect.right = Math.max(this.start.col, this.end.col);
		
		if(this.initialized){
			if(!this.skipEvents){
				this.dispatchExternal("rangeChanged", this.getComponent());
			}
		}else{
			if(this.initializing.start && this.initializing.end){
				this.initialized = true;

				if(!this.skipEvents){
					this.dispatch("range-added", this);
					this.dispatchExternal("rangeAdded", this.getComponent());
				}
			}
		}
	}
	
	_getTableColumns() {
		return this.table.columnManager.getVisibleColumnsByIndex();
	}
	
	_getTableRows() {
		return this.table.rowManager.getDisplayRows().filter(row=> row.type === "row");
	}
	
	atTopLeft(cell) {
		return cell.row.position - 1 === this.rect.top && cell.column.getPosition() - 1 === this.rect.left;
	}
	
	atBottomRight(cell) {
		return cell.row.position - 1 === this.rect.bottom && cell.column.getPosition() - 1 === this.rect.right;
	}
	
	occupies(cell) {
		return this.occupiesRow(cell.row) && this.occupiesColumn(cell.column);
	}
	
	occupiesRow(row) {
		return this.rect.top <= row.position - 1 && row.position - 1 <= this.rect.bottom;
	}
	
	occupiesColumn(col) {
		return this.rect.left <= col.getPosition() - 1 && col.getPosition() - 1 <= this.rect.right;
	}
	
	overlaps(left, top, right, bottom) {
		if ((this.rect.left > right || left > this.rect.right) || (this.rect.top > bottom || top > this.rect.bottom)){
			return false;
		}
		
		return true;
	}
	
	getData() {
		var data = [],
		rows = this.getRows(),
		columns = this.getColumns();
		
		rows.forEach((row) => {
			var rowData = row.getData(),
			result = {};
			
			columns.forEach((column) => {
				result[column.field] = rowData[column.field];
			});
			
			data.push(result);
		});
		
		return data;
	}
	
	getCells(structured, component) {
		var cells = [],
		rows = this.getRows(),
		columns = this.getColumns();
		
		if (structured) {
			cells = rows.map((row) => {
				var arr = [];
				
				row.getCells().forEach((cell) => {
					if (columns.includes(cell.column)) {
						arr.push(component ? cell.getComponent() : cell);
					}
				});
				
				return arr;
			});
		} else {
			rows.forEach((row) => {
				row.getCells().forEach((cell) => {
					if (columns.includes(cell.column)) {
						cells.push(component ? cell.getComponent() : cell);
					}
				});
			});
		}
		
		return cells;
	}
	
	getStructuredCells() {
		return this.getCells(true, true);
	}
	
	getRows() {
		return this._getTableRows().slice(this.rect.top, this.rect.bottom + 1);
	}
	
	getColumns() {
		return this._getTableColumns().slice(this.rect.left, this.rect.right + 1);
	}
	
	clearValues(){
		var cells = this.getCells();
		var clearValue = this.table.options.selectableRangeClearCellsValue;
		
		this.table.blockRedraw();
		
		cells.forEach((cell) => {
			cell.setValue(clearValue);
		});
		
		this.table.restoreRedraw();
		
	}
	
	setData(data){
		const rows = this.getCells(true);
		const rowUpdates = new Map();
		const cellValues = [];
		let hasChanges = false;
		
		this.modifiedCells = [];
		this.table.blockRedraw();
		
		rows.forEach((cells, rowIndex) => {
			const rowValues = data[rowIndex];

			cells.forEach((cell, colIndex) => {
				const field = cell.column.getField();
				const oldValue = cell.getValue();
				const editable = !this.table.modExists("edit")
					|| this.table.modules.edit.allowEdit(cell);
				let newValue = oldValue;

				if(editable && field && colIndex < rowValues.length){
					newValue = rowValues[colIndex];
					
					// Same check updateData uses, so unchanged cells aren't reported
					if(oldValue !== newValue){
						hasChanges = true;
						this.modifiedCells.push(cell.getComponent());
					}
					
					if(!rowUpdates.has(cell.row)){
						rowUpdates.set(cell.row, {});
					}
					
					rowUpdates.get(cell.row)[field] = newValue;
				}
				
				// Undo matches cellValues to getCells() by index, so it must
				// cover every cell of the range, not just the changed ones.
				cellValues.push({ oldValue, newValue });
			});
		});
		
		rowUpdates.forEach((newData, row) => row.updateData(newData));
		
		if(hasChanges && this.table.modExists("history")){
			this.table.modules.history.action("rangeEdit", this, {
				cells: cellValues,
			});
		}
		
		if(hasChanges){
			this.dispatchExternal("rangeEdited", this.getComponent());
		}
		
		this.table.restoreRedraw();
	}

	fill(value){
		const columns = this.getColumns();
		const data = this.getRows().map(() => columns.map(() => value));
		this.setData(data);
	}

	getBounds(component){
		var cells = this.getCells(false, component),
		output = {
			start:null,
			end:null,
		};
		
		if(cells.length){
			output.start = cells[0];
			output.end = cells[cells.length - 1];
		}else{
			console.warn("No bounds defined on range");
		}
		
		return output;
	}
	
	getStartCell(){
		return this.rangeManager.getCell(this.start.row, this.start.col);
	}
	
	getEndCell(){
		return this.rangeManager.getCell(this.end.row, this.end.col);
	}
	
	getComponent() {
		if (!this.component) {
			this.component = new RangeComponent(this);
		}
		return this.component;
	}
	
	destroy(notify) {
		this.destroyed = true;
		
		if(notify){
			this.rangeManager.rangeRemoved(this);
		}
		
		if(this.initialized && !this.skipEvents){
			this.dispatchExternal("rangeRemoved", this.getComponent());
		}
	}
	
	destroyedGuard(func){
		if(this.destroyed){
			console.warn("You cannot call the "  + func + " function on a destroyed range");
		}
		
		return !this.destroyed;
	}
}
