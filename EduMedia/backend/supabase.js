// ==========================================
// EduMedia - Supabase Backend Integration
// This file handles all database operations
// ==========================================

// Import required modules
require('dotenv').config(); // Load environment variables from .env file
const { createClient } = require('@supabase/supabase-js');

// ========== SUPABASE INITIALIZATION ==========

// Get Supabase credentials from environment variables
// IMPORTANT: Replace the values in .env file with your actual Supabase credentials
const supabaseUrl = process.env.SUPABASE_URL || 'your_supabase_project_url_here';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'your_supabase_anon_key_here';

// Create Supabase client instance
// This client will be used for all database operations
const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('✅ Supabase client initialized');

// ========== DATABASE SCHEMA ==========
/*
Actual Tables in Supabase:

1. users
   - id (primary key)
   - name
   - email
   - bio
   - initials
   - created_at (timestamp)

2. posts
   - id (primary key)
   - author_id (foreign key → users.id)
   - content
   - likes (integer)
   - created_at (timestamp)

3. comments
   - id (primary key)
   - post_id (foreign key → posts.id)
   - author_id (foreign key → users.id)
   - text
   - created_at (timestamp)

4. friends
   - id (primary key)
   - user_id (foreign key → users.id)
   - friend_id (foreign key → users.id)
   - added_at (timestamp)

5. likes
   - id (primary key)
   - user_id (foreign key → users.id)
   - post_id (foreign key → posts.id)
*/

// ========== USER MANAGEMENT ==========

/**
 * Get user by ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User object or null
 */
async function getUserById(userId) {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching user:', error.message);
        return null;
    }
}

/**
 * Get user by email
 * @param {string} email - User email
 * @returns {Promise<Object>} User object or null
 */
async function getUserByEmail(email) {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching user by email:', error.message);
        return null;
    }
}

/**
 * Create a new user
 * @param {Object} userData - User data {name, email, bio, initials}
 * @returns {Promise<Object>} Created user object
 */
async function createUser(userData) {
    try {
        const { data, error } = await supabase
            .from('users')
            .insert([{
                name: userData.name,
                email: userData.email,
                bio: userData.bio || '',
                initials: userData.initials || getInitials(userData.name)
            }])
            .select()
            .single();

        if (error) throw error;
        console.log('✅ User created:', data);
        return data;
    } catch (error) {
        console.error('Error creating user:', error.message);
        throw error;
    }
}

/**
 * Update user profile
 * @param {string} userId - User ID
 * @param {Object} updates - Fields to update {name, email, bio}
 * @returns {Promise<Object>} Updated user object
 */
