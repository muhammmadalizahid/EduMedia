// ========== DATA STRUCTURES ==========

// Queue Implementation (FIFO) - Used for Posts Feed
class Queue {
    constructor() {
        this.items = [];
    }

    enqueue(element) {
        this.items.push(element);
    }

    dequeue() {
        if (this.isEmpty()) return null;
        return this.items.shift();
    }

    front() {
        if (this.isEmpty()) return null;
        return this.items[0];
    }

    isEmpty() {
        return this.items.length === 0;
    }

    size() {
        return this.items.length;
    }

    toArray() {
        return [...this.items];
    }

    clear() {
        this.items = [];
    }
}

// Stack Implementation (LIFO) - Used for Browsing History & Undo
class Stack {
    constructor() {
        this.items = [];
    }

    push(element) {
        this.items.push(element);
    }

    pop() {
        if (this.isEmpty()) return null;
        return this.items.pop();
    }

    peek() {
        if (this.isEmpty()) return null;
        return this.items[this.items.length - 1];
    }

    isEmpty() {
        return this.items.length === 0;
    }

    size() {
        return this.items.length;
    }

    toArray() {
        return [...this.items];
    }

    clear() {
        this.items = [];
    }
}

// Linked List Node
class Node {
    constructor(data) {
        this.data = data;
        this.next = null;
    }
}

// Linked List Implementation - Used for Friends List
class LinkedList {
    constructor() {
        this.head = null;
        this.size = 0;
    }

    add(data) {
        const newNode = new Node(data);
        if (!this.head) {
            this.head = newNode;
        } else {
            let current = this.head;
            while (current.next) {
                current = current.next;
            }
            current.next = newNode;
        }
        this.size++;
    }

    remove(id) {
        if (!this.head) return false;

        if (this.head.data.id === id) {
            this.head = this.head.next;
            this.size--;
            return true;
        }

        let current = this.head;
        while (current.next) {
            if (current.next.data.id === id) {
                current.next = current.next.next;
                this.size--;
                return true;
            }
            current = current.next;
        }
        return false;
    }

    find(id) {
        let current = this.head;
        while (current) {
            if (current.data.id === id) {
                return current.data;
            }
            current = current.next;
        }
        return null;
    }

    toArray() {
        const array = [];
        let current = this.head;
        while (current) {
            array.push(current.data);
            current = current.next;
        }
        return array;
    }

    isEmpty() {
        return this.size === 0;
    }

    getSize() {
        return this.size;
    }

    clear() {
        this.head = null;
        this.size = 0;
    }
}

// ========== APPLICATION STATE ==========

const AppState = {
    currentUser: null,
    postsQueue: new Queue(),
    historyStack: new Stack(),
    friendsList: new LinkedList(),
    selectedPost: null,
    isLoading: false
};

// ========== INITIALIZATION ==========

document.addEventListener('DOMContentLoaded', async function () {
    // Set up authentication listeners
    setupAuthListeners();

    // Main app event listeners (always set up)
    setupEventListeners();
    
    // Initialize navigation stack with the default page (feed)
    navigationStack.push('feed');
    console.log('📚 Navigation Stack initialized with default page: feed');

    // Check if user is already authenticated (has valid token)
    const isAuthenticated = await checkExistingAuth();

    // If not authenticated, login screen is already showing by default
    // If authenticated, checkExistingAuth() already initialized the app
});

async function initializeApp() {
    AppState.isLoading = true;

    // User is already authenticated at this point
    // currentUser is set during login/signup
    try {
        // Update UI with user info
        document.getElementById('currentUserName').textContent = AppState.currentUser.name;
        document.getElementById('profileName').textContent = AppState.currentUser.name;
        document.getElementById('profileEmail').textContent = AppState.currentUser.email;
        document.getElementById('profileBio').textContent = AppState.currentUser.bio;
        document.getElementById('avatarInitials').textContent = AppState.currentUser.initials;

        // Load data from database
        await loadDataFromDatabase();

    } catch (error) {
        console.error('Error initializing app:', error);
        alert('Failed to initialize application. Please check your database connection.');
    }

    AppState.isLoading = false;
}

async function loadDataFromDatabase() {
    try {
        // Load posts into queue
        const posts = await Database.getAllPosts();
        AppState.postsQueue.clear();
        posts.forEach(post => {
            // Transform database post to match our frontend structure
            const transformedPost = {
                id: post.id,
                author: post.author.name,
                authorId: post.author_id,
                initials: post.author.initials,
                content: post.content,
                timestamp: new Date(post.created_at),
                likes: post.likes,
                likedBy: [], // Will be populated below
                comments: []  // Will be loaded below
            };
            AppState.postsQueue.enqueue(transformedPost);
        });

        // Load friends into linked list
        const friends = await Database.getFriends(AppState.currentUser.id);
        AppState.friendsList.clear();
        friends.forEach(friendship => {
            const friend = {
                id: friendship.id,
                friendId: friendship.friend.id,
                name: friendship.friend.name,
                email: friendship.friend.email,
                initials: friendship.friend.initials,
                addedDate: new Date(friendship.added_at)
            };
            AppState.friendsList.add(friend);
        });

        // Load likes and comments for each post
        for (const post of AppState.postsQueue.toArray()) {
            // Load likes and get FRESH count from database
            const likes = await Database.getLikesForPost(post.id);
            post.likedBy = likes.map(like => like.user_id);
            post.likes = likes.length; // ✅ UPDATE: Use actual count from database, not stale cache
            
            // Load comments
            const comments = await Database.getCommentsForPost(post.id);
            post.comments = comments.map(comment => ({
                id: comment.id,
                author: comment.author.name,
                authorId: comment.author_id,
                text: comment.text,
                created_at: comment.created_at,
                post_id: post.id
            }));
        }

        updateStatistics();
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// ========== EVENT LISTENERS ==========

function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', handleNavigation);
    });
    
    // Back button (navigation stack)
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.addEventListener('click', handleBackNavigation);
    }

    // Toast notification buttons
    const toastUndoBtn = document.getElementById('toastUndoBtn');
    const toastCloseBtn = document.getElementById('toastCloseBtn');

    if (toastUndoBtn) {
        toastUndoBtn.addEventListener('click', handleToastUndo);
    }

    if (toastCloseBtn) {
        toastCloseBtn.addEventListener('click', hideToast);
    }
    
    // Delete confirmation modal buttons
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', confirmDeletePost);
    }
    
    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', cancelDeletePost);
    }
    
    // Logout confirmation modal buttons
    const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');
    const cancelLogoutBtn = document.getElementById('cancelLogoutBtn');
    
    if (confirmLogoutBtn) {
        confirmLogoutBtn.addEventListener('click', confirmLogout);
    }
    
    if (cancelLogoutBtn) {
        cancelLogoutBtn.addEventListener('click', cancelLogout);
    }

    // Create post
    document.getElementById('createPostForm').addEventListener('submit', handleCreatePost);

    // Search and sort posts
    document.getElementById('searchPosts').addEventListener('input', filterAndSortPosts);
    document.getElementById('sortPosts').addEventListener('change', filterAndSortPosts);

    // Profile edit
    document.getElementById('editProfileBtn').addEventListener('click', showProfileEdit);
    document.getElementById('cancelEditBtn').addEventListener('click', hideProfileEdit);
    document.getElementById('profileEditForm').addEventListener('submit', handleProfileSave);

    // Friends management
    document.getElementById('addFriendBtn').addEventListener('click', showAddFriendForm);
    document.getElementById('cancelAddFriendBtn').addEventListener('click', hideAddFriendForm);
    document.getElementById('addFriendForm').addEventListener('submit', handleAddFriend);
    document.getElementById('searchFriends').addEventListener('input', filterAndSortFriends);
    document.getElementById('sortFriends').addEventListener('change', filterAndSortFriends);

    // History
    document.getElementById('clearHistoryBtn').addEventListener('click', clearHistory);

    // Modals
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', closeModals);
    });

    // Comment form
    document.getElementById('addCommentForm').addEventListener('submit', handleAddComment);

    // Edit post form
    document.getElementById('editPostForm').addEventListener('submit', handleEditPost);
}

