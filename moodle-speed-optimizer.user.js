// ==UserScript==
// @name         Moodle Speed Optimizer (Max Performance) (Beta Test)
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Tối ưu hóa Moodle HCMUS: Lột bỏ giao diện thừa, animation rườm rà, tập trung 100% tốc độ để vào bài học/thi nhanh nhất. Auto-Login. (Phiên bản TEST)
// @author       Lê Ngọc Tường
// @match        *://courses.hcmus.edu.vn/*
// @match        *://moodle.hcmus.edu.vn/*
// @icon         https://api.dicebear.com/7.x/bottts/png?seed=MoodleFast&backgroundColor=00aadd
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // ==========================================
    // ⚠️ PHIÊN BẢN THỬ NGHIỆM (TEST VERSION)
    // Cảnh báo: Đây là phiên bản test đã lược bỏ thông tin đăng nhập cá nhân.
    // ==========================================

    const style = document.createElement('style');
    style.textContent = `
        *, *::before, *::after {
            box-shadow: none !important;
            border-radius: 0 !important;
            text-shadow: none !important;
            transition: none !important;
            animation: none !important;
            background-image: none !important;
            font-family: monospace, system-ui !important;
        }
        body, html, #page, #page-wrapper {
            background-color: #ffffff !important;
            color: #000000 !important;
        }
        a {
            color: #0055cc !important;
            text-decoration: none !important;
            background-color: transparent !important;
        }
        a:hover {
            color: #ff0000 !important;
            text-decoration: underline !important;
        }
        section[data-region="blocks-column"], 
        #block-region-side-pre, 
        #block-region-side-post,
        .block-region {
            display: none !important;
        }
        #region-main-box, #region-main, #page-content, .course-content {
            width: 100% !important;
            max-width: 100% !important;
            padding: 5px !important;
            margin: 0 !important;
            border: none !important;
        }
        footer, #page-footer, .sitelink, .logininfo, .homelink, .page-header-image {
            display: none !important;
        }
        img:not(.img-responsive):not(.atto_image_button_text-bottom):not([src*="draftfile.php"]):not([src*="pluginfile.php"]) {
            display: none !important;
        }
        .carousel-item, .page-header-image, [class*="banner" i] {
            display: none !important;
        }
    `;
    document.documentElement.appendChild(style);

    const AUTO_USERNAME = localStorage.getItem('portal_user') || '';
    const AUTO_PASSWORD = localStorage.getItem('portal_pw') || '';

    const tryMoodleLogin = () => {
        const userField = document.getElementById('username');
        const passField = document.getElementById('password');
        const loginBtn = document.getElementById('loginbtn');

        if (userField && passField && loginBtn) {
            const nativeInputSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
            
            if (userField.value !== AUTO_USERNAME) {
                if (nativeInputSetter) nativeInputSetter.call(userField, AUTO_USERNAME);
                else userField.value = AUTO_USERNAME;
                userField.dispatchEvent(new Event('input', { bubbles: true }));
            }

            if (passField.value !== AUTO_PASSWORD) {
                if (nativeInputSetter) nativeInputSetter.call(passField, AUTO_PASSWORD);
                else passField.value = AUTO_PASSWORD;
                passField.dispatchEvent(new Event('input', { bubbles: true }));
            }

            console.log("🚀 [Moodle Fast] Auto-login fire!");
            loginBtn.click();
            return true;
        }

        const ssoBtn = document.querySelector('.potentialidp a.btn, a[href*="auth/saml2/login.php"], a[href*="auth/oidc/login.php"]');
        if (ssoBtn) {
            console.log("🚀 [Moodle Fast] Redirecting to SSO Login...");
            ssoBtn.click();
            return true;
        }

        const topLoginBtn = document.querySelector('.login a[href*="login/index.php"]');
        if (topLoginBtn && window.location.pathname === '/') {
            topLoginBtn.click();
            return true;
        }

        return false;
    };

    const path = window.location.pathname.toLowerCase();
    const isLoginPage = path.includes('login/index.php');

    if (isLoginPage || path === '/') {
        const startObserving = (root) => {
            const obs = new MutationObserver(() => {
                if (tryMoodleLogin()) obs.disconnect();
            });
            obs.observe(root, { childList: true, subtree: true });
            setTimeout(() => obs.disconnect(), 10000); 
            return obs;
        };

        if (!tryMoodleLogin()) {
            if (document.body) {
                startObserving(document.body);
            } else {
                const bodyWatcher = new MutationObserver(() => {
                    if (document.body) {
                        bodyWatcher.disconnect();
                        if (!tryMoodleLogin()) startObserving(document.body);
                    }
                });
                bodyWatcher.observe(document.documentElement, { childList: true });
            }
        }
    }

})();
