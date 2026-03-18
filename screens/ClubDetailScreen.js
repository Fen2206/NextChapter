// ClubDetailScreen.js
// DB tables used:
//   clubs          id, name, description, book_id, current_chapter, is_public
//   books          id, title, cover_url, authors
//   club_memberships club_id, user_id, role, joined_at
//   profiles      id, username, display_name, avatar_url
//   threads        id, club_id, chapter (integer), title, created_by, created_at
//   thread_comments id, thread_id

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { colors, spacing, typography } from '../theme';

export default function ClubDetailScreen({ route, navigation }) {
  const club = route?.params?.club;

  const [selectedTab, setSelectedTab] = useState('discussions');
  const [clubDetails, setClubDetails] = useState(null);
  const [threads, setThreads] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNewThreadModal, setShowNewThreadModal] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [])
  );

  const loadAll = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);
      await Promise.all([fetchClubDetails(), fetchThreads(), fetchMembers()]);
    } finally {
      setLoading(false);
    }
  };

  // Club details with the current book 
  const fetchClubDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('clubs')
        .select('id, name, description, book_id, current_chapter, is_public, owner_id')
        .eq('id', club.id)
        .single();

      if (error) throw error;

      let currentBook = { title: 'No book selected', cover: null, author: '' };
      if (data.book_id) {
        const { data: bookData } = await supabase
          .from('books')
          .select('title, cover_url, authors')
          .eq('id', data.book_id)
          .maybeSingle();

        if (bookData) {
          currentBook = {
            title: bookData.title,
            cover: bookData.cover_url,
            author: Array.isArray(bookData.authors) ? bookData.authors[0] : bookData.authors || '',
          };
        }
      }

      setClubDetails({ ...data, currentBook });
    } catch (error) {
      console.error('Error fetching club details:', error);
    }
  };

  // The threads
  const fetchThreads = async () => {
    try {
      // Get the threads for the book clubs
      const { data: threadData, error } = await supabase
        .from('threads')
        .select('id, chapter, title, created_by, created_at')
        .eq('club_id', club.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!threadData || threadData.length === 0) {
        setThreads([]);
        return;
      }

      // Get creator profiles for all threads
      const creatorIds = [...new Set(threadData.map(t => t.created_by))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', creatorIds);

      const profileMap = {};
      (profiles || []).forEach(p => { profileMap[p.id] = p; });

      // Get comment counts for all threads
      const threadIds = threadData.map(t => t.id);
      const commentCounts = {};
      for (const tid of threadIds) {
        const { count } = await supabase
          .from('thread_comments')
          .select('*', { count: 'exact', head: true })
          .eq('thread_id', tid);
        commentCounts[tid] = count || 0;
      }

      const enriched = threadData.map(t => {
        const profile = profileMap[t.created_by];
        const displayName = profile?.display_name || profile?.username || 'Unknown';
        const avatarUrl = profile?.avatar_url ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=4A4A4A&color=fff`;

        return {
          id: t.id,
          chapter: t.chapter != null ? `Chapter ${t.chapter}` : 'General Discussion',
          chapterNumber: t.chapter,
          title: t.title,
          createdBy: displayName,
          creatorAvatar: avatarUrl,
          replyCount: commentCounts[t.id] ?? 0,
          createdAt: t.created_at,
          lastActivity: formatRelativeTime(t.created_at),
        };
      });

      setThreads(enriched);
    } catch (error) {
      console.error('Error fetching threads:', error);
      setThreads([]);
    }
  };

  // Members 
  const fetchMembers = async () => {
    try {
      // club_memberships is (club_id, user_id)
      const { data: memberData, error } = await supabase
        .from('club_memberships')
        .select('user_id, role, joined_at')
        .eq('club_id', club.id);

      if (error) throw error;
      if (!memberData || memberData.length === 0) {
        setMembers([]);
        return;
      }

      const userIds = memberData.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', userIds);

      const profileMap = {};
      (profiles || []).forEach(p => { profileMap[p.id] = p; });

      const enriched = memberData.map(m => {
        const profile = profileMap[m.user_id];
        const displayName = profile?.display_name || profile?.username || 'Unknown Reader';
        return {
          userId: m.user_id,
          role: m.role,
          joinedAt: m.joined_at,
          displayName,
          avatarUrl: profile?.avatar_url ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=4A4A4A&color=fff`,
        };
      });

      setMembers(enriched);
    } catch (error) {
      console.error('Error fetching members:', error);
      setMembers([]);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const handleThreadPress = (thread) => {
    navigation.navigate('DiscussionThread', { thread, club });
  };

  const handleNewThread = () => {
    setShowNewThreadModal(true);
  };

  const displayName = clubDetails?.name || club?.name || 'Club';
  const currentBook = clubDetails?.currentBook || club?.currentBook;
  const memberCount = members.length;
  const isPublic = clubDetails?.is_public ?? club?.isPublic ?? true;

  return (
    <View style={styles.container}>
      {/* Club Header */}
      <View style={styles.header}>
        {currentBook?.cover ? (
          <Image source={{ uri: currentBook.cover }} style={styles.bookCover} />
        ) : (
          <View style={[styles.bookCover, styles.bookCoverPlaceholder]}>
            <Ionicons name="book" size={32} color={colors.secondary} />
          </View>
        )}

        <View style={styles.headerInfo}>
          <Text style={styles.clubName}>{displayName}</Text>
          {clubDetails?.description ? (
            <Text style={styles.clubDescription} numberOfLines={2}>
              {clubDetails.description}
            </Text>
          ) : null}

          <View style={styles.stats}>
            <View style={styles.stat}>
              <Ionicons name="people" size={14} color={colors.secondary} />
              <Text style={styles.statText}>{memberCount} member{memberCount !== 1 ? 's' : ''}</Text>
            </View>
            <View style={styles.stat}>
              <Ionicons name={isPublic ? 'globe-outline' : 'lock-closed-outline'} size={14} color={colors.secondary} />
              <Text style={styles.statText}>{isPublic ? 'Public' : 'Private'}</Text>
            </View>
          </View>

          <View style={styles.currentBookInfo}>
            <Text style={styles.currentBookLabel}>Currently Reading:</Text>
            <Text style={styles.currentBookTitle} numberOfLines={1}>
              {currentBook?.title || 'No book selected'}
            </Text>
            {currentBook?.author ? (
              <Text style={styles.currentBookAuthor}>by {currentBook.author}</Text>
            ) : null}
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {['discussions', 'members'].map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, selectedTab === tab && styles.tabActive]}
            onPress={() => setSelectedTab(tab)}
          >
            <Ionicons
              name={tab === 'discussions' ? 'chatbubbles' : 'people'}
              size={18}
              color={selectedTab === tab ? colors.buttonPrimary : colors.secondary}
            />
            <Text style={[styles.tabText, selectedTab === tab && styles.tabTextActive]}>
              {tab === 'discussions'
                ? `Discussions (${threads.length})`
                : `Members (${memberCount})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {selectedTab === 'discussions' ? (
          <View style={styles.content}>
            <TouchableOpacity style={styles.newThreadButton} onPress={handleNewThread}>
              <Ionicons name="add-circle" size={20} color={colors.buttonPrimary} />
              <Text style={styles.newThreadButtonText}>Start New Discussion</Text>
            </TouchableOpacity>

            {loading ? (
              <Text style={styles.loadingText}>Loading discussions...</Text>
            ) : threads.length > 0 ? (
              threads.map(thread => (
                <ThreadCard
                  key={thread.id}
                  thread={thread}
                  onPress={() => handleThreadPress(thread)}
                />
              ))
            ) : (
              <EmptyState
                icon="chatbubbles-outline"
                title="No discussions yet"
                message="Be the first to start a discussion!"
              />
            )}
          </View>
        ) : (
          <View style={styles.content}>
            {loading ? (
              <Text style={styles.loadingText}>Loading members...</Text>
            ) : members.length > 0 ? (
              members.map(member => (
                <MemberCard
                  key={member.userId}
                  member={member}
                  isCurrentUser={member.userId === currentUserId}
                />
              ))
            ) : (
              <EmptyState icon="people-outline" title="No members found" message="" />
            )}
          </View>
        )}
        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      {/* New Thread Modal */}
      <NewThreadModal
        visible={showNewThreadModal}
        clubId={club.id}
        currentChapter={clubDetails?.current_chapter}
        onClose={() => setShowNewThreadModal(false)}
        onSuccess={() => {
          setShowNewThreadModal(false);
          fetchThreads();
        }}
      />
    </View>
  );
}

// Thread Card 

function ThreadCard({ thread, onPress }) {
  return (
    <TouchableOpacity style={styles.threadCard} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.threadHeader}>
        <View style={styles.chapterBadge}>
          <Text style={styles.chapterText}>{thread.chapter}</Text>
        </View>
        <Text style={styles.threadTime}>{thread.lastActivity}</Text>
      </View>

      <Text style={styles.threadTitle}>{thread.title}</Text>

      <View style={styles.threadFooter}>
        <View style={styles.threadAuthor}>
          <Image source={{ uri: thread.creatorAvatar }} style={styles.authorAvatar} />
          <Text style={styles.authorName}>{thread.createdBy}</Text>
        </View>
        <View style={styles.threadStat}>
          <Ionicons name="chatbubble-outline" size={14} color={colors.secondary} />
          <Text style={styles.threadStatText}>
            {thread.replyCount} {thread.replyCount === 1 ? 'reply' : 'replies'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// Member Card

function MemberCard({ member, isCurrentUser }) {
  return (
    <View style={styles.memberCard}>
      <Image source={{ uri: member.avatarUrl }} style={styles.memberAvatar} />
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>
          {member.displayName}{isCurrentUser ? ' (You)' : ''}
        </Text>
        <Text style={styles.memberRole}>{member.role}</Text>
      </View>
    </View>
  );
}

// Empty State

function EmptyState({ icon, title, message }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name={icon} size={56} color={colors.border} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={styles.emptyText}>{message}</Text> : null}
    </View>
  );
}

// New Thread Modal

function NewThreadModal({ visible, clubId, currentChapter, onClose, onSuccess }) {
  const [title, setTitle] = useState('');
  const [chapter, setChapter] = useState(
    currentChapter != null ? String(currentChapter) : ''
  );
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Missing title', 'Please enter a discussion title.');
      return;
    }

    const chapterNum = chapter.trim() ? parseInt(chapter.trim(), 10) : null;
    if (chapter.trim() && isNaN(chapterNum)) {
      Alert.alert('Invalid chapter', 'Chapter must be a number.');
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { Alert.alert('Not logged in'); return; }

      const { error } = await supabase
        .from('threads')
        .insert({
          club_id: clubId,
          title: title.trim(),
          chapter: chapterNum,
          created_by: user.id,
        });

      if (error) throw error;

      setTitle('');
      setChapter(currentChapter != null ? String(currentChapter) : '');
      onSuccess();
    } catch (error) {
      console.error('Error creating thread:', error);
      Alert.alert('Error', 'Failed to create discussion. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Discussion</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Discussion Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. What did you think of the ending?"
                value={title}
                onChangeText={setTitle}
                maxLength={200}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Chapter (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 5"
                value={chapter}
                onChangeText={setChapter}
                keyboardType="numeric"
                maxLength={4}
              />
              <Text style={styles.inputHint}>
                Leave blank for a general discussion not tied to a chapter.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.createButton, loading && styles.buttonDisabled]}
              onPress={handleCreate}
              disabled={loading}
            >
              <Text style={styles.createButtonText}>
                {loading ? 'Posting...' : 'Post Discussion'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
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
  header: { flexDirection: 'row', padding: spacing.lg, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  bookCover: { width: 80, height: 120, borderRadius: 8, backgroundColor: colors.background },
  bookCoverPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  headerInfo: { flex: 1, marginLeft: spacing.md },
  clubName: { fontSize: typography.fontSizes.xl, fontWeight: typography.fontWeights.bold, color: colors.primary, marginBottom: spacing.xs },
  clubDescription: { fontSize: typography.fontSizes.sm, color: colors.secondary, marginBottom: spacing.sm },
  stats: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: typography.fontSizes.xs, color: colors.secondary },
  currentBookInfo: { paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  currentBookLabel: { fontSize: typography.fontSizes.xs, color: colors.secondary, marginBottom: 2 },
  currentBookTitle: { fontSize: typography.fontSizes.sm, fontWeight: typography.fontWeights.semibold, color: colors.primary },
  currentBookAuthor: { fontSize: typography.fontSizes.xs, color: colors.secondary, marginTop: 2 },

  // Tabs
  tabs: { flexDirection: 'row', backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.md, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.buttonPrimary },
  tabText: { fontSize: typography.fontSizes.sm, color: colors.secondary, fontWeight: typography.fontWeights.medium },
  tabTextActive: { color: colors.buttonPrimary, fontWeight: typography.fontWeights.semibold },

  // Content
  scrollView: { flex: 1 },
  content: { padding: spacing.lg },
  loadingText: { textAlign: 'center', color: colors.secondary, marginTop: spacing.xxl },

  // New Thread Button
  newThreadButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: colors.surface, paddingVertical: spacing.md, borderRadius: 8, borderWidth: 1, borderColor: colors.buttonPrimary, marginBottom: spacing.lg },
  newThreadButtonText: { fontSize: typography.fontSizes.base, fontWeight: typography.fontWeights.semibold, color: colors.buttonPrimary },

  // Thread Card
  threadCard: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  threadHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  chapterBadge: { backgroundColor: colors.background, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  chapterText: { fontSize: typography.fontSizes.xs, fontWeight: typography.fontWeights.medium, color: colors.primary },
  threadTime: { fontSize: typography.fontSizes.xs, color: colors.secondary },
  threadTitle: { fontSize: typography.fontSizes.base, fontWeight: typography.fontWeights.semibold, color: colors.primary, marginBottom: spacing.sm, lineHeight: typography.fontSizes.base * typography.lineHeights.relaxed },
  threadFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  threadAuthor: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  authorAvatar: { width: 24, height: 24, borderRadius: 12 },
  authorName: { fontSize: typography.fontSizes.xs, color: colors.secondary },
  threadStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  threadStatText: { fontSize: typography.fontSizes.xs, color: colors.secondary },

  // Member Card
  memberCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, backgroundColor: colors.surface, borderRadius: 8, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  memberAvatar: { width: 44, height: 44, borderRadius: 22, marginRight: spacing.md },
  memberInfo: { flex: 1 },
  memberName: { fontSize: typography.fontSizes.base, fontWeight: typography.fontWeights.semibold, color: colors.primary },
  memberRole: { fontSize: typography.fontSizes.xs, color: colors.secondary, marginTop: 2, textTransform: 'capitalize' },

  // Empty State
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, marginTop: spacing.xl },
  emptyTitle: { fontSize: typography.fontSizes.lg, fontWeight: typography.fontWeights.semibold, color: colors.primary, marginTop: spacing.md, marginBottom: spacing.sm },
  emptyText: { fontSize: typography.fontSizes.sm, color: colors.secondary, textAlign: 'center' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: typography.fontSizes.xl, fontWeight: typography.fontWeights.bold, color: colors.primary },
  modalContent: { padding: spacing.lg },
  inputGroup: { marginBottom: spacing.lg },
  inputLabel: { fontSize: typography.fontSizes.base, fontWeight: typography.fontWeights.medium, color: colors.primary, marginBottom: spacing.sm },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.md, fontSize: typography.fontSizes.base, color: colors.primary },
  inputHint: { fontSize: typography.fontSizes.xs, color: colors.secondary, marginTop: spacing.xs },
  modalActions: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  cancelButton: { flex: 1, paddingVertical: spacing.md, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cancelButtonText: { fontSize: typography.fontSizes.base, fontWeight: typography.fontWeights.semibold, color: colors.primary },
  createButton: { flex: 1, paddingVertical: spacing.md, borderRadius: 8, backgroundColor: colors.buttonPrimary, alignItems: 'center' },
  createButtonText: { fontSize: typography.fontSizes.base, fontWeight: typography.fontWeights.semibold, color: colors.buttonText },
  buttonDisabled: { opacity: 0.5 },
});