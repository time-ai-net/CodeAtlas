import { ILogger } from '@codeatlas/core';

export class WebLogger implements ILogger {
  info(message: string): void {
    console.log(`[INFO] ${message}`);
  }

  error(error: any): void {
    console.error(`[ERROR]`, error);
  }
}

export const logger = new WebLogger();

