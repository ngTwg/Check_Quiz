// ==UserScript==
// @name         Auto DKHP Thong Minh (Release)
// @namespace    http://tampermonkey.net/
// @version      3.2
// @description  Tu dong dang ky hoc phan thong minh (Toi uu hoa toc do cuc han): uu tien lop, sniper mode, thong bao da kenh (Discord/Telegram/Pushbullet)
// @author       Lê Ngọc Tường
// @match        *://new-portal1.hcmus.edu.vn/*
// @match        *://new-portal2.hcmus.edu.vn/*
// @match        *://new-portal3.hcmus.edu.vn/*
// @match        *://new-portal4.hcmus.edu.vn/*
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
  const SNIPER_INTERVAL_MS  = 1000;          // Cực nhanh: 1 giây refresh sniper một lần
  const AUTO_REGISTER       = true;

  // ─── NOTIFICATION CONFIG (ĐIỀN TOKEN CỦA BẠN ĐỂ NHẬN TIN NHẮN) ─────────────
  const DISCORD_WEBHOOK_URL = '';
  const TELEGRAM_BOT_TOKEN  = '';
  const TELEGRAM_CHAT_ID    = '';
  const PUSHBULLET_TOKEN    = '';

  // ─── HIGHLIGHT COLORS & UI ─────────────────────────────────────────────────
  const COLOR_OK   = { bg: 'rgba(16,185,129,0.2)', border: '2px solid #10b981' };
  const COLOR_FULL = { bg: 'rgba(239,68,68,0.15)', border: '2px solid #ef4444' };
  const BOT_AVATAR = 'https://api.dicebear.com/7.x/bottts/svg?seed=DKHPBot&backgroundColor=b6e3f4'; // Avatar của Tool

  // ─── STATE ─────────────────────────────────────────────────────────────────
  let hasSubmitted = false;
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
    fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: `${title}\n\n${message}`, disable_web_page_preview: true })
    }).catch(e => console.error('[ĐKHP] Telegram fail:', e));
  }

  // Thay đổi sử dụng fetch gốc thay vì GM_xmlhttpRequest vì có thể chạy trực tiếp nếu được cấp quyền
  function sendPushbullet(title, message) {
    if (!PUSHBULLET_TOKEN) return;
    GM_xmlhttpRequest({
      method: 'POST', url: 'https://api.pushbullet.com/v2/pushes',
      headers: { 'Access-Token': PUSHBULLET_TOKEN, 'Content-Type': 'application/json' },
      data: JSON.stringify({ type: 'note', title, body: message }),
      onerror: e => console.error('[ĐKHP] Pushbullet fail:', e)
    });
  }

  function sendDiscord(title, description, color = 0x3b82f6) {
    if (!DISCORD_WEBHOOK_URL) return;
    fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'ĐKHP Bot', embeds: [{ title, description, color, footer: { text: 'Auto ĐKHP | Bản Công Khai' }, timestamp: new Date().toISOString() }] })
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
    const logoutBtn = Array.from(document.querySelectorAll('a')).find(a => a.href.toLowerCase().includes('logout') || a.textContent.toLowerCase().includes('đăng xuất'));
    if (logoutBtn) {
      logoutBtn.click();
    } else {
      window.location.href = window.location.origin + '/Logout.aspx';
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
      const matchColon = text.match(/(\d{1,2}):(\d{2})/);
      if (matchColon) {
        const minutes = parseInt(matchColon[1], 10);
        const seconds = parseInt(matchColon[2], 10);
        if (minutes <= 15) {
          return minutes * 60 + seconds;
        }
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
      GM_notification({ title: '🚨 ĐKHP SESSION GIÁN ĐOẠN!', text: reason, timeout: 15000 });
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
    const fieldset = table.closest('fieldset');
    if (fieldset && fieldset.querySelector('legend') && fieldset.querySelector('legend').textContent.toLowerCase().includes('đã đăng ký')) return true;
    if (table.querySelector('caption') && table.querySelector('caption').textContent.toLowerCase().includes('đã đăng ký')) return true;
    if (table.previousElementSibling && table.previousElementSibling.textContent.toLowerCase().includes('đã đăng ký')) return true;
    if (table.textContent.toLowerCase().includes('hủy đăng ký')) return true;
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
      if (isRegisteredTable(table)) return;

      table.querySelectorAll('tr').forEach(row => {
        if (row.querySelector('th')) return;
        const cells = row.querySelectorAll('td');
        if (cells.length < 6) return;

        const courseCode = cells[0].textContent.trim();
        if (!/^[a-zA-Z0-9_-]+$/.test(courseCode)) return;

        const checkbox = row.querySelector('input[type="checkbox"]');

        rows.push({
          courseCode: courseCode,
          courseName: cells[1].textContent.trim(),
          className: cells[2].textContent.trim(),
          maxSlots: parseInt(cells[4].textContent.trim()) || 0,
          registered: parseInt(cells[5].textContent.trim()) || 0,
          checkbox,
          row,
          isDisabled: checkbox ? (checkbox.disabled || checkbox.getAttribute('disabled') !== null) : false,
          get remaining() { return this.maxSlots - this.registered; }
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
        GM_notification({ title: '⚠️ SẮP HẾT THỜI GIAN ĐĂNG KÝ!', text: `Còn ${remainingTime} giây. Hãy chuẩn bị giải CAPTCHA mới!`, timeout: 10000 });
        notifyAll('⚠️ SẮP HẾT THỜI GIAN ĐĂNG KÝ!', `Phiên đăng ký học phần chỉ còn ${remainingTime} giây.\nChuẩn bị giải CAPTCHA mới để tiếp tục sniper.`, 0xf59e0b);
      }
      if (remainingTime > 60) {
        GM_setValue('dkhp_timer_warned', false);
      }
    }

    for (const target of TARGET_COURSES) {
      const code = target.courseCode.toLowerCase();

      if (alreadyRegistered.has(code)) {
        results.push({ target, status: 'already', chosen: null, reason: 'Đã đăng ký trước đó' });
        continue;
      }

      const courseRows = availableRows.filter(r => r.courseCode.toLowerCase() === code);
      if (courseRows.length === 0) {
        results.push({ target, status: 'not_found', chosen: null, reason: 'Không tìm thấy' });
        continue;
      }

      const p1 = target.priority1 ? courseRows.find(r => r.className.toLowerCase() === target.priority1.toLowerCase()) : null;
      const p2 = target.priority2 ? courseRows.find(r => r.className.toLowerCase() === target.priority2.toLowerCase()) : null;

      let chosen = null;
      let reason = '';

      const checkFull = (item) => {
        if (!item) return true;
        const hasBlackCell = Array.from(item.row.querySelectorAll('td')).some(td => {
          const bg = window.getComputedStyle(td).backgroundColor;
          const inlineStr = td.getAttribute('style') || '';
          return bg === 'rgb(0, 0, 0)' || bg === 'black' || inlineStr.toLowerCase().includes('black');
        });
        return item.remaining <= 0 || item.isDisabled || hasBlackCell;
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
        chosen.row.style.setProperty('background-color', COLOR_OK.bg, 'important');
        chosen.row.style.setProperty('border', COLOR_OK.border, 'important');
        results.push({ target, status: 'checked', chosen: chosen.className, reason });
      } else {
        [p1, p2].forEach(r => {
          if (r) {
            r.row.style.setProperty('background-color', COLOR_FULL.bg, 'important');
            r.row.style.setProperty('border', COLOR_FULL.border, 'important');
            addFullTag(r.row);
          }
        });
        pendingCourses.push(target);
        results.push({ target, status: 'pending', chosen: null, reason });
      }
    }

    if (isRegistrationPage) {
      const checkedResults = results.filter(r => r.status === 'checked');
      if (AUTO_REGISTER && checkedAny && !hasSubmitted) {
        if (registerBtn) {
          const manualCaptcha = document.querySelector('input[name*="aptcha" i], input[id*="aptcha" i], input[class*="aptcha" i]');
          
          if (manualCaptcha && manualCaptcha.value.trim() === '') {
              console.log("🚀 [ĐKHP] Đã tick xong môn. Chờ user gõ Captcha và ấn Enter...");
              showToast(`🎯 Đã chọn xong môn ưu tiên! Hãy nhập CAPTCHA và ấn Enter.`, 'info', 5000);
              manualCaptcha.focus();
          } else {
              hasSubmitted = true;
              registerBtn.click();

              const summary = checkedResults.map(r => `• ${r.target.name}: ${r.chosen} — ${r.reason}`).join('\n');
              showToast(`Đang gửi đăng ký ${checkedResults.length} môn...`, 'success', 3000);
              notifyAll(
                '🎉 ĐÃ GỬI ĐĂNG KÝ HỌC PHẦN!',
                `Đăng ký thành công ${checkedResults.length}/${TARGET_COURSES.length} môn:\n${summary}` +
                (pendingCourses.length > 0 ? `\n\n🔫 Còn ${pendingCourses.length} môn chưa đăng ký được → SNIPER MODE` : '\n\n✅ Tất cả môn đã đăng ký!')
              );
          }
        }
      }

      if (pendingCourses.length > 0) {
        GM_setValue('dkhp_sniper_active', true);
        GM_setValue('dkhp_sniper_pending', JSON.stringify(pendingCourses.map(c => c.courseCode)));

        const pendingMsg = pendingCourses.map(c => `• ${c.name || c.courseCode} (P1: ${c.priority1}, P2: ${c.priority2 || 'N/A'})`).join('\n');

        if (!sniperNotified) {
          GM_setValue('dkhp_sniper_notified', true);
          showToast(`🔫 SNIPER: Đang canh ${pendingCourses.length} môn. Refresh mỗi ${SNIPER_INTERVAL_MS/1000}s...`, 'warning', 5000);
          notifyAll(
            '🔫 SNIPER MODE ACTIVATED!',
            `${pendingCourses.length} môn chưa đăng ký được (tất cả lớp đều full):\n${pendingMsg}\n\nĐang auto-refresh ngẫu nhiên để canh slot trống...`
          );
        }

        showSniperBadge(pendingCourses.length, remainingTime);

        // Reload ngẫu nhiên quanh SNIPER_INTERVAL_MS để tránh bot detection
        const randomizedDelay = SNIPER_INTERVAL_MS + Math.floor(Math.random() * 1000);
        setTimeout(() => {
          location.reload();
        }, randomizedDelay);
      } else {
        const wasSniper = GM_getValue('dkhp_sniper_active', false);
        GM_setValue('dkhp_sniper_active', false);
        GM_setValue('dkhp_sniper_notified', false);

        if (wasSniper) {
          showToast('✅ Tất cả môn đã đăng ký! Sniper đã tắt.', 'success', 10000);
          notifyAll('✅ SNIPER HOÀN TẤT — TẤT CẢ MÔN ĐÃ ĐĂNG KÝ!', `Tất cả ${TARGET_COURSES.length} môn đã được đăng ký thành công.`);
        }
      }
    } else {
      console.log('[ĐKHP] Đang ở trang xem thông tin lớp mở. Đã tô màu nhận diện.');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── HELPERS ───────────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  function findRegisterButton() {
    return Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]')).find(btn => {
      const text = (btn.innerText || btn.value || btn.textContent || '').toLowerCase();
      return (text.includes('đăng ký') || text.includes('lưu') || text.includes('submit')) && !text.includes('hủy');
    });
  }

  function addFullTag(row) {
    if (row.querySelector('.dkhp-full-tag')) return;
    const tag = document.createElement('span');
    tag.className = 'dkhp-full-tag';
    tag.style.cssText = 'display:inline-block;background:#ef4444;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;margin-left:8px;animation:dkhp-pulse 1.5s infinite;';
    tag.textContent = 'FULL';
    const td = row.querySelector('td');
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
          <span style="font-size:11px;opacity:.9">${count} môn pending | Refresh ${SNIPER_INTERVAL_MS/1000}s${timeStr}</span><br>
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
  style.textContent = `@keyframes dkhp-pulse { 0%,100%{opacity:1} 50%{opacity:.6} }`;
  if (document.head) {
    document.head.appendChild(style);
  } else {
    const observer = new MutationObserver(() => {
      if (document.head) {
        document.head.appendChild(style);
        observer.disconnect();
      }
    });
    observer.observe(document.documentElement, { childList: true });
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

  let scanTimeout = null;
  const observer = new MutationObserver(() => {
    if (scanTimeout) clearTimeout(scanTimeout);
    scanTimeout = setTimeout(() => {
      if (!hasSubmitted && document.querySelectorAll('table tr').length > 2) {
        scanAndRegister();
      }
    }, 150);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
