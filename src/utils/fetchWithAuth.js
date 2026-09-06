import router from '@/router'

let isRedirecting = false;

export default async function fetchWithAuth(url, options = {}) {
    // 确保包含凭据（HttpOnly Cookie 会自动携带）
    options.credentials = 'include';

    options.headers = {
        ...options.headers,
    };

    const response = await fetch(url, options);

    if (response.status === 401 && !isRedirecting) {
        isRedirecting = true;
        // 静默跳转登录页，不弹出错误提示（路由守卫负责认证 UX）
        router.push({ name: 'adminLogin', query: { redirect: router.currentRoute.value.fullPath } }).finally(() => {
            isRedirecting = false;
        });
    }

    return response;
}