// ========== NAVIGATION (with Navigation Stack DSA) ==========

function handleNavigation(e) {
    e.preventDefault();
    const page = e.target.dataset.page;

    // Track navigation in history stack (for browsing history feature)
    AppState.historyStack.push({
        action: 'navigate',
        page: page,
        timestamp: new Date()
    });

    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    e.target.classList.add('active');

    // Show selected page
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
    });
    document.getElementById(page + 'Page').classList.add('active');

    // Push the new page to navigation stack
    navigationStack.push(page);
    
    // Print stack state for debugging
    navigationStack.printStack();

    renderCurrentPage();
}

/**
 * Navigate using the back button (pops from navigation stack)
 */
function handleBackNavigation() {
    console.log('🔙 Back button clicked');
    
    // Navigate back using the stack
    const previousPage = navigationStack.navigateBack();
    
    if (!previousPage) {
        console.log('🔙 No previous page to navigate to');
        return;
    }
    
    // Update the UI to show the previous page
    navigateToPage(previousPage);
    
    // Print stack state for debugging
    navigationStack.printStack();
}

/**
 * Navigate to a specific page (used by back navigation)
 */
function navigateToPage(page) {
    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.page === page) {
            link.classList.add('active');
        }
    });

    // Show selected page
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
    });
    document.getElementById(page + 'Page').classList.add('active');

    renderCurrentPage();
}

/**
 * Get the current active page identifier
 */
function getCurrentPage() {
    const activePage = document.querySelector('.page.active');
    if (!activePage) return null;
    
    // Extract page name from ID (e.g., "feedPage" -> "feed")
    return activePage.id.replace('Page', '');
}

async function renderCurrentPage() {
    const activePage = document.querySelector('.page.active');
    if (!activePage) return;

    const pageId = activePage.id;

    switch (pageId) {
        case 'feedPage':
            renderFeed();
            break;
        case 'profilePage':
            await loadMyPosts();
            break;
        case 'friendsPage':
            await loadPendingFriendRequests();
            renderFriends();
            break;
        case 'historyPage':
            renderHistory();
            break;
    }
}

// ========== POST MANAGEMENT ==========

async function handleCreatePost(e) {
    e.preventDefault();
    const content = document.getElementById('postContent').value.trim();

    if (!content || AppState.isLoading) return;

    try {
        AppState.isLoading = true;

        // Create post in database
        const dbPost = await Database.createPost(AppState.currentUser.id, content);

        const newPost = {
            id: dbPost.id,
            author: dbPost.author.name,
            authorId: dbPost.author_id,
            initials: dbPost.author.initials,
            content: dbPost.content,
            timestamp: new Date(dbPost.created_at),
            likes: dbPost.likes,
            likedBy: [],
            comments: []
        };

        // Enqueue post (FIFO - Queue)
        AppState.postsQueue.enqueue(newPost);

        // Track in history
        AppState.historyStack.push({
            action: 'create_post',
            postId: newPost.id,
            timestamp: new Date()
        });

        // Clear form
        document.getElementById('postContent').value = '';

        // Re-render feed
        renderFeed();
        updateStatistics();
    } catch (error) {
        console.error('Error creating post:', error);
        alert('Failed to create post. Please try again.');
    } finally {
        AppState.isLoading = false;
    }
}

function renderFeed() {
    const feedContainer = document.getElementById('postsFeed');
    const emptyState = document.getElementById('emptyFeed');

    let posts = AppState.postsQueue.toArray();

    // Apply search filter
    const searchTerm = document.getElementById('searchPosts').value.toLowerCase();
    if (searchTerm) {
        posts = posts.filter(post =>
            post.content.toLowerCase().includes(searchTerm) ||
            post.author.toLowerCase().includes(searchTerm)
        );
    }

    // Apply sorting
    const sortBy = document.getElementById('sortPosts').value;
    posts = sortPosts(posts, sortBy);

    if (posts.length === 0) {
        feedContainer.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    feedContainer.innerHTML = posts.map(post => createPostHTML(post)).join('');
}

function createPostHTML(post) {
    const timeAgo = getTimeAgo(post.timestamp);
    const isLiked = post.likedBy.includes(AppState.currentUser.id);

    return `
        <div class="post-item" data-post-id="${post.id}">
            <div class="post-header">
                <div class="post-author">
                    <div class="author-avatar">${post.initials}</div>
                    <div class="author-info">
                        <h4>${post.author}</h4>
                        <span class="post-time">${timeAgo}</span>
                    </div>
                </div>
            </div>
            <div class="post-content">${post.content}</div>
            <div class="post-footer">
                <div class="post-actions">
                    <button class="like-btn ${isLiked ? 'liked' : ''}" onclick="toggleLike('${post.id}')">
                        ${isLiked ? '❤️ Liked' : '🤍 Like'}
                    </button>
                    <span class="like-count">${post.likes}</span>
                </div>
            </div>
            <div class="comments-section">
                <div class="add-comment-form">
                    <input type="text" class="comment-input" placeholder="Write a comment..." data-post-id="${post.id}">
                    <button onclick="handleAddCommentClick('${post.id}')">Post</button>
                </div>
                <div class="comments-count-display">
                    <span class="comment-count">${post.comments.length}</span> comment${post.comments.length !== 1 ? 's' : ''}
                </div>
                <div class="comments-list">
                    ${post.comments.map(comment => createCommentHTML(comment)).join('')}
                </div>
            </div>
        </div>
    `;
}

// ========== LIKE FUNCTIONALITY ==========

/**
 * Toggle like on a post
 */
async function toggleLike(postId) {
    console.log('🔵 toggleLike called for post:', postId);
    
    if (AppState.isLoading || !AppState.currentUser) {
        console.error('❌ Not ready:', { loading: AppState.isLoading, user: AppState.currentUser });
        return;
    }

    const posts = AppState.postsQueue.toArray();
    // Convert to number for comparison (HTML onclick passes string)
    const postIdNum = parseInt(postId);
    const post = posts.find(p => p.id == postId || p.id === postIdNum);

    if (!post) {
        console.error('❌ Post not found:', postId, 'Available posts:', posts.map(p => ({id: p.id, type: typeof p.id})));
        return;
    }

    const token = localStorage.getItem('authToken');
    const userId = AppState.currentUser.id;
    const userLikedIndex = post.likedBy.indexOf(userId);
    const isLiked = userLikedIndex > -1;

    console.log('Current like state:', { isLiked, userLikedIndex, likedBy: post.likedBy });

    try {
        AppState.isLoading = true;

        if (isLiked) {
            // Unlike
            console.log('Unliking post...');
            const response = await fetch(`${API_URL}/posts/unlike`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ post_id: postId })
            });

            const result = await response.json();
            console.log('Unlike response:', result);

            if (response.ok) {
                post.likedBy.splice(userLikedIndex, 1);
                post.likes = result.data.likes_count;

                AppState.historyStack.push({
                    action: 'unlike_post',
                    postId: postId,
                    timestamp: new Date()
                });
            } else {
                alert(result.message || 'Failed to unlike post');
            }
        } else {
            // Like
            console.log('Liking post...');
            const response = await fetch(`${API_URL}/posts/like`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ post_id: postId })
            });

            const result = await response.json();
            console.log('Like response:', result);

            if (response.ok) {
                post.likedBy.push(userId);
                post.likes = result.data.likes_count;

                AppState.historyStack.push({
                    action: 'like_post',
                    postId: postId,
                    timestamp: new Date()
                });
            } else {
                alert(result.message || 'Failed to like post');
            }
        }

        renderFeed();
    } catch (error) {
        console.error('Error toggling like:', error);
        alert('Failed to update like. Please try again.');
    } finally {
        AppState.isLoading = false;
    }
}

