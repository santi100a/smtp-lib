import type { Socket } from 'node:net';
import { MailTransaction } from './types';

export default class SmtpResponse {
	encrypted: boolean = false;
	authenticated: boolean = false;
	authenticatedAs: string = '';
	helloDone: boolean = false;
	clientHostname: string = '';
	mailTransaction: MailTransaction | null = null;
	constructor(
		public socket: Socket,
		public readline: () => Promise<string | null>
	) {}
	write(input: Buffer | string, cb = () => {}) {
		this.socket.write(input, cb);
		return this;
	}
	writeln(line: string) {
		return this.write(String(line).concat('\r\n'));
	}
	end(cb?: () => void) {
		this.socket.end(cb);
		return this;
	}
	status(
		code: number,
		enhancedCode: [number, number, number],
		text?: string
	): SmtpResponse;
	status(code: number, text: string): SmtpResponse;
	status(code: number, enhancedCodeOrText: string | number[], text?: string) {
		let string = '';
		const normalizedCode = Number(code);
		if (Number.isNaN(normalizedCode))
			throw new TypeError('Invalid status code - Not a Number');
		if (normalizedCode < 200 || normalizedCode > 599)
			throw new TypeError('Invalid status code - out of range');

		if (Array.isArray(enhancedCodeOrText)) {
			// enhanced code
			if (enhancedCodeOrText.length < 3)
				throw new TypeError('Invalid enhanced status code - too few digits');
			if (enhancedCodeOrText.length > 3)
				throw new TypeError('Invalid enhanced status code - too many digits');

			const [firstDigit, secondDigit, thirdDigit] = enhancedCodeOrText.map(
				(x) => Math.trunc(Number(x))
			);

			if (
				Number.isNaN(firstDigit) ||
				Number.isNaN(secondDigit) ||
				Number.isNaN(thirdDigit)
			)
				throw new TypeError('Invalid status code - non-numbers found');

			if (firstDigit < 2 || firstDigit > 5)
				throw new TypeError('Invalid enhanced status code - exceeding ranges');

			if (String(firstDigit) !== String(code)[0])
				throw new TypeError(
					'Invalid enhanced status code - inconsistent with regular code'
				);

			if (text && typeof text !== 'string')
				throw new TypeError('Invalid status text - defined and not a string');

			const lines = (text ? text.split('\n') : []).map((text) =>
				text.replaceAll('\r', '')
			);
			const enhancedCode = enhancedCodeOrText.join('.');
			if (lines.length === 0) string += ' '.concat(enhancedCode, '\r\n');
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				string += String(normalizedCode);
				string += (i + 1 < lines.length ? '-' : ' ').concat(enhancedCode);
				if (line?.length > 0) string += ' '.concat(line);
				string += '\r\n';
			}
		} else if (typeof enhancedCodeOrText === 'string') {
			const lines = (enhancedCodeOrText?.split('\n') ?? []).map((text) =>
				text.replaceAll('\r', '')
			);
			if (lines.length === 0) string += ' '.concat(enhancedCodeOrText, '\r\n');
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				string += String(normalizedCode);
				string += i + 1 < lines.length ? '-' : ' ';
				if (line?.length > 0) string += line;
				string += '\r\n';
			}
		} else {
			throw new TypeError(
				'Invalid status line - neither a string nor an array'
			);
		}

		this.write(string);
		return this;
	}
	destroy(error?: Error) {
		this.socket.destroy(error);
		return this;
	}
}
