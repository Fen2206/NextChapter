// DiscussionThreadScreen.js
//
// DB tables used:
//   thread_comments   → id, thread_id, user_id, body, reply_to (uuid|null), created_at
//   profiles          → id, username, display_name, avatar_url
//   message_reactions → message_id (= comment id), user_id, emoji, created_at
//                       (message_id, user_id, emoji)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  Image, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { colors, typography, spacing } from '../theme';

// Emoji options
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '🎉', '🤔'];

export default function DiscussionThreadScreen({ route, navigation }) {
  const { thread, club } = route?.params || {};

  const [comments, setComments] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [reactionPickerFor, setReactionPickerFor] = useState(null); // comment id
  const [replyingTo, setReplyingTo] = useState(null); // { id, displayName, body }
  const scrollViewRef = useRef(null);
  const inputRef = useRef(null);

  // Get current user once on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user));
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchComments();
    }, [])
  );

  // Fetch comments, profiles, reactions
  const fetchComments = async () => {
    try {
      setLoading(true);

      const { data: commentData, error } = await supabase
        .from('thread_comments')
        .select('id, user_id, body, reply_to, created_at')
        .eq('thread_id', thread.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (!commentData || commentData.length === 0) {
        setComments([]);
        return;
      }

      // Fetch all profiles
      const userIds = [...new Set(commentData.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', userIds);

      const profileMap = {};
      (profiles || []).forEach(p => { profileMap[p.id] = p; });

      // Fetch reactions for the comments
      const commentIds = commentData.map(c => c.id);
      const { data: reactionsData } = await supabase
        .from('message_reactions')
        .select('message_id, user_id, emoji')
        .in('message_id', commentIds);

      // Group reactions by comment id
      const reactionsMap = {};
      (reactionsData || []).forEach(r => {
        if (!reactionsMap[r.message_id]) reactionsMap[r.message_id] = {};
        if (!reactionsMap[r.message_id][r.emoji]) reactionsMap[r.message_id][r.emoji] = [];
        reactionsMap[r.message_id][r.emoji].push(r.user_id);
      });

      const { data: { user } } = await supabase.auth.getUser();

      const enriched = commentData.map(c => {
        const profile = profileMap[c.user_id];
        const displayName = profile?.display_name || profile?.username || 'Unknown';
        const avatarUrl = profile?.avatar_url ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=4A4A4A&color=fff`;

        return {
          id: c.id,
          userId: c.user_id,
          isCurrentUser: c.user_id === user?.id,
          displayName,
          avatarUrl,
          body: c.body,
          replyTo: c.reply_to,
          createdAt: c.created_at,
          timestamp: formatRelativeTime(c.created_at),
          reactions: reactionsMap[c.id] || {},
        };
      });

      setComments(enriched);
    } catch (error) {
      console.error('Error fetching comments:', error);
      setComments([]);
    } finally {
      setLoading(false);
      // Scroll to bottom after load
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: false }), 100);
    }
  };

  // Send a new comment
  const handleSend = async () => {
    const body = inputText.trim();
    if (!body || sending) return;

    try {
      setSending(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { Alert.alert('Not logged in'); return; }

      const { error } = await supabase
        .from('thread_comments')
        .insert({
          thread_id: thread.id,
          user_id: user.id,
          body,
          reply_to: replyingTo?.id ?? null,
        });

      if (error) throw error;

      setInputText('');
      setReplyingTo(null);
      await fetchComments();
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 150);
    } catch (error) {
      console.error('Error sending comment:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  // message_reactions is (message_id, user_id, emoji)
  const handleReaction = async (commentId, emoji) => {
    setReactionPickerFor(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const comment = comments.find(c => c.id === commentId);
      const alreadyReacted = comment?.reactions[emoji]?.includes(user.id);

      if (alreadyReacted) {
        await supabase
          .from('message_reactions')
          .delete()
          .eq('message_id', commentId)
          .eq('user_id', user.id)
          .eq('emoji', emoji);
      } else {
        await supabase
          .from('message_reactions')
          .insert({ message_id: commentId, user_id: user.id, emoji });
      }

      setComments(prev => prev.map(c => {
        if (c.id !== commentId) return c;
        const existing = c.reactions[emoji] || [];
        const updated = alreadyReacted
          ? existing.filter(id => id !== user.id)
          : [...existing, user.id];
        return { ...c, reactions: { ...c.reactions, [emoji]: updated } };
      }));
    } catch (error) {
      console.error('Error toggling reaction:', error);
    }
  };

  const chapterLabel = thread?.chapter || 'General Discussion';
  const threadTitle = thread?.title || 'Discussion';
  const isSpoilerThread = thread?.tag === 'Spoilers';

  // Tracks messages and reveals if the user has chosen to reveal
  const [revealedSpoilers, setRevealedSpoilers] = useState({});

  const handleRevealSpoiler = (commentId) => {
    setRevealedSpoilers(prev => ({ ...prev, [commentId]: true }));
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {/* Thread Header */}
      <View style={styles.header}>
        <View style={styles.chapterBadge}>
          <Text style={styles.chapterText}>{chapterLabel}</Text>
        </View>
        <Text style={styles.threadTitle} numberOfLines={2}>{threadTitle}</Text>
        <Text style={styles.commentCount}>
          {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
        </Text>
      </View>

      {/* Spoiler Warning Banner */}
      {isSpoilerThread && (
        <View style={styles.spoilerBanner}>
          <Ionicons name="warning" size={18} color="#C62828" />
          <Text style={styles.spoilerBannerText}>
            ⚠️ Spoiler Thread — messages are hidden by default. Tap to reveal each one.
          </Text>
        </View>
      )}

      {/* Messages */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.buttonPrimary} />
        </View>
      ) : (
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {comments.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={56} color={colors.border} />
              <Text style={styles.emptyTitle}>No comments yet</Text>
              <Text style={styles.emptyText}>Be the first to share your thoughts!</Text>
            </View>
          ) : (
            comments.map((comment, index) => {
              const prevComment = comments[index - 1];
              const showAvatar = !prevComment || prevComment.userId !== comment.userId;
              return (
                <MessageBubble
                  key={comment.id}
                  comment={comment}
                  allComments={comments}
                  showAvatar={showAvatar}
                  currentUserId={currentUser?.id}
                  reactionPickerOpen={reactionPickerFor === comment.id}
                  isSpoilerThread={isSpoilerThread}
                  isRevealed={revealedSpoilers[comment.id] ?? false}
                  onReveal={() => handleRevealSpoiler(comment.id)}
                  onLongPress={() => setReactionPickerFor(
                    reactionPickerFor === comment.id ? null : comment.id
                  )}
                  onReaction={(emoji) => handleReaction(comment.id, emoji)}
                  onCloseReactionPicker={() => setReactionPickerFor(null)}
                  onReply={() => {
                    setReplyingTo({ id: comment.id, displayName: comment.displayName, body: comment.body });
                    setReactionPickerFor(null);
                    setTimeout(() => inputRef.current?.focus(), 100);
                  }}
                />
              );
            })
          )}
          <View style={{ height: spacing.lg }} />
        </ScrollView>
      )}

      {/* Input Bar */}
      <View style={styles.inputContainer}>
        {/* Reply preview banner */}
        {replyingTo && (
          <View style={styles.replyBanner}>
            <View style={styles.replyBannerLeft}>
              <Ionicons name="return-down-forward" size={14} color={colors.buttonPrimary} />
              <View style={styles.replyBannerText}>
                <Text style={styles.replyBannerName}>Replying to {replyingTo.displayName}</Text>
                <Text style={styles.replyBannerBody} numberOfLines={1}>{replyingTo.body}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setReplyingTo(null)} style={styles.replyBannerClose}>
              <Ionicons name="close" size={18} color={colors.secondary} />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.inputWrapper}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder={replyingTo ? `Reply to ${replyingTo.displayName}...` : "Share your thoughts..."}
            placeholderTextColor={colors.secondary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
          >
            {sending
              ? <ActivityIndicator size="small" color={colors.buttonText} />
              : <Ionicons name="send" size={18} color={colors.buttonText} />
            }
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// Message Bubble

function MessageBubble({ comment, allComments, showAvatar, currentUserId, reactionPickerOpen, isSpoilerThread, isRevealed, onReveal, onLongPress, onReaction, onCloseReactionPicker, onReply }) {
  const isYou = comment.isCurrentUser;

  // Spoiler, hide message unless revealed
  // Current user's own messages are never blurred
  const isBlurred = isSpoilerThread && !isRevealed && !isYou;

  // Find the comment being replied to
  const repliedToComment = comment.replyTo
    ? (allComments || []).find(c => c.id === comment.replyTo)
    : null;

  const reactionSummary = Object.entries(comment.reactions)
    .filter(([, users]) => users.length > 0)
    .map(([emoji, users]) => ({
      emoji,
      count: users.length,
      reacted: users.includes(currentUserId),
    }));

  return (
    <View style={[styles.messageRow, isYou && styles.messageRowYou]}>
      {/* Avatar — left side for others */}
      {!isYou && (
        <View style={styles.avatarContainer}>
          {showAvatar
            ? <Image source={{ uri: comment.avatarUrl }} style={styles.avatar} />
            : <View style={styles.avatarSpacer} />
          }
        </View>
      )}

      <View style={styles.bubbleColumn}>
        {showAvatar && !isYou && (
          <Text style={styles.senderName}>{comment.displayName}</Text>
        )}

        <View>
          <TouchableOpacity
            style={[styles.bubble, isYou && styles.bubbleYou]}
            onLongPress={isBlurred ? undefined : onLongPress}
            activeOpacity={0.85}
          >
            {/* Quoted reply preview */}
            {repliedToComment && (
              <View style={[styles.quotedReply, isYou && styles.quotedReplyYou]}>
                <Text style={[styles.quotedReplyName, isYou && styles.quotedReplyNameYou]}>
                  {repliedToComment.displayName}
                </Text>
                <Text style={[styles.quotedReplyBody, isYou && styles.quotedReplyBodyYou]} numberOfLines={2}>
                  {repliedToComment.body}
                </Text>
              </View>
            )}
            <Text style={[styles.bubbleText, isYou && styles.bubbleTextYou, isBlurred && styles.blurredText]}>
              {comment.body}
            </Text>
            <View style={styles.bubbleFooter}>
              {!isBlurred && (
                <TouchableOpacity onPress={onReply} style={styles.replyButton}>
                  <Ionicons
                    name="return-down-forward-outline"
                    size={14}
                    color={isYou ? 'rgba(255,255,255,0.7)' : colors.secondary}
                  />
                  <Text style={[styles.replyButtonText, isYou && styles.replyButtonTextYou]}>Reply</Text>
                </TouchableOpacity>
              )}
              <Text style={[styles.timestamp, isYou && styles.timestampYou]}>
                {comment.timestamp}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Spoiler reveal overlay */}
          {isBlurred && (
            <TouchableOpacity style={styles.spoilerOverlay} onPress={onReveal} activeOpacity={0.8}>
              <Ionicons name="eye-off" size={20} color="#fff" />
              <Text style={styles.spoilerOverlayText}>Tap to reveal spoiler</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Reaction chips */}
        {reactionSummary.length > 0 && (
          <View style={[styles.reactionsRow, isYou && styles.reactionsRowYou]}>
            {reactionSummary.map(({ emoji, count, reacted }) => (
              <TouchableOpacity
                key={emoji}
                style={[styles.reactionChip, reacted && styles.reactionChipActive]}
                onPress={() => onReaction(emoji)}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
                <Text style={[styles.reactionCount, reacted && styles.reactionCountActive]}>
                  {count}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Reaction picker */}
        {reactionPickerOpen && (
          <View style={[styles.reactionPicker, isYou && styles.reactionPickerYou]}>
            {REACTION_EMOJIS.map(emoji => (
              <TouchableOpacity
                key={emoji}
                style={styles.reactionPickerEmoji}
                onPress={() => onReaction(emoji)}
              >
                <Text style={styles.reactionPickerEmojiText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Avatar — right side for current user */}
      {isYou && (
        <View style={styles.avatarContainer}>
          {showAvatar
            ? <Image source={{ uri: comment.avatarUrl }} style={styles.avatar} />
            : <View style={styles.avatarSpacer} />
          }
        </View>
      )}
    </View>
  );
}

// Helpers

function formatRelativeTime(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Styles

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Header
  header: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, padding: spacing.lg, gap: spacing.xs },
  chapterBadge: { backgroundColor: colors.background, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.border },
  chapterText: { fontSize: typography.fontSizes.xs, fontWeight: typography.fontWeights.medium, color: colors.primary },
  threadTitle: { fontSize: typography.fontSizes.lg, fontWeight: typography.fontWeights.bold, color: colors.primary, lineHeight: typography.fontSizes.lg * typography.lineHeights.relaxed },
  commentCount: { fontSize: typography.fontSizes.xs, color: colors.secondary },

  // Loading / Empty
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl, marginTop: spacing.xxl },
  emptyTitle: { fontSize: typography.fontSizes.lg, fontWeight: typography.fontWeights.semibold, color: colors.primary, marginTop: spacing.md, marginBottom: spacing.sm },
  emptyText: { fontSize: typography.fontSizes.sm, color: colors.secondary, textAlign: 'center' },

  // Messages
  messagesContainer: { flex: 1 },
  messagesContent: { padding: spacing.md },
  messageRow: { flexDirection: 'row', marginBottom: spacing.md, alignItems: 'flex-end' },
  messageRowYou: { flexDirection: 'row-reverse' },

  // Avatar
  avatarContainer: { width: 36, marginHorizontal: spacing.xs, alignSelf: 'flex-end' },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarSpacer: { width: 36, height: 36 },

  // Bubble
  bubbleColumn: { maxWidth: '72%', gap: 4 },
  senderName: { fontSize: typography.fontSizes.xs, fontWeight: typography.fontWeights.semibold, color: colors.secondary, marginLeft: spacing.xs, marginBottom: 2 },
  bubble: { backgroundColor: colors.surface, borderRadius: 16, borderBottomLeftRadius: 4, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  bubbleYou: { backgroundColor: colors.buttonPrimary, borderBottomLeftRadius: 16, borderBottomRightRadius: 4, borderColor: colors.buttonPrimary },
  bubbleText: { fontSize: typography.fontSizes.base, color: colors.primary, lineHeight: typography.fontSizes.base * typography.lineHeights.relaxed },
  bubbleTextYou: { color: colors.buttonText },
  timestamp: { fontSize: typography.fontSizes.xs, color: colors.secondary, marginTop: spacing.xs },
  timestampYou: { color: 'rgba(255,255,255,0.65)', textAlign: 'right' },

  // Reaction chips
  reactionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginLeft: spacing.xs },
  reactionsRowYou: { justifyContent: 'flex-end', marginLeft: 0, marginRight: spacing.xs },
  reactionChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  reactionChipActive: { backgroundColor: '#E8F4FD', borderColor: colors.buttonPrimary },
  reactionEmoji: { fontSize: 13 },
  reactionCount: { fontSize: typography.fontSizes.xs, color: colors.secondary, fontWeight: typography.fontWeights.medium },
  reactionCountActive: { color: colors.buttonPrimary },

  // Reaction picker
  reactionPicker: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 24, padding: spacing.xs, borderWidth: 1, borderColor: colors.border, gap: 2, alignSelf: 'flex-start', marginTop: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
  reactionPickerYou: { alignSelf: 'flex-end' },
  reactionPickerEmoji: { padding: 6 },
  reactionPickerEmojiText: { fontSize: 22 },

  // Spoiler styles
  spoilerBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: '#FFEBEE', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: '#EF9A9A' },
  spoilerBannerText: { flex: 1, fontSize: typography.fontSizes.xs, color: '#C62828', fontWeight: typography.fontWeights.medium, lineHeight: typography.fontSizes.xs * 1.6 },
  blurredText: { color: 'transparent', textShadowColor: colors.secondary, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 },
  spoilerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(80,80,80,0.7)', borderRadius: 16, borderBottomLeftRadius: 4, justifyContent: 'center', alignItems: 'center', gap: spacing.xs, flexDirection: 'row' },
  spoilerOverlayText: { color: '#fff', fontSize: typography.fontSizes.sm, fontWeight: typography.fontWeights.semibold },

  // Reply banner above input
  replyBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderLeftWidth: 3, borderLeftColor: colors.buttonPrimary },
  replyBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  replyBannerText: { flex: 1 },
  replyBannerName: { fontSize: typography.fontSizes.xs, fontWeight: typography.fontWeights.semibold, color: colors.buttonPrimary },
  replyBannerBody: { fontSize: typography.fontSizes.xs, color: colors.secondary, marginTop: 1 },
  replyBannerClose: { padding: spacing.xs },

  // Quoted reply inside bubble
  quotedReply: { backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 8, borderLeftWidth: 3, borderLeftColor: colors.secondary, padding: spacing.sm, marginBottom: spacing.sm },
  quotedReplyYou: { backgroundColor: 'rgba(255,255,255,0.15)', borderLeftColor: 'rgba(255,255,255,0.6)' },
  quotedReplyName: { fontSize: typography.fontSizes.xs, fontWeight: typography.fontWeights.semibold, color: colors.secondary, marginBottom: 2 },
  quotedReplyNameYou: { color: 'rgba(255,255,255,0.8)' },
  quotedReplyBody: { fontSize: typography.fontSizes.xs, color: colors.secondary },
  quotedReplyBodyYou: { color: 'rgba(255,255,255,0.7)' },

  // Reply button inside bubble
  bubbleFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs },
  replyButton: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  replyButtonText: { fontSize: typography.fontSizes.xs, color: colors.secondary },
  replyButtonTextYou: { color: 'rgba(255,255,255,0.7)' },

  // Input bar
  inputContainer: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.md },
  inputWrapper: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  input: { flex: 1, backgroundColor: colors.background, borderRadius: 20, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: typography.fontSizes.base, color: colors.primary, maxHeight: 120, borderWidth: 1, borderColor: colors.border },
  sendButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.buttonPrimary, justifyContent: 'center', alignItems: 'center' },
  sendButtonDisabled: { backgroundColor: colors.border },
});