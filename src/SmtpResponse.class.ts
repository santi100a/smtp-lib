import type { Socket } from 'node:net';
import { MailTransaction } from './types';

/**
 * The base class for an SMTP response wrapper. It holds state variables and
 * exposes methods to communicate with the client. All methods return `this`,
 * so calls can be chained.
 */
export default class SmtpResponse {
	/**
	 * Whether the connection is currently encrypted with STARTTLS.
	 */
	encrypted: boolean = false;

	/**
	 * Whether a user is successfully authenticated.
	 */
	authenticated: boolean = false;

	/**
	 * What username a user is authenticated with.
	 */
	authenticatedAs: string = '';

	/**
	 * Whether EHLO or HELO have been received.
	 */
	helloDone: boolean = false;

	/**
	 * The hostname provided by the client in EHLO or HELO.
	 */
	clientHostname: string = '';

	/**
	 * Current mail transaction object. Is `null` if no transaction is in progress.
	 */
	mailTransaction: MailTransaction | null = null;

	/**
	 * Constructs a new SMTP response wrapper around a {@link Socket}.
	 * @param socket - The network socket that connects to the client.
	 * @param readline - An async, promise-based line reader function.
	 */
	constructor(
		public socket: Socket,
		public readline: () => Promise<string | null>
	) {}

	/**
	 * Writes a {@link Buffer} or string to the socket.
	 * @param input - Either a `Buffer` (raw bytes) or a string.
	 * @param cb - A callback that gets invoked when `input` is finally written.
	 */
	write(input: Buffer | string, cb = () => {}) {
		this.socket.write(input, cb);
		return this;
	}

	/**
	 * Writes a string to the socket, followed by CRLF.
	 * @param line - A line of text to send out.
	 */
	writeln(line: string) {
		return this.write(String(line).concat('\r\n'));
	}

	/**
	 * Close the SMTP connection.
	 * @param cb - A callback that gets invoked when the socket is closed successfully.
	 */
	end(cb?: () => void) {
		this.socket.end(cb);
		return this;
	}

	/**
	 * Sends out an ESMTP response (with enhanced status code).
	 * @param code - The response status code. MUST be 100 - 599 (RFC 5321, section 4.2).
	 * @param enhancedCode - The response's enhanced (RFC 3463) status code.
	 * MUST be a tuple (fixed-size array) of three positive integers, and its first digit
	 * MUST match the first digit of the plain `code`.
	 * @param text - The free-form text response area (may be multiline).
	 */
	status(
		code: number,
		enhancedCode: [number, number, number],
		text?: string
	): SmtpResponse;

	/**
	 * Sends out a plain SMTP response.
	 * @param code - The response status code. MUST be 100 - 599 (RFC 5321, section 4.2).
	 * @param text - The free-form text response area (may be multiline).
	 */
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
				(x) => Math.trunc(Math.abs(Number(x)))
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

	/**
	 * Immediately drop an SMTP connection.
	 * @param error - An optional error to emit in a socket event.
	 */
	destroy(error?: Error) {
		this.socket.destroy(error);
		return this;
	}
}
