import { BaseMediaProvider } from './baseProvider';
import { providerRegistry } from './registry';

export * from './baseProvider';
export * from './mockProvider';
export * from './macCmsProvider';
export * from './macCmsApiProvider';
export * from './dbkuProvider';
export * from './registry';

// Default active singleton media provider for backward compatibility
export const mediaProvider: BaseMediaProvider = providerRegistry.getProvider();
export const fallbackProvider: BaseMediaProvider = providerRegistry.getProvider('mock');
