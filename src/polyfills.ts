import './zone-flags';

import 'zone.js';

import { Buffer } from 'buffer';
(window as any).Buffer = Buffer;

if (typeof WebAssembly === 'undefined') {
  console.warn('WebAssembly não está disponível neste ambiente. Algumas funcionalidades podem não funcionar.');
}
