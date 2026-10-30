import { ServerConfig } from './types';
import Queue from './libqueue';

/**
 * The server configuration defaults.
 */
const config: ServerConfig = {
	generateBannerText() {
		return 'ESMTP';
	},
	authTypes: ['LOGIN', 'PLAIN'],
	binaryMime: false,
	eightBitMime: true,
	startTls: false,
	unencryptedAuth: false,
	smtpUtf8: false,
	hostname: '',
	mailQueue: new Queue(),
	serverTimeout: 300_000,
	generateEhloString(_, command) {
		return `Hi${command.params.length > 0 ? ', '.concat(command.params.join(' ')) : ''}. Capabilities:`;
	},
    generateEhloRequiredString() {
        return 'Say hello first! (EHLO/HELO).';
    },
	generateHeloString(_, command) {
		return `Hi${command.params.length > 0 ? ', '.concat(command.params.join(' ')) : ''}`;
	},
    hardLimitString() {
        return 'Hard limit exceeded! Closing connection.';
    },
    generateAuthRequiredString() {
        return 'Auth required.';
    },
    generateNoParamsString({ command }) {
        return `${command} does not accept parameters.`;
    },
    generateInvalidFromString() {
        return 'Invalid FROM address.';
    },
	generateHelpPreamble() {
		return 'Commands:';
	},
	generateQuitString() {
		return 'Service closing transmission channel.';
	},
    generateNoopString() {
        return 'Nothing happens.';
    },
    generateRsetString() {
        return 'Clean slate.';
    },
    generateVrfyString() {
        return 'Cannot VRFY user.';
    },
    generateStartTlsPromptString() {
        return 'Go ahead - start TLS.';
    },
    generateStartTlsAlreadyEncrypted() {
        return 'Already encrypted.';
    },
    generateStartTlsDisabled() {
        return 'Disabled.';
    },
    generateMalformedAuthString() {
        return 'Malformed auth string.';
    },
    generateUnknownAuthMethodString() {
        return 'Method unknown.';
    },
	handleInitError(socket, error) {
		console.error('Init error:', error);
		socket.write('421 Init Error\r\n');
		return socket.end();
	},
	handleInternalError(socket, error) {
		console.error('Internal error:', error);
		socket.write('420 Internal Error\r\n');
		return socket.end();
	},
	generateEhloArgumentMissing() {
		return 'EHLO argument missing.';
	},
	generateHeloArgumentMissing() {
		return 'HELO argument missing.';
	},
    emptyRecipientAddressString() {
        return 'Empty recipient address.';
    },
    invalidRecipientAddressString() {
        return 'Invalid recipient address.'
    },
    onlyMailFromString() {
        return 'Only MAIL FROM accepted.';
    },
    onlyRcptToString() {
        return 'Only RCPT TO accepted.';
    },
    generateNoTransactionString() {
        return 'Start transaction with MAIL FROM first.';
    },
	generateUnimplementedString() {
		return 'Unimplemented.';
	},
	filterClient() {
		return {
			allow: true
		};
	},
	generateMailAcceptedString() {
		return 'Sender accepted.';
	},
	generateRcptAcceptedString() {
		return 'Recipient accepted.';
	},
	handleMailFrom() {
		return {
			allow: true,
			statusCode: 250,
			enhancedCode: [2, 1, 0],
			text: 'Sender accepted.'
		};
	},
	handleRcptTo() {
		return {
			allow: true,
			statusCode: 250,
			enhancedCode: [2, 1, 5],
			text: 'Receiver accepted.'
		};
	},
	generateDataPromptString() {
		return 'Go ahead! End with <CRLF>.<CRLF>';
	},
	generateDataAcceptedString() {
		return 'Message accepted!';
	},
	generateAuthPromptString(type) {
		return type === 'USERNAME' ? 'Username:' : 'Password:';
	},
	generateAuthSuccessString() {
		return 'Accepted! Welcome';
	},
	generateAuthFailedString() {
		return 'Auth failed.';
	},
	tooMuchDataString() {
		return 'Too much mail data.';
	},
	filterMessage() {
		return { allow: true };
	},
	noRecipientsString() {
		return 'No recipients.';
	},
	shutdownCloseString() {
		return 'I have to go. Bye then.';
	},
	generateServerTimeoutString() {
		return 'Timeout waiting for command, closing connection.';
	},
	unknownCommandHandler(command, response) {
		return response.status(502, [5, 5, 1], `Unrecognized: ${command.command}`);
	},
    authRequired: []
};
export default config;
