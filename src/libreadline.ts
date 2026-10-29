import type { Socket } from 'node:net';

export function createLineReader(socket: Socket) {
    let buffer = '';
    let ended = false;

    const lineQueue: string[] = [];
    const waiterQueue: Array<{
        resolve: (value: string | null) => void;
        reject: (error: Error) => void;
    }> = [];

    const cleanup = () => {
        socket.removeListener('data', onData);
        socket.removeListener('error', onError);
        socket.removeListener('end', onEnd);
        socket.removeListener('close', onClose);
    };

    const processBuffer = () => {
        let idx: number;

        // Support both CRLF and LF line endings
        while ((idx = buffer.indexOf('\n')) !== -1) {
            let line = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 1);

            // Strip trailing \r if present
            if (line.endsWith('\r')) line = line.slice(0, -1);

            const waiter = waiterQueue.shift();
            if (waiter) {
                waiter.resolve(line);
            } else {
                lineQueue.push(line);
            }
        }
    };

    const onData = (chunk: Buffer) => {
        if (ended) return;
        buffer += chunk.toString('utf8');
        processBuffer();
    };

    const onError = (error: Error) => {
        if ((error as NodeJS.ErrnoException).code === 'ECONNRESET') {
            onClose();
            return;
        }
        ended = true;
        cleanup();
        while (waiterQueue.length > 0) {
            waiterQueue.shift()!.reject(error);
        }
    };

    const onEnd = () => {
        onClose();
    };

    const onClose = () => {
        if (ended) return;
        ended = true;
        cleanup();

        // Flush any leftover data in buffer as a line
        if (buffer.length > 0) {
            lineQueue.push(buffer);
            buffer = '';
        }

        processBuffer();

        // Resolve any remaining waiting calls with null (EOF)
        while (waiterQueue.length > 0) {
            const waiter = waiterQueue.shift()!;
            const line = lineQueue.shift() ?? null;
            waiter.resolve(line);
        }
    };

    // Attach events
    socket.on('data', onData);
    socket.on('error', onError);
    socket.once('end', onEnd);
    socket.once('close', onClose);

    // The actual readLine function
    return function readLine(): Promise<string | null> {
        return new Promise((resolve, reject) => {
            // If a line is already buffered, return it immediately
            if (lineQueue.length > 0) {
                resolve(lineQueue.shift()!);
                return;
            }

            // If socket ended or closed, return null cleanly
            if (ended) {
                resolve(null);
                return;
            }

            // Otherwise, wait for data
            waiterQueue.push({ resolve, reject });
        });
    };
}