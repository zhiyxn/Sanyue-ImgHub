export interface UserConfig {
  siteTitle?: string
  siteIcon?: string
  defaultLanguage?: 'zh-CN' | 'en'
  ownerName?: string
  logoUrl?: string
  logoLink?: string
  wallpaperEnabled?: boolean
  announcement?: string
  showDirectorySuggestions?: boolean
  defaultUploadChannel?: UploadChannelType
  defaultChannelName?: string
  defaultUploadFolder?: string
  defaultUploadNameType?: 'default' | 'index' | 'origin' | 'short'
  defaultConvertToWebp?: boolean
  defaultCustomerCompress?: boolean
  defaultCompressBar?: number | string
  defaultCompressQuality?: number | string
  defaultUploadCopyUrlForm?: string
  disableFooter?: boolean
  [key: string]: unknown
}

export interface SessionState {
  valid: boolean
  adminRequired: boolean
  userRequired: boolean
  authType?: 'user' | 'admin'
}

export type UploadChannelType =
  | 'telegram'
  | 'cfr2'
  | 's3'
  | 'discord'
  | 'huggingface'
  | 'webdav'
  | 'external'

export interface ChannelOption {
  name: string
  type: string
}

export type ChannelMap = Partial<Record<UploadChannelType, ChannelOption[]>>

export interface FileMetadata {
  FileName?: string
  FileType?: string
  FileSize?: number | string
  FileSizeBytes?: number
  TimeStamp?: number
  Channel?: string
  ChannelName?: string
  Directory?: string
  ListType?: string
  Label?: string
  Tags?: string[]
  UploadIP?: string
  Width?: number
  Height?: number
  [key: string]: unknown
}

export interface FileRecord {
  id?: string
  name: string
  metadata?: FileMetadata
}

export interface FileListResponse {
  files: FileRecord[]
  directories: string[]
  totalCount: number
  directFileCount?: number
  directFolderCount?: number
  returnedCount: number
  indexLastUpdated?: number
  fromCache?: boolean
  allowedDirs?: string[]
}

export interface CustomerSummary {
  ip: string
  address: string
  count: number
}

export interface CustomerFilesResponse {
  data: FileRecord[]
  total: number
}

export type ApiTokenPermission = 'upload' | 'delete' | 'list' | 'manage'

export interface ApiTokenRecord {
  id: string
  name: string
  owner: string
  permissions: ApiTokenPermission[]
  token: string
  createdAt: string
  updatedAt: string
  expiresAt: string | null
  autoDelete: boolean
}

export interface ApiTokenInput {
  name: string
  owner: string
  permissions: ApiTokenPermission[]
  expiresAt: string | null
  autoDelete: boolean
}

export interface StorageQuota {
  enabled: boolean
  limitGB: number
  threshold: number
}

export interface StorageChannel {
  id?: number
  name: string
  type: UploadChannelType
  savePath?: string
  enabled: boolean
  fixed?: boolean
  quota?: StorageQuota
  botToken?: string
  chatId?: string
  proxyUrl?: string
  publicUrl?: string
  endpoint?: string
  cdnDomain?: string
  bucketName?: string
  region?: string
  accessKeyId?: string
  secretAccessKey?: string
  pathStyle?: boolean
  channelId?: string
  isNitro?: boolean
  repo?: string
  token?: string
  isPrivate?: boolean
  baseUrl?: string
  username?: string
  password?: string
  headers?: Record<string, string>
  createDirectory?: boolean
}

export interface StorageChannelGroup {
  channels: StorageChannel[]
  loadBalance?: { enabled: boolean; channels: string[] }
}

export type UploadSettings = Partial<Record<UploadChannelType, StorageChannelGroup>>

export interface QuotaStatsResponse {
  success: boolean
  quotaStats?: Record<string, { usedMB?: number; count?: number }>
  channelStats?: Record<string, { usedMB?: number; count?: number }>
  totalSizeMB?: number
  totalCount?: number
  lastUpdated?: number
}

export interface ConfigOption {
  label: string
  label_en?: string
  value: string
}

export interface ConfigField {
  id: string
  label: string
  label_en?: string
  placeholder?: string
  placeholder_en?: string
  tooltip?: string
  tooltip_en?: string
  type?: 'select' | 'boolean' | 'textarea' | 'number' | 'channelName'
  default?: unknown
  value?: unknown
  options?: ConfigOption[]
  category?: string
  category_en?: string
  fixed?: boolean
}

export interface PageSettings {
  config: ConfigField[]
  announcementRefreshAt?: number
  refreshAnnouncement?: boolean
  [key: string]: unknown
}

export interface SecuritySettings {
  auth: {
    user: { authCode: string; _hasPassword?: boolean; _clear?: boolean }
    admin: { adminUsername: string; adminPassword: string; _hasPassword?: boolean; _clear?: boolean }
  }
  access: {
    allowedDomains: string
    whiteListMode: boolean
    imageTransformEnabled: boolean
    imageTransformAllowedSizes: string
    sessionSecure: boolean
    userSessionMaxAge: number
    adminSessionMaxAge: number
  }
  upload: {
    moderate: {
      enabled: boolean
      channel: 'moderatecontent.com' | 'nsfwjs'
      moderateContentApiKey: string
      nsfwApiPath: string
    }
    ipQuery: {
      enabled: boolean
      channel: 'customApi'
      customApi: {
        url: string
        params: Array<{ key: string; value: string }>
        responseFields: string[]
      }
    }
  }
}

export interface UploadResponse {
  src: string
  publicUrl?: string
}