// ========== COMMENT FUNCTIONALITY ==========

/**
 * Handle adding a comment from the input field
 */
function handleAddCommentClick(postId) {
    console.log('🔵 handleAddCommentClick for post:', postId);
    
    const input = document.querySelector(`[data-post-id="${postId}"] .comment-input`);
    const text = input ? input.value.trim() : '';
    
    console.log('Comment text:', text);
    
    if (text) {
        addCommentToPost(postId, text);
        input.value = '';
    } else {
        alert('Please enter a comment');
    }
}

/**
 * Add a comment to a post
 */
async function addCommentToPost(postId, commentText) {
    console.log('🔵 addCommentToPost:', { postId, commentText });
    
    if (AppState.isLoading || !AppState.currentUser) {
        console.error('❌ Not ready:', { loading: AppState.isLoading, user: AppState.currentUser });
        alert('Please wait or login first');
        return;
    }

    const posts = AppState.postsQueue.toArray();
    // Convert to number for comparison (HTML onclick passes string)
    const postIdNum = parseInt(postId);
    const post = posts.find(p => p.id == postId || p.id === postIdNum);

    if (!post) {
        console.error('❌ Post not found:', postId, 'Available posts:', posts.map(p => ({id: p.id, type: typeof p.id})));
        return;
    }

    const token = localStorage.getItem('authToken');

    try {
        AppState.isLoading = true;

        console.log('Sending comment to backend...');
        const response = await fetch(`${API_URL}/comments/add`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                post_id: postId,
                text: commentText
            })
        });

        const result = await response.json();
        console.log('Add comment response:', result);

        if (response.ok) {
            // Add comment to local post
            const newComment = {
                id: result.data.comment.id,
                author: AppState.currentUser.name,
                authorId: AppState.currentUser.id,
                text: commentText,
                created_at: result.data.comment.created_at
            };

            post.comments.push(newComment);

            AppState.historyStack.push({
                action: 'add_comment',
                postId: postId,
                commentId: newComment.id,
                timestamp: new Date()
            });

            renderFeed();
        } else {
            alert(result.message || 'Failed to add comment');
        }
    } catch (error) {
        console.error('Error adding comment:', error);
        alert('Failed to add comment. Please try again.');
    } finally {
        AppState.isLoading = false;
    }
}

/**
 * Create HTML for a comment
 */
