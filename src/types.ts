import type { Socket } from 'node:net';
import type { SecureContextOptions } from 'node:tls';
import type SmtpResponse from './SmtpResponse.class';
import type SmtpServer from './SmtpServer.class';

/** Type that represents a value or a promise of a value. */
export type LoosePromise<T = unknown> = T | Promise<T>;

/** The data of a response, provided to {@link SmtpResponse.status()}. */
export interface ResponseData {
	/** The basic status code. MUST be between 200 and 599. */
	readonly statusCode?: number;

	/**
	 * The RFC 3463 enhanced status code. MUST be a tuple of three digits,
	 * and the first digit MUST be between 2 and 5, and match the first digit
	 * of the basic code. If provided, it will be used in the response.
	 */
	readonly enhancedCode?: [number, number, number];

	/** The custom free-form text for the response. May be multiline. */
	readonly text?: string;
}

export interface QueueAddResult extends ResponseData {
	readonly success: boolean;
}

/** The base interface for the output of filter functions. */
export interface FilterOutput extends ResponseData {
	/** Whether the filter permits the message, connection, etc. */
	readonly allow: boolean;
}

/** The interface for the output of the message filter. */
export interface MessageFilterOutput extends FilterOutput {
	/** The raw bytes of the modified message to be put back in the queue. */
	readonly revisedMessage?: Buffer;
}

/** The interface for server configurations. */
export interface ServerConfig {
	/**
	 * Generates and returns the banner text that immediately follows the domain name
	 * in the `220` banner string.
	 *
	 * @param socket - The `Socket` corresponding to this connection.
	 */
	generateBannerText(socket: Socket): string;

	/**
	 * Generates and returns the text that follows the domain name and precedes
	 * the second line of the response to the `EHLO` command.
	 *
	 * @param socket - The `Socket` corresponding to this connection.
	 * @param command - The {@link SmtpCommand} object that contains the parsed
	 * command parameters.
	 */
	generateEhloString(socket: Socket, command: SmtpCommand): string;

	/**
	 * Generates and returns the text that follows the domain name in
	 * the response to the `HELO` command.
	 *
	 * @param socket - The `Socket` corresponding to this connection.
	 * @param command - The {@link SmtpCommand} object that contains the parsed
	 * command and its parameters.
	 */
	generateHeloString(socket: Socket, command: SmtpCommand): string;

	/**
	 * Handles unhandled exceptions during initialization of the connection.
	 * It is recommended to implement a handler that looks like this:
	 * ```typescript
	 * handleInitError(socket, error) {
	 * 	socket.write('421 Cannot help you right now, closing connection\r\n');
	 * 	socket.end(); // or .destroy() if you want to be a bit more aggresive
	 *
	 * 	// Log your error or do something with it
	 * 	console.error(`Init error for ${socket.remoteAddress}:`, error);
	 * }
	 * ```
	 * @param socket - The `Socket` corresponding to this connection.
	 * @param error - The unhandled error that triggered this response.
	 */
	handleInitError(socket: Socket, error: Error): unknown;

	/**
	 * Handles unhandled exceptions during the execution of a command.
	 * It is recommended to implement a handler that looks like this:
	 * ```typescript
	 * handleInternalError(socket, error, command, response) {
	 * 	socket.write('451 4.3.0 I was unable to do that\r\n');
	 *
	 * 	// Log your error or do something with it
	 * 	console.error(`Error for ${socket.remoteAddress} (${command.raw}):`, error);
	 * }
	 * ```
	 * @param socket - The `Socket` corresponding to this connection.
	 * @param error - The unhandled error that triggered this response.
	 * @param command - The {@link SmtpCommand} object that contains the parsed
	 * command and its parameters.
	 * @param response - The {@link SmtpResponse} object that is being used to send
	 * responses and track the internal state of the session.
	 */
	handleInternalError(
		socket: Socket,
		error: Error,
		command: SmtpCommand,
		response: SmtpResponse
	): unknown;

