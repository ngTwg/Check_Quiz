// ==UserScript==
// @name         Facebook Auto Commenter & Interaction Bot
// @namespace    http://tampermonkey.net/
// @version      21.1
// @description  Bản 21.1 (Ultimate Stable): Chia tách 2 pha Activator - Opened Composer, bám sát cấu trúc DOM nhóm Facebook và tối ưu hoá Post Shell.
// @author       Antigravity (Collaborative)
// @match        https://www.facebook.com/*
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // ==========================================
    // UI STYLES
    // ==========================================
    const panelStyle = `
        #fb-auto-commenter-panel {
            position: fixed; top: 60px; right: 20px; width: 380px;
            background: rgba(24, 25, 26, 0.95); backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px;
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5); color: #e4e6eb;
            font-family: 'Segoe UI', sans-serif; z-index: 99999;
            transition: all 0.3s; display: flex; flex-direction: column;
        }
        #fb-auto-commenter-panel.minimized {
            width: 60px; height: 60px; border-radius: 50%; top: 80px; align-items: center; justify-content: center; background: #1877f2; cursor: pointer;
        }
        #fb-auto-commenter-panel.minimized .panel-content, 
        #fb-auto-commenter-panel.minimized .panel-header { display: none; }
        .panel-icon-toggle { display: none; font-size: 24px; color: white; width: 100%; height: 100%; align-items: center; justify-content: center; }
        #fb-auto-commenter-panel.minimized .panel-icon-toggle { display: flex; }
        .panel-header { padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center; }
        .panel-title { font-weight: 600; font-size: 15px; display: flex; align-items: center; gap: 8px; color: #1877f2; }
        .pulse-dot { width: 8px; height: 8px; background-color: #31a24c; border-radius: 50%; animation: pulse 1.6s infinite; }
        @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(49,162,76,0.7); } 70% { box-shadow: 0 0 0 8px rgba(49,162,76,0); } 100% { box-shadow: 0 0 0 0 rgba(49,162,76,0); } }
        .minimize-btn { background: none; border: none; color: #b0b3b8; cursor: pointer; font-size: 18px; transition: 0.2s; }
        .minimize-btn:hover { color: white; }
        .panel-content { padding: 16px; display: flex; flex-direction: column; gap: 12px; max-height: 75vh; overflow-y: auto; }
        .panel-content::-webkit-scrollbar { width: 6px; }
        .panel-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 10px; }
        .panel-field { display: flex; flex-direction: column; gap: 4px; }
        .panel-field.checkbox-row { flex-direction: row; align-items: center; gap: 8px; cursor: pointer; }
        .panel-field label { font-size: 12px; color: #b0b3b8; font-weight: 500; }
        .panel-field.checkbox-row label { font-size: 13px; color: #e4e6eb; }
        .panel-input { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 8px 12px; color: white; font-size: 13px; outline: none; transition: 0.2s; }
        .panel-input:focus { border-color: #1877f2; }
        .comment-item { display: flex; gap: 8px; margin-bottom: 8px; }
        .comment-item .panel-input { flex: 1; margin: 0; }
        .remove-btn { background: rgba(243,66,95,0.2); color: #f3425f; border: none; border-radius: 6px; width: 32px; cursor: pointer; font-weight: bold; }
        .remove-btn:hover { background: #f3425f; color: white; }
        .delay-row { display: flex; gap: 8px; } .delay-row > div { flex: 1; }
        .kw-section { background: rgba(24,119,242,0.05); border: 1px dashed rgba(24,119,242,0.3); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
        .panel-btn { background: #1877f2; border: none; border-radius: 8px; padding: 10px; color: white; font-weight: 600; cursor: pointer; transition: 0.2s; text-align: center;}
        .panel-btn:hover { background: #1565c0; }
        .panel-btn.stop { background: #e41e3f; } .panel-btn.stop:hover { background: #c21833; }
        .panel-btn.secondary { background: #2b2c2d; border: 1px dashed #b0b3b8; font-size: 12px; padding: 6px; }
        .panel-btn.secondary:hover { background: #3a3b3c; border-color: white; }
        .log-box { background: rgba(0,0,0,0.3); border-radius: 8px; padding: 8px 12px; height: 100px; overflow-y: auto; font-family: monospace; font-size: 11px; color: #a8abaf; }
        .log-item { margin-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.02); padding-bottom: 2px; }
        .log-item.success { color: #31a24c; } .log-item.error { color: #f3425f; } .log-item.info { color: #1877f2; }
        
        .fb-autocomment-target { border: 3px solid #1877f2 !important; border-radius: 12px; box-shadow: 0 0 20px rgba(24,119,242,0.6); transition: 0.3s; position: relative; }
        .bot-debug-label { position: absolute; top: -10px; left: 10px; background: #e41e3f; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 12px; z-index: 1000; box-shadow: 0 2px 5px rgba(0,0,0,0.3); pointer-events: none;}
        
        .theme-toggle-btn { background: none; border: none; color: #b0b3b8; cursor: pointer; font-size: 18px; transition: 0.2s; margin-right: 8px; }
        .theme-toggle-btn:hover { color: white; }
        
        /* LIGHT THEME */
        #fb-auto-commenter-panel.light-theme { background: rgba(255, 255, 255, 0.95); border: 1px solid rgba(0, 0, 0, 0.1); color: #050505; }
        #fb-auto-commenter-panel.light-theme .panel-header { border-bottom: 1px solid rgba(0,0,0,0.08); }
        #fb-auto-commenter-panel.light-theme .minimize-btn, #fb-auto-commenter-panel.light-theme .theme-toggle-btn { color: #65676b; }
        #fb-auto-commenter-panel.light-theme .minimize-btn:hover, #fb-auto-commenter-panel.light-theme .theme-toggle-btn:hover { color: #050505; }
        #fb-auto-commenter-panel.light-theme .panel-field label { color: #65676b; }
        #fb-auto-commenter-panel.light-theme .panel-field.checkbox-row label { color: #050505; }
        #fb-auto-commenter-panel.light-theme .panel-input { background: rgba(0,0,0,0.04); border: 1px solid rgba(0,0,0,0.1); color: #050505; }
        #fb-auto-commenter-panel.light-theme .log-box { background: rgba(0,0,0,0.04); color: #65676b; border: 1px solid rgba(0,0,0,0.05); }
    `;
    GM_addStyle(panelStyle);

    // ==========================================
    // GLOBALS & STATE
    // ==========================================
    let isRunning = false;
    let commentsList = [];
    let currentCommentIdx = 0;
    let useRandomComment = true;
    let kwList = [];
    let kwCommentsList = [];
    let minDelay = 15;
    let maxDelay = 35;
    let commentCount = 0;
    
    let donePostIds = new Set();
    let inFlightPostIds = new Set();
    let submittedPostIds = new Set();
    
    let myAccountNames = ["Tài Khoản AI"];
    let enableLikePost = true;
    let enableScrollSim = true;
    let enableLikeComment = true;
    let enableTypoSim = true;
    let enableReadingSim = true;
    let selectedImageFile = null;

    // ==========================================
    // UTILITIES
    // ==========================================
    const delay = ms => new Promise(res => setTimeout(res, ms));

    function log(message, type = 'info') {
        const logBox = document.getElementById('fb-auto-commenter-log');
        if (!logBox) return;
        const item = document.createElement('div');
        item.className = `log-item ${type}`;
        item.innerText = `[${new Date().toLocaleTimeString()}] ${message}`;
        logBox.appendChild(item);
        logBox.scrollTop = logBox.scrollHeight;
        console.log(`[FB-Bot] ${message}`);
    }

    function normalizeText(s = "") {
        return s.replace(/\s+/g, ' ').trim().toLowerCase();
    }

    function parseSpintax(text) {
        let matches = text.match(/{[^{}]+}/g);
        if (!matches) return text;
        for (let i = 0; i < matches.length; i++) {
            let spin = matches[i];
            let choices = spin.substring(1, spin.length - 1).split('|');
            text = text.replace(spin, choices[Math.floor(Math.random() * choices.length)]);
        }
        return parseSpintax(text);
    }

    function drawDebugOverlay(post, postId) {
        post.classList.add('fb-autocomment-target');
        let debugLabel = post.querySelector('.bot-debug-label');
        if (!debugLabel) {
            debugLabel = document.createElement('div');
            debugLabel.className = 'bot-debug-label';
            post.appendChild(debugLabel);
        }
        debugLabel.innerText = `[Bot] Post ID: ${postId}`;
    }

    function isInsideBotPanel(el) {
        return !!(el && el.closest && el.closest('#fb-auto-commenter-panel'));
    }

    function getPostIdFromHref(href = '') {
        const m = href.match(/(?:\/posts\/|\/permalink\/|\/videos\/|\/reel\/|fbid=)(\d+)/);
        return m ? m[1] : null;
    }

    function canonicalizeFbUrl(raw = '') {
        try {
            const u = new URL(raw, location.origin);
            const keep = new URLSearchParams();

            ['comment_id', 'reply_comment_id', 'fbid', 'id'].forEach(k => {
                const v = u.searchParams.get(k);
                if (v) keep.set(k, v);
            });

            let path = u.pathname
                .replace(/\/+$/, '')
                .toLowerCase();

            return path + (keep.toString() ? `?${keep.toString()}` : '');
        } catch {
            return normalizeText(raw.split('?')[0] || '');
        }
    }

    function extractIdentityHints(inputs = []) {
        const raw = inputs.map(v => (v || '').trim()).filter(Boolean);
        const hints = new Set();

        for (const v of raw) {
            const n = normalizeText(v);
            if (/^\d+$/.test(n)) hints.add(n);

            try {
                const u = new URL(v.startsWith('http') ? v : `https://www.facebook.com/${v.replace(/^\/+/, '')}`);
                const p = u.pathname.replace(/\/+$/, '').toLowerCase();

                hints.add(p);
                hints.add(canonicalizeFbUrl(u.href));

                const m1 = p.match(/\/groups\/\d+\/user\/(\d+)/);
                const m2 = p.match(/\/user\/(\d+)/);
                const m3 = u.searchParams.get('id');

                if (m1) hints.add(m1[1]);
                if (m2) hints.add(m2[1]);
                if (m3) hints.add(m3);
            } catch {}
        }

        return [...hints];
    }

    function getVisibleLeafTexts(root = document.body) {
        return [...root.querySelectorAll('*')]
            .filter(el => {
                if (isInsideBotPanel(el)) return false;
                if (el.children.length > 0) return false;
                const txt = normalizeText(el.textContent || '');
                return !!txt;
            })
            .map(el => normalizeText(el.textContent || ''));
    }

    function hasSuccessToast() {
        const texts = getVisibleLeafTexts(document.body);
        return texts.some(t =>
            t.includes('đã gửi bình luận của bạn') ||
            t.includes('your comment has been posted') ||
            t.includes('comment was posted')
        );
    }

    function isVisible(el) {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const st = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
    }

    function getNodeDepthWithin(root, node) {
        let d = 0, cur = node;
        while (cur && cur !== root) {
            d++;
            cur = cur.parentElement;
        }
        return d;
    }

    // ==========================================
    // MODULE: DETECTORS & VERIFIERS
    // ==========================================
    function getPostShellFromAnchor(anchor, expectedPostId) {
        const candidates = [];
        let node = anchor;

        for (let i = 0; i < 20 && node; i++, node = node.parentElement) {
            if (isInsideBotPanel(node)) break;
            if (node.tagName !== 'DIV') continue;

            const text = normalizeText(node.innerText || '');
            const containsCurrentPost = [...node.querySelectorAll('a[href]')].some(a => {
                const m = a.href.match(/(?:\/posts\/|\/permalink\/|fbid=)(\d+)/);
                return m && m[1] === expectedPostId;
            });

            if (!containsCurrentPost) continue;

            const hasSocial = /thích|bày tỏ cảm xúc|chia sẻ/.test(text);
            const hasCommentArea = /xem thêm bình luận|bình luận dưới tên/.test(text);
            const hasPostActionLabel = text.includes('hành động đối với bài viết này');
            const composerCount = (text.match(/bình luận dưới tên/g) || []).length;
            const shareGroupCount = (text.match(/đã chia sẻ với nhóm công khai/g) || []).length;

            if (hasSocial) {
                let score = (hasSocial ? 4 : 0) + (hasCommentArea ? 5 : 0) - Math.min(text.length / 800, 5);
                score += hasPostActionLabel ? 8 : 0;
                score -= composerCount > 1 ? 10 : 0;
                score -= shareGroupCount > 1 ? 12 : 0;
                
                candidates.push({
                    node,
                    score,
                    textLen: text.length
                });
            }
        }

        candidates.sort((a, b) => b.score - a.score || a.textLen - b.textLen);
        return candidates[0]?.node || null;
    }

    function scanPosts() {
        const postsMap = new Map();

        // 1. Phân tích qua chuẩn role="article" (Cấu trúc DOM hiện đại nhất của FB)
        const articles = document.querySelectorAll('[role="article"]');
        for (const article of articles) {
            if (isInsideBotPanel(article)) continue;
            
            // Tìm ID bài viết từ các thẻ a bên trong
            const anchors = [...article.querySelectorAll('a[href]')];
            let postId = null;
            for (const a of anchors) {
                const href = a.href || '';
                if (href.includes('comment_id=')) continue;
                const m = href.match(/(?:\/posts\/|\/permalink\/|\/videos\/|\/reel\/|fbid=)(\d+)/);
                if (m) {
                    postId = m[1];
                    break;
                }
            }
            if (postId && !postsMap.has(postId)) {
                article._cachedSigId = postId;
                postsMap.set(postId, article);
            }
        }

        // 2. Fallback: Nếu không quét được article, tìm qua thẻ <a> (Cấu trúc cũ)
        if (postsMap.size === 0) {
            const anchors = [...document.querySelectorAll('a[href]')]
                .filter(a => {
                    if (isInsideBotPanel(a)) return false;
                    const href = a.href || '';
                    if (href.includes('comment_id=')) return false;
                    return /\/posts\/\d+|\/permalink\/\d+|\/videos\/\d+|\/reel\/\d+|[?&]fbid=\d+/.test(href);
                });

            for (const a of anchors) {
                const postId = getPostIdFromHref(a.href);
                if (!postId || postsMap.has(postId)) continue;

                const shell = getPostShellFromAnchor(a, postId);
                if (shell) {
                    shell._cachedSigId = postId;
                    postsMap.set(postId, shell);
                }
            }
        }

        return postsMap;
    }

    function findCommentActivator(post) {
        const postId = post._cachedSigId;
        const nodes = [...post.querySelectorAll('div, span, [role="button"]')].filter(el => {
            if (isInsideBotPanel(el) || !isVisible(el)) return false;
            const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
            const txt = normalizeText(el.textContent || '') + ' ' + ariaLabel;
            if (!txt.trim()) return false;

            const hasMainSignal =
                txt.includes('bình luận dưới tên') ||
                txt.includes('viết bình luận') ||
                txt.includes('đăng bình luận') ||
                txt.includes('để lại bình luận') ||
                txt.includes('write a comment') ||
                txt.includes('write an answer') ||
                txt.includes('comment as');

            const hasReplySignal =
                txt.includes('trả lời dưới tên') ||
                txt.includes('viết phản hồi') ||
                txt.includes('reply to') ||
                txt.includes('write a reply');

            const hasCommentPermalink = !!el.querySelector?.('a[href*="comment_id="]');

            return hasMainSignal && !hasReplySignal && !hasCommentPermalink;
        });

        const ranked = nodes
            .map(el => {
                const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
                const txt = normalizeText(el.innerText || '') + ' ' + ariaLabel;
                const hasMedia = /đính kèm một ảnh hoặc video|bình luận bằng file gif|attach a photo|comment with a gif/.test(txt);
                const hasPostAction = txt.includes('hành động đối với bài viết này') || txt.includes('action for this post');
                const depth = getNodeDepthWithin(post, el);
                return {
                    el,
                    score:
                        (txt.includes('bình luận dưới tên') || txt.includes('comment as') ? 12 : 0) +
                        (txt.includes('đăng bình luận') || txt.includes('viết bình luận') || txt.includes('write a comment') ? 6 : 0) +
                        (hasMedia ? 3 : 0) +
                        (hasPostAction ? 4 : 0) -
                        depth * 0.2
                };
            })
            .sort((a, b) => b.score - a.score);

        return ranked[0]?.el || null;
    }

    function findOpenedComposerNearActivator(post, activator) {
        const textboxes = [...post.querySelectorAll('[contenteditable="true"], [role="textbox"], textarea')]
            .filter(el => !isInsideBotPanel(el) && isVisible(el));

        const ranked = textboxes.map(tb => {
            const box = tb.closest('div') || tb.parentElement || tb;
            const ariaLabel = (tb.getAttribute('aria-label') || '').toLowerCase();
            const boxAria = (box.getAttribute('aria-label') || '').toLowerCase();
            const txt = normalizeText((box?.innerText || tb.innerText || '')) + ' ' + ariaLabel + ' ' + boxAria;
            
            const hasReplySignal = /trả lời dưới tên|viết phản hồi|reply to|write a reply/i.test(txt);
            const hasMainSignal = txt.includes('bình luận dưới tên') || txt.includes('write a comment') || txt.includes('comment as') || txt.includes('viết bình luận') || ariaLabel.includes('viết bình luận') || boxAria.includes('viết bình luận');
            const hasMedia = /đính kèm một ảnh hoặc video|bình luận bằng file gif|attach a photo|comment with a gif/i.test(txt);
            const hasCommentPermalink = !!(box?.querySelector?.('a[href*="comment_id="]'));
            const submit = [...(box?.querySelectorAll?.('div,span,button,[role="button"]') || [])].find(el => {
                const t = (el.textContent || '').trim();
                const a = el.getAttribute?.('aria-label') || '';
                return /^(Đăng bình luận|Đăng|Gửi|Comment|Post|Send)$/i.test(t) || /đăng bình luận|đăng|gửi|comment|post|send/i.test(a.toLowerCase());
            });

            let proximity = 0;
            if (activator) {
                const r1 = activator.getBoundingClientRect();
                const r2 = tb.getBoundingClientRect();
                proximity = Math.abs(r1.top - r2.top) + Math.abs(r1.left - r2.left);
            }

            return {
                box: box || tb,
                textbox: tb,
                submit,
                fileInput: (box || tb).querySelector?.('input[type="file"][accept*="image"]') || null,
                score:
                    (hasMainSignal ? 10 : 0) +
                    (hasMedia ? 4 : 0) +
                    (submit ? 5 : 0) -
                    (hasReplySignal ? 15 : 0) -
                    (hasCommentPermalink ? 10 : 0) -
                    proximity / 500
            };
        }).sort((a, b) => b.score - a.score);

        log(`Opened candidate count = ${textboxes.length}, bestScore = ${ranked[0]?.score ?? 'none'}`, 'info');
        if (ranked[0]) {
            log(`bestOpenedBox = ${normalizeText(ranked[0].box.innerText).slice(0, 150)}`, 'info');
        }

        return ranked[0] || null;
    }

    function findMainComposer(post) {
        // Hàm này tìm kiếm composer đã mở sẵn mà không cần activator
        return findOpenedComposerNearActivator(post, null);
    }

    function getClosestCommentBlockFromPermalink(a) {
        const candidates = [];
        let node = a;

        for (let i = 0; i < 10 && node; i++, node = node.parentElement) {
            if (isInsideBotPanel(node)) break;

            const text = normalizeText(node.innerText || '');
            const permalinkCount = node.querySelectorAll('a[href*="comment_id="]').length;
            const hasPermalink = permalinkCount >= 1;
            const hasActions = /thích|bày tỏ cảm xúc|trả lời|chia sẻ/.test(text);
            const hasAuthor =
                !!node.querySelector('a[href*="/groups/"][href*="/user/"]') ||
                !!node.querySelector('a[href*="/user/"]') ||
                !!node.querySelector('a[href*="profile.php"]');
            const isComposer = /bình luận dưới tên|đăng bình luận|viết phản hồi|trả lời dưới tên/.test(text);

            if (hasPermalink && hasActions && hasAuthor && !isComposer) {
                candidates.push({
                    node,
                    depth: i,
                    textLen: text.length,
                    permalinkCount
                });
            }
        }

        candidates.sort((x, y) =>
            x.permalinkCount - y.permalinkCount ||
            x.textLen - y.textLen ||
            x.depth - y.depth
        );

        return candidates[0]?.node || null;
    }

    function getRenderedCommentBlocks(post) {
        const links = [...post.querySelectorAll('a[href*="comment_id="]')]
            .filter(a => !isInsideBotPanel(a));

        const blocks = [];

        for (const a of links) {
            const block = getClosestCommentBlockFromPermalink(a);
            if (block && !blocks.includes(block)) {
                blocks.push(block);
            }
        }

        return blocks;
    }

    function confirmComment(post, expectedText = "") {
        const expected = normalizeText(expectedText).slice(0, 80);
        const myNames = myAccountNames.map(normalizeText);
        const myHints = extractIdentityHints(myAccountNames);

        return getRenderedCommentBlocks(post).some(block => {
            const text = normalizeText(block.innerText || '');
            const links = [...block.querySelectorAll('a[href]')];

            const hrefs = links.map(a => canonicalizeFbUrl(a.href));
            const names = links.map(a => normalizeText(a.textContent || ''));

            const hasMyHref = hrefs.some(h =>
                myHints.some(hint =>
                    h.includes(hint) ||
                    new RegExp(`(^|\\D)${hint}(\\D|$)`).test(h)
                )
            );

            const hasMyName = names.some(n => myNames.includes(n));
            const hasExpected = !expected || text.includes(expected);
            const hasPermalink = !!block.querySelector('a[href*="comment_id="]');

            return hasPermalink && (hasMyHref || hasMyName) && hasExpected;
        });
    }

    // ==========================================
    // MODULE: WORKFLOW
    // ==========================================
    function getNextPost() {
        const candidateMap = scanPosts();

        for (let [postId, post] of candidateMap.entries()) {
            if (donePostIds.has(postId) || inFlightPostIds.has(postId) || submittedPostIds.has(postId)) continue;

            if (confirmComment(post, "")) {
                log(`Bài ID ${postId} đã có bình luận của bạn từ trước. Bỏ qua.`, 'info');
                donePostIds.add(postId);
                continue;
            }

            post._cachedSigId = postId;
            return post;
        }
        return null;
    }

    async function tryLikePost(post) {
        log("Kiểm tra trạng thái Thích bài viết...", 'info');
        let likeBtn = [...post.querySelectorAll('div[role="button"], span, div')]
            .find(el => {
                const label = (el.getAttribute('aria-label') || '').toLowerCase();
                const text = (el.innerText || '').trim().toLowerCase();
                return label.includes('thích') || label.includes('like') || label.includes('bày tỏ cảm xúc') || 
                       text === 'thích' || text === 'like';
            });
        
        if (likeBtn) {
            let clickTarget = likeBtn.closest('[role="button"]') || likeBtn;
            const label = (clickTarget.getAttribute('aria-label') || '').toLowerCase();
            const isLiked = label.includes('bỏ thích') || label.includes('remove like') || clickTarget.getAttribute('aria-pressed') === 'true';

            if (!isLiked) {
                clickTarget.click();
                log("Đã Thích bài viết.", 'success');
                await delay(1500);
            } else {
                log("Bài viết đã được Thích từ trước.", 'info');
            }
        } else {
            log("Không tìm thấy nút Thích bài viết.", 'info');
        }
    }

    async function tryLikeComments(post) {
        log("Đang quét bình luận để Thích dạo...", 'info');
        const commentBlocks = getRenderedCommentBlocks(post);
        log(`Tìm thấy ${commentBlocks.length} bình luận để kiểm tra.`, 'info');
        
        let likedCount = 0;
        // Lỗi Hồi Quy (Regression): Tự động Thích dạo toàn bộ bình luận có thể gây kẹt workflow hoặc dính Spam Block của Facebook.
        // Giải pháp: Giới hạn số lượng Like ngẫu nhiên (Tối đa 2-3 lượt) để giả lập hành vi người dùng thật.
        const maxLikes = Math.floor(Math.random() * 3) + 1; 

        for (const block of commentBlocks) {
            if (likedCount >= maxLikes) break;

            let likeBtn = [...block.querySelectorAll('div[role="button"], span, a')]
                .find(el => {
                    const label = (el.getAttribute('aria-label') || '').toLowerCase();
                    const text = (el.innerText || '').trim().toLowerCase();
                    return (label === 'thích' || label === 'like' || text === 'thích' || text === 'like') && 
                           !label.includes('bỏ');
                });
                
            if (likeBtn) {
                let clickTarget = likeBtn.closest('[role="button"]') || likeBtn;
                const parentLabel = (clickTarget.getAttribute('aria-label') || '').toLowerCase();
                const isLiked = parentLabel.includes('bỏ thích') || parentLabel.includes('remove like') || 
                                clickTarget.getAttribute('aria-pressed') === 'true' ||
                                clickTarget.classList.contains('selected');
                                
                if (!isLiked) {
                    clickTarget.click();
                    likedCount++;
                    await delay(1000 + Math.random() * 1000);
                }
            }
        }
        if (likedCount > 0) {
            log(`Đã thích dạo thành công ${likedCount} bình luận.`, 'success');
        } else {
            log("Không có bình luận mới nào chưa thích hoặc không tìm thấy nút thích bình luận.", 'info');
        }
    }

    async function ensureComposerReady(tb) {
        tb.scrollIntoView({ behavior: 'smooth', block: 'center' });
        tb.focus();
        await delay(300);

        const sel = window.getSelection();
        const ok = sel && sel.anchorNode && tb.contains(sel.anchorNode);
        if (!ok) {
            const range = document.createRange();
            range.selectNodeContents(tb);
            range.collapse(false);
            if (sel) {
                sel.removeAllRanges();
                sel.addRange(range);
            }
        }

        await delay(200);
        return document.activeElement === tb || (sel && tb.contains(sel.anchorNode));
    }

    async function waitForTextbox(post, activator, timeout = 5000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const composer = findOpenedComposerNearActivator(post, activator);
            if (composer?.textbox) return composer;
            await delay(250);
        }
        return null;
    }

    async function submitComment(post, textToInsert, imageFile) {
        let composer = findMainComposer(post);

        if (!composer || !composer.textbox) {
            const activator = findCommentActivator(post);
            if (!activator) throw new Error("Không tìm thấy activator comment chính của bài.");

            log(`activator=${normalizeText(activator.innerText).slice(0, 180)}`, 'info');
            activator.scrollIntoView({ behavior: 'smooth', block: 'center' });
            activator.click();
            await delay(800);

            composer = await waitForTextbox(post, activator, 5000);
        }

        if (!composer || !composer.textbox) {
            throw new Error("Không tìm thấy ô nhập bình luận sau khi mở activator.");
        }

        const isReady = await ensureComposerReady(composer.textbox);
        if (!isReady) log("Cảnh báo: Selection state của textbox có thể chưa được React nhận diện hoàn toàn.", 'info');

        // Làm sạch DraftJS content block an toàn
        try {
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(composer.textbox);
            if (selection) {
                selection.removeAllRanges();
                selection.addRange(range);
            }
            document.execCommand('delete', false, null);
        } catch {
            composer.textbox.innerHTML = '';
        }
        await delay(200);

        function insertTextSafe(text) {
            let success = false;
            try {
                success = document.execCommand('insertText', false, text);
            } catch {}
            if (!success) {
                const selection = window.getSelection();
                if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    range.deleteContents();
                    range.insertNode(document.createTextNode(text));
                    range.collapse(false);
                } else {
                    composer.textbox.textContent = (composer.textbox.textContent || '') + text;
                }
            }
            composer.textbox.dispatchEvent(new Event('input', { bubbles: true }));
        }

        if (!enableTypoSim) {
            insertTextSafe(textToInsert);
            await delay(500);
        } else {
            let consecutiveChars = 0;
            for (let i = 0; i < textToInsert.length; i++) {
                insertTextSafe(textToInsert[i]);
                
                let typeDelay = 40 + Math.random() * 80;
                consecutiveChars++;

                // Lỗi Hồi Quy Guard: Mô phỏng chính xác "nhịp thở" của con người khi gõ
                // Thay vì delay đều đặn, AI sẽ khựng lại nghĩ sau dấu câu hoặc gõ 15+ ký tự.
                if (['.', ',', '?', '!', '\n'].includes(textToInsert[i])) {
                    typeDelay += 300 + Math.random() * 600;
                    consecutiveChars = 0;
                } else if (consecutiveChars > 12 && Math.random() > 0.8) {
                    typeDelay += 400 + Math.random() * 500; // Khựng lại
                    consecutiveChars = 0;
                }

                await delay(typeDelay);
            }
            await delay(600 + Math.random() * 500);
        }

        if (imageFile && composer.fileInput) {
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(imageFile);
            composer.fileInput.files = dataTransfer.files;
            composer.fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            log("Đang tải ảnh đính kèm...", 'info');
            await delay(4000); 
        }

        // Chờ nút Đăng xuất hiện / active sau khi input text
        await delay(500);

        log("Xác minh và ấn Đăng...", 'info');
        // Quét lại submit button để lấy trạng thái mới nhất sau khi text đã điền
        let freshSubmit = composer.submit;
        if (!freshSubmit) {
            freshSubmit = [...composer.box.querySelectorAll('div,span,button,div[role="button"]')]
                .find(el => /^(Đăng bình luận|Đăng)$/i.test((el.textContent || '').trim()));
        }
        if (!freshSubmit) {
            freshSubmit = composer.box.querySelector('div[aria-label="Đăng bình luận"], div[aria-label="Đăng"], div[role="button"][tabindex="0"] > svg');
            if (freshSubmit && freshSubmit.tagName === 'svg') {
                freshSubmit = freshSubmit.closest('div[role="button"]');
            }
        }

        if (freshSubmit) {
            freshSubmit.click();
        } else {
            const enterEvent = new KeyboardEvent('keydown', {
                bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13
            });
            composer.textbox.dispatchEvent(enterEvent);
        }
    }

    async function processPostWorkflow(post) {
        const postId = post._cachedSigId;
        if (!postId) throw new Error("Không có postId.");

        if (inFlightPostIds.has(postId) || donePostIds.has(postId)) return;

        inFlightPostIds.add(postId);
        drawDebugOverlay(post, postId);
        await delay(1500);

        try {
            if (enableReadingSim) {
                log("Đang mô phỏng người dùng Đọc bài...", 'info');
                let postText = normalizeText(post.innerText || "");
                // Đọc chậm khoảng 1 giây cho 50 ký tự, giới hạn tối đa 6-8 giây để không bị kẹt luồng.
                let readTime = Math.min((postText.length / 50) * 1000, 6000) + Math.random() * 2000;
                
                window.scrollBy({ top: 30, behavior: 'smooth' });
                await delay(readTime / 2);
                window.scrollBy({ top: -20, behavior: 'smooth' });
                await delay(readTime / 2);
            }

            if (enableLikePost) await tryLikePost(post);
            if (enableLikeComment) await tryLikeComments(post);
            if (enableScrollSim) {
                window.scrollBy({ top: 150, behavior: 'smooth' });
                await delay(1000 + Math.random() * 1000);
                window.scrollBy({ top: -50, behavior: 'smooth' });
            }

            let postText = normalizeText(post.innerText || "");
            let matchedKw = kwList.find(kw => postText.includes(normalizeText(kw)));
            let textToInsert = "";
            
            if (matchedKw && kwCommentsList.length > 0) {
                log(`🎯 Tìm thấy từ khóa "${matchedKw}".`, 'success');
                textToInsert = parseSpintax(kwCommentsList[Math.floor(Math.random() * kwCommentsList.length)]);
            } else {
                let rawComment = useRandomComment ? commentsList[Math.floor(Math.random() * commentsList.length)] : commentsList[currentCommentIdx % commentsList.length];
                if (!useRandomComment) currentCommentIdx++;
                textToInsert = parseSpintax(rawComment);
            }

            // Gửi Comment
            await submitComment(post, textToInsert, selectedImageFile);

            log("Đang chờ xác nhận 2 tầng (Toast / Rendered)...", 'info');
            let confirmedTier1 = false;
            let confirmedTier2 = false;
            const startWait = Date.now();

            while (Date.now() - startWait < 15000) {
                if (!confirmedTier1 && hasSuccessToast()) {
                    log("Tầng 1: Thấy Toast xác nhận gửi (Submitted).", 'success');
                    confirmedTier1 = true;
                }

                if (!confirmedTier2) {
                    if (confirmComment(post, textToInsert)) {
                        log("Tầng 2: Comment đã render trên Feed.", 'success');
                        confirmedTier2 = true;
                    }
                }

                if (confirmedTier2) break;
                await delay(1000);
            }

            if (confirmedTier2) {
                donePostIds.add(postId);
                commentCount++;
                document.getElementById('stat-comments-sent').innerText = commentCount;
                log(`✅ Comment bài viết thành công!`, 'success');
            } else if (confirmedTier1) {
                submittedPostIds.add(postId);
                donePostIds.add(postId);
                commentCount++;
                document.getElementById('stat-comments-sent').innerText = commentCount;
                log(`⚠️ Đã submit thành công qua Toast, nhưng chưa thấy render ngay. Tạm đánh dấu hoàn tất để tránh spam lặp.`, 'info');
            } else {
                throw new Error("Timeout: Không có Toast và không thấy Comment render.");
            }
            
            const rect = post.getBoundingClientRect();
            window.scrollBy({ top: rect.bottom + 100, behavior: 'smooth' });
            
        } catch (err) {
            log(`❌ ${err.message}`, 'error');
            const rect = post.getBoundingClientRect();
            window.scrollBy({ top: rect.bottom, behavior: 'smooth' });
        } finally {
            inFlightPostIds.delete(postId);
            setTimeout(() => { 
                post.classList.remove('fb-autocomment-target'); 
                let dbg = post.querySelector('.bot-debug-label');
                if(dbg) dbg.remove();
            }, 3000);
        }
    }

    async function mainLoop() {
        if (!isRunning) return;

        log("Quét tìm bài mới...", 'info');
        const post = getNextPost();
        
        if (post) {
            await processPostWorkflow(post);
            if (!isRunning) return;

            const currentDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
            let timeRemaining = currentDelay;
            log(`Chờ ${currentDelay}s tiếp tục...`, 'info');
            
            const startBtn = document.getElementById('fb-auto-commenter-start-btn');
            while (timeRemaining > 0 && isRunning) {
                startBtn.innerText = `Đang chạy (${timeRemaining}s)`;
                await delay(1000);
                timeRemaining--;
            }
            
            if (isRunning) {
                startBtn.innerText = "Đang chạy...";
                mainLoop();
            }
        } else {
            log("Chưa thấy bài hợp lệ. Cuộn xuống...", 'info');
            window.scrollBy({ top: 800, behavior: 'smooth' });
            await delay(3500);
            mainLoop();
        }
    }

    // ==========================================
    // UI SETUP
    // ==========================================
    function addCommentField(containerId, value = "") {
        const container = document.getElementById(containerId);
        const item = document.createElement('div');
        item.className = 'comment-item';
        item.innerHTML = `
            <input type="text" class="panel-input comment-val" placeholder="Nhập nội dung cmt..." value="${value}">
            <button class="remove-btn" title="Xóa">✕</button>
        `;
        item.querySelector('.remove-btn').addEventListener('click', () => {
            if (container.querySelectorAll('.comment-item').length > 1) item.remove();
            else item.querySelector('.comment-val').value = '';
        });
        container.appendChild(item);
    }

    function createGUI() {
        const panel = document.createElement('div');
        panel.id = 'fb-auto-commenter-panel';
        
        panel.innerHTML = `
            <div class="panel-icon-toggle">💬</div>
            <div class="panel-header">
                <div class="panel-title"><span class="pulse-dot"></span>FB Auto Interaction Bot</div>
                <div>
                    <button class="theme-toggle-btn" title="Đổi giao diện">🌓</button>
                    <button class="minimize-btn" title="Thu nhỏ">➖</button>
                </div>
            </div>
            <div class="panel-content">
                <div class="panel-field">
                    <label>TÊN TÀI KHOẢN CỦA BẠN (Hoặc ID, Profile URL)</label>
                    <input id="my-account-name-input" type="text" class="panel-input" value="Tài Khoản AI">
                </div>
                <div class="panel-field" style="margin-top: 4px;">
                    <label>DANH SÁCH BÌNH LUẬN (Spintax {A|B})</label>
                    <div id="dynamic-comments-list"></div>
                    <button id="btn-add-comment" class="panel-btn secondary">+ Thêm bình luận</button>
                    <div class="panel-field checkbox-row" style="margin-top: 8px;">
                        <input type="checkbox" id="random-comment-chk" checked>
                        <label for="random-comment-chk" style="color: #1877f2; font-weight:bold;">Đảo ngẫu nhiên</label>
                    </div>
                </div>
                <div class="kw-section">
                    <div class="panel-field">
                        <label>BÌNH LUẬN TỪ KHÓA (Ví dụ: sale, ib)</label>
                        <input id="kw-input" type="text" class="panel-input" placeholder="Cách nhau dấu phẩy">
                    </div>
                    <div class="panel-field">
                        <label>Nội dung cmt đặc biệt</label>
                        <textarea id="kw-comments-input" class="panel-input" placeholder="Tư vấn mình với ạ..."></textarea>
                    </div>
                </div>
                <div class="panel-field" style="margin-top:4px;">
                    <label>Đính kèm ảnh (Tùy chọn)</label>
                    <input type="file" id="image-upload" class="panel-input" accept="image/*" style="padding: 4px;">
                </div>
                <div class="delay-row">
                    <div class="panel-field"><label>Delay Min (s)</label><input id="min-delay-input" type="number" class="panel-input" value="${minDelay}"></div>
                    <div class="panel-field"><label>Delay Max (s)</label><input id="max-delay-input" type="number" class="panel-input" value="${maxDelay}"></div>
                </div>
                <div class="panel-field checkbox-row">
                    <input type="checkbox" id="typo-sim-chk" ${enableTypoSim ? 'checked' : ''}>
                    <label for="typo-sim-chk">Gõ từng chữ (Human Typing)</label>
                </div>
                <div class="panel-field checkbox-row">
                    <input type="checkbox" id="reading-sim-chk" ${enableReadingSim ? 'checked' : ''}>
                    <label for="reading-sim-chk">Mô phỏng Đọc bài & Xem kỹ</label>
                </div>
                <div class="panel-field checkbox-row">
                    <input type="checkbox" id="like-post-chk" ${enableLikePost ? 'checked' : ''}>
                    <label for="like-post-chk">Tự động Thích bài viết</label>
                </div>
                <div class="panel-field checkbox-row">
                    <input type="checkbox" id="like-comment-chk" ${enableLikeComment ? 'checked' : ''}>
                    <label for="like-comment-chk">Like dạo bình luận (Gây chú ý)</label>
                </div>
                <div style="font-size: 12px; color: #b0b3b8; margin-top: 4px;">
                    <span>Đã bình luận: <strong id="stat-comments-sent" style="color: #1877f2;">0</strong></span>
                </div>
                <button id="fb-auto-commenter-start-btn" class="panel-btn">Bắt đầu chạy</button>
                <div class="panel-field"><label>Nhật ký</label><div id="fb-auto-commenter-log" class="log-box"></div></div>
            </div>
        `;

        document.body.appendChild(panel);

        addCommentField('dynamic-comments-list', 'Bài viết hay quá ạ!');
        addCommentField('dynamic-comments-list', 'Quan tâm ạ.');

        document.getElementById('btn-add-comment').addEventListener('click', () => addCommentField('dynamic-comments-list'));

        document.getElementById('image-upload').addEventListener('change', e => {
            selectedImageFile = e.target.files[0] || null;
            if(selectedImageFile) log("Đã nạp ảnh chờ upload.", 'info');
        });

        panel.querySelector('.minimize-btn').addEventListener('click', (e) => { e.stopPropagation(); panel.classList.add('minimized'); });
        panel.querySelector('.panel-icon-toggle').addEventListener('click', () => panel.classList.remove('minimized'));
        panel.querySelector('.theme-toggle-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            panel.classList.toggle('light-theme');
        });

        const startBtn = document.getElementById('fb-auto-commenter-start-btn');
        startBtn.addEventListener('click', () => {
            if (isRunning) {
                isRunning = false;
                startBtn.classList.remove('stop');
                startBtn.innerText = "Bắt đầu chạy";
                log("Đã dừng chương trình.", 'info');
            } else {
                const myAccountVal = document.getElementById('my-account-name-input').value.trim();
                myAccountNames = myAccountVal ? myAccountVal.split(',').map(n => n.trim()).filter(n => n) : ["Tài Khoản AI"];

                const commentInputs = document.getElementById('dynamic-comments-list').querySelectorAll('.comment-val');
                commentsList = Array.from(commentInputs).map(inp => inp.value.trim()).filter(v => v !== '');
                if (commentsList.length === 0) { alert("Cần ít nhất 1 bình luận!"); return; }
                
                useRandomComment = document.getElementById('random-comment-chk').checked;
                currentCommentIdx = 0; 
                
                const kwStr = document.getElementById('kw-input').value.trim();
                kwList = kwStr ? kwStr.toLowerCase().split(',').map(k => k.trim()).filter(k => k) : [];
                kwCommentsList = document.getElementById('kw-comments-input').value.trim().split('\n').filter(l => l.trim());

                minDelay = parseInt(document.getElementById('min-delay-input').value) || 10;
                maxDelay = parseInt(document.getElementById('max-delay-input').value) || 30;
                
                enableLikePost = document.getElementById('like-post-chk').checked;
                enableLikeComment = document.getElementById('like-comment-chk').checked;
                enableTypoSim = document.getElementById('typo-sim-chk').checked;
                enableReadingSim = document.getElementById('reading-sim-chk').checked;

                isRunning = true;
                startBtn.classList.add('stop');
                startBtn.innerText = "Đang chạy...";
                log("Khởi động Bot (V21.1 Ultimate Stable)...", 'success');
                mainLoop();
            }
        });
    }

    setTimeout(createGUI, 2000);
})();
