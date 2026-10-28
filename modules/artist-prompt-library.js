(() => {
    "use strict";

    const DB_NAME = "pta_artist_prompt_library";
    const STORE_NAME = "prompts";
    let dialog = null;
    let dbPromise = null;
    let prompts = [];
    let query = "";
    let editingId = null;

    const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);

    function openDB() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
                    store.createIndex("updatedAt", "updatedAt");
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        return dbPromise;
    }

    async function getAll() {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    async function put(item) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(item);
            request.onsuccess = () => resolve(item);
            request.onerror = () => reject(request.error);
        });
    }

    async function remove(id) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(id);
            request.onsuccess = resolve;
            request.onerror = () => reject(request.error);
        });
    }

    function ensureDialog() {
        if (dialog && dialog.isConnected) return;
        const style = document.createElement("style");
        style.id = "pta-artist-library-style";
        style.textContent = `
            #pta-artist-library { width:min(920px,96vw); height:min(92vh,900px); max-width:none; max-height:none; padding:0; border:1px solid var(--SmartThemeBorderColor, #777); border-radius:14px; color:var(--SmartThemeBodyColor,#eee); background:var(--SmartThemeBlurTintColor,#202126); box-shadow:0 18px 60px #0005; overflow:hidden; }
            #pta-artist-library::backdrop { background:#0008; backdrop-filter:blur(3px); }
            #pta-artist-library * { box-sizing:border-box; }
            #pta-artist-library .pal-shell { height:100%; display:flex; flex-direction:column; min-height:0; }
            #pta-artist-library .pal-head { display:flex; align-items:center; gap:10px; padding:13px 16px; border-bottom:1px solid var(--SmartThemeBorderColor,#777); }
            #pta-artist-library .pal-head strong { flex:1; font-size:1.05rem; }
            #pta-artist-library button { color:inherit; cursor:pointer; border:1px solid var(--SmartThemeBorderColor,#777); background:transparent; border-radius:8px; padding:7px 10px; }
            #pta-artist-library button:hover { background:var(--SmartThemeQuoteColor,#7772); }
            #pta-artist-library input, #pta-artist-library textarea { width:100%; color:inherit; background:var(--SmartThemeBlurTintColor, #202126); border:1px solid var(--SmartThemeBorderColor,#777); border-radius:8px; padding:9px 10px; }
            #pta-artist-library textarea { min-height:92px; resize:vertical; }
            #pta-artist-library .pal-toolbar { display:flex; gap:8px; padding:12px 14px; border-bottom:1px solid var(--SmartThemeBorderColor,#777); }
            #pta-artist-library .pal-toolbar input { flex:1; min-width:0; }
            #pta-artist-library .pal-body { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:14px; padding:14px; overflow:auto; flex:1; min-height:0; }
            #pta-artist-library .pal-list { display:flex; flex-direction:column; gap:8px; min-width:0; }
            #pta-artist-library .pal-card { border:1px solid var(--SmartThemeBorderColor,#777); border-radius:10px; padding:10px; min-width:0; }
            #pta-artist-library .pal-card-title { font-weight:700; overflow-wrap:anywhere; margin-bottom:5px; }
            #pta-artist-library .pal-tags { font-size:.8em; opacity:.75; margin:4px 0 8px; overflow-wrap:anywhere; }
            #pta-artist-library .pal-preview { white-space:pre-wrap; overflow-wrap:anywhere; max-height:100px; overflow:hidden; opacity:.85; font-size:.9em; }
            #pta-artist-library .pal-actions { display:flex; flex-wrap:wrap; gap:6px; margin-top:9px; }
            #pta-artist-library .pal-editor { display:flex; flex-direction:column; gap:9px; min-width:0; }
            #pta-artist-library .pal-label { display:flex; flex-direction:column; gap:5px; font-size:.9em; }
            #pta-artist-library .pal-empty { opacity:.7; text-align:center; padding:24px 10px; }
            #pta-artist-library .pal-status { padding:0 14px 12px; font-size:.85em; opacity:.75; }
            @media(max-width:640px) { #pta-artist-library { width:96vw; height:94vh; border-radius:12px; } #pta-artist-library .pal-body { grid-template-columns:1fr; } #pta-artist-library .pal-editor { order:-1; } #pta-artist-library .pal-toolbar { flex-wrap:wrap; } }
        `;
        document.head.appendChild(style);

        dialog = document.createElement("dialog");
        dialog.id = "pta-artist-library";
        dialog.innerHTML = `
            <div class="pal-shell">
                <div class="pal-head"><strong>畫師串儲存庫</strong><button type="button" data-pal="export">匯出</button><button type="button" data-pal="import">匯入</button><button type="button" data-pal="close" aria-label="關閉">×</button></div>
                <div class="pal-toolbar"><input type="search" data-pal="search" placeholder="搜尋名稱、提示詞或標籤…"><button type="button" data-pal="new">新增畫師串</button></div>
                <div class="pal-body">
                    <section class="pal-list" data-pal="list"></section>
                    <form class="pal-editor" data-pal="form">
                        <strong data-pal="form-title">新增畫師串</strong>
                        <label class="pal-label">名稱<input data-pal="name" maxlength="120" placeholder="例如：柔和逆光"></label>
                        <label class="pal-label">標籤<input data-pal="tags" placeholder="以逗號分隔，例如：光影,氛圍,NAI"></label>
                        <label class="pal-label">正面提示詞<textarea data-pal="positive" placeholder="輸入正面提示詞…"></textarea></label>
                        <label class="pal-label">負面提示詞<textarea data-pal="negative" placeholder="輸入負面提示詞…"></textarea></label>
                        <label class="pal-label">備註<textarea data-pal="note" placeholder="模型、使用情境或其他備註（選填）"></textarea></label>
                        <div class="pal-actions"><button type="submit">儲存</button><button type="button" data-pal="cancel">清空表單</button></div>
                        <div class="pal-status" data-pal="status" role="status"></div>
                    </form>
                </div>
            </div>
            <input type="file" data-pal="file" accept="application/json,.json" hidden>
        `;
        document.body.appendChild(dialog);

        dialog.addEventListener("click", async (event) => {
            const button = event.target.closest("[data-pal]");
            if (!button) return;
            const action = button.dataset.pal;
            if (action === "close") dialog.close();
            if (action === "new" || action === "cancel") resetForm();
            if (action === "export") exportData();
            if (action === "import") dialog.querySelector('[data-pal="file"]').click();
            const card = event.target.closest("[data-prompt-id]");
            if (card && action === "edit") loadForm(card.dataset.promptId);
            if (card && action === "copy-pos") copyText((prompts.find(p => p.id === card.dataset.promptId) || {}).positive || "");
            if (card && action === "copy-neg") copyText((prompts.find(p => p.id === card.dataset.promptId) || {}).negative || "");
            if (card && action === "delete") {
                const item = prompts.find(p => p.id === card.dataset.promptId);
                if (item && confirm(`確定刪除「${item.name || "未命名"}」？`)) {
                    await remove(item.id);
                    prompts = prompts.filter(p => p.id !== item.id);
                    if (editingId === item.id) resetForm();
                    renderList();
                    setStatus("已刪除。");
                }
            }
        });

        dialog.querySelector('[data-pal="search"]').addEventListener("input", (event) => {
            query = event.target.value.trim().toLocaleLowerCase();
            renderList();
        });
        dialog.querySelector('[data-pal="form"]').addEventListener("submit", async (event) => {
            event.preventDefault();
            const name = dialog.querySelector('[data-pal="name"]').value.trim();
            const positive = dialog.querySelector('[data-pal="positive"]').value.trim();
            if (!name && !positive) return setStatus("至少填寫名稱或正面提示詞。");
            const old = prompts.find(p => p.id === editingId);
            const item = {
                id: editingId || `pal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`,
                name: name || "未命名畫師串",
                tags: dialog.querySelector('[data-pal="tags"]').value.split(/[,，、]/).map(s => s.trim()).filter(Boolean),
                positive,
                negative: dialog.querySelector('[data-pal="negative"]').value.trim(),
                note: dialog.querySelector('[data-pal="note"]').value.trim(),
                createdAt: old?.createdAt || Date.now(),
                updatedAt: Date.now()
            };
            await put(item);
            prompts = await getAll();
            resetForm();
            renderList();
            setStatus("已儲存，資料保存在這台裝置的瀏覽器資料庫中。");
        });
        dialog.querySelector('[data-pal="file"]').addEventListener("change", importData);
    }

    function setStatus(message) {
        const status = dialog?.querySelector('[data-pal="status"]');
        if (status) status.textContent = message;
    }

    function resetForm() {
        editingId = null;
        const form = dialog.querySelector('[data-pal="form"]');
        form.reset();
        dialog.querySelector('[data-pal="form-title"]').textContent = "新增畫師串";
        setStatus("");
    }

    function loadForm(id) {
        const item = prompts.find(p => p.id === id);
        if (!item) return;
        editingId = id;
        dialog.querySelector('[data-pal="form-title"]').textContent = "編輯畫師串";
        dialog.querySelector('[data-pal="name"]').value = item.name || "";
        dialog.querySelector('[data-pal="tags"]').value = (item.tags || []).join(", ");
        dialog.querySelector('[data-pal="positive"]').value = item.positive || "";
        dialog.querySelector('[data-pal="negative"]').value = item.negative || "";
        dialog.querySelector('[data-pal="note"]').value = item.note || "";
        setStatus("編輯中");
    }

    function renderList() {
        const list = dialog.querySelector('[data-pal="list"]');
        const visible = prompts.filter(item => {
            const haystack = [item.name, item.positive, item.negative, item.note, ...(item.tags || [])].join(" ").toLocaleLowerCase();
            return haystack.includes(query);
        }).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        if (!visible.length) {
            list.innerHTML = '<div class="pal-empty">還沒有符合條件的畫師串。<br>可以從右側表單新增，或匯入 JSON 備份。</div>';
            return;
        }
        list.innerHTML = visible.map(item => `
            <article class="pal-card" data-prompt-id="${escapeHTML(item.id)}">
                <div class="pal-card-title">${escapeHTML(item.name || "未命名畫師串")}</div>
                <div class="pal-tags">${escapeHTML((item.tags || []).join(" · "))}</div>
                <div class="pal-preview">${escapeHTML(item.positive || "（沒有正面提示詞）")}</div>
                <div class="pal-actions">
                    <button type="button" data-pal="copy-pos">複製正面</button>
                    <button type="button" data-pal="copy-neg">複製負面</button>
                    <button type="button" data-pal="edit">編輯</button>
                    <button type="button" data-pal="delete">刪除</button>
                </div>
            </article>
        `).join("");
    }

    async function copyText(text) {
        if (!text) return setStatus("這個欄位目前是空的。");
        try {
            await navigator.clipboard.writeText(text);
            setStatus("已複製到剪貼簿。");
        } catch {
            const area = document.createElement("textarea");
            area.value = text;
            dialog.appendChild(area);
            area.select();
            const ok = document.execCommand("copy");
            area.remove();
            setStatus(ok ? "已複製到剪貼簿。" : "複製失敗，請手動選取文字。");
        }
    }

    function exportData() {
        const blob = new Blob([JSON.stringify({ format: "pta-artist-library", version: 1, prompts }, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "畫師串儲存庫-backup.json";
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setStatus("已匯出 JSON 備份。");
    }

    async function importData(event) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        try {
            const parsed = JSON.parse(await file.text());
            const incoming = Array.isArray(parsed) ? parsed : parsed.prompts;
            if (!Array.isArray(incoming)) throw new Error("找不到畫師串資料陣列。");
            let added = 0;
            for (const raw of incoming) {
                if (!raw || typeof raw !== "object") continue;
                const item = {
                    id: typeof raw.id === "string" && !prompts.some(p => p.id === raw.id) ? raw.id : `pal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`,
                    name: String(raw.name || "未命名畫師串"),
                    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
                    positive: String(raw.positive ?? raw.pos ?? ""),
                    negative: String(raw.negative ?? raw.neg ?? ""),
                    note: String(raw.note || ""),
                    createdAt: Number(raw.createdAt) || Date.now(),
                    updatedAt: Date.now()
                };
                await put(item);
                prompts.push(item);
                added++;
            }
            prompts = await getAll();
            renderList();
            setStatus(`匯入完成：新增 ${added} 筆。`);
        } catch (error) {
            setStatus("匯入失敗：" + error.message);
        }
    }

    async function launch() {
        ensureDialog();
        try {
            prompts = await getAll();
            renderList();
            if (!dialog.open) dialog.showModal();
        } catch (error) {
            alert("畫師串儲存庫初始化失敗：" + error.message);
        }
    }

    window.PTAOpenArtistLibrary = launch;
})();