	/**
	 * Filter the email addresses provided to the `MAIL FROM` command.
	 *
	 * @param address - The parsed address given to the server via `MAIL FROM`.
	 * @param response - The {@link SmtpResponse} object used for this session.
	 *
	 * **This function is expected to return a {@link FilterOutput} or
	 * a {@link Promise} of one - you should only use `response` for reading
	 * connection state.**
	 */
	handleMailFrom(
		address: string,
		response: SmtpResponse
	): LoosePromise<FilterOutput>;

	/**
	 * Filter the email addresses provided to the `RCPT TO` command.
	 *
	 * @param address - The parsed address given to the server via `RCPT TO`.
	 * @param response - The {@link SmtpResponse} object used for this session.
	 *
	 * **This function is expected to return a {@link FilterOutput} or
	 * a {@link Promise} of one - you should only use `response` for reading
	 * connection state.**
	 */
	handleRcptTo(
		address: string,
		response: SmtpResponse
	): LoosePromise<FilterOutput>;

	/**
	 * Returns the text that immediately follows the 214 status code and
	 * immediately precedes the second line in the response to the `HELP` command.
	 *
	 * @param command - The {@link SmtpCommand} object that contains the parsed
	 * command and its parameters.
	 * @param response - The {@link SmtpResponse} object used for this session.
	 *
	 * **This function is expected to return a string - you should only
	 * use `response` for reading connection state.**
	 */
	generateHelpPreamble(command: SmtpCommand, response: SmtpResponse): string;

	/**
	 * Returns the text that immediately follows the `221 2.0.0` status codes in
	 * the response to the `QUIT` command.
	 *
	 * @param command - The {@link SmtpCommand} object that contains the parsed
	 * command and its parameters.
	 * @param response - The {@link SmtpResponse} object used for this session.
	 *
	 * **This function is expected to return a string - you should only
	 * use `response` for reading connection state.**
	 */
	generateQuitString(command: SmtpCommand, response: SmtpResponse): string;

	/**
	 * Handles commands with no registered handler. Use the `command` parameter
	 * to read the command and its parameters, and `response` to send the response
	 * back to the client.
	 */
	unknownCommandHandler: CommandHandler;

	/**
	 * Returns the text that immediately follows the `250 2.1.0` code in the response
	 * to the `MAIL FROM` command in case no filter is registered or the filter does
	 * not return any text.
	 *
	 * @param command - The {@link SmtpCommand} object that contains the parsed
	 * command and its parameters.
	 * @param response - The {@link SmtpResponse} object used for this session.
	 */
	generateMailAcceptedString(
		command: SmtpCommand,
		response: SmtpResponse
	): string;

	/**
	 * Returns the text that immediately follows the `250 2.1.5` code in the response
	 * to the `RCPT TO` command in case no filter is registered or the filter does
	 * not return any text.
	 *
	 * @param command - The {@link SmtpCommand} object that contains the parsed
	 * command and its parameters.
	 * @param response - The {@link SmtpResponse} object used for this session.
	 */
	generateRcptAcceptedString(
		command: SmtpCommand,
		response: SmtpResponse
	): string;

	/**
	 * Returns the text that immediately follows the `354` code in the response
	 * to the `DATA` command in case no filter is registered or the filter does
	 * not return any text.
	 *
	 * @param command - The {@link SmtpCommand} object that contains the parsed
	 * command and its parameters.
	 * @param response - The {@link SmtpResponse} object used for this session.
	 */
	generateDataPromptString(
		command: SmtpCommand,
		response: SmtpResponse
	): string;

	/**
	 * Returns the text that immediately follows the `250 2.1.0` code in the response
	 * to the `DATA` command in case no filter is registered or the filter does
	 * not return any text.
	 *
	 * @param command - The {@link SmtpCommand} object that contains the parsed
	 * command and its parameters.
	 * @param response - The {@link SmtpResponse} object used for this session.
	 */
	generateDataAcceptedString(
		command: SmtpCommand,
		response: SmtpResponse
	): string;

