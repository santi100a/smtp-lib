import type { SmtpCommand } from './types';

export = function parseCommand(line: string): SmtpCommand {
	if (!line || line.trim() === '') {
		return { command: null, params: [], raw: line };
	}

	// NO recortar la línea completa al inicio, ya que el espacio final puede ser significativo en DATA de texto,
	// pero limpiamos saltos de línea molestos si los hay.
	const trimmedLine = line.replace(/[\r\n]+/g, '');
	const spaceIndex = trimmedLine.indexOf(' ');

	// Manejo de comandos de una sola palabra (e.g., "DATA", "QUIT")
	if (spaceIndex === -1) {
		return {
			command: trimmedLine.trim().toUpperCase(),
			params: [],
			raw: line
		};
	}

	const command = trimmedLine.substring(0, spaceIndex).trim().toUpperCase();
	const remainder = trimmedLine.substring(spaceIndex + 1).trim();

	// Lógica bajo cumplimiento RFC 5321 para MAIL FROM y RCPT TO
	if (command === 'MAIL' || command === 'RCPT') {
		const colonIndex = remainder.indexOf(':');

		if (colonIndex !== -1) {
			const subCommand = remainder.substring(0, colonIndex).trim().toUpperCase(); // e.g., "FROM" o "TO"
			const afterColon = remainder.substring(colonIndex + 1).trim();

			// Expresión regular que busca exactamente el contenido dentro de <... >
			// Captura la dirección de correo y separa cualquier parámetro ESMTP que venga después
			const match = afterColon.match(/^<([^>]+)>(.*)$/);
			
			let address = afterColon;
			let extraParams: string[] = [];

			if (match) {
				address = match[1].trim(); // Dirección limpia sin los corchetes < >
				const extensions = match[2].trim();
				if (extensions.length > 0) {
					extraParams = extensions.split(' ').filter((p) => p.length > 0);
				}
			} else {
				// Fallback por si envían la dirección sin < > (común en clientes no estándar)
				const parts = afterColon.split(' ').filter((p) => p.length > 0);
				if (parts.length > 0) {
					address = parts[0].replaceAll('<', '').replaceAll('>', '');
					extraParams = parts.slice(1);
				}
			}

			return {
				command: command,
				// Conservamos tus dos primeros parámetros intactos para no romper SmtpServer.class.ts,
				// e inyectamos los parámetros adicionales de extensión por si deseas usarlos en el futuro.
				params: [subCommand, address, ...extraParams],
				raw: line
			};
		}
	}

	// Comportamiento por defecto para otros comandos (e.g., HELO relay.com)
	const params = remainder.split(' ').filter((p) => p.length > 0);
	return { command, params, raw: line };
};
