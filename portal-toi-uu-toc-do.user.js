// ==UserScript==
// @name         Portal Toi Uu Toc Do (Release)
// @namespace    http://tampermonkey.net/
// @version      2.8
// @description  Zero-delay auto login, Idle DOM Cleanup, Instant Redirect, Micro-optimized CSS va MutationObserver.
// @author       Lê Ngọc Tường
// @match        *://new-portal1.hcmus.edu.vn/*
// @match        *://new-portal2.hcmus.edu.vn/*
// @match        *://new-portal3.hcmus.edu.vn/*
// @match        *://new-portal4.hcmus.edu.vn/*
// @icon         https://api.dicebear.com/7.x/bottts/png?seed=Flash&backgroundColor=ffdf00
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const path = window.location.pathname.toLowerCase();
    const isRegistrationPage = path.includes('dangkyhocphan') || path.includes('ghidanh');
    const isLoginPage = path.includes('login') || !!document.querySelector('form[action*="login"]');

    // ═══════════════════════════════════════════════════════════════════════════
    // 0. ĐIỀU HƯỚNG TỨC THỜI (ZERO-DELAY REDIRECT - CÓ THỂ HỦY)
    // ═══════════════════════════════════════════════════════════════════════════
    if (!isLoginPage && !isRegistrationPage && sessionStorage.getItem('cancel_portal_redirect') !== 'true') {
        const redirectBanner = document.createElement('div');
        redirectBanner.id = 'custom-redirect-banner';
        redirectBanner.style.cssText = `
            position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; z-index: 9999999 !important;
            background: #ffc107 !important; color: #000000 !important; text-align: center !important; padding: 10px !important;
            font-weight: bold !important; font-size: 14px !important; border-bottom: 2px solid #000000 !important;
        `;
        redirectBanner.innerHTML = `🚀 Đang chuyển hướng sang Đăng Ký Học Phần... <button id="cancel-redirect-btn" style="background:#ff4d4d !important; color:#fff !important; border:1px solid #000 !important; padding:2px 8px !important; font-weight:bold !important; cursor:pointer !important; margin-left:15px !important;">Hủy (Vào Portal)</button>`;
        
        document.documentElement.appendChild(redirectBanner);
        
        const redirectTimeout = setTimeout(() => {
            window.location.replace(window.location.origin + '/DangKyHocPhan.aspx');
        }, 1500);

        const cancelAction = () => {
            clearTimeout(redirectTimeout);
            sessionStorage.setItem('cancel_portal_redirect', 'true');
            redirectBanner.remove();
            console.log("🚀 [Portal] Đã hủy tự động chuyển hướng.");
        };

        window.addEventListener('DOMContentLoaded', () => {
            const btn = document.getElementById('cancel-redirect-btn');
            if (btn) btn.onclick = cancelAction;
        });
        
        const observer = new MutationObserver(() => {
            const btn = document.getElementById('cancel-redirect-btn');
            if (btn && !btn.dataset.bound) {
                btn.dataset.bound = 'true';
                btn.onclick = cancelAction;
                observer.disconnect();
            }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
        return; 
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. CHÈN CSS SIÊU TỐC (Micro-Optimized)
    // ═══════════════════════════════════════════════════════════════════════════
    const style = document.createElement('style');
    style.textContent = `
        /* Khử background và style trên các thẻ chính siêu nhanh, không dùng :not */
        html, body, div, table, tbody, tr, td, span, p, a, form, input, select, textarea, iframe {
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

        /* CSS Override riêng cho các class chứa từ khóa captcha (nhanh hơn nhiều so với :not) */
        [id*="aptcha" i], [class*="aptcha" i], [name*="aptcha" i] {
            background-color: transparent !important;
        }

        /* Viền tối giản */
        td, th, input[type="text"], input[type="password"], textarea, select {
            border: 1px solid #000000 !important;
            padding: 4px 6px !important;
        }

        /* Định dạng thô sơ cho nút Đăng Nhập / Xác nhận */
        input[type="submit"], button, .btn-primary, [id*="btn" i] {
            border: 1px solid #000000 !important;
            background-color: #e1e1e1 !important;
            padding: 4px 12px !important;
            font-weight: bold !important;
            cursor: pointer !important;
        }

        /* Ẩn triệt để đa phương tiện (ngoại trừ captcha) */
        svg, canvas, video, audio {
            display: none !important;
        }

        img:not([src*="aptcha" i]):not([id*="aptcha" i]):not([alt*="aptcha" i]) {
            display: none !important;
        }

        /* Trực quan vùng CAPTCHA ĐKHP cho dễ nhập tay */
        div[id*="aptcha" i], div[class*="aptcha" i], span[id*="aptcha" i] {
            padding: 5px !important;
            border: 1px dashed #ef4444 !important;
            display: inline-block !important;
        }

        img[src*="aptcha" i], img[id*="aptcha" i], img[alt*="aptcha" i] {
            display: block !important;
            transform: scale(1.4) !important;
            transform-origin: left center !important;
            margin: 15px 0 !important;
            border: 2px solid #ef4444 !important;
            z-index: 99999 !important;
        }

        iframe:not([src*="recaptcha" i]):not([src*="hcaptcha" i]):not([src*="captcha" i]):not([src*="google" i]):not([src*="gstatic" i]) {
            display: none !important;
        }

        /* CHẶN UI THỪA & TEXT HƯỚNG DẪN BẰNG CSS CƠ BẢN */
        header, footer, nav, aside, hr,
        .sidebar, #sidebar, [class*="sidebar" i], [id*="sidebar" i],
        .navbar, #navbar, [class*="navbar" i], [id*="navbar" i],
        .menu, #menu, [class*="menu" i], [id*="menu" i],
        .header, #header, [class*="header" i], [id*="header" i],
        .footer, #footer, [class*="footer" i], [id*="footer" i],
        .breadcrumb, .page-title, .logo, #logo, [class*="logo" i],
        .banner, .slider, .carousel, [class*="banner" i],
        .news, .announcement, marquee, [class*="news" i],
        .help-block, .text-muted, .text-warning,
        .nav-tabs, h1, h2, h3, h4,
        div[class*="user-info" i], div[id*="user" i],
        a[href*="quenmatkhau" i], a[href*="forgot" i], a[href*="kichhoat" i], a[href*="help" i] {
            display: none !important;
        }

        /* Ẩn các nhãn rườm rà ở trang Đăng nhập */
        form[action*="login"] label, form[action*="login"] .text-danger, form[action*="login"] .validation-summary-errors {
            display: none !important;
        }

        /* Đưa form ra giữa, co dãn 100% */
        body, html, .wrapper, .main-container, .content-wrapper, .page-content, 
        div[class*="container"], div[id*="container"] {
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: none !important;
            border: none !important;
        }

        table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin: 10px 0 !important;
        }
    `;
    document.documentElement.appendChild(style);

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. KHÔI PHỤC NÚT ĐĂNG XUẤT NỔI LIÊN TỤC
    // ═══════════════════════════════════════════════════════════════════════════
    const injectLogoutBtn = () => {
        if (!isLoginPage && !document.getElementById('custom-logout-btn')) {
            const btn = document.createElement('a');
            btn.id = 'custom-logout-btn';
            btn.href = '/Logout.aspx'; 
            btn.textContent = '🚪 Đăng xuất';
            btn.style.cssText = `
                position: fixed !important; top: 10px !important; left: 10px !important; z-index: 999999 !important;
                background: #ff4d4d !important; color: #ffffff !important; padding: 8px 12px !important;
                font-weight: bold !important; text-decoration: none !important; border: 2px solid #000000 !important;
            `;
            const realLogout = Array.from(document.querySelectorAll('a')).find(a => a.textContent.toLowerCase().includes('đăng xuất') || a.href.toLowerCase().includes('logout'));
            if (realLogout) btn.href = realLogout.href;
            
            document.body.appendChild(btn);
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. JS DỌN DẸP UI (CHẠY KHI BROWSER IDLE, KHÔNG BLOCK MAIN THREAD)
    // ═══════════════════════════════════════════════════════════════════════════
    const cleanRedundantWithXPath = () => {
        injectLogoutBtn();
        
        const exactPhrases = [
            'Xem lịch thi', 'Tra cứu kết quả', 'Chuyên đề', 'Lịch sử ĐKHP', 
            'HCMUS Portal', 'Dashboard', 'HCMUS, ©', 
            'Bản quyền', 'SELAB', 'vận hành', 'Phiên bản'
        ];

        exactPhrases.forEach(phrase => {
            try {
                const xpath = `//*[text()[contains(., '${phrase}')]]`;
                const nodes = document.evaluate(xpath, document, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
                for (let i = 0; i < nodes.snapshotLength; i++) {
                    const node = nodes.snapshotItem(i);
                    if (['Xem lịch thi', 'Tra cứu kết quả', 'Chuyên đề', 'Lịch sử ĐKHP'].includes(phrase)) {
                        const td = node.closest('td');
                        if (td) td.style.setProperty('display', 'none', 'important');
                    } else {
                        node.style.setProperty('display', 'none', 'important');
                    }
                }
            } catch (e) {}
        });
    };

    window.addEventListener('load', () => {
        (window.requestIdleCallback || setTimeout)(() => {
            cleanRedundantWithXPath();
            console.log("🚀 [Portal Speed Optimizer] UI cleanup done (idle)");
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 4. ZERO-DELAY AUTO-LOGIN BẰNG MUTATION OBSERVER (ĐỌC TỪ LOCALSTORAGE)
    // ═══════════════════════════════════════════════════════════════════════════
    const AUTO_USERNAME = localStorage.getItem('portal_user') || '';
    const AUTO_PASSWORD = localStorage.getItem('portal_pw') || '';

    const tryAutoLogin = () => {
        if (!AUTO_USERNAME || !AUTO_PASSWORD) return false; // Không tự động đăng nhập nếu chưa cấu hình localStorage

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
                console.log("🚀 [Portal] Auto-login fire (Zero delay)!");
                submitBtn.click();
                return true;
            }
        }
        return false;
    };

    if (isLoginPage || path === '/') {
        const startObserving = (root) => {
            const obs = new MutationObserver(() => {
                if (tryAutoLogin()) obs.disconnect();
            });
            obs.observe(root, { childList: true, subtree: true });
            setTimeout(() => obs.disconnect(), 15000); 
            return obs;
        };

        if (!tryAutoLogin()) {
            if (document.body) {
                startObserving(document.body);
            } else {
                const bodyWatcher = new MutationObserver(() => {
                    if (document.body) {
                        bodyWatcher.disconnect();
                        if (!tryAutoLogin()) startObserving(document.body);
                    }
                });
                bodyWatcher.observe(document.documentElement, { childList: true });
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 5. AUTO-SUBMIT CAPTCHA KHI CÓ TOKEN TỪ EXTENSION
    // ═══════════════════════════════════════════════════════════════════════════
    if (isLoginPage || isRegistrationPage) {
        const autoSubmitInterval = setInterval(() => {
            const recaptchaResponse = document.getElementById('g-recaptcha-response') || document.querySelector('[name="g-recaptcha-response"]');
            const hcaptchaResponse = document.querySelector('[name="h-captcha-response"]');
            
            const isCaptchaSolved = (recaptchaResponse && recaptchaResponse.value.length > 0) || 
                                    (hcaptchaResponse && hcaptchaResponse.value.length > 0);
                                    
            if (isCaptchaSolved) {
                const submitBtn = document.querySelector('input[type="submit"], button[type="submit"], .btn-login, .btn-primary, [id*="btn" i]');
                if (submitBtn) {
                    console.log("🚀 [Portal] CAPTCHA solved! Auto submit...");
                    submitBtn.click();
                    clearInterval(autoSubmitInterval);
                }
            }
        }, 300);
        setTimeout(() => clearInterval(autoSubmitInterval), 60000);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 6. AUTO-FOCUS VÀ ENTER SUBMIT (CHỈ CHẠY TRÊN TRANG ĐKHP)
    // ═══════════════════════════════════════════════════════════════════════════
    if (isRegistrationPage) {
        const captchaInterval = setInterval(() => {
            const captchaInput = document.querySelector('input[name*="aptcha" i], input[id*="aptcha" i], input[class*="aptcha" i], input[name*="apcha" i], input[id*="apcha" i]');
            if (captchaInput) {
                if (document.activeElement !== captchaInput) {
                    captchaInput.focus();
                }

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
    }

})();
