// ==UserScript==
// @name         Thu Thap Quiz va Tu Dong Chuyen Trang Moodle (Gemini Parallel Solver)
// @namespace    http://tampermonkey.net/
// @version      3.1.1
// @description  Song song hoa quiz: nhieu tab Gemini, co anh, khong gioi han dap an
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
// @grant        GM_openInTab
// @connect      discord.com
// @connect      api.telegram.org
// @connect      api.pushbullet.com
// @run-at       document-idle
// ==/UserScript==

(function() {
    "use strict";
    if (window.top !== window.self) return;
    const QUESTIONS_PER_TAB = 3;
    const MAX_TABS = 6;
    const LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const DW = GM_getValue("discord_webhook_url", "");
    const TB = GM_getValue("telegram_bot_token", "");
    const TC = GM_getValue("telegram_chat_id", "");
    const PB = GM_getValue("pushbullet_token", "");
    const cu = window.location.href;
    const st = (m, c) => {
        let t = document.getElementById("quiz-toast");
        if (!t) { t = document.createElement("div"); t.id = "quiz-toast"; t.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(100px);color:white;padding:12px 24px;border-radius:8px;font-weight:600;box-shadow:0 10px 25px rgba(0,0,0,0.3);z-index:1000000;transition:transform 0.3s;pointer-events:none;"; document.body.appendChild(t); }
        t.style.background = c || "#10b981"; t.innerText = m; t.style.transform = "translateX(-50%) translateY(0)"; setTimeout(() => t.style.transform = "translateX(-50%) translateY(100px)", 3000);
    };
    const gid = () => Math.random().toString(36).substring(2, 9);
    const gc = () => {
        const l = document.querySelector('.breadcrumb-item a[href*="course/view.php"], .breadcrumb a[href*="course/view.php"]');
        if (l) { const m = l.href.match(/id=(\d+)/); if (m) return m[1]; }
        return new URLSearchParams(window.location.search).get("id") || "default";
    };
    if (cu.includes("moodle") || cu.includes("courses.hcmus")) {
        const gq = () => JSON.parse(sessionStorage.getItem("moodle_quiz_data") || "{}");
        const sq = (d) => sessionStorage.setItem("moodle_quiz_data", JSON.stringify(d));
        const ex = (q) => {
            const qt = q.querySelector(".qtext");
            if (!qt) return null;
            let txt = qt.innerText.trim();
            let imgs = "";
            qt.querySelectorAll("img").forEach((img, i) => {
                let s = img.src || img.getAttribute("data-src") || "";
                if (s && !s.startsWith("data:") && !s.startsWith("http")) s = new URL(s, location.origin).href;
                if (s) imgs += "\n[IMG_"+ (i+1) +"]: " + s;
                const a = img.getAttribute("alt");
                if (a) txt += "\n(Anh: " + a + ")";
            });
            let opt = "", map = {}, isT = false, isS = false, isR = false;
            const ci = q.querySelectorAll('input[type="radio"]:not(.accesshide):not(.sr-only):not([value="-1"]):not([value="0"]), input[type="checkbox"]:not(.accesshide):not(.sr-only)');
            const sl = q.querySelectorAll("select");
            if (ci.length > 0) {
                isR = q.querySelector('input[type="radio"]') !== null;
                ci.forEach((inp, idx) => {
                    const ltr = idx < LABELS.length ? LABELS[idx] : "?" + idx;
                    const lb = q.querySelector(`label[for="${inp.id}"]`) || inp.parentElement;
                    let t = lb ? lb.innerText.trim() : inp.value;
                    lb.querySelectorAll("img").forEach(img => {
                        let s = img.src || img.getAttribute("data-src") || "";
                        if (s && !s.startsWith("http")) s = new URL(s, location.origin).href;
                        if (s) t += " (" + s + ")";
                    });
                    opt += ltr + ". " + t + "\n";
                    map[ltr] = inp.id;
                });
            } else if (sl.length > 0) { isS = true; opt = "(Dropdown)"; const oo = Array.from(sl[0].querySelectorAll("option")).map(o => o.innerText.trim()).filter(t => t && t.toLowerCase() !== "choose..."); if (oo.length > 0) opt += " [LUACHON]: " + oo.join(" | "); }
            else { isT = true; opt = "(Dien khuyet)"; }
            return { id: q.id, reqId: gid(), txt, imgs, opt, map, isT, isS, isR, el: q };
        };
        const cleanAns = (raw) => {
            return raw.replace(/\*+/g, "").replace(/^["'\s]+|["'\s]+$/g, "").replace(/[\.\s]+$/g, "").trim();
        };
        const sendSlot = (si, qs, gu) => {
            let parts = qs.map((q, i) => "[Q" + (i+1) + " - ID:" + q.reqId + "]: " + q.txt + q.imgs + "\n[OPTIONS " + (i+1) + "]:\n" + q.opt);
            const prompt = parts.join("\n\n---\n\n") + "\n\n---\nTRA LOI CHINH XAC TAT CA CAC CAU TREN.\n\nDinh nghia:\n- Cau trac nghiem (1 dap an): chi ghi 1 chu cai duy nhat, VD: [FINAL_ANSWER_xxx]: C\n- Cau nhieu dap an (checkbox): ghi cac chu cai phan cach bang dau phay, VD: [FINAL_ANSWER_xxx]: A, B, D\n- Cau dien khuyet/dropdown: ghi tu/cum tu chinh xac\n\nDinh dang bat buoc:\n" + qs.map(q => "[FINAL_ANSWER_" + q.reqId + "]: <DAP_AN>").join("\n") + "\n\nQUAN TRONG: KHONG giai thich. KHONG markdown. KHONG them text nao khac.";
            GM_setValue("gs_req_" + si, JSON.stringify({ slotIndex: si, questions: qs.map(q => ({ id: q.id, reqId: q.reqId, isT: q.isT, isS: q.isS, isR: q.isR, map: q.map, txt: q.txt })), prompt, gemUrl: gu, attemptId: new URLSearchParams(window.location.search).get("attempt") || "default" }));
            GM_setValue("gs_act_" + si, "pending");
        };
        let srs = {}, sc = 0, ts = 0, pqs = [];
        const ck = () => { if (sc >= ts && ts > 0) fa(); };
        const parseSingleAnswer = (ans, isR) => {
            if (!ans || ans.trim() === "") return [];
            const a = ans.trim().toUpperCase();
            let ltrs = a.match(/\b[A-Z]\b/g);
            if (!ltrs) ltrs = a.match(/[A-Z]/g);
            if (!ltrs) return [];
            ltrs = [...new Set(ltrs)];
            if (isR) return [ltrs[0]];
            return ltrs;
        };
        const fa = () => {
            const data = gq(); let filled = 0, failed = 0;
            pqs.forEach(pq => {
                const ans = srs[pq.reqId];
                if (!ans) { failed++; return; }
                const el = document.getElementById(pq.id); let ok = false;
                if (pq.isT) {
                    const inp = el ? el.querySelector('input[type="text"]') : null;
                    if (inp) { inp.value = ans; inp.dispatchEvent(new Event("input", {bubbles:true})); inp.dispatchEvent(new Event("change", {bubbles:true})); inp.style.border = "2px solid rgba(49,162,76,0.4)"; inp.style.backgroundColor = "rgba(49,162,76,0.08)"; filled++; }
                    else failed++;
                } else if (pq.isS) {
                    if (el) {
                        const sels = el.querySelectorAll("select"); let sd = false;
                        sels.forEach(sel => {
                            if (sel.value === "" || sel.value === "0") {
                                const mo = Array.from(sel.querySelectorAll("option")).find(o => o.innerText.trim().toLowerCase() === ans.toLowerCase()) || Array.from(sel.querySelectorAll("option")).find(o => o.innerText.trim().toLowerCase().includes(ans.toLowerCase()));
                                if (mo) { sel.value = mo.value; sel.dispatchEvent(new Event("change", {bubbles:true})); sel.style.border = "2px solid rgba(49,162,76,0.4)"; sel.style.backgroundColor = "rgba(49,162,76,0.08)"; sd = true; }
                            }
                        });
                        if (sd) filled++; else failed++;
                    } else failed++;
                } else {
                    const ltrs = parseSingleAnswer(ans, pq.isR);
                    if (ltrs.length === 0) { failed++; return; }
                    ltrs.forEach(l => {
                        const iid = pq.map[l];
                        if (iid) {
                            const inp = document.getElementById(iid);
                            if (inp && !inp.checked) { inp.click(); ok = true; }
                            if (el) {
                                const lb = el.querySelector('label[for="'+iid+'"]') || (inp ? inp.parentElement : null);
                                if (lb) { lb.style.border = "1.5px solid rgba(49,162,76,0.4)"; lb.style.backgroundColor = "rgba(49,162,76,0.08)"; lb.style.borderRadius = "4px"; lb.style.padding = "2px 6px"; }
                            }
                        }
                    });
                    if (ok) filled++; else failed++;
                }
                if (el) el.setAttribute("data-gemini-processed", "true");
                data[pq.id] = { questionId: pq.id, text: pq.txt, aiAnswer: ans };
            });
            sq(data);
            if (failed > 0) { sessionStorage.setItem("quiz_ai_incomplete", "1"); st("Da dien " + filled + "/" + pqs.length + " (" + failed + " that bai) - se KHONG tu dong nop", "#ef4444"); }
            else st("Da dien " + filled + "/" + pqs.length + " cau", "#10b981");
            srs = {}; sc = 0; ts = 0; pqs = [];
            sessionStorage.removeItem("moodle_pending_slots");
            setTimeout(tn, 2000);
        };
        for (let s = 0; s < MAX_TABS; s++) (function(si) {
            GM_addValueChangeListener("gs_resp_" + si, (n, ov, nv, rm) => {
                if (rm && nv) try {
                    const r = JSON.parse(nv);
                    const pd = JSON.parse(sessionStorage.getItem("moodle_pending_slots") || "{}");
                    if (!ts) { ts = pd.total || 0; pqs = pd.pending || []; }
                    if (r.timedOut) sessionStorage.setItem("quiz_ai_incomplete", "1"); // FIX: danh dau de chan auto-submit
                    if (r.answers) Object.entries(r.answers).forEach(([k, v]) => { srs[k] = cleanAns(v); });
                    sc++; st("Tab " + si + ": +" + Object.keys(r.answers||{}).length + " dap an (" + sc + "/" + ts + ")", "#3b82f6");
                    ck();
                } catch(e) {}
            });
        })(s);
        const tn = () => setTimeout(() => {
            const nb = document.querySelector('input[name="next"], button[name="next"], .mod_quiz-next-nav');
            if (nb) { st("Chuyen trang...", "#3b82f6"); nb.click(); }
            else {
                const fb = document.querySelector('input[name="finishattempt"], button[name="finishattempt"]');
                if (fb) { st("Hoan thanh...", "#3b82f6"); fb.click(); }
                else { const sl = document.querySelector('a[href*="summary.php"]'); if (sl) sl.click(); }
            }
        }, 800);
        if (cu.includes("attempt.php")) {
            GM_addValueChangeListener("moodle_quiz_paused", (n, ov, nv, rm) => { if (rm && !nv) { st("Tiep tuc", "#10b981"); setTimeout(pq, 1000); } });
            const pq = () => {
                if (GM_getValue("moodle_quiz_paused", false)) { st("Tam dung", "#6b7280"); return; }
                const qs = document.querySelectorAll(".que");
                if (qs.length === 0) {
                    let rt = parseInt(sessionStorage.getItem("mqer") || "0");
                    if (rt < 30) { sessionStorage.setItem("mqer", String(rt + 1)); st("Doi tai cau hoi (" + (rt+1) + "/30)...", "#f59e0b"); setTimeout(pq, 1000); }
                    else { sessionStorage.removeItem("mqer"); tn(); }
                    return;
                }
                sessionStorage.removeItem("mqer");
                let pend = [];
                qs.forEach(q => {
                    if (q.classList.contains("information") || q.classList.contains("description")) return;
                    const ans = q.querySelector('input[type="radio"]:checked:not(.accesshide):not(.sr-only):not([value="-1"]):not([value="0"]), input[type="checkbox"]:checked:not(.accesshide):not(.sr-only)') ||
                        (q.querySelector('input[type="text"]') && q.querySelector('input[type="text"]').value.trim() !== "") ||
                        (q.querySelectorAll("select").length > 0 && Array.from(q.querySelectorAll("select")).every(s => s.value !== "" && s.value !== "0")) ||
                        q.getAttribute("data-gemini-processed") === "true";
                    if (!ans) { const e = ex(q); if (e) pend.push(e); }
                });
                if (pend.length === 0) { tn(); return; }
                const up = new URLSearchParams(window.location.search);
                const aid = up.get("attempt") || up.get("id") || "default";
                const cid = gc();
                let gu = GM_getValue("gug_" + cid, "");
                if (!gu) { gu = prompt("[Auto-Solver] Mon moi (ID: " + cid + "). Nhap link Custom Gem:") || "https://gemini.google.com/app"; if (!gu.startsWith("https://gemini.google.com")) gu = "https://gemini.google.com/app"; GM_setValue("gug_" + cid, gu); }
                const chunks = [];
                for (let i = 0; i < pend.length; i += QUESTIONS_PER_TAB) chunks.push(pend.slice(i, i + QUESTIONS_PER_TAB));
                const ts2 = Math.min(chunks.length, MAX_TABS);
                st(pend.length + " cau -> " + ts2 + " tab song song", "#3b82f6");
                const ho = sessionStorage.getItem("gemini_tab_opened_" + aid);
                if (!ho) { sessionStorage.setItem("gemini_tab_opened_" + aid, "true"); try { GM_openInTab(gu, { active: false, insert: true, setParent: true }); } catch(e) { try { window.open(gu, "_blank"); } catch(e2) {} } }
                chunks.slice(0, ts2).forEach((chunk, si) => {
                    sendSlot(si, chunk, gu);
                    if (si > 0) setTimeout(() => { try { GM_openInTab(gu + (gu.includes("#") ? "" : "#qslot_"+si), { active: false, insert: true, setParent: true }); } catch(e) {} }, si * 500);
                    else GM_setValue("gs_cur", 0);
                });
                sessionStorage.setItem("moodle_pending_slots", JSON.stringify({ total: ts2, attemptId: aid, pending: pend.map(q => ({ id: q.id, reqId: q.reqId, isT: q.isT, isS: q.isS, isR: q.isR, map: q.map, txt: q.txt })) }));
            };
            setTimeout(pq, 1500);
        } else if (cu.includes("summary.php")) {
            // FIX: khong tu dong nop khi AI timeout / co cau chua dien duoc,
            // va luon cho phep huy trong 30s bang mot nut ro rang.
            const incomplete = sessionStorage.getItem("quiz_ai_incomplete") === "1";
            if (incomplete) {
            sessionStorage.removeItem("quiz_ai_incomplete");
            st("CO CAU CHUA DIEN DUOC -> KHONG tu dong nop. Kiem tra roi nop tay.", "#ef4444");
            } else {
            let cancelled = false, left = 30;
            const cb = document.createElement("button");
            cb.textContent = "HUY tu dong nop (30s)";
            cb.style.cssText = "position:fixed;top:12px;right:12px;z-index:2147483647;background:#ef4444;color:#fff;border:0;border-radius:8px;padding:10px 14px;font:600 13px system-ui;cursor:pointer;";
            cb.onclick = () => { cancelled = true; cb.disabled = true; cb.textContent = "Da huy tu dong nop"; st("Da huy tu dong nop", "#6b7280"); };
            (document.body || document.documentElement).appendChild(cb);
            const ci = setInterval(() => { left--; if (left <= 0) { clearInterval(ci); return; } if (!cancelled) cb.textContent = "HUY tu dong nop (" + left + "s)"; }, 1000);
            st("Cho 30s truoc khi nop (bam nut do de huy)...", "#f59e0b");
            setTimeout(() => {
                if (cancelled) { st("Da huy - khong nop bai", "#6b7280"); return; }
                const oc = window.confirm; window.confirm = () => true;
                const btn = Array.from(document.querySelectorAll("button, input")).find(b => { const t = (b.textContent || b.value || "").toLowerCase(); return t.includes("submit all and finish") || t.includes("nop bai va ket thuc"); });
                if (btn) { sessionStorage.setItem("quiz_just_submitted", "true"); btn.click(); setTimeout(() => { const btn2 = Array.from(document.querySelectorAll(".modal-dialog button, .confirmation-dialog button, input")).find(b => { const t = (b.textContent || b.value || "").toLowerCase(); return t.includes("submit all and finish") || t.includes("nop bai va ket thuc"); }); if (btn2) btn2.click(); setTimeout(() => { window.confirm = oc; }, 2000); }, 1000); }
            }, 30000);
            }
        } else if (cu.includes("review.php") || cu.includes("view.php")) {
            if (sessionStorage.getItem("quiz_just_submitted") === "true") {
                sessionStorage.removeItem("quiz_just_submitted"); st("Quet diem...", "#3b82f6");
                let grade = "Da nop (chua co diem)";
                document.querySelectorAll("h2, h3, h4, p, td, th, span, div.grade").forEach(el => { const t = el.textContent.trim(); if (t.includes("Diem tong ket") || t.includes("Final grade") || t.includes("Grade for this attempt") || t.includes("Grade:")) grade = t.replace(/\s+/g, " ").trim(); });
                if (grade.includes("chua co diem")) { const tab = document.querySelector(".generaltable"); if (tab) tab.querySelectorAll("tbody tr").forEach(row => { if (row.textContent.toLowerCase().includes("finished") || row.textContent.toLowerCase().includes("da nop") || row.textContent.toLowerCase().includes("hoan thanh")) row.querySelectorAll("td").forEach(c => { const v = c.textContent.trim(); if (v.includes("/")) grade = "Diem: " + v; }); }); }
                const data = gq(); const items = Object.values(data);
                let lq = items.map((item, i) => "Cau " + (i+1) + ": [" + (item.aiAnswer||"?") + "] -> " + ((item.text||"").substring(0,60).replace(/\n/g," ")||"") + "...").join("\n");
                if (lq.length > 2500) lq = lq.substring(0,2500) + "\n...";
                const title = "DA NOP BAI (PARALLEL)"; const msg = grade + "\n" + items.length + " cau\n\n" + lq + "\n\nTrang: " + location.href.split("?")[0];
                if (TB) GM_xmlhttpRequest({ method: "POST", url: "https://api.telegram.org/bot" + TB + "/sendMessage", headers: {"Content-Type": "application/json"}, data: JSON.stringify({chat_id: TC, text: title + "\n\n" + msg, disable_web_page_preview: true}) });
                if (PB) GM_xmlhttpRequest({ method: "POST", url: "https://api.pushbullet.com/v2/pushes", headers: {"Access-Token": PB, "Content-Type": "application/json"}, data: JSON.stringify({type: "note", title, body: msg}) });
                if (DW) GM_xmlhttpRequest({ method: "POST", url: DW, headers: {"Content-Type": "application/json"}, data: JSON.stringify({embeds: [{title, description: msg, color: 0x10b981}]}) });
                sessionStorage.removeItem("moodle_quiz_data"); st("Da gui report!", "#10b981");
            } else if (cu.includes("view.php")) {
                const pi = document.querySelector('input[type="password"]');
                if (!pi || pi.value.trim() !== "") {
                    const sb = Array.from(document.querySelectorAll("button, input, a")).find(b => { const t = (b.textContent || b.value || "").toLowerCase().trim(); return t.includes("attempt quiz now") || t.includes("bat dau kiem tra") || t.includes("lam bai kiem tra") || t.includes("continue the last attempt") || t.includes("continue") || t.includes("tiep tuc lan lam bai truoc"); });
                    if (sb) { st("Bat dau...", "#3b82f6"); sessionStorage.removeItem("moodle_quiz_data"); sb.click(); setTimeout(() => { const cb = document.getElementById("id_submitbutton"); if (cb) cb.click(); const mb = Array.from(document.querySelectorAll('input[type="button"], button')).find(b => { const t = (b.textContent || b.value || "").toLowerCase(); return t.includes("start attempt") || t.includes("bat dau lam bai"); }); if (mb) mb.click(); }, 500); }
                    else { const pt = document.body.innerText.toLowerCase(); if (!(pt.includes("diem tong ket") || pt.includes("final grade") || pt.includes("no more attempts are allowed") || pt.includes("khong duoc phep lam bai them") || (document.querySelector(".generaltable") && (pt.includes("finished") || pt.includes("da nop"))))) { st("Chua thay nut. Reload...", "#f59e0b"); setTimeout(() => location.reload(), 3000); } }
                }
            }
        }
    } else if (cu.includes("gemini.google.com")) {
        let pi = null;
        const hm = window.location.hash.match(/qslot_(\d+)/);
        const ms = hm ? parseInt(hm[1]) : GM_getValue("gs_cur", 0);
        const esp = (rd) => {
            const ed = document.querySelector('rich-textarea div[contenteditable="true"]') || document.querySelector('g-textarea-input div[contenteditable="true"]') || document.querySelector('[contenteditable="true"][role="textbox"]') || document.querySelector('[data-test-id="input-area"]') || document.querySelector('[data-test-id="input-area"] div[contenteditable="true"]') || document.querySelector('textarea[aria-label*="prompt" i]') || document.querySelector('textarea[aria-label*="nh?c" i]') || document.querySelector("textarea[placeholder]") || document.querySelector(".text-input-field") || document.querySelector(".input-area") || document.querySelector(".prompt-input") || document.querySelector('div[contenteditable="true"]');
            if (!ed) { st("Khong tim thay o nhap Gemini!", "#ef4444"); return; }
            ed.focus(); document.execCommand("selectAll", false, null);
            const dt = new DataTransfer(); dt.setData("text/plain", rd.prompt);
            ed.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
            if (ed.innerText.trim() === "") document.execCommand("insertText", false, rd.prompt);
            if (ed.innerText.trim() === "") ed.innerText = rd.prompt;
            ed.dispatchEvent(new Event("input", {bubbles:true})); ed.dispatchEvent(new Event("change", {bubbles:true}));
            setTimeout(() => {
                const sb = document.querySelector('button[aria-label*="Send" i]') || document.querySelector('button[aria-label*="G?i" i]') || document.querySelector('button[data-test-id="send-button"]') || document.querySelector('button[aria-label*="Send prompt" i]') || document.querySelector(".send-button") || document.querySelector('button[mattooltip*="Send" i]') || document.querySelector(".send-button-container button") || document.querySelector("button.send") || document.querySelector("button.primary");
                if (sb && !sb.disabled && sb.style.display !== "none") sb.click();
                else { ed.dispatchEvent(new KeyboardEvent("keydown", {key:"Enter",keyCode:13,which:13,bubbles:true})); ed.dispatchEvent(new KeyboardEvent("keypress", {key:"Enter",keyCode:13,which:13,bubbles:true})); ed.dispatchEvent(new KeyboardEvent("keyup", {key:"Enter",keyCode:13,which:13,bubbles:true})); }
                if (pi) clearInterval(pi);
                const stt = Date.now();
                pi = setInterval(() => {
                    const mbs = document.querySelectorAll("message-content, .message-content, .model-response-text, [data-message-id], .response-content, .message, .answer, .model-response, [data-test-id=\"response-text\"]");
                    const pt = mbs.length > 0 ? mbs[mbs.length - 1].innerText : document.body.innerText;
                    let all = true, ans = {};
                    rd.questions.forEach(q => {
                        // FIX: prompt yeu cau dinh dang "[FINAL_ANSWER_id]: X" (dau ":" NGOAI ngoac)
                        // regex cu dat ":" trong ngoac nen KHONG BAO GIO khop -> luon timeout.
                        const rx = new RegExp("\\[FINAL_ANSWER_" + q.reqId + "(?::\\s*([^\\]\\n]+)\\]|\\]\\s*:?\\s*([^\\n]+))", "i");
                        const m = pt.match(rx);
                        if (m) { const a = (m[1] || m[2] || "").replace(/\*+/g, "").replace(/^["'\s]+|["'\s]+$/g, "").replace(/[\.\s]+$/g, "").trim(); if (a.includes("<DAP_AN>")) { all = false; return; } ans[q.reqId] = a; }
                        else all = false;
                    });
                    if (all && Object.keys(ans).length > 0) { clearInterval(pi); GM_setValue("gs_resp_" + ms, JSON.stringify({ slotIndex: ms, answers: ans })); st("Tab " + ms + ": xong " + Object.keys(ans).length + " cau", "#10b981"); }
                    // FIX: khong bia dap an "A" khi timeout. Chi gui nhung cau THUC SU doc duoc,
                    // kem co timedOut de phia Moodle huy tu dong nop bai.
                    else if (Date.now() - stt > 60000) { clearInterval(pi); const got = Object.keys(ans).length; GM_setValue("gs_resp_" + ms, JSON.stringify({ slotIndex: ms, answers: ans, timedOut: true, missing: rd.questions.length - got })); st("Tab " + ms + ": TIMEOUT - chi co " + got + "/" + rd.questions.length + " cau", "#ef4444"); }
                }, 1000);
            }, 600);
        };
        const sk = "gs_req_" + ms;
        GM_addValueChangeListener(sk, (n, ov, nv, rm) => { if (rm && nv) try { const rd = JSON.parse(nv); if (rd.slotIndex === ms) esp(rd); } catch(e) {} });
        const cpr = () => { const rs = GM_getValue(sk, ""); if (rs) try { const rd = JSON.parse(rs); const rs2 = GM_getValue("gs_resp_" + ms, ""); if (!rs2) setTimeout(() => esp(rd), 2000); } catch(e) {} };
        cpr();
        st("Gemini Slot " + ms + " san sang", "#3b82f6");
        if (ms === 0 && !window.location.hash.includes("qslot_")) { window.location.hash = "qslot_0"; }
    }
})();