	/**
	 * Returns the text that immediately follows the `334` code in the response
	 * to the `AUTH` command.
	 *
	 * @param type - The type of authentication prompt to generate.
	 * @param response - The {@link SmtpResponse} object used for this session.
	 */
	generateAuthPromptString(
		type: 'USERNAME' | 'PASSWORD',
		response: SmtpResponse
	): string;

	/**
	 * Returns the text that immediately follows the `235 2.7.0` code in the response
	 * to the `AUTH` command in case authentication is successful.
	 *
	 * @param command - The {@link SmtpCommand} object that contains the parsed
	 * command and its parameters.
	 * @param response - The {@link SmtpResponse} object used for this session.
	 */
	generateAuthSuccessString(
		command: SmtpCommand,
		response: SmtpResponse
	): string;

	/**
	 * Returns the text that immediately follows the `535 5.7.8` code in the response
	 * to the `AUTH` command in case authentication fails.
	 *
	 * @param command - The {@link SmtpCommand} object that contains the parsed
	 * command and its parameters.
	 * @param response - The {@link SmtpResponse} object used for this session.
	 */
	generateAuthFailedString(
		command: SmtpCommand,
		response: SmtpResponse
	): string;

	/**
	 * Returns the text that immediately follows the `250 2.0.0` code in the response
	 * to the `NOOP` command.
	 *
	 * @param command - The {@link SmtpCommand} object that contains the parsed
	 * command and its parameters.
	 * @param response - The {@link SmtpResponse} object used for this session.
	 */
	generateNoopString(command: SmtpCommand, response: SmtpResponse): string;

	/**
	 * Returns the text that immediately follows the `250 2.0.0` code in the response
	 * to the `RSET` command.
	 *
	 * @param command - The {@link SmtpCommand} object that contains the parsed
	 * command and its parameters.
	 * @param response - The {@link SmtpResponse} object used for this session.
	 */
	generateRsetString(command: SmtpCommand, response: SmtpResponse): string;

	/**
	 * Returns the text that immediately follows the `252 2.1.5` code in the
	 * response to the `VRFY` command, which is handled by a default stub that
	 * always returns a "cannot verify user" response. Override it with
	 * {@link SmtpServer.setHandler()} to implement your own verification logic.
	 *
	 * @param command - The {@link SmtpCommand} object that contains the parsed
	 * command and its parameters.
	 * @param response - The {@link SmtpResponse} object used for this session.
	 */
	generateVrfyString(command: SmtpCommand, response: SmtpResponse): string;

	/**
	 * Returns the text that immediately follows the `220 2.0.0` code in the
	 * response to the `STARTTLS` command.
	 *
	 * @param command - The {@link SmtpCommand} object that contains the parsed
	 * command and its parameters.
	 * @param response - The {@link SmtpResponse} object used for this session.
	 */
	generateStartTlsPromptString(
		command: SmtpCommand,
		response: SmtpResponse
	): string;

	/**
	 * Returns the text that immediately follows the `503 5.5.1` code in the
	 * response to the `STARTTLS` command when TLS is already enabled.
	 *
	 * @param command - The {@link SmtpCommand} object that contains the parsed
	 * command and its parameters.
	 * @param response - The {@link SmtpResponse} object used for this session.
	 */
	generateStartTlsAlreadyEncrypted(
		command: SmtpCommand,
		response: SmtpResponse
	): string;

	/**
	 * Returns the text that immediately follows the `503 5.5.1` code in the
	 * response to the `STARTTLS` command when encryption is disabled by setting
	 * `SmtpServer.startTls` to `false`.
	 *
	 * @param command - The {@link SmtpCommand} object that contains the parsed
	 * command and its parameters.
	 * @param response - The {@link SmtpResponse} object used for this session.
	 */
	generateStartTlsDisabled(
		command: SmtpCommand,
		response: SmtpResponse
	): string;

	/**
	 * Returns the text that immediately follows the `501 5.5.2` code in the
	 * response to the `AUTH` command when credentials are malformed.
	 *
	 * @param command - The {@link SmtpCommand} object that contains the parsed
	 * command and its parameters.
	 * @param response - The {@link SmtpResponse} object used for this session.
	 */
	generateMalformedAuthString(
		command: SmtpCommand,
		response: SmtpResponse
	): string;