function createCommentHTML(comment) {
    const isOwn = AppState.currentUser && (comment.authorId === AppState.currentUser.id || comment.author_id === AppState.currentUser.id);
    const commentTime = comment.created_at ? getTimeAgo(new Date(comment.created_at)) : 'Just now';
    
    return `
        <div class="comment-item" data-comment-id="${comment.id}">
            <div class="comment-header">
                <strong class="comment-author">${comment.author}</strong>
                <span class="comment-time">${commentTime}</span>
            </div>
            <div class="comment-content">
                <p class="comment-text">${comment.text}</p>
            </div>
            ${isOwn ? `
                <div class="comment-actions">
                    <button class="comment-delete-btn" onclick="deleteCommentFromPost('${comment.id}', '${comment.post_id || ''}')">Delete</button>
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Delete a comment
 */
async function deleteCommentFromPost(commentId, postId) {
    if (!confirm('Are you sure you want to delete this comment?')) {
        return;
    }

    if (AppState.isLoading || !AppState.currentUser) {
        return;
    }

    const token = localStorage.getItem('authToken');

    try {
        AppState.isLoading = true;

        const response = await fetch(`${API_URL}/comments/${commentId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (response.ok) {
            // Remove comment from all posts
            const posts = AppState.postsQueue.toArray();
            posts.forEach(post => {
                const commentIndex = post.comments.findIndex(c => c.id === commentId);
                if (commentIndex > -1) {
                    post.comments.splice(commentIndex, 1);
                }
            });

            renderFeed();

            AppState.historyStack.push({
                action: 'delete_comment',
                commentId: commentId,
                timestamp: new Date()
            });
        } else {
            alert(result.message || 'Failed to delete comment');
        }
    } catch (error) {
        console.error('Error deleting comment:', error);
        alert('Failed to delete comment. Please try again.');
    } finally {
        AppState.isLoading = false;
    }
}

function showPostOptions(postId) {
    const confirmDelete = confirm('Do you want to edit or delete this post?\n\nOK = Edit\nCancel = Delete');

    if (confirmDelete) {
        editPost(postId);
    } else {
        deletePost(postId);
    }
}

function editPost(postId) {
    const posts = AppState.postsQueue.toArray();
    const post = posts.find(p => p.id === postId);

    if (!post) return;

    AppState.selectedPost = post;
    document.getElementById('editPostContent').value = post.content;
    document.getElementById('editPostModal').classList.add('active');
}

async function handleEditPost(e) {
    e.preventDefault();

    if (!AppState.selectedPost || AppState.isLoading) return;

    const newContent = document.getElementById('editPostContent').value.trim();

    if (!newContent) return;

    try {
        AppState.isLoading = true;
        const oldContent = AppState.selectedPost.content;

        // Update in database
        await Database.updatePost(AppState.selectedPost.id, newContent);

        AppState.selectedPost.content = newContent;

        AppState.historyStack.push({
            action: 'edit_post',
            postId: AppState.selectedPost.id,
            oldContent: oldContent,
            newContent: newContent,
            timestamp: new Date()
        });

        closeModals();
        renderFeed();
    } catch (error) {
        console.error('Error editing post:', error);
        alert('Failed to edit post. Please try again.');
    } finally {
        AppState.isLoading = false;
    }
}

async function deletePost(postId) {
    if (AppState.isLoading) return;

    const posts = AppState.postsQueue.toArray();
    const postIndex = posts.findIndex(p => p.id === postId);

    if (postIndex === -1) return;

    try {
        AppState.isLoading = true;
        const deletedPost = posts[postIndex];

        // Delete from database
        await Database.deletePost(postId);

        posts.splice(postIndex, 1);

        // Rebuild queue
        AppState.postsQueue.clear();
        posts.forEach(post => AppState.postsQueue.enqueue(post));

        AppState.historyStack.push({
            action: 'delete_post',
            post: deletedPost,
            timestamp: new Date()
        });

        renderFeed();
        updateStatistics();
    } catch (error) {
        console.error('Error deleting post:', error);
        alert('Failed to delete post. Please try again.');
    } finally {
        AppState.isLoading = false;
    }
}

// Comment functionality is now handled by likes-comments.js
// Comments are shown inline below each post

function renderComments() {
    if (!AppState.selectedPost) return;

    const commentsList = document.getElementById('commentsList');

    if (AppState.selectedPost.comments.length === 0) {
        commentsList.innerHTML = '<p style="color: #94a3b8; text-align: center; padding: 1rem;">No comments yet.</p>';
        return;
    }

    commentsList.innerHTML = AppState.selectedPost.comments.map(comment => `
        <div class="comment-item">
            <div class="comment-author">${comment.author}</div>
            <div class="comment-text">${comment.text}</div>
        </div>
    `).join('');
}

async function handleAddComment(e) {
    e.preventDefault();

    if (!AppState.selectedPost || AppState.isLoading) return;

    const commentText = document.getElementById('commentInput').value.trim();

    if (!commentText) return;

    try {
        AppState.isLoading = true;

        // Add comment to database
        const dbComment = await Database.addComment(
            AppState.selectedPost.id,
            AppState.currentUser.id,
            commentText
        );

        const newComment = {
            id: dbComment.id,
            author: AppState.currentUser.name,
            text: commentText
        };

        AppState.selectedPost.comments.push(newComment);

        AppState.historyStack.push({
            action: 'add_comment',
            postId: AppState.selectedPost.id,
            commentId: newComment.id,
            timestamp: new Date()
        });

        document.getElementById('commentInput').value = '';
        renderComments();
        renderFeed();
    } catch (error) {
        console.error('Error adding comment:', error);
        alert('Failed to add comment. Please try again.');
    } finally {
        AppState.isLoading = false;
    }
}

function sortPosts(posts, sortBy) {
    switch (sortBy) {
        case 'newest':
            return posts.sort((a, b) => b.timestamp - a.timestamp);
        case 'oldest':
            return posts.sort((a, b) => a.timestamp - b.timestamp);
        case 'mostLiked':
            return posts.sort((a, b) => b.likes - a.likes);
        default:
            return posts;
    }
}

function filterAndSortPosts() {
    renderFeed();
}

// ========== PROFILE MANAGEMENT ==========

function showProfileEdit() {
    document.getElementById('profileView').style.display = 'none';
    document.getElementById('profileEditForm').style.display = 'block';

    document.getElementById('editName').value = AppState.currentUser.name;
    document.getElementById('editEmail').value = AppState.currentUser.email;
    document.getElementById('editBio').value = AppState.currentUser.bio;
}

function hideProfileEdit() {
    document.getElementById('profileView').style.display = 'flex';
    document.getElementById('profileEditForm').style.display = 'none';
}

async function handleProfileSave(e) {
    e.preventDefault();

    if (AppState.isLoading) return;

    try {
        AppState.isLoading = true;
        const oldProfile = { ...AppState.currentUser };

        const updates = {
            name: document.getElementById('editName').value,
            email: document.getElementById('editEmail').value,
            bio: document.getElementById('editBio').value
        };

        // Update in database
        const updatedUser = await Database.updateUser(AppState.currentUser.id, updates);

        AppState.currentUser = updatedUser;

        document.getElementById('currentUserName').textContent = updatedUser.name;
        document.getElementById('profileName').textContent = updatedUser.name;
        document.getElementById('profileEmail').textContent = updatedUser.email;
        document.getElementById('profileBio').textContent = updatedUser.bio;
        document.getElementById('avatarInitials').textContent = updatedUser.initials;

        AppState.historyStack.push({
            action: 'edit_profile',
            oldProfile: oldProfile,
            newProfile: { ...updatedUser },
            timestamp: new Date()
        });

        hideProfileEdit();
    } catch (error) {
        console.error('Error saving profile:', error);
        alert('Failed to save profile. Please try again.');
    } finally {
        AppState.isLoading = false;
    }
}

// ========== FRIENDS MANAGEMENT (Linked List) ==========

// Store pending requests globally
let pendingFriendRequests = [];

function showAddFriendForm() {
    document.getElementById('addFriendForm').style.display = 'block';
    document.getElementById('friendRequestMessage').style.display = 'none';
}

function hideAddFriendForm() {
    document.getElementById('addFriendForm').style.display = 'none';
    document.getElementById('friendEmail').value = '';
    document.getElementById('friendRequestMessage').style.display = 'none';
}

/**
 * Show message in friend request form
 */
function showFriendRequestMessage(message, type) {
    const messageEl = document.getElementById('friendRequestMessage');
    messageEl.textContent = message;
    messageEl.className = `form-message ${type}`;
    messageEl.style.display = 'block';
}

/**
 * Send friend request with validation
 */
async function handleAddFriend(e) {
    e.preventDefault();
    
    if (AppState.isLoading) return;
    
    const friendEmail = document.getElementById('friendEmail').value.trim();
    
    // Validate input
    if (!friendEmail) {
        showFriendRequestMessage('Please enter an email address', 'error');
        return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(friendEmail)) {
        showFriendRequestMessage('Please enter a valid email address', 'error');
        return;
    }
    
    try {
        AppState.isLoading = true;
        
        const token = localStorage.getItem('authToken');
        
        const response = await fetch(`${API_URL}/friend-request/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ friendEmail })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showFriendRequestMessage(data.message, 'success');
            document.getElementById('friendEmail').value = '';
            
            // Hide form after success
            setTimeout(() => {
                hideAddFriendForm();
            }, 2000);
        } else {
            showFriendRequestMessage(data.message, 'error');
        }
        
    } catch (error) {
        console.error('Error sending friend request:', error);
        showFriendRequestMessage('Failed to send friend request. Please try again.', 'error');
    } finally {
        AppState.isLoading = false;
    }
}

/**
 * Load and render pending friend requests
 */
async function loadPendingFriendRequests() {
    const token = localStorage.getItem('authToken');

    if (!token) return;

    try {
        const response = await fetch(`${API_URL}/friend-request/pending`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (response.ok) {
            pendingFriendRequests = result.data.requests;
            renderPendingRequests();
        }

    } catch (error) {
        console.error('Error loading pending requests:', error);
    }
}

/**
 * Render pending friend requests
 */
function renderPendingRequests() {
    const container = document.getElementById('pendingRequestsList');
    const emptyState = document.getElementById('emptyPendingRequests');
    const badge = document.getElementById('pendingRequestsCount');

    badge.textContent = pendingFriendRequests.length;

    if (pendingFriendRequests.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    container.innerHTML = pendingFriendRequests.map(req => `
        <div class="pending-request-item" data-request-id="${req.id}">
            <div class="request-info">
                <div class="friend-avatar">${req.sender_initials}</div>
                <div class="request-details">
                    <h4>${req.sender_name}</h4>
                    <p>${req.sender_email}</p>
                    <span class="request-time">Sent ${getTimeAgo(new Date(req.received_at))}</span>
                </div>
            </div>
            <div class="request-actions">
                <button class="btn-accept" onclick="acceptFriendRequest('${req.id}', '${req.sender_id}', '${req.sender_name}', '${req.sender_email}', '${req.sender_initials}')">✓ Accept</button>
                <button class="btn-reject" onclick="rejectFriendRequest('${req.id}')">✗ Reject</button>
            </div>
        </div>
    `).join('');
}

/**
 * Accept friend request with optimistic UI update
 */
async function acceptFriendRequest(requestId, senderId, senderName, senderEmail, senderInitials) {
    if (AppState.isLoading) return;

    // OPTIMISTIC UPDATE: Remove from pending list immediately
    const requestElement = document.querySelector(`[data-request-id="${requestId}"]`);
    if (requestElement) {
        requestElement.style.transition = 'opacity 0.3s';
        requestElement.style.opacity = '0';

        setTimeout(() => {
            // Remove from array
            pendingFriendRequests = pendingFriendRequests.filter(req => req.id !== requestId);
            renderPendingRequests();

            // Add to friends list immediately
            const newFriend = {
                id: requestId,
                friendId: senderId,
                name: senderName,
                email: senderEmail,
                initials: senderInitials,
                addedDate: new Date()
            };

            AppState.friendsList.add(newFriend);
            renderFriends();
            updateStatistics();

            // Show success toast
            showToast(`✓ ${senderName} is now your friend!`, 'success');
        }, 300);
    }

    // Send request to backend in background
    try {
        AppState.isLoading = true;
        const token = localStorage.getItem('authToken');

        const response = await fetch(`${API_URL}/friend-request/accept`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ request_id: requestId })
        });

        const result = await response.json();

        if (!response.ok) {
            // Request failed - need to revert UI changes
            console.error('Accept failed:', result.message);
            
            // Reload both lists to restore correct state
            await loadPendingFriendRequests();
            await loadDataFromDatabase();
            
            alert(result.message || 'Failed to accept friend request');
        }

    } catch (error) {
        console.error('Error accepting friend request:', error);
        // Reload to restore correct state
        await loadPendingFriendRequests();
        await loadDataFromDatabase();
        alert('Failed to accept friend request. Please try again.');
    } finally {
        AppState.isLoading = false;
    }
}

