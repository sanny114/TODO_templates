/**
 * LocalStorageManager
 * Manages data persistence and logic for Templates and Todo Groups.
 */
class LocalStorageManager {
    constructor() {
        this.STORAGE_KEY = 'todo_app_v2';
        this.data = this._loadData();
    }

    _loadData() {
        const json = localStorage.getItem(this.STORAGE_KEY);
        if (json) {
            try {
                const data = JSON.parse(json);
                if (!data.templates) data.templates = [];
                if (!data.groups) data.groups = [];
                return data;
            } catch (e) {
                console.error('Failed to parse localStorage data:', e);
                return this._getDefaultData();
            }
        }
        return this._getDefaultData();
    }

    _getDefaultData() {
        return {
            templates: [],
            groups: []
        };
    }

    _saveData() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
    }

    _generateId() {
        return crypto.randomUUID();
    }

    _touch(obj, isNew = false) {
        const now = Date.now();
        if (isNew) {
            obj.createdAt = now;
        }
        obj.updatedAt = now;
    }

    getTemplates() {
        return this.data.templates;
    }

    // --- Template Methods ---

    createTemplate(title, sectionsData) {
        // sectionsData: [{title: "Section Title", items: ["Item1", "Item2"]}]
        const sections = sectionsData.map(sec => ({
            id: this._generateId(),
            title: sec.title,
            items: sec.items.map(text => ({ text }))
        }));

        const newTemplate = {
            id: this._generateId(),
            title: title,
            sections: sections
        };
        this._touch(newTemplate, true);
        this.data.templates.push(newTemplate);
        this._saveData();
        return newTemplate;
    }

    updateTemplate(id, title, sectionsData) {
        const template = this.data.templates.find(t => t.id === id);
        if (!template) return null;

        if (title !== undefined) template.title = title;
        if (sectionsData !== undefined) {
            template.sections = sectionsData.map(sec => ({
                id: this._generateId(), // Always regenerate IDs on full update for simplicity or keep if sophisticated
                title: sec.title,
                items: sec.items.map(text => ({ text }))
            }));
        }

        this._touch(template);
        this._saveData();
        return template;
    }

    deleteTemplate(id) {
        this.data.templates = this.data.templates.filter(t => t.id !== id);
        this._saveData();
    }

    duplicateTemplate(templateId) {
        const template = this.data.templates.find(t => t.id === templateId);
        if (!template) return null;

        // Deep copy sections and items
        const sectionsData = (template.sections || []).map(sec => ({
            title: sec.title,
            items: sec.items.map(i => i.text)
        }));

        // Handle legacy items if any
        if ((!template.sections || template.sections.length === 0) && template.items) {
            sectionsData.push({
                title: '一般',
                items: template.items.map(i => i.text)
            });
        }

        return this.createTemplate(template.title + ' のコピー', sectionsData);
    }

    getGroups(statusFilter = 'all') {
        if (statusFilter === 'all') return this.data.groups;
        return this.data.groups.filter(g => g.status === statusFilter);
    }

    createGroupFromTemplate(templateId) {
        const template = this.data.templates.find(t => t.id === templateId);
        if (!template) {
            console.error('Template not found');
            return null;
        }

        // Deep copy sections and items, adding status
        const groupSections = (template.sections || []).map(sec => ({
            id: this._generateId(),
            title: sec.title,
            items: sec.items.map(item => ({
                id: this._generateId(),
                text: item.text,
                completed: false
            }))
        }));

        // Handle legacy flatness if any (migration on fly)
        if (!template.sections && template.items) {
            groupSections.push({
                id: this._generateId(),
                title: '一般',
                items: template.items.map(item => ({
                    id: this._generateId(),
                    text: item.text,
                    completed: false
                }))
            });
        }

        const newGroup = {
            id: this._generateId(),
            templateId: template.id,
            status: 'active',
            title: template.title,
            sections: groupSections
        };
        this._touch(newGroup, true);
        this.data.groups.push(newGroup);
        this._saveData();
        return newGroup;
    }

    createGroup(title, sectionsData = []) {
        // One-off creation
        const sections = sectionsData.map(sec => ({
            id: this._generateId(),
            title: sec.title,
            items: sec.items.map(text => ({
                id: this._generateId(),
                text: text,
                completed: false
            }))
        }));

        const newGroup = {
            id: this._generateId(),
            templateId: null,
            status: 'active',
            title: title,
            sections: sections
        };
        this._touch(newGroup, true);
        this.data.groups.push(newGroup);
        this._saveData();
        return newGroup;
    }

    toggleTodoCompletion(groupId, todoId) {
        const group = this.data.groups.find(g => g.id === groupId);
        if (!group) return null;

        // Search through sections
        if (group.sections) {
            for (const section of group.sections) {
                const todo = section.items.find(i => i.id === todoId);
                if (todo) {
                    todo.completed = !todo.completed;
                    this._touch(group);
                    this._saveData();
                    return group;
                }
            }
        }

        // Legacy fallback
        if (group.items) {
            const todo = group.items.find(i => i.id === todoId);
            if (todo) {
                todo.completed = !todo.completed;
                this._touch(group);
                this._saveData();
                return group;
            }
        }

        return null;
    }

    checkAllCompleted(groupId) {
        const group = this.data.groups.find(g => g.id === groupId);
        if (!group) return false;

        if (group.sections && group.sections.length > 0) {
            // Check all items in all sections
            // Ensure at least one item exists overall? Or just that all existing are done.
            // Let's say: if there are items, they must be done.
            let hasItems = false;
            const allSectionsDone = group.sections.every(sec => {
                if (sec.items.length > 0) hasItems = true;
                return sec.items.every(i => i.completed);
            });
            return hasItems && allSectionsDone;
        }

        // Legacy
        if (group.items) {
            return group.items.length > 0 && group.items.every(i => i.completed);
        }

        return false;
    }

    archiveGroup(groupId) {
        const group = this.data.groups.find(g => g.id === groupId);
        if (!group) return null;
        group.status = 'archived';
        this._touch(group);
        this._saveData();
        return group;
    }

    unarchiveGroup(groupId) {
        const group = this.data.groups.find(g => g.id === groupId);
        if (!group) return null;
        group.status = 'active';
        this._touch(group);
        this._saveData();
        return group;
    }

    deleteGroup(groupId) {
        this.data.groups = this.data.groups.filter(g => g.id !== groupId);
        this._saveData();
    }
}

