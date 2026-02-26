import { useState, useEffect } from 'react';
import styles from './Board.module.css';
import useAlert from './hooks/useAlert';
import * as backendService from './backendService';

function Board() {
  const [posts, setPosts] = useState([]);
  const [newPostText, setNewPostText] = useState('');
  const [editingPostId, setEditingPostId] = useState(null);
  const [editText, setEditText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showAlert, showConfirm } = useAlert();

  const fetchPosts = async () => {
    try {
      const data = await backendService.fetchPosts();
      setPosts(data);
    } catch (error) {
      console.error('Failed to load posts:', error);
      showAlert('게시물을 불러오는 데 실패했습니다.');
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handlePostSubmit = async (e) => {
    e.preventDefault();
    const trimmedText = newPostText.trim();
    if (!trimmedText) {
      showAlert('Please enter a message before posting.');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await backendService.createPost({ text: trimmedText });
      setPosts((prev) => [created, ...prev]);
      setNewPostText('');
      showAlert('Post saved.');
    } catch (error) {
      console.error('Failed to create post:', error);
      showAlert('게시물 등록에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePost = async (postId) => {
    const confirmed = await showConfirm('게시물을 삭제하시겠습니까?');
    if (!confirmed) {
      return;
    }
    try {
      await backendService.deletePost({ postId });
      setPosts((prev) => prev.filter((post) => post.id !== postId));
      showAlert('Post deleted.');
    } catch (error) {
      console.error('Failed to delete post:', error);
      showAlert('게시물 삭제에 실패했습니다.');
    }
  };

  const handleEditPost = (post) => {
    setEditingPostId(post.id);
    setEditText(post.text);
  };

  const handleUpdatePost = async () => {
    if (!editingPostId) return;
    const trimmedText = editText.trim();
    if (!trimmedText) {
      showAlert('Please enter some text before saving.');
      return;
    }
    try {
      const updated = await backendService.updatePost({ postId: editingPostId, text: trimmedText });
      setPosts((prev) => prev.map((post) => (post.id === editingPostId ? updated : post)));
      setEditingPostId(null);
      setEditText('');
      showAlert('Post updated.');
    } catch (error) {
      console.error('Failed to update post:', error);
      showAlert('게시물 수정에 실패했습니다.');
    }
  };

  const handleCancelEdit = () => {
    setEditingPostId(null);
    setEditText('');
  };

  const formatTimestamp = (value) => {
    if (!value) return '';
    try {
      const date = new Date(value);
      return date.toLocaleString();
    } catch {
      return value;
    }
  };

  return (
    <div className={styles.boardContainer}>
      <form className={styles.postForm} onSubmit={handlePostSubmit}>
        <textarea
          className={styles.textarea}
          value={newPostText}
          onChange={(e) => setNewPostText(e.target.value)}
          placeholder="Share an update with the team"
          rows={4}
        />
        <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
          {isSubmitting ? 'Posting...' : 'Post'}
        </button>
      </form>

      <div className={styles.postList}>
        {posts.map((post) => (
          <div key={post.id} className={styles.postItem}>
            <div className={styles.postHeader}>
              <strong>{post.author || 'Admin'}</strong>
              <span>{formatTimestamp(post.timestamp)}</span>
            </div>
            {editingPostId === post.id ? (
              <div className={styles.editSection}>
                <textarea
                  className={styles.textarea}
                  rows={3}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                />
                <div className={styles.formActions}>
                  <button type="button" onClick={handleUpdatePost} className={styles.submitButton}>
                    Save
                  </button>
                  <button type="button" onClick={handleCancelEdit} className={styles.cancelButton}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className={styles.postText}>{post.text}</p>
            )}
            {!editingPostId && (
              <div className={styles.postActions}>
                <button onClick={() => handleEditPost(post)} className={styles.actionButton}>
                  Edit
                </button>
                <button onClick={() => handleDeletePost(post.id)} className={styles.actionButton}>
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
        {posts.length === 0 && <p className={styles.empty}>게시물이 없습니다.</p>}
      </div>
    </div>
  );
}

export default Board;