async function updateUser(userId, updates) {
    try {
        // If name is updated, recalculate initials
        if (updates.name) {
            updates.initials = getInitials(updates.name);
        }

        const { data, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', userId)
            .select()
            .single();

        if (error) throw error;
        console.log('✅ User updated:', data);
        return data;
    } catch (error) {
        console.error('Error updating user:', error.message);
        throw error;
    }
}

// ========== POST MANAGEMENT (Queue - FIFO) ==========

/**
 * Get all posts with author details (ordered by creation date - newest first)
 * This implements Queue behavior (FIFO)
 * @returns {Promise<Array>} Array of posts with author information
 */
async function getAllPosts() {
    try {
        const { data, error } = await supabase
            .from('posts')
            .select(`
                *,
                author:users!posts_author_id_fkey(name, email, initials)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        console.log(`✅ Fetched ${data.length} posts`);
        return data;
    } catch (error) {
        console.error('Error fetching posts:', error.message);
        return [];
    }
}

/**
 * Get posts by user ID with author details
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of user's posts
 */
async function getPostsByUser(userId) {
    try {
        const { data, error } = await supabase
            .from('posts')
            .select(`
                *,
                author:users!posts_author_id_fkey(name, email, initials)
            `)
            .eq('author_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching user posts:', error.message);
        return [];
    }
}

/**
 * Create a new post
 * @param {Object} postData - Post data {author_id, content}
 * @returns {Promise<Object>} Created post object
 */
async function createPost(postData) {
    try {
        const { data, error } = await supabase
            .from('posts')
            .insert([{
                author_id: postData.author_id,
                content: postData.content,
                likes: 0
            }])
            .select()
            .single();

        if (error) throw error;
        console.log('✅ Post created:', data);
        return data;
    } catch (error) {
        console.error('Error creating post:', error.message);
        throw error;
    }
}

/**
 * Update a post
 * @param {string} postId - Post ID
 * @param {Object} updates - Fields to update {content}
 * @returns {Promise<Object>} Updated post object
 */
async function updatePost(postId, updates) {
    try {
        const { data, error } = await supabase
            .from('posts')
            .update(updates)
            .eq('id', postId)
            .select()
            .single();

        if (error) throw error;
        console.log('✅ Post updated:', data);
        return data;
    } catch (error) {
        console.error('Error updating post:', error.message);
        throw error;
    }
}

/**
 * Delete a post
 * @param {string} postId - Post ID
 * @returns {Promise<boolean>} Success status
 */
async function deletePost(postId) {
    try {
        // Delete associated comments and likes first
        await deleteCommentsByPost(postId);
        await deleteLikesByPost(postId);

        // Then delete the post
        const { error } = await supabase
            .from('posts')
            .delete()
            .eq('id', postId);

        if (error) throw error;
        console.log('✅ Post deleted:', postId);
        return true;
    } catch (error) {
        console.error('Error deleting post:', error.message);
        return false;
    }
}

// ========== LIKES MANAGEMENT ==========

/**
 * Get likes for a post
 * @param {string} postId - Post ID
 * @returns {Promise<Array>} Array of likes
 */
async function getLikesByPost(postId) {
    try {
        const { data, error } = await supabase
            .from('likes')
            .select('*')
            .eq('post_id', postId);

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching likes:', error.message);
        return [];
    }
}

/**
 * Check if user liked a post
 * @param {string} postId - Post ID
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if user liked the post
 */
async function hasUserLikedPost(postId, userId) {
    try {
        const { data, error } = await supabase
            .from('likes')
            .select('id')
            .eq('post_id', postId)
            .eq('user_id', userId)
            .single();

        return data !== null;
    } catch (error) {
        return false;
    }
}

/**
 * Add a like to a post
 * @param {string} postId - Post ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Created like object
 */
async function addLike(postId, userId) {
    try {
        // Check if already liked
        const alreadyLiked = await hasUserLikedPost(postId, userId);
        if (alreadyLiked) {
            console.log('User already liked this post');
            return null;
        }

        // Add like record
        const { data: likeData, error: likeError } = await supabase
            .from('likes')
            .insert([{ post_id: postId, user_id: userId }])
            .select()
            .single();

        if (likeError) throw likeError;

        // Increment likes count on post
        const { data: postData, error: postError } = await supabase
            .from('posts')
            .update({ likes: supabase.raw('likes + 1') })
            .eq('id', postId)
            .select()
            .single();

        if (postError) throw postError;

        console.log('✅ Like added to post:', postId);
        return likeData;
    } catch (error) {
        console.error('Error adding like:', error.message);
        throw error;
    }
}

/**
 * Remove a like from a post
 * @param {string} postId - Post ID
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} Success status
 */
async function removeLike(postId, userId) {
    try {
        // Remove like record
        const { error: likeError } = await supabase
            .from('likes')
            .delete()
            .eq('post_id', postId)
            .eq('user_id', userId);

        if (likeError) throw likeError;

        // Decrement likes count on post
        const { error: postError } = await supabase
            .from('posts')
            .update({ likes: supabase.raw('likes - 1') })
            .eq('id', postId);

        if (postError) throw postError;

        console.log('✅ Like removed from post:', postId);
        return true;
    } catch (error) {
        console.error('Error removing like:', error.message);
        return false;
    }
}

/**
 * Delete all likes for a post (used when deleting post)
 * @param {string} postId - Post ID
 * @returns {Promise<boolean>} Success status
 */
async function deleteLikesByPost(postId) {
    try {
        const { error } = await supabase
            .from('likes')
            .delete()
            .eq('post_id', postId);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error deleting likes:', error.message);
        return false;
    }
}

// ========== COMMENTS MANAGEMENT ==========

/**
 * Get comments for a post with author details
 * @param {string} postId - Post ID
 * @returns {Promise<Array>} Array of comments with author information
 */
async function getCommentsByPost(postId) {
    try {
        const { data, error } = await supabase
            .from('comments')
            .select(`
                *,
                author:users!comments_author_id_fkey(name, initials)
            `)
            .eq('post_id', postId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching comments:', error.message);
        return [];
    }
}

/**
 * Add a comment to a post
 * @param {Object} commentData - Comment data {post_id, author_id, text}
 * @returns {Promise<Object>} Created comment object
 */
async function addComment(commentData) {
    try {
        const { data, error } = await supabase
            .from('comments')
            .insert([{
                post_id: commentData.post_id,
                author_id: commentData.author_id,
                text: commentData.text
            }])
            .select()
            .single();

        if (error) throw error;
        console.log('✅ Comment added:', data);
        return data;
    } catch (error) {
        console.error('Error adding comment:', error.message);
        throw error;
    }
}

/**
 * Delete a comment
 * @param {string} commentId - Comment ID
 * @returns {Promise<boolean>} Success status
 */
async function deleteComment(commentId) {
    try {
        const { error } = await supabase
            .from('comments')
            .delete()
            .eq('id', commentId);

        if (error) throw error;
        console.log('✅ Comment deleted:', commentId);
        return true;
    } catch (error) {
        console.error('Error deleting comment:', error.message);
        return false;
    }
}

/**
 * Delete all comments for a post (used when deleting post)
 * @param {string} postId - Post ID
 * @returns {Promise<boolean>} Success status
 */
async function deleteCommentsByPost(postId) {
    try {
        const { error } = await supabase
            .from('comments')
            .delete()
            .eq('post_id', postId);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error deleting comments:', error.message);
        return false;
    }
}

// ========== FRIENDS MANAGEMENT (Linked List) ==========

/**
 * Get all friends for a user with friend details
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of friends with user information
 */
async function getFriendsByUser(userId) {
    try {
        const { data, error } = await supabase
            .from('friends')
            .select(`
                *,
                friend:users!friends_friend_id_fkey(id, name, email, initials)
            `)
            .eq('user_id', userId)
            .order('added_at', { ascending: false });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching friends:', error.message);
        return [];
    }
}

/**
 * Add a friend
 * @param {Object} friendData - Friend data {user_id, friend_id}
 * @returns {Promise<Object>} Created friend relationship
 */
async function addFriend(friendData) {
    try {
        const { data, error } = await supabase
            .from('friends')
            .insert([{
                user_id: friendData.user_id,
                friend_id: friendData.friend_id
            }])
            .select()
            .single();

        if (error) throw error;
        console.log('✅ Friend added:', data);
        return data;
    } catch (error) {
        console.error('Error adding friend:', error.message);
        throw error;
    }
}

/**
 * Remove a friend
 * @param {string} friendshipId - Friendship ID
 * @returns {Promise<boolean>} Success status
 */
async function removeFriend(friendshipId) {
    try {
        const { error } = await supabase
            .from('friends')
            .delete()
            .eq('id', friendshipId);

        if (error) throw error;
        console.log('✅ Friend removed:', friendshipId);
        return true;
    } catch (error) {
        console.error('Error removing friend:', error.message);
        return false;
    }
}

// ========== UTILITY FUNCTIONS ==========

/**
 * Get initials from a name
 * @param {string} name - Full name
 * @returns {string} Initials (max 2 characters)
 */
function getInitials(name) {
    return name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
}

/**
 * Test database connection
 * @returns {Promise<boolean>} Connection status
 */
async function testConnection() {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('count')
            .limit(1);

        if (error) throw error;
        console.log('✅ Database connection successful');
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
}

// ========== EXPORTS ==========

// Export Supabase client for direct access if needed
module.exports = {
    supabase,
    
    // User functions
    getUserById,
    getUserByEmail,
    createUser,
    updateUser,
    
    // Post functions
    getAllPosts,
    getPostsByUser,
    createPost,
    updatePost,
    deletePost,
    
    // Like functions
    getLikesByPost,
    hasUserLikedPost,
    addLike,
    removeLike,
    
    // Comment functions
    getCommentsByPost,
    addComment,
    deleteComment,
    
    // Friend functions
    getFriendsByUser,
    addFriend,
    removeFriend,
    
    // Utility functions
    testConnection,
    getInitials
};