import { http } from './http'
import type {
  ChannelMap,
  CustomerFilesResponse,
  CustomerSummary,
  FileListResponse,
  PageSettings,
  SecuritySettings,
  SessionState,
  UploadChannelType,
  UploadResponse,
  UserConfig,
} from '@/types/api'

export const api = {
  async userConfig() {
    return (await http.get<UserConfig>('/api/userConfig')).data
  },
  async session() {
    return (await http.get<SessionState>('/api/auth/sessionCheck')).data
  },
  async login(authCode: string) {
    return (await http.post('/api/auth/login', { authCode })).data
  },
  async adminLogin(adminUsername: string, adminPassword: string) {
    return (await http.post('/api/auth/adminLogin', { adminUsername, adminPassword })).data
  },
  async logout(authType: 'user' | 'admin') {
    return (await http.post('/api/auth/logout', { authType })).data
  },
  async channels(includeDisabled = false) {
    return (
      await http.get<ChannelMap>('/api/channels', {
        params: includeDisabled ? { includeDisabled: true } : undefined,
      })
    ).data
  },
  async directories() {
    return (await http.get<{ directories?: string[]; tree?: unknown }>('/api/directoryTree')).data
  },
  async upload(
    file: File,
    options: {
      channel: UploadChannelType
      channelName?: string
      folder?: string
      autoRetry?: boolean
      returnFormat?: 'default' | 'full'
      uploadNameType?: 'default' | 'index' | 'origin' | 'short'
      signal?: AbortSignal
      onProgress?: (progress: number) => void
    },
  ) {
    const chunkSize = options.channel === 'discord' ? 9 * 1024 * 1024 : 16 * 1024 * 1024
    if (file.size > chunkSize) return uploadInChunks(file, options, chunkSize)

    const body = new FormData()
    body.append('file', file)
    const response = await http.post<UploadResponse[]>('/upload', body, {
      params: {
        uploadChannel: options.channel,
        channelName: options.channelName || undefined,
        uploadFolder: options.folder || undefined,
        autoRetry: options.autoRetry === false ? 'false' : undefined,
        uploadNameType: options.uploadNameType || 'default',
        returnFormat: options.returnFormat || 'full',
      },
      signal: options.signal,
      timeout: 0,
      onUploadProgress: (event) => {
        if (!event.total) return
        options.onProgress?.(Math.round((event.loaded / event.total) * 100))
      },
    })
    return response.data
  },
  async adminList(params: Record<string, string | number | boolean | undefined>) {
    return (await http.get<FileListResponse>('/api/manage/list', { params })).data
  },
  async systemInfo(params: Record<string, string | number | undefined>) {
    return (await http.get<Record<string, unknown>>('/api/manage/list', { params: { action: 'info', ...params } })).data
  },
  async indexStorageStats() {
    return (await http.get<Record<string, unknown>>('/api/manage/list', { params: { action: 'index-storage-stats' } })).data
  },
  async quotaStats() {
    return (await http.get<Record<string, unknown>>('/api/manage/quota')).data
  },
  async publicList(params: Record<string, string | number | boolean | undefined>) {
    return (await http.get<FileListResponse>('/api/public/list', { params })).data
  },
  async customers(start = 0, count = 20) {
    return (await http.get<CustomerSummary[]>('/api/manage/cusConfig/list', { params: { start, count } })).data
  },
  async customerFiles(ip: string, start = 0, count = 20) {
    return (await http.get<CustomerFilesResponse>('/api/manage/cusConfig/files', { params: { ip, start, count } })).data
  },
  async blockedCustomerIps() {
    const value = (await http.get<string>('/api/manage/cusConfig/blockipList', { responseType: 'text' })).data
    return value.split(',').map((item) => item.trim()).filter(Boolean)
  },
  async setCustomerAllowed(ip: string, allowed: boolean) {
    const action = allowed ? 'whiteip' : 'blockip'
    return (await http.post(`/api/manage/cusConfig/${action}`, ip, {
      headers: { 'Content-Type': 'text/plain' },
    })).data
  },
  async deleteFile(name: string) {
    return (await http.delete(`/api/manage/delete/${encodeURIComponent(name)}`)).data
  },
  async batchDelete(names: string[]) {
    return (await http.post('/api/manage/delete/batch', { fileIds: names })).data
  },
  async getPageSettings() {
    return (await http.get<PageSettings>('/api/manage/sysConfig/page')).data
  },
  async savePageSettings(settings: PageSettings) {
    return (await http.post<PageSettings>('/api/manage/sysConfig/page', settings)).data
  },
  async getSecuritySettings() {
    return (await http.get<SecuritySettings>('/api/manage/sysConfig/security')).data
  },
  async saveSecuritySettings(settings: SecuritySettings) {
    return (await http.post('/api/manage/sysConfig/security', settings)).data
  },
  async getOtherSettings() {
    return (await http.get<Record<string, unknown>>('/api/manage/sysConfig/others')).data
  },
  async saveOtherSettings(settings: Record<string, unknown>) {
    return (await http.post('/api/manage/sysConfig/others', settings)).data
  },
  async getUploadSettings() {
    return (await http.get<Record<string, unknown>>('/api/manage/sysConfig/upload')).data
  },
  async updateMetadata(fileId: string, metadata: { FileName?: string; FileType?: string }) {
    return (await http.patch(`/api/manage/metadata/${encodeURIComponent(fileId)}`, metadata)).data
  },
  async renameFile(fileId: string, newFileId: string) {
    return (await http.post(`/api/manage/rename/${encodeURIComponent(fileId)}`, { newFileId })).data
  },
  async moveFile(fileId: string, dist: string) {
    return (await http.post(`/api/manage/move/${encodeURIComponent(fileId)}`, undefined, { params: { dist } })).data
  },
  async setTags(fileId: string, tags: string[]) {
    return (await http.post(`/api/manage/tags/${encodeURIComponent(fileId)}`, { action: 'set', tags })).data
  },
  async setListType(fileId: string, listType: 'Block' | 'White') {
    const action = listType === 'Block' ? 'block' : 'white'
    return (await http.post(`/api/manage/${action}/${encodeURIComponent(fileId)}`)).data
  },
}

