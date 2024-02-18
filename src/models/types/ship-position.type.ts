import { TShipSize } from './ship-size.type';

export type TShipPosition = {
	position: { x: number; y: number };
	direction: boolean;
	type: TShipSize;
	length: number;
}
