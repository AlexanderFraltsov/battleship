const ENDING = '\x1b[0m';

enum LogColors {
	YELLOW = '\x1b[33m',
	CYAN = '\x1b[36m',
	RED = '\x1b[31m',
	GREEN = '\x1b[32m',
	MAGENTA = '\x1b[35m',
};

class Logger {
	log(message: string) {
		console.log(`${LogColors.YELLOW}${message}${ENDING}`);
	}
	info(message: string) {
		console.log(`${LogColors.CYAN}${message}${ENDING}`);
	}
	success(message: string) {
		console.log(`${LogColors.GREEN}${message}${ENDING}`);
	}
	warn(message: string) {
		console.log(`${LogColors.MAGENTA}${message}${ENDING}`);
	}
	error(message: string) {
		console.log(`${LogColors.RED}${message}${ENDING}`);
	}
}

export const logger = new Logger();
