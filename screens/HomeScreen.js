import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ImageBackground, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { colors, typography, spacing } from '../theme';

// map survey genre ids to club genre tags
const GENRE_LABEL_MAP = {
  fiction: 'Fiction',
  nonfiction: 'Non-Fiction',
  mystery: 'Mystery',
  fantasy: 'Fantasy',
  scifi: 'Scifi',
  romance: 'Romance',
  horror: 'Horror',
  thriller: 'Thriller',
  biography: 'Biography',
  selfhelp: 'Self-Help',
  history: 'History',
  poetry: 'Poetry',
};

const SAMPLE_BOOKS = [
  { id: 1, title: 'IT', author: 'Stephen King', rating: 4.24, cover: 'https://covers.openlibrary.org/b/isbn/9780451149510-L.jpg', currentPage: 721, totalPages: 1184, genres: ['Horror', 'Fiction', 'Thriller'], isbn: '9780451149510' },
  { id: 2, title: 'The Hunger Games', author: 'Suzanne Collins', rating: 4.32, cover: 'https://covers.openlibrary.org/b/isbn/9780439023481-L.jpg', currentPage: 0, totalPages: 374, genres: ['Young Adult', 'Dystopian', 'Science Fiction'], isbn: '9780439023481' },
  { id: 3, title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', rating: 3.93, cover: 'https://covers.openlibrary.org/b/isbn/9780140007466-L.jpg', currentPage: 0, totalPages: 180, genres: ['Classic', 'Fiction', 'Romance'], isbn: '9780140007466' },
  { id: 4, title: 'Pride and Prejudice', author: 'Jane Austen', rating: 4.28, cover: 'https://covers.openlibrary.org/b/isbn/9780141439518-L.jpg', currentPage: 0, totalPages: 432, genres: ['Classic', 'Romance'], isbn: '9780141439518' },
  { id: 5, title: '1984', author: 'George Orwell', rating: 4.18, cover: 'https://covers.openlibrary.org/b/isbn/9780451524935-L.jpg', currentPage: 0, totalPages: 328, genres: ['Dystopian', 'Classic'], isbn: '9780451524935' },
  { id: 6, title: 'The Hobbit', author: 'J.R.R. Tolkien', rating: 4.27, cover: 'https://covers.openlibrary.org/b/isbn/9780547928227-L.jpg', currentPage: 0, totalPages: 300, genres: ['Fantasy', 'Adventure'], isbn: '9780547928227' },
  { id: 7, title: 'The Night Circus', author: 'Erin Morgenstern', rating: 4.04, cover: 'https://covers.openlibrary.org/b/isbn/9780307744432-L.jpg', currentPage: 0, totalPages: 387, genres: ['Fantasy', 'Romance'], isbn: '9780307744432' },
  { id: 8, title: 'Dune', author: 'Frank Herbert', rating: 4.26, cover: 'https://covers.openlibrary.org/b/isbn/9780441172719-L.jpg', currentPage: 0, totalPages: 688, genres: ['Science Fiction'], isbn: '9780441172719' },
  { id: 9, title: 'Rebecca', author: 'Daphne du Maurier', rating: 4.24, cover: 'https://covers.openlibrary.org/b/isbn/9780380730407-L.jpg', currentPage: 0, totalPages: 449, genres: ['Mystery', 'Classic'], isbn: '9780380730407' },
  { id: 10, title: 'Circe', author: 'Madeline Miller', rating: 4.23, cover: 'https://covers.openlibrary.org/b/isbn/9780316556347-L.jpg', currentPage: 0, totalPages: 393, genres: ['Fantasy', 'Mythology'], isbn: '9780316556347' },
  { id: 11, title: 'Normal People', author: 'Sally Rooney', rating: 3.82, cover: 'https://covers.openlibrary.org/b/isbn/9781984822178-L.jpg', currentPage: 0, totalPages: 266, genres: ['Fiction', 'Romance'], isbn: '9781984822178' },
  { id: 12, title: 'Home Body', author: 'Rupi Kaur', rating: 4.10, cover: 'https://covers.openlibrary.org/b/isbn/9781449486808-L.jpg', currentPage: 0, totalPages: 192, genres: ['Poetry'], isbn: '9781449486808' },
];

export default function HomeScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [currentlyReading, setCurrentlyReading] = useState([]);
  const [recommendedBooks, setRecommendedBooks] = useState([]);
  const [recommendedClubs, setRecommendedClubs] = useState([]);
  const [joinedClubIds, setJoinedClubIds] = useState([]);
  const [joiningClubId, setJoiningClubId] = useState(null);

  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const fallbackUsername =
          user.user_metadata?.username ||
          (user.email ? user.email.split('@')[0] : null) ||
          'Reader';

        // fetch profile + preferences
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('username, display_name, preferences')
          .eq('id', user.id)
          .single();

        if (profileError || !profileData) {
          setProfile({ username: fallbackUsername, display_name: '' });
        } else {
          setProfile({
            username: profileData.username || fallbackUsername,
            display_name: profileData.display_name || '',
          });
        }

        // load recommended books from survey preferences
        const savedBooks = profileData?.preferences?.recommendedBooks || [];
        setRecommendedBooks(savedBooks);

        // fetch currently reading books
        const { data: readingData } = await supabase
          .from('user_books')
          .select(`
            id,
            current_page,
            status,
            books (
              id,
              title,
              authors,
              cover_url,
              page_count
            )
          `)
          .eq('user_id', user.id)
          .eq('status', 'reading');
        setCurrentlyReading(readingData || []);

        // fetch clubs user is already a member of
        const { data: memberData } = await supabase
          .from('club_memberships')
          .select('club_id')
          .eq('user_id', user.id);
        const alreadyJoined = (memberData || []).map((m) => m.club_id);
        setJoinedClubIds(alreadyJoined);

        // fetch recommended clubs based on survey preferences
        await fetchRecommendedClubs(profileData?.preferences, alreadyJoined);
      };
      fetchData();
    }, [])
  );

  const fetchRecommendedClubs = async (preferences, alreadyJoined = []) => {
    try {
      const userGenres = preferences?.genres || [];
      const genreLabels = userGenres.map((id) => GENRE_LABEL_MAP[id]).filter(Boolean);

      const { data: clubs } = await supabase
        .from('clubs')
        .select('id, name, description, genres, is_public')
        .eq('is_public', true);

      if (!clubs) return;

      const filtered = clubs.filter((c) => !alreadyJoined.includes(c.id));

      if (genreLabels.length > 0) {
        const scored = filtered
          .map((c) => {
            const clubGenres = c.genres || [];
            const overlap = genreLabels.filter((g) =>
              clubGenres.some((cg) => cg.toLowerCase() === g.toLowerCase())
            ).length;
            return { ...c, score: overlap };
          })
          .filter((c) => c.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);

        setRecommendedClubs(scored.length > 0 ? scored : filtered.slice(0, 5));
      } else {
        setRecommendedClubs(filtered.slice(0, 5));
      }
    } catch (err) {
      console.log('Fetch recommended clubs error:', err.message);
    }
  };

  const handleJoinClub = async (clubId) => {
    setJoiningClubId(clubId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('club_memberships')
        .insert({ club_id: clubId, user_id: user.id, role: 'member' });
      if (!error) {
        setJoinedClubIds((prev) => [...prev, clubId]);
      }
    } catch (err) {
      console.log('Join club error:', err.message);
    } finally {
      setJoiningClubId(null);
    }
  };

  const handleBookPress = (book) => {
    navigation.navigate('BookDetails', { book });
  };

  const handleBeginReading = (book) => {
    navigation.navigate('BookDetails', { book });
  };

  const handleClubPress = () => {
    navigation.navigate('Community');
  };

  return (
    <ImageBackground source={require('../assets/background2.png')} style={styles.container} resizeMode="cover">
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>

          {/* Welcome Section */}
          <View style={styles.welcomeRow}>
            <View style={styles.welcomeIconCircle}>
              <Ionicons name="person" size={20} color={colors.buttonText} />
            </View>
            <View style={styles.welcomeTextWrap}>
              <Text style={styles.title}>
                Welcome, {profile?.display_name || profile?.username || 'Reader'}
              </Text>
              <Text style={styles.subtitle}>Discover your next great read</Text>
            </View>
          </View>

          {/* Continue Reading Section */}
          {currentlyReading.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Continue Reading</Text>
              {currentlyReading.map((userBook) => {
                const book = userBook.books;
                const progress = book?.page_count
                  ? Math.round((userBook.current_page / book.page_count) * 100)
                  : 0;
                const authors = Array.isArray(book?.authors)
                  ? book.authors.join(', ')
                  : book?.authors || '';
                return (
                  <TouchableOpacity
                    key={userBook.id}
                    style={styles.currentlyReadingCard}
                    onPress={() => handleBookPress(book)}
                    activeOpacity={0.7}
                  >
                    <Image source={{ uri: book?.cover_url }} style={styles.currentlyReadingCover} resizeMode="cover" />
                    <View style={styles.currentlyReadingInfo}>
                      <Text style={styles.bookTitle} numberOfLines={2}>{book?.title}</Text>
                      <Text style={styles.bookAuthor}>{authors}</Text>
                      <View style={styles.progressContainer}>
                        <View style={styles.progressBar}>
                          <View style={[styles.progressFill, { width: `${progress}%` }]} />
                        </View>
                        <Text style={styles.progressText}>{progress}%</Text>
                      </View>
                      <Text style={styles.pageCount}>Page {userBook.current_page} of {book?.page_count}</Text>
                      <TouchableOpacity style={styles.continueButton} onPress={() => handleBeginReading(book)}>
                        <Text style={styles.continueButtonText}>Continue Reading</Text>
                        <Ionicons name="arrow-forward" size={16} color={colors.buttonText} />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Recommended for You — Books */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recommended for You</Text>
              <TouchableOpacity>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.sectionCard}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                {(recommendedBooks.length > 0 ? recommendedBooks : SAMPLE_BOOKS).map((book) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    onPress={() => handleBookPress(book)}
                    onBeginReading={() => handleBeginReading(book)}
                  />
                ))}
              </ScrollView>
            </View>
          </View>

          {/* Recommended Clubs for You */}
          {recommendedClubs.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recommended Clubs</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Community')}>
                  <Text style={styles.seeAllText}>See All</Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                {recommendedClubs.map((club) => {
                  const joined = joinedClubIds.includes(club.id);
                  const joining = joiningClubId === club.id;
                  return (
                    <ClubCard
                      key={club.id}
                      club={club}
                      joined={joined}
                      joining={joining}
                      onPress={handleClubPress}
                      onJoin={() => handleJoinClub(club.id)}
                    />
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Popular This Week */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Popular This Week</Text>
              <TouchableOpacity>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.sectionCard}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                {SAMPLE_BOOKS.slice().reverse().map((book) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    onPress={() => handleBookPress(book)}
                    onBeginReading={() => handleBeginReading(book)}
                  />
                ))}
              </ScrollView>
            </View>
          </View>

        </View>
      </ScrollView>
    </ImageBackground>
  );
}

function BookCard({ book, onPress, onBeginReading }) {
  return (
    <TouchableOpacity style={styles.bookCard} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.bookCoverShadow}>
        <Image
          source={{ uri: book.cover || book.cover_url || 'https://via.placeholder.com/140x210?text=No+Cover' }}
          style={styles.bookCover}
          resizeMode="cover"
        />
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>{book.title}</Text>
      <Text style={styles.cardAuthor} numberOfLines={1}>
        {Array.isArray(book.author) ? book.author[0] : book.author || ''}
      </Text>
      <View style={styles.ratingContainer}>
        <Ionicons name="star" size={14} color="#FFD700" />
        <Text style={styles.ratingText}>{book.rating ? book.rating.toFixed(2) : 'N/A'}</Text>
      </View>
      <TouchableOpacity
        style={styles.beginButton}
        onPress={(e) => { e.stopPropagation(); onBeginReading(); }}
      >
        <Text style={styles.beginButtonText}>
          {book.currentPage > 0 ? 'Continue' : 'Begin Reading'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function ClubCard({ club, joined, joining, onPress, onJoin }) {
  return (
    <TouchableOpacity style={styles.clubCard} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.clubIconContainer}>
        <Ionicons name="people" size={28} color={colors.buttonPrimary} />
      </View>
      <Text style={styles.clubCardName} numberOfLines={2}>{club.name}</Text>
      {club.description ? (
        <Text style={styles.clubCardDesc} numberOfLines={2}>{club.description}</Text>
      ) : null}
      {club.genres?.length > 0 && (
        <View style={styles.clubGenreRow}>
          {club.genres.slice(0, 2).map((g) => (
            <View key={g} style={styles.clubGenreTag}>
              <Text style={styles.clubGenreTagText}>{g}</Text>
            </View>
          ))}
        </View>
      )}
      <TouchableOpacity
        style={[styles.clubJoinButton, joined && styles.clubJoinButtonDone]}
        onPress={(e) => { e.stopPropagation(); !joined && onJoin(); }}
        disabled={joined || joining}
      >
        <Text style={styles.clubJoinButtonText}>
          {joining ? 'Joining...' : joined ? '✓ Joined' : 'Join Club'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingTop: 72,
    paddingBottom: spacing.lg,
  },
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  welcomeIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.buttonPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  welcomeTextWrap: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: typography.fontWeights.bold,
    color: '#1F1F1F',
    marginBottom: 2,
    fontFamily: 'Georgia',
  },
  subtitle: {
    fontSize: typography.fontSizes.base,
    color: '#666666',
    opacity: 0.8,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    borderRadius: 16,
    marginHorizontal: spacing.xs,
    marginBottom: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.semibold,
    color: '#1F1F1F',
    fontFamily: 'Georgia',
  },
  seeAllText: {
    fontSize: typography.fontSizes.sm,
    color: '#666666',
    fontWeight: typography.fontWeights.medium,
    fontFamily: 'Georgia',
  },

  // Currently Reading Card
  currentlyReadingCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    borderRadius: 12,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  currentlyReadingCover: {
    width: 80,
    height: 120,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 9,
    elevation: 8,
  },
  currentlyReadingInfo: {
    flex: 1,
    marginLeft: spacing.md,
    justifyContent: 'space-between',
  },
  bookTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: '#1F1F1F',
  },
  bookAuthor: {
    fontSize: typography.fontSizes.sm,
    color: '#666666',
    marginTop: 2,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginRight: spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.buttonPrimary,
    borderRadius: 3,
  },
  progressText: {
    fontSize: typography.fontSizes.xs,
    color: '#666666',
    width: 35,
  },
  pageCount: {
    fontSize: typography.fontSizes.xs,
    color: '#666666',
    marginTop: 2,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#581215',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    marginTop: spacing.sm,
    alignSelf: 'center',
  },
  continueButtonText: {
    color: colors.buttonText,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    marginRight: spacing.xs,
  },

  // Book Card Styles
  horizontalScroll: {
    paddingLeft: spacing.lg,
    paddingBottom: spacing.xs,
  },
  bookCard: {
    width: 138,
    marginRight: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    overflow: 'visible',
  },
  bookCoverShadow: {
    borderRadius: 8,
    marginBottom: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 9,
    elevation: 7,
    ...(Platform.OS === 'web' ? { boxShadow: '0px 7px 16px rgba(0, 0, 0, 0.22)' } : {}),
  },
  bookCover: {
    width: 138,
    height: 207,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  cardTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    color: '#1F1F1F',
    marginTop: spacing.sm,
    height: 36,
  },
  cardAuthor: {
    fontSize: typography.fontSizes.xs,
    color: '#666666',
    marginTop: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  ratingText: {
    fontSize: typography.fontSizes.xs,
    color: '#666666',
    marginLeft: 4,
  },
  beginButton: {
    backgroundColor: '#581215',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    marginTop: spacing.sm,
    alignItems: 'center',
    width: 140,
    alignSelf: 'center',
  },
  beginButtonText: {
    color: colors.buttonText,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
  },

  // Club Card
  clubCard: {
    width: 180,
    marginRight: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clubIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: `${colors.buttonPrimary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  clubCardName: {
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  clubCardDesc: {
    fontSize: typography.fontSizes.xs,
    color: colors.secondary,
    lineHeight: 16,
    marginBottom: spacing.sm,
  },
  clubGenreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: spacing.sm,
  },
  clubGenreTag: {
    backgroundColor: colors.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  clubGenreTagText: {
    fontSize: 10,
    color: colors.secondary,
    fontWeight: '500',
  },
  clubJoinButton: {
    backgroundColor: colors.buttonPrimary,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 'auto',
  },
  clubJoinButtonDone: {
    backgroundColor: colors.secondary,
  },
  clubJoinButtonText: {
    color: colors.buttonText,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
  },
});