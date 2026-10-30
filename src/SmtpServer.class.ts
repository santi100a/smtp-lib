import { Server, type Socket } from 'node:net';
import { createSecureContext, TLSSocket } from 'node:tls';
import { createLineReader } from './libreadline';
import parseCommand = require('./libparse');
import { ServerConfig, CommandHandler, SmtpCommand } from './types';
import SmtpResponse from './SmtpResponse.class';
import defaultConfig from './defaultConfig';

export const emailRegex =
	/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * The base class for an SMTP {@link Server}.
 */
export default class SmtpServer extends Server {
	/**
	 * The internal configuration object for the server.
	 */
	private readonly config: ServerConfig;

	/**
	 * A {@link Set} of {@link Socket} objects, corresponding to all
	 * currently open connections to the server.
	 */
	readonly connectedSockets: Set<Socket> = new Set();

	/**
	 * The internal handler for AUTH LOGIN and AUTH PLAIN (basic auth).
	 */
	private __basicAuthHandler = (
		usernameBuffer: Buffer,
		passwordBuffer: Buffer,
		command: SmtpCommand,
		response: SmtpResponse
	) => {
		response.status(
			552,
			[5, 5, 1],
			this.config.generateUnimplementedString?.(command, response) ??
				'Unimplemented.'
		);
		return false;
	};

