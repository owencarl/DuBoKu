import { BaseMediaProvider } from './baseProvider';
import { DbkuProvider } from './dbkuProvider';
import { MockMediaProvider, defaultProvider } from './mockProvider';

export * from './baseProvider';
export * from './mockProvider';
export * from './dbkuProvider';

// Primary active singleton media provider
export const mediaProvider: BaseMediaProvider = new DbkuProvider();
export const fallbackProvider: BaseMediaProvider = defaultProvider;
