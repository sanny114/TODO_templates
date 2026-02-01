document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const todoInput = document.getElementById('todo-input');
    const addBtn = document.getElementById('add-btn');
    const todoList = document.getElementById('todo-list');
    const itemsLeft = document.getElementById('items-left');
    const emptyState = document.getElementById('empty-state');
    const dateDisplay = document.getElementById('date-display');

    // Display Date
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateDisplay.innerText = new Date().toLocaleDateString('ja-JP', options);

    // Initial check
    checkEmpty();

    // Event Listeners
    addBtn.addEventListener('click', addTodo);
    todoInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addTodo(e);
        }
    });

    // Functions
    function addTodo(event) {
        event.preventDefault(); // Prevent form submission if inside a form

        const todoText = todoInput.value;

        if (todoText === '') return;

        // Create Todo Item
        const todoItem = document.createElement('li');
        todoItem.classList.add('todo-item');

        // Todo Content Wrapper
        const contentDiv = document.createElement('div');
        contentDiv.classList.add('todo-content');

        // Check Button
        const checkCircle = document.createElement('div');
        checkCircle.classList.add('check-circle');
        checkCircle.innerHTML = '<i class="fas fa-check"></i>';
        checkCircle.addEventListener('click', toggleComplete);

        // Text
        const todoSpan = document.createElement('span');
        todoSpan.innerText = todoText;
        todoSpan.classList.add('todo-text');
        
        // Append to content wrapper
        contentDiv.appendChild(checkCircle);
        contentDiv.appendChild(todoSpan);

        // Delete Button
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.classList.add('delete-btn');
        deleteBtn.addEventListener('click', deleteTodo);

        // Assemble Todo Item
        todoItem.appendChild(contentDiv);
        todoItem.appendChild(deleteBtn);

        // Append to List
        todoList.appendChild(todoItem);

        // Clear Input
        todoInput.value = '';

        // Update Stats
        updateItemsCount();
        checkEmpty();
    }

    function deleteTodo(e) {
        const item = e.target.closest('.todo-item');
        // Animation
        item.classList.add('fall');
        item.addEventListener('transitionend', function() {
            item.remove();
            updateItemsCount();
            checkEmpty();
        });
    }

    function toggleComplete(e) {
        const item = e.target.closest('.todo-item');
        item.classList.toggle('completed');
        updateItemsCount();
    }

    function updateItemsCount() {
        const totalItems = todoList.children.length;
        const completedItems = document.querySelectorAll('.completed').length;
        const activeItems = totalItems - completedItems;
        // Count active items (uncompleted)
        const uncompletedCount = document.querySelectorAll('.todo-item:not(.completed)').length;
        itemsLeft.innerText = uncompletedCount;
    }

    function checkEmpty() {
        if (todoList.children.length === 0) {
            emptyState.style.display = 'block';
        } else {
            emptyState.style.display = 'none';
        }
    }
});
