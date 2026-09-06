import { createI18n } from 'vue-i18n'
import zhCN from './zh-CN.json'
import en from './en.json'

export type AppLocale = 'zh-CN' | 'en'
export const LOCALE_KEY = 'app-locale'

export function getStoredLocale(): AppLocale | undefined {
  const value = localStorage.getItem(LOCALE_KEY)
  return value === 'zh-CN' || value === 'en' ? value : undefined
}

export const i18n = createI18n({
  legacy: false,
  locale: getStoredLocale() || 'zh-CN',
  fallbackLocale: 'zh-CN',
  messages: { 'zh-CN': zhCN, en },
})

export function applyLocale(locale: AppLocale) {
  i18n.global.locale.value = locale
  localStorage.setItem(LOCALE_KEY, locale)
  document.documentElement.lang = locale
}