const todoStore = new LocalStorageManager();

class UIManager {
    constructor(store) {
        this.store = store;
        this.elements = {};
        this.init();
    }

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.render();
        this.updateDateDisplay();
    }

    cacheDOM() {
        this.elements = {
            dateDisplay: document.getElementById('date-display'),
            navBtns: document.querySelectorAll('.nav-btn'),
            tabContents: document.querySelectorAll('.tab-content'),
            activeContainer: document.getElementById('active-groups-container'),
            templatesContainer: document.getElementById('templates-container'),
            archiveContainer: document.getElementById('archive-container'),
            emptyStateActive: document.getElementById('empty-state-active'),
            btnQuickAdd: document.getElementById('btn-quick-add'),
            btnCreateTemplate: document.getElementById('btn-create-template'),
            btnSaveTemplate: document.getElementById('btn-save-template'),
            btnAddTplItem: document.getElementById('btn-add-tpl-item'),
            modal: document.getElementById('template-modal'),
            modalCloseBtns: document.querySelectorAll('.close-modal'),
            tplTitleInput: document.getElementById('tpl-title-input'),
            tplSectionsContainer: document.getElementById('tpl-sections-container'),
            btnAddSection: document.getElementById('btn-add-section'),
            feedbackOverlay: document.getElementById('feedback-overlay')
        };
    }

    bindEvents() {
        this.elements.navBtns.forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });
        document.querySelectorAll('[data-switch-tab]').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.switchTab));
        });
        this.elements.btnCreateTemplate.addEventListener('click', () => this.openModal());
        this.elements.modalCloseBtns.forEach(btn => btn.addEventListener('click', () => this.closeModal()));
        this.elements.modal.addEventListener('click', (e) => {
            if (e.target === this.elements.modal) this.closeModal();
        });

        this.elements.btnAddSection.addEventListener('click', () => this.addTemplateSection());

        this.elements.btnSaveTemplate.addEventListener('click', () => this.saveTemplate());
        this.elements.btnQuickAdd.addEventListener('click', () => {
            const title = prompt("新しいタスクグループの名前:");
            if (title) {
                // Quick add creates a group with a default General section
                this.store.createGroup(title, [{ title: '一般', items: [] }]);
                this.renderActiveGroups();
            }
        });
    }

    updateDateDisplay() {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        this.elements.dateDisplay.innerText = new Date().toLocaleDateString('ja-JP', options);
    }

    switchTab(tabId) {
        this.elements.navBtns.forEach(btn => {
            if (btn.dataset.tab === tabId) btn.classList.add('active');
            else btn.classList.remove('active');
        });
        this.elements.tabContents.forEach(content => {
            if (content.id === `tab-${tabId}`) content.classList.add('active');
            else content.classList.remove('active');
        });
        this.render();
    }

    render() {
        this.renderActiveGroups();
        this.renderTemplates();
        this.renderArchives();
    }

    renderActiveGroups() {
        const groups = this.store.getGroups('active');
        const container = this.elements.activeContainer;
        container.innerHTML = '';
        if (groups.length === 0) {
            this.elements.emptyStateActive.style.display = 'block';
            return;
        } else {
            this.elements.emptyStateActive.style.display = 'none';
        }

        groups.forEach(group => {
            const card = document.createElement('div');
            card.className = 'card';
            const dateStr = new Date(group.createdAt).toLocaleDateString();

            let contentHtml = `
                <div class="card-header">
                    <div>
                        <div class="card-title">${this.escapeHtml(group.title)}</div>
                        <div class="card-meta">${dateStr}</div>
                    </div>
                    <div class="card-actions">
                        <button class="icon-btn danger" onclick="app.deleteGroup('${group.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="group-sections" id="group-content-${group.id}">
                    <!-- Sections injected here -->
                </div>
            `;
            card.innerHTML = contentHtml;
            container.appendChild(card);

            const contentEl = card.querySelector(`#group-content-${group.id}`);

            // Render Sections
            const sections = group.sections || [];
            // Migration fallback
            if (sections.length === 0 && group.items && group.items.length > 0) {
                this.renderSection(group.id, { id: 'legacy', title: 'タスク', items: group.items }, contentEl);
            } else {
                sections.forEach(section => {
                    this.renderSection(group.id, section, contentEl);
                });
            }
        });
    }

    renderSection(groupId, section, container) {
        if (!section.items) return;

        const sectionEl = document.createElement('div');
        sectionEl.className = 'group-section';
        sectionEl.innerHTML = `
            <div class="group-section-title">${this.escapeHtml(section.title)}</div>
            <ul class="mini-todo-list"></ul>
        `;
        const listEl = sectionEl.querySelector('ul');

        section.items.forEach(item => {
            const li = document.createElement('li');
            li.className = `mini-todo-item ${item.completed ? 'completed' : ''}`;
            li.innerHTML = `
                <div class="mini-check" onclick="app.toggleItem('${groupId}', '${item.id}')">
                    <i class="fas fa-check"></i>
                </div>
                <span class="mini-text">${this.escapeHtml(item.text)}</span>
            `;
            listEl.appendChild(li);
        });

        container.appendChild(sectionEl);
    }



    renderTemplates() {
        const templates = this.store.getTemplates();
        const container = this.elements.templatesContainer;
        container.innerHTML = '';

        templates.forEach(tpl => {
            const card = document.createElement('div');
            card.className = 'card template-card';

            // Preview: Show first 2 sections and their first 2 items
            let previewHtml = '';
            const sections = tpl.sections || [];

            // Legacy support
            if (sections.length === 0 && tpl.items && tpl.items.length > 0) {
                previewHtml = tpl.items.slice(0, 3).map(i => `• ${this.escapeHtml(i.text)}`).join('<br>');
            } else {
                sections.slice(0, 2).forEach(sec => {
                    previewHtml += `<div class="preview-section-title">${this.escapeHtml(sec.title)}</div>`;
                    sec.items.slice(0, 2).forEach(i => {
                        previewHtml += `<div class="preview-item">• ${this.escapeHtml(i.text)}</div>`;
                    });
                });
            }

            card.innerHTML = `
                <div class="card-header">
                    <div class="card-title">${this.escapeHtml(tpl.title)}</div>
                    <div class="card-actions">
                        <button class="icon-btn" onclick="app.duplicateTemplate('${tpl.id}')" title="複製">
                           <i class="fas fa-copy"></i>
                        </button>
                        <button class="icon-btn" onclick="app.editTemplate('${tpl.id}')" title="編集">
                           <i class="fas fa-pen"></i>
                        </button>
                        <button class="icon-btn danger" onclick="app.deleteTemplate('${tpl.id}')" title="削除">
                           <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="template-items-preview">${previewHtml}</div>
                <button class="btn-start-group" onclick="app.startFromTemplate('${tpl.id}')">
                    <i class="fas fa-play"></i> このテンプレートで開始
                </button>
            `;
            container.appendChild(card);
        });
    }

    duplicateTemplate(id) {
        if (confirm('このテンプレートを複製しますか？')) {
            const newTemplate = this.store.duplicateTemplate(id);
            if (newTemplate) {
                // Open modal to edit the new template immediately
                this.editTemplate(newTemplate.id);
                // Also switch tab just in case, though modal covers it
                this.renderTemplates();
            }
        }
    }

    closeModal() {
        this.elements.modal.classList.add('hidden');
        this.currentEditId = null;
        this.elements.tplTitleInput.value = '';
        this.elements.tplSectionsContainer.innerHTML = '';
    }

    openModal(template = null) {
        this.elements.modal.classList.remove('hidden');
        this.elements.tplTitleInput.value = '';
        this.elements.tplSectionsContainer.innerHTML = '';

        if (template) {
            this.currentEditId = template.id;
            this.elements.tplTitleInput.value = template.title;
            const header = document.querySelector('#template-modal h3');
            if (header) header.innerText = 'テンプレート編集';

            // Load Sections
            const sections = template.sections || [];
            // Legacy
            if (sections.length === 0 && template.items && template.items.length > 0) {
                this.addTemplateSection('一般', template.items.map(i => i.text));
            } else {
                sections.forEach(sec => {
                    this.addTemplateSection(sec.title, sec.items.map(i => i.text));
                });
            }
        } else {
            this.currentEditId = null;
            this.elements.tplTitleInput.value = '';
            const header = document.querySelector('#template-modal h3');
            if (header) header.innerText = '新規テンプレート作成';

            // Add one default section
            this.addTemplateSection('');
        }
    }

    addTemplateSection(title = '', items = []) {
        const sectionId = crypto.randomUUID();
        const div = document.createElement('div');
        div.className = 'tpl-section';
        div.dataset.sectionId = sectionId;

        div.innerHTML = `
            <div class="tpl-section-header">
                <div class="section-controls">
                    <button class="icon-btn move-up-btn" title="上に移動"><i class="fas fa-chevron-up"></i></button>
                    <button class="icon-btn move-down-btn" title="下に移動"><i class="fas fa-chevron-down"></i></button>
                </div>
                <input type="text" class="tpl-section-title-input" placeholder="大タスク名 (例: 持ち物)" value="${this.escapeHtml(title)}">
                <button class="icon-btn danger remove-section-btn"><i class="fas fa-trash"></i></button>
            </div>
            <div class="tpl-section-items"></div>
            <div class="tpl-section-footer">
                <button class="btn-add-item-to-section text-btn"><i class="fas fa-plus"></i> 小タスク追加</button>
            </div>
        `;

        // Bind Events
        div.querySelector('.remove-section-btn').addEventListener('click', () => {
            if (confirm('このグループを削除しますか？')) div.remove();
        });
        div.querySelector('.move-up-btn').addEventListener('click', () => this.moveNode(div, 'up'));
        div.querySelector('.move-down-btn').addEventListener('click', () => this.moveNode(div, 'down'));

        const itemsContainer = div.querySelector('.tpl-section-items');
        div.querySelector('.btn-add-item-to-section').addEventListener('click', () => {
            this.addTemplateItemToSection(itemsContainer, '');
        });

        this.elements.tplSectionsContainer.appendChild(div);

        // Add initial items if provided
        items.forEach(text => {
            this.addTemplateItemToSection(itemsContainer, text);
        });

        // If new section (no title, no items), add one blank item
        if (!title && items.length === 0) {
            this.addTemplateItemToSection(itemsContainer, '');
        }
    }

    addTemplateItemToSection(container, text = '') {
        const div = document.createElement('div');
        div.className = 'tpl-item-row';
        div.innerHTML = `
            <div class="item-controls" style="margin-right: 5px;">
                 <i class="fas fa-chevron-up move-item-up" style="cursor:pointer; color:#b2bec3; font-size:0.7rem; margin-right:2px;"></i>
                 <i class="fas fa-chevron-down move-item-down" style="cursor:pointer; color:#b2bec3; font-size:0.7rem;"></i>
            </div>
            <i class="fas fa-dot-circle" style="font-size: 0.6rem; color: #b2bec3;"></i>
            <span contenteditable="true" class="editable-span">${this.escapeHtml(text)}</span>
            <i class="fas fa-times remove-item-btn" style="margin-left:auto; cursor:pointer; color:#b2bec3;"></i>
        `;
        div.querySelector('.remove-item-btn').addEventListener('click', () => {
            // If this is the last item and empty, maybe warn? No, just remove.
            div.remove();
        });
        div.querySelector('.move-item-up').addEventListener('click', () => this.moveNode(div, 'up'));
        div.querySelector('.move-item-down').addEventListener('click', () => this.moveNode(div, 'down'));

        container.appendChild(div);
    }

    moveNode(node, direction) {
        if (direction === 'up') {
            const prev = node.previousElementSibling;
            if (prev) node.parentNode.insertBefore(node, prev);
        } else {
            const next = node.nextElementSibling;
            if (next) node.parentNode.insertBefore(next, node);
        }
    }

    saveTemplate() {
        const title = this.elements.tplTitleInput.value.trim();
        if (!title) {
            alert('テンプレート名を入力してください');
            return;
        }

        const sectionsData = [];
        const sectionEls = this.elements.tplSectionsContainer.querySelectorAll('.tpl-section');

        sectionEls.forEach(secEl => {
            const secTitle = secEl.querySelector('.tpl-section-title-input').value.trim() || '名称未設定';
            const items = [];
            secEl.querySelectorAll('.editable-span').forEach(span => {
                const val = span.innerText.trim();
                // Allow saving empty items if user wants, or filter?
                // Filtering empty items is usually good UX.
                if (val) items.push(val);
            });

            // FIXED: Allow section even if items are empty, as long as the intention is to create a section.
            // But usually a section should have items. Let's allow it if title is set OR items exist.
            // If both are empty (default new section not touched), maybe skip?
            // User feedback: "Could not save". Probably they had a section but maybe items check failed.
            // Let's Just push it regardless, or check if it's "worth" saving.
            // Reverting to: always push if it exists in DOM, trusting user deletion.
            sectionsData.push({ title: secTitle, items: items });
        });

        if (sectionsData.length === 0) {
            alert('少なくとも1つのセクション・タスクを追加してください');
            return;
        }

        if (this.currentEditId) {
            this.store.updateTemplate(this.currentEditId, title, sectionsData);
        } else {
            this.store.createTemplate(title, sectionsData);
        }
        this.closeModal();
        this.renderTemplates();
        this.switchTab('templates');
    }

    editTemplate(id) {
        // Debug
        // alert('editTemplate Called: ' + id);

        const template = this.store.getTemplates().find(t => t.id === id);
        if (template) {
            this.openModal(template);
        } else {
            alert('Template load failed: ' + id);
        }
    }

    renderArchives() {
        const groups = this.store.getGroups('archived');
        const container = this.elements.archiveContainer;
        container.innerHTML = '';
        groups.sort((a, b) => b.updatedAt - a.updatedAt);
        groups.forEach(group => {
            const card = document.createElement('div');
            card.className = 'card';
            card.style.opacity = '0.7';
            card.innerHTML = `
                <div class="card-header">
                    <div>
                        <div class="card-title">${this.escapeHtml(group.title)}</div>
                        <div class="card-meta">完了日: ${new Date(group.updatedAt).toLocaleDateString()}</div>
                    </div>
                    <div class="card-actions">
                         <button class="icon-btn" onclick="app.unarchiveGroup('${group.id}')" title="戻す">
                            <i class="fas fa-undo"></i>
                        </button>
                        <button class="icon-btn danger" onclick="app.deleteGroup('${group.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    }

    startFromTemplate(tplId) {
        const group = this.store.createGroupFromTemplate(tplId);
        if (group) {
            this.switchTab('active');
        }
    }

    deleteTemplate(id) {
        if (confirm('このテンプレートを削除してもよろしいですか？')) {
            this.store.deleteTemplate(id);
            this.renderTemplates();
        }
    }

    deleteGroup(id) {
        if (confirm('削除してもよろしいですか？')) {
            this.store.deleteGroup(id);
            this.render();
        }
    }

    unarchiveGroup(id) {
        this.store.unarchiveGroup(id);
        this.render();
    }

    toggleItem(groupId, todoId) {
        this.store.toggleTodoCompletion(groupId, todoId);
        this.renderActiveGroups();
        if (this.store.checkAllCompleted(groupId)) {
            this.triggerAutoArchive(groupId);
        }
    }

    triggerAutoArchive(groupId) {
        const overlay = this.elements.feedbackOverlay;
        overlay.classList.remove('hidden');
        setTimeout(() => {
            this.store.archiveGroup(groupId);
            overlay.classList.add('hidden');
            this.render();
        }, 2000);
    }

    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>'"]/g,
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag]));
    }
}

// Global initialization

document.addEventListener('DOMContentLoaded', () => {
    window.app = new UIManager(todoStore);
});