/**
 * Reject friend request with optimistic UI update
 */
async function rejectFriendRequest(requestId) {
    if (!confirm('Are you sure you want to reject this friend request?')) {
        return;
    }

    if (AppState.isLoading) return;

    // OPTIMISTIC UPDATE: Remove from DOM immediately
    const requestElement = document.querySelector(`[data-request-id="${requestId}"]`);
    if (requestElement) {
        requestElement.style.transition = 'opacity 0.3s';
        requestElement.style.opacity = '0';

        setTimeout(() => {
            pendingFriendRequests = pendingFriendRequests.filter(req => req.id !== requestId);
            renderPendingRequests();
        }, 300);
    }

    // Send delete request to backend in background
    try {
        AppState.isLoading = true;
        const token = localStorage.getItem('authToken');

        const response = await fetch(`${API_URL}/friend-request/reject/${requestId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (!response.ok) {
            // Request failed - restore the request
            console.error('Reject failed:', result.message);
            await loadPendingFriendRequests();
            alert(result.message || 'Failed to reject friend request');
        }

    } catch (error) {
        console.error('Error rejecting friend request:', error);
        // Reload to restore correct state
        await loadPendingFriendRequests();
        alert('Failed to reject friend request. Please try again.');
    } finally {
        AppState.isLoading = false;
    }
}

function renderFriends() {
    const friendsContainer = document.getElementById('friendsList');
    const emptyState = document.getElementById('emptyFriends');

    let friends = AppState.friendsList.toArray();

    // Apply search filter
    const searchTerm = document.getElementById('searchFriends').value.toLowerCase();
    if (searchTerm) {
        friends = friends.filter(friend =>
            friend.name.toLowerCase().includes(searchTerm) ||
            friend.email.toLowerCase().includes(searchTerm)
        );
    }

    // Apply sorting
    const sortBy = document.getElementById('sortFriends').value;
    friends = sortFriends(friends, sortBy);

    if (friends.length === 0) {
        friendsContainer.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    friendsContainer.innerHTML = friends.map(friend => `
        <div class="friend-item">
            <div class="friend-info">
                <div class="friend-avatar">${friend.initials}</div>
                <div class="friend-details">
                    <h4>${friend.name}</h4>
                    <p>${friend.email}</p>
                </div>
            </div>
            <div class="friend-actions">
                <button onclick="removeFriend('${friend.id}')">Remove</button>
            </div>
        </div>
    `).join('');
}

async function removeFriend(friendshipId) {
    console.log('🔵 removeFriend called with ID:', friendshipId);
    console.log('🔵 Type of friendshipId:', typeof friendshipId);
    console.log('🔵 All friends in linked list:', AppState.friendsList.toArray());
    
    if (!confirm('Are you sure you want to remove this friend?')) {
        console.log('User cancelled friend removal');
        return;
    }

    if (AppState.isLoading) {
        console.log('Already loading, returning');
        return;
    }

    // Convert friendshipId to number if it's a string
    const numericId = typeof friendshipId === 'string' ? parseInt(friendshipId) : friendshipId;
    console.log('🔵 Searching for numeric ID:', numericId);

    const friend = AppState.friendsList.find(numericId);
    console.log('Found friend:', friend);

    if (!friend) {
        console.error('Friend not found with ID:', numericId);
        console.error('Available IDs in list:', AppState.friendsList.toArray().map(f => ({ id: f.id, type: typeof f.id })));
        alert('Friend not found');
        return;
    }

    try {
        AppState.isLoading = true;
        console.log('Calling Database.removeFriend...');

        // Remove from database
        await Database.removeFriend(numericId);
        console.log('Database removal successful');

        AppState.friendsList.remove(numericId);
        console.log('Removed from linked list');

        AppState.historyStack.push({
            action: 'remove_friend',
            friend: friend,
            timestamp: new Date()
        });

        renderFriends();
        updateStatistics();
        console.log('✅ Friend removed successfully');
    } catch (error) {
        console.error('Error removing friend:', error);
        alert('Failed to remove friend. Please try again.');
    } finally {
        AppState.isLoading = false;
    }
}

function sortFriends(friends, sortBy) {
    switch (sortBy) {
        case 'name-asc':
            return friends.sort((a, b) => a.name.localeCompare(b.name));
        case 'name-desc':
            return friends.sort((a, b) => b.name.localeCompare(a.name));
        case 'newest':
            return friends.sort((a, b) => b.addedDate - a.addedDate);
        default:
            return friends;
    }
}

function filterAndSortFriends() {
    renderFriends();
}

// ========== HISTORY (Stack) ==========

function renderHistory() {
    const historyContainer = document.getElementById('historyList');
    const emptyState = document.getElementById('emptyHistory');

    const history = AppState.historyStack.toArray().reverse();

    if (history.length === 0) {
        historyContainer.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    historyContainer.innerHTML = history.map(item => `
        <div class="history-item">
            <span class="history-action">${formatHistoryAction(item.action)}</span>
            <span class="history-time">${getTimeAgo(item.timestamp)}</span>
        </div>
    `).join('');
}

function formatHistoryAction(action) {
    const actionMap = {
        'navigate': 'Navigated to page',
        'create_post': 'Created a post',
        'edit_post': 'Edited a post',
        'delete_post': 'Deleted a post',
        'like_post': 'Liked a post',
        'unlike_post': 'Unliked a post',
        'add_comment': 'Added a comment',
        'edit_profile': 'Updated profile',
        'add_friend': 'Added a friend',
        'remove_friend': 'Removed a friend'
    };
    return actionMap[action] || action;
}

function clearHistory() {
    if (confirm('Are you sure you want to clear all browsing history?')) {
        AppState.historyStack.clear();
        renderHistory();
    }
}

async function performUndo() {
    if (AppState.isLoading) return;

    const lastAction = AppState.historyStack.pop();

    if (!lastAction) {
        alert('No actions to undo!');
        return;
    }

    try {
        AppState.isLoading = true;

        switch (lastAction.action) {
            case 'create_post':
                await undoCreatePost(lastAction.postId);
                break;
            case 'delete_post':
                await undoDeletePost(lastAction.post);
                break;
            case 'like_post':
                await toggleLike(lastAction.postId);
                break;
            case 'unlike_post':
                await toggleLike(lastAction.postId);
                break;
            case 'edit_post':
                await undoEditPost(lastAction.postId, lastAction.oldContent);
                break;
            case 'add_friend':
                await Database.removeFriend(lastAction.friendId);
                AppState.friendsList.remove(lastAction.friendId);
                renderFriends();
                updateStatistics();
                break;
            case 'remove_friend':
                const restored = await Database.addFriend(AppState.currentUser.id, lastAction.friend.friendId);
                AppState.friendsList.add(lastAction.friend);
                renderFriends();
                updateStatistics();
                break;
            case 'edit_profile':
                await Database.updateUser(AppState.currentUser.id, lastAction.oldProfile);
                AppState.currentUser = lastAction.oldProfile;
                initializeApp();
                break;
            default:
                alert('Cannot undo this action');
        }

        renderCurrentPage();
    } catch (error) {
        console.error('Error undoing action:', error);
        alert('Failed to undo action.');
    } finally {
        AppState.isLoading = false;
    }
}

async function undoCreatePost(postId) {
    await Database.deletePost(postId);
    const posts = AppState.postsQueue.toArray();
    const filteredPosts = posts.filter(p => p.id !== postId);

    AppState.postsQueue.clear();
    filteredPosts.forEach(post => AppState.postsQueue.enqueue(post));

    renderFeed();
    updateStatistics();
}

async function undoDeletePost(post) {
    // Note: We can't truly restore a deleted post from database
    // In a real app, you'd implement soft deletes
    alert('Cannot restore deleted post (not implemented in database)');
}

async function undoEditPost(postId, oldContent) {
    await Database.updatePost(postId, oldContent);
    const posts = AppState.postsQueue.toArray();
    const post = posts.find(p => p.id === postId);

    if (post) {
        post.content = oldContent;
        renderFeed();
    }
}

// ========== AUTHENTICATION ==========

// ========== AUTHENTICATION ==========

// API Base URL
const API_URL = 'http://localhost:3003/api';

async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        showAuthMessage('Please enter your email and password', 'error');
        return;
    }

    try {
        // Call login API endpoint
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const result = await response.json();

        if (!response.ok) {
            showAuthMessage(result.message || 'Login failed', 'error');
            return;
        }

        // Store JWT token in localStorage
        localStorage.setItem('authToken', result.data.token);

        // Set current user
        AppState.currentUser = {
            id: result.data.user.id,
            name: result.data.user.name,
            email: result.data.user.email,
            bio: result.data.user.bio || '',
            initials: result.data.user.initials
        };

        // Hide auth screen, show main app
        document.getElementById('authScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'flex';

        // Initialize the app
        await initializeApp();

        // Render the current page
        renderCurrentPage();

    } catch (error) {
        console.error('Login error:', error);
        showAuthMessage('Login failed. Please check your connection and try again.', 'error');
    }
}

async function handleSignup(e) {
    e.preventDefault();

    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const bio = document.getElementById('signupBio').value.trim();

    if (!name || !email || !password) {
        showAuthMessage('Please enter your name, email, and password', 'error');
        return;
    }

    if (password.length < 6) {
        showAuthMessage('Password must be at least 6 characters long', 'error');
        return;
    }

    try {
        // Call signup API endpoint
        const response = await fetch(`${API_URL}/auth/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, password, bio })
        });

        const result = await response.json();

        if (!response.ok) {
            showAuthMessage(result.message || 'Signup failed', 'error');
            return;
        }

        // Store JWT token in localStorage
        localStorage.setItem('authToken', result.data.token);

        // Set current user
        AppState.currentUser = {
            id: result.data.user.id,
            name: result.data.user.name,
            email: result.data.user.email,
            bio: result.data.user.bio || '',
            initials: result.data.user.initials
        };

        // Hide auth screen, show main app
        document.getElementById('authScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'flex';

        // Initialize the app
        await initializeApp();

        // Render the current page
        renderCurrentPage();

    } catch (error) {
        console.error('Signup error:', error);
        showAuthMessage('Signup failed. Please check your connection and try again.', 'error');
    }
}

