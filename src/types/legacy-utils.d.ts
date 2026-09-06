declare module '@/utils/indexRebuilder.js' {
  interface ProgressEvent {
    phase?: string
    message?: string
    current?: number
    total?: number
    percentage?: number
  }

  interface Options {
    onProgress?: (progress: ProgressEvent) => void
    onError?: (error: Error & { code?: string; suggestion?: string; recoverable?: boolean }) => void
  }

  export default class IndexRebuilder {
    constructor(options?: Options)
    rebuild(): Promise<{ success: boolean; totalFiles: number }>
    abort(): void
  }
}

declare module '@/utils/backupGenerator.js' {
  export default class BackupGenerator {
    constructor(options?: { onProgress?: (progress: Record<string, unknown>) => void })
    generateBackup(): Promise<{ success: boolean; fileCount: number; settingsCount: number }>
    abort(): void
  }
}

declare module '@/utils/restoreProcessor.js' {
  export default class RestoreProcessor {
    constructor(options?: {
      chunkSize?: number
      onProgress?: (progress: Record<string, unknown>) => void
      onError?: (error: Error & { code?: string; suggestion?: string; recoverable?: boolean }) => void
    })
    restore(data: unknown): Promise<{ success: boolean; restoredFiles: number; restoredSettings: number }>
    abort(): void
  }
}
