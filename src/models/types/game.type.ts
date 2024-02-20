import { TShipPosition } from './ship-position.type';

export type TGame = {
	gameId: number;
	gameUsers: {
		id: number;
		shipsKilled: number;
		ships: TShipPosition[];
		attackResults: boolean[][];
	}[];
	currentPlayerIndex: number;
}
