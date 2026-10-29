const SmtpServer = require('.');
function createQueue() {
	return {
		_: [],
		add(input) {
			this._.push(input);
			console.log(input);
		},
		remove() {
			return this._.shift();
		}
	}
}
const port = process.env.PORT ?? 587;
const mailQueue = createQueue();
const server = new SmtpServer({
	authTypes: ['LOGIN', 'PLAIN'],
	binaryMime: false,
	eightBitMime: false,
	smtpUtf8: false,
	startTls: false,
	unencryptedAuth: true,
	maxSize: 1_048_576,
	generateBannerText(socket) {
		return `- Saluton! Servilo ESMTP preta por auxskulti vin! (${
			socket.address().address
		} ${new Date().toISOString()})`;
	},
	generateEhloString(socket, command) {
		return `- Bonvenon, ${command.params.join(' ')} [${
			socket.address().address
		}]. Kapabloj:`;
	},
	generateHeloString(socket, command) {
		return `- Bonvenon, ${command.params.join(' ')} [${
			socket.address().address
		}].`;
	},
	hostname: 'smtptesto.sscorp.su',
	unknownCommandHandler(command, response) {
		return response.status(
			502,
			[5, 5, 1],
			`Mi ne komprenas: ${command.command}`
		);
	},
	generateHelpPreamble() {
		return 'Mi povas respondi al la jenaj komandoj:';
	},
	generateQuitString(_, response) {
		return `- Fermante konekton. Adiaux`.concat(
			response.clientHostname ? ', '.concat(response.clientHostname) : '',
			'!'
		);
	},
	handleInitError(socket, error) {
		console.error('Init error:', error);
		socket.write(
			`421 - Mi ne povas helpi vin nuntempe. Fermante konekton. (${
				socket.address().address
			} ${new Date().toISOString()})\r\n`
		);
		socket.end();
	},
	handleInternalError(_, error, __, response) {
		console.error('Internal error:', error);
		return response.status(420, '- Eraro okazis.');
	},
	serverTimeout: 5 * 60 * 1000,
	mailTimeout: 5 * 60 * 1000,
	rcptTimeout: 5 * 60 * 1000,
	mailQueue,
	filterClient(socket) {
		return {
			allow: true
		}
	},
	generateAuthFailedString() {
		return '- Auxtentigo malsukcesis.';
	},
	generateAuthPromptString(type) {
		return type === 'USERNAME' ? 'Uzantnomo:' : 'Pasvorto:';
	},
	generateAuthSuccessString(_, response) {
		return `- Bonvenon! Sukcese auxtentigita kiel ${response.authenticatedAs}.`;
	},
	generateDataAcceptedString() {
		return '- Mesagxo akceptita!';
	},
	generateDataPromptString() {
		return '- Iru antauxen:';
	},
	generateMailAcceptedString(command) {
		return `- Sendanto akceptita: <${command.params[0]}>`;
	},
	generateRcptAcceptedString(command) {
		return `- Ricevanto akceptita: <${command.params[0]}>`;

	},
	generateMalformedAuthString() {
		return '- Misformata auxtentiga informo.';
	},
	generateNoopString() {
		return '- Nenio okazas.';
	},
	generateRsetString() {
		return '- Stato rekomencita.';
	},
	generateStartTlsAlreadyEncrypted() {
		return '- Jam cxifrita.';
	},
	generateStartTlsDisabled() {
		return '- Cxifrado malaktivigita.';
	},
	generateStartTlsPromptString() {
		return '- Antauxen. Komencu cxifradon.';
	},
	generateUnknownAuthMethodString({ params: [ firstParam ] }) {
		return `- Nekonata metodo${firstParam ? ': '.concat(firstParam) : ''}.`;
	},
	generateVrfyString() {
		return `- Ne povas kontroli uzanton.`;
	},
	tooMuchDataString(_, __, buf) {
		return `- Mesagxo estas tro granda (${buf.byteLength} > ${this.maxSize}).`;
	},
	emptyRecipientAddressString() {
		return '- Ricevanta adreso malplena.';
	},
	generateAuthRequiredString() {
		return '- Auxtentigado postulata.';
	},
	generateEhloArgumentMissing() {
		return '- Parametro por EHLO mankas.';
	},
	generateHeloArgumentMissing() {
		return '- Parametro por HELO mankas.';
	},
	generateEhloRequiredString() {
		return '- Dio mia... Estu respektema kaj SALUTU ANTAUXE!';
	},
	generateInvalidFromString() {
		return '- Malvalida sendanto.';
	},
	generateNoParamsString({ command }) {
		return `- Gxusta sintakso: ${command} (SEN PARAMETROJ, MI PETAS).`;
	},
	generateNoTransactionString() {
		return `- Vi devas komencigi retposxtan transakcion antauxe.`;
	},
	generateUnimplementedString() {
		return '- Mi ne scipovas fari cxi tion.';
	},
	hardLimitString() {
		return '- Vi preterpasis ege. Fermante konekton. >:/';
	},
	invalidRecipientAddressString() {
		return '- Malvalida ricevanto.';
	},
	noRecipientsString() {
		return '- Mi bezonas scii al kiu sendi!';
	},
	onlyMailFromString() {
		return '- Mi esperas FROM poste de MAIL.';
	},
	onlyRcptToString() {
		return '- Mi esperas TO poste de RCPT.';
	},
	authRequired: ['MAIL', 'RCPT', 'DATA', 'VRFY', 'EXPN']
});

server.setPlainAuthHandler((username, password) => {
	return username.toString() === 'admin' &&
		password.toString() === '1234'
});
server.listen(port, () => console.log(`Preta: smtp://127.0.0.1:${port}`));
