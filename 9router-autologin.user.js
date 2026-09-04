// ==UserScript==
// @name         9Router Auto Login
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Auto fill password and login for 9Router at localhost:20128
// @author       You
// @match        http://localhost:20128/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=localhost
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const PASSWORD = '123456';
    const maxAttempts = 40; // 20 giây
    let attempts = 0;
    let seenForm = false;
    let missingCount = 0;
    let lastClick = 0;

    // Setter gốc từ prototype — bypass value tracker của React
    const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
    ).set;

    const setInputValue = (input, value) => {
        nativeSetter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    };

    const autoLogin = () => {
        attempts++;
        if (attempts > maxAttempts) { clearInterval(loginInterval); return; }

        const passwordField = document.querySelector('input[type="password"]');

        // Form biến mất liên tục ~2s sau khi đã thấy form = login thành công, SPA unmount form
        if (!passwordField) {
            if (seenForm && ++missingCount >= 4) clearInterval(loginInterval);
            return;
        }
        seenForm = true;
        missingCount = 0;

        setInputValue(passwordField, PASSWORD);

        const loginBtn = Array.from(document.querySelectorAll('button'))
            .find(el => /đăng nhập|log\s*in/i.test(el.textContent));

        // Click lại tối đa mỗi 3s nếu lần trước fail; dừng nhờ cơ chế phát hiện form unmount ở trên
        if (loginBtn && !loginBtn.disabled && Date.now() - lastClick > 3000) {
            lastClick = Date.now();
            loginBtn.click();
        }
    };

    const loginInterval = setInterval(autoLogin, 500);
})();