	/**
	 * Returns the text that immediately follows the `504 5.7.4` code in the
	 * response to the `AUTH` command when an unknown authentication method is used.
	 *
	 * @param command - The {@link SmtpCommand} object that contains the parsed
	 * command and its parameters.
	 * @param response - The {@link SmtpResponse} object used for this session.
	 */
	generateUnknownAuthMethodString(
		command: SmtpCommand,
		response: SmtpResponse
	): string;

	/**
	 * Returns the text that immediately follows the `503 5.5.1` code in the
	 * response to all commands (except `EHLO`, `HELO`, `HELP`, `VRFY`, `EXPN`,
	 * `NOOP`, `RSET` and `QUIT`) when the client has not sent
	 * an `EHLO` command yet.
	 *
	 * @param command - The {@link SmtpCommand} object that contains the parsed
	 * command and its parameters.
	 * @param response - The {@link SmtpResponse} object used for this session.
	 */
	generateEhloRequiredString(
		command: SmtpCommand,
		response: SmtpResponse
	): string;

	/**
	 * Returns the text that immediately follows the `501 5.4.4` code in the
	 * response to the `EHLO` command when no argument is provided.
	 *
	 * @param command - The {@link SmtpCommand} object that contains the parsed
	 * command and its parameters.
	 * @param response - The {@link SmtpResponse} object used for this session.
	 */
	generateEhloArgumentMissing(
		command: SmtpCommand,
		response: SmtpResponse
	): string;

	/**
	 * Returns the text that immediately follows the `501 5.4.4` code in the
	 * response to the `HELO` command when no argument is provided.
	 *
	 * @param command - The {@link SmtpCommand} object that contains the parsed
	 * command and its parameters.
	 * @param response - The {@link SmtpResponse} object used for this session.
	 */
	generateHeloArgumentMissing(
		command: SmtpCommand,
		response: SmtpResponse
	): string;

	/**
	 * Returns the text that immediately follows the `503 5.1.1` code in the
	 * response to any command specified in the `SmtpServer.config.authRequired`
	 * array if it is issued before successful authentication.
	 *
	 * @param command - The {@link SmtpCommand} object that contains the parsed
	 * command and its parameters.
	 * @param response - The {@link SmtpResponse} object used for this session.
	 */
	generateAuthRequiredString(
		command: SmtpCommand,
		response: SmtpResponse
	): string;

	/**
	 * Returns the text that immediately follows the `451 4.4.2` code in the
	 * response sent when the server times out waiting for client input or commands.
	 *
	 * @param command - The {@link SmtpCommand} object that contains the parsed
	 * command and its parameters.
	 * @param response - The {@link SmtpResponse} object used for this session.
	 */
	generateServerTimeoutString(
		command: SmtpCommand,
		response: SmtpResponse
	): string;

	/**
	 * Returns the text that immediately follows the `421 4.3.0` code in the
	 * response sent when the server is shutting down.
	 *
	 * @param socket - The {@link Socket} object representing the client connection.
	 */
	shutdownCloseString(socket: Socket): string;

	/**
	 * Returns the text that immediately follows the `501 5.4.4` code in the
	 * response to any command that does not accept parameters (like `HELP` or `QUIT`).
	 *
	 * @param command - The {@link SmtpCommand} object that contains the parsed
	 * command and its parameters.
	 * @param response - The {@link SmtpResponse} object used for this session.
	 */
	generateNoParamsString(command: SmtpCommand, response: SmtpResponse): string;

	/**
	 * Returns the text that immediately follows the `553 5.1.3` code in the
	 * response to the `RCPT TO` command when the recipient address is empty.
	 *
	 * @param command - The {@link SmtpCommand} object that contains the parsed
	 * command and its parameters.
	 * @param response - The {@link SmtpResponse} object used for this session.
	 */
	emptyRecipientAddressString(
		command: SmtpCommand,
		response: SmtpResponse
	): string;

