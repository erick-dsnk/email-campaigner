
export enum LoggingLevel {
  INFO,
  DEBUG,
  ERROR,
};

export class Logger {
  private level: LoggingLevel;

  constructor(level: LoggingLevel) {
    this.level = level;
  }

  public addLog(content: string): void {
    // to implement file logging

    console.log(content);
  }

  public addDebugLog(content: string): void {
    // to implement file logging
    if (this.level === LoggingLevel.DEBUG) {
      console.log(content);
    }
  }

  public addErrorLog(content: string): void {
    // to implement file logging

    console.error(content);
  }
}