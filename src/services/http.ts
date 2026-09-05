import axios, { AxiosError } from 'axios'

export const http = axios.create({
  // In development Vite proxies these same-origin paths to VITE_BACKEND_URL.
  // Keeping requests same-origin is required for HttpOnly session cookies.
  baseURL: '',
  timeout: 60_000,
  withCredentials: true,
  headers: {
    Accept: 'application/json',
  },
})

http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string; message?: string }>) => {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      '请求失败'
    return Promise.reject(new Error(message))
  },
)
