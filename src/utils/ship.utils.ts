import { getRandomInteger } from './get-random-integer.util';
import { GAME_FIELD_SIDE, SHIP_TEMPLATES } from '../constants';
import { EAttackResultStatus, TAttackResult, TShipPosition } from '../models';

const getAttackFeedback = (x: number, y: number, shipPositions: TShipPosition[], field: boolean[][]): TAttackResult[] => {
	if (field[x][y]) {
		return [];
	}

	if (!isShipOnPosition(x, y, shipPositions)) {
		return [{
			status: EAttackResultStatus.MISS,
			position: { x, y },
		}];
	}

	const ship = getAttackedShip(x, y, shipPositions);
	const positions = getAllPositionsForShip(ship);
	const otherShipPositions = positions.filter(position => !(position.x === x && position.y === y));
	if (otherShipPositions.length === 0 || otherShipPositions.every(({ x, y }) => field[x][y])) {
		const around: TAttackResult[] = getAllPositionsArroundShip(ship)
			.filter(({ x, y }) => !field[x][y])
			.map(position => ({ status: EAttackResultStatus.MISS, position }));
		const killed = positions.map(({ x, y }) => ({	status: EAttackResultStatus.KILLED, position: { x, y } }));
		return [
			...around,
			...killed,
		];
	}

	return [{ status: EAttackResultStatus.SHOT, position: { x, y } }];
}


const getAllPositionsForShip = ({ position, direction, length }: TShipPosition): { x: number, y: number }[] => {
	if (length === 1) {
		return [position]
	}
	return Array(length)
		.fill({ x: position.x, y: position.y })
		.map(({ x, y }, index) => direction
			? { x, y: y + index }
			: { x: x + index, y },
		);
}

const getPositionsForAllShip = (shipPositions: TShipPosition[]): { x: number, y: number }[] =>
  shipPositions.flatMap(ship => getAllPositionsForShip(ship));

const getAllPositionsArroundShip = (ship: TShipPosition) => {
	const arroundPositions: { x: number, y: number }[] = [];
	const shipPositions = getAllPositionsForShip(ship);
	const first = shipPositions[0];
	const last = shipPositions[ship.length - 1];
	if (ship.direction) {
		arroundPositions.push(
			...shipPositions.map(({ x, y }) => ({ x: x - 1, y })),
			...shipPositions.map(({ x, y }) => ({ x: x + 1, y })),
			{ x: first.x - 1, y: first.y - 1 },
			{ x: first.x, y: first.y - 1 },
			{ x: first.x + 1, y: first.y - 1 },
			{ x: last.x - 1, y: last.y + 1 },
			{ x: last.x, y: last.y + 1 },
			{ x: last.x + 1, y: last.y + 1 },
		);
	} else {
		arroundPositions.push(
			...shipPositions.map(({ x, y }) => ({ x, y: y - 1 })),
			...shipPositions.map(({ x, y }) => ({ x, y: y + 1 })),
			{ x: first.x - 1, y: first.y + 1 },
			{ x: first.x - 1, y: first.y },
			{ x: first.x - 1, y: first.y - 1 },
			{ x: last.x + 1, y: last.y + 1 },
			{ x: last.x + 1, y: last.y },
			{ x: last.x + 1, y: last.y - 1 },
		);
	}
	return arroundPositions.filter(({ x, y }) => x >= 0 && x < GAME_FIELD_SIDE && y >= 0 && y < GAME_FIELD_SIDE);
}

const getAllFreeCells = (field: boolean[][]): { x: number, y: number }[] => {
	const cells: { x: number, y: number }[] = [];
	field.forEach((row, x) => row.forEach((cell, y) => {
		if (!cell) {
			cells.push({ x, y });
		}
	}));
	return cells;
}



const getRandomField = (field: boolean[][]): { x: number, y: number } => {
	const cells = getAllFreeCells(field);
	return cells[getRandomInteger(cells.length - 1)];
}

const isShipOnPosition = (x: number, y: number, shipPositions: TShipPosition[]) =>
	getPositionsForAllShip(shipPositions).some(pos => pos.x === x && pos.y === y);

const getAttackedShip = (x: number, y: number, shipPositions: TShipPosition[]): TShipPosition =>
	shipPositions.find((ship) => getAllPositionsForShip(ship).some(position => position.x === x && position.y === y));

const getRandomShipsTemplate = () =>
	SHIP_TEMPLATES[getRandomInteger(SHIP_TEMPLATES.length - 1)];

export const ShipUtils = {
	getAttackFeedback,
	getRandomField,
	getRandomShipsTemplate,
}
