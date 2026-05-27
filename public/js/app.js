document.addEventListener('DOMContentLoaded', async () => {
    // Core Engine Handshake
    try {
        await window.storageEngine.init();
    } catch (e) {
        console.error("Storage driver initialization crash:", e);
    }

    // Application Memory Space
    let state = {
        entries: [],
        selectedId: null,
        currentFilter: 'all_systems',
        searchQuery: ''
    };

    // DOM Bindings
    const el = {
        questionList: document.getElementById('questionList'),
        searchInput: document.getElementById('searchInput'),
        filterTags: document.getElementById('filterTags'),
        btnNew: document.getElementById('btnNewEntry'),
        btnEdit: document.getElementById('btnEdit'),
        btnDelete: document.getElementById('btnDelete'),
        btnExport: document.getElementById('btnExport'),
        btnImport: document.getElementById('btnImport'),
        fileImport: document.getElementById('fileImport'),
        statusText: document.getElementById('statusText'),
        
        viewPanel: document.getElementById('viewPanel'),
        formPanel: document.getElementById('formPanel'),
        
        docId: document.getElementById('docId'),
        docModified: document.getElementById('docModified'),
        docTitle: document.getElementById('docTitle'),
        docTags: document.getElementById('docTags'),
        docContext: document.getElementById('docContext'),
        docTopology: document.getElementById('docTopology'),
        docTradeoffs: document.getElementById('docTradeoffs'),
        
        entryForm: document.getElementById('entryForm'),
        formIsEdit: document.getElementById('formIsEdit'),
        formId: document.getElementById('formId'),
        formTitle: document.getElementById('formTitle'),
        formCategory: document.getElementById('formCategory'),
        formTags: document.getElementById('formTags'),
        formContext: document.getElementById('formContext'),
        formTopology: document.getElementById('formTopology'),
        formTradeoffs: document.getElementById('formTradeoffs'),
        cancelForm: document.getElementById('cancelForm')
    };

    // Seed Data Factory (Executes if workspace engine is unpopulated)
    const seedSystemData = async () => {
        const baseline = [
            {
                id: "SYS-001",
                title: "Globally Distributed Multi-Region Rate Limiter",
                category: "distributed",
                tags: "rate-limiting, redis, anycast",
                context: "Design a sub-millisecond API rate limiter deployed multi-region to safeguard internal cloud infrastructure controls. Must degrade gracefully to localized instances during WAN split-brain scenarios.",
                topology: "[Client Requests] ---> [Anycast Proxy]\n                      |\n         +------------+------------+\n         | (US-EAST)               | (EU-CENTRAL)\n         v                         v\n   [Envoy Proxy]             [Envoy Proxy]\n   [Local Redis Cluster]     [Local Redis Cluster]\n         \\                         /\n          +---> [Async WAN Sync] <---+",
                tradeoffs: "Local Redis caching limits cross-region synchronization delay overhead but risks minor window slippage during sudden baseline spikes.",
                modified: "2026-05-27"
            },
            {
                id: "SYS-002",
                title: "High-Throughput Log Aggregation Engine",
                category: "telemetry",
                tags: "kafka, sre, storage",
                context: "Architect a resilient log stream collection tier capable of sustained ingest scaling up to 10M events/sec. Must handle network partitions cleanly without impacting upstream application layer computing allocations.",
                topology: "[Edge Daemons] ---> [Local Disk Ring Buffer] ---> [Kafka Message Broker]\n                                                            |\n                                                            v\n                                                   [ClickHouse DB Cluster]",
                tradeoffs: "Disk backpressuring prevents systemic out-of-memory errors but introduces ingestion verification delay metrics.",
                modified: "2026-05-27"
            }
        ];
        for (const item of baseline) {
            await window.storageEngine.saveEntry(item);
        }
    };

    // Core Business Logic Orchestration
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
        el.statusText.textContent = `SYS_STATUS: ONLINE (${state.entries.length}_ENTRIES)`;
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

        // Toggle Workspace View states
        el.formPanel.classList.add('hidden');
        el.viewPanel.classList.remove('hidden');

        // Bind Template Parameters
        el.docId.textContent = entry.id;
        el.docModified.textContent = entry.modified;
        el.docTitle.textContent = entry.title;
        el.docContext.textContent = entry.context;
        
        // Render optional block elements cleanly
        if (entry.topology.trim()) {
            el.docTopology.textContent = entry.topology;
            el.docTopology.parentElement.classList.remove('hidden');
        } else {
            el.docTopology.parentElement.classList.add('hidden');
        }
        
        if (entry.tradeoffs.trim()) {
            el.docTradeoffs.textContent = entry.tradeoffs;
            el.docTradeoffs.parentElement.classList.remove('hidden');
        } else {
            el.docTradeoffs.parentElement.classList.add('hidden');
        }

        // Render Tag Layout
        el.docTags.innerHTML = '';
        entry.tags.split(',').map(t => t.trim()).filter(Boolean).forEach(t => {
            const span = document.createElement('span');
            span.className = 'doc-tag';
            span.textContent = t;
            el.docTags.appendChild(span);
        });

        // Re-highlight list execution state
        Array.from(el.questionList.children).forEach(child => {
            const isTarget = child.querySelector('.q-meta span').textContent === id;
            child.classList.toggle('active', isTarget);
        });
    };

    const clearDocumentCanvas = () => {
        el.docTitle.textContent = "No Entries Documented";
        el.docContext.textContent = "Use the + NEW_ENTRY action utility to register structured infrastructure interview architectural paths.";
        el.docTags.innerHTML = '';
        el.docTopology.parentElement.classList.add('hidden');
        el.docTradeoffs.parentElement.classList.add('hidden');
    };

    // UI Event Handlers
    el.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        renderSidebarIndex();
    });

    el.filterTags.addEventListener('click', (e) => {
        if (!e.target.classList.contains('tag-pill')) return;
        Array.from(el.filterTags.children).forEach(pill => pill.classList.remove('active'));
        e.target.classList.add('active');
        state.currentFilter = e.target.getAttribute('data-filter');
        renderSidebarIndex();
    });

    el.btnNew.addEventListener('click', () => {
        el.viewPanel.classList.add('hidden');
        el.formPanel.classList.remove('hidden');
        el.entryForm.reset();
        el.formIsEdit.value = "false";
        el.formId.removeAttribute('readonly');
        
        // Auto-increment simple system IDs
        const nextNum = String(state.entries.length + 1).padStart(3, '0');
        el.formId.value = `SYS-${nextNum}`;
    });

    el.btnEdit.addEventListener('click', () => {
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
    });

    el.entryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            id: el.formId.value.trim().toUpperCase(),
            title: el.formTitle.value.trim(),
            category: el.formCategory.value,
            tags: el.formTags.value.trim(),
            context: el.formContext.value.trim(),
            topology: el.formTopology.value,
            tradeoffs: el.formTradeoffs.value.trim(),
            modified: new Date().toISOString().split('T')[0]
        };

        if (!payload.id || !payload.title) return alert("System Execution Fault: ID and Title parameters are required.");

        await window.storageEngine.saveEntry(payload);
        state.selectedId = payload.id;
        await syncWorkspaceData();
        selectActiveDocument(payload.id);
    });

    el.cancelForm.addEventListener('click', () => {
        el.formPanel.classList.add('hidden');
        el.viewPanel.classList.remove('hidden');
    });

    el.btnDelete.addEventListener('click', async () => {
        if (!state.selectedId) return;
        if (confirm(`Destructive Operational Command: Purge documentation system entry ${state.selectedId}?`)) {
            await window.storageEngine.deleteEntry(state.selectedId);
            state.selectedId = null;
            await syncWorkspaceData();
        }
    });

    // Backup & Migration Infrastructure Controls
    el.btnExport.addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.entries, null, 2));
        const dlAnchor = document.createElement('a');
        dlAnchor.setAttribute("href", dataStr);
        dlAnchor.setAttribute("download", `systempro_dump_${new Date().toISOString().split('T')[0]}.json`);
        dlAnchor.click();
    });

    el.btnImport.addEventListener('click', () => el.fileImport.click());
    el.fileImport.addEventListener('change', (e) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const parsed = JSON.parse(event.target.result);
                if (Array.isArray(parsed)) {
                    for (const item of parsed) {
                        if (item.id) await window.storageEngine.saveEntry(item);
                    }
                    await syncWorkspaceData();
                    alert("Migration Engine Sync: Global definitions state imported successfully.");
                }
            } catch (err) {
                alert("Runtime Data Exception: Invalid configuration schema layout payload structural tree.");
            }
        };
        if (e.target.files[0]) reader.readAsText(e.target.files[0]);
    });

    // Bootstrapping System State
    await syncWorkspaceData();
});
