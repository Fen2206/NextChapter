// CommunityScreen.js 

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
  ImageBackground,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { colors, spacing, typography } from '../theme';

export default function CommunityScreen({ navigation }) {
  const [selectedTab, setSelectedTab] = useState('myClubs');
  const [myClubs, setMyClubs] = useState([]);
  const [discoverClubs, setDiscoverClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchAllData();
    }, [])
  );

  const fetchAllData = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchMyClubs(), fetchDiscoverClubs()]);
    } catch (error) {
      console.error('Error fetching club data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyClubs = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: memberData, error: memberError } = await supabase
        .from('club_memberships')
        .select('club_id')
        .eq('user_id', user.id);

      if (memberError) throw memberError;
      if (!memberData || memberData.length === 0) {
        setMyClubs([]);
        return;
      }

      const clubIds = memberData.map(m => m.club_id);

      const { data: clubsData, error: clubsError } = await supabase
        .from('clubs')
        .select('id, name, description, book_id, is_public, created_at')
        .in('id', clubIds);

      if (clubsError) throw clubsError;

      const clubsWithDetails = [];
      for (const club of clubsData || []) {
        let currentBook = {
          title: 'No book selected',
          cover: 'https://via.placeholder.com/150x225?text=No+Book',
        };

        if (club.book_id) {
          const { data: bookData } = await supabase
            .from('books')
            .select('title, cover_url, authors')
            .eq('id', club.book_id)
            .maybeSingle();

          if (bookData) {
            currentBook = {
              title: bookData.title,
              cover: bookData.cover_url || 'https://via.placeholder.com/150x225?text=No+Image',
              author: Array.isArray(bookData.authors) ? bookData.authors[0] : bookData.authors,
            };
          }
        }

        const { count: memberCount } = await supabase
          .from('club_memberships')
          .select('*', { count: 'exact', head: true })
          .eq('club_id', club.id);

        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count: unreadCount } = await supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .eq('club_id', club.id)
          .gte('created_at', yesterday);

        clubsWithDetails.push({
          id: club.id,
          name: club.name,
          description: club.description,
          currentBook,
          memberCount: memberCount || 0,
          unreadMessages: unreadCount || 0,
          lastActivity: '2 hours ago',
          isActive: true,
        });
      }

      setMyClubs(clubsWithDetails);
    } catch (error) {
      console.error('Error fetching my clubs:', error);
      setMyClubs([]);
    }
  };

  const fetchDiscoverClubs = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let userClubIds = [];

      if (user) {
        const { data: memberData } = await supabase
          .from('club_memberships')
          .select('club_id')
          .eq('user_id', user.id);
        userClubIds = (memberData || []).map(m => m.club_id);
      }

      const { data: publicClubs, error } = await supabase
        .from('clubs')
        .select('id, name, description, book_id, is_public, created_at')
        .eq('is_public', true)
        .limit(20);

      if (error) throw error;

      const filteredClubs = (publicClubs || []).filter(
        club => !userClubIds.includes(club.id)
      );

      const clubsWithDetails = [];
      for (const club of filteredClubs) {
        let currentBook = {
          title: 'No book selected',
          cover: 'https://via.placeholder.com/150x225?text=No+Book',
          author: '',
        };

        if (club.book_id) {
          const { data: bookData } = await supabase
            .from('books')
            .select('title, cover_url, authors')
            .eq('id', club.book_id)
            .maybeSingle();

          if (bookData) {
            currentBook = {
              title: bookData.title,
              cover: bookData.cover_url || 'https://via.placeholder.com/150x225?text=No+Image',
              author: Array.isArray(bookData.authors) ? bookData.authors[0] : bookData.authors || 'Unknown',
            };
          }
        }

        const { count: memberCount } = await supabase
          .from('club_memberships')
          .select('*', { count: 'exact', head: true })
          .eq('club_id', club.id);

        clubsWithDetails.push({
          id: club.id,
          name: club.name,
          description: club.description || 'Join this book club!',
          currentBook,
          memberCount: memberCount || 0,
          isPublic: club.is_public,
        });
      }

      // Sort by the member count so the most popular clubs appear first
      clubsWithDetails.sort((a, b) => b.memberCount - a.memberCount);

      setDiscoverClubs(clubsWithDetails);
    } catch (error) {
      console.error('Error fetching discover clubs:', error);
      setDiscoverClubs([]);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAllData();
    setRefreshing(false);
  };

  const handleClubPress = (club) => {
    navigation.navigate('ClubDetail', { club });
  };

  const handleJoinClub = async (club) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Not Logged In', 'Please log in to join clubs');
        return;
      }

      const { data: existingMember } = await supabase
        .from('club_memberships')
        .select('user_id')
        .eq('club_id', club.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingMember) {
        Alert.alert('Already a Member', 'You are already a member of this club!');
        return;
      }

      const { error } = await supabase
        .from('club_memberships')
        .insert({
          club_id: club.id,
          user_id: user.id,
          role: 'member',
        });

      if (error) throw error;

      Alert.alert('Success!', `You joined ${club.name}!\n\nYou can now participate in discussions.`);
      await fetchAllData();
    } catch (error) {
      console.error('Error joining club:', error);

      if (error.code === '23505') {
        Alert.alert('Already a Member', 'You are already a member of this club!');
      } else {
        Alert.alert('Error', `Failed to join club: ${error.message}`);
      }
    }
  };

  const handleCreateClub = () => {
    setShowCreateModal(true);
  };

  return (
    <ImageBackground source={require('../assets/background2.png')} style={styles.backgroundContainer} resizeMode="cover">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Community</Text>
            <Text style={styles.headerSubtitle}>
              {myClubs.length} club{myClubs.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <TouchableOpacity style={styles.createButton} onPress={handleCreateClub}>
            <Ionicons name="add-circle" size={24} color={colors.buttonPrimary} />
            <Text style={styles.createButtonText}>Create</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'myClubs' && styles.tabActive]}
          onPress={() => setSelectedTab('myClubs')}
        >
          <Ionicons
            name="people"
            size={20}
            color={selectedTab === 'myClubs' ? colors.buttonPrimary : colors.secondary}
          />
          <Text style={[styles.tabText, selectedTab === 'myClubs' && styles.tabTextActive]}>
            My Clubs
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, selectedTab === 'discover' && styles.tabActive]}
          onPress={() => setSelectedTab('discover')}
        >
          <Ionicons
            name="compass"
            size={20}
            color={selectedTab === 'discover' ? colors.buttonPrimary : colors.secondary}
          />
          <Text style={[styles.tabText, selectedTab === 'discover' && styles.tabTextActive]}>
            Discover
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {selectedTab === 'myClubs' ? (
          <View style={styles.content}>
            {loading ? (
              <Text style={styles.loadingText}>Loading your clubs...</Text>
            ) : myClubs.length > 0 ? (
              myClubs.map((club) => (
                <MyClubCard key={club.id} club={club} onPress={() => handleClubPress(club)} />
              ))
            ) : (
              <EmptyState
                icon="people-outline"
                title="No clubs yet"
                message="Join or create a book club to get started!"
              />
            )}
          </View>
        ) : (
          <View style={styles.content}>
            <Text style={styles.sectionTitle}>Popular Clubs</Text>
            {loading ? (
              <Text style={styles.loadingText}>Loading clubs...</Text>
            ) : discoverClubs.length > 0 ? (
              discoverClubs.map((club) => (
                <DiscoverClubCard
                  key={club.id}
                  club={club}
                  onPress={() => handleClubPress(club)}
                  onJoin={() => handleJoinClub(club)}
                />
              ))
            ) : (
              <EmptyState
                icon="compass-outline"
                title="No clubs to discover"
                message="Check back later for new clubs!"
              />
            )}
          </View>
        )}
      </ScrollView>

      <CreateClubModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={fetchAllData}
      />
      </View>
    </ImageBackground>
  );
}

