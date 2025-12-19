<!--
 * @Author: zhiyixn
 * @Date: 2025-12-18 16:10:27
 * @LastEditors: zhiyixn
 * @LastEditTime: 2025-12-19 13:29:31
 * @FilePath: /Sanyue-ImgHub/src/components/Footer.vue
 * @Description: 
 * 
 * Copyright (c) 2025 by zhiyixn, All Rights Reserved. 
-->
<template>
    <div class="page-footer" v-if="!disableFooter">
        <p>© 2024-{{ thisYear }} Designed by <a class="footer-name" href="https://github.com/zhiyxn" target="_blank">zhiyixn</a> for You!
            <a :href="footerLink" target="_blank">
                <font-awesome-icon icon="paper-plane" class="footer-link-icon"/>
            </a>
        </p>
    </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
    name: 'Footer',
    computed: {
        ...mapGetters(['userConfig']),
        footerLink() {
            return this.userConfig?.footerLink || 'https://github.com/zhiyxn'
        },
        thisYear() {
            return new Date().getFullYear()
        },
        disableFooter() {
            return this.userConfig?.disableFooter || false
        }
    }
}
</script>

<style scoped>
.page-footer {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100vw;
    color: var(--page-footer-text-color);
    font-size: large;
    user-select: none;
}
@media (max-width: 768px) {
    .page-footer {
        font-size: small;
    }
}
.footer-name {
    color: var(--page-footer-name-color);
    font-weight: bold;
    text-decoration: none;
    position: relative;
    transition: all 0.3s ease;
}

.footer-name::after {
    content: '';
    position: absolute;
    width: 0;
    height: 2px;
    bottom: -2px;
    left: 0;
    background-color: var(--page-footer-name-color);
    transition: width 0.3s ease-in-out;
}

.footer-name:hover::after {
    width: 100%;
}

.footer-link-icon {
    color: var(--page-footer-name-color);
    margin-left: 5px;
    transition: transform 0.3s ease-in-out;
}

.footer-link-icon:hover {
    transform: scale(1.2) rotate(-12deg);
}
</style>