async function uploadInChunks(
  file: File,
  options: {
    channel: UploadChannelType
    channelName?: string
    folder?: string
    autoRetry?: boolean
    returnFormat?: 'default' | 'full'
    uploadNameType?: 'default' | 'index' | 'origin' | 'short'
    signal?: AbortSignal
    onProgress?: (progress: number) => void
  },
  chunkSize: number,
) {
  const totalChunks = Math.ceil(file.size / chunkSize)
  const baseParams = {
    uploadChannel: options.channel,
    channelName: options.channelName || undefined,
    uploadFolder: options.folder || undefined,
    autoRetry: options.autoRetry === false ? 'false' : undefined,
    uploadNameType: options.uploadNameType || 'default',
    returnFormat: options.returnFormat || 'full',
  }
  const init = new FormData()
  init.append('originalFileName', file.name)
  init.append('originalFileType', file.type || 'application/octet-stream')
  init.append('totalChunks', String(totalChunks))
  const initResponse = await http.post<{ success: boolean; uploadId: string; message?: string }>('/upload', init, {
    params: { ...baseParams, initChunked: 'true' },
    signal: options.signal,
    timeout: 0,
  })
  if (!initResponse.data.success || !initResponse.data.uploadId) {
    throw new Error(initResponse.data.message || '无法初始化分块上传')
  }

  const uploadId = initResponse.data.uploadId
  const progress = Array.from({ length: totalChunks }, () => 0)
  let cursor = 0

  async function uploadChunk(index: number) {
    const start = index * chunkSize
    const chunk = file.slice(start, Math.min(start + chunkSize, file.size))
    const body = new FormData()
    body.append('file', chunk, `${file.name}.part${String(index).padStart(3, '0')}`)
    body.append('chunkIndex', String(index))
    body.append('totalChunks', String(totalChunks))
    body.append('uploadId', uploadId)
    body.append('originalFileName', file.name)
    body.append('originalFileType', file.type || 'application/octet-stream')

    let lastError: unknown
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await http.post('/upload', body, {
          params: { ...baseParams, chunked: 'true' },
          signal: options.signal,
          timeout: 0,
          onUploadProgress: (event) => {
            if (!event.total) return
            progress[index] = Math.round((event.loaded / event.total) * 100)
            options.onProgress?.(Math.round(progress.reduce((sum, value) => sum + value, 0) / totalChunks))
          },
        })
        return
      } catch (error) {
        lastError = error
        if (options.signal?.aborted) throw error
        if (attempt < 3) await new Promise((resolve) => window.setTimeout(resolve, attempt * 1200))
      }
    }
    throw lastError
  }

  try {
    const workers = Array.from({ length: Math.min(3, totalChunks) }, async () => {
      while (cursor < totalChunks) {
        const index = cursor
        cursor += 1
        await uploadChunk(index)
      }
    })
    await Promise.all(workers)

    const merge = new FormData()
    merge.append('uploadId', uploadId)
    merge.append('totalChunks', String(totalChunks))
    merge.append('originalFileName', file.name)
    merge.append('originalFileType', file.type || 'application/octet-stream')
    const response = await http.post<UploadResponse[]>('/upload', merge, {
      params: { ...baseParams, chunked: 'true', merge: 'true' },
      signal: options.signal,
      timeout: 0,
    })
    options.onProgress?.(100)
    return response.data
  } catch (error) {
    await http.post('/upload', undefined, {
      params: { cleanup: 'true', uploadId, totalChunks },
      timeout: 20_000,
    }).catch(() => undefined)
    throw error
  }
}
