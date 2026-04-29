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
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBookPickerModal, setShowBookPickerModal] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [activePoll, setActivePoll] = useState(null);
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
      await Promise.all([fetchClubDetails(), fetchThreads(), fetchMembers(), fetchActivePoll()]);
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
        .select('id, chapter, title, created_by, created_at, is_pinned, tag')
        .eq('club_id', club.id)
        .order('is_pinned', { ascending: false })  // pinned threads will always be first
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
          isPinned: t.is_pinned ?? false,
          tag: t.tag ?? null,
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

  const fetchActivePoll = async () => {
    try {
      const { data: pollData, error } = await supabase
        .from('polls')
        .select('id, question, is_active, ends_at, created_by, created_at')
        .eq('club_id', club.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!pollData) { setActivePoll(null); return; }

      // Get options with book details
      const { data: optionsData } = await supabase
        .from('poll_options')
        .select('id, book_id')
        .eq('poll_id', pollData.id);

      const optionsWithBooks = [];
      for (const opt of optionsData || []) {
        const { data: bookData } = await supabase
          .from('books')
          .select('id, title, cover_url, authors')
          .eq('id', opt.book_id)
          .maybeSingle();
        optionsWithBooks.push({
          id: opt.id,
          bookId: opt.book_id,
          title: bookData?.title || 'Unknown',
          cover: bookData?.cover_url || null,
          author: Array.isArray(bookData?.authors) ? bookData.authors[0] : bookData?.authors || '',
        });
      }

      // Get the votes for the poll
      const { data: votesData } = await supabase
        .from('poll_votes')
        .select('option_id, user_id')
        .eq('poll_id', pollData.id);

      // Count the votes for each option
      const voteCounts = {};
      const userVote = votesData?.find(v => v.user_id === currentUserId)?.option_id ?? null;
      (votesData || []).forEach(v => {
        voteCounts[v.option_id] = (voteCounts[v.option_id] || 0) + 1;
      });

      setActivePoll({
        id: pollData.id,
        question: pollData.question,
        isActive: pollData.is_active,
        endsAt: pollData.ends_at,
        createdBy: pollData.created_by,
        options: optionsWithBooks,
        voteCounts,
        userVote,
        totalVotes: (votesData || []).length,
      });
    } catch (error) {
      console.error('Error fetching poll:', error);
      setActivePoll(null);
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

  // Delete club, only the owner can do this!
  const handleDeleteClub = () => {
    Alert.alert(
      'Delete Club',
      `Are you sure you want to delete "${clubDetails?.name}"? This will permanently remove all discussions and members. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete thread comments first
              const { data: threadData } = await supabase
                .from('threads')
                .select('id')
                .eq('club_id', club.id);

              if (threadData && threadData.length > 0) {
                const ids = threadData.map(t => t.id);
                const { error: commentErr } = await supabase
                  .from('thread_comments').delete().in('thread_id', ids);
                if (commentErr) console.warn('Comment delete error:', commentErr);

                const { error: threadErr } = await supabase
                  .from('threads').delete().eq('club_id', club.id);
                if (threadErr) console.warn('Thread delete error:', threadErr);
              }

              // Delete memberships
              const { error: memberErr } = await supabase
                .from('club_memberships').delete().eq('club_id', club.id);
              if (memberErr) console.warn('Membership delete error:', memberErr);

              // Delete the club
              const { error: clubErr } = await supabase
                .from('clubs').delete().eq('id', club.id);

              if (clubErr) {
                console.error('Club delete error:', JSON.stringify(clubErr));
                if (clubErr.code === '42501' || clubErr.message?.includes('policy')) {
                  Alert.alert(
                    'Permission Error',
                    'You need a DELETE policy on the clubs table in Supabase. Go to Authentication → Policies → clubs and add a DELETE policy for owners.'
                  );
                } else {
                  Alert.alert('Error', `Failed to delete club: ${clubErr.message}`);
                }
                return;
              }

              navigation.navigate('CommunityMain');
              setTimeout(() => {
                Alert.alert('Deleted', `"${clubDetails?.name}" has been deleted.`);
              }, 300);
            } catch (error) {
              console.error('Error deleting club:', JSON.stringify(error));
              Alert.alert('Error', 'Failed to delete club. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Leave club, member only
  const handleLeaveClub = () => {
    Alert.alert(
      'Leave Club',
      `Are you sure you want to leave "${clubDetails?.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('club_memberships')
                .delete()
                .eq('club_id', club.id)
                .eq('user_id', currentUserId);
              if (error) throw error;
              Alert.alert('Left Club', `You have left "${clubDetails?.name}".`, [
                { text: 'OK', onPress: () => navigation.navigate('CommunityMain') }
              ]);
            } catch (error) {
              console.error('Error leaving club:', error);
              Alert.alert('Error', 'Failed to leave club. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Options menu
  // Pin / unpin the thread
  const handlePinThread = async (thread) => {
    try {
      const newPinned = !thread.isPinned;
      const { error } = await supabase
        .from('threads')
        .update({ is_pinned: newPinned })
        .eq('id', thread.id);
      if (error) throw error;
      fetchThreads();
    } catch (error) {
      console.error('Error pinning thread:', error);
      Alert.alert('Error', 'Failed to update thread. Please try again.');
    }
  };

  const handleOptionsPress = () => {
    const isOwner = clubDetails?.owner_id === currentUserId;
    if (isOwner) {
      Alert.alert('Club Options', null, [
        { text: 'Edit Club', onPress: () => setShowEditModal(true) },
        { text: 'Set Current Book', onPress: () => setShowBookPickerModal(true) },
        { text: 'Book of the Month Poll', onPress: () => setShowPollModal(true) },
        { text: 'Delete Club', style: 'destructive', onPress: handleDeleteClub },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } else {
      Alert.alert('Club Options', null, [
        { text: 'Leave Club', style: 'destructive', onPress: handleLeaveClub },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const displayName = clubDetails?.name || club?.name || 'Club';
  const currentBook = clubDetails?.currentBook || club?.currentBook;
  const memberCount = members.length;
  const isPublic = clubDetails?.is_public ?? club?.isPublic ?? true;
  const isOwner = clubDetails?.owner_id === currentUserId;

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
          <View style={styles.headerTitleRow}>
            <Text style={styles.clubName}>{displayName}</Text>
            <TouchableOpacity onPress={handleOptionsPress} style={styles.optionsButton}>
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.secondary} />
            </TouchableOpacity>
          </View>

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
            {isOwner && (
              <View style={styles.stat}>
                <Ionicons name="star" size={14} color="#FFD700" />
                <Text style={styles.statText}>Owner</Text>
              </View>
            )}
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
            {/* Active Poll Card */}
            {activePoll && (
              <PollCard
                poll={activePoll}
                currentUserId={currentUserId}
                isOwner={isOwner}
                onVote={async (optionId) => {
                  try {
                    if (activePoll.userVote) {
                      // Change vote, delete the old one and then insert the new one
                      await supabase
                        .from('poll_votes')
                        .delete()
                        .eq('poll_id', activePoll.id)
                        .eq('user_id', currentUserId);
                    }
                    await supabase
                      .from('poll_votes')
                      .insert({ poll_id: activePoll.id, user_id: currentUserId, option_id: optionId });
                    fetchActivePoll();
                  } catch (err) {
                    console.error('Vote error:', err);
                    Alert.alert('Error', 'Failed to cast vote.');
                  }
                }}
                onClose={async () => {
                  try {
                    const winner = activePoll.options.reduce((a, b) =>
                      (activePoll.voteCounts[a.id] || 0) >= (activePoll.voteCounts[b.id] || 0) ? a : b
                    );
                    await supabase.from('polls').update({ is_active: false }).eq('id', activePoll.id);
                    await supabase.from('clubs').update({ book_id: winner.bookId }).eq('id', club.id);
                    Alert.alert('Poll Closed!', `"${winner.title}" has been set as the club's next book! 🎉`);
                    loadAll();
                  } catch (err) {
                    console.error('Close poll error:', err);
                    Alert.alert('Error', 'Failed to close poll.');
                  }
                }}
              />
            )}

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
                  isOwner={isOwner}
                  onPin={handlePinThread}
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
                  isOwner={member.userId === clubDetails?.owner_id}
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

      {/* Edit Club Modal */}
      <EditClubModal
        visible={showEditModal}
        clubDetails={clubDetails}
        onClose={() => setShowEditModal(false)}
        onSuccess={() => {
          setShowEditModal(false);
          loadAll();
        }}
      />

      {/* Book Picker Modal */}
      <BookPickerModal
        visible={showBookPickerModal}
        clubId={club.id}
        onClose={() => setShowBookPickerModal(false)}
        onSuccess={() => {
          setShowBookPickerModal(false);
          loadAll();
        }}
      />

      {/* Poll Creation Modal */}
      <CreatePollModal
        visible={showPollModal}
        clubId={club.id}
        onClose={() => setShowPollModal(false)}
        onSuccess={() => {
          setShowPollModal(false);
          fetchActivePoll();
        }}
      />
    </View>
  );
}

// Thread Card
const TAG_COLORS = {
  'Spoilers':    { bg: '#FFEBEE', text: '#C62828', border: '#EF9A9A' },
  'Question':    { bg: '#E3F2FD', text: '#1565C0', border: '#90CAF9' },
  'Review':      { bg: '#F3E5F5', text: '#6A1B9A', border: '#CE93D8' },
  'Discussion':  { bg: '#E8F5E9', text: '#2E7D32', border: '#A5D6A7' },
  'Announcement':{ bg: '#FFF8E1', text: '#F57F17', border: '#FFE082' },
};

function ThreadCard({ thread, onPress, isOwner, onPin }) {
  const tagStyle = thread.tag ? TAG_COLORS[thread.tag] : null;

  return (
    <View style={[styles.threadCard, thread.isPinned && styles.threadCardPinned]}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={styles.threadCardInner}
      >
      {/* Pinned banner */}
      {thread.isPinned && (
        <View style={styles.pinnedBanner}>
          <Ionicons name="pin" size={12} color="#F57F17" />
          <Text style={styles.pinnedBannerText}>Pinned</Text>
        </View>
      )}

      <View style={styles.threadHeader}>
        <View style={styles.threadBadges}>
          <View style={styles.chapterBadge}>
            <Text style={styles.chapterText}>{thread.chapter}</Text>
          </View>
          {thread.tag && tagStyle && (
            <View style={[styles.tagBadge, { backgroundColor: tagStyle.bg, borderColor: tagStyle.border }]}>
              <Text style={[styles.tagBadgeText, { color: tagStyle.text }]}>{thread.tag}</Text>
            </View>
          )}
        </View>

        <View style={styles.threadHeaderRight}>
          <Text style={styles.threadTime}>{thread.lastActivity}</Text>
          {isOwner && (
            <TouchableOpacity
              onPress={() => onPin(thread)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.pinButton}
            >
              <Ionicons
                name={thread.isPinned ? 'pin' : 'pin-outline'}
                size={16}
                color={thread.isPinned ? '#F57F17' : colors.secondary}
              />
            </TouchableOpacity>
          )}
        </View>
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
    </View>
  );
}

// Member Card

function MemberCard({ member, isCurrentUser, isOwner }) {
  return (
    <View style={styles.memberCard}>
      <Image source={{ uri: member.avatarUrl }} style={styles.memberAvatar} />
      <View style={styles.memberInfo}>
        <View style={styles.memberNameRow}>
          <Text style={styles.memberName}>
            {member.displayName}{isCurrentUser ? ' (You)' : ''}
          </Text>
          {isOwner && (
            <View style={styles.ownerBadge}>
              <Ionicons name="star" size={10} color="#FFD700" />
              <Text style={styles.ownerBadgeText}>Owner</Text>
            </View>
          )}
        </View>
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

// Book Picker Modal
const GOOGLE_BOOKS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_BOOKS_KEY;

function BookPickerModal({ visible, clubId, onClose, onSuccess }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset when the modal opens
  useEffect(() => {
    if (visible) {
      setQuery('');
      setResults([]);
    }
  }, [visible]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    try {
      setSearching(true);
      setResults([]);

      const url =
        'https://www.googleapis.com/books/v1/volumes?q=' +
        encodeURIComponent(`intitle:${query.trim()}`) +
        '&printType=books&maxResults=10&orderBy=relevance' +
        (GOOGLE_BOOKS_API_KEY ? `&key=${encodeURIComponent(GOOGLE_BOOKS_API_KEY)}` : '');

      const res = await fetch(url);
      const data = await res.json();

      const books = (data.items || []).map(item => {
        const info = item.volumeInfo || {};
        return {
          googleId: item.id,
          title: info.title || 'Untitled',
          author: Array.isArray(info.authors) ? info.authors[0] : 'Unknown author',
          cover: info.imageLinks?.thumbnail
            ? info.imageLinks.thumbnail.replace('http://', 'https://')
            : null,
          pageCount: info.pageCount || null,
        };
      });

      setResults(books);
    } catch (err) {
      console.error('Book search error:', err);
      Alert.alert('Error', 'Failed to search books. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectBook = async (book) => {
    try {
      setSaving(true);

      const { data: bookRow, error: bookErr } = await supabase
        .from('books')
        .upsert(
          {
            google_volume_id: book.googleId,
            title: book.title,
            authors: book.author ? [book.author] : null,
            cover_url: book.cover,
            page_count: book.pageCount,
          },
          { onConflict: 'google_volume_id' }
        )
        .select('id')
        .single();

      if (bookErr) throw bookErr;

      // Update's the club's book_id
      const { error: clubErr } = await supabase
        .from('clubs')
        .update({ book_id: bookRow.id })
        .eq('id', clubId);

      if (clubErr) throw clubErr;

      Alert.alert('Book Set!', `"${book.title}" is now the club's current book.`);
      onSuccess();
    } catch (err) {
      console.error('Error setting book:', JSON.stringify(err));
      Alert.alert('Error', 'Failed to set book. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.bookPickerContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Set Current Book</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.bookSearchRow}>
            <TextInput
              style={styles.bookSearchInput}
              placeholder="Search for a book..."
              placeholderTextColor={colors.secondary}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            <TouchableOpacity
              style={[styles.bookSearchBtn, !query.trim() && styles.buttonDisabled]}
              onPress={handleSearch}
              disabled={!query.trim() || searching}
            >
              {searching
                ? <ActivityIndicator size="small" color={colors.buttonText} />
                : <Ionicons name="search" size={18} color={colors.buttonText} />
              }
            </TouchableOpacity>
          </View>

          {/* Results */}
          {saving ? (
            <View style={styles.bookPickerLoading}>
              <ActivityIndicator size="large" color={colors.buttonPrimary} />
              <Text style={styles.bookPickerLoadingText}>Saving...</Text>
            </View>
          ) : results.length > 0 ? (
            <FlatList
              data={results}
              keyExtractor={item => item.googleId}
              contentContainerStyle={styles.bookResultsList}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.bookResultCard}
                  onPress={() => handleSelectBook(item)}
                  activeOpacity={0.8}
                >
                  {item.cover ? (
                    <Image source={{ uri: item.cover }} style={styles.bookResultCover} />
                  ) : (
                    <View style={[styles.bookResultCover, styles.bookResultCoverPlaceholder]}>
                      <Ionicons name="book" size={24} color={colors.secondary} />
                    </View>
                  )}
                  <View style={styles.bookResultInfo}>
                    <Text style={styles.bookResultTitle} numberOfLines={2}>{item.title}</Text>
                    <Text style={styles.bookResultAuthor} numberOfLines={1}>by {item.author}</Text>
                    {item.pageCount ? (
                      <Text style={styles.bookResultPages}>{item.pageCount} pages</Text>
                    ) : null}
                  </View>
                  <Ionicons name="checkmark-circle-outline" size={24} color={colors.buttonPrimary} />
                </TouchableOpacity>
              )}
            />
          ) : searching ? null : (
            <View style={styles.bookPickerEmpty}>
              <Ionicons name="search" size={48} color={colors.border} />
              <Text style={styles.bookPickerEmptyText}>
                Search for a book to set as{'\n'}the club's current read
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// Edit Club Modal
function EditClubModal({ visible, clubDetails, onClose, onSuccess }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && clubDetails) {
      setName(clubDetails.name || '');
      setDescription(clubDetails.description || '');
      setIsPublic(clubDetails.is_public ?? true);
    }
  }, [visible, clubDetails]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Missing name', 'Please enter a club name.');
      return;
    }
    try {
      setLoading(true);
      const { error } = await supabase
        .from('clubs')
        .update({
          name: name.trim(),
          description: description.trim() || null,
          is_public: isPublic,
        })
        .eq('id', clubDetails.id);
      if (error) throw error;
      Alert.alert('Saved!', 'Club details have been updated.');
      onSuccess();
    } catch (error) {
      console.error('Error updating club:', error);
      Alert.alert('Error', 'Failed to update club. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Club</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Club Name *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                maxLength={100}
                placeholder="Club name"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                maxLength={500}
                placeholder="What's your book club about?"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Privacy</Text>
              <View style={styles.privacyOptions}>
                <TouchableOpacity
                  style={[styles.privacyOption, isPublic && styles.privacyOptionActive]}
                  onPress={() => setIsPublic(true)}
                >
                  <Ionicons
                    name={isPublic ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={isPublic ? colors.buttonPrimary : colors.secondary}
                  />
                  <Text style={styles.privacyOptionText}>Public - Anyone can join</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.privacyOption, !isPublic && styles.privacyOptionActive]}
                  onPress={() => setIsPublic(false)}
                >
                  <Ionicons
                    name={!isPublic ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={!isPublic ? colors.buttonPrimary : colors.secondary}
                  />
                  <Text style={styles.privacyOptionText}>Private - Invite only</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.createButton, loading && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={loading}
            >
              <Text style={styles.createButtonText}>
                {loading ? 'Saving...' : 'Save Changes'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// New Thread Modal

function NewThreadModal({ visible, clubId, currentChapter, onClose, onSuccess }) {
  const [title, setTitle] = useState('');
  const [chapter, setChapter] = useState(
    currentChapter != null ? String(currentChapter) : ''
  );
  const [loading, setLoading] = useState(false);

  // Tag selection state
  const [selectedTag, setSelectedTag] = useState(null);

  // Book selection state
  const [selectedBook, setSelectedBook] = useState(null);
  const [showBookSearch, setShowBookSearch] = useState(false);
  const [bookQuery, setBookQuery] = useState('');
  const [bookResults, setBookResults] = useState([]);
  const [bookSearching, setBookSearching] = useState(false);

  // Reset when modal opens
  useEffect(() => {
    if (visible) {
      setTitle('');
      setChapter(currentChapter != null ? String(currentChapter) : '');
      setSelectedTag(null);
      setSelectedBook(null);
      setShowBookSearch(false);
      setBookQuery('');
      setBookResults([]);
    }
  }, [visible]);

  const handleBookSearch = async () => {
    if (!bookQuery.trim()) return;
    try {
      setBookSearching(true);
      setBookResults([]);
      const url =
        'https://www.googleapis.com/books/v1/volumes?q=' +
        encodeURIComponent(`intitle:${bookQuery.trim()}`) +
        '&printType=books&maxResults=8&orderBy=relevance' +
        (GOOGLE_BOOKS_API_KEY ? `&key=${encodeURIComponent(GOOGLE_BOOKS_API_KEY)}` : '');
      const res = await fetch(url);
      const data = await res.json();
      setBookResults((data.items || []).map(item => {
        const info = item.volumeInfo || {};
        return {
          googleId: item.id,
          title: info.title || 'Untitled',
          author: Array.isArray(info.authors) ? info.authors[0] : 'Unknown',
          cover: info.imageLinks?.thumbnail
            ? info.imageLinks.thumbnail.replace('http://', 'https://')
            : null,
          pageCount: info.pageCount || null,
        };
      }));
    } catch (err) {
      Alert.alert('Error', 'Failed to search books.');
    } finally {
      setBookSearching(false);
    }
  };

  const handleSelectBook = (book) => {
    setSelectedBook(book);
    setShowBookSearch(false);
    setBookQuery('');
    setBookResults([]);
  };

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

      let bookId = null;
      if (selectedBook) {
        const { data: bookRow, error: bookErr } = await supabase
          .from('books')
          .upsert(
            {
              google_volume_id: selectedBook.googleId,
              title: selectedBook.title,
              authors: selectedBook.author ? [selectedBook.author] : null,
              cover_url: selectedBook.cover,
              page_count: selectedBook.pageCount,
            },
            { onConflict: 'google_volume_id' }
          )
          .select('id')
          .single();
        if (bookErr) throw bookErr;
        bookId = bookRow.id;
      }

      const { error } = await supabase
        .from('threads')
        .insert({
          club_id: clubId,
          title: title.trim(),
          chapter: chapterNum,
          created_by: user.id,
          book_id: bookId,
          tag: selectedTag,
        });

      if (error) throw error;

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

            {/* Tag selector */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Tag (optional)</Text>
              <View style={styles.tagSelector}>
                {['Spoilers', 'Question', 'Review', 'Discussion', 'Announcement'].map(t => {
                  const tagStyle = TAG_COLORS[t];
                  const isSelected = selectedTag === t;
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[
                        styles.tagOption,
                        { borderColor: tagStyle.border },
                        isSelected && { backgroundColor: tagStyle.bg },
                      ]}
                      onPress={() => setSelectedTag(isSelected ? null : t)}
                    >
                      <Text style={[styles.tagOptionText, { color: isSelected ? tagStyle.text : colors.secondary }]}>
                        {t}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Book selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Book (optional)</Text>

              {selectedBook ? (
                // Show selected book with option to change/remove
                <View style={styles.selectedBookRow}>
                  {selectedBook.cover ? (
                    <Image source={{ uri: selectedBook.cover }} style={styles.selectedBookCover} />
                  ) : (
                    <View style={[styles.selectedBookCover, styles.bookResultCoverPlaceholder]}>
                      <Ionicons name="book" size={16} color={colors.secondary} />
                    </View>
                  )}
                  <View style={styles.selectedBookInfo}>
                    <Text style={styles.selectedBookTitle} numberOfLines={1}>{selectedBook.title}</Text>
                    <Text style={styles.selectedBookAuthor} numberOfLines={1}>by {selectedBook.author}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedBook(null)} style={styles.removeBookBtn}>
                    <Ionicons name="close-circle" size={20} color={colors.secondary} />
                  </TouchableOpacity>
                </View>
              ) : (
                // Show search toggle button
                <TouchableOpacity
                  style={styles.addBookButton}
                  onPress={() => setShowBookSearch(!showBookSearch)}
                >
                  <Ionicons name="add-circle-outline" size={18} color={colors.buttonPrimary} />
                  <Text style={styles.addBookButtonText}>
                    {showBookSearch ? 'Hide search' : 'Attach a book'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Inline book search */}
              {showBookSearch && !selectedBook && (
                <View style={styles.inlineBookSearch}>
                  <View style={styles.bookSearchRow}>
                    <TextInput
                      style={styles.bookSearchInput}
                      placeholder="Search for a book..."
                      placeholderTextColor={colors.secondary}
                      value={bookQuery}
                      onChangeText={setBookQuery}
                      onSubmitEditing={handleBookSearch}
                      returnKeyType="search"
                    />
                    <TouchableOpacity
                      style={[styles.bookSearchBtn, !bookQuery.trim() && styles.buttonDisabled]}
                      onPress={handleBookSearch}
                      disabled={!bookQuery.trim() || bookSearching}
                    >
                      {bookSearching
                        ? <ActivityIndicator size="small" color={colors.buttonText} />
                        : <Ionicons name="search" size={16} color={colors.buttonText} />
                      }
                    </TouchableOpacity>
                  </View>

                  {bookResults.map(book => (
                    <TouchableOpacity
                      key={book.googleId}
                      style={styles.bookResultCard}
                      onPress={() => handleSelectBook(book)}
                      activeOpacity={0.8}
                    >
                      {book.cover ? (
                        <Image source={{ uri: book.cover }} style={styles.bookResultCover} />
                      ) : (
                        <View style={[styles.bookResultCover, styles.bookResultCoverPlaceholder]}>
                          <Ionicons name="book" size={20} color={colors.secondary} />
                        </View>
                      )}
                      <View style={styles.bookResultInfo}>
                        <Text style={styles.bookResultTitle} numberOfLines={2}>{book.title}</Text>
                        <Text style={styles.bookResultAuthor} numberOfLines={1}>by {book.author}</Text>
                      </View>
                      <Ionicons name="checkmark-circle-outline" size={22} color={colors.buttonPrimary} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
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

// Poll Card Component
function PollCard({ poll, currentUserId, isOwner, onVote, onClose }) {
  const totalVotes = poll.totalVotes;

  return (
    <View style={styles.pollCard}>
      <View style={styles.pollHeader}>
        <View style={styles.pollTitleRow}>
          <Ionicons name="ballot" size={18} color={colors.buttonPrimary} />
          <Text style={styles.pollTitle}>{poll.question}</Text>
        </View>
        {isOwner && (
          <TouchableOpacity style={styles.pollCloseBtn} onPress={onClose}>
            <Text style={styles.pollCloseBtnText}>Close & Set Winner</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.pollSubtitle}>
        {totalVotes} vote{totalVotes !== 1 ? 's' : ''} • {poll.userVote ? 'You voted' : 'Tap to vote'}
      </Text>

      {poll.options.map(option => {
        const votes = poll.voteCounts[option.id] || 0;
        const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
        const isSelected = poll.userVote === option.id;

        return (
          <TouchableOpacity
            key={option.id}
            style={[styles.pollOption, isSelected && styles.pollOptionSelected]}
            onPress={() => onVote(option.id)}
            activeOpacity={0.8}
          >
            {/* Progress bar background */}
            <View style={[styles.pollOptionBar, { width: `${pct}%` }]} />

            <View style={styles.pollOptionContent}>
              {option.cover ? (
                <Image source={{ uri: option.cover }} style={styles.pollOptionCover} />
              ) : (
                <View style={[styles.pollOptionCover, styles.pollOptionCoverPlaceholder]}>
                  <Ionicons name="book" size={14} color={colors.secondary} />
                </View>
              )}
              <View style={styles.pollOptionInfo}>
                <Text style={styles.pollOptionTitle} numberOfLines={1}>{option.title}</Text>
                <Text style={styles.pollOptionAuthor} numberOfLines={1}>by {option.author}</Text>
              </View>
              <View style={styles.pollOptionRight}>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={18} color={colors.buttonPrimary} />
                )}
                <Text style={styles.pollOptionPct}>{pct}%</Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// Create Poll Modal
function CreatePollModal({ visible, clubId, onClose, onSuccess }) {
  const [question, setQuestion] = useState('What should we read next?');
  const [bookOptions, setBookOptions] = useState([]);
  const [bookQuery, setBookQuery] = useState('');
  const [bookResults, setBookResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const GOOGLE_BOOKS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_BOOKS_KEY;

  useEffect(() => {
    if (visible) {
      setQuestion('What should we read next?');
      setBookOptions([]);
      setBookQuery('');
      setBookResults([]);
    }
  }, [visible]);

  const handleBookSearch = async () => {
    if (!bookQuery.trim()) return;
    try {
      setSearching(true);
      setBookResults([]);
      const url =
        'https://www.googleapis.com/books/v1/volumes?q=' +
        encodeURIComponent(`intitle:${bookQuery.trim()}`) +
        '&printType=books&maxResults=6&orderBy=relevance' +
        (GOOGLE_BOOKS_API_KEY ? `&key=${encodeURIComponent(GOOGLE_BOOKS_API_KEY)}` : '');
      const res = await fetch(url);
      const data = await res.json();
      setBookResults((data.items || []).map(item => {
        const info = item.volumeInfo || {};
        return {
          googleId: item.id,
          title: info.title || 'Untitled',
          author: Array.isArray(info.authors) ? info.authors[0] : 'Unknown',
          cover: info.imageLinks?.thumbnail?.replace('http://', 'https://') || null,
          pageCount: info.pageCount || null,
        };
      }));
    } catch (err) {
      Alert.alert('Error', 'Failed to search books.');
    } finally {
      setSearching(false);
    }
  };

  const handleAddOption = (book) => {
    if (bookOptions.find(b => b.googleId === book.googleId)) {
      Alert.alert('Already added', 'This book is already in the poll.');
      return;
    }
    if (bookOptions.length >= 5) {
      Alert.alert('Max options', 'You can add up to 5 books per poll.');
      return;
    }
    setBookOptions([...bookOptions, book]);
    setBookQuery('');
    setBookResults([]);
  };

  const handleRemoveOption = (googleId) => {
    setBookOptions(bookOptions.filter(b => b.googleId !== googleId));
  };

  const handleCreate = async () => {
    if (bookOptions.length < 2) {
      Alert.alert('Not enough options', 'Please add at least 2 books to the poll.');
      return;
    }
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { Alert.alert('Not logged in'); return; }

      // Create the poll
      const { data: pollData, error: pollErr } = await supabase
        .from('polls')
        .insert({ club_id: clubId, question: question.trim(), created_by: user.id, is_active: true })
        .select('id')
        .single();
      if (pollErr) throw pollErr;

      // Create poll options
      for (const book of bookOptions) {
        const { data: bookRow, error: bookErr } = await supabase
          .from('books')
          .upsert(
            { google_volume_id: book.googleId, title: book.title, authors: book.author ? [book.author] : null, cover_url: book.cover, page_count: book.pageCount },
            { onConflict: 'google_volume_id' }
          )
          .select('id')
          .single();
        if (bookErr) throw bookErr;

        const { error: optErr } = await supabase
          .from('poll_options')
          .insert({ poll_id: pollData.id, book_id: bookRow.id });
        if (optErr) throw optErr;
      }

      Alert.alert('Poll Created!', 'Members can now vote on the next book! 🗳️');
      onSuccess();
    } catch (err) {
      console.error('Create poll error:', err);
      Alert.alert('Error', 'Failed to create poll. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.bookPickerContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Book of the Month Poll</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Question */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Poll Question</Text>
              <TextInput
                style={styles.input}
                value={question}
                onChangeText={setQuestion}
                maxLength={100}
              />
            </View>

            {/* Selected books */}
            {bookOptions.length > 0 && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Options ({bookOptions.length}/5)</Text>
                {bookOptions.map(book => (
                  <View key={book.googleId} style={styles.pollBookOption}>
                    {book.cover
                      ? <Image source={{ uri: book.cover }} style={styles.pollBookOptionCover} />
                      : <View style={[styles.pollBookOptionCover, { justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface }]}><Ionicons name="book" size={14} color={colors.secondary} /></View>
                    }
                    <View style={styles.pollBookOptionInfo}>
                      <Text style={styles.pollBookOptionTitle} numberOfLines={1}>{book.title}</Text>
                      <Text style={styles.pollBookOptionAuthor} numberOfLines={1}>by {book.author}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleRemoveOption(book.googleId)} style={styles.removeBookBtn}>
                      <Ionicons name="close-circle" size={20} color={colors.secondary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Book search */}
            {bookOptions.length < 5 && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Add a Book</Text>
                <View style={styles.bookSearchRow}>
                  <TextInput
                    style={styles.bookSearchInput}
                    placeholder="Search for a book..."
                    placeholderTextColor={colors.secondary}
                    value={bookQuery}
                    onChangeText={setBookQuery}
                    onSubmitEditing={handleBookSearch}
                    returnKeyType="search"
                  />
                  <TouchableOpacity
                    style={[styles.bookSearchBtn, !bookQuery.trim() && styles.buttonDisabled]}
                    onPress={handleBookSearch}
                    disabled={!bookQuery.trim() || searching}
                  >
                    {searching
                      ? <ActivityIndicator size="small" color={colors.buttonText} />
                      : <Ionicons name="search" size={16} color={colors.buttonText} />
                    }
                  </TouchableOpacity>
                </View>

                {bookResults.map(book => (
                  <TouchableOpacity
                    key={book.googleId}
                    style={styles.bookResultCard}
                    onPress={() => handleAddOption(book)}
                    activeOpacity={0.8}
                  >
                    {book.cover
                      ? <Image source={{ uri: book.cover }} style={styles.bookResultCover} />
                      : <View style={[styles.bookResultCover, styles.bookResultCoverPlaceholder]}><Ionicons name="book" size={20} color={colors.secondary} /></View>
                    }
                    <View style={styles.bookResultInfo}>
                      <Text style={styles.bookResultTitle} numberOfLines={2}>{book.title}</Text>
                      <Text style={styles.bookResultAuthor} numberOfLines={1}>by {book.author}</Text>
                    </View>
                    <Ionicons name="add-circle-outline" size={22} color={colors.buttonPrimary} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.createButton, (loading || bookOptions.length < 2) && styles.buttonDisabled]}
              onPress={handleCreate}
              disabled={loading || bookOptions.length < 2}
            >
              <Text style={styles.createButtonText}>
                {loading ? 'Creating...' : `Create Poll (${bookOptions.length} books)`}
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
  headerTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  clubName: { flex: 1, fontSize: typography.fontSizes.xl, fontWeight: typography.fontWeights.bold, color: colors.primary },
  optionsButton: { padding: spacing.xs, marginLeft: spacing.sm },
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
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  memberName: { fontSize: typography.fontSizes.base, fontWeight: typography.fontWeights.semibold, color: colors.primary },
  ownerBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FFF8E1', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: '#FFD700' },
  ownerBadgeText: { fontSize: typography.fontSizes.xs, color: '#B8860B', fontWeight: typography.fontWeights.semibold },
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
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  inputHint: { fontSize: typography.fontSizes.xs, color: colors.secondary, marginTop: spacing.xs },
  privacyOptions: { gap: spacing.sm },
  privacyOption: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  privacyOptionActive: { borderColor: colors.buttonPrimary, backgroundColor: colors.background },
  privacyOptionText: { fontSize: typography.fontSizes.base, color: colors.primary },
  modalActions: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  cancelButton: { flex: 1, paddingVertical: spacing.md, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cancelButtonText: { fontSize: typography.fontSizes.base, fontWeight: typography.fontWeights.semibold, color: colors.primary },
  createButton: { flex: 1, paddingVertical: spacing.md, borderRadius: 8, backgroundColor: colors.buttonPrimary, alignItems: 'center' },
  createButtonText: { fontSize: typography.fontSizes.base, fontWeight: typography.fontWeights.semibold, color: colors.buttonText },
  buttonDisabled: { opacity: 0.5 },

  // Book Picker Modal
  bookPickerContainer: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '85%' },
  bookSearchRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, paddingTop: 0 },
  bookSearchInput: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: typography.fontSizes.base, color: colors.primary },
  bookSearchBtn: { backgroundColor: colors.buttonPrimary, borderRadius: 8, paddingHorizontal: spacing.md, justifyContent: 'center', alignItems: 'center', minWidth: 44 },
  bookResultsList: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  bookResultCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 10, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  bookResultCover: { width: 50, height: 75, borderRadius: 4, backgroundColor: colors.background },
  bookResultCoverPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  bookResultInfo: { flex: 1 },
  bookResultTitle: { fontSize: typography.fontSizes.sm, fontWeight: typography.fontWeights.semibold, color: colors.primary, marginBottom: 2 },
  bookResultAuthor: { fontSize: typography.fontSizes.xs, color: colors.secondary, marginBottom: 2 },
  bookResultPages: { fontSize: typography.fontSizes.xs, color: colors.secondary },
  bookPickerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  bookPickerLoadingText: { fontSize: typography.fontSizes.base, color: colors.secondary },
  bookPickerEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xxl, gap: spacing.md },

  // Thread pin and tag styles
  threadCardPinned: { borderColor: '#FFE082', borderWidth: 1.5, backgroundColor: '#FFFDF0' },
  threadCardInner: { flex: 1 },
  pinnedBanner: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.sm },
  pinnedBannerText: { fontSize: typography.fontSizes.xs, fontWeight: typography.fontWeights.semibold, color: '#F57F17' },
  threadBadges: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1 },
  threadHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  tagBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 10, borderWidth: 1 },
  tagBadgeText: { fontSize: typography.fontSizes.xs, fontWeight: typography.fontWeights.semibold },
  pinButton: { padding: 4 },
  tagSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tagOption: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  tagOptionText: { fontSize: typography.fontSizes.sm, fontWeight: typography.fontWeights.medium },

  // Selected book in thread modal
  selectedBookRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 8, padding: spacing.sm, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  selectedBookCover: { width: 36, height: 54, borderRadius: 4, backgroundColor: colors.background },
  selectedBookInfo: { flex: 1 },
  selectedBookTitle: { fontSize: typography.fontSizes.sm, fontWeight: typography.fontWeights.semibold, color: colors.primary },
  selectedBookAuthor: { fontSize: typography.fontSizes.xs, color: colors.secondary, marginTop: 2 },
  removeBookBtn: { padding: spacing.xs },
  addBookButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm },
  addBookButtonText: { fontSize: typography.fontSizes.sm, fontWeight: typography.fontWeights.medium, color: colors.buttonPrimary },
  inlineBookSearch: { marginTop: spacing.sm, gap: spacing.sm },
  bookPickerEmptyText: { fontSize: typography.fontSizes.base, color: colors.secondary, textAlign: 'center', lineHeight: typography.fontSizes.base * typography.lineHeights.relaxed },

  // Poll Card
  pollCard: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginBottom: spacing.lg, borderWidth: 1.5, borderColor: colors.buttonPrimary },
  pollHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xs },
  pollTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1 },
  pollTitle: { fontSize: typography.fontSizes.base, fontWeight: typography.fontWeights.bold, color: colors.primary, flex: 1 },
  pollSubtitle: { fontSize: typography.fontSizes.xs, color: colors.secondary, marginBottom: spacing.md },
  pollCloseBtn: { backgroundColor: colors.buttonPrimary, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 8 },
  pollCloseBtnText: { fontSize: typography.fontSizes.xs, color: colors.buttonText, fontWeight: typography.fontWeights.semibold },
  pollOption: { borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm, overflow: 'hidden', position: 'relative', minHeight: 56 },
  pollOptionSelected: { borderColor: colors.buttonPrimary, borderWidth: 1.5 },
  pollOptionBar: { position: 'absolute', top: 0, left: 0, bottom: 0, backgroundColor: '#E8F4FD', borderRadius: 10 },
  pollOptionContent: { flexDirection: 'row', alignItems: 'center', padding: spacing.sm, gap: spacing.sm, position: 'relative' },
  pollOptionCover: { width: 32, height: 48, borderRadius: 4, backgroundColor: colors.background },
  pollOptionCoverPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  pollOptionInfo: { flex: 1 },
  pollOptionTitle: { fontSize: typography.fontSizes.sm, fontWeight: typography.fontWeights.semibold, color: colors.primary },
  pollOptionAuthor: { fontSize: typography.fontSizes.xs, color: colors.secondary, marginTop: 1 },
  pollOptionRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  pollOptionPct: { fontSize: typography.fontSizes.xs, fontWeight: typography.fontWeights.bold, color: colors.buttonPrimary, minWidth: 32, textAlign: 'right' },

  // Poll book options
  pollBookOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 8, padding: spacing.sm, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm, gap: spacing.sm },
  pollBookOptionCover: { width: 32, height: 48, borderRadius: 4, backgroundColor: colors.background },
  pollBookOptionInfo: { flex: 1 },
  pollBookOptionTitle: { fontSize: typography.fontSizes.sm, fontWeight: typography.fontWeights.semibold, color: colors.primary },
  pollBookOptionAuthor: { fontSize: typography.fontSizes.xs, color: colors.secondary, marginTop: 1 },
});