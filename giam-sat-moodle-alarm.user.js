// ==UserScript==
// @name         Giam Sat Quiz Moodle (Alarm Edition)
// @namespace    http://tampermonkey.net/
// @version      4.0-alarm
// @description  Tu dong phat hien quiz Moodle moi, co chuong bao thuc keu lien tuc (sawtooth wave) cho den khi tat hoac het han quiz
// @author       You
// @match        *://courses.hcmus.edu.vn/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=moodle.org
// @require      https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js
// @grant        GM_notification
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// @connect      discord.com
// @connect      api.telegram.org
// @connect      api.pushbullet.com
// ==/UserScript==

(function () {
  'use strict';
  const CHECK_INTERVAL_MS   = 1 * 60 * 1000;   
  const WEBHOOK_URL         = '';   
  const MAX_RETRY           = 3;                
  const RETRY_DELAY_MS      = 5000;             
  const WEBHOOK_COOLDOWN_MS = 2000;             
  const STALE_DAYS          = 30;               
  const SESSION_PING_KEY    = 'moodle_session_warned';
  const TELEGRAM_BOT_TOKEN  = '';   
  const TELEGRAM_CHAT_ID    = '';   
  const PUSHBULLET_TOKEN    = '';   
  let seenMap = {};
  try {
    seenMap = JSON.parse(GM_getValue('moodle_quiz_seen_v2', '{}'));
  } catch (e) {
    seenMap = {};
  }
  let lastWebhookTime = 0;
  let webhookQueue    = [];
  let queueRunning    = false;
  let countdownTimer  = null;
  let secondsRemaining = CHECK_INTERVAL_MS / 1000;
  let keepRedUntil = 0;

  // Web Audio Alarm Engine
  let alarmAudioContext = null;
  let alarmInterval = null;
  let alarmOverlay = null;

  function playAnnoyingAlarm(deadlineTimestamp) {
    if (alarmInterval) return; // Already running
    try {
      alarmAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.error('[Alarm] Web Audio API not supported:', e);
      return;
    }

    alarmInterval = setInterval(() => {
      // Check if deadline expired to auto-stop
      if (deadlineTimestamp && (Math.floor(Date.now() / 1000) >= deadlineTimestamp)) {
        console.log('[Alarm] Quiz expired. Auto-stopping alarm.');
        stopAnnoyingAlarm();
        return;
      }

      try {
        if (!alarmAudioContext) return;
        if (alarmAudioContext.state === 'suspended') {
          alarmAudioContext.resume();
        }
        
        // Annoying dual-tone siren using sawtooth waves
        const now = alarmAudioContext.currentTime;
        
        const osc1 = alarmAudioContext.createOscillator();
        const osc2 = alarmAudioContext.createOscillator();
        const gainNode = alarmAudioContext.createGain();

        osc1.type = 'sawtooth';
        osc2.type = 'square';

        // Grating sound sweeping frequency
        const sweepFreq = 800 + Math.sin(Date.now() / 80) * 400;
        osc1.frequency.setValueAtTime(sweepFreq, now);
        osc2.frequency.setValueAtTime(sweepFreq * 1.5, now);

        gainNode.gain.setValueAtTime(0.8, now); // Max volume 80% (safety but annoying)
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(alarmAudioContext.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.38);
        osc2.stop(now + 0.38);
      } catch (err) {
        console.error('[Alarm] Error playing synthesizer tone:', err);
      }
    }, 150);
  }

  function stopAnnoyingAlarm() {
    if (alarmInterval) {
      clearInterval(alarmInterval);
      alarmInterval = null;
    }
    if (alarmAudioContext) {
      try {
        alarmAudioContext.close();
      } catch (e) {}
      alarmAudioContext = null;
    }
    if (alarmOverlay) {
      try {
        alarmOverlay.remove();
      } catch (e) {}
      alarmOverlay = null;
    }
  }

  function showAlarmOverlay(quizName, quizUrl) {
    if (document.getElementById('moodle-watcher-alarm-overlay')) return;
    
    alarmOverlay = document.createElement('div');
    alarmOverlay.id = 'moodle-watcher-alarm-overlay';
    alarmOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(239, 68, 68, 0.95);
      z-index: 9999999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: white;
      font-family: system-ui, -apple-system, sans-serif;
      animation: flashRed 0.4s infinite alternate;
    `;
    
    if (!document.getElementById('alarm-animation-style')) {
      const style = document.createElement('style');
      style.id = 'alarm-animation-style';
      style.innerHTML = `
        @keyframes flashRed {
          from { background: rgba(239, 68, 68, 0.95); }
          to { background: rgba(185, 28, 28, 0.98); }
        }
      `;
      document.head.appendChild(style);
    }
    
    alarmOverlay.innerHTML = `
      <div style="text-align: center; max-width: 600px; padding: 20px;">
        <h1 style="font-size: 48px; margin-bottom: 20px; text-shadow: 0 4px 10px rgba(0,0,0,0.3);">🚨 CÓ QUIZ MỚI! 🚨</h1>
        <p style="font-size: 24px; margin-bottom: 30px; line-height: 1.5; font-weight: 600;">${quizName}</p>
        <div style="display: flex; gap: 20px; justify-content: center;">
          <a href="${quizUrl}" target="_blank" id="alarm-go-btn" style="background: white; color: #b91c1c; padding: 15px 30px; border-radius: 8px; font-weight: bold; text-decoration: none; font-size: 18px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">VÀO LÀM BÀI</a>
          <button id="alarm-dismiss-btn" style="background: #1f2937; color: white; border: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 18px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">TẮT BÁO THỨC</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(alarmOverlay);
    
    document.getElementById('alarm-dismiss-btn').addEventListener('click', () => {
      stopAnnoyingAlarm();
    });
    
    document.getElementById('alarm-go-btn').addEventListener('click', () => {
      stopAnnoyingAlarm();
    });
  }

  function saveState() {
    const cutoff = Date.now() - STALE_DAYS * 86400000;
    Object.keys(seenMap).forEach((id) => {
      const t = new Date(seenMap[id].detectedAt).getTime();
      if (!isNaN(t) && t < cutoff) delete seenMap[id];
    });
    GM_setValue('moodle_quiz_seen_v2', JSON.stringify(seenMap));
    updateBadge();
  }
  function resetState() {
    if (!confirm('Xoá toàn bộ danh sách quiz đã theo dõi?\nLần scan tiếp sẽ gửi lại TẤT CẢ quiz.')) return;
    seenMap = {};
    saveState();
    showToast('Reset tracked items successfully', 'success');
  }
  function showToast(msg, type = 'info') {
    const container = document.getElementById('moodle-watcher-toast-container') || (() => {
      const c = document.createElement('div');
      c.id = 'moodle-watcher-toast-container';
      c.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999999;display:flex;flex-direction:column;gap:10px;';
      document.body.appendChild(c);
      return c;
    })();
    const toast = document.createElement('div');
    let bg = '#3b82f6'; 
    if (type === 'success') bg = '#10b981'; 
    if (type === 'error') bg = '#ef4444'; 
    if (type === 'warning') bg = '#f59e0b'; 
    toast.style.cssText = `
      background:${bg};
      color:white;
      padding:10px 16px;
      border-radius:8px;
      font-size:13px;
      box-shadow:0 4px 12px rgba(0,0,0,0.15);
      font-family:system-ui, -apple-system, sans-serif;
      min-width: 200px;
      opacity: 0;
      transform: translateY(-20px);
      transition: all 0.3s ease;
    `;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    }, 10);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-20px)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
  function enqueueWebhook(payload, isFormData = false, attempt = 1) {
    webhookQueue.push({ payload, isFormData, attempt });
    if (!queueRunning) runQueue();
  }
  function runQueue() {
    if (!webhookQueue.length) { queueRunning = false; return; }
    queueRunning = true;
    const now  = Date.now();
    const wait = Math.max(0, lastWebhookTime + WEBHOOK_COOLDOWN_MS - now);
    setTimeout(() => {
      const { payload, isFormData, attempt } = webhookQueue.shift();
      lastWebhookTime = Date.now();
      const fetchOptions = {
        method: 'POST'
      };
      if (isFormData) {
        fetchOptions.body = payload; 
      } else {
        fetchOptions.headers = { 'Content-Type': 'application/json' };
        fetchOptions.body = JSON.stringify(payload);
      }
      fetch(WEBHOOK_URL, fetchOptions)
      .then(res => {
        console.log('[Monitor] Webhook status:', res.status);
        if (res.status === 429) {
          let retryAfter = RETRY_DELAY_MS;
          res.json().then(data => {
            if (data.retry_after) retryAfter = data.retry_after * 1000;
            console.warn('[Monitor] Rate limited, retry in', retryAfter, 'ms');
            setTimeout(() => { webhookQueue.unshift({ payload, isFormData, attempt }); runQueue(); }, retryAfter);
          }).catch(() => {
            setTimeout(() => { webhookQueue.unshift({ payload, isFormData, attempt }); runQueue(); }, retryAfter);
          });
        } else if (res.status >= 400) {
          res.text().then(body => {
            console.error('[Monitor] Webhook error response body:', body);
            if (res.status >= 500 && attempt <= MAX_RETRY) {
              console.warn('[Monitor] Server error', res.status, ', retrying...');
              setTimeout(() => { webhookQueue.unshift({ payload, isFormData, attempt: attempt + 1 }); runQueue(); }, RETRY_DELAY_MS);
            } else {
              runQueue();
            }
          }).catch(() => {
            runQueue();
          });
        } else {
          runQueue();
        }
      })
      .catch(err => {
        console.error('[Monitor] Webhook network error:', err);
        if (attempt <= MAX_RETRY) {
          setTimeout(() => { webhookQueue.unshift({ payload, isFormData, attempt: attempt + 1 }); runQueue(); }, RETRY_DELAY_MS);
        } else {
          runQueue();
        }
      });
    }, wait);
  }
  function captureIframeScreenshot(url, callback) {
    let callbackCalled = false;
    const triggerCallback = (val) => {
      if (callbackCalled) return;
      callbackCalled = true;
      callback(val);
    };
    try {
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;top:0;left:-9999px;width:1280px;height:1024px;z-index:-9999;display:block !important;';
      iframe.src = url;
      document.body.appendChild(iframe);
      let loaded = false;
      let cleanupDone = false;
      const cleanup = () => {
        if (cleanupDone) return;
        cleanupDone = true;
        try { iframe.remove(); } catch {}
      };
      setTimeout(() => {
        if (!cleanupDone) {
          cleanup();
          triggerCallback(null);
        }
      }, 15000);
      iframe.onload = () => {
        if (loaded) return;
        loaded = true;
        iframe.onload = null;
        setTimeout(() => {
          try {
            const iframeDoc = iframe.contentWindow.document;
            html2canvas(iframeDoc.body, {
              useCORS: true,
              allowTaint: true,
              scale: 0.8,
              window: iframe.contentWindow,
              document: iframeDoc
            }).then(canvas => {
              canvas.toBlob(blob => {
                cleanup();
                triggerCallback(blob);
              }, 'image/png');
            }).catch(err => {
              console.error('[Monitor] Iframe html2canvas failed:', err);
              cleanup();
              triggerCallback(null);
            });
          } catch (e) {
            console.error('[Monitor] Iframe html2canvas sync crash:', e);
            cleanup();
            triggerCallback(null);
          }
        }, 2000);
      };
      iframe.onerror = () => {
        cleanup();
        triggerCallback(null);
      };
    } catch (err) {
      console.error('[Monitor] Iframe creation crash:', err);
      triggerCallback(null);
    }
  }
  function extractNotificationContent(embed) {
    const title = (embed.title || '').replace(/\*\*/g, '');
    let desc = (embed.description || '').replace(/\*\*/g, '');
    desc = desc.replace(/<t:(\d+):[FRDTtfd]>/g, (_, ts) => {
      return new Date(parseInt(ts) * 1000).toLocaleString('vi-VN');
    });
    return { title, desc };
  }
  function sendTelegramNotification(title, message, blob = null) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return Promise.resolve();
    if (blob) {
      const caption = `${title}\n\n${message}`.substring(0, 1024);
      const formData = new FormData();
      formData.append('chat_id', TELEGRAM_CHAT_ID);
      formData.append('caption', caption);
      formData.append('photo', blob, 'screenshot.png');
      return fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
        method: 'POST',
        body: formData
      })
      .then(res => console.log('[Monitor] Telegram sendPhoto status:', res.status))
      .catch(err => console.error('[Monitor] Telegram sendPhoto failed:', err));
    }
    return fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: `${title}\n\n${message}`,
        disable_web_page_preview: true
      })
    })
    .then(res => console.log('[Monitor] Telegram sendMessage status:', res.status))
    .catch(err => console.error('[Monitor] Telegram sendMessage failed:', err));
  }
  function sendPushbulletNotification(title, message) {
    if (!PUSHBULLET_TOKEN) return Promise.resolve();
    return new Promise((resolve) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url: 'https://api.pushbullet.com/v2/pushes',
        headers: {
          'Access-Token': PUSHBULLET_TOKEN,
          'Content-Type': 'application/json'
        },
        data: JSON.stringify({
          type: 'note',
          title: title,
          body: message
        }),
        onload: (res) => {
          console.log('[Monitor] Pushbullet status:', res.status);
          resolve();
        },
        onerror: (err) => {
          console.error('[Monitor] Pushbullet failed:', err);
          resolve();
        }
      });
    });
  }
  function dispatchToExtraChannels(embed, blob = null) {
    const { title, desc } = extractNotificationContent(embed);
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      sendTelegramNotification(title, desc, blob);
    }
    if (PUSHBULLET_TOKEN) {
      sendPushbulletNotification(title, desc);
    }
  }
  function hasAnyNotificationChannel() {
    return WEBHOOK_URL || (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) || PUSHBULLET_TOKEN;
  }
  function sendCombinedWebhook(embed, targetUrl = null) {
    if (!hasAnyNotificationChannel()) return Promise.resolve();
    return new Promise((resolve) => {
      const captureAndSendCombined = (blob) => {
        if (WEBHOOK_URL) {
          const payload = {
            username: 'Moodle Watcher',
            avatar_url: 'https://hcmus.edu.vn/favicon.ico',
            embeds: [embed]
          };
          if (blob) {
            embed.image = { url: 'attachment://screenshot.png' };
            const formData = new FormData();
            formData.append('payload_json', JSON.stringify(payload));
            formData.append('files[0]', blob, 'screenshot.png');
            enqueueWebhook(formData, true);
          } else {
            enqueueWebhook(payload, false);
          }
        }
        dispatchToExtraChannels(embed, blob);
        resolve();
      };
      if (targetUrl) {
        captureIframeScreenshot(targetUrl, captureAndSendCombined);
      } else {
        if (typeof html2canvas === 'undefined') {
          captureAndSendCombined(null);
          return;
        }
        setTimeout(() => {
          try {
            html2canvas(document.body, {
              useCORS: true,
              allowTaint: true,
              scale: 0.8
            }).then(canvas => {
              canvas.toBlob(captureAndSendCombined, 'image/png');
            }).catch(err => {
              console.warn('[Monitor] html2canvas failed:', err);
              captureAndSendCombined(null);
            });
          } catch (err) {
            console.error('[Monitor] html2canvas sync crash:', err);
            captureAndSendCombined(null);
          }
        }, 1000);
      }
    });
  }
  function parseDeadline(text) {
    if (!text) return null;
    let targetText = text;
    const closeKeywords = [
      /đóng\s*:/i, /closes\s*:/i, /hạn chót\s*:/i, /hạn nộp\s*:/i, /đến hạn\s*:/i, /tới hạn\s*:/i,
      /due\s*:/i, /due date\s*:/i, /đóng\s+/i, /closes\s+/i, /đến\s+/i, /to\s+/i
    ];
    for (const kw of closeKeywords) {
      const match = text.match(kw);
      if (match) {
        targetText = text.substring(match.index + match[0].length);
        break;
      }
    }
    const timeRegex = /(\d{1,2})[:h](\d{2})(?:\s*(AM|PM))?/i;
    const dateVnRegex = /(\d{1,2})\s+tháng\s+(\d{1,2})(?:\s+năm|\s*,\s*)?\s+(\d{4})/i;
    const dateStdRegex = /(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})/;
    const timeMatch = targetText.match(timeRegex);
    const dateVnMatch = targetText.match(dateVnRegex);
    const dateStdMatch = targetText.match(dateStdRegex);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      const meridiem = timeMatch[3];
      if (meridiem) {
        const m = meridiem.toUpperCase();
        if (m === 'PM' && hours < 12) hours += 12;
        if (m === 'AM' && hours === 12) hours = 0;
      }
      let day, month, year;
      if (dateVnMatch) {
        day = parseInt(dateVnMatch[1], 10);
        month = parseInt(dateVnMatch[2], 10) - 1;
        year = parseInt(dateVnMatch[3], 10);
      } else if (dateStdMatch) {
        day = parseInt(dateStdMatch[1], 10);
        month = parseInt(dateStdMatch[2], 10) - 1;
        year = parseInt(dateStdMatch[3], 10);
      } else {
        return null;
      }
      const d = new Date(year, month, day, hours, minutes);
      if (!isNaN(d.getTime())) {
        return Math.floor(d.getTime() / 1000);
      }
    }
    const cleaned = targetText.replace(/^(due|hạn chót|hạn|closes|mở lúc|mở vào)\s*:\s*/i, '').trim();
    const parsed = Date.parse(cleaned);
    if (!isNaN(parsed)) {
      return Math.floor(parsed / 1000);
    }
    return null;
  }
  function isOpenCloseIdentical(text) {
    if (!text) return false;
    const parts = text.split(/[|;\n]|\s+-\s+/);
    if (parts.length >= 2) {
      const t1 = parseDeadline(parts[0]);
      const t2 = parseDeadline(parts[1]);
      if (t1 && t2 && t1 === t2) {
        return true;
      }
    }
    return false;
  }
  function parseActivityStatus(doc, url) {
    let status = 'pending';
    let detail = '';
    if (url.includes('mod/quiz')) {
      const elements = Array.from(doc.querySelectorAll('h2, h3, h4, p, td, th, span'));
      for (const el of elements) {
        const text = el.textContent.trim();
        if (
          text.includes('Điểm tổng kết cho bài làm của bạn là') ||
          text.includes('Final grade for this quiz is') ||
          text.includes('Grade for this attempt')
        ) {
          status = 'completed';
          detail = text.replace(/\s+/g, ' ').trim();
          if (detail.length > 200) {
            detail = detail.substring(0, 200) + '...';
          }
          return { status, detail };
        }
      }
      const attemptTable = doc.querySelector('.generaltable');
      if (attemptTable) {
        const rows = Array.from(attemptTable.querySelectorAll('tbody tr'));
        let hasFinished = false;
        let grade = '';
        rows.forEach(row => {
          const text = row.textContent.toLowerCase();
          if (
            text.includes('finished') ||
            text.includes('đã nộp') ||
            text.includes('đã hoàn thành') ||
            text.includes('hoàn thành') ||
            text.includes('đã xong')
          ) {
            hasFinished = true;
          }
          const cells = Array.from(row.querySelectorAll('td'));
          cells.forEach(cell => {
            const val = cell.textContent.trim();
            if (val.includes('/') && !val.includes('state')) {
              grade = val; 
            }
          });
        });
        if (hasFinished) {
          status = 'completed';
          detail = grade ? `Điểm: ${grade}` : 'Đã nộp';
          return { status, detail };
        }
      }
      const gradeFeedback = doc.querySelector('.gradefeedback, .feedback');
      if (gradeFeedback) {
        status = 'completed';
        detail = gradeFeedback.textContent.replace(/\s+/g, ' ').trim();
        if (detail.length > 200) {
          detail = detail.substring(0, 200) + '...';
        }
        return { status, detail };
      }
      const attemptBtn = doc.querySelector('.quizattempt a, .quizattempt button, form[action*="attempt.php"]');
      if (attemptBtn) {
        const btnText = attemptBtn.textContent.toLowerCase();
        if (btnText.includes('continue') || btnText.includes('tiếp tục')) {
          status = 'in_progress';
          detail = 'Đang làm dở';
        } else {
          status = 'pending';
          detail = 'Chưa làm';
        }
      }
    } else if (url.includes('mod/assign')) {
      const submissionTable = doc.querySelector('.submissionstatustable');
      if (submissionTable) {
        const text = submissionTable.textContent.toLowerCase();
        if (text.includes('submitted for grading') || text.includes('đã nộp để chấm điểm') || text.includes('hoàn thành')) {
          status = 'completed';
          detail = 'Đã nộp';
          if (text.includes('graded') || text.includes('đã chấm điểm')) {
            detail = 'Đã chấm điểm';
          }
          return { status, detail };
        }
      }
    }
    return { status, detail };
  }
  function sendQuizWebhook(quiz, triggerType) {
    if (!hasAnyNotificationChannel()) return Promise.resolve();
    const timestamp = parseDeadline(quiz.deadline);
    const timeDisplay = timestamp
      ? `Deadline: <t:${timestamp}:F> (<t:${timestamp}:R>)`
      : `Deadline: ${quiz.deadline || 'Unknown'}`;
    let titleLabel = '';
    let color = 0xef4444; 
    let descSuffix = '';
    if (triggerType === 'NEW') {
      titleLabel = quiz.type === 'quiz' ? '⚠️ PHÁT HIỆN QUIZ MỚI' : '📝 PHÁT HIỆN BÀI TẬP MỚI';
      descSuffix = `Trạng thái: **${quiz.detail || 'Chưa làm'}**`;
    } else if (triggerType === 'COMPLETED') {
      titleLabel = quiz.type === 'quiz' ? '🎉 ĐÃ HOÀN THÀNH QUIZ' : '🎉 ĐÃ NỘP BÀI TẬP';
      color = 0x10b981; 
      descSuffix = `Kết quả: **${quiz.detail || 'Đã hoàn tất thành công'}**`;
    } else if (triggerType === 'EXPIRED') {
      titleLabel = quiz.type === 'quiz' ? '❌ ĐÃ BỎ LỠ QUIZ' : '❌ ĐÃ BỎ LỠ BÀI TẬP';
      color = 0x6b7280; 
      descSuffix = `Trạng thái: **Đã quá hạn (Chưa làm)**`;
    } else if (triggerType === 'REMINDER') {
      titleLabel = quiz.type === 'quiz' ? '⏰ NHẮC NHỞ: LÀM BÀI QUIZ' : '⏰ NHẮC NHỞ: NỘP BÀI TẬP';
      color = 0xf59e0b; 
      const mins = quiz.uncompletedChecksCount;
      descSuffix = `⚠️ **Bạn chưa hoàn thành bài này!** (Đã nhắc nhở trong ${mins} phút qua)`;
    } else if (triggerType === 'UPDATE') {
      titleLabel = quiz.type === 'quiz' ? '🔄 CẬP NHẬT THỜI HẠN QUIZ' : '🔄 CẬP NHẬT THỜI HẠN BÀI TẬP';
      color = 0x3b82f6; 
      descSuffix = `Trạng thái: **${quiz.detail || 'Chưa làm'}**\n⚠️ **Thời hạn đã được cập nhật mới!**`;
    }
    const embed = {
      title:       `[${titleLabel}] ${quiz.name}`,
      url:         quiz.url,
      color:       color,
      description: `**${quiz.name}**\n${timeDisplay}\n\n${descSuffix}\n\nLink: ${quiz.url}`,
      footer:      { text: `Moodle Monitor | Phát hiện: ${quiz.detectedAt}` },
      timestamp:   new Date().toISOString(),
    };
    return sendCombinedWebhook(embed, quiz.url);
  }
  function sendSessionWebhook() {
    if (!hasAnyNotificationChannel()) return;
    const embed = {
      title: '🚨 SESSION EXPIRED / LOGGED OUT',
      color: 0xf59e0b,
      description: 'Moodle session has expired or logged out. Microsoft auto-login triggered.',
      url: `${location.origin}/login/index.php`,
      footer:      { text: 'Moodle Monitor' },
      timestamp: new Date().toISOString(),
    };
    sendCombinedWebhook(embed, null);
  }
  function sendLoginWebhook() {
    if (!hasAnyNotificationChannel()) return;
    const embed = {
      title: '✅ MOODLE LOGGED IN SUCCESSFULLY',
      color: 0x10b981,
      description: `Moodle has logged in successfully and resumed monitoring.\nTarget Page: ${location.href}`,
      footer:      { text: 'Moodle Monitor' },
      timestamp: new Date().toISOString(),
    };
    sendCombinedWebhook(embed, null);
  }
  function handleExpiredSession() {
    updateBadgeStyle('expired');
    const lastWarn = parseInt(GM_getValue(SESSION_PING_KEY, '0'), 10);
    const diff = Date.now() - lastWarn;
    if (diff > 30 * 60 * 1000) {
      console.warn('[Monitor] Session expired!');
      GM_setValue(SESSION_PING_KEY, String(Date.now()));
      GM_notification({
        title: 'Moodle Logged Out',
        text:  'Click to log in again and resume quiz monitoring.',
        timeout: 15000,
        onclick: () => window.open(`${location.origin}/login/index.php`),
      });
      sendSessionWebhook();
    }
  }
  function autoClickMicrosoftLogin() {
    const msBtn = Array.from(document.querySelectorAll('a, button, .btn, .potentialidp a')).find(el => {
      const text = el.textContent || '';
      const href = el.href || el.getAttribute('href') || '';
      return (
        text.toLowerCase().includes('microsoft') ||
        href.toLowerCase().includes('auth/oauth2') ||
        href.toLowerCase().includes('idp=microsoft')
      );
    });
    if (msBtn) {
      console.log('[Monitor] Auto-clicking Microsoft Login button...');
      setTimeout(() => {
        msBtn.click();
      }, 500);
    }
  }
  function checkSession() {
    const url = location.href;
    const isLoginPage =
      url.includes('/login/index.php') ||
      url.includes('/login/') ||
      !!document.querySelector('#login, form#login, [action*="login/index.php"]');
    if (isLoginPage) {
      GM_setValue('moodle_needs_redirect', true);
      handleExpiredSession();
      autoClickMicrosoftLogin();
      return true;
    }
    GM_setValue(SESSION_PING_KEY, '0');
    return false;
  }
  function cleanName(el, fallback) {
    if (!el) return (fallback || '').trim();
    const clone = el.cloneNode(true);
    clone.querySelectorAll('.icon, img, .accesshide, .visually-hidden, .sr-only').forEach((n) => n.remove());
    return clone.textContent.replace(/\s+/g, ' ').trim() || (fallback || '').trim();
  }
  function isScanPage(urlStr) {
    try {
      const url = new URL(urlStr);
      const path = url.pathname;
      return (
        path === '/' ||
        path === '/index.php' ||
        path.includes('/course/view.php') ||
        path.includes('/my')
      );
    } catch {
      return false;
    }
  }
  async function scanForQuizzes() {
    if (GM_getValue('moodle_quiz_paused', false)) {
      updateBadgeText('Paused');
      updateBadgeStyle('paused');
      return;
    }
    if (checkSession()) {
      startCountdown();
      return;
    }
    const url = location.href;
    if (!isScanPage(url)) {
      updateBadgeText('Idle (Not a scan page)');
      updateBadgeStyle('normal');
      startCountdown();
      return;
    }
    console.log('[Moodle Monitor] Scanning background...');
    updateBadgeStyle('scanning');
    updateBadgeText('Scanning...');
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (response.redirected && (response.url.includes('/login/') || response.url.includes('login/index.php'))) {
        handleExpiredSession();
        updateBadge();
        startCountdown();
        return;
      }
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      if (doc.querySelector('#login, form#login, [action*="login/index.php"]')) {
        handleExpiredSession();
        updateBadge();
        startCountdown();
        return;
      }
      const activities = doc.querySelectorAll(
        '.activity, .activityinstance, .activity-item, li[data-for="cmitem"]'
      );
      let foundNew = false;
      const activitiesToProcess = [];
      activities.forEach((activity) => {
        try {
          const link = activity.querySelector('a[href*="mod/quiz"], a[href*="mod/assign"]');
          if (!link) return;
          const nameEl = activity.querySelector('.instancename, .activityname');
          const name   = cleanName(nameEl, link.textContent.trim());
          let id = null;
          try {
            id = new URL(link.href, location.origin).searchParams.get('id');
          } catch {
            const m = link.href.match(/id=(\d+)/);
            if (m) id = m[1];
          }
          if (!id) return;
          let deadline = '';
          const dateEl = activity.querySelector('.activity-dates, .activity-altcontent');
          if (dateEl) deadline = dateEl.textContent.replace(/\s+/g, ' ').trim();
          const type = link.href.includes('mod/quiz') ? 'quiz' : 'assign';
          activitiesToProcess.push({ id, name, url: link.href, deadline, type });
        } catch (err) {
          console.error('[Monitor] Error parsing activity item:', err);
        }
      });
      activitiesToProcess.forEach((act) => {
        const existing = seenMap[act.id];
        if (existing) {
          const oldDeadline = (existing.deadline || '').trim();
          const newDeadline = (act.deadline || '').trim();
          if (oldDeadline !== newDeadline) {
            console.log(`[Monitor] Phát hiện thay đổi thời hạn cho ${act.name}: '${oldDeadline}' -> '${newDeadline}'`);
            existing.deadline = newDeadline;
            existing.status = 'pending';
            existing.detail = 'Cập nhật thời hạn';
            existing.uncompletedChecksCount = 0;
            existing.lastDetailCheck = 0;
            existing.isUpdated = true;
            saveState();
          }
        }
      });
      for (const act of activitiesToProcess) {
        try {
          const deadlineTime = parseDeadline(act.deadline);
          const isPast = deadlineTime && deadlineTime < Math.floor(Date.now() / 1000);
          const isNew = !seenMap[act.id];
          const existing = seenMap[act.id];
          const isPending = existing && existing.status !== 'completed';
          const isUpdated = existing && existing.isUpdated;
          const isStaleCompleted = existing && existing.status === 'completed' && 
                                   (existing.detail === 'Đã hết hạn' || existing.detail === 'Trùng thời gian mở/đóng') &&
                                   (Date.now() - (existing.lastDetailCheck || 0) > 15 * 60 * 1000);
          if (isNew || isPending || isUpdated || isStaleCompleted) {
            const res = await fetch(act.url, { cache: 'no-store' });
            const htmlText = await res.text();
            const parser = new DOMParser();
            const actDoc = parser.parseFromString(htmlText, 'text/html');
            const { status, detail } = parseActivityStatus(actDoc, act.url);
            if (isNew) {
              const now = new Date().toLocaleString('vi-VN');
              seenMap[act.id] = {
                name: act.name,
                url: act.url,
                deadline: act.deadline,
                detectedAt: now,
                type: act.type,
                status: status,
                detail: detail,
                uncompletedChecksCount: 0,
                lastDetailCheck: Date.now()
              };
              saveState();
              if (status === 'completed') {
                await sendQuizWebhook(seenMap[act.id], 'COMPLETED');
              } else if (isOpenCloseIdentical(act.deadline)) {
                seenMap[act.id].status = 'completed';
                seenMap[act.id].detail = 'Trùng thời gian mở/đóng';
                saveState();
                await sendQuizWebhook(seenMap[act.id], 'NEW');
              } else if (isPast) {
                seenMap[act.id].status = 'completed';
                seenMap[act.id].detail = 'Đã hết hạn';
                saveState();
                await sendQuizWebhook(seenMap[act.id], 'EXPIRED');
              } else {
                foundNew = true;
                
                // Ring annoying loop alarm
                playAnnoyingAlarm(deadlineTime);
                showAlarmOverlay(act.name, act.url);

                GM_notification({
                  title:   act.type === 'quiz' ? 'New Quiz Found' : 'New Assignment Found',
                  text:    `${act.name}${act.deadline ? '\n' + act.deadline : ''}`,
                  timeout: 10000,
                  onclick: () => window.open(act.url),
                });
                await sendQuizWebhook(seenMap[act.id], 'NEW');
              }
            } else {
              existing.lastDetailCheck = Date.now();
              if (existing.isUpdated) {
                existing.isUpdated = false;
                if (status === 'completed') {
                  existing.status = 'completed';
                  existing.detail = detail;
                  saveState();
                  await sendQuizWebhook(existing, 'COMPLETED');
                } else if (isOpenCloseIdentical(act.deadline)) {
                  existing.status = 'completed';
                  existing.detail = 'Trùng thời gian mở/đóng';
                  saveState();
                  await sendQuizWebhook(existing, 'UPDATE');
                } else if (isPast) {
                  existing.status = 'completed';
                  existing.detail = 'Đã hết hạn';
                  saveState();
                  await sendQuizWebhook(existing, 'EXPIRED');
                } else {
                  existing.status = status;
                  existing.detail = detail;
                  saveState();
                  await sendQuizWebhook(existing, 'UPDATE');
                }
              } else if (isStaleCompleted) {
                const isStillIdentical = isOpenCloseIdentical(act.deadline);
                if (status !== 'completed' && !isPast && !isStillIdentical) {
                  existing.status = status;
                  existing.detail = detail;
                  existing.uncompletedChecksCount = 0;
                  saveState();
                  await sendQuizWebhook(existing, 'UPDATE');
                } else {
                  saveState();
                }
              } else {
                const oldStatus = existing.status;
                if (status === 'completed') {
                  existing.status = 'completed';
                  existing.detail = detail;
                  saveState();
                  if (oldStatus !== 'completed') {
                    await sendQuizWebhook(existing, 'COMPLETED');
                  }
                } else if (isOpenCloseIdentical(act.deadline)) {
                  existing.status = 'completed';
                  existing.detail = 'Trùng thời gian mở/đóng';
                  saveState();
                } else if (isPast) {
                  existing.status = 'completed';
                  existing.detail = 'Đã hết hạn';
                  saveState();
                  if (oldStatus !== 'completed') {
                    await sendQuizWebhook(existing, 'EXPIRED');
                  }
                } else {
                  existing.status = status;
                  existing.detail = detail;
                  existing.uncompletedChecksCount = (existing.uncompletedChecksCount || 0) + 1;
                  saveState();
                  await sendQuizWebhook(existing, 'REMINDER');
                }
              }
            }
            await new Promise(r => setTimeout(r, 600));
          }
        } catch (err) {
          console.error('[Monitor] Error fetching activity detail page:', act.name, err);
        }
      }
      const total = Object.keys(seenMap).length;
      console.log(`[Moodle Monitor] Background scan complete. Tracked: ${total}`);
      if (foundNew) {
        keepRedUntil = Date.now() + 15000;
        updateBadgeStyle('new');
      } else {
        if (Date.now() >= keepRedUntil) {
          updateBadgeStyle('normal');
        }
      }
      updateBadge();
    } catch (err) {
      console.error('[Monitor] Background scan failed:', err);
      updateBadgeText('Error scanning');
      updateBadgeStyle('normal');
    }
    startCountdown();
  }
  function startCountdown() {
    if (countdownTimer) clearInterval(countdownTimer);
    if (GM_getValue('moodle_quiz_paused', false)) {
      updateBadgeText('Paused');
      updateBadgeStyle('paused');
      return;
    }
    if (location.href.includes('mod/quiz/attempt')) {
      updateBadgeText('Idle (Quiz in progress)');
      updateBadgeStyle('normal');
      return;
    }
    if (!isScanPage(location.href)) {
      updateBadgeText('Idle (Not a scan page)');
      updateBadgeStyle('normal');
      return;
    }
    const hasUncompleted = Object.values(seenMap).some(q => q.status !== 'completed' && q.status !== 'pendingFuture' && q.detail !== 'Đã hết hạn' && q.detail !== 'Trùng thời gian mở/đóng');
    const currentIntervalMs = hasUncompleted ? 30 * 1000 : CHECK_INTERVAL_MS;
    secondsRemaining = currentIntervalMs / 1000;
    updateBadge();
    countdownTimer = setInterval(() => {
      if (GM_getValue('moodle_quiz_paused', false)) {
        clearInterval(countdownTimer);
        updateBadgeText('Paused');
        updateBadgeStyle('paused');
        return;
      }
      secondsRemaining--;
      if (secondsRemaining <= 0) {
        clearInterval(countdownTimer);
        scanForQuizzes();
      } else {
        updateBadgeText(`Next check in ${secondsRemaining}s`);
        if (Date.now() >= keepRedUntil && keepRedUntil > 0) {
          keepRedUntil = 0;
          updateBadgeStyle('normal');
        }
      }
    }, 1000);
  }
  function updateBadgeText(statusText) {
    const badge = document.getElementById('quiz-monitor-badge');
    if (!badge) return;
    const count = Object.keys(seenMap).length;
    const isPaused = GM_getValue('moodle_quiz_paused', false);
    const titleText = isPaused ? 'Moodle Watcher Alarm [PAUSED]' : 'Moodle Watcher Alarm';
    badge.innerHTML =
      `<div style="font-weight:600;margin-bottom:2px;color:inherit;">${titleText}</div>` +
      `<div style="font-size:11px;opacity:0.85;">Tracked: ${count} items</div>` +
      `<div style="font-size:10px;margin-top:2px;opacity:0.75;">${statusText}</div>`;
  }
  function updateBadge() {
    const isPaused = GM_getValue('moodle_quiz_paused', false);
    if (isPaused) {
      updateBadgeText('Paused');
    } else {
      updateBadgeText(`Next check in ${secondsRemaining}s`);
    }
  }
  function updateBadgeStyle(status) {
    const badge = document.getElementById('quiz-monitor-badge');
    if (!badge) return;
    badge.classList.remove('badge-scanning', 'badge-new', 'badge-expired', 'badge-normal', 'badge-paused');
    if (status === 'scanning') {
      badge.classList.add('badge-scanning');
    } else if (status === 'new') {
      badge.classList.add('badge-new');
    } else if (status === 'expired') {
      badge.classList.add('badge-expired');
    } else if (status === 'paused') {
      badge.classList.add('badge-paused');
    } else {
      badge.classList.add('badge-normal');
    }
  }
  function createBadge() {
    if (document.getElementById('quiz-monitor-badge')) return;
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes badgePulse {
        0% { background-color: rgba(239, 246, 255, 0.85); border-color: rgba(59, 130, 246, 0.5); }
        50% { background-color: rgba(219, 234, 254, 0.95); border-color: rgba(59, 130, 246, 0.8); }
        100% { background-color: rgba(239, 246, 255, 0.85); border-color: rgba(59, 130, 246, 0.5); }
      }
      .badge-scanning {
        animation: badgePulse 1.5s infinite !important;
        color: #1d4ed8 !important;
      }
      .badge-new {
        background-color: rgba(254, 242, 242, 0.9) !important;
        border-color: #ef4444 !important;
        color: #b91c1c !important;
      }
      .badge-expired {
        background-color: rgba(255, 251, 235, 0.9) !important;
        border-color: #f59e0b !important;
        color: #b45309 !important;
      }
      .badge-paused {
        background-color: rgba(243, 244, 246, 0.85) !important;
        border-color: rgba(156, 163, 175, 0.5) !important;
        color: #6b7280 !important;
      }
      .badge-normal {
        background-color: rgba(255, 255, 255, 0.85) !important;
        border-color: rgba(229, 231, 235, 0.8) !important;
        color: #1f2937 !important;
      }
    `;
    document.head.appendChild(style);
    const badge = document.createElement('div');
    badge.id = 'quiz-monitor-badge';
    badge.style.cssText = [
      'position:fixed', 'bottom:15px', 'right:15px',
      'padding:8px 14px', 'border-radius:10px', 'font-size:12px', 'z-index:999999',
      'cursor:pointer', 'box-shadow:0 4px 15px rgba(0, 0, 0, 0.08)',
      'text-align:center', 'line-height:1.4',
      'border:1px solid rgba(229, 231, 235, 0.8)',
      'backdrop-filter:blur(8px)', '-webkit-backdrop-filter:blur(8px)',
      'font-family:system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      'transition:transform 0.2s ease, background-color 0.2s ease',
    ].join(';');
    badge.onmouseenter = () => {
      badge.style.transform = 'scale(1.03)';
    };
    badge.onmouseleave = () => {
      badge.style.transform = 'scale(1)';
    };
    document.body.appendChild(badge);
    const isPaused = GM_getValue('moodle_quiz_paused', false);
    updateBadgeStyle(isPaused ? 'paused' : 'normal');
    updateBadge();
    badge.addEventListener('click', () => {
      const currentPaused = GM_getValue('moodle_quiz_paused', false);
      const action = prompt(
        'Moodle Watcher Alarm Menu:\n' +
        `1 - ${currentPaused ? '▶️ Resume Watcher' : '⏸️ Pause Watcher'}\n` +
        '2 - Send Test Webhook & Trigger Alarm\n' +
        '3 - Scan Now\n' +
        '4 - View Tracked Items (Console)\n' +
        '5 - Reset Tracked Items\n' +
        '6 - Close'
      );
      if (action === '1') {
        const nextPausedState = !currentPaused;
        GM_setValue('moodle_quiz_paused', nextPausedState);
        showToast(nextPausedState ? 'Watcher Paused' : 'Watcher Resumed', nextPausedState ? 'warning' : 'success');
        if (nextPausedState) {
          if (countdownTimer) clearInterval(countdownTimer);
          updateBadgeStyle('paused');
          updateBadge();
        } else {
          updateBadgeStyle('normal');
          scanForQuizzes();
        }
      } else if (action === '2') {
        // Trigger Test Alarm & Webhook
        playAnnoyingAlarm(Math.floor(Date.now() / 1000) + 30); // 30s test
        showAlarmOverlay('TEST QUIZ ALARM', '#');

        if (!hasAnyNotificationChannel()) {
          showToast('Alarm triggered. No notification channel configured', 'warning');
        } else {
          const embed = {
            title:       'Test Webhook Successful',
            color:       0x10b981,
            description: `Moodle Monitor v3.6 test successful. Target: ${location.pathname}`,
            footer:      { text: 'Moodle Monitor' },
            timestamp:   new Date().toISOString(),
          };
          if (WEBHOOK_URL) {
            enqueueWebhook({
              username: 'Moodle Watcher',
              avatar_url: 'https://hcmus.edu.vn/favicon.ico',
              embeds: [embed]
            }, false);
          }
          dispatchToExtraChannels(embed, null);
          showToast('Test notification sent & Alarm triggered', 'success');
        }
      } else if (action === '3') {
        scanForQuizzes();
      } else if (action === '4') {
        console.table(
          Object.entries(seenMap).map(([id, v]) => ({ id, name: v.name, detectedAt: v.detectedAt }))
        );
        showToast(`Printed ${Object.keys(seenMap).length} items to console. Press F12`, 'success');
      } else if (action === '5') {
        resetState();
      }
    });
  }
  function init() {
    if (checkSession()) return;
    const url = location.href;
    const pathname = location.pathname;
    const needsRedirect = GM_getValue('moodle_needs_redirect', false);
    const lastPage = GM_getValue('moodle_last_monitored_page', '');
    if (needsRedirect && (pathname === '/' || pathname === '/index.php' || pathname === '/my' || pathname === '/my/')) {
      GM_setValue('moodle_needs_redirect', false);
      if (lastPage && lastPage !== location.href) {
        console.log('[Monitor] Logged in. Redirecting to last monitored page:', lastPage);
        sendLoginWebhook();
        setTimeout(() => {
          location.href = lastPage;
        }, 1500);
        return;
      } else {
        sendLoginWebhook();
      }
    }
    if (url.includes('/course/view.php')) {
      GM_setValue('moodle_last_monitored_page', url);
    }
    createBadge();
    const isPaused = GM_getValue('moodle_quiz_paused', false);
    if (!isPaused) {
      scanForQuizzes();
    }
  }
  init();
})();