// Sub-components
const MyClubCard = ({ club, onPress }) => (
  <TouchableOpacity style={styles.myClubCard} onPress={onPress} activeOpacity={0.8}>
    <Image source={{ uri: club.currentBook.cover }} style={styles.clubBookCover} />
    <View style={styles.myClubInfo}>
      <View style={styles.myClubHeader}>
        <View style={styles.myClubTitleContainer}>
          <Text style={styles.myClubName}>{club.name}</Text>
          {club.isActive && <View style={styles.activeDot} />}
        </View>
        {club.unreadMessages > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{club.unreadMessages}</Text>
          </View>
        )}
      </View>
      <Text style={styles.currentBookLabel}>Currently Reading:</Text>
      <Text style={styles.currentBookTitle} numberOfLines={1}>{club.currentBook.title}</Text>
      <View style={styles.myClubFooter}>
        <View style={styles.myClubStat}>
          <Ionicons name="people-outline" size={14} color={colors.secondary} />
          <Text style={styles.myClubStatText}>{club.memberCount} members</Text>
        </View>
        <Text style={styles.lastActivity}>{club.lastActivity}</Text>
      </View>
    </View>
    <Ionicons name="chevron-forward" size={20} color={colors.secondary} />
  </TouchableOpacity>
);

const DiscoverClubCard = ({ club, onPress, onJoin }) => (
  <TouchableOpacity style={styles.discoverCard} onPress={onPress} activeOpacity={0.8}>
    <Image source={{ uri: club.currentBook.cover }} style={styles.discoverCover} />
    <View style={styles.discoverInfo}>
      <Text style={styles.discoverName}>{club.name}</Text>
      <Text style={styles.discoverDescription} numberOfLines={2}>{club.description}</Text>
      <View style={styles.discoverFooter}>
        <View style={styles.discoverStat}>
          <Ionicons name="people" size={14} color={colors.secondary} />
          <Text style={styles.discoverStatText}>{club.memberCount} members</Text>
        </View>
        <View style={styles.discoverStat}>
          <Ionicons name="book" size={14} color={colors.secondary} />
          <Text style={styles.discoverStatText} numberOfLines={1}>{club.currentBook.title}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.joinButton}
        onPress={(e) => { e.stopPropagation(); onJoin(); }}
      >
        <Ionicons name="add-circle-outline" size={18} color={colors.buttonPrimary} />
        <Text style={styles.joinButtonText}>Join Club</Text>
      </TouchableOpacity>
    </View>
  </TouchableOpacity>
);