function showAuthMessage(message, type) {
    const messageDiv = document.getElementById('authMessage');
    messageDiv.textContent = message;
    messageDiv.className = `auth-message ${type}`;
    messageDiv.style.display = 'block';

    // Auto-hide after 5 seconds
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 5000);
}

function setupAuthListeners() {
    // Login form
    document.getElementById('loginFormElement').addEventListener('submit', handleLogin);

    // Signup form
    document.getElementById('signupFormElement').addEventListener('submit', handleSignup);

    // Toggle between login and signup
    document.getElementById('showSignup').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('loginForm').classList.remove('active');
        document.getElementById('signupForm').classList.add('active');
        document.getElementById('authMessage').style.display = 'none';
    });

    document.getElementById('showLogin').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('signupForm').classList.remove('active');
        document.getElementById('loginForm').classList.add('active');
        document.getElementById('authMessage').style.display = 'none';
    });

    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', () => {
        // Show logout confirmation modal
        const modal = document.getElementById('logoutConfirmModal');
        if (modal) {
            modal.classList.add('active');
        }
    });
}

/**
 * Confirm logout (called by modal button)
 */
function confirmLogout() {
    // Hide the modal
    const modal = document.getElementById('logoutConfirmModal');
    if (modal) {
        modal.classList.remove('active');
    }
    
    // Clear user state
    AppState.currentUser = null;

    // Remove token from localStorage
    localStorage.removeItem('authToken');

    // Show auth screen, hide main app
    document.getElementById('authScreen').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';

    // Clear forms
    document.getElementById('loginFormElement').reset();
    document.getElementById('signupFormElement').reset();
    document.getElementById('authMessage').style.display = 'none';
}

/**
 * Cancel logout (called by modal button)
 */
