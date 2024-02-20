import { EIncomingMessageType } from '../enums';

export type TClientMessage = {
	id: 0;
	data: string;
	type: EIncomingMessageType;
}