const EmptyState = ({ icon, title, message }) => (
  <View style={styles.emptyState}>
    <Ionicons name={icon} size={64} color={colors.border} />
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.emptyText}>{message}</Text>
  </View>
);

function CreateClubModal({ visible, onClose, onSuccess }) {
  const [clubName, setClubName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);

  // Book selection state
  const [selectedBook, setSelectedBook] = useState(null);
  const [showBookSearch, setShowBookSearch] = useState(false);
  const [bookQuery, setBookQuery] = useState('');
  const [bookResults, setBookResults] = useState([]);
  const [bookSearching, setBookSearching] = useState(false);

  // Reset when the modal opens
  useEffect(() => {
    if (visible) {
      setClubName('');
      setDescription('');
      setIsPublic(true);
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
      const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_BOOKS_KEY;
      const url =
        'https://www.googleapis.com/books/v1/volumes?q=' +
        encodeURIComponent(`intitle:${bookQuery.trim()}`) +
        '&printType=books&maxResults=8&orderBy=relevance' +
        (API_KEY ? `&key=${encodeURIComponent(API_KEY)}` : '');
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
    if (!clubName.trim()) {
      Alert.alert('Error', 'Please enter a club name');
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to create a club');
        return;
      }

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

      const { data: clubData, error: clubError } = await supabase
        .from('clubs')
        .insert({
          name: clubName.trim(),
          description: description.trim() || null,
          is_public: isPublic,
          owner_id: user.id,
          book_id: bookId,
        })
        .select()
        .single();

      if (clubError) throw clubError;

      const { error: memberError } = await supabase
        .from('club_memberships')
        .insert({ club_id: clubData.id, user_id: user.id, role: 'member' });

      if (memberError) throw memberError;

      Alert.alert('Success!', `${clubName} has been created!\n\nYou can now invite members and start discussions.`);
      onClose();
      onSuccess();
    } catch (error) {
      console.error('Error creating club:', error);
      Alert.alert('Error', 'Failed to create club. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create Book Club</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Club Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Mystery Lovers Book Club"
                value={clubName}
                onChangeText={setClubName}
                maxLength={100}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="What's your book club about?"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                maxLength={500}
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

            {/* Book selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Starting Book (optional)</Text>

              {selectedBook ? (
                <View style={styles.selectedBookRow}>
                  {selectedBook.cover ? (
                    <Image source={{ uri: selectedBook.cover }} style={styles.selectedBookCover} />
                  ) : (
                    <View style={[styles.selectedBookCover, styles.bookCoverPlaceholder]}>
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
                <TouchableOpacity
                  style={styles.addBookButton}
                  onPress={() => setShowBookSearch(!showBookSearch)}
                >
                  <Ionicons name="add-circle-outline" size={18} color={colors.buttonPrimary} />
                  <Text style={styles.addBookButtonText}>
                    {showBookSearch ? 'Hide search' : 'Attach a starting book'}
                  </Text>
                </TouchableOpacity>
              )}

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
                      style={[styles.bookSearchBtn, !bookQuery.trim() && styles.bookSearchBtnDisabled]}
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
                        <View style={[styles.bookResultCover, styles.bookCoverPlaceholder]}>
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
              style={[styles.createButtonModal, loading && styles.buttonDisabled]}
              onPress={handleCreate}
              disabled={loading}
            >
              <Text style={styles.createButtonModalText}>
                {loading ? 'Creating...' : 'Create Club'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Styles

const styles = StyleSheet.create({
  backgroundContainer: { flex: 1, width: '100%', height: '100%' },
  container: { flex: 1, backgroundColor: 'transparent' },
  header: { backgroundColor: 'rgba(255, 255, 255, 0.48)', paddingHorizontal: spacing.lg, paddingTop: spacing.xxl, paddingBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: typography.fontSizes.xxxl, fontWeight: typography.fontWeights.bold, color: colors.primary },
  headerSubtitle: { fontSize: typography.fontSizes.base, color: colors.secondary, marginTop: spacing.xs, marginBottom: spacing.sm },
  createButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: 8, borderWidth: 1, borderColor: colors.buttonPrimary },
  createButtonText: { fontSize: typography.fontSizes.sm, fontWeight: typography.fontWeights.semibold, color: colors.buttonPrimary },
  tabs: { flexDirection: 'row', backgroundColor: 'rgba(255, 255, 255, 0.44)', borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.md, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.buttonPrimary },
  tabText: { fontSize: typography.fontSizes.sm, color: colors.secondary, fontWeight: typography.fontWeights.medium },
  tabTextActive: { color: colors.buttonPrimary, fontWeight: typography.fontWeights.semibold },
  scrollView: { flex: 1 },
  content: { padding: spacing.lg },
  sectionTitle: { fontSize: typography.fontSizes.xl, fontWeight: typography.fontWeights.semibold, color: colors.primary, marginBottom: spacing.xs },
  sectionSubtitle: { fontSize: typography.fontSizes.sm, color: colors.secondary, marginBottom: spacing.md },
  loadingText: { fontSize: typography.fontSizes.base, color: colors.secondary, textAlign: 'center', marginTop: spacing.xxl },

  // My Club Card
  myClubCard: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  clubBookCover: { width: 60, height: 90, borderRadius: 6, backgroundColor: colors.background },
  myClubInfo: { flex: 1, marginLeft: spacing.md, marginRight: spacing.sm },
  myClubHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xs },
  myClubTitleContainer: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1 },
  myClubName: { fontSize: typography.fontSizes.lg, fontWeight: typography.fontWeights.bold, color: colors.primary },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50' },
  unreadBadge: { backgroundColor: colors.buttonPrimary, borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xs },
  unreadText: { fontSize: typography.fontSizes.xs, fontWeight: typography.fontWeights.bold, color: colors.buttonText },
  currentBookLabel: { fontSize: typography.fontSizes.xs, color: colors.secondary, marginBottom: 2 },
  currentBookTitle: { fontSize: typography.fontSizes.sm, fontWeight: typography.fontWeights.medium, color: colors.primary, marginBottom: spacing.sm },
  myClubFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  myClubStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  myClubStatText: { fontSize: typography.fontSizes.xs, color: colors.secondary },
  lastActivity: { fontSize: typography.fontSizes.xs, color: colors.secondary },

  // Discover Card
  discoverCard: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  discoverCover: { width: 70, height: 105, borderRadius: 6, backgroundColor: colors.background },
  discoverInfo: { flex: 1, marginLeft: spacing.md },
  discoverName: { fontSize: typography.fontSizes.lg, fontWeight: typography.fontWeights.bold, color: colors.primary, marginBottom: spacing.xs },
  discoverDescription: { fontSize: typography.fontSizes.sm, color: colors.secondary, marginBottom: spacing.sm },
  discoverFooter: { gap: spacing.xs, marginBottom: spacing.sm },
  discoverStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  discoverStatText: { fontSize: typography.fontSizes.xs, color: colors.secondary, flex: 1 },
  joinButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: colors.background, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: 8, borderWidth: 1, borderColor: colors.buttonPrimary },
  joinButtonText: { fontSize: typography.fontSizes.sm, fontWeight: typography.fontWeights.semibold, color: colors.buttonPrimary },

  // Empty State
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, marginTop: spacing.xxl },
  emptyTitle: { fontSize: typography.fontSizes.xl, fontWeight: typography.fontWeights.semibold, color: colors.primary, marginTop: spacing.md, marginBottom: spacing.sm },
  emptyText: { fontSize: typography.fontSizes.base, color: colors.secondary, textAlign: 'center' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: typography.fontSizes.xl, fontWeight: typography.fontWeights.bold, color: colors.primary },
  modalContent: { padding: spacing.lg },
  inputGroup: { marginBottom: spacing.lg },
  inputLabel: { fontSize: typography.fontSizes.base, fontWeight: typography.fontWeights.medium, color: colors.primary, marginBottom: spacing.sm },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.md, fontSize: typography.fontSizes.base, color: colors.primary },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  privacyOptions: { gap: spacing.sm },
  privacyOption: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  privacyOptionActive: { borderColor: colors.buttonPrimary, backgroundColor: colors.background },
  privacyOptionText: { fontSize: typography.fontSizes.base, color: colors.primary },
  modalActions: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  cancelButton: { flex: 1, paddingVertical: spacing.md, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cancelButtonText: { fontSize: typography.fontSizes.base, fontWeight: typography.fontWeights.semibold, color: colors.primary },
  createButtonModal: { flex: 1, paddingVertical: spacing.md, borderRadius: 8, backgroundColor: colors.buttonPrimary, alignItems: 'center' },
  createButtonModalText: { fontSize: typography.fontSizes.base, fontWeight: typography.fontWeights.semibold, color: colors.buttonText },
  buttonDisabled: { backgroundColor: colors.border, opacity: 0.6 },

  // Book search styles
  selectedBookRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 8, padding: spacing.sm, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  selectedBookCover: { width: 36, height: 54, borderRadius: 4, backgroundColor: colors.background },
  bookCoverPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  selectedBookInfo: { flex: 1 },
  selectedBookTitle: { fontSize: typography.fontSizes.sm, fontWeight: typography.fontWeights.semibold, color: colors.primary },
  selectedBookAuthor: { fontSize: typography.fontSizes.xs, color: colors.secondary, marginTop: 2 },
  removeBookBtn: { padding: spacing.xs },
  addBookButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm },
  addBookButtonText: { fontSize: typography.fontSizes.sm, fontWeight: typography.fontWeights.medium, color: colors.buttonPrimary },
  inlineBookSearch: { marginTop: spacing.sm, gap: spacing.sm },
  bookSearchRow: { flexDirection: 'row', gap: spacing.sm },
  bookSearchInput: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: typography.fontSizes.base, color: colors.primary },
  bookSearchBtn: { backgroundColor: colors.buttonPrimary, borderRadius: 8, paddingHorizontal: spacing.md, justifyContent: 'center', alignItems: 'center', minWidth: 44 },
  bookSearchBtnDisabled: { backgroundColor: colors.border },
  bookResultCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 10, padding: spacing.sm, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  bookResultCover: { width: 40, height: 60, borderRadius: 4, backgroundColor: colors.background },
  bookResultInfo: { flex: 1 },
  bookResultTitle: { fontSize: typography.fontSizes.sm, fontWeight: typography.fontWeights.semibold, color: colors.primary, marginBottom: 2 },
  bookResultAuthor: { fontSize: typography.fontSizes.xs, color: colors.secondary },
});