function cancelLogout() {
    const modal = document.getElementById('logoutConfirmModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Check if user is already logged in (has valid token)
async function checkExistingAuth() {
    const token = localStorage.getItem('authToken');

    if (!token) {
        return false;
    }

    try {
        // Verify token with server
        const response = await fetch(`${API_URL}/auth/verify`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            // Token is invalid, remove it
            localStorage.removeItem('authToken');
            return false;
        }

        const result = await response.json();

        // Set current user from token verification
        AppState.currentUser = {
            id: result.data.user.id,
            name: result.data.user.name,
            email: result.data.user.email,
            bio: result.data.user.bio || '',
            initials: result.data.user.initials
        };

        // Hide auth screen, show main app
        document.getElementById('authScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'flex';

        // Initialize the app
        await initializeApp();

        // Render the current page
        renderCurrentPage();

        return true;

    } catch (error) {
        console.error('Auth check error:', error);
        localStorage.removeItem('authToken');
        return false;
    }
}

// ========== MY POSTS MANAGEMENT ==========

/**
 * Load and display user's posts from API
 */
async function loadMyPosts() {
    console.log('=== loadMyPosts() called ===');
    const token = localStorage.getItem('authToken');

    if (!token) {
        console.error('No auth token found');
        return;
    }

    console.log('Auth token found, fetching posts from:', `${API_URL}/posts/my-posts`);

    try {
        const response = await fetch(`${API_URL}/posts/my-posts`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('Response status:', response.status);
        const result = await response.json();
        console.log('Response data:', result);

        if (!response.ok) {
            console.error('Failed to load my posts:', result.message);
            return;
        }

        console.log('Posts to render:', result.data.posts);

        // Display posts
        renderMyPosts(result.data.posts);

    } catch (error) {
        console.error('Error loading my posts:', error);
    }
}

/**
 * Render my posts in the UI
 */
function renderMyPosts(posts) {
    console.log('=== renderMyPosts() called with:', posts);
    const container = document.getElementById('myPostsList');
    const emptyState = document.getElementById('myPostsEmpty');

    console.log('Container element:', container);
    console.log('Empty state element:', emptyState);

    if (!posts || posts.length === 0) {
        console.log('No posts to render, showing empty state');
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    console.log(`Rendering ${posts.length} posts`);
    emptyState.style.display = 'none';

    container.innerHTML = posts.map(post => {
        const initials = post.author_name ? post.author_name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U';
        const comments = post.comments || [];
        const isLiked = post.liked_by ? post.liked_by.includes(AppState.currentUser.id) : false;
        return `
        <div class="post-item" data-post-id="${post.post_id}">
            <div class="post-header">
                <div class="post-author">
                    <div class="author-avatar">${initials}</div>
                    <div class="author-info">
                        <h4>${post.author_name || 'Unknown'}</h4>
                        <span class="post-time">${getTimeAgo(new Date(post.timestamp))}</span>
                    </div>
                </div>
                <div class="post-actions-menu">
                    <button class="btn-edit-post" onclick="editMyPost('${post.post_id}')">✏️ Edit</button>
                    <button class="btn-delete-post" onclick="deleteMyPost('${post.post_id}')">🗑️ Delete</button>
                </div>
            </div>
            
            <div class="post-content" id="content-${post.post_id}">
                ${post.content}
            </div>
            
            <div class="my-post-edit-form" id="edit-form-${post.post_id}">
                <textarea id="edit-textarea-${post.post_id}">${post.content}</textarea>
                <div class="my-post-edit-actions">
                    <button class="btn-primary" onclick="savePostEdit('${post.post_id}')">💾 Save</button>
                    <button class="btn-secondary" onclick="cancelPostEdit('${post.post_id}')">✖ Cancel</button>
                </div>
            </div>
            
            <div class="post-footer">
                <div class="post-actions">
                    <button class="like-btn ${isLiked ? 'liked' : ''}" onclick="toggleLike('${post.post_id}')">
                        ${isLiked ? '❤️ Liked' : '🤍 Like'}
                    </button>
                    <span class="like-count">${post.likes_count}</span>
                </div>
            </div>
            
            <div class="comments-section">
                <div class="add-comment-form">
                    <input type="text" class="comment-input" placeholder="Write a comment..." data-post-id="${post.post_id}">
                    <button onclick="handleAddCommentClick('${post.post_id}')">Post</button>
                </div>
                <div class="comments-count-display">
                    <span class="comment-count">${comments.length}</span> comment${comments.length !== 1 ? 's' : ''}
                </div>
                <div class="comments-list">
                    ${comments.map(comment => createCommentHTML(comment)).join('')}
                </div>
            </div>
        </div>
    `;
    }).join('');
}

/**
 * Enter edit mode for a post
 */
function editMyPost(postId) {
    console.log('=== editMyPost() called with postId:', postId);
    const contentDiv = document.getElementById(`content-${postId}`);
    const editForm = document.getElementById(`edit-form-${postId}`);

    console.log('Content div:', contentDiv);
    console.log('Edit form:', editForm);

    if (contentDiv && editForm) {
        contentDiv.classList.add('editing');
        editForm.classList.add('active');
        console.log('Edit mode activated for post:', postId);
    } else {
        console.error('Could not find elements for post:', postId);
    }
}

/**
 * Cancel editing a post
 */
function cancelPostEdit(postId) {
    const contentDiv = document.getElementById(`content-${postId}`);
    const editForm = document.getElementById(`edit-form-${postId}`);
    const textarea = document.getElementById(`edit-textarea-${postId}`);

    if (contentDiv && editForm && textarea) {
        // Restore original content
        const originalContent = contentDiv.textContent.trim();
        textarea.value = originalContent;

        contentDiv.classList.remove('editing');
        editForm.classList.remove('active');
    }
}

/**
 * Save post edit
 */
async function savePostEdit(postId) {
    const textarea = document.getElementById(`edit-textarea-${postId}`);
    const newContent = textarea.value.trim();

    if (!newContent) {
        alert('Post content cannot be empty');
        return;
    }

    const token = localStorage.getItem('authToken');

    try {
        const response = await fetch(`${API_URL}/posts/edit`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                post_id: postId,
                content: newContent
            })
        });

        const result = await response.json();

        if (!response.ok) {
            alert(result.message || 'Failed to edit post');
            return;
        }

        // Update UI
        const contentDiv = document.getElementById(`content-${postId}`);
        const editForm = document.getElementById(`edit-form-${postId}`);

        if (contentDiv && editForm) {
            contentDiv.textContent = newContent;
            contentDiv.classList.remove('editing');
            editForm.classList.remove('active');
        }

        // Show toast notification with undo option
        showToast('✓ Post updated successfully', 'success', { type: 'edit', postId });

    } catch (error) {
        console.error('Error editing post:', error);
        alert('Failed to edit post. Please try again.');
    }
}

/**
 * Delete a post
 */
let pendingDeletePostId = null;

async function deleteMyPost(postId) {
    console.log('=== deleteMyPost() called with postId:', postId);
    
    // Store the post ID and show custom modal
    pendingDeletePostId = postId;
    const modal = document.getElementById('deleteConfirmModal');
    if (modal) {
        modal.classList.add('active');
    }
}

/**
 * Confirm delete post (called by modal button)
 */
async function confirmDeletePost() {
    const postId = pendingDeletePostId;
    if (!postId) return;
    
    // Hide the modal
    const modal = document.getElementById('deleteConfirmModal');
    if (modal) {
        modal.classList.remove('active');
    }
    
    const token = localStorage.getItem('authToken');

    // OPTIMISTIC UI UPDATE: Remove from UI IMMEDIATELY
    const postElement = document.querySelector(`[data-post-id="${postId}"]`);
    console.log('Post element found:', postElement);
    
    if (!postElement) {
        console.error('Could not find post element with data-post-id:', postId);
        pendingDeletePostId = null;
        return;
    }
    
    // Store the post element HTML in case we need to restore it
    const postBackup = postElement.outerHTML;
    
    // Immediately fade out and remove
    postElement.style.transition = 'opacity 0.3s';
    postElement.style.opacity = '0';
    
    setTimeout(() => {
        postElement.remove();
        console.log('Post removed from DOM (optimistic)');
        
        // Check if list is empty and show empty state
        const container = document.getElementById('myPostsList');
        const emptyState = document.getElementById('myPostsEmpty');
        
        if (container && container.children.length === 0 && emptyState) {
            console.log('Showing empty state');
            emptyState.style.display = 'block';
        }
    }, 300);

    console.log('Sending delete request for post:', postId);

    // Now send the delete request in the background
    try {
        const response = await fetch(`${API_URL}/posts/delete`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ post_id: postId })
        });

        const result = await response.json();
        console.log('Delete response:', result);

        if (!response.ok) {
            // Delete failed - restore the post to UI
            console.error('Delete failed, restoring post to UI');
            const container = document.getElementById('myPostsList');
            const emptyState = document.getElementById('myPostsEmpty');
            
            if (container && emptyState) {
                emptyState.style.display = 'none';
                container.insertAdjacentHTML('afterbegin', postBackup);
            }
            
            showToast('❌ Failed to delete post', 'error');
            pendingDeletePostId = null;
            return;
        }
        
        console.log('Delete successful in backend');
        
        // Show toast notification with undo option
        showToast('🗑️ Post deleted successfully', 'success', { type: 'delete', postId });
        pendingDeletePostId = null;
    } catch (error) {
        console.error('Error deleting post:', error);
        showToast('❌ Failed to delete post', 'error');
        pendingDeletePostId = null;
    }
}

