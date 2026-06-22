/// <reference types="vite/client" />

import type { BearsomeApi } from '@shared/ipc'

declare global {
  interface Window {
    bearsome: BearsomeApi
  }
}

export {}
