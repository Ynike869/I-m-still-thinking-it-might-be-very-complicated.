(() => {
    "use strict";

    const STORAGE_KEY = "personal_tavern_assistant_v1";
    const DEFAULTS = {
        feature1Enabled: true,
        floatingBallEnabled: false,
        floatingBallPosition: null,
    };

    let settings = loadSettings();
    let panel = null;
    let floatingBall = null;

    function loadSettings() {
        try {
            return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
        } catch (error) {
            console.warn("[個人酒館助手] 無法讀取設定，改用預設值。", error);
            return { ...DEFAULTS };
        }
    }

    function saveSettings() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }

    function createButton(label, className, onClick) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = className;
        if (label === "🧩") {
            button.innerHTML = '<i class="fa-solid fa-puzzle-piece" aria-hidden="true"></i>';
        } else {
            button.textContent = label;
        }
        button.addEventListener("click", onClick);
        return button;
    }

    function openAssistant() {
        try {
            if (!panel || !document.body.contains(panel)) createPanel();
            panel.classList.add("pta-open");
            panel.style.display = "flex";
            panel.style.visibility = "visible";
            panel.style.opacity = "1";
            panel.style.zIndex = "2147483000";
            panel.setAttribute("aria-hidden", "false");
            showHome();
        } catch (error) {
            console.error("[個人酒館助手] 開啟主介面失敗：", error);
            alert("個人酒館助手開啟失敗，請打開瀏覽器主控台查看錯誤。");
        }
    }

    function closeAssistant() {
        if (!panel) return;
        panel.classList.remove("pta-open");
        panel.style.display = "none";
        panel.setAttribute("aria-hidden", "true");
    }

    function createPanel() {
        panel = document.createElement("section");
        panel.id = "pta-panel";
        panel.className = "pta-panel";
        panel.setAttribute("role", "dialog");
        panel.setAttribute("aria-modal", "true");
        panel.setAttribute("aria-label", "個人酒館助手");
        panel.setAttribute("aria-hidden", "true");

        const header = document.createElement("header");
        header.className = "pta-header";

        const title = document.createElement("strong");
        title.className = "pta-title";
        title.textContent = "個人酒館助手";

        const actions = document.createElement("div");
        actions.className = "pta-header-actions";
        const settingsButton = createButton("設定", "pta-text-button", showSettings);
        const minimizeButton = createButton("－", "pta-icon-button", closeAssistant);
        minimizeButton.setAttribute("aria-label", "最小化");
        const closeButton = createButton("×", "pta-icon-button", closeAssistant);
        closeButton.setAttribute("aria-label", "關閉");

        actions.append(settingsButton, minimizeButton, closeButton);
        header.append(title, actions);

        const content = document.createElement("main");
        content.className = "pta-content";

        const featureButton = createButton("功能 1", "pta-feature-button", openFeature1);
        featureButton.id = "pta-feature-1";
        content.appendChild(featureButton);

        const settingsView = document.createElement("div");
        settingsView.className = "pta-settings-view";
        settingsView.hidden = true;

        const settingsTitle = document.createElement("h3");
        settingsTitle.textContent = "設定";

        const featureRow = createToggleRow("功能 1", "feature1Enabled", "控制主頁面是否顯示此功能。");
        const ballRow = createToggleRow("懸浮球", "floatingBallEnabled", "開啟後可拖曳懸浮球，位置會自動記住。");

        const backButton = createButton("返回主頁", "pta-secondary-button", showHome);
        settingsView.append(settingsTitle, featureRow, ballRow, backButton);

        const featureView = document.createElement("div");
        featureView.className = "pta-feature-view";
        featureView.hidden = true;
        const featureTitle = document.createElement("h3");
        featureTitle.textContent = "功能 1";
        const placeholder = document.createElement("p");
        placeholder.className = "pta-placeholder";
        placeholder.textContent = "待製作";
        const featureBack = createButton("返回主頁", "pta-secondary-button", showHome);
        featureView.append(featureTitle, placeholder, featureBack);

        panel.append(header, content, settingsView, featureView);
        document.body.appendChild(panel);

        panel.addEventListener("click", (event) => {
            if (event.target === panel) closeAssistant();
        });

        panel._ptaContent = content;
        panel._ptaSettingsView = settingsView;
        panel._ptaFeatureView = featureView;
        panel._ptaFeatureButton = featureButton;

        refreshFeatureVisibility();
    }

    function createToggleRow(label, key, description) {
        const row = document.createElement("label");
        row.className = "pta-setting-row";

        const copy = document.createElement("span");
        copy.className = "pta-setting-copy";
        const name = document.createElement("strong");
        name.textContent = label;
        const detail = document.createElement("small");
        detail.textContent = description;
        copy.append(name, detail);

        const toggle = document.createElement("input");
        toggle.type = "checkbox";
        toggle.className = "pta-switch";
        toggle.checked = Boolean(settings[key]);
        toggle.setAttribute("aria-label", label);
        toggle.addEventListener("change", () => {
            settings[key] = toggle.checked;
            saveSettings();
            if (key === "feature1Enabled") refreshFeatureVisibility();
            if (key === "floatingBallEnabled") updateFloatingBall();
        });

        row.append(copy, toggle);
        return row;
    }

    function showHome() {
        if (!panel) return;
        panel._ptaContent.hidden = false;
        panel._ptaSettingsView.hidden = true;
        panel._ptaFeatureView.hidden = true;
    }

    function showSettings() {
        if (!panel) return;
        panel._ptaContent.hidden = true;
        panel._ptaSettingsView.hidden = false;
        panel._ptaFeatureView.hidden = true;
    }

    function openFeature1() {
        if (!settings.feature1Enabled) return;
        panel._ptaContent.hidden = true;
        panel._ptaSettingsView.hidden = true;
        panel._ptaFeatureView.hidden = false;
    }

    function refreshFeatureVisibility() {
        if (!panel) return;
        panel._ptaFeatureButton.hidden = !settings.feature1Enabled;
        if (!settings.feature1Enabled && !panel._ptaFeatureView.hidden) showHome();
    }

    function createFloatingBall() {
        if (floatingBall) return;
        floatingBall = createButton("🧩", "pta-floating-ball", openAssistant);
        floatingBall.setAttribute("aria-label", "打開個人酒館助手");
        floatingBall.title = "個人酒館助手";

        const saved = settings.floatingBallPosition;
        if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
            floatingBall.style.left = saved.left + "px";
            floatingBall.style.top = saved.top + "px";
            floatingBall.style.right = "auto";
            floatingBall.style.bottom = "auto";
        }

        let dragging = false;
        let moved = false;
        let startX = 0;
        let startY = 0;
        let startLeft = 0;
        let startTop = 0;

        floatingBall.addEventListener("pointerdown", (event) => {
            dragging = true;
            moved = false;
            const rect = floatingBall.getBoundingClientRect();
            startX = event.clientX;
            startY = event.clientY;
            startLeft = rect.left;
            startTop = rect.top;
            floatingBall.setPointerCapture(event.pointerId);
        });

        floatingBall.addEventListener("pointermove", (event) => {
            if (!dragging) return;
            const dx = event.clientX - startX;
            const dy = event.clientY - startY;
            if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
            if (!moved) return;

            const left = Math.max(0, Math.min(window.innerWidth - floatingBall.offsetWidth, startLeft + dx));
            const top = Math.max(0, Math.min(window.innerHeight - floatingBall.offsetHeight, startTop + dy));
            floatingBall.style.left = left + "px";
            floatingBall.style.top = top + "px";
            floatingBall.style.right = "auto";
            floatingBall.style.bottom = "auto";
        });

        floatingBall.addEventListener("pointerup", () => {
            if (!dragging) return;
            dragging = false;
            if (moved) {
                const rect = floatingBall.getBoundingClientRect();
                settings.floatingBallPosition = { left: rect.left, top: rect.top };
                saveSettings();
            }
        });

        floatingBall.addEventListener("click", (event) => {
            if (moved) {
                event.preventDefault();
                event.stopPropagation();
                moved = false;
            }
        });

        document.body.appendChild(floatingBall);
    }

    function updateFloatingBall() {
        if (settings.floatingBallEnabled) {
            createFloatingBall();
            floatingBall.hidden = false;
        } else if (floatingBall) {
            floatingBall.hidden = true;
        }
    }

    function addEntryButtons() {
        const sendForm = document.querySelector("#send_form");
        if (sendForm && !document.querySelector("#pta-chat-entry")) {
            const button = createButton("🧩", "pta-chat-entry menu_button", openAssistant);
            button.id = "pta-chat-entry";
            button.title = "個人酒館助手";
            button.setAttribute("aria-label", "打開個人酒館助手");
            button.style.width = "38px";
            button.style.minWidth = "38px";
            button.style.height = "38px";
            button.style.display = "inline-flex";
            button.style.alignItems = "center";
            button.style.justifyContent = "center";
            button.style.padding = "0";
            button.style.borderRadius = "50%";
            button.style.fontSize = "16px";
            const sendButton = sendForm.querySelector("#send_but");
            if (sendButton && sendButton.parentElement) {
                sendButton.parentElement.insertBefore(button, sendButton);
            } else {
                sendForm.appendChild(button);
            }
        }

        const extensionsSettings = document.querySelector("#extensions_settings2, #extensions_settings");
        if (extensionsSettings && !document.querySelector("#pta-extension-entry")) {
            const button = createButton("打開個人酒館助手", "menu_button", openAssistant);
            button.id = "pta-extension-entry";
            extensionsSettings.appendChild(button);
        }
    }

    document.addEventListener("click", function (event) {
        const entry = event.target && event.target.closest
            ? event.target.closest("#pta-chat-entry, #pta-extension-entry, .pta-floating-ball")
            : null;
        if (!entry) return;
        event.preventDefault();
        event.stopPropagation();
        openAssistant();
    }, true);

    function init() {
        alert("[個人酒館助手] 程式已載入。");
        console.info("[個人酒館助手] init");
        addEntryButtons();
        updateFloatingBall();

        const observer = new MutationObserver(() => {
            addEntryButtons();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
