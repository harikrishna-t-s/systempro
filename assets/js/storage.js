class SystemProStorage {
    constructor() {
        // Change these to your Supabase credentials, or inject them globally
        this.supabaseUrl = window.SUPABASE_URL || '';
        this.supabaseAnonKey = window.SUPABASE_ANON_KEY || '';
        this.supabase = null;
        
        // IndexedDB Fallback variables
        this.dbName = 'SystemProDB';
        this.version = 2;
        this.db = null;
        this.isSupabaseActive = false;
    }

    async init() {
        if (this.supabaseUrl && this.supabaseAnonKey && window.supabase) {
            try {
                this.supabase = window.supabase.createClient(this.supabaseUrl, this.supabaseAnonKey);
                // Perform a verification query to check if connection is valid
                const { error } = await this.supabase.from('specifications').select('id').limit(1);
                if (error) throw error;
                this.isSupabaseActive = true;
                console.log("Centralized Supabase database connection established successfully.");
                return;
            } catch (err) {
                console.warn("Supabase connection check failed. Falling back to local IndexedDB storage.", err.message);
            }
        } else {
            console.log("Supabase credentials not fully configured. Using local IndexedDB storage.");
        }

        // IndexedDB fallback init
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => { this.db = request.result; resolve(); };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('entries')) {
                    db.createObjectStore('entries', { keyPath: 'id' });
                }
            };
        });
    }

    async getAllEntries() {
        if (this.isSupabaseActive) {
            const { data, error } = await this.supabase
                .from('specifications')
                .select(`
                    *,
                    specification_tags (
                        tags (
                            name
                        )
                    ),
                    comments (
                        id,
                        author,
                        is_admin,
                        text,
                        parent_id,
                        created_at
                    )
                `);

            if (error) throw error;

            const buildCommentTree = (commentsList) => {
                if (!commentsList || commentsList.length === 0) return [];
                const commentMap = {};
                commentsList.forEach(c => {
                    commentMap[c.id] = {
                        id: c.id,
                        author: c.author,
                        isAdmin: c.is_admin,
                        text: c.text,
                        timestamp: c.created_at,
                        replies: []
                    };
                });
                const tree = [];
                commentsList.forEach(c => {
                    const mapped = commentMap[c.id];
                    if (c.parent_id && commentMap[c.parent_id]) {
                        commentMap[c.parent_id].replies.push(mapped);
                    } else {
                        tree.push(mapped);
                    }
                });
                return tree;
            };

            return data.map(item => {
                const tagsString = item.specification_tags
                    ? item.specification_tags
                        .map(st => st.tags ? st.tags.name : null)
                        .filter(Boolean)
                        .join(', ')
                    : '';

                return {
                    id: item.id,
                    title: item.title,
                    category: item.category_id,
                    author: item.author,
                    context: item.context,
                    topology: item.topology,
                    tradeoffs: item.tradeoffs,
                    observability: item.observability,
                    deployment: item.deployment,
                    security: item.security,
                    modified: item.modified_at ? item.modified_at.split('T')[0] : new Date().toISOString().split('T')[0],
                    tags: tagsString,
                    comments: buildCommentTree(item.comments || [])
                };
            });
        }

        // IndexedDB Fallback
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['entries'], 'readonly');
            const store = transaction.objectStore(['entries']);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async saveEntry(entry) {
        if (this.isSupabaseActive) {
            // 1. Upsert Specification
            const { error: specError } = await this.supabase
                .from('specifications')
                .upsert({
                    id: entry.id,
                    title: entry.title,
                    category_id: entry.category,
                    author: entry.author,
                    context: entry.context,
                    topology: entry.topology,
                    tradeoffs: entry.tradeoffs,
                    observability: entry.observability,
                    deployment: entry.deployment,
                    security: entry.security,
                    modified_at: new Date().toISOString()
                });
            if (specError) throw specError;

            // 2. Manage Tags Junction Table
            const tagNames = (entry.tags || '')
                .split(',')
                .map(t => t.trim())
                .filter(Boolean);

            const tagIds = [];
            for (const name of tagNames) {
                // Upsert tag
                const { data: tag, error: tagErr } = await this.supabase
                    .from('tags')
                    .upsert({ name }, { onConflict: 'name' })
                    .select('id')
                    .single();
                
                if (tagErr) {
                    // Tag might already exist, fetch its ID
                    const { data: existingTag } = await this.supabase
                        .from('tags')
                        .select('id')
                        .eq('name', name)
                        .single();
                    if (existingTag) tagIds.push(existingTag.id);
                } else if (tag) {
                    tagIds.push(tag.id);
                }
            }

            // Remove old tags bindings
            const { error: deleteJuncError } = await this.supabase
                .from('specification_tags')
                .delete()
                .eq('specification_id', entry.id);
            if (deleteJuncError) throw deleteJuncError;

            // Bind new tags
            if (tagIds.length > 0) {
                const relations = tagIds.map(tagId => ({
                    specification_id: entry.id,
                    tag_id: tagId
                }));
                const { error: insertJuncError } = await this.supabase
                    .from('specification_tags')
                    .insert(relations);
                if (insertJuncError) throw insertJuncError;
            }

            // 3. Manage Comments Sync
            const flattenComments = (tree, specId, parentId = null) => {
                let flat = [];
                tree.forEach(c => {
                    flat.push({
                        id: c.id,
                        specification_id: specId,
                        parent_id: parentId,
                        author: c.author,
                        is_admin: !!c.isAdmin,
                        text: c.text,
                        created_at: c.timestamp || new Date().toISOString()
                    });
                    if (c.replies && c.replies.length > 0) {
                        flat = flat.concat(flattenComments(c.replies, specId, c.id));
                    }
                });
                return flat;
            };

            const flatComments = flattenComments(entry.comments || [], entry.id);
            const commentIdsToKeep = flatComments.map(c => c.id);

            // Delete removed comments
            if (commentIdsToKeep.length > 0) {
                const { error: commentDelError } = await this.supabase
                    .from('comments')
                    .delete()
                    .eq('specification_id', entry.id)
                    .not('id', 'in', `(${commentIdsToKeep.map(id => `'${id}'`).join(',')})`);
                if (commentDelError) throw commentDelError;
            } else {
                const { error: commentDelError } = await this.supabase
                    .from('comments')
                    .delete()
                    .eq('specification_id', entry.id);
                if (commentDelError) throw commentDelError;
            }

            // Upsert the remaining comments
            if (flatComments.length > 0) {
                const { error: commentUpsertError } = await this.supabase
                    .from('comments')
                    .upsert(flatComments);
                if (commentUpsertError) throw commentUpsertError;
            }
            return;
        }

        // IndexedDB Fallback
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['entries'], 'readwrite');
            const store = transaction.objectStore(['entries']);
            const request = store.put(entry);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async deleteEntry(id) {
        if (this.isSupabaseActive) {
            const { error } = await this.supabase
                .from('specifications')
                .delete()
                .eq('id', id);
            if (error) throw error;
            return;
        }

        // IndexedDB Fallback
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['entries'], 'readwrite');
            const store = transaction.objectStore(['entries']);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}
window.storageEngine = new SystemProStorage();
