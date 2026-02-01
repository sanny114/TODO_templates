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

    createTemplate(title, itemTexts) {
        const newTemplate = {
            id: this._generateId(),
            title: title,
            items: itemTexts.map(text => ({ text })),
        };
        this._touch(newTemplate, true);
        this.data.templates.push(newTemplate);
        this._saveData();
        return newTemplate;
    }

    updateTemplate(id, title, itemTexts) {
        const template = this.data.templates.find(t => t.id === id);
        if (!template) return null;
        if (title !== undefined) template.title = title;
        if (itemTexts !== undefined) {
            template.items = itemTexts.map(text => ({ text }));
        }
        this._touch(template);
        this._saveData();
        return template;
    }

    deleteTemplate(id) {
        this.data.templates = this.data.templates.filter(t => t.id !== id);
        this._saveData();
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
        const groupItems = template.items.map(item => ({
            id: this._generateId(),
            text: item.text,
            completed: false
        }));
        const newGroup = {
            id: this._generateId(),
            templateId: template.id,
            status: 'active',
            title: template.title,
            items: groupItems
        };
        this._touch(newGroup, true);
        this.data.groups.push(newGroup);
        this._saveData();
        return newGroup;
    }

    createGroup(title, itemTexts = []) {
        const groupItems = itemTexts.map(text => ({
            id: this._generateId(),
            text: text,
            completed: false
        }));
        const newGroup = {
            id: this._generateId(),
            templateId: null,
            status: 'active',
            title: title,
            items: groupItems
        };
        this._touch(newGroup, true);
        this.data.groups.push(newGroup);
        this._saveData();
        return newGroup;
    }

    toggleTodoCompletion(groupId, todoId) {
        const group = this.data.groups.find(g => g.id === groupId);
        if (!group) return null;
        const todo = group.items.find(i => i.id === todoId);
        if (!todo) return null;
        todo.completed = !todo.completed;
        this._touch(group);
        this._saveData();
        return group;
    }

    checkAllCompleted(groupId) {
        const group = this.data.groups.find(g => g.id === groupId);
        if (!group) return false;
        return group.items.length > 0 && group.items.every(i => i.completed);
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
            tplItemsList: document.getElementById('tpl-items-list'),
            tplNewItemInput: document.getElementById('tpl-new-item-input'),
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
        this.elements.btnAddTplItem.addEventListener('click', () => this.addTemplateItemInput());
        this.elements.tplNewItemInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTemplateItemInput();
        });
        this.elements.btnSaveTemplate.addEventListener('click', () => this.saveTemplate());
        this.elements.btnQuickAdd.addEventListener('click', () => {
            const title = prompt("新しいタスクグループの名前:");
            if (title) {
                this.store.createGroup(title);
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
            card.innerHTML = `
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
                <ul class="mini-todo-list" id="list-${group.id}"></ul>
            `;
            container.appendChild(card);
            const listEl = card.querySelector(`#list-${group.id}`);
            group.items.forEach(item => {
                const li = document.createElement('li');
                li.className = `mini-todo-item ${item.completed ? 'completed' : ''}`;
                li.innerHTML = `
                    <div class="mini-check" onclick="app.toggleItem('${group.id}', '${item.id}')">
                        <i class="fas fa-check"></i>
                    </div>
                    <span class="mini-text">${this.escapeHtml(item.text)}</span>
                `;
                listEl.appendChild(li);
            });
        });
    }

    renderTemplates() {
        const templates = this.store.getTemplates();
        const container = this.elements.templatesContainer;
        container.innerHTML = '';
        templates.forEach(tpl => {
            const card = document.createElement('div');
            card.className = 'card template-card';
            const previewItems = tpl.items.slice(0, 3).map(i => `• ${this.escapeHtml(i.text)}`).join('<br>');
            const moreText = tpl.items.length > 3 ? `...他 ${tpl.items.length - 3} 件` : '';
            card.innerHTML = `
                <div class="card-header">
                    <div class="card-title">${this.escapeHtml(tpl.title)}</div>
                    <div class="card-actions">
                        <button class="icon-btn" onclick="app.editTemplate('${tpl.id}')" title="編集">
                           <i class="fas fa-pen"></i>
                        </button>
                        <button class="icon-btn danger" onclick="app.deleteTemplate('${tpl.id}')" title="削除">
                           <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="template-items-preview">${previewItems}<br>${moreText}</div>
                <button class="btn-start-group" onclick="app.startFromTemplate('${tpl.id}')">
                    <i class="fas fa-play"></i> このテンプレートで開始
                </button>
            `;
            container.appendChild(card);
        });
    }

    openModal(template = null) {
        this.elements.modal.classList.remove('hidden');
        this.elements.tplTitleInput.value = '';
        this.elements.tplItemsList.innerHTML = '';
        this.elements.tplNewItemInput.value = '';
        if (template) {
            this.currentEditId = template.id;
            this.elements.tplTitleInput.value = template.title;
            const header = document.querySelector('#template-modal h3');
            if (header) header.innerText = 'テンプレート編集';
            template.items.forEach(item => {
                this.addTemplateItemInput(item.text);
            });
        } else {
            this.currentEditId = null;
            this.elements.tplTitleInput.value = '';
            const header = document.querySelector('#template-modal h3');
            if (header) header.innerText = '新規テンプレート作成';
            this.addTemplateItemInput('');
        }
    }

    closeModal() {
        this.elements.modal.classList.add('hidden');
        this.currentEditId = null;
    }

    addTemplateItemInput(value = '') {
        let text = value;
        if (!text) {
            const input = this.elements.tplNewItemInput;
            text = input.value.trim();
            if (!text) return;
            input.value = '';
            input.focus();
        }
        const div = document.createElement('div');
        div.className = 'tpl-item-row';
        div.innerHTML = `
            <i class="fas fa-dot-circle" style="font-size: 0.6rem; color: var(--accent-color);"></i>
            <span contenteditable="true" class="editable-span">${this.escapeHtml(text)}</span>
            <i class="fas fa-times remove-item-btn" style="margin-left:auto; cursor:pointer; color:#b2bec3;"></i>
        `;
        div.querySelector('.remove-item-btn').addEventListener('click', () => {
            div.remove();
        });
        this.elements.tplItemsList.appendChild(div);
    }

    saveTemplate() {
        const title = this.elements.tplTitleInput.value.trim();
        if (!title) {
            alert('テンプレート名を入力してください');
            return;
        }
        const items = [];
        this.elements.tplItemsList.querySelectorAll('span').forEach(span => {
            items.push(span.innerText);
        });
        if (items.length === 0) {
            alert('少なくとも1つのタスクを追加してください');
            return;
        }
        if (this.currentEditId) {
            this.store.updateTemplate(this.currentEditId, title, items);
        } else {
            this.store.createTemplate(title, items);
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
