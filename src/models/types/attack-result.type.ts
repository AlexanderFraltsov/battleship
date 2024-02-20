import { EAttackResultStatus } from '../enums';

export type TAttackResult = {
	position: { x: number; y: number };
	status: EAttackResultStatus;
}