	/**
	 * Returns the text that immediately follows the `553 5.1.3` code in the
	 * response to the `RCPT TO` command when the recipient address is invalid.
	 *
	 * @param command - The {@link SmtpCommand} object that contains the parsed
	 * command and its parameters.
	 * @param response - The {@link SmtpResponse} object used for this session.
	 */
	generateInvalidFromString(
		command: SmtpCommand,
		response: SmtpResponse
	): string;

	/**
	 * Returns the text that immediately follows the `553 5.1.3` code in the
	 * response to the `RCPT TO` command when the recipient address is invalid.
	 *
	 * @param command - The {@link SmtpCommand} object that contains the parsed
	 * command and its parameters.
	 * @param response - The {@link SmtpResponse} object used for this session.
	 */
	invalidRecipientAddressString(
		command: SmtpCommand,
		response: SmtpResponse
	): string;

	/**
	 * Returns the text that immediately follows the `555 5.5.2` code in the
	 * response to the `MAIL` command if the second keyword is not `FROM`.
	 *
	 * @param command - The {@link SmtpCommand} object that contains the parsed
	 * command and its parameters.
	 * @param response - The {@link SmtpResponse} object used for this session.
	 */
	onlyMailFromString(command: SmtpCommand, response: SmtpResponse): string;

	/**
	 * Returns the text that immediately follows the `555 5.5.2` code in the
	 * response to the `RCPT` command if the second keyword is not `TO`.
	 *
	 * @param command - The {@link SmtpCommand} object that contains the parsed
	 * command and its parameters.
	 * @param response - The {@link SmtpResponse} object used for this session.
	 */
	onlyRcptToString(command: SmtpCommand, response: SmtpResponse): string;

	/**
	 * Returns the text that immediately follows the `503 5.5.1` code in the
	 * response to the `RCPT` or `DATA` commands if there is no mail transaction
	 * in progress.
	 *
	 * @param command - The {@link SmtpCommand} object that contains the parsed
	 * command and its parameters.
	 * @param response - The {@link SmtpResponse} object used for this session.
	 */
	generateNoTransactionString(
		command: SmtpCommand,
		response: SmtpResponse
	): string;

	/**
	 * Returns the text that immediately follows the `502 5.5.1` code in the
	 * response to a command if a default stub for unimplemented commands is
	 * still set as command handler (e.g. `AUTH` or `EXPN`).
	 *
	 * @param command - The {@link SmtpCommand} object that contains the parsed
	 * command and its parameters.
	 * @param response - The {@link SmtpResponse} object used for this session.
	 */
	generateUnimplementedString(
		command: SmtpCommand,
		response: SmtpResponse
	): string;

	/**
	 * Returns the text that immediately follows the `552` code in the
	 * response sent during transmission with the `DATA` command if the input
	 * exceeds twice the maximum size allowed by the server
	 * (set with `SmtpServer.config.maxSize`).
	 *
	 * @param command - The {@link SmtpCommand} object that contains the parsed
	 * command and its parameters.
	 * @param response - The {@link SmtpResponse} object used for this session.
	 */
	hardLimitString(command: SmtpCommand, response: SmtpResponse): string;

	/**
	 * Returns the text that immediately follows the `552` code in the
	 * response sent during transmission with the `DATA` command if the input
	 * exceeds the maximum size allowed by the server (set with
	 * `SmtpServer.config.maxSize`).
	 *
	 * @param command - The {@link SmtpCommand} object that contains the parsed
	 * command and its parameters.
	 * @param response - The {@link SmtpResponse} object used for this session.
	 * @param msgBuffer - The raw bytes of the message that was rejected due to size.
	 */
	tooMuchDataString(
		command: SmtpCommand,
		response: SmtpResponse,
		msgBuffer: Buffer
	): string;

	/**
	 * Returns the text that immediately follows the `503 5.5.1` code in the
	 * response to the `RCPT` command if no recipients have been added to the
	 * mail transaction.
	 *
	 * @param command - The {@link SmtpCommand} object that contains the parsed
	 * command and its parameters.
	 * @param response - The {@link SmtpResponse} object used for this session.
	 */
	noRecipientsString(command: SmtpCommand, response: SmtpResponse): string;

