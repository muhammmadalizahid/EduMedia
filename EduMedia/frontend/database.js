// ==========================================
// EduMedia - Frontend-Backend Integration
// Browser-compatible Supabase client
// ==========================================

// Import Supabase from CDN (browser-compatible)
// This will be loaded via script tag in HTML

// Initialize Supabase client
const SUPABASE_URL = 'https://pqmfshyxyprzgzovukoi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbWZzaHl4eXByemd6b3Z1a29pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2MjI5MDAsImV4cCI6MjA3OTE5ODkwMH0.Jf3NmMZBrqLkrnQehNsHKEYQta8Rh54133-SRwtfXlg';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ========== DATABASE OPERATIONS ==========

const Database = {
    // ========== USERS ==========
    async getUser(userId) {
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
        
        if (error) {
            console.error('Error fetching user:', error);
            return null;
        }
        return data;
    },

    async getUserByEmail(email) {
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('email', email)
            .single();
        
        if (error) {
            console.error('Error fetching user:', error);
            return null;
        }
        return data;
    },

    async createUser(userData) {
        const { data, error } = await supabaseClient
            .from('users')
            .insert([{
                name: userData.name,
                email: userData.email,
                bio: userData.bio || '',
                initials: userData.initials || this.getInitials(userData.name)
            }])
            .select()
            .single();
        
        if (error) {
            console.error('Error creating user:', error);
            throw error;
        }
        return data;
    },

    async updateUser(userId, updates) {
        if (updates.name) {
            updates.initials = this.getInitials(updates.name);
        }

        const { data, error } = await supabaseClient
            .from('users')
            .update(updates)
            .eq('id', userId)
            .select()
            .single();
        
        if (error) {
            console.error('Error updating user:', error);
            throw error;
        }
        return data;
    },

    // ========== POSTS ==========
    async getAllPosts() {
        const { data, error } = await supabaseClient
            .from('posts')
            .select(`
                *,
                author:users!posts_author_id_fkey(name, email, initials)
            `)
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Error fetching posts:', error);
            return [];
        }
        return data;
    },

    async createPost(authorId, content) {
        const { data, error } = await supabaseClient
            .from('posts')
            .insert([{
                author_id: authorId,
                content: content,
                likes: 0
            }])
            .select(`
                *,
                author:users!posts_author_id_fkey(name, email, initials)
            `)
            .single();
        
        if (error) {
            console.error('Error creating post:', error);
            throw error;
        }
        return data;
    },

    async updatePost(postId, content) {
        const { data, error } = await supabaseClient
            .from('posts')
            .update({ content })
            .eq('id', postId)
            .select(`
                *,
                author:users!posts_author_id_fkey(name, email, initials)
            `)
            .single();
        
        if (error) {
            console.error('Error updating post:', error);
            throw error;
        }
        return data;
    },

    async deletePost(postId) {
        // Delete comments and likes first
        await supabaseClient.from('comments').delete().eq('post_id', postId);
        await supabaseClient.from('likes').delete().eq('post_id', postId);

        const { error } = await supabaseClient
            .from('posts')
            .delete()
            .eq('id', postId);
        
        if (error) {
            console.error('Error deleting post:', error);
            return false;
        }
        return true;
    },

    // ========== LIKES ==========
    async getLikesForPost(postId) {
        const { data, error } = await supabaseClient
            .from('likes')
            .select('*')
            .eq('post_id', postId);
        
        if (error) {
            console.error('Error fetching likes:', error);
            return [];
        }
        return data;
    },

    async hasUserLikedPost(postId, userId) {
        const { data } = await supabaseClient
            .from('likes')
            .select('id')
            .eq('post_id', postId)
            .eq('user_id', userId)
            .single();
        
        return data !== null;
    },

    async addLike(postId, userId) {
        // Add like record
        const { data: likeData, error: likeError } = await supabaseClient
            .from('likes')
            .insert([{ post_id: postId, user_id: userId }])
            .select()
            .single();

        if (likeError) {
            console.error('Error adding like:', likeError);
            throw likeError;
        }

        // Increment post likes count
        const { data: postData, error: postError } = await supabaseClient
            .rpc('increment_post_likes', { post_id: postId });

        if (postError) {
            // Fallback: manual increment
            const { data: post } = await supabaseClient
                .from('posts')
                .select('likes')
                .eq('id', postId)
                .single();
            
            await supabaseClient
                .from('posts')
                .update({ likes: (post?.likes || 0) + 1 })
                .eq('id', postId);
        }

        return likeData;
    },

    async removeLike(postId, userId) {
        // Remove like record
        const { error: likeError } = await supabaseClient
            .from('likes')
            .delete()
            .eq('post_id', postId)
            .eq('user_id', userId);

        if (likeError) {
            console.error('Error removing like:', likeError);
            return false;
        }

        // Decrement post likes count
        const { data: post } = await supabaseClient
            .from('posts')
            .select('likes')
            .eq('id', postId)
            .single();
        
        await supabaseClient
            .from('posts')
            .update({ likes: Math.max((post?.likes || 0) - 1, 0) })
            .eq('id', postId);

        return true;
    },

    // ========== COMMENTS ==========
    async getCommentsForPost(postId) {
        const { data, error } = await supabaseClient
            .from('comments')
            .select(`
                *,
                author:users!comments_author_id_fkey(name, initials)
            `)
            .eq('post_id', postId)
            .order('created_at', { ascending: true });
        
        if (error) {
            console.error('Error fetching comments:', error);
            return [];
        }
        return data;
    },

    async addComment(postId, authorId, text) {
        const { data, error } = await supabaseClient
            .from('comments')
            .insert([{
                post_id: postId,
                author_id: authorId,
                text: text
            }])
            .select(`
                *,
                author:users!comments_author_id_fkey(name, initials)
            `)
            .single();
        
        if (error) {
            console.error('Error adding comment:', error);
            throw error;
        }
        return data;
    },

    async deleteComment(commentId) {
        const { error } = await supabaseClient
            .from('comments')
            .delete()
            .eq('id', commentId);
        
        if (error) {
            console.error('Error deleting comment:', error);
            return false;
        }
        return true;
    },

    // ========== FRIENDS ==========
    async getFriends(userId) {
        // Query friendships where user is either user_id OR friend_id
        // Only get accepted friendships (isaccepted = true)
        const { data, error } = await supabaseClient
            .from('friends')
            .select(`
                *,
                friend:users!friends_friend_id_fkey(id, name, email, initials)
            `)
            .eq('user_id', userId)
            .eq('isaccepted', true)
            .order('added_at', { ascending: false });
        
        if (error) {
            console.error('Error fetching friends:', error);
            return [];
        }
        return data || [];
    },

    async addFriend(userId, friendId) {
        const { data, error } = await supabaseClient
            .from('friends')
            .insert([{
                user_id: userId,
                friend_id: friendId
            }])
            .select(`
                *,
                friend:users!friends_friend_id_fkey(id, name, email, initials)
            `)
            .single();
        
        if (error) {
            console.error('Error adding friend:', error);
            throw error;
        }
        return data;
    },

    async removeFriend(friendshipId) {
        // Use backend endpoint that handles reciprocal deletion
        const token = localStorage.getItem('authToken');
        
        const response = await fetch(`http://localhost:3003/api/friends/remove/${friendshipId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'Failed to remove friend');
        }

        return true;
    },

    // ========== UTILITY ==========
    getInitials(name) {
        return name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
    }
};
