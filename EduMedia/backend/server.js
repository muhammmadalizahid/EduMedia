// ==========================================
// EduMedia Authentication Server
// Secure authentication with bcrypt & JWT
// ==========================================

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Import Supabase client
const { createClient } = require('@supabase/supabase-js');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// JWT Secret (store in .env in production)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
const JWT_EXPIRES_IN = '7d'; // Token expires in 7 days

// Salt rounds for bcrypt
const SALT_ROUNDS = 10;

// ========== HELPER FUNCTIONS ==========

/**
 * Generate initials from name
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
 * Generate JWT token
 */
function generateToken(userId, email) {
    return jwt.sign(
        { userId, email },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

// ========== MIDDLEWARE ==========

/**
 * Authentication middleware
 * Verifies JWT token from Authorization header
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Access token required'
        });
    }

    const decoded = verifyToken(token);
    
    if (!decoded) {
        return res.status(403).json({
            success: false,
            message: 'Invalid or expired token'
        });
    }

    req.user = decoded;
    next();
}

// ========== AUTHENTICATION ENDPOINTS ==========

/**
 * POST /api/auth/signup
 * Create new user account with hashed password
 */
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { name, email, password, bio } = req.body;

        // Validation
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Name, email, and password are required'
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        // Validate password strength (min 6 characters)
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        // Check if user already exists
        const { data: existingUser, error: checkError } = await supabase
            .from('users')
            .select('id, email')
            .eq('email', email.toLowerCase())
            .single();

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'An account with this email already exists'
            });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        // Generate initials
        const initials = getInitials(name);

        // Create user in database
        const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert([{
                name: name.trim(),
                email: email.toLowerCase().trim(),
                bio: bio ? bio.trim() : '',
                initials: initials,
                password_hash: passwordHash
            }])
            .select()
            .single();

        if (insertError) {
            console.error('Database error:', insertError);
            return res.status(500).json({
                success: false,
                message: 'Failed to create user account',
                error: insertError.message
            });
        }

        // Generate JWT token
        const token = generateToken(newUser.id, newUser.email);

        // Return success response (exclude password_hash)
        res.status(201).json({
            success: true,
            message: 'Account created successfully',
            data: {
                user: {
                    id: newUser.id,
                    name: newUser.name,
                    email: newUser.email,
                    bio: newUser.bio,
                    initials: newUser.initials,
                    created_at: newUser.created_at
                },
                token: token
            }
        });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during signup',
            error: error.message
        });
    }
});

/**
 * POST /api/auth/login
 * Authenticate user with email and password
 */
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // Find user by email
        const { data: user, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('email', email.toLowerCase())
            .single();

        if (fetchError || !user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check if password_hash exists
        if (!user.password_hash) {
            return res.status(401).json({
                success: false,
                message: 'Account created without password. Please use the signup flow.'
            });
        }

        // Compare password with hash
        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Generate JWT token
        const token = generateToken(user.id, user.email);

        // Return success response (exclude password_hash)
        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    bio: user.bio,
                    initials: user.initials,
                    created_at: user.created_at
                },
                token: token
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during login',
            error: error.message
        });
    }
});

/**
 * GET /api/auth/verify
 * Verify JWT token and return user info
 */