	/**
	 * Filters the client connection before any commands are processed.
	 * This can be used to implement IP-based access control, for example.
	 *
	 * **This function is expected to return a {@link FilterOutput} or
	 * a {@link Promise} of one - you should only use `socket` for reading
	 * 	client info, like the IP address.**
	 *
	 * @param socket - The `Socket` corresponding to this connection.
	 */
	filterClient(socket: Socket): LoosePromise<FilterOutput>;

	/**
	 * Filters the message after it has been received, but before it is added
	 * to the mail queue. This can be used to implement content-based filtering
	 * or modify headers, for example.
	 *
	 * **This function is expected to return a {@link MessageFilterOutput} or
	 * a {@link Promise} of one - you should only use `response` for reading
	 * connection state.**
	 *
	 * @param message - The raw bytes of the message that was received.
	 * @param response - The {@link SmtpResponse} object used for this session.
	 */
	filterMessage(message: Buffer): LoosePromise<MessageFilterOutput>;

	/**
	 * Options for the secure context used for TLS connections.
	 * Must conform to the {@link SecureContextOptions} of `node:tls` if provided.
	 * The server will throw an error if this is unset and
	 * `SmtpServer.config.startTls` is `true`.
	 */
	secureContextOptions?: SecureContextOptions;

	/**
	 * The hostname of the server, used in the banner, `EHLO` and `HELO` responses,
	 * and closing connection response.
	 */
	hostname: string;

	/**
	 * The types of authentication the server supports (default is `PLAIN` and `LOGIN`).
	 *
	 * **NOTE: If you specify other methods, you must implement the corresponding
	 * authentication logic by overriding the default `AUTH` handler.**
	 */
	authTypes: string[];

	/** Whether the server should advertise support for the `8BITMIME` extension. */
	eightBitMime: boolean;

	/** Whether the server should advertise support for the `BINARYMIME` extension. */
	binaryMime: boolean;

	/** Whether the server should advertise support for the `SMTPUTF8` extension. */
	smtpUtf8: boolean;

	/** Whether the server should advertise support for the `STARTTLS` extension. */
	startTls: boolean;

	/** The maximum size of the message in bytes. */
	maxSize?: number;

	/**
	 * Whether the server should allow unencrypted authentication
	 * (i.e. `AUTH` before `STARTTLS`).
	 * */
	unencryptedAuth: boolean;

	/**
	 * The list of commands that require authentication before they can be executed.
	 * Some commands do not enforce this by default, because it would violate RFC 5321.
	 */
	authRequired: string[];

	/** The timeout for the SMTP server while waiting for input in milliseconds. */
	serverTimeout: number;

	/**
	 * The queue for managing mail transactions.
	 * Must conform to the {@link Queue} interface.
	 */
	mailQueue: Queue<MailTransaction>;
}

/** The interface for a mail transaction. */
export interface MailTransaction {
	/**
	 * The sender of the message
	 * (`null` if it is not received yet, empty string if empty).
	 */
	from: string | null;

	/** The recipients of the message. */
	to: Set<string>;

	/** The data of the message (`null` if not received yet). */
	data: Buffer | null;
}

/** The interface for an SMTP command. */
export interface SmtpCommand {
	/** The normalized command name (`null` if the line is empty). */
	readonly command: string | null;

	/** The parameters for the command. */
	readonly params: string[];

	/** The raw command string. */
	readonly raw: string;
}

/** The function type for an SMTP command handler. */
export type CommandHandler = (
	command: SmtpCommand,
	response: SmtpResponse
) => unknown;

/** The interface for a minimal mail queue. */
export interface Queue<T> {
	/**
	 * Adds an item to the queue.
	 */
	add(item: T): LoosePromise<QueueAddResult>;

	/**
	 * Removes and returns the first item from the queue,
	 * or `undefined` if the queue is empty.
	 */
	remove(): LoosePromise<T | undefined>;
	[index: number | string | symbol]: any;
}
