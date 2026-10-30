import type { Socket } from 'node:net';
import type { SecureContextOptions } from 'node:tls';
import type SmtpResponse from './SmtpResponse.class';
import type Queue from './libqueue';

export type LoosePromise<T = unknown> = T | Promise<T>;

export interface ResponseData {
	readonly statusCode?: number;
	readonly enhancedCode?: [number, number, number];
	readonly text?: string;
}

export interface FilterOutput extends ResponseData {
	readonly allow: boolean;
}

export interface MessageFilterOutput extends FilterOutput {
	readonly revisedMessage?: Buffer;
}

export interface ServerConfig {
	generateBannerText(socket: Socket): string;
	generateEhloString(socket: Socket, command: SmtpCommand): string;
	generateHeloString(socket: Socket, command: SmtpCommand): string;
	handleInitError(socket: Socket, error: Error): unknown;
	handleInternalError(
		socket: Socket,
		error: Error,
		command: SmtpCommand,
		response: SmtpResponse
	): unknown;
	handleMailFrom(address: string, response: SmtpResponse): LoosePromise<FilterOutput>;
	handleRcptTo(address: string, response: SmtpResponse): LoosePromise<FilterOutput>;
	generateHelpPreamble(command: SmtpCommand, response: SmtpResponse): string;
	generateQuitString(command: SmtpCommand, response: SmtpResponse): string;
	unknownCommandHandler: CommandHandler;

	generateMailAcceptedString(
		command: SmtpCommand,
		response: SmtpResponse
	): string;
	generateRcptAcceptedString(
		command: SmtpCommand,
		response: SmtpResponse
	): string;
	generateDataPromptString(
		command: SmtpCommand,
		response: SmtpResponse
	): string;
	generateDataAcceptedString(
		command: SmtpCommand,
		response: SmtpResponse
	): string;
	generateAuthPromptString(
		type: 'USERNAME' | 'PASSWORD',
		response: SmtpResponse
	): string;
	generateAuthSuccessString(
		command: SmtpCommand,
		response: SmtpResponse
	): string;
	generateAuthFailedString(
		command: SmtpCommand,
		response: SmtpResponse
	): string;
	generateNoopString(command: SmtpCommand, response: SmtpResponse): string;
	generateRsetString(command: SmtpCommand, response: SmtpResponse): string;
	generateVrfyString(command: SmtpCommand, response: SmtpResponse): string;
	generateStartTlsPromptString(
		command: SmtpCommand,
		response: SmtpResponse
	): string;
	generateStartTlsAlreadyEncrypted(
		command: SmtpCommand,
		response: SmtpResponse
	): string;
	generateStartTlsDisabled(
		command: SmtpCommand,
		response: SmtpResponse
	): string;
	generateMalformedAuthString(
		command: SmtpCommand,
		response: SmtpResponse
	): string;
	generateUnknownAuthMethodString(
		command: SmtpCommand,
		response: SmtpResponse
	): string;
	generateEhloRequiredString(
		command: SmtpCommand,
		response: SmtpResponse
	): string;
	generateEhloArgumentMissing(
		command: SmtpCommand,
		response: SmtpResponse
	): string;
	generateHeloArgumentMissing(
		command: SmtpCommand,
		response: SmtpResponse
	): string;
	generateAuthRequiredString(
		command: SmtpCommand,
		response: SmtpResponse
	): string;
	generateServerTimeoutString(
		command: SmtpCommand,
		response: SmtpResponse
	): string;
	shutdownCloseString(socket: Socket): string;
	generateNoParamsString(command: SmtpCommand, response: SmtpResponse): string;
	emptyRecipientAddressString(
		command: SmtpCommand,
		response: SmtpResponse
	): string;
	invalidRecipientAddressString(
		command: SmtpCommand,
		response: SmtpResponse
	): string;
	onlyMailFromString(command: SmtpCommand, response: SmtpResponse): string;
	onlyRcptToString(command: SmtpCommand, response: SmtpResponse): string;
	generateNoTransactionString(
		command: SmtpCommand,
		response: SmtpResponse
	): string;
	generateUnimplementedString(
		command: SmtpCommand,
		response: SmtpResponse
	): string;
	generateInvalidFromString(
		command: SmtpCommand,
		response: SmtpResponse
	): string;
	hardLimitString(command: SmtpCommand, response: SmtpResponse): string;
	tooMuchDataString(
		command: SmtpCommand,
		response: SmtpResponse,
		msgBuffer: Buffer
	): string;
	noRecipientsString(command: SmtpCommand, response: SmtpResponse): string;
	filterClient(socket: Socket): LoosePromise<FilterOutput>;
	filterMessage(message: Buffer): LoosePromise<MessageFilterOutput>;

	secureContextOptions?: SecureContextOptions;
	hostname: string;
	authTypes: string[];
	eightBitMime: boolean;
	binaryMime: boolean;
	smtpUtf8: boolean;
	startTls: boolean;
	maxSize?: number;
	unencryptedAuth: boolean;
	authRequired: string[];
	serverTimeout: number;
	mailQueue: Queue<MailTransaction>;
}

export interface MailTransaction {
	from: string | null;
	to: Set<string>;
	data: Buffer | null;
}

export interface SmtpCommand {
	command: string | null;
	params: string[];
}

export type CommandHandler = (
	command: SmtpCommand,
	response: SmtpResponse
) => unknown;
