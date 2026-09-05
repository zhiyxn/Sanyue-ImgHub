import { createApp } from 'vue'
import { createPinia } from 'pinia'
import persistedState from 'pinia-plugin-persistedstate'
import App from './App.vue'
import router from './router'
import { i18n } from './locales'
import { useAppStore } from './stores/app'
import './styles/main.css'
import 'vue-sonner/style.css'

const app = createApp(App)
const pinia = createPinia()
pinia.use(persistedState)
app.use(pinia)
app.use(router)
app.use(i18n)

useAppStore().bootstrap().finally(() => app.mount('#app'))
