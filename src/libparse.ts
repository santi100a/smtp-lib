import type { SmtpCommand } from './types';

export = function parseCommand(line: string): SmtpCommand {
	if (!line || line.trim() === '') {
		return { command: null, params: [] };
	}

	const trimmedLine = line.trim();
	const spaceIndex = trimmedLine.indexOf(' ');

	// Handle single-word commands (e.g., "DATA", "QUIT")
	if (spaceIndex === -1) {
		return {
			command: trimmedLine.toUpperCase(),
			params: []
		};
	}

	const command = trimmedLine.substring(0, spaceIndex).toUpperCase();
	let remainder = trimmedLine.substring(spaceIndex + 1).trim();

	// Logic to capture FROM/TO as parameters
	if (command === 'MAIL' || command === 'RCPT') {
		// Find the colon (e.g., in "FROM:<addr>" or "FROM : <addr>")
		const colonIndex = remainder.indexOf(':');

		if (colonIndex !== -1) {
			// Extract the word before the colon (e.g., "FROM")
			const subCommand = remainder
				.substring(0, colonIndex)
				.trim()
				.toUpperCase();
			// Extract the actual value after the colon (e.g., "<user@example.com>")
			const address = remainder
				.substring(colonIndex + 1)
				.replaceAll('<', '')
				.replaceAll('>', '')
				.trim();

			return {
				command: command,
				params: [subCommand, address]
			};
		}
	}

	// Default behavior for other commands (e.g., HELO relay.com)
	const params = remainder.split(' ').filter((p) => p.length > 0);
	return { command, params };
};
