// ==UserScript==
// @name         Portal Speed Optimizer (Normal Use Lite) (Beta Test)
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Bản dùng bình thường: Lột sạch màu sắc, ảnh rác, hiệu ứng nặng nề để tăng tốc nhưng GIỮ LẠI toàn bộ tính năng và Menu. Tự động đăng nhập siêu tốc. (Phiên bản TEST)
// @author       You
// @match        *://new-portal1.hcmus.edu.vn/*
// @match        *://new-portal2.hcmus.edu.vn/*
// @match        *://new-portal3.hcmus.edu.vn/*
// @match        *://new-portal4.hcmus.edu.vn/*
// @icon         https://api.dicebear.com/7.x/bottts/png?seed=Flash&backgroundColor=cccccc
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // ==========================================
    // ⚠️ PHIÊN BẢN THỬ NGHIỆM (TEST VERSION)
    // Cảnh báo: Đây là phiên bản test đã lược bỏ thông tin đăng nhập cá nhân.
    // ==========================================

    const path = window.location.pathname.toLowerCase();
    const isLoginPage = path.includes('login');

    const style = document.createElement('style');
    style.textContent = `
        html, body, div, table, tbody, tr, td, th, span, p, form, input, select, textarea, iframe, header, footer, nav, aside, ul, li {
            background-color: #ffffff !important;
            background-image: none !important;
            color: #000000 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            text-shadow: none !important;
            transition: none !important;
            animation: none !important;
            font-family: monospace, system-ui !important;
        }
        a {
            background-color: transparent !important;
            background-image: none !important;
            color: #0055cc !important;
            text-decoration: none !important;
            font-family: monospace, system-ui !important;
        }
        a:hover {
            text-decoration: underline !important;
            color: #ff0000 !important;
        }
        table, td, th, input[type="text"], input[type="password"], textarea, select {
            border: 1px solid #aaaaaa !important;
            padding: 4px 6px !important;
        }
        input[type="submit"], button, .btn-primary, [id*="btn" i] {
            border: 1px solid #000000 !important;
            background-color: #e1e1e1 !important;
            padding: 4px 12px !important;
            font-weight: bold !important;
            cursor: pointer !important;
            color: #000000 !important;
        }
        svg, canvas, video, audio {
            display: none !important;
        }
        img:not([src*="aptcha" i]):not([id*="aptcha" i]):not([alt*="aptcha" i]) {
            display: none !important;
        }
        img[src*="aptcha" i], img[id*="aptcha" i], img[alt*="aptcha" i] {
            display: block !important;
            transform: scale(1.4) !important;
            transform-origin: left center !important;
            margin: 15px 0 !important;
            border: 2px solid #ef4444 !important;
        }
        div[id*="aptcha" i], div[class*="aptcha" i], span[id*="aptcha" i] {
            background-color: transparent !important;
            padding: 5px !important;
            border: 1px dashed #ef4444 !important;
            display: inline-block !important;
        }
        .wrapper, .main-container, .content-wrapper, .page-content {
            padding: 5px !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: none !important;
        }
    `;
    document.documentElement.appendChild(style);

    window.addEventListener('load', () => {
        if (!isLoginPage && !document.getElementById('custom-logout-btn')) {
            const btn = document.createElement('a');
            btn.id = 'custom-logout-btn';
            btn.href = '/Logout.aspx'; 
            btn.textContent = '🚪 Đăng xuất';
            btn.style.cssText = `
                position: fixed !important; top: 5px !important; right: 5px !important; z-index: 999999 !important;
                background: #ff4d4d !important; color: #ffffff !important; padding: 6px 10px !important;
                font-weight: bold !important; text-decoration: none !important; border: 2px solid #000000 !important;
            `;
            const realLogout = Array.from(document.querySelectorAll('a')).find(a => a.textContent.toLowerCase().includes('đăng xuất') || a.href.toLowerCase().includes('logout'));
            if (realLogout) btn.href = realLogout.href;
            document.body.appendChild(btn);
        }
    });

    const AUTO_USERNAME = localStorage.getItem('portal_user') || '';
    const AUTO_PASSWORD = localStorage.getItem('portal_pw') || '';

    const tryAutoLogin = () => {
        const passField = document.querySelector('input[type="password"]');
        if (!passField) return false;

        const form = passField.closest('form') || document;
        const userField = form.querySelector('input[type="text"]:not([readonly])');
        const nativeInputSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;

        if (userField && userField.value !== AUTO_USERNAME) {
            if (nativeInputSetter) nativeInputSetter.call(userField, AUTO_USERNAME);
            else userField.value = AUTO_USERNAME;
            userField.dispatchEvent(new Event('input', { bubbles: true }));
        }

        if (passField.value !== AUTO_PASSWORD) {
            if (nativeInputSetter) nativeInputSetter.call(passField, AUTO_PASSWORD);
            else passField.value = AUTO_PASSWORD;
            passField.dispatchEvent(new Event('input', { bubbles: true }));
        }

        const rememberCb = form.querySelector('input[type="checkbox"]');
        if (rememberCb && !rememberCb.checked) {
            rememberCb.checked = true;
            rememberCb.dispatchEvent(new Event('change', { bubbles: true }));
        }

        const hasCaptcha = !!document.querySelector('.g-recaptcha, [id*="recaptcha" i], [class*="captcha" i], iframe[src*="recaptcha" i]');
        if (!hasCaptcha) {
            const submitBtn = form.querySelector('input[type="submit"], button[type="submit"], .btn-login, .btn-primary');
            if (submitBtn) {
                console.log("🚀 [Portal Normal Mode] Auto-login fire!");
                submitBtn.click();
                return true;
            }
        }
        return false;
    };

    if (isLoginPage || path === '/') {
        if (!tryAutoLogin()) {
            const obs = new MutationObserver(() => {
                if (tryAutoLogin()) obs.disconnect();
            });
            obs.observe(document.documentElement, { childList: true, subtree: true });
            setTimeout(() => obs.disconnect(), 15000);
        }
    }

    const autoSubmitInterval = setInterval(() => {
        const recaptchaResponse = document.getElementById('g-recaptcha-response') || document.querySelector('[name="g-recaptcha-response"]');
        const hcaptchaResponse = document.querySelector('[name="h-captcha-response"]');
        
        if ((recaptchaResponse && recaptchaResponse.value.length > 0) || 
            (hcaptchaResponse && hcaptchaResponse.value.length > 0)) {
            const submitBtn = document.querySelector('input[type="submit"], button[type="submit"], .btn-login, .btn-primary, [id*="btn" i]');
            if (submitBtn) {
                console.log("🚀 [Portal Normal Mode] CAPTCHA solved! Auto submit...");
                submitBtn.click();
                clearInterval(autoSubmitInterval);
            }
        }
    }, 300);
    setTimeout(() => clearInterval(autoSubmitInterval), 60000);

    const captchaInterval = setInterval(() => {
        const captchaInput = document.querySelector('input[name*="aptcha" i], input[id*="aptcha" i], input[class*="aptcha" i], input[name*="apcha" i], input[id*="apcha" i]');
        if (captchaInput) {
            if (document.activeElement !== captchaInput) captchaInput.focus();

            if (!captchaInput.dataset.enterListener) {
                captchaInput.dataset.enterListener = "true";
                captchaInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        const form = captchaInput.closest('form');
                        const submitBtn = form ? form.querySelector('input[type="submit"], button[type="submit"], .btn-login, .btn-primary, [id*="btn" i]') : null;
                        if (submitBtn) submitBtn.click();
                        else if (form) form.submit();
                    }
                });
            }
        }
    }, 200);
    setTimeout(() => clearInterval(captchaInterval), 30000);

})();
