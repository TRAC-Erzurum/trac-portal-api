/** One structured line as the event logger writes it to stdout. */
export interface LogLine {
  event?: string;
  level?: string;
  [field: string]: unknown;
}

/** `write(chunk, encoding?, callback?)`; the encoding slot may hold the callback. */
type Write = (
  chunk: string | Uint8Array,
  encoding?: BufferEncoding,
  callback?: (err?: Error) => void,
) => boolean;

/**
 * Records everything written to stdout and stderr while installed, and still
 * lets it through. `lines` are the JSON event lines; `raw` is every byte, for
 * checks that nothing secret was written anywhere.
 */
export class LogCapture {
  private chunks: string[] = [];
  private restore: (() => void) | null = null;

  install(): this {
    const streams = [process.stdout, process.stderr];
    const saved = streams.map((s) =>
      Object.getOwnPropertyDescriptor(s, 'write'),
    );
    const originals = streams.map((s) => s.write.bind(s) as Write);
    streams.forEach((stream, i) => {
      const original = originals[i];
      const write: Write = (chunk, encoding, callback) => {
        this.chunks.push(
          typeof chunk === 'string'
            ? chunk
            : Buffer.from(chunk).toString('utf8'),
        );
        return original(chunk, encoding, callback);
      };
      stream.write = write as typeof stream.write;
    });
    this.restore = () =>
      streams.forEach((stream, i) => {
        const own = saved[i];
        if (own) Object.defineProperty(stream, 'write', own);
        else delete (stream as { write?: unknown }).write;
      });
    return this;
  }

  uninstall(): void {
    this.restore?.();
    this.restore = null;
  }

  clear(): void {
    this.chunks = [];
  }

  get raw(): string {
    return this.chunks.join('');
  }

  /** Lines that parse as a JSON object with an `event` field. */
  get lines(): LogLine[] {
    return this.raw
      .split('\n')
      .map((line) => {
        try {
          const parsed: unknown = JSON.parse(line);
          return parsed && typeof parsed === 'object' ? parsed : null;
        } catch {
          return null;
        }
      })
      .filter((l): l is LogLine => !!l && 'event' in l);
  }

  events(name: string): LogLine[] {
    return this.lines.filter((l) => l.event === name);
  }
}
