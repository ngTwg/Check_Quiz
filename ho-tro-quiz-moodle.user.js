// ==UserScript==
// @name         Thu Thap Quiz va Tu Dong Chuyen Trang Moodle (Gemini Auto-Solver - Release)
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  Cao cau hoi -> Gui sang Gemini (RPA) -> Nhan dap an -> Auto dien -> Auto Submit -> Report Diem Webhook
// @author       Antigravity
// @match        *://courses.hcmus.edu.vn/mod/quiz/attempt.php*
// @match        *://moodle.hcmus.edu.vn/mod/quiz/attempt.php*
// @match        *://courses.hcmus.edu.vn/mod/quiz/summary.php*
// @match        *://moodle.hcmus.edu.vn/mod/quiz/summary.php*
// @match        *://courses.hcmus.edu.vn/mod/quiz/review.php*
// @match        *://moodle.hcmus.edu.vn/mod/quiz/review.php*
// @match        *://courses.hcmus.edu.vn/mod/quiz/view.php*
// @match        *://moodle.hcmus.edu.vn/mod/quiz/view.php*
// @match        *://gemini.google.com/*
// @grant        GM_setClipboard
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// @grant        GM_xmlhttpRequest
// @connect      discord.com
// @connect      api.telegram.org
// @connect      api.pushbullet.com
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. CONFIG WEBHOOKS (ĐIỀN TOKEN CỦA BẠN ĐỂ NHẬN BÁO CÁO KẾT QUẢ)
    // ═══════════════════════════════════════════════════════════════════════════
    const DISCORD_WEBHOOK_URL = '';
    const TELEGRAM_BOT_TOKEN  = '';
    const TELEGRAM_CHAT_ID    = '';
    const PUSHBULLET_TOKEN    = '';

    const currentUrl = window.location.href;

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. COMMON UI & UTILS
    // ═══════════════════════════════════════════════════════════════════════════
    const showToast = (message, bgColor = '#10b981') => {
        let toast = document.getElementById('quiz-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'quiz-toast';
            toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(100px);color:white;padding:12px 24px;border-radius:8px;font-weight:600;box-shadow:0 10px 25px rgba(0,0,0,0.3);z-index:1000000;transition:transform 0.3s;pointer-events:none;';
            document.body.appendChild(toast);
        }
        toast.style.background = bgColor;
        toast.innerText = message;
        toast.style.transform = 'translateX(-50%) translateY(0)';
        setTimeout(() => toast.style.transform = 'translateX(-50%) translateY(100px)', 3000);
    };

    const generateId = () => Math.random().toString(36).substring(2, 9);

    // ═══════════════════════════════════════════════════════════════════════════
    // ROLE 1: TAB MOODLE
    // ═══════════════════════════════════════════════════════════════════════════
    if (currentUrl.includes('moodle') || currentUrl.includes('courses.hcmus')) {

        const getQuizData = () => JSON.parse(sessionStorage.getItem('moodle_quiz_data') || '{}');
        const saveQuizData = (data) => sessionStorage.setItem('moodle_quiz_data', JSON.stringify(data));

        // ─── XỬ LÝ TRANG LÀM BÀI (ATTEMPT.PHP) VÀ MOCK TEST ───
        if (currentUrl.includes('attempt.php') || currentUrl.includes('moodle-test.html')) {
            
            let timeoutId = null;

            const processNextQuestion = () => {
                const questions = document.querySelectorAll('.que');
                let allAnswered = true;

                for (const q of questions) {
                    const id = q.id;
                    const isAnswered = q.querySelector('input[type="radio"]:checked, input[type="checkbox"]:checked') || 
                                       (q.querySelector('input[type="text"]') && q.querySelector('input[type="text"]').value.trim() !== '');
                    
                    if (!isAnswered && q.dataset.quizTimeout !== "true") {
                        allAnswered = false;
                        const qtext = q.querySelector('.qtext') ? q.querySelector('.qtext').innerText.trim() : '';
                        
                        let optionsText = "";
                        let optionMapping = {}; 
                        const labels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
                        
                        // Lấy trực tiếp input radio/checkbox để an toàn 100%, tránh crash khi dom thiếu/thừa thẻ label
                        const choiceInputs = q.querySelectorAll('.answer input[type="radio"], .answer input[type="checkbox"]');
                        const isText = choiceInputs.length === 0;

                        if (!isText) {
                            choiceInputs.forEach((input, idx) => {
                                const letter = labels[idx];
                                // Moodle thường để chữ ở label kế bên, hoặc wrapper cha
                                const labelNode = q.querySelector(`label[for="${input.id}"]`) || input.parentElement;
                                const text = labelNode ? labelNode.innerText.trim() : input.value;
                                optionsText += `${letter}. ${text}\n`;
                                optionMapping[letter] = input.id;
                            });
                        } else {
                            optionsText = "(Đây là câu điền khuyết)";
                        }

                        const reqId = generateId();
                        const promptText = `MÃ CÂU HỎI: ${reqId}
[CÂU HỎI]: ${qtext}
[CÁC LỰA CHỌN]:
${optionsText}

BẠN LÀ AUTO-SOLVER API. CÁC QUY TẮC TUYỆT ĐỐI KHÔNG ĐƯỢC VI PHẠM:
1. CHỈ in ra 1 dòng kết quả thô duy nhất: [FINAL_ANSWER_${reqId}: <ĐÁP_ÁN>]
2. <ĐÁP_ÁN> CHỈ LÀ chữ cái A, B, C, D (nếu trắc nghiệm) hoặc text ngắn gọn (nếu điền khuyết).
3. TUYỆT ĐỐI KHÔNG lặp lại nội dung đáp án của quiz (Ví dụ: Cấm ghi "A. do cơ chế..."). KHÔNG giải thích. KHÔNG dùng markdown.`;

                        let textInputId = null;
                        if (isText) {
                            const txtInput = q.querySelector('input[type="text"]');
                            if(txtInput) textInputId = txtInput.id;
                        }

                        GM_setValue('gemini_quiz_request', JSON.stringify({
                            qId: id,
                            reqId: reqId,
                            prompt: promptText,
                            qText: qtext,
                            mapping: optionMapping,
                            isText: isText,
                            textInputId: textInputId
                        }));

                        showToast(`⏳ Đang nhờ Gemini giải câu ${id.replace('q', '')}...`, '#f59e0b');

                        // Cơ chế Timeout giải câu hỏi (15 giây)
                        if (timeoutId) clearTimeout(timeoutId);
                        timeoutId = setTimeout(() => {
                            showToast(`⚠️ Câu ${id.replace('q', '')} bị quá thời gian giải (Timeout). Hãy tự giải câu này!`, '#ef4444');
                            q.dataset.quizTimeout = "true";
                            setTimeout(processNextQuestion, 1000);
                        }, 15000);

                        return; // Chờ giải xong
                    }
                }

                if (allAnswered) {
                    triggerAutoNavigation();
                }
            };

            GM_addValueChangeListener('gemini_quiz_response', function(name, old_value, new_value, remote) {
                if (remote && new_value) {
                    const response = JSON.parse(new_value);
                    const currentReq = JSON.parse(GM_getValue('gemini_quiz_request', '{}'));
                    
                    if (currentReq.reqId === response.reqId) {
                        if (timeoutId) clearTimeout(timeoutId); // Xóa timeout
                        const ans = response.answer.trim();
                        
                        if (currentReq.isText) {
                            const input = document.getElementById(currentReq.textInputId);
                            if (input) {
                                input.value = ans;
                                input.dispatchEvent(new Event('input', {bubbles: true}));
                                input.dispatchEvent(new Event('change', {bubbles: true}));
                            }
                        } else {
                            // Lọc chữ cái A, B, C, D đề phòng AI trả lời dài dòng "A. Mệnh đề..." thay vì chỉ "A"
                            // (Xử lý trường hợp AI trả lại đáp án có cả giải thích hoặc lặp lại text)
                            const matchLetter = ans.toUpperCase().match(/^[A-Z]/);
                            const finalLetter = matchLetter ? matchLetter[0] : ans.toUpperCase();
                            const inputId = currentReq.mapping[finalLetter] || currentReq.mapping['A']; // Fallback tick A nếu không map được
                            
                            const radio = document.getElementById(inputId);
                            if (radio && !radio.checked) radio.click();
                        }

                        // Lưu dữ liệu để gửi Webhook báo cáo cuối giờ
                        const data = getQuizData();
                        data[currentReq.qId] = { 
                            questionId: currentReq.qId, 
                            text: currentReq.qText,
                            aiAnswer: ans 
                        };
                        saveQuizData(data);

                        showToast(`✅ Đã điền xong: ${ans}`, '#10b981');
                        setTimeout(processNextQuestion, 1500); // Tăng delay lên 1.5s để Moodle kịp lưu nháp ajax
                    }
                }
            });

            const triggerAutoNavigation = () => {
                setTimeout(() => {
                    const nextBtn = document.querySelector('input[name="next"], button[name="next"], .mod_quiz-next-nav');
                    if (nextBtn) {
                        showToast('🚀 Chuyển trang...', '#3b82f6');
                        nextBtn.click();
                    } else {
                        const finishBtn = document.querySelector('input[name="finishattempt"], button[name="finishattempt"]');
                        if (finishBtn) {
                            showToast('🏁 Trang cuối! Đang hoàn thành...', '#3b82f6');
                            finishBtn.click();
                        } else {
                            const summaryLink = document.querySelector('a[href*="summary.php"]');
                            if (summaryLink) summaryLink.click();
                        }
                    }
                }, 800);
            };

            setTimeout(processNextQuestion, 1500);
        }

        // ─── XỬ LÝ TRANG TỔNG KẾT (SUMMARY.PHP) ───
        else if (currentUrl.includes('summary.php')) {
            const clickSubmitBtn = () => {
                return Array.from(document.querySelectorAll('button, input')).find(b => {
                    const txt = (b.textContent || b.value || '').toLowerCase();
                    return txt.includes('submit all and finish') || txt.includes('nộp bài và kết thúc');
                });
            };

            setTimeout(() => {
                const btn1 = clickSubmitBtn();
                if (btn1) {
                    showToast('🎯 Đang nộp bài...', '#10b981');
                    
                    // Gắn cờ để trang review bắt được điểm số
                    sessionStorage.setItem('quiz_just_submitted', 'true');
                    btn1.click();
                    
                    setTimeout(() => {
                        const btn2 = Array.from(document.querySelectorAll('.modal-dialog button, .confirmation-dialog button, input')).find(b => {
                            const txt = (b.textContent || b.value || '').toLowerCase();
                            return txt.includes('submit all and finish') || txt.includes('nộp bài và kết thúc');
                        });
                        if (btn2) {
                            sessionStorage.setItem('quiz_just_submitted', 'true');
                            btn2.click();
                        }
                    }, 1000);
                }
            }, 1500);
        }

        // ─── XỬ LÝ TRANG VIEW / REVIEW (SAU KHI NỘP) ───
        else if (currentUrl.includes('review.php') || currentUrl.includes('view.php')) {
            if (sessionStorage.getItem('quiz_just_submitted') === 'true') {
                sessionStorage.removeItem('quiz_just_submitted');
                
                showToast('🚀 Đang quét điểm và gửi báo cáo...', '#3b82f6');

                // Lấy điểm số
                let grade = "Đã nộp thành công (Chưa có điểm chi tiết)";
                const elements = Array.from(document.querySelectorAll('h2, h3, h4, p, td, th, span, div.grade'));
                for (const el of elements) {
                    const text = el.textContent.trim();
                    if (text.includes('Điểm tổng kết cho bài làm của bạn là') ||
                        text.includes('Final grade for this quiz is') ||
                        text.includes('Grade for this attempt') ||
                        text.includes('Grade:')) {
                        grade = text.replace(/\s+/g, ' ').trim();
                        break;
                    }
                }
                if (grade === "Đã nộp thành công (Chưa có điểm chi tiết)") {
                    const attemptTable = document.querySelector('.generaltable');
                    if (attemptTable) {
                        const rows = Array.from(attemptTable.querySelectorAll('tbody tr'));
                        rows.forEach(row => {
                            const text = row.textContent.toLowerCase();
                            if (text.includes('finished') || text.includes('đã nộp') || text.includes('hoàn thành')) {
                                const cells = Array.from(row.querySelectorAll('td'));
                                cells.forEach(cell => {
                                    const val = cell.textContent.trim();
                                    if (val.includes('/') && !val.includes('state')) {
                                        grade = `Điểm: ${val}`;
                                    }
                                });
                            }
                        });
                    }
                }

                // Lên danh sách report các câu hỏi đã chọn
                const data = getQuizData();
                const items = Object.values(data);
                
                let listQuestions = "";
                items.forEach((item, index) => {
                    const brief = item.text ? (item.text.substring(0, 60).replace(/\n/g, ' ') + '...') : 'N/A';
                    listQuestions += `Câu ${index + 1}: [${item.aiAnswer}] -> ${brief}\n`;
                });

                // Cắt ngắn nếu quá dài tránh lỗi webhook API của Discord/Telegram
                if (listQuestions.length > 2500) {
                    listQuestions = listQuestions.substring(0, 2500) + "\n... (Bị cắt bớt do danh sách quá dài)";
                }

                const title = `🎉 ĐÃ NỘP BÀI TỰ ĐỘNG BẰNG GEMINI`;
                const msg = `🎓 Kết quả: **${grade}**\n📖 Số câu đã giải: ${items.length}\n\n📝 DANH SÁCH ĐÁP ÁN:\n${listQuestions}\n\nTrang: ${location.href.split('?')[0]}`;
                
                // Gửi Webhooks
                if (TELEGRAM_BOT_TOKEN) {
                    GM_xmlhttpRequest({
                        method: 'POST', url: `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
                        headers: {'Content-Type': 'application/json'},
                        data: JSON.stringify({chat_id: TELEGRAM_CHAT_ID, text: `${title}\n\n${msg}`, disable_web_page_preview: true})
                    });
                }
                if (PUSHBULLET_TOKEN) {
                    GM_xmlhttpRequest({
                        method: 'POST', url: 'https://api.pushbullet.com/v2/pushes',
                        headers: {'Access-Token': PUSHBULLET_TOKEN, 'Content-Type': 'application/json'},
                        data: JSON.stringify({type: 'note', title: title, body: msg})
                    });
                }
                if (DISCORD_WEBHOOK_URL) {
                    GM_xmlhttpRequest({
                        method: 'POST', url: DISCORD_WEBHOOK_URL,
                        headers: {'Content-Type': 'application/json'},
                        data: JSON.stringify({
                            embeds: [{ title: title, description: msg, color: 0x10b981 }]
                        })
                    });
                }

                // Dọn dẹp session
                sessionStorage.removeItem('moodle_quiz_data');
                showToast('✅ Đã gửi report thành công!', '#10b981');
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ROLE 2: TAB GEMINI (Lắng nghe -> Chat -> Lấy kết quả)
    // ═══════════════════════════════════════════════════════════════════════════
    else if (currentUrl.includes('gemini.google.com')) {
        
        let pollInterval = null;

        GM_addValueChangeListener('gemini_quiz_request', function(name, old_value, new_value, remote) {
            if (remote && new_value) {
                const reqData = JSON.parse(new_value);
                
                // 1. Tìm khung chat của Gemini (Hỗ trợ nhiều giao diện / ngôn ngữ khác nhau)
                const editor = document.querySelector('rich-textarea div[contenteditable="true"]') 
                            || document.querySelector('[contenteditable="true"][role="textbox"]')
                            || document.querySelector('textarea[aria-label*="prompt" i]')
                            || document.querySelector('textarea[aria-label*="nhắc" i]')
                            || document.querySelector('.text-input-field');
                
                if (!editor) {
                    console.log("❌ Không tìm thấy ô nhập liệu của Gemini!");
                    return;
                }

                // 2. Chèn Prompt bằng tuyệt chiêu Paste (Vượt qua mọi rào cản của Google)
                editor.focus();
                document.execCommand('selectAll', false, null);
                
                // Giả lập thao tác Ctrl+V (Paste) để lừa framework của Google
                const dataTransfer = new DataTransfer();
                dataTransfer.setData('text/plain', reqData.prompt);
                const pasteEvent = new ClipboardEvent('paste', {
                    clipboardData: dataTransfer,
                    bubbles: true,
                    cancelable: true
                });
                editor.dispatchEvent(pasteEvent);
                
                // Fallback nếu Paste bị chặn
                if (editor.innerText.trim() === '') {
                    document.execCommand('insertText', false, reqData.prompt);
                }
                
                // Kích hoạt các Event để báo cho Google biết ô nhập liệu đã có chữ (để sáng nút Gửi)
                editor.dispatchEvent(new Event('input', {bubbles: true, cancelable: true}));
                editor.dispatchEvent(new Event('change', {bubbles: true, cancelable: true}));

                // 3. Click nút Gửi
                setTimeout(() => {
                    const sendBtn = document.querySelector('button[aria-label*="Send" i]') 
                                 || document.querySelector('button[aria-label*="Gửi" i]')
                                 || document.querySelector('.send-button') 
                                 || document.querySelector('button[mattooltip*="Send" i]')
                                 || document.querySelector('.send-button-container button');
                    
                    if (sendBtn && !sendBtn.disabled && sendBtn.style.display !== 'none') {
                        sendBtn.click();
                    } else {
                        // Fallback: Nhấn Enter cực mạnh nếu không tìm thấy nút click
                        editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
                        editor.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
                        editor.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
                    }

                    // 4. Bắt đầu theo dõi Response trả về
                    if (pollInterval) clearInterval(pollInterval);
                    
                    pollInterval = setInterval(() => {
                        // Quét trong nội dung tin nhắn mới nhất để tối ưu tốc độ thay vì toàn bộ body
                        const msgBlocks = document.querySelectorAll('message-content, .message-content, .model-response-text');
                        const pageText = msgBlocks.length > 0 ? msgBlocks[msgBlocks.length - 1].innerText : document.body.innerText;
                        
                        // Dùng [^\\]]+ để match chuẩn xác hơn kể cả khi có xuống dòng
                        const regex = new RegExp(`\\[FINAL_ANSWER_${reqData.reqId}:\\s*([^\\]]+)\\]`, 'i');
                        const match = pageText.match(regex);
                        
                        if (match) {
                            const finalAns = match[1].replace(/\\*/g, '').trim(); // Xóa dấu markdown ** nếu có
                            
                            // BỎ QUA NẾU MATCH NHẦM VÀO ĐOẠN PROMPT HƯỚNG DẪN CỦA CHÍNH MÌNH!
                            if (finalAns.includes('<ĐÁP_ÁN>')) return;

                            clearInterval(pollInterval);
                            
                            // 5. Bắn kết quả lại cho Moodle
                            GM_setValue('gemini_quiz_response', JSON.stringify({
                                reqId: reqData.reqId,
                                answer: finalAns
                            }));
                        }
                    }, 800);

                }, 600);
            }
        });
    }
})();
