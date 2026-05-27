document.addEventListener('DOMContentLoaded', async () => {
    // Admin Cryptographic Verification Token (Salted SHA-256 of passphrase: "admin")
    const AUTH_HASH = "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918";
    
    let state = {
        entries: [],
        selectedId: null,
        currentFilter: 'all_systems',
        searchQuery: '',
        isAdmin: false
    };

    try { await window.storageEngine.init(); } catch (e) { console.error("DB Error:", e); }

    const el = {
        questionList: document.getElementById('questionList'),
        searchInput: document.getElementById('searchInput'),
        filterTags: document.getElementById('filterTags'),
        statusText: document.getElementById('statusText'),
        statusDot: document.getElementById('statusDot'),
        
        // Admin Access Control DOM Nodes
        btnAuthToggle: document.getElementById('btnAuthToggle'),
        authOverlay: document.getElementById('authOverlay'),
        authForm: document.getElementById('authForm'),
        authKey: document.getElementById('authKey'),
        authCancel: document.getElementById('authCancel'),
        adminControls: document.getElementById('adminControls'),
        writeControls: document.getElementById('writeControls'),
        
        btnNew: document.getElementById('btnNewEntry'),
        btnEdit: document.getElementById('btnEdit'),
        btnDelete: document.getElementById('btnDelete'),
        btnExport: document.getElementById('btnExport'),
        btnImport: document.getElementById('btnImport'),
        fileImport: document.getElementById('fileImport'),
        
        viewPanel: document.getElementById('viewPanel'),
        formPanel: document.getElementById('formPanel'),
        
        // Expanded View Template Fields
        docId: document.getElementById('docId'),
        docModified: document.getElementById('docModified'),
        docTitle: document.getElementById('docTitle'),
        docTags: document.getElementById('docTags'),
        docContext: document.getElementById('docContext'),
        docTopology: document.getElementById('docTopology'),
        docTradeoffs: document.getElementById('docTradeoffs'),
        docObservability: document.getElementById('docObservability'),
        docDeployment: document.getElementById('docDeployment'),
        docSecurity: document.getElementById('docSecurity'),
        
        // Expanded Management Input Fields
        entryForm: document.getElementById('entryForm'),
        formIsEdit: document.getElementById('formIsEdit'),
        formId: document.getElementById('formId'),
        formTitle: document.getElementById('formTitle'),
        formCategory: document.getElementById('formCategory'),
        formTags: document.getElementById('formTags'),
        formContext: document.getElementById('formContext'),
        formTopology: document.getElementById('formTopology'),
        formTradeoffs: document.getElementById('formTradeoffs'),
        formObservability: document.getElementById('formObservability'),
        formDeployment: document.getElementById('formDeployment'),
        formSecurity: document.getElementById('formSecurity'),
        cancelForm: document.getElementById('cancelForm')
    };

    // Crypto Helper Engine
    const sha256 = async (str) => {
        const buf = new TextEncoder().encode(str);
        const hash = await crypto.subtle.digest('SHA-256', buf);
        return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    };

    // Session Role Security Evaluator
    const evaluateRoleUI = () => {
        if (state.isAdmin) {
            el.btnAuthToggle.textContent = "LOGOUT_ADMIN";
            el.statusDot.classList.remove('locked');
            el.adminControls.classList.remove('hidden');
            el.writeControls.classList.remove('hidden');
        } else {
            el.btnAuthToggle.textContent = "LOGIN_ADMIN";
            el.statusDot.classList.add('locked');
            el.adminControls.classList.add('hidden');
            el.writeControls.classList.add('hidden');
            // If user was viewing form panel, drop back safely to read-only view canvas
            el.formPanel.classList.add('hidden');
            el.viewPanel.classList.remove('hidden');
        }
    };

    // Authentication Handshaking
    el.btnAuthToggle.addEventListener('click', () => {
        if (state.isAdmin) {
            state.isAdmin = false;
            localStorage.removeItem('sys_admin_session');
            evaluateRoleUI();
            updateStatusTelemetry();
        } else {
            el.authOverlay.classList.remove('hidden');
            el.authKey.focus();
        }
    });

    el.authCancel.addEventListener('click', () => el.authOverlay.classList.add('hidden'));

    el.authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const hashedInput = await sha256(el.authKey.value);
        if (hashedInput === AUTH_HASH) {
            state.isAdmin = true;
            localStorage.setItem('sys_admin_session', 'active');
            el.authOverlay.classList.add('hidden');
            el.authKey.value = '';
            evaluateRoleUI();
            updateStatusTelemetry();
        } else {
            alert("ACCESS DENIED: Cryptographic Checksum Mismatch.");
        }
    });

    // Check for existing valid token on boot
    if (localStorage.getItem('sys_admin_session') === 'active') {
        state.isAdmin = true;
    }

    const seedSystemData = async () => {
        const baseline = [{
            id: "SYS-001",
            title: "Globally Distributed Multi-Region Rate Limiter",
            category: "distributed",
            tags: "rate-limiting, redis, anycast",
            context: "Design a sub-millisecond API rate limiter deployed multi-region to safeguard internal cloud infrastructure controls.",
            topology: "[Client Requests] ---> [Anycast Proxy] ---> [Envoy Proxy Node Grid]",
            tradeoffs: "Local atomic loops reduce inter-region networking boundaries but sacrifice systemic consistency quotas.",
            observability: "Track rate_limiter.evaluation.latency_micros (p99.9 target < 850µs). Ensure multi-region synchronization lag alerts trigger above 5000ms thresholds.",
            deployment: "Canary rollout structured via progressive Envoy WASM filter upgrades. Automated fallback loops handle cross-region telemetry pipeline congestion dropouts.",
            security: "Edge layers validate JWT client signatures before processing rate limits. Block malicious clients at upstream cloud firewalls via dynamic IP bans.",
            modified: "2026-05-27"
        }];
        for (const item of baseline) await window.storageEngine.saveEntry(item);
    };

    const syncWorkspaceData = async () => {
        state.entries = await window.storageEngine.getAllEntries();
        if (state.entries.length === 0) {
            await seedSystemData();
            state.entries = await window.storageEngine.getAllEntries();
        }
        updateStatusTelemetry();
        renderSidebarIndex();
    };

    const updateStatusTelemetry = () => {
        const role = state.isAdmin ? "ADMIN" : "GUEST";
        el.statusText.textContent = `SYS_STATUS: ${role} (${state.entries.length}_ENTRIES)`;
    };

    const renderSidebarIndex = () => {
        el.questionList.innerHTML = '';
        const filtered = state.entries.filter(item => {
            const matchesCategory = state.currentFilter === 'all_systems' || item.category === state.currentFilter;
            const matchesSearch = item.title.toLowerCase().includes(state.searchQuery.toLowerCase()) || 
                                  item.id.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
                                  item.tags.toLowerCase().includes(state.searchQuery.toLowerCase());
            return matchesCategory && matchesSearch;
        });

        filtered.forEach(item => {
            const div = document.createElement('div');
            div.className = `question-item ${state.selectedId === item.id ? 'active' : ''}`;
            div.innerHTML = `
                <div class="q-meta"><span>${item.id}</span><span>${item.modified}</span></div>
                <div class="q-title">${item.title}</div>
            `;
            div.onclick = () => selectActiveDocument(item.id);
            el.questionList.appendChild(div);
        });

        if (filtered.length > 0 && !state.selectedId) {
            selectActiveDocument(filtered[0].id);
        } else if (filtered.length === 0) {
            clearDocumentCanvas();
        }
    };

    const selectActiveDocument = (id) => {
        state.selectedId = id;
        const entry = state.entries.find(e => e.id === id);
        if (!entry) return;

        el.formPanel.classList.add('hidden');
        el.viewPanel.classList.remove('hidden');

        el.docId.textContent = entry.id;
        el.docModified.textContent = entry.modified;
        el.docTitle.textContent = entry.title;
        el.docContext.textContent = entry.context;
        
        // Structural Render Mapping
        const mapBlock = (field, domTarget) => {
            if (field && field.trim()) {
                domTarget.textContent = field;
                domTarget.parentElement.classList.remove('hidden');
            } else {
                domTarget.parentElement.classList.add('hidden');
            }
        };

        mapBlock(entry.topology, el.docTopology);
        mapBlock(entry.tradeoffs, el.docTradeoffs);
        mapBlock(entry.observability, el.docObservability);
        mapBlock(entry.deployment, el.docDeployment);
        mapBlock(entry.security, el.docSecurity);

        el.docTags.innerHTML = '';
        entry.tags.split(',').map(t => t.trim()).filter(Boolean).forEach(t => {
            const span = document.createElement('span');
            span.className = 'doc-tag';
            span.textContent = t;
            el.docTags.appendChild(span);
        });
    };

    const clearDocumentCanvas = () => {
        el.docTitle.textContent = "No Entries Documented";
        el.docContext.textContent = "Zero entries meet structural match rules.";
        el.docTags.innerHTML = '';
        el.docTopology.parentElement.classList.add('hidden');
        el.docTradeoffs.parentElement.classList.add('hidden');
        el.docObservability.parentElement.classList.add('hidden');
        el.docDeployment.parentElement.classList.add('hidden');
        el.docSecurity.parentElement.classList.add('hidden');
    };

    // UI Input Routers
    el.searchInput.addEventListener('input', (e) => { state.searchQuery = e.target.value; renderSidebarIndex(); });
    el.filterTags.addEventListener('click', (e) => {
        if (!e.target.classList.contains('tag-pill')) return;
        Array.from(el.filterTags.children).forEach(p => p.classList.remove('active'));
        e.target.classList.add('active');
        state.currentFilter = e.target.getAttribute('data-filter');
        renderSidebarIndex();
    });

    // Guard Form Operations against unauthorized mutation commands
    el.btnNew.addEventListener('click', () => {
        if(!state.isAdmin) return alert("System Fault: Operations unauthorized.");
        el.viewPanel.classList.add('hidden');
        el.formPanel.classList.remove('hidden');
        el.entryForm.reset();
        el.formIsEdit.value = "false";
        el.formId.removeAttribute('readonly');
        el.formId.value = `SYS-${String(state.entries.length + 1).padStart(3, '0')}`;
    });

    el.btnEdit.addEventListener('click', () => {
        if(!state.isAdmin) return alert("System Fault: Operations unauthorized.");
        const entry = state.entries.find(e => e.id === state.selectedId);
        if (!entry) return;

        el.viewPanel.classList.add('hidden');
        el.formPanel.classList.remove('hidden');
        el.formIsEdit.value = "true";
        el.formId.value = entry.id;
        el.formId.setAttribute('readonly', 'true');
        el.formTitle.value = entry.title;
        el.formCategory.value = entry.category;
        el.formTags.value = entry.tags;
        el.formContext.value = entry.context;
        el.formTopology.value = entry.topology;
        el.formTradeoffs.value = entry.tradeoffs;
        el.formObservability.value = entry.observability || '';
        el.formDeployment.value = entry.deployment || '';
        el.formSecurity.value = entry.security || '';
    });

    el.entryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if(!state.isAdmin) return alert("Security Block: Modification command barred.");
        
        const payload = {
            id: el.formId.value.trim().toUpperCase(),
            title: el.formTitle.value.trim(),
            category: el.formCategory.value,
            tags: el.formTags.value.trim(),
            context: el.formContext.value.trim(),
            topology: el.formTopology.value,
            tradeoffs: el.formTradeoffs.value.trim(),
            observability: el.formObservability.value.trim(),
            deployment: el.formDeployment.value.trim(),
            security: el.formSecurity.value.trim(),
            modified: new Date().toISOString().split('T')[0]
        };

        await window.storageEngine.saveEntry(payload);
        state.selectedId = payload.id;
        await syncWorkspaceData();
        selectActiveDocument(payload.id);
    });

    el.cancelForm.addEventListener('click', () => { el.formPanel.classList.add('hidden'); el.viewPanel.classList.remove('hidden'); });

    el.btnDelete.addEventListener('click', async () => {
        if(!state.isAdmin) return alert("Security Block: Modification command barred.");
        if (confirm(`Purge entry ${state.selectedId}?`)) {
            await window.storageEngine.deleteEntry(state.selectedId);
            state.selectedId = null;
            await syncWorkspaceData();
        }
    });

    el.btnExport.addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.entries, null, 2));
        const dl = document.createElement('a');
        dl.setAttribute("href", dataStr);
        dl.setAttribute("download", `systempro_backup_${new Date().toISOString().split('T')[0]}.json`);
        dl.click();
    });

    el.btnImport.addEventListener('click', () => {
        if(!state.isAdmin) return alert("Admin permissions required to alter data maps via imports.");
        el.fileImport.click();
    });
    
    el.fileImport.addEventListener('change', (e) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const parsed = JSON.parse(event.target.result);
                if (Array.isArray(parsed)) {
                    for (const item of parsed) if (item.id) await window.storageEngine.saveEntry(item);
                    await syncWorkspaceData();
                }
            } catch (err) { alert("Data structural trace initialization fault."); }
        };
        if (e.target.files[0]) reader.readAsText(e.target.files[0]);
    });

    evaluateRoleUI();
    await syncWorkspaceData();
});
