// ==UserScript==
// @name         Auto DKHP Thong Minh
// @namespace    http://tampermonkey.net/
// @version      3.2.1
// @description  Tu dong dang ky hoc phan thong minh (Toi uu hoa toc do cuc han): uu tien lop, sniper mode, thong bao da kenh (Discord/Telegram/Pushbullet)
// @author       You
// @match        *://new-portal*.hcmus.edu.vn/*
// @match        *://new-portal1.hcmus.edu.vn/*
// @match        *://new-portal2.hcmus.edu.vn/*
// @match        *://new-portal3.hcmus.edu.vn/*
// @match        *://new-portal4.hcmus.edu.vn/*
// @match        *://new-portal5.hcmus.edu.vn/*
// @match        *://new-portal6.hcmus.edu.vn/*
// @match        *://new-portal7.hcmus.edu.vn/*
// @match        *://new-portal8.hcmus.edu.vn/*
// @match        *://new-portal9.hcmus.edu.vn/*
// @match        *://new-portal10.hcmus.edu.vn/*
// @match        *://new-portal11.hcmus.edu.vn/*
// @match        *://new-portal12.hcmus.edu.vn/*
// @match        *://new-portal13.hcmus.edu.vn/*
// @match        *://new-portal14.hcmus.edu.vn/*
// @match        *://new-portal15.hcmus.edu.vn/*
// @match        *://new-portal16.hcmus.edu.vn/*
// @match        *://new-portal17.hcmus.edu.vn/*
// @match        *://new-portal18.hcmus.edu.vn/*
// @match        *://new-portal19.hcmus.edu.vn/*
// @match        *://new-portal20.hcmus.edu.vn/*
// @icon         https://api.dicebear.com/7.x/bottts/png?seed=DKHPBot&backgroundColor=b6e3f4
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_notification
// @grant        GM_xmlhttpRequest
// @run-at       document-start
// @connect      discord.com
// @connect      api.telegram.org
// @connect      api.pushbullet.com
// ==/UserScript==

