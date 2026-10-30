# SMTP server library for Node.js

## Overview

This library is a lightweight, extensible, and robust **ESMTP (Extended Simple Mail Transfer Protocol) Server** written in TypeScript for Node.js. It allows you to easily spin up a custom mail server, handle mail transactions (`MAIL FROM`, `RCPT TO`, `DATA`), manage client connections, implement custom authentication (`AUTH PLAIN` and `AUTH LOGIN`), and filter clients or incoming messages.

## Features

* **Full ESMTP Support**: Built-in handling for `HELO`, `EHLO`, `MAIL FROM`, `RCPT TO`, `DATA`, `QUIT`, `RSET`, `NOOP`, `HELP`, and `VRFY`.
* **STARTTLS Support**: Secure connections on-the-fly using Node.js `tls` modules.
* **Authentication**: Built-in support for `AUTH PLAIN` and `AUTH LOGIN` with customizable verification handlers.
* **Extensible Command Handlers**: Easily override existing command behaviors or add custom commands using `.setHandler()`.
* **Flexible Configuration**: Comprehensive default configuration options for banners, timeouts, maximum limits, error handling, and response text customization.
* **Message Queuing**: Automatically queues successfully received mail transactions into an internal queue for processing.

## Installation

Ensure you have Node.js installed, then add the files to your project source directory.

## Quick Start

Here is a basic example of how to spin up and start your SMTP server:

```typescript
import SmtpServer from './index';

// 1. Initialize the server with basic config
const server = new SmtpServer({
    hostname: 'mail.example.com',
    maxSize: 10 * 1024 * 1024, // 10MB limit
});

// 2. Set up basic authentication handling
server.setBasicAuthHandler((usernameBuffer, passwordBuffer, command, response) => {
    const username = usernameBuffer.toString();
    const password = passwordBuffer.toString();

    // Verify credentials (replace with your user lookup logic)
    if (username === 'admin' && password === 'secret123') {
        return true; // Authentication successful
    }
    return false; // Authentication failed
});

// 3. Start listening on port 25 or 2525
const PORT = 2525;
server.listen(PORT, () => {
    console.log(`SMTP Server running on port ${PORT}`);
});

```

## Core API Reference

### `SmtpServer` Class

Extends Node.js's native `net.Server`.

* **`constructor(config?: Partial<ServerConfig>)`**: Creates a new SMTP server instance with merged default and custom configurations.
* **`setHandler(commandName: string, handler: CommandHandler)`**: Overrides or adds a custom handler for a specific SMTP command (e.g., `CUSTOMCMD`).
* **`setBasicAuthHandler(handler)`** (alias `setPlainAuthHandler`): Sets the verification function for `AUTH PLAIN` and `AUTH LOGIN`. The function receives `(usernameBuffer, passwordBuffer, command, response)` and must return a boolean.
* **`shutdown()`**: Gracefully notifies all connected clients with a `421` shutdown message, destroys open sockets, and closes the server.

### `SmtpResponse` Class

Passed to all command handlers to communicate back with the connected client.

* **`write(input: Buffer | string, cb?)`**: Writes raw data to the socket.
* **`writeln(line: string)`**: Writes a line of text followed by `\r\n`.
* **`status(code: number, enhancedCode: [number, number, number], text?: string)`** or **`status(code: number, text: string)`**: Sends a standard or enhanced SMTP response code line.
* **`end(cb?)`**: Closes the client socket connection.
* **`destroy(error?: Error)`**: Immediately destroys the socket connection.


## Configuration Options

You can customize your server behavior by passing a configuration object to the `SmtpServer` constructor. Key options include:

* `hostname`: The domain name used in server banners and greetings.
* `maxSize`: Maximum allowed message size in bytes.
* `startTls`: Boolean enabling or disabling `STARTTLS`.
* `authTypes`: Array of supported authentication types (e.g., `['LOGIN', 'PLAIN']`).
* `serverTimeout`: Milliseconds of inactivity before timing out a client connection.
* `filterClient(socket)`: Hook to allow or block connections based on client IP/socket.
* `filterMessage(message)`: Hook to inspect, modify, or reject incoming message buffers.
* `mailQueue`: Queue instance where completed mail transactions are stored.