	/**
	 * The internal command handlers object. It maps command names to
	 * functions that MUST conform to the {@link CommandHandler} type.
	 */
	private readonly __commandHandlers: Record<string, CommandHandler> = {
		QUIT: (command, response) => {
			if (command.params.length > 0)
				return response.status(
					501,
					[5, 5, 4],
					this.config.generateNoParamsString?.(command, response) ??
						'QUIT does not accept parameters.'
				);

			return response
				.status(
					221,
					[2, 0, 0],
					`${this.config.hostname} ${this.config.generateQuitString?.(command, response) ?? 'closing connection.'}`
				)
				.end();
		},
		HELO: (command, response) => {
			if (command.params.length < 1) {
				return response.status(
					501,
					[5, 4, 4],
					this.config.generateEhloArgumentMissing?.(command, response) ??
						'HELO argument missing.'
				);
			}
			let line = '';
			if (this.config.hostname) line += this.config.hostname;
			if (this.config.generateHeloString)
				line += ' '.concat(
					this.config.generateHeloString(response.socket, command)
				);
			response.clientHostname = command.params.join(' ');
			response.helloDone = true;
			return response.status(250, line);
		},
		EHLO: (command, response) => {
			if (command.params.length < 1) {
				return response.status(
					501,
					[5, 4, 4],
					this.config.generateEhloArgumentMissing?.(command, response) ??
						'EHLO argument missing.'
				);
			}
			let ehloLines = [];
			let firstLine = '';
			response.mailTransaction = null; // RFC 5321, section 4.1.4

			if (this.config.hostname) firstLine += this.config.hostname;
			if (this.config.generateEhloString)
				firstLine += ' '.concat(
					this.config.generateEhloString(response.socket, command)
				);

			ehloLines.push(firstLine, `SIZE ${this.config.maxSize}`);
			if (this.config.startTls) ehloLines.push('STARTTLS');
			if (this.config.smtpUtf8) ehloLines.push('SMTPUTF8');
			if (this.config.eightBitMime) ehloLines.push('8BITMIME');
			if (this.config.binaryMime) ehloLines.push('BINARYMIME');

			ehloLines.push('ENHANCEDSTATUSCODES', 'PIPELINING'); // unconditional

			if (
				this.config.authTypes?.length > 0 &&
				(this.config.unencryptedAuth ? !response.encrypted : response.encrypted)
			)
				ehloLines.push('AUTH '.concat(this.config.authTypes.join(' ')));

			response.clientHostname = command.params.join(' ');
			response.helloDone = true;
			return response.status(250, ehloLines.join('\n'));
		},
		HELP: (command, response) => {
			if (command.params.length > 0) {
				return response.status(
					501,
					this.config.generateNoParamsString?.(command, response) ??
						'HELP does not accept parameters.'
				);
			}
			if (!response.authenticated && this.config.authRequired?.includes('HELP'))
				return response.status(
					503,
					[5, 1, 1],
					this.config.generateAuthRequiredString?.(command, response) ??
						'Auth required.'
				);

			response.status(
				214,
				`${this.config.generateHelpPreamble?.(command, response) ?? 'Commands:'}\n${Object.keys(this.__commandHandlers).join(' ')}`
			);
		},
		VRFY: (command, response) =>
			response.status(
				252,
				[2, 1, 5],
				this.config.generateVrfyString?.(command, response) ??
					'Cannot VRFY user.'
			),

		STARTTLS: async (command, response) => {
			if (response.encrypted)
				return response.status(
					503,
					[5, 5, 1],
					this.config.generateStartTlsAlreadyEncrypted?.(command, response) ??
						'Already encrypted.'
				);
			if (!this.config.startTls)
				return response.status(
					502,
					[5, 5, 1],
					this.config.generateStartTlsDisabled?.(command, response) ??
						'Disabled.'
				);

			response.status(
				220,
				[2, 0, 0],
				this.config.generateStartTlsPromptString?.(command, response) ??
					'Go ahead - start TLS.'
			);

			const secureContext = createSecureContext(
				this.config.secureContextOptions
			);
			const upgradedSocket = new TLSSocket(response.socket, {
				isServer: true,
				secureContext
			});
			if (response.socket.writableLength > 0)
				await new Promise((resolve) => response.socket.once('drain', resolve));

			return { upgradedSocket };
		},

		NOOP: (command, response) =>
			response.status(
				250,
				[2, 0, 0],
				this.config.generateNoopString?.(command, response) ??
					'Nothing happens.'
			),

		RSET: (command, response) => {
			response.mailTransaction = null;
			response.status(
				250,
				[2, 0, 0],
				this.config.generateRsetString?.(command, response) ?? 'Clean slate.'
			);
		},
		EXPN: (command, response) =>
			response.status(
				502,
				[5, 5, 1],
				this.config.generateUnimplementedString?.(command, response) ??
					'Unimplemented.'
			),
		MAIL: (command, response) => {
			const [, address] = command.params;
			if (command.params[0] !== 'FROM')
				return response.status(
					555,
					[5, 5, 2],
					this.config.onlyMailFromString?.(command, response) ??
						'Only MAIL FROM accepted.'
				);
			if (!response.helloDone)
				return response.status(
					503,
					[5, 5, 1],
					this.config.generateEhloRequiredString?.(command, response) ??
						'Say hello first! (EHLO/HELO).'
				);
			if (!response.authenticated && this.config.authRequired?.includes('MAIL'))
				return response.status(
					503,
					[5, 1, 1],
					this.config.generateAuthRequiredString?.(command, response) ??
						'Auth required.'
				);
			if (address.length === 0)
				response.mailTransaction = { from: '', to: new Set(), data: null };
			else if (!emailRegex.test(address))
				return response.status(
					555,
					[5, 5, 2],
					this.config.generateInvalidFromString?.(command, response) ??
						'Invalid FROM address.'
				);

			const { text, statusCode, enhancedCode, allow } =
				this.config.handleMailFrom(address, response);
			if (allow)
				return response.status(
					statusCode ?? 250,
					enhancedCode ?? [2, 1, 0],
					text ??
						this.config.generateMailAcceptedString?.(command, response) ??
						'Sender accepted.'
				);

			return response.status(
				statusCode ?? 550,
				enhancedCode ?? [5, 0, 0],
				text ?? 'Sender not accepted.'
			);
		},
		RCPT: (command, response) => {
			const [, address] = command.params;
			if (command.params[0] !== 'TO')
				return response.status(
					555,
					[5, 5, 2],
					this.config.onlyRcptToString?.(command, response) ??
						'Only RCPT TO accepted.'
				);
			if (!response.helloDone)
				return response.status(
					503,
					[5, 5, 1],
					this.config.generateEhloRequiredString?.(command, response) ??
						'Say hello first! (EHLO/HELO).'
				);
			if (!response.mailTransaction)
				return response.status(
					503,
					[5, 5, 1],
					this.config.generateNoTransactionString?.(command, response) ??
						'Start transaction with MAIL FROM first.'
				);
			if (!response.authenticated && this.config.authRequired?.includes('RCPT'))
				return response.status(
					503,
					[5, 1, 1],
					this.config.generateAuthRequiredString?.(command, response) ??
						'Auth required.'
				);

			if (address.length === 0) {
				return response.status(
					555,
					[5, 5, 2],
					this.config.emptyRecipientAddressString?.(command, response) ??
						'Empty recipient address.'
				);
			}
			if (!emailRegex.test(address))
				return response.status(
					555,
					[5, 5, 2],
					this.config.invalidRecipientAddressString?.(command, response) ??
						'Invalid recipient address.'
				);

			const { text, statusCode, enhancedCode, allow } =
				this.config.handleMailFrom(address, response);
			if (allow) {
				// Push the valid recipient into the transaction array
				response.mailTransaction.to.add(address);
				return response.status(
					statusCode ?? 250,
					enhancedCode ?? [2, 1, 5],
					text ??
						this.config.generateRcptAcceptedString?.(command, response) ??
						'Sender accepted.'
				);
			}
			return response.status(
				statusCode ?? 550,
				enhancedCode ?? [5, 0, 0],
				text ?? 'Sender not accepted.'
			);
		},
		DATA: async (command, response) => {
			if (command.params.length > 0)
				return response.status(
					501,
					this.config.generateNoParamsString?.(command, response) ??
						'DATA does not accept parameters.'
				);
			if (!response.authenticated && this.config.authRequired?.includes('DATA'))
				return response.status(
					503,
					[5, 1, 1],
					this.config.generateAuthRequiredString?.(command, response) ??
						'Auth required.'
				);
			if (!response.mailTransaction)
				return response.status(
					503,
					[5, 5, 1],
					this.config.generateNoTransactionString?.(command, response) ??
						'No mail transaction in progress.'
				);
			if (response.mailTransaction.to?.size === 0)
				return response.status(
					503,
					[5, 5, 1],
					this.config.noRecipientsString?.(command, response) ??
						'No recipients.'
				);

			// 1. Send the 354 prompt telling the client to start sending data
			response.status(
				354,
				this.config.generateDataPromptString?.(command, response) ??
					'Go ahead! End with <CRLF>.<CRLF>'
			);

			const lines: string[] = [];
			let size = 0;

			while (true) {
				const line = await response.readline();
				if (line === null) {
					return; // Connection dropped mid-data
				}

				// 3. The data termination marker is a single dot '.'
				if (line === '.') {
					break;
				}

				// Handle dot-stuffing (RFC 5321 Section 4.5.2: if line starts with '..', un-stuff it to '.')
				const cleanLine = line.startsWith('..') ? line.substring(1) : line;
				size += Buffer.byteLength(cleanLine, 'utf8');
				if (size >= 2 * Number(this.config.maxSize)) {
					return response
						.status(
							552,
							this.config.hardLimitString?.(command, response) ??
								'Hard limit exceeded! Closing connection.'
						)
						.destroy();
				}
				lines.push(cleanLine);
			}

			if (size > Number(this.config.maxSize))
				return response.status(
					552,
					this.config.tooMuchDataString?.(
						command,
						response,
						Buffer.from(lines.join('\r\n'), 'utf-8')
					) ?? 'Too much mail data.'
				);

			// Combine lines into a final Buffer
			const buffer = Buffer.from(lines.join('\r\n'), 'utf-8');
			const filterOutput = this.config.filterMessage(buffer);
			if (filterOutput.allow) {
				response.mailTransaction.data = filterOutput.revisedMessage ?? buffer;
				this.config.mailQueue.add(response.mailTransaction);
				response.mailTransaction = null; // State reset after DATA
				return response.status(
					250,
					[2, 0, 0],
					this.config.generateDataAcceptedString?.(command, response) ??
						'Message accepted!'
				);
			} else {
				response.mailTransaction = null; // State reset after DATA
				return response.status(
					filterOutput.statusCode ?? 451,
					filterOutput.enhancedCode ?? [4, 0, 0],
					filterOutput.text ?? 'Message rejected.'
				);
			}
		},

		AUTH: async (command, response) => {
			if (!response.helloDone)
				return response.status(
					503,
					[5, 5, 1],
					this.config.generateEhloRequiredString?.(command, response) ??
						'Say hello first! (EHLO/HELO).'
				);
			const [authType, string] = command.params;
			if (authType === 'PLAIN') {
				const b64decode = (text: string) => Buffer.from(text, 'base64');
				if (!string) response.status(334, '=');
				const authLine = string ?? (await response.readline());
				if (authLine === null) return;

				const decodedString = b64decode(authLine).toString('utf8');
				const parts = decodedString.split('\0');
				if (parts.length !== 3)
					return response.status(
						501,
						[5, 5, 2],
						this.config.generateMalformedAuthString?.(command, response) ??
							'Malformed auth string.'
					);
				const [, username, password] = parts;
				const authenticated = this.__basicAuthHandler(
					Buffer.from(username),
					Buffer.from(password),
					command,
					response
				);
				if (authenticated) {
					response.authenticated = true;
					response.authenticatedAs = username;
					return response.status(
						235,
						[2, 7, 0],
						this.config.generateAuthSuccessString?.(command, response) ??
							'Accepted! Welcome'
					);
				} else {
					return response.status(
						535,
						[5, 7, 8],
						this.config.generateAuthFailedString?.(command, response) ??
							'Auth failed.'
					);
				}
			} else if (authType === 'LOGIN') {
				const b64decode = (text: string) => Buffer.from(text, 'base64');

				let usernameLine: string | null = string;
				if (!usernameLine) {
					const prompt =
						this.config.generateAuthPromptString?.('USERNAME', response) ??
						'Username:';
					response.status(334, Buffer.from(prompt).toString('base64'));
					usernameLine = await response.readline();
					if (usernameLine === null) return;
				}

				const passPrompt =
					this.config.generateAuthPromptString?.('PASSWORD', response) ??
					'Password:';
				response.status(334, Buffer.from(passPrompt).toString('base64'));
				const passwordLine = await response.readline();
				if (passwordLine === null) return;
				const authenticated = this.__basicAuthHandler(
					b64decode(usernameLine),
					b64decode(passwordLine),
					command,
					response
				);
				if (authenticated) {
					response.authenticated = true;
					response.authenticatedAs = b64decode(usernameLine).toString();
					return response.status(
						235,
						[2, 7, 0],
						this.config.generateAuthSuccessString?.(command, response) ??
							'Accepted! Welcome'
					);
				} else {
					return response.status(
						535,
						[5, 7, 8],
						this.config.generateAuthFailedString?.(command, response) ??
							'Auth failed.'
					);
				}
			} else
				return response.status(
					504,
					[5, 7, 4],
					this.config.generateUnknownAuthMethodString?.(command, response) ??
						'Method unknown.'
				);
		}
	};