(function () {
  'use strict';

  // Prevent script execution in iframes
  if (window.top !== window.self) return;

  // FIX: chi bypass dialog trong cua so ngan quanh thao tac cua script.
  // Override toan cuc se nuot ca canh bao that (vd "Huy dang ky?", "Trung lich").
  const _nativeAlert = window.alert;
  const _nativeConfirm = window.confirm;
  let _dialogBypassUntil = 0;
  function withDialogBypass(fn, ms = 2000) {
    _dialogBypassUntil = Date.now() + ms;
    try { return fn(); } finally { setTimeout(() => { _dialogBypassUntil = 0; }, ms); }
  }
  try {
    window.alert = function(msg) {
      if (Date.now() < _dialogBypassUntil) { console.log('[DKHP] alert bypass:', msg); return true; }
      return _nativeAlert.call(window, msg);
    };
  } catch(e) {}
  try {
    window.confirm = function(msg) {
      if (Date.now() < _dialogBypassUntil) { console.log('[DKHP] confirm bypass:', msg); return true; }
      return _nativeConfirm.call(window, msg);
    };
  } catch(e) {}

  // Safe JSON POST: fetch with GM_xmlhttpRequest fallback for CSP/legacy pages
  function postJSON(url, body) {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(body);
      const xhr = {
        method: 'POST', url: url, headers: { 'Content-Type': 'application/json' }, data: payload,
        // FIX: GM_xhr resolve ca khi HTTP 4xx/5xx -> phai kiem tra status
        onload: (r) => {
          if (r && typeof r.status === 'number' && r.status >= 400) {
            console.error('[ĐKHP] POST that bai HTTP', r.status, (r.responseText || '').slice(0, 200));
            reject(new Error('HTTP ' + r.status));
            return;
          }
          resolve(r);
        },
        onerror: reject
      };
      if (typeof fetch !== 'undefined') {
        fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload })
          .then((res) => {
            // FIX: fetch KHONG reject khi 4xx/5xx -> truoc day loi bi nuot im lang
            if (!res || !res.ok) {
              console.warn('[ĐKHP] POST tra ve HTTP', res && res.status, '-> fallback GM_xhr');
              GM_xmlhttpRequest(xhr);
              return;
            }
            resolve(res);
          })
          .catch((err) => { console.warn('[ĐKHP] fetch failed, fallback GM_xhr:', err); GM_xmlhttpRequest(xhr); });
      } else {
        GM_xmlhttpRequest(xhr);
      }
    });
  }

  function gmNotify(title, text, timeout = 15000) {
    try { GM_notification({ title, text, timeout }); } catch(e) { console.log('[ĐKHP] GM_notification unavailable'); }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── CẤU HÌNH MÔN HỌC (ĐIỀN MÔN CỦA BẠN VÀO ĐÂY) ───────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  const TARGET_COURSES = [
    // Ví dụ cấu hình mẫu:
    // { courseCode: 'MÃ_MÔN_HỌC', priority1: 'TÊN_LỚP_ƯU_TIÊN_1', priority2: 'TÊN_LỚP_ƯU_TIÊN_2', name: 'Tên gợi nhớ môn' },
    { courseCode: 'BAA00003', priority1: '24DTV_DKD1', priority2: '24DTV_DKD2', name: 'Tư tưởng HCM' },
  ];

  // ─── THÔNG SỐ (TỐI ƯU TỐC ĐỘ) ──────────────────────────────────────────────
  const SLOT_THRESHOLD      = 5;             // Còn ≤5 slot → chuyển ưu tiên 2
  const SNIPER_INTERVAL_MS  = GM_getValue('dkhp_sniper_interval_ms', 1800); // FIX: 1.8s + jitter thay cho 1s co dinh (chong rate-limit/WAF)
  const SNIPER_MAX_BACKOFF_MS = 30000;
  function nextSniperDelay() {
    const fails = GM_getValue('dkhp_sniper_fail_streak', 0);
    const base = Math.min(SNIPER_INTERVAL_MS * Math.pow(2, fails), SNIPER_MAX_BACKOFF_MS);
    return Math.round(base * (0.85 + Math.random() * 0.3)); // jitter +-15%
  }
  const AUTO_REGISTER       = true;

  // ─── NOTIFICATION CONFIG (ĐIỀN TOKEN CỦA BẠN ĐỂ NHẬN TIN NHẮN) ─────────────
  const DISCORD_WEBHOOK_URL = GM_getValue('dkhp_discord_webhook_url', '');
  const TELEGRAM_BOT_TOKEN  = GM_getValue('dkhp_telegram_bot_token', '');
  const TELEGRAM_CHAT_ID    = GM_getValue('dkhp_telegram_chat_id', '');
  const PUSHBULLET_TOKEN    = GM_getValue('dkhp_pushbullet_token', '');

  // ─── HIGHLIGHT COLORS & UI ─────────────────────────────────────────────────
  const COLOR_OK   = { bg: '#a7f3d0', border: '3px solid #059669', text: '#064e3b' }; // Xanh ngọc nổi bật
  const COLOR_FULL = { bg: '#fecaca', border: '2px solid #dc2626', text: '#991b1b' }; // Đỏ cảnh báo
  const BOT_AVATAR = 'https://api.dicebear.com/7.x/bottts/svg?seed=DKHPBot&backgroundColor=b6e3f4'; // Avatar của Tool

  // ─── STATE ─────────────────────────────────────────────────────────────────
  let hasSubmitted = false;
  // FIX: khai bao som de tranh TDZ ReferenceError khi guard 403/503 goi observer.disconnect()
  let observer = null;
  let sniperStopped = false;
  // FIX: chong double-submit song sot qua location.reload() cua sniper
  const SUBMIT_LOCK_KEY = 'dkhp_submit_lock_ts';
  const SUBMIT_LOCK_MS = 60000;
  function submitLocked() { return Date.now() - GM_getValue(SUBMIT_LOCK_KEY, 0) < SUBMIT_LOCK_MS; }
  let sessionAlerted = false;

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── TOAST UI ──────────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  function showToast(msg, type = 'info', duration = 5000) {
    if (!document.body) return;
    const container = document.getElementById('dkhp-toast-box') || (() => {
      const c = document.createElement('div');
      c.id = 'dkhp-toast-box';
      c.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999999;display:flex;flex-direction:column;gap:10px;max-width:420px;';
      document.body.appendChild(c);
      return c;
    })();
    const colors = { info:'#3b82f6', success:'#10b981', error:'#ef4444', warning:'#f59e0b' };
    const icons  = { info:'ℹ️', success:'✅', error:'❌', warning:'⚠️' };
    const t = document.createElement('div');
    t.style.cssText = `background:${colors[type]||colors.info};color:#fff;padding:12px 18px;border-radius:10px;font-size:13px;box-shadow:0 6px 20px rgba(0,0,0,.2);font-family:system-ui,sans-serif;min-width:250px;opacity:0;transform:translateX(100px);transition:all .4s cubic-bezier(.16,1,.3,1);line-height:1.5;word-break:break-word;`;
    t.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;">
        <img src="${BOT_AVATAR}" style="width:36px;height:36px;border-radius:50%;background:#fff;border:2px solid rgba(255,255,255,0.5);flex-shrink:0;">
        <div>
          <span style="margin-right:4px">${icons[type]||''}</span>${msg}
        </div>
      </div>
    `;
    container.appendChild(t);
    requestAnimationFrame(() => { t.style.opacity='1'; t.style.transform='translateX(0)'; });
    setTimeout(() => { t.style.opacity='0'; t.style.transform='translateX(100px)'; setTimeout(()=>t.remove(),400); }, duration);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── NOTIFICATION CHANNELS (FIRE & FORGET) ─────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  function sendTelegram(title, message) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
    postJSON(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID, text: `${title}\n\n${message}`, disable_web_page_preview: true
    }).catch(e => console.error('[ĐKHP] Telegram fail:', e));
  }

  function sendPushbullet(title, message) {
    if (!PUSHBULLET_TOKEN) return;
    GM_xmlhttpRequest({
      method: 'POST', url: 'https://api.pushbullet.com/v2/pushes',
      headers: { 'Access-Token': PUSHBULLET_TOKEN, 'Content-Type': 'application/json' },
      data: JSON.stringify({ type: 'note', title, body: message }),
      // FIX: truoc day khong co onload -> khong biet push that bai
      onload: r => {
        if (r && r.status >= 400) console.error('[ĐKHP] Pushbullet HTTP', r.status, (r.responseText || '').slice(0, 200));
      },
      onerror: e => console.error('[ĐKHP] Pushbullet fail:', e)
    });
  }

  function sendDiscord(title, description, color = 0x3b82f6) {
    if (!DISCORD_WEBHOOK_URL) return;
    postJSON(DISCORD_WEBHOOK_URL, {
      username: 'ĐKHP Bot', embeds: [{ title, description, color, footer: { text: 'Auto ĐKHP' }, timestamp: new Date().toISOString() }]
    }).catch(e => console.error('[ĐKHP] Discord fail:', e));
  }

  // ─── PHÁT PHÁT NHANH PHÁT TẤT CẢ KÊNH ───
  function notifyAll(title, message, color = 0x3b82f6) {
    sendDiscord(title, message, color);
    sendTelegram(title, message);
    sendPushbullet(title, message);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── SESSION GUARD ─────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  function forceSessionReset() {
    console.log('[ĐKHP] Đang thực hiện reset session chủ động...');
    try {
      const logoutBtn = Array.from(document.querySelectorAll('a')).find(a => a.href.toLowerCase().includes('logout') || a.textContent.toLowerCase().includes('đăng xuất'));
      if (logoutBtn) {
        logoutBtn.click();
      } else {
        window.location.assign(window.location.origin + '/Logout.aspx');
      }
    } catch (e) {
      window.location.assign(window.location.origin + '/Logout.aspx');
    }
  }

  function getRemainingTime() {
    if (!document.body) return null;
    const elements = document.querySelectorAll('span, div, p, td, th, b, strong');
    for (const el of elements) {
      if (el.children.length > 0) continue;
      const text = el.textContent.trim();
      const matchVn = text.match(/(\d+)\s*phút\s*(\d+)\s*giây/i);
      if (matchVn) {
        return parseInt(matchVn[1], 10) * 60 + parseInt(matchVn[2], 10);
      }
      // FIX: chi nhan dinh dang HH:MM khi element that su la dong ho dem nguoc,
      // neu khong se bat nham gio trong bang lich (vd "07:30").
      const ctxText = text + ' ' + (el.parentElement ? el.parentElement.textContent : '');
      const isCountdownCtx = /còn lại|thời gian|hết hạn|đếm ngược|countdown|remaining/i.test(ctxText);
      const matchColon = isCountdownCtx ? text.match(/^\D{0,20}(\d{1,2}):(\d{2})(?::(\d{2}))?\D{0,20}$/) : null;
      if (matchColon) {
        const a = parseInt(matchColon[1], 10);
        const b = parseInt(matchColon[2], 10);
        const c = matchColon[3] ? parseInt(matchColon[3], 10) : null;
        if (c !== null) return a * 3600 + b * 60 + c;
        if (a <= 15) return a * 60 + b;
      }
    }
    return null;
  }

  function checkSession() {
    if (!document.body) return false;
    const bodyText = document.body.textContent.toLowerCase();
    const hasCaptcha = bodyText.includes('captcha') || bodyText.includes('mã xác nhận') ||
                       bodyText.includes('mã bảo mật') || !!document.querySelector('img[src*="captcha"]');
    const isLogin = location.href.toLowerCase().includes('login') || !!document.querySelector('form[action*="login"]');
    const isExpired = bodyText.includes('hết thời gian đăng ký') || 
                      bodyText.includes('hết giờ đăng ký') || 
                      bodyText.includes('phiên làm việc đã hết hạn') ||
                      bodyText.includes('hết hạn đăng ký') ||
                      bodyText.includes('hết hạn phiên') ||
                      bodyText.includes('yêu cầu đăng nhập');

    if (hasCaptcha || isLogin || isExpired) {
      if (sessionAlerted) return true;
      sessionAlerted = true;

      let reason = '🔓 Bị logout';
      if (hasCaptcha) reason = '🔒 Captcha xuất hiện';
      if (isExpired) reason = '⌛ Hết hạn 10 phút đăng ký';

      GM_setValue('dkhp_sniper_active', false);
      showToast(`${reason} — Cần đăng nhập / giải CAPTCHA lại!`, 'error', 30000);
      gmNotify('🚨 ĐKHP SESSION GIÁN ĐOẠN!', reason, 15000);
      notifyAll('🚨 ĐKHP SESSION GIÁN ĐOẠN!', `${reason}\n\nHãy đăng nhập/giải CAPTCHA lại và tiếp tục chạy script.\nTrang: ${location.href}`, 0xef4444);

      if (isExpired) {
        setTimeout(() => {
          forceSessionReset();
        }, 2000);
      }
      return true;
    }
    return false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── TABLE PARSER ────────────────────────────────══════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════
  function isRegisteredTable(table) {
    // Không bao giờ nhận diện nhầm bảng chứa checkbox là bảng đã đăng ký
    if (table.querySelector('input[type="checkbox"]')) return false;

    // 1. Kiểm tra fieldset legend (Giống trong ảnh chụp màn hình)
    const fieldset = table.closest('fieldset');
    if (fieldset && fieldset.querySelector('legend') && fieldset.querySelector('legend').textContent.toLowerCase().includes('đã đăng ký')) return true;
    // 2. Kiểm tra caption của table
    if (table.querySelector('caption') && table.querySelector('caption').textContent.toLowerCase().includes('đã đăng ký')) return true;
    // 3. Kiểm tra sibling trước đó
    if (table.previousElementSibling && table.previousElementSibling.textContent.toLowerCase().includes('đã đăng ký')) return true;
    // 4. Kiểm tra nút hủy bên trong table
    if (table.textContent.toLowerCase().includes('hủy đăng ký')) return true;
    // 5. Kiểm tra nút hủy ngay bên dưới table
    if (table.nextElementSibling && table.nextElementSibling.textContent.toLowerCase().includes('hủy đăng ký')) return true;

    return false;
  }

  function getRegisteredCourses() {
    const registered = new Set();
    document.querySelectorAll('table').forEach(table => {
      if (isRegisteredTable(table)) {
        table.querySelectorAll('tr').forEach(row => {
          if (row.querySelector('th')) return;
          const cells = row.querySelectorAll('td');
          if (cells.length >= 3) {
            const code = cells[0].textContent.trim().toLowerCase();
            if (/^[a-z0-9_-]+$/.test(code)) registered.add(code);
          }
        });
      }
    });
    return registered;
  }

  function getAvailableRows() {
    const rows = [];
    document.querySelectorAll('table').forEach(table => {
      // Bỏ qua bảng đã đăng ký
      if (isRegisteredTable(table)) return;

      table.querySelectorAll('tr').forEach(row => {
        if (row.querySelector('th')) return;
        const cells = row.querySelectorAll('td');
        if (cells.length < 3) return;

        // Tìm checkbox trong hàng nếu có
        const checkbox = row.querySelector('input[type="checkbox"]');

        // Tìm cell chứa mã môn: thường là cell 0 hoặc cell 1 (nếu cell 0 là STT/Checkbox)
        let courseCode = '';
        let courseName = '';
        let className = '';
        let maxSlots = 0;
        let registered = 0;

        for (let i = 0; i < Math.min(cells.length, 3); i++) {
          const text = cells[i].textContent.trim();
          if (/^[a-zA-Z0-9_-]{5,}$/.test(text)) {
            courseCode = text;
            courseName = (cells[i + 1] ? cells[i + 1].textContent.trim() : '');
            className = (cells[i + 2] ? cells[i + 2].textContent.trim() : '');
            break;
          }
        }

        if (!courseCode) {
          // Fallback nếu mã môn ngắn hơn 5 ký tự
          const firstText = cells[0].textContent.trim();
          if (/^[a-zA-Z0-9_-]+$/.test(firstText) && !/^\d+$/.test(firstText)) {
            courseCode = firstText;
            courseName = cells[1] ? cells[1].textContent.trim() : '';
            className = cells[2] ? cells[2].textContent.trim() : '';
          }
        }

        if (!courseCode) return;

        // Quét các cột số để tìm slot
        for (let j = 3; j < cells.length; j++) {
          const val = parseInt(cells[j].textContent.trim(), 10);
          if (!isNaN(val)) {
            if (maxSlots === 0) maxSlots = val;
            else if (registered === 0) registered = val;
          }
        }

        rows.push({
          courseCode: courseCode,
          courseName: courseName,
          className: className,
          maxSlots: maxSlots,
          registered: registered,
          checkbox,
          row,
          isDisabled: checkbox ? (checkbox.disabled || checkbox.getAttribute('disabled') !== null) : false,
          get remaining() { return this.maxSlots > 0 ? (this.maxSlots - this.registered) : 999; }
        });
      });
    });
    return rows;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── CORE: SMART REGISTRATION (CỰC NHANH - ĐỒNG BỘ) ────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  function scanAndRegister() {
    if (checkSession()) return;

    // Fail-safe: stop if portal returns server errors to avoid IP/rate ban
    if (document.body) {
      const bodyTextLower = document.body.textContent.toLowerCase();
      if (bodyTextLower.includes('403 forbidden') || bodyTextLower.includes('503 service unavailable') || bodyTextLower.includes('service unavailable')) {
        showToast('⛔ Portal báo lỗi server (403/503). Dừng script để tránh bị ban.', 'error', 30000);
        notifyAll('⛔ DỪNG HOẠT ĐỘNG', 'Phát hiện lỗi server. Vui lòng chờ portal ổn định.', 0xef4444);
        // FIX: chan moi vong reload sau nay + tang backoff, va khong con TDZ
        sniperStopped = true;
        GM_setValue('dkhp_sniper_active', false);
        GM_setValue('dkhp_sniper_fail_streak', GM_getValue('dkhp_sniper_fail_streak', 0) + 1);
        if (observer) observer.disconnect();
        return;
      }
      // Trang binh thuong -> reset backoff
      if (GM_getValue('dkhp_sniper_fail_streak', 0) !== 0) GM_setValue('dkhp_sniper_fail_streak', 0);
    }

    const alreadyRegistered = getRegisteredCourses();
    const availableRows = getAvailableRows();
    if (availableRows.length === 0) return;

    const results = [];
    let checkedAny = false;
    const pendingCourses = [];
    const sniperNotified = GM_getValue('dkhp_sniper_notified', false);
    const registerBtn = findRegisterButton();
    const isRegistrationPage = availableRows.some(r => r.checkbox) || !!registerBtn;

    const remainingTime = getRemainingTime();
    if (remainingTime !== null) {
      if (remainingTime <= 60 && !GM_getValue('dkhp_timer_warned', false)) {
        GM_setValue('dkhp_timer_warned', true);
        showToast(`⚠️ Sắp hết 10 phút đăng ký (còn ${remainingTime}s). Chuẩn bị giải CAPTCHA!`, 'warning', 15000);
        gmNotify('⚠️ SẮP HẾT THỜI GIAN ĐĂNG KÝ!', `Còn ${remainingTime} giây. Hãy chuẩn bị giải CAPTCHA mới!`, 10000);
        notifyAll('⚠️ SẮP HẾT THỜI GIAN ĐĂNG KÝ!', `Phiên đăng ký học phần chỉ còn ${remainingTime} giây.\nChuẩn bị giải CAPTCHA mới để tiếp tục sniper.`, 0xf59e0b);
      }
      if (remainingTime > 60) {
        GM_setValue('dkhp_timer_warned', false);
      }
    }

    for (const target of TARGET_COURSES) {
      const code = target.courseCode.toLowerCase();

      const isAlreadyRegistered = Array.from(alreadyRegistered).some(reg => {
        const regLower = reg.toLowerCase();
        return regLower === code || (target.name && regLower.includes(target.name.toLowerCase()));
      });
      if (isAlreadyRegistered) {
        results.push({ target, status: 'already', chosen: null, reason: 'Đã đăng ký trước đó' });
        continue;
      }

      // 1. Ưu tiên khớp chính xác theo Mã môn học (ETC10130, ETC10131, ETC10128, ETC10129, ETC10309, ETC10329)
      let courseRows = availableRows.filter(r => {
        return r.courseCode.trim().toLowerCase() === target.courseCode.trim().toLowerCase();
      });

      // 2. Dự phòng nếu mã môn bị sai/đổi: khớp theo tên môn (phân biệt TH và LT)
      if (courseRows.length === 0 && target.name) {
        courseRows = availableRows.filter(r => {
          const isTargetTH = target.name.toLowerCase().includes('thực hành');
          const isRowTH = r.courseName.toLowerCase().includes('thực hành');
          if (isTargetTH !== isRowTH) return false;

          const rowName = r.courseName.toLowerCase();
          const targetName = target.name.toLowerCase();
          return rowName.includes(targetName) || targetName.includes(rowName);
        });
      }

      if (courseRows.length === 0) {
        results.push({ target, status: 'not_found', chosen: null, reason: 'Không tìm thấy' });
        continue;
      }

      const p1 = target.priority1 ? courseRows.find(r => r.className.toLowerCase() === target.priority1.toLowerCase()) : null;
      const p2 = target.priority2 ? courseRows.find(r => r.className.toLowerCase() === target.priority2.toLowerCase()) : null;

      let chosen = null;
      let reason = '';

      // Kiểm tra lớp full dựa trên slot trống, checkbox disabled, hoặc ô TCHS bôi đen
      const checkFull = (item) => {
        if (!item) return true;
        const rowText = item.row.textContent.toLowerCase();
        const hasFullText = /hết chỗ|full|hết slot|0\s*slot|đã đầy|closed/i.test(rowText);
        const hasBlackCell = Array.from(item.row.querySelectorAll('td')).some(td => {
          const bg = window.getComputedStyle(td).backgroundColor;
          // FIX: khong phu thuoc rieng computed style (script toi uu toc do co the ep nen trang).
          // Doc them inline style, thuoc tinh bgcolor va data-orig-bg.
          const inlineStr = (td.getAttribute('style') || '') + ' ' +
                            (td.getAttribute('bgcolor') || '') + ' ' +
                            (td.dataset ? (td.dataset.origBg || '') : '');
          return bg === 'rgb(0, 0, 0)' || bg === 'black' || /black|#000000|#000\b/i.test(inlineStr);
        });
        return item.remaining <= 0 || item.isDisabled || hasBlackCell || hasFullText;
      };

      const isP1Full = checkFull(p1);

      if (p1 && !isP1Full) {
        if (p1.remaining > SLOT_THRESHOLD) {
          chosen = p1;
          reason = `✅ Ưu tiên 1 (còn ${p1.remaining} slot)`;
        } else {
          const isP2Full = checkFull(p2);
          if (p2 && !isP2Full) {
            chosen = p2;
            reason = `⚠️ Ưu tiên 1 còn ít (${p1.remaining} slot) → chuyển ưu tiên 2 (${p2.remaining})`;
          } else {
            chosen = p1;
            reason = `⚠️ Buộc dùng ưu tiên 1 (còn ${p1.remaining} slot, ưu tiên 2 không khả dụng)`;
          }
        }
      } else {
        const isP2Full = checkFull(p2);
        if (p2 && !isP2Full) {
          chosen = p2;
          reason = `🔄 Ưu tiên 1 full → chuyển ưu tiên 2 (${p2.remaining} slot)`;
        } else {
          reason = `⛔ Cả 2 đều full`;
        }
      }

      if (chosen) {
        if (isRegistrationPage && chosen.checkbox && !chosen.checkbox.checked) {
          chosen.checkbox.checked = true;
          chosen.checkbox.dispatchEvent(new Event('change', { bubbles: true }));
          checkedAny = true;
        }
        chosen.row.classList.add('dkhp-row-ok');
        chosen.row.setAttribute('data-dkhp-state', 'ok');
        chosen.row.style.setProperty('background-color', '#a7f3d0', 'important');
        chosen.row.querySelectorAll('td').forEach(td => {
          td.style.setProperty('background-color', '#a7f3d0', 'important');
          td.style.setProperty('color', '#064e3b', 'important');
          td.style.setProperty('font-weight', 'bold', 'important');
          td.style.setProperty('border-top', '3px solid #059669', 'important');
          td.style.setProperty('border-bottom', '3px solid #059669', 'important');
        });
        addStatusTag(chosen.row, '✅ ĐÃ CHỌN', '#059669');
        results.push({ target, status: 'checked', chosen: chosen.className, reason });
      } else {
        [p1, p2].forEach(r => {
          if (r) {
            r.row.classList.add('dkhp-row-full');
            r.row.setAttribute('data-dkhp-state', 'full');
            r.row.style.setProperty('background-color', '#fecaca', 'important');
            r.row.querySelectorAll('td').forEach(td => {
              td.style.setProperty('background-color', '#fecaca', 'important');
              td.style.setProperty('color', '#991b1b', 'important');
              td.style.setProperty('border-top', '2px solid #dc2626', 'important');
              td.style.setProperty('border-bottom', '2px solid #dc2626', 'important');
            });
            addStatusTag(r.row, '⛔ FULL', '#dc2626');
          }
        });
        pendingCourses.push(target);
        results.push({ target, status: 'pending', chosen: null, reason });
      }
    }

    // Chỉ thực hiện đăng ký và reload sniper nếu đang ở trang đăng ký học phần thực sự
    if (isRegistrationPage) {
      // ─── ĐĂNG KÝ NGAY LẬP TỨC ────────────────────────────────────────────────
      const checkedResults = results.filter(r => r.status === 'checked');
      if (AUTO_REGISTER && checkedAny && !hasSubmitted && !submitLocked()) {
        if (registerBtn) {
          // KIỂM TRA CAPTCHA TRƯỚC KHI AUTO-SUBMIT
          const manualCaptcha = document.querySelector('input[name*="aptcha" i], input[id*="aptcha" i], input[class*="aptcha" i]');
          
          if (manualCaptcha && manualCaptcha.value.trim() === '') {
              // Có captcha chưa nhập -> KHÔNG auto-submit, để user tự gõ và ấn Enter
              console.log("🚀 [ĐKHP] Đã tick xong môn. Chờ user gõ Captcha và ấn Enter...");
              showToast(`🎯 Đã chọn xong môn ưu tiên! Hãy nhập CAPTCHA và ấn Enter.`, 'info', 5000);
              manualCaptcha.focus(); // Đảm bảo con trỏ nháy luôn ở đó
          } else {
              // Không có captcha hoặc đã nhập -> Bắn luôn
              hasSubmitted = true;
              GM_setValue(SUBMIT_LOCK_KEY, Date.now()); // FIX: khoa 60s, song sot qua reload
              withDialogBypass(() => registerBtn.click()); // FIX: chi bypass dialog dung luc click

              const summary = checkedResults.map(r => `• ${r.target.name}: ${r.chosen} — ${r.reason}`).join('\n');
              showToast(`Đang gửi đăng ký ${checkedResults.length} môn...`, 'success', 3000);
              notifyAll(
                '🎉 ĐÃ GỬI ĐĂNG KÝ HỌC PHẦN!',
                `Đăng ký thành công ${checkedResults.length}/${TARGET_COURSES.length} môn:\n${summary}` +
                (pendingCourses.length > 0 ? `\n\n🔫 Còn ${pendingCourses.length} môn chưa đăng ký được → SNIPER MODE` : '\n\n✅ Tất cả môn đã đăng ký!') +
                `\n\nTrang: ${location.href}`,
                0x10b981
              );
          }
        }
      }

      // ─── SNIPER MODE ─────────────────────────────────────────────────────────
      if (pendingCourses.length > 0) {
        GM_setValue('dkhp_sniper_active', true);
        GM_setValue('dkhp_sniper_pending', JSON.stringify(pendingCourses.map(c => c.courseCode)));

        const pendingMsg = pendingCourses.map(c => `• ${c.name || c.courseCode} (P1: ${c.priority1}, P2: ${c.priority2 || 'N/A'})`).join('\n');

        if (!sniperNotified) {
          GM_setValue('dkhp_sniper_notified', true);
          showToast(`🔫 SNIPER: Đang canh ${pendingCourses.length} môn. Refresh mỗi ${SNIPER_INTERVAL_MS/1000}s...`, 'warning', 5000);
          notifyAll(
            '🔫 SNIPER MODE ACTIVATED!',
            `${pendingCourses.length} môn chưa đăng ký được (tất cả lớp đều full):\n${pendingMsg}\n\nĐang auto-refresh mỗi ${SNIPER_INTERVAL_MS/1000} giây để canh slot trống...`,
            0xf59e0b
          );
        }

        showSniperBadge(pendingCourses.length, remainingTime);

        // FIX: reload co jitter + exponential backoff, va dung han khi guard kich hoat
        if (!sniperStopped) {
          setTimeout(() => {
            if (!sniperStopped) location.reload();
          }, nextSniperDelay());
        }
      } else {
        const wasSniper = GM_getValue('dkhp_sniper_active', false);
        GM_setValue('dkhp_sniper_active', false);
        GM_setValue('dkhp_sniper_notified', false);

        if (wasSniper) {
          showToast('✅ Tất cả môn đã đăng ký! Sniper đã tắt.', 'success', 10000);
          notifyAll('✅ SNIPER HOÀN TẤT — TẤT CẢ MÔN ĐÃ ĐĂNG KÝ!', `Tất cả ${TARGET_COURSES.length} môn đã được đăng ký thành công.`, 0x10b981);
        }
      }
    } else {
      // Chỉ tô màu nếu là trang xem cứu thông tin (Danh sách lớp mở)
      console.log('[ĐKHP] Đang ở trang xem thông tin lớp mở. Đã tô màu nhận diện.');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── HELPERS ───────────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  function findRegisterButton() {
    return Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], input[type="image"]')).find(btn => {
      const text = (btn.innerText || btn.value || btn.getAttribute('aria-label') || btn.textContent || '').toLowerCase();
      return (text.includes('đăng ký') || text.includes('lưu') || text.includes('submit') || text.includes('gửi')) && !text.includes('hủy');
    });
  }

  function addStatusTag(row, text, color) {
    if (row.querySelector('.dkhp-status-tag')) {
      const existing = row.querySelector('.dkhp-status-tag');
      existing.textContent = text;
      existing.style.background = color;
      return;
    }
    const tag = document.createElement('span');
    tag.className = 'dkhp-status-tag';
    tag.style.cssText = `display:inline-block;background:${color};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;margin-left:8px;box-shadow:0 2px 5px rgba(0,0,0,0.2);animation:dkhp-pulse 1.5s infinite;`;
    tag.textContent = text;
    const td = row.querySelector('td:nth-child(2)') || row.querySelector('td');
    if (td) td.appendChild(tag);
  }

  function showSniperBadge(count, remainingTime = null) {
    let timeStr = '';
    if (remainingTime !== null) {
      const mins = Math.floor(remainingTime / 60);
      const secs = remainingTime % 60;
      timeStr = `<br>⏱️ Hạn ĐK: <b>${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}</b>`;
    }

    let badge = document.getElementById('dkhp-sniper-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'dkhp-sniper-badge';
      badge.style.cssText = 'position:fixed;bottom:15px;right:15px;z-index:999999;background:rgba(245,158,11,0.95);color:#fff;padding:12px 18px;border-radius:12px;font-size:13px;font-family:system-ui,sans-serif;box-shadow:0 4px 15px rgba(0,0,0,.15);backdrop-filter:blur(8px);animation:dkhp-pulse 1.5s infinite;cursor:pointer;line-height:1.5;';
      document.body.appendChild(badge);
    }

    badge.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;">
        <img src="${BOT_AVATAR}" style="width:44px;height:44px;border-radius:50%;background:#fff;border:2px solid rgba(255,255,255,0.5);flex-shrink:0;">
        <div style="text-align:left;">
          🔫 <b>SNIPER ACTIVE</b><br>
          <span style="font-size:11px;opacity:.9">${count} môn pending | Refresh ~${(SNIPER_INTERVAL_MS/1000).toFixed(1)}s${timeStr}</span><br>
          <span style="font-size:10px;opacity:.7">Click để dừng</span>
        </div>
      </div>
    `;
    badge.onclick = () => {
      if (confirm('Tắt Sniper Mode?')) {
        GM_setValue('dkhp_sniper_active', false);
        GM_setValue('dkhp_sniper_notified', false);
        badge.remove();
        showToast('Sniper Mode đã tắt.', 'info');
      }
    };
  }

  // ─── INJECT CSS ────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    @keyframes dkhp-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.7;transform:scale(0.96)} }
    table tr[data-dkhp-state="ok"],
    table tr.dkhp-row-ok,
    table tr[data-dkhp-state="ok"] > td,
    table tr.dkhp-row-ok > td {
      background-color: #a7f3d0 !important;
      color: #064e3b !important;
      border-top: 3px solid #059669 !important;
      border-bottom: 3px solid #059669 !important;
      font-weight: bold !important;
    }
    table tr[data-dkhp-state="full"],
    table tr.dkhp-row-full,
    table tr[data-dkhp-state="full"] > td,
    table tr.dkhp-row-full > td {
      background-color: #fecaca !important;
      color: #991b1b !important;
      border-top: 2px solid #dc2626 !important;
      border-bottom: 2px solid #dc2626 !important;
    }
  `;
  if (document.head) {
    document.head.appendChild(style);
  } else {
    const headObserver = new MutationObserver(() => {
      if (document.head) {
        document.head.appendChild(style);
        headObserver.disconnect();
      }
    });
    headObserver.observe(document.documentElement, { childList: true });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── INIT ──────────────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  function init() {
    const hasTables = document.querySelectorAll('table').length > 0;
    if (hasTables) {
      scanAndRegister();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // MutationObserver siêu tốc (debounce chỉ 10ms để hứng AJAX nhanh nhất)
  let scanTimeout = null;
  observer = new MutationObserver(() => {
    if (scanTimeout) clearTimeout(scanTimeout);
    scanTimeout = setTimeout(() => {
      if (!hasSubmitted && document.querySelectorAll('table tr').length > 2) {
        try { scanAndRegister(); } catch (err) { console.error('[ĐKHP] Scan crash:', err); }
      }
    }, 150); // Đã tăng lên 150ms để chống treo CPU trình duyệt lúc nước sôi lửa bỏng
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
