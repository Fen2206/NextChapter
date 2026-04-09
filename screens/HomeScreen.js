import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
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

// Sample book data — will be replaced with Google Books API later
const SAMPLE_BOOKS = [
  {
    id: 1,
    title: 'IT',
    author: 'Stephen King',
    rating: 4.24,
    cover: 'https://covers.openlibrary.org/b/isbn/9780451149510-L.jpg',
    currentPage: 721,
    totalPages: 1184,
    description: 'Welcome to Derry, Maine...',
    genres: ['Horror', 'Fiction', 'Thriller'],
    isbn: '9780451149510',
  },
  {
    id: 2,
    title: 'The Hunger Games',
    author: 'Suzanne Collins',
    rating: 4.32,
    cover: 'https://covers.openlibrary.org/b/isbn/9780439023481-L.jpg',
    currentPage: 0,
    totalPages: 374,
    description: 'In the ruins of a place once known as North America...',
    genres: ['Young Adult', 'Dystopian', 'Science Fiction'],
    isbn: '9780439023481',
  },
  {
    id: 3,
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    rating: 3.93,
    cover: 'https://covers.openlibrary.org/b/isbn/9780140007466-L.jpg',
    currentPage: 0,
    totalPages: 180,
    description: 'The Great Gatsby, F. Scott Fitzgerald\'s third book...',
    genres: ['Classic', 'Fiction', 'Romance'],
    isbn: '9780140007466',
  },
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

        // fetch profile + preferences
        const { data: profileData } = await supabase
          .from('profiles')
          .select('username, display_name, preferences')
          .eq('id', user.id)
          .single();
        setProfile(profileData);

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

      // fetch all public clubs
      const { data: clubs } = await supabase
        .from('clubs')
        .select('id, name, description, genres, is_public')
        .eq('is_public', true);

      if (!clubs) return;

      const filtered = clubs.filter((c) => !alreadyJoined.includes(c.id));

      if (genreLabels.length > 0) {
        // score by genre overlap
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

        // fall back to first 5 public clubs if no genre matches
        setRecommendedClubs(scored.length > 0 ? scored : filtered.slice(0, 5));
      } else {
        // no survey taken yet — show first 5 public clubs
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
    console.log('Begin reading:', book.title);
    alert(`Starting to read: ${book.title}\n(Reading view coming soon!)`);
  };

  const handleClubPress = (club) => {
    navigation.navigate('Community');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>

        {/* Welcome Section */}
        <Text style={styles.title}>
          Welcome, {profile?.display_name || profile?.username || 'Reader'}
        </Text>
        <Text style={styles.subtitle}>Discover your next great read</Text>

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
                  <Image
                    source={{ uri: book?.cover_url }}
                    style={styles.currentlyReadingCover}
                    resizeMode="cover"
                  />
                  <View style={styles.currentlyReadingInfo}>
                    <Text style={styles.bookTitle} numberOfLines={2}>{book?.title}</Text>
                    <Text style={styles.bookAuthor}>{authors}</Text>
                    <View style={styles.progressContainer}>
                      <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${progress}%` }]} />
                      </View>
                      <Text style={styles.progressText}>{progress}%</Text>
                    </View>
                    <Text style={styles.pageCount}>
                      Page {userBook.current_page} of {book?.page_count}
                    </Text>
                    <TouchableOpacity
                      style={styles.continueButton}
                      onPress={() => handleBeginReading(book)}
                    >
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
                    onPress={() => handleClubPress(club)}
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
    </ScrollView>
  );
}

// Book Card — unchanged from original
function BookCard({ book, onPress, onBeginReading }) {
  return (
    <TouchableOpacity style={styles.bookCard} onPress={onPress} activeOpacity={0.8}>
      <Image
        source={{ uri: book.cover || book.cover_url || 'https://via.placeholder.com/140x210?text=No+Cover' }}
        style={styles.bookCover}
        resizeMode="cover"
      />
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

// Club Card for horizontal row
function ClubCard({ club, joined, joining, onPress, onJoin }) {
  return (
    <TouchableOpacity style={styles.clubCard} onPress={onPress} activeOpacity={0.8}>
      {/* Club icon */}
      <View style={styles.clubIconContainer}>
        <Ionicons name="people" size={28} color={colors.buttonPrimary} />
      </View>

      <Text style={styles.clubCardName} numberOfLines={2}>{club.name}</Text>

      {club.description ? (
        <Text style={styles.clubCardDesc} numberOfLines={2}>{club.description}</Text>
      ) : null}

      {/* Genre tags */}
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
        {joining ? (
          <Text style={styles.clubJoinButtonText}>Joining...</Text>
        ) : (
          <Text style={styles.clubJoinButtonText}>{joined ? '✓ Joined' : 'Join Club'}</Text>
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingVertical: spacing.lg,
  },
  title: {
    fontSize: typography.fontSizes.xxxl,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  subtitle: {
    fontSize: typography.fontSizes.base,
    color: colors.secondary,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
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
    color: colors.primary,
  },
  seeAllText: {
    fontSize: typography.fontSizes.sm,
    color: colors.secondary,
    fontWeight: typography.fontWeights.medium,
  },

  // Currently Reading Card
  currentlyReadingCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  currentlyReadingCover: {
    width: 80,
    height: 120,
    borderRadius: 8,
  },
  currentlyReadingInfo: {
    flex: 1,
    marginLeft: spacing.md,
    justifyContent: 'space-between',
  },
  bookTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primary,
  },
  bookAuthor: {
    fontSize: typography.fontSizes.sm,
    color: colors.secondary,
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
    color: colors.secondary,
    width: 35,
  },
  pageCount: {
    fontSize: typography.fontSizes.xs,
    color: colors.secondary,
    marginTop: 2,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.buttonPrimary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    marginTop: spacing.sm,
  },
  continueButtonText: {
    color: colors.buttonText,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    marginRight: spacing.xs,
  },

  // Horizontal scroll rows
  horizontalScroll: {
    paddingLeft: spacing.lg,
  },

  // Book Card
  bookCard: {
    width: 140,
    marginRight: spacing.md,
    backgroundColor: colors.background,
  },
  bookCover: {
    width: 140,
    height: 210,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  cardTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primary,
    marginTop: spacing.sm,
    height: 36,
  },
  cardAuthor: {
    fontSize: typography.fontSizes.xs,
    color: colors.secondary,
    marginTop: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  ratingText: {
    fontSize: typography.fontSizes.xs,
    color: colors.secondary,
    marginLeft: 4,
  },
  beginButton: {
    backgroundColor: colors.buttonPrimary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    marginTop: spacing.sm,
    alignItems: 'center',
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