app.get('/api/auth/verify', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;

        // Fetch user from database
        const { data: user, error } = await supabase
            .from('users')
            .select('id, name, email, bio, initials, created_at')
            .eq('id', userId)
            .single();

        if (error || !user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Token is valid',
            data: {
                user: user
            }
        });

    } catch (error) {
        console.error('Verify error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

/**
 * POST /api/auth/change-password
 * Change user password (requires authentication)
 */
app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { currentPassword, newPassword } = req.body;

        // Validation
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current password and new password are required'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 6 characters long'
            });
        }

        // Fetch user with password_hash
        const { data: user, error: fetchError } = await supabase
            .from('users')
            .select('id, password_hash')
            .eq('id', userId)
            .single();

        if (fetchError || !user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Verify current password
        const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Hash new password
        const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

        // Update password in database
        const { error: updateError } = await supabase
            .from('users')
            .update({ password_hash: newPasswordHash })
            .eq('id', userId);

        if (updateError) {
            return res.status(500).json({
                success: false,
                message: 'Failed to update password',
                error: updateError.message
            });
        }

        res.status(200).json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// ========== PROTECTED ROUTES (Examples) ==========

/**
 * GET /api/user/profile
 * Get authenticated user's profile
 */
app.get('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;

        const { data: user, error } = await supabase
            .from('users')
            .select('id, name, email, bio, initials, created_at')
            .eq('id', userId)
            .single();

        if (error || !user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            data: { user }
        });

    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// ========== MY POSTS FEATURE WITH UNDO STACK ==========

/**
 * Stack Data Structure for Undo Functionality
 * Stores deleted/edited posts in memory per user session
 */
class UndoStack {
    constructor() {
        // Store stacks per user (userId -> array of actions)
        this.stacks = new Map();
    }

    push(userId, action) {
        if (!this.stacks.has(userId)) {
            this.stacks.set(userId, []);
        }
        this.stacks.get(userId).push(action);
        
        // Limit stack size to 10 actions per user
        if (this.stacks.get(userId).length > 10) {
            this.stacks.get(userId).shift();
        }
    }

    pop(userId) {
        if (!this.stacks.has(userId) || this.stacks.get(userId).length === 0) {
            return null;
        }
        return this.stacks.get(userId).pop();
    }

    peek(userId) {
        if (!this.stacks.has(userId) || this.stacks.get(userId).length === 0) {
            return null;
        }
        const stack = this.stacks.get(userId);
        return stack[stack.length - 1];
    }

    isEmpty(userId) {
        return !this.stacks.has(userId) || this.stacks.get(userId).length === 0;
    }

    clear(userId) {
        if (this.stacks.has(userId)) {
            this.stacks.delete(userId);
        }
    }

    size(userId) {
        return this.stacks.has(userId) ? this.stacks.get(userId).length : 0;
    }
}

// Initialize global undo stack
const undoStack = new UndoStack();

/**
 * GET /api/posts/my-posts
 * Fetch all posts by the authenticated user with counts
 */
app.get('/api/posts/my-posts', authenticateToken, async (req, res) => {
    console.log('=== GET /api/posts/my-posts endpoint called ===');
    console.log('User from token:', req.user);
    
    try {
        const { userId } = req.user;
        console.log('Fetching posts for userId:', userId);

        // Fetch user's posts with author info
        const { data: posts, error: postsError } = await supabase
            .from('posts')
            .select(`
                id,
                content,
                created_at,
                author_id,
                likes,
                author:users!posts_author_id_fkey(name, email, initials)
            `)
            .eq('author_id', userId)
            .order('created_at', { ascending: false });

        console.log('Supabase query result - posts:', posts);
        console.log('Supabase query error:', postsError);

        if (postsError) {
            console.error('Error fetching posts:', postsError);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch posts',
                error: postsError.message
            });
        }

        console.log(`Found ${posts ? posts.length : 0} posts`);

        // Get likes count, comments, and liked_by for each post
        const postsWithCounts = await Promise.all(posts.map(async (post) => {
            // Get likes count
            const { count: likesCount, error: likesError } = await supabase
                .from('likes')
                .select('*', { count: 'exact', head: true })
                .eq('post_id', post.id);

            // Get liked_by user IDs
            const { data: likes, error: likesDataError } = await supabase
                .from('likes')
                .select('user_id')
                .eq('post_id', post.id);
            
            const likedBy = likes ? likes.map(like => like.user_id) : [];

            // Get comments with author info
            const { data: comments, error: commentsError } = await supabase
                .from('comments')
                .select(`
                    id,
                    text,
                    created_at,
                    post_id,
                    author_id,
                    author:users!comments_author_id_fkey(name, email)
                `)
                .eq('post_id', post.id)
                .order('created_at', { ascending: true });

            const formattedComments = comments ? comments.map(comment => ({
                id: comment.id,
                text: comment.text,
                author: comment.author?.name || 'Unknown',
                author_id: comment.author_id,
                post_id: comment.post_id,
                created_at: comment.created_at
            })) : [];

            return {
                post_id: post.id,
                content: post.content,
                timestamp: post.created_at,
                likes_count: likesCount || 0,
                comments_count: formattedComments.length,
                liked_by: likedBy,
                comments: formattedComments,
                author: post.author,
                author_name: post.author?.name || 'Unknown'
            };
        }));

        console.log('Posts with counts:', postsWithCounts);

        res.status(200).json({
            success: true,
            message: `Found ${postsWithCounts.length} posts`,
            data: {
                posts: postsWithCounts,
                total: postsWithCounts.length
            }
        });

    } catch (error) {
        console.error('My posts error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

/**
 * PUT /api/posts/edit
 * Update a post's content and push original to undo stack
 */
app.put('/api/posts/edit', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { post_id, content } = req.body;

        // Validation
        if (!post_id || !content) {
            return res.status(400).json({
                success: false,
                message: 'Post ID and content are required'
            });
        }

        if (content.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Post content cannot be empty'
            });
        }

        // Fetch the original post
        const { data: originalPost, error: fetchError } = await supabase
            .from('posts')
            .select('*')
            .eq('id', post_id)
            .eq('author_id', userId)
            .single();

        if (fetchError || !originalPost) {
            return res.status(404).json({
                success: false,
                message: 'Post not found or you do not have permission to edit it'
            });
        }

        // Store original post in undo stack
        undoStack.push(userId, {
            type: 'EDIT',
            post_id: originalPost.id,
            original_content: originalPost.content,
            new_content: content.trim(),
            timestamp: new Date().toISOString()
        });

        // Update the post
        const { data: updatedPost, error: updateError } = await supabase
            .from('posts')
            .update({ content: content.trim() })
            .eq('id', post_id)
            .eq('author_id', userId)
            .select()
            .single();

        if (updateError) {
            console.error('Update error:', updateError);
            return res.status(500).json({
                success: false,
                message: 'Failed to update post',
                error: updateError.message
            });
        }

        res.status(200).json({
            success: true,
            message: 'Post updated successfully',
            data: {
                post: updatedPost,
                undo_available: true
            }
        });

    } catch (error) {
        console.error('Edit post error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

/**
 * DELETE /api/posts/delete
 * Delete a post and push to undo stack
 */
app.delete('/api/posts/delete', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { post_id } = req.body;

        // Validation
        if (!post_id) {
            return res.status(400).json({
                success: false,
                message: 'Post ID is required'
            });
        }

        // Fetch the post before deleting
        const { data: postToDelete, error: fetchError } = await supabase
            .from('posts')
            .select('*')
            .eq('id', post_id)
            .eq('author_id', userId)
            .single();

        if (fetchError || !postToDelete) {
            return res.status(404).json({
                success: false,
                message: 'Post not found or you do not have permission to delete it'
            });
        }

        // Store the entire post in undo stack
        undoStack.push(userId, {
            type: 'DELETE',
            post: {
                id: postToDelete.id,
                author_id: postToDelete.author_id,
                content: postToDelete.content,
                likes: postToDelete.likes,
                created_at: postToDelete.created_at
            },
            timestamp: new Date().toISOString()
        });

        // Delete associated likes first (foreign key constraint)
        const { error: likesDeleteError } = await supabase
            .from('likes')
            .delete()
            .eq('post_id', post_id);

        if (likesDeleteError) {
            console.error('Error deleting likes:', likesDeleteError);
        }

        // Delete associated comments (foreign key constraint)
        const { error: commentsDeleteError } = await supabase
            .from('comments')
            .delete()
            .eq('post_id', post_id);

        if (commentsDeleteError) {
            console.error('Error deleting comments:', commentsDeleteError);
        }

        // Delete the post
        const { error: deleteError } = await supabase
            .from('posts')
            .delete()
            .eq('id', post_id)
            .eq('author_id', userId);

        if (deleteError) {
            console.error('Delete error:', deleteError);
            return res.status(500).json({
                success: false,
                message: 'Failed to delete post',
                error: deleteError.message
            });
        }

        res.status(200).json({
            success: true,
            message: 'Post deleted successfully',
            data: {
                deleted_post_id: post_id,
                undo_available: true
            }
        });

    } catch (error) {
        console.error('Delete post error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

/**
 * POST /api/posts/undo
 * Undo the last edit or delete action
 */
app.post('/api/posts/undo', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;

        // Check if undo stack is empty
        if (undoStack.isEmpty(userId)) {
            return res.status(400).json({
                success: false,
                message: 'No actions to undo'
            });
        }

        // Pop the last action
        const lastAction = undoStack.pop(userId);

        if (lastAction.type === 'EDIT') {
            // Restore original content
            const { data: restoredPost, error: restoreError } = await supabase
                .from('posts')
                .update({ content: lastAction.original_content })
                .eq('id', lastAction.post_id)
                .eq('author_id', userId)
                .select()
                .single();

            if (restoreError) {
                // Push action back to stack if restoration fails
                undoStack.push(userId, lastAction);
                
                console.error('Undo edit error:', restoreError);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to undo edit',
                    error: restoreError.message
                });
            }

            // Get likes and comments count for the restored post
            const { count: likesCount } = await supabase
                .from('likes')
                .select('*', { count: 'exact', head: true })
                .eq('post_id', restoredPost.id);

            const { count: commentsCount } = await supabase
                .from('comments')
                .select('*', { count: 'exact', head: true })
                .eq('post_id', restoredPost.id);

            return res.status(200).json({
                success: true,
                message: 'Edit undone successfully',
                data: {
                    action: 'UNDO_EDIT',
                    post: {
                        post_id: restoredPost.id,
                        content: restoredPost.content,
                        timestamp: restoredPost.created_at,
                        likes_count: likesCount || 0,
                        comments_count: commentsCount || 0
                    },
                    remaining_undos: undoStack.size(userId)
                }
            });

        } else if (lastAction.type === 'DELETE') {
            // Restore deleted post
            const { data: restoredPost, error: restoreError } = await supabase
                .from('posts')
                .insert([{
                    id: lastAction.post.id,
                    author_id: lastAction.post.author_id,
                    content: lastAction.post.content,
                    likes: lastAction.post.likes,
                    created_at: lastAction.post.created_at
                }])
                .select()
                .single();

            if (restoreError) {
                // Push action back to stack if restoration fails
                undoStack.push(userId, lastAction);
                
                console.error('Undo delete error:', restoreError);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to undo delete',
                    error: restoreError.message
                });
            }

            // Get likes and comments count for the restored post
            const { count: likesCount } = await supabase
                .from('likes')
                .select('*', { count: 'exact', head: true })
                .eq('post_id', restoredPost.id);

            const { count: commentsCount } = await supabase
                .from('comments')
                .select('*', { count: 'exact', head: true })
                .eq('post_id', restoredPost.id);

            return res.status(200).json({
                success: true,
                message: 'Delete undone successfully',
                data: {
                    action: 'UNDO_DELETE',
                    post: {
                        post_id: restoredPost.id,
                        content: restoredPost.content,
                        timestamp: restoredPost.created_at,
                        likes_count: likesCount || 0,
                        comments_count: commentsCount || 0
                    },
                    remaining_undos: undoStack.size(userId)
                }
            });

        } else {
            return res.status(400).json({
                success: false,
                message: 'Unknown action type'
            });
        }

    } catch (error) {
        console.error('Undo error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

/**
 * GET /api/posts/undo-status
 * Check if undo is available for current user
 */
app.get('/api/posts/undo-status', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;

        const isEmpty = undoStack.isEmpty(userId);
        const size = undoStack.size(userId);
        const lastAction = undoStack.peek(userId);

        res.status(200).json({
            success: true,
            data: {
                undo_available: !isEmpty,
                undo_count: size,
                last_action: lastAction ? {
                    type: lastAction.type,
                    timestamp: lastAction.timestamp
                } : null
            }
        });

    } catch (error) {
        console.error('Undo status error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// ========== LIKE/UNLIKE ENDPOINTS ==========

/**
 * POST /api/posts/like
 * Like a post
 */
app.post('/api/posts/like', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { post_id } = req.body;

        if (!post_id) {
            return res.status(400).json({
                success: false,
                message: 'Post ID is required'
            });
        }

        // Check if already liked
        const { data: existingLike } = await supabase
            .from('likes')
            .select('id')
            .eq('post_id', post_id)
            .eq('user_id', userId)
            .single();

        if (existingLike) {
            return res.status(400).json({
                success: false,
                message: 'Post already liked'
            });
        }

        // Add like
        const { data: newLike, error: likeError } = await supabase
            .from('likes')
            .insert([{ post_id, user_id: userId }])
            .select()
            .single();

        if (likeError) {
            console.error('Like error:', likeError);
            return res.status(500).json({
                success: false,
                message: 'Failed to like post',
                error: likeError.message
            });
        }

        // Get updated like count
        const { count: likesCount } = await supabase
            .from('likes')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', post_id);

        res.status(200).json({
            success: true,
            message: 'Post liked successfully',
            data: {
                like_id: newLike.id,
                post_id,
                likes_count: likesCount || 0
            }
        });

    } catch (error) {
        console.error('Like post error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

/**
 * DELETE /api/posts/unlike
 * Unlike a post
 */
app.delete('/api/posts/unlike', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { post_id } = req.body;

        if (!post_id) {
            return res.status(400).json({
                success: false,
                message: 'Post ID is required'
            });
        }

        // Remove like
        const { error: unlikeError } = await supabase
            .from('likes')
            .delete()
            .eq('post_id', post_id)
            .eq('user_id', userId);

        if (unlikeError) {
            console.error('Unlike error:', unlikeError);
            return res.status(500).json({
                success: false,
                message: 'Failed to unlike post',
                error: unlikeError.message
            });
        }

        // Get updated like count
        const { count: likesCount } = await supabase
            .from('likes')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', post_id);

        res.status(200).json({
            success: true,
            message: 'Post unliked successfully',
            data: {
                post_id,
                likes_count: likesCount || 0
            }
        });

    } catch (error) {
        console.error('Unlike post error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// ========== COMMENT ENDPOINTS ==========

/**
 * POST /api/comments/add
 * Add a comment to a post
 */
app.post('/api/comments/add', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { post_id, text } = req.body;

        if (!post_id || !text) {
            return res.status(400).json({
                success: false,
                message: 'Post ID and comment text are required'
            });
        }

        if (text.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Comment text cannot be empty'
            });
        }

        // Add comment
        const { data: newComment, error: commentError } = await supabase
            .from('comments')
            .insert([{ 
                post_id, 
                author_id: userId, 
                text: text.trim() 
            }])
            .select(`
                id,
                post_id,
                author_id,
                text,
                created_at,
                author:users!comments_author_id_fkey(name, initials)
            `)
            .single();

        if (commentError) {
            console.error('Add comment error:', commentError);
            return res.status(500).json({
                success: false,
                message: 'Failed to add comment',
                error: commentError.message
            });
        }

        // Get updated comment count
        const { count: commentsCount } = await supabase
            .from('comments')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', post_id);

        res.status(201).json({
            success: true,
            message: 'Comment added successfully',
            data: {
                comment: newComment,
                comments_count: commentsCount || 0
            }
        });

    } catch (error) {
        console.error('Add comment error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

/**
 * PUT /api/comments/:id
 * Edit a comment
 */
app.put('/api/comments/:id', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const commentId = req.params.id;
        const { text } = req.body;

        if (!text || text.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Comment text cannot be empty'
            });
        }

        // Verify ownership
        const { data: comment } = await supabase
            .from('comments')
            .select('author_id, text')
            .eq('id', commentId)
            .single();

        if (!comment) {
            return res.status(404).json({
                success: false,
                message: 'Comment not found'
            });
        }

        if (comment.author_id !== userId) {
            return res.status(403).json({
                success: false,
                message: 'You can only edit your own comments'
            });
        }

        // Update comment
        const { data: updatedComment, error: updateError } = await supabase
            .from('comments')
            .update({ text: text.trim() })
            .eq('id', commentId)
            .select(`
                id,
                post_id,
                author_id,
                text,
                created_at,
                author:users!comments_author_id_fkey(name, initials)
            `)
            .single();

        if (updateError) {
            console.error('Edit comment error:', updateError);
            return res.status(500).json({
                success: false,
                message: 'Failed to edit comment',
                error: updateError.message
            });
        }

        res.status(200).json({
            success: true,
            message: 'Comment updated successfully',
            data: {
                comment: updatedComment,
                old_text: comment.text
            }
        });

    } catch (error) {
        console.error('Edit comment error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

/**
 * DELETE /api/comments/:id
 * Delete a comment
 */
app.delete('/api/comments/:id', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const commentId = req.params.id;

        // Get comment data before deleting
        const { data: comment } = await supabase
            .from('comments')
            .select(`
                id,
                post_id,
                author_id,
                text,
                created_at,
                author:users!comments_author_id_fkey(name, initials)
            `)
            .eq('id', commentId)
            .single();

        if (!comment) {
            return res.status(404).json({
                success: false,
                message: 'Comment not found'
            });
        }

        if (comment.author_id !== userId) {
            return res.status(403).json({
                success: false,
                message: 'You can only delete your own comments'
            });
        }

        // Delete comment
        const { error: deleteError } = await supabase
            .from('comments')
            .delete()
            .eq('id', commentId);

        if (deleteError) {
            console.error('Delete comment error:', deleteError);
            return res.status(500).json({
                success: false,
                message: 'Failed to delete comment',
                error: deleteError.message
            });
        }

        // Get updated comment count
        const { count: commentsCount } = await supabase
            .from('comments')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', comment.post_id);

        res.status(200).json({
            success: true,
            message: 'Comment deleted successfully',
            data: {
                deleted_comment: comment,
                comments_count: commentsCount || 0
            }
        });

    } catch (error) {
        console.error('Delete comment error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// ========== FRIEND REQUEST ENDPOINTS ==========

// Send Friend Request (Updated to use email instead of username)
app.post('/api/friend-request/send', authenticateToken, async (req, res) => {
    try {
        const senderId = req.user.userId;
        const { friendEmail } = req.body; // Changed from username to friendEmail

        console.log(`\n🔵 Friend request - Sender: ${senderId}, Looking for: ${friendEmail}`);

        // Validate input
        if (!friendEmail || !friendEmail.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        const trimmedEmail = friendEmail.trim().toLowerCase();

        // 1. Check if trying to add self
        const { data: senderData } = await supabase
            .from('users')
            .select('email')
            .eq('id', senderId)
            .single();

        if (senderData && senderData.email.toLowerCase() === trimmedEmail) {
            return res.status(400).json({
                success: false,
                message: 'You cannot send a friend request to yourself'
            });
        }

        // 2. Find the user by email (case-insensitive)
        const { data: receiverData, error: userError } = await supabase
            .from('users')
            .select('id, name, email, initials')
            .ilike('email', trimmedEmail) // Case-insensitive search
            .single();

        if (userError || !receiverData) {
            console.log('❌ User not found:', trimmedEmail);
            return res.status(404).json({
                success: false,
                message: 'User not found. Please check the email and try again.'
            });
        }

        const receiverId = receiverData.id;
        console.log(`✅ Found user: ${receiverData.name} (${receiverId})`);

        // 3. Check for existing requests (both directions) or accepted friendship
        const { data: existingRequests, error: checkError } = await supabase
            .from('friends')
            .select('*')
            .or(`and(user_id.eq.${senderId},friend_id.eq.${receiverId}),and(user_id.eq.${receiverId},friend_id.eq.${senderId})`);

        if (checkError) {
            console.error('Database error checking duplicates:', checkError);
            return res.status(500).json({
                success: false,
                message: 'Error checking existing requests'
            });
        }

        if (existingRequests && existingRequests.length > 0) {
            const existingRequest = existingRequests[0];
            
            // Note: Check lowercase 'isaccepted' to match Supabase schema
            if (existingRequest.isaccepted) {
                return res.status(400).json({
                    success: false,
                    message: 'You are already friends with this user'
                });
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'A friend request already exists between you and this user'
                });
            }
        }

        // 4. Create the friend request
        const { data: newRequest, error: insertError } = await supabase
            .from('friends')
            .insert([{
                user_id: senderId,
                friend_id: receiverId
                // Note: isaccepted defaults to false in database
                // Note: accepted_at column doesn't exist in schema
            }])
            .select()
            .single();

        if (insertError) {
            console.error('Error creating friend request:', insertError);
            return res.status(500).json({
                success: false,
                message: 'Failed to send friend request'
            });
        }

        console.log('✅ Friend request created successfully');

        res.status(201).json({
            success: true,
            message: `Friend request sent to ${receiverData.name}`,
            data: {
                request: {
                    id: newRequest.id,
                    sender_id: senderId,
                    receiver_id: receiverId,
                    receiver_name: receiverData.name,
                    receiver_email: receiverData.email,
                    isAccepted: false
                }
            }
        });

    } catch (error) {
        console.error('Error in send friend request:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

/**
 * GET /api/friend-request/pending
 * Get all pending friend requests for current user (received requests)
 */
app.get('/api/friend-request/pending', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;

        // Get pending requests where current user is the receiver
        const { data: pendingRequests, error } = await supabase
            .from('friends')
            .select(`
                *,
                sender:users!friends_user_id_fkey(id, name, email, initials)
            `)
            .eq('friend_id', userId)
            .eq('isaccepted', false)
            .order('added_at', { ascending: false });

        if (error) {
            console.error('Fetch pending requests error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch pending requests',
                error: error.message
            });
        }

        // Transform data
        const formattedRequests = pendingRequests.map(req => ({
            id: req.id,
            sender_id: req.user_id,
            sender_name: req.sender.name,
            sender_email: req.sender.email,
            sender_initials: req.sender.initials,
            received_at: req.added_at
        }));

        res.status(200).json({
            success: true,
            data: {
                requests: formattedRequests,
                count: formattedRequests.length
            }
        });

    } catch (error) {
        console.error('Get pending requests error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

/**
 * POST /api/friend-request/accept
 * Accept a friend request
 */
app.post('/api/friend-request/accept', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { request_id } = req.body;

        if (!request_id) {
            return res.status(400).json({
                success: false,
                message: 'Request ID is required'
            });
        }

        // Verify the request exists and is for this user
        const { data: request, error: fetchError } = await supabase
            .from('friends')
            .select(`
                *,
                sender:users!friends_user_id_fkey(id, name, email, initials)
            `)
            .eq('id', request_id)
            .eq('friend_id', userId)
            .single();

        if (fetchError || !request) {
            return res.status(404).json({
                success: false,
                message: 'Friend request not found'
            });
        }

        if (request.isaccepted) {
            return res.status(400).json({
                success: false,
                message: 'This request has already been accepted'
            });
        }

        // Accept the request (update original row)
        const { data: acceptedRequest, error: updateError } = await supabase
            .from('friends')
            .update({
                isaccepted: true
                // Note: accepted_at column doesn't exist in schema
            })
            .eq('id', request_id)
            .select(`
                *,
                friend:users!friends_user_id_fkey(id, name, email, initials)
            `)
            .single();

        if (updateError) {
            console.error('Accept request error:', updateError);
            return res.status(500).json({
                success: false,
                message: 'Failed to accept friend request',
                error: updateError.message
            });
        }

        // Create reciprocal friendship row so both users see each other as friends
        // Original: user_id=sender, friend_id=receiver
        // Reciprocal: user_id=receiver, friend_id=sender
        const { error: reciprocalError } = await supabase
            .from('friends')
            .insert([{
                user_id: userId, // The accepter becomes user_id
                friend_id: request.user_id, // The sender becomes friend_id
                isaccepted: true // Already accepted
            }]);

        if (reciprocalError) {
            console.error('Reciprocal friendship error:', reciprocalError);
            // Don't fail the request, but log the error
            // The original friendship is still valid
        }

        res.status(200).json({
            success: true,
            message: `You are now friends with ${request.sender.name}`,
            data: {
                friendship: {
                    id: acceptedRequest.id,
                    friend_id: acceptedRequest.user_id,
                    friend_name: request.sender.name,
                    friend_email: request.sender.email,
                    friend_initials: request.sender.initials
                    // Note: accepted_at removed as column doesn't exist
                }
            }
        });

    } catch (error) {
        console.error('Accept friend request error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

/**
 * DELETE /api/friend-request/reject/:requestId
 * Reject/delete a friend request
 */
app.delete('/api/friend-request/reject/:requestId', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { requestId } = req.params;

        if (!requestId) {
            return res.status(400).json({
                success: false,
                message: 'Request ID is required'
            });
        }

        // Verify the request exists and is for this user
        const { data: request, error: fetchError } = await supabase
            .from('friends')
            .select('*')
            .eq('id', requestId)
            .eq('friend_id', userId)
            .single();

        if (fetchError || !request) {
            return res.status(404).json({
                success: false,
                message: 'Friend request not found'
            });
        }

        // Delete the request
        const { error: deleteError } = await supabase
            .from('friends')
            .delete()
            .eq('id', requestId);

        if (deleteError) {
            console.error('Delete request error:', deleteError);
            return res.status(500).json({
                success: false,
                message: 'Failed to reject friend request',
                error: deleteError.message
            });
        }

        res.status(200).json({
            success: true,
            message: 'Friend request rejected successfully'
        });

    } catch (error) {
        console.error('Reject friend request error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

/**
 * DELETE /api/friends/remove/:friendshipId
 * Remove a friendship (deletes both reciprocal rows)
 */
app.delete('/api/friends/remove/:friendshipId', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const friendshipId = req.params.friendshipId;

        // Get the friendship details first
        const { data: friendship, error: fetchError } = await supabase
            .from('friends')
            .select('user_id, friend_id')
            .eq('id', friendshipId)
            .single();

        if (fetchError || !friendship) {
            return res.status(404).json({
                success: false,
                message: 'Friendship not found'
            });
        }

        // Verify user owns this friendship (can be either user_id or friend_id due to reciprocal friendships)
        if (friendship.user_id !== userId && friendship.friend_id !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to remove this friendship'
            });
        }

        // Determine the other user's ID
        const otherUserId = friendship.user_id === userId ? friendship.friend_id : friendship.user_id;

        // Delete the original friendship row
        const { error: deleteError1 } = await supabase
            .from('friends')
            .delete()
            .eq('id', friendshipId);

        if (deleteError1) {
            console.error('Delete friendship error:', deleteError1);
            return res.status(500).json({
                success: false,
                message: 'Failed to remove friendship',
                error: deleteError1.message
            });
        }

        // Delete the reciprocal friendship row (swap user_id and friend_id)
        const { error: deleteError2 } = await supabase
            .from('friends')
            .delete()
            .eq('user_id', otherUserId)
            .eq('friend_id', userId);

        if (deleteError2) {
            console.error('Delete reciprocal friendship error:', deleteError2);
            // Don't fail the request if reciprocal delete fails
        }

        res.status(200).json({
            success: true,
            message: 'Friendship removed successfully'
        });

    } catch (error) {
        console.error('Remove friendship error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// ========== HEALTH CHECK ==========

app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'EduMedia Auth Server is running',
        timestamp: new Date().toISOString()
    });
});

// ========== ERROR HANDLING ==========

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found'
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: err.message
    });
});

// ========== START SERVER ==========

app.listen(PORT, () => {
    console.log(`\n🚀 EduMedia Auth Server running on http://localhost:${PORT}`);
    console.log(`📝 Authentication Endpoints:`);
    console.log(`   POST   /api/auth/signup`);
    console.log(`   POST   /api/auth/login`);
    console.log(`   GET    /api/auth/verify`);
    console.log(`   POST   /api/auth/change-password`);
    console.log(`\n📝 User Endpoints:`);
    console.log(`   GET    /api/user/profile`);
    console.log(`\n📝 Posts Endpoints (with Undo Stack):`);
    console.log(`   GET    /api/posts/my-posts`);
    console.log(`   PUT    /api/posts/edit`);
    console.log(`   DELETE /api/posts/delete`);
    console.log(`   POST   /api/posts/undo`);
    console.log(`   GET    /api/posts/undo-status`);
    console.log(`\n💙 Like/Unlike Endpoints:`);
    console.log(`   POST   /api/posts/like`);
    console.log(`   DELETE /api/posts/unlike`);
    console.log(`\n💬 Comment Endpoints:`);
    console.log(`   POST   /api/comments/add`);
    console.log(`   PUT    /api/comments/:id`);
    console.log(`   DELETE /api/comments/:id`);
    console.log(`\n👥 Friend Request Endpoints:`);
    console.log(`   POST   /api/friend-request/send`);
    console.log(`   GET    /api/friend-request/pending`);
    console.log(`   POST   /api/friend-request/accept`);
    console.log(`   DELETE /api/friend-request/reject/:requestId`);
    console.log(`   DELETE /api/friends/remove/:friendshipId`);
    console.log(`\n📝 Health:`);
    console.log(`   GET    /health\n`);
});

module.exports = app;