	/**
	 * The constructor for the SMTP server instance.
	 * @param config - The server configuration object. Must conform
	 * to {@link ServerConfig}, except that configurations may be omitted,
	 * in which case the defaults will be used.
	 */
	constructor(config: Partial<ServerConfig> = {}) {
		const mergedConfig: ServerConfig = {
			...defaultConfig,
			...config,
			secureContextOptions: {
				...defaultConfig.secureContextOptions,
				...config.secureContextOptions
			}
		};
		super(async (socket) => {
			this.connectedSockets.add(socket);
			socket.on('end', () => {
				this.connectedSockets.delete(socket);
			});
			try {
				let readline = createLineReader(socket);
				let bannerString = '';
				if (mergedConfig.hostname) bannerString += mergedConfig.hostname;
				const bannerText = mergedConfig.generateBannerText(socket);
				if (bannerText) bannerString += ' '.concat(bannerText);
				else bannerString += 'ESMTP';
				const response = new SmtpResponse(socket, readline);
				const filterOutput = this.config.filterClient(socket);
				if (filterOutput.allow) response.status(220, bannerString);
				else {
					response
						.status(
							filterOutput.statusCode ?? 421,
							filterOutput.enhancedCode ?? [4, 0, 0],
							filterOutput.text ??
								'Cannot serve you right now. Closing connection.'
						)
						.end();
				}
				// Configure timeout and listener once per socket
				response.socket.setTimeout(mergedConfig.serverTimeout);
				response.socket.on('timeout', () => {
					return response
						.status(
							451,
							[4, 4, 2],
							mergedConfig.generateServerTimeoutString?.(
								{ command: null, params: [] },
								response
							) ?? 'Command timeout! Closing connection.'
						)
						.end();
				});
				while (true) {
					const line = await readline();
					if (line === null) break;
					const commandObject = parseCommand(line);
					if (commandObject.command === null) continue;

					const handler = this.__commandHandlers[commandObject.command];
					try {
						if (!handler) {
							this.config.unknownCommandHandler(commandObject, response);
							continue;
						}
						const result = await handler(commandObject, response);
						const upgradedSocket = (result as { upgradedSocket: Socket })
							?.upgradedSocket;
						if (upgradedSocket) {
							socket = response.socket = upgradedSocket;
							readline = createLineReader(upgradedSocket);
							response.encrypted = true;
							response.readline = readline;
							response.helloDone = false; // EHLO needs to be repeated
						}
					} catch (error: any) {
						mergedConfig.handleInternalError(
							socket,
							error,
							commandObject,
							response
						);
					}
				}
			} catch (error: any) {
				console.error('Error:', error);
				mergedConfig?.handleInitError(socket, error);
				socket.end();
			}
		});
		this.config = mergedConfig;
	}

	/**
	 * Sets the handler for a command.
	 *
	 * **NOTE: Only one handler can be set per command - calling
	 * this method more than once will override the previous handler(s).**
	 *
	 * @param commandName - The command name to be handled. Should be in uppercase.
	 * @param handler - The {@link CommandHandler} function to handle this command.
	 *
	 */
	setHandler(commandName: string, handler: CommandHandler) {
		this.__commandHandlers[commandName] = handler;
		return this;
	}

	/**
	 * Sets the handler for basic authentication (PLAIN/LOGIN).
	 *
	 * **NOTE: Only one handler can be set - calling
	 * this method more than once will override the previous handler(s).**
	 *
	 * @param handler - The function to handle basic auth. It is given four
	 * parameters - the pre-parsed username and password (as `Buffer` objects),
	 * the original {@link SmtpCommand} object, and the corresponding
	 * {@link Response} object.
	 *
	 */
	setBasicAuthHandler(
		handler: (
			usernameBuffer: Buffer,
			passwordBuffer: Buffer,
			command: SmtpCommand,
			response: SmtpResponse
		) => boolean
	) {
		this.__basicAuthHandler = handler;
		return this;
	}
	/**
	 * @deprecated
	 * @see {@link SmtpServer.setBasicAuthHandler}
	 *
	 */
	setPlainAuthHandler(
		handler: (
			usernameBuffer: Buffer,
			passwordBuffer: Buffer,
			command: SmtpCommand,
			response: SmtpResponse
		) => boolean
	) {
		return this.setBasicAuthHandler(handler);
	}

	/**
	 * Sends a 421 response to all connected clients, destroys all current connections,
	 * then closes the server to stop accepting more.
	 *
	 * **NOTE: This function is asynchronous - it returns a `Promise`, not `this`.**
	 */
	async shutdown() {
		this.connectedSockets.forEach((socket) => {
			socket.write(
				`\r\n421 4.3.0 ${
					this.config.shutdownCloseString?.(socket) ??
					'Server shutting down at operator request.'
				}\r\n`,
				() => socket.destroy()
			);
		});
		return new Promise((resolve) => this.close(resolve));
	}
}
