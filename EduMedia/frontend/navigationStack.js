// ========== NAVIGATION STACK (DSA Implementation) ==========

/**
 * Stack Data Structure for Navigation History
 * 
 * This Stack is used to track the user's navigation path through the application.
 * When a user navigates to a new page, we push the current page onto the stack.
 * When they press the back button, we pop from the stack to return to the previous page.
 * 
 * Stack Operations:
 * - push(page): Add a page to the top of the stack
 * - pop(): Remove and return the top page from the stack
 * - peek(): View the top page without removing it
 * - isEmpty(): Check if the stack is empty
 * - size(): Get the number of pages in the stack
 */

class NavigationStack {
    constructor() {
        this.stack = [];
        console.log('📚 Navigation Stack initialized');
    }

    /**
     * Push a page onto the navigation stack
     * @param {string} page - The page identifier (e.g., "feed", "profile")
     */
    push(page) {
        this.stack.push({
            page: page,
            timestamp: new Date(),
            scrollPosition: window.scrollY || 0
        });
        console.log(`📚 Stack PUSH: "${page}" | Stack size: ${this.stack.length}`);
        this.updateBackButtonVisibility();
    }

    /**
     * Pop the top page from the navigation stack
     * @returns {Object|null} The popped page object or null if stack is empty
     */
    pop() {
        if (this.isEmpty()) {
            console.log('📚 Stack POP: Stack is empty, cannot pop');
            return null;
        }
        
        const poppedPage = this.stack.pop();
        console.log(`📚 Stack POP: "${poppedPage.page}" | Stack size: ${this.stack.length}`);
        this.updateBackButtonVisibility();
        return poppedPage;
    }

    /**
     * Peek at the top page without removing it
     * @returns {Object|null} The top page object or null if stack is empty
     */
    peek() {
        if (this.isEmpty()) {
            return null;
        }
        return this.stack[this.stack.length - 1];
    }

    /**
     * Check if the navigation stack is empty
     * @returns {boolean} True if stack is empty, false otherwise
     */
    isEmpty() {
        return this.stack.length === 0;
    }

    /**
     * Get the current size of the navigation stack
     * @returns {number} The number of pages in the stack
     */
    size() {
        return this.stack.length;
    }

    /**
     * Get the previous page (the one before the current top)
     * @returns {string|null} The previous page identifier or null
     */
    getPreviousPage() {
        if (this.size() < 2) {
            return null;
        }
        return this.stack[this.stack.length - 2].page;
    }

    /**
     * Clear the entire navigation stack
     */
    clear() {
        this.stack = [];
        console.log('📚 Stack CLEARED');
        this.updateBackButtonVisibility();
    }

    /**
     * Get all pages in the stack (for debugging)
     * @returns {Array} Array of page identifiers
     */
    toArray() {
        return this.stack.map(item => item.page);
    }

    /**
     * Update the visibility of the back button based on stack state
     */
    updateBackButtonVisibility() {
        const backBtn = document.getElementById('backBtn');
        if (backBtn) {
            if (this.size() > 1) {
                backBtn.style.display = 'flex';
                backBtn.style.opacity = '1';
            } else {
                backBtn.style.display = 'none';
                backBtn.style.opacity = '0';
            }
        }
    }

    /**
     * Navigate back using the stack
     * @returns {string|null} The page to navigate to, or null if stack is empty
     */
    navigateBack() {
        // Pop current page
        const currentPage = this.pop();
        
        if (this.isEmpty()) {
            console.log('📚 No previous page in stack');
            return null;
        }

        // Peek at the previous page (now at top of stack)
        const previousPage = this.peek();
        
        if (previousPage) {
            console.log(`📚 Navigating back to: "${previousPage.page}"`);
            return previousPage.page;
        }
        
        return null;
    }

    /**
     * Print the current stack state (for debugging)
     */
    printStack() {
        console.log('📚 Current Navigation Stack:');
        if (this.isEmpty()) {
            console.log('   [Empty Stack]');
        } else {
            this.stack.forEach((item, index) => {
                const marker = index === this.stack.length - 1 ? '← TOP' : '';
                console.log(`   ${index + 1}. ${item.page} ${marker}`);
            });
        }
    }
}

// Create a global navigation stack instance
const navigationStack = new NavigationStack();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = navigationStack;
}
