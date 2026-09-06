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
}

export interface PageSettings {
  config: ConfigField[]
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
  upload: Record<string, unknown>
}

export interface UploadResponse {
  src: string
  publicUrl?: string
}