/**
 * Cancel delete post (called by modal button)
 */
function cancelDeletePost() {
    const modal = document.getElementById('deleteConfirmModal');
    if (modal) {
        modal.classList.remove('active');
    }
    pendingDeletePostId = null;
}

/**
 * Helper function to handle adding a comment from input
 */
function handleAddCommentClick(postId) {
    const input = document.querySelector(`[data-post-id="${postId}"] .comment-input`);
    const text = input.value.trim();
    
    if (text) {
        addCommentToPost(postId, text);
        input.value = ''; // Clear input after adding
    }
}

// createCommentHTML is now in likes-comments.js (has better formatting with edit/delete buttons)

// Make functions globally accessible
window.editMyPost = editMyPost;
window.cancelPostEdit = cancelPostEdit;
window.savePostEdit = savePostEdit;
window.deleteMyPost = deleteMyPost;
window.confirmDeletePost = confirmDeletePost;
window.cancelDeletePost = cancelDeletePost;
window.confirmLogout = confirmLogout;
window.cancelLogout = cancelLogout;
window.handleAddCommentClick = handleAddCommentClick;
window.toggleLike = toggleLike;
window.deleteCommentFromPost = deleteCommentFromPost;
window.acceptFriendRequest = acceptFriendRequest;
window.rejectFriendRequest = rejectFriendRequest;
window.removeFriend = removeFriend;

// ========== TOAST NOTIFICATION SYSTEM ==========

let toastTimeout;
let currentUndoAction = null;

/**
 * Show toast notification with undo button
 */
function showToast(message, actionType = 'success', undoData = null) {
    const toast = document.getElementById('undoToast');
    const messageEl = document.getElementById('toastMessage');
    const undoBtn = document.getElementById('toastUndoBtn');

    if (!toast || !messageEl || !undoBtn) {
        console.error('Toast elements not found');
        return;
    }

    // Clear any existing timeout
    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }
    
    // Hide current toast if showing to prevent duplicates
    if (toast.classList.contains('show')) {
        toast.classList.remove('show');
    }

    // Set message and action data
    messageEl.textContent = message;
    currentUndoAction = undoData;

    // Show/hide undo button based on whether undo data exists
    if (undoData) {
        undoBtn.style.display = 'block';
    } else {
        undoBtn.style.display = 'none';
    }

    // Apply action type class
    toast.className = `undo-toast ${actionType}`;
    toast.style.display = 'block';

    // Trigger animation
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // Auto-hide after 5 seconds
    toastTimeout = setTimeout(() => {
        hideToast();
    }, 5000);
}

/**
 * Hide toast notification
 */
function hideToast() {
    const toast = document.getElementById('undoToast');

    if (!toast) return;

    toast.classList.remove('show');
    toast.classList.add('hide');

    setTimeout(() => {
        toast.style.display = 'none';
        toast.classList.remove('hide');
        currentUndoAction = null;
    }, 300);

    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }
}

/**
 * Handle undo action from toast
 */
async function handleToastUndo() {
    if (!currentUndoAction) {
        console.error('No undo action available');
        return;
    }

    hideToast();

    const token = localStorage.getItem('authToken');

    if (!token) {
        alert('Not authenticated');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/posts/undo`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (!response.ok) {
            alert(result.message || 'Failed to undo action');
            return;
        }

        // Handle the undo based on action type
        if (result.data.action === 'UNDO_EDIT') {
            // Refresh the post content
            const contentDiv = document.getElementById(`content-${result.data.post.post_id}`);
            if (contentDiv) {
                contentDiv.textContent = result.data.post.content;
            }
            showToast('✓ Edit undone successfully', 'success');
        } else if (result.data.action === 'UNDO_DELETE') {
            // Re-add the post to the UI
            const container = document.getElementById('myPostsList');
            const emptyState = document.getElementById('myPostsEmpty');

            if (container && emptyState) {
                // Check if post already exists (prevent duplicates)
                const existingPost = container.querySelector(`[data-post-id="${result.data.post.post_id}"]`);
                if (existingPost) {
                    console.log('Post already exists in UI, skipping re-add');
                    showToast('✓ Post already visible', 'success');
                    return;
                }

                emptyState.style.display = 'none';

                // Create post HTML
                const initials = result.data.post.author_name ? result.data.post.author_name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U';
                const postHTML = `
                    <div class="post-item" data-post-id="${result.data.post.post_id}" style="opacity: 0;">
                        <div class="post-header">
                            <div class="post-author">
                                <div class="author-avatar">${initials}</div>
                                <div class="author-info">
                                    <h4>${result.data.post.author_name || 'Unknown'}</h4>
                                    <span class="post-time">${getTimeAgo(new Date(result.data.post.timestamp))}</span>
                                </div>
                            </div>
                            <div class="post-actions-menu">
                                <button class="btn-edit-post" onclick="editMyPost('${result.data.post.post_id}')">✏️ Edit</button>
                                <button class="btn-delete-post" onclick="deleteMyPost('${result.data.post.post_id}')">🗑️ Delete</button>
                            </div>
                        </div>
                        
                        <div class="post-content" id="content-${result.data.post.post_id}">
                            ${result.data.post.content}
                        </div>
                        
                        <div class="my-post-edit-form" id="edit-form-${result.data.post.post_id}">
                            <textarea id="edit-textarea-${result.data.post.post_id}">${result.data.post.content}</textarea>
                            <div class="my-post-edit-actions">
                                <button class="btn-primary" onclick="savePostEdit('${result.data.post.post_id}')">💾 Save</button>
                                <button class="btn-secondary" onclick="cancelPostEdit('${result.data.post.post_id}')">✖ Cancel</button>
                            </div>
                        </div>
                        
                        <div class="post-footer">
                            <div class="post-actions">
                                <span class="like-count">❤️ ${result.data.post.likes_count} Likes</span>
                                <span class="like-count">💬 ${result.data.post.comments_count} Comments</span>
                            </div>
                        </div>
                    </div>
                `;

                // Add to beginning of list
                container.insertAdjacentHTML('afterbegin', postHTML);

                // Animate in
                const newPost = container.querySelector(`[data-post-id="${result.data.post.post_id}"]`);
                setTimeout(() => {
                    newPost.style.transition = 'opacity 0.3s';
                    newPost.style.opacity = '1';
                }, 10);
            }

            showToast('✓ Post restored successfully', 'success');
        }

    } catch (error) {
        console.error('Error undoing action:', error);
        alert('Failed to undo action. Please try again.');
    }
}

// ========== STATISTICS ==========

function updateStatistics() {
    const totalPosts = AppState.postsQueue.size();
    const userPosts = AppState.postsQueue.toArray().filter(p => p.authorId === AppState.currentUser.id).length;
    const totalFriends = AppState.friendsList.getSize();

    document.getElementById('totalPosts').textContent = totalPosts;
    document.getElementById('userPosts').textContent = userPosts;
    document.getElementById('totalFriends').textContent = totalFriends;
}

// ========== UTILITY FUNCTIONS ==========

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);

    if (seconds < 60) return 'Just now';

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;

    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
}

function getInitials(name) {
    return name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
}

function closeModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
    AppState.selectedPost = null;
}
