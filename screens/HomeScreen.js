import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ImageBackground, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { colors, typography, spacing } from '../theme';

// Sample book data, later we'll replace this with Google Books API
const SAMPLE_BOOKS = [
  {
    id: 1,
    title: 'IT',
    author: 'Stephen King',
    rating: 4.24,
    cover: 'https://covers.openlibrary.org/b/isbn/9780451149510-L.jpg',
    currentPage: 721,
    totalPages: 1184,
    description: 'Welcome to Derry, Maine. It\'s a small city, a place as hauntingly familiar as your own hometown. Only in Derry the haunting is real. They were seven teenagers when they first stumbled upon the horror. Now they are grown-up men and women who have gone out into the big world to gain success and happiness. But the promise they made twenty-eight years ago calls them reunite in the same place where, as teenagers, they battled an evil creature that preyed on the city\'s children.',
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
    description: 'In the ruins of a place once known as North America lies the nation of Panem, a shining Capitol surrounded by twelve outlying districts. The Capitol keeps the districts in line by forcing them all to send one boy and one girl between the ages of twelve and eighteen to participate in the annual Hunger Games, a fight to the death on live TV.',
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
    description: 'The Great Gatsby, F. Scott Fitzgerald\'s third book, stands as the supreme achievement of his career. The story of the mysteriously wealthy Jay Gatsby and his love for the beautiful Daisy Buchanan is an exquisitely crafted tale of America in the 1920s.',
    genres: ['Classic', 'Fiction', 'Romance'],
    isbn: '9780140007466',
  },
  {
    id: 4,
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    rating: 4.28,
    cover: 'https://covers.openlibrary.org/b/isbn/9780141439518-L.jpg',
    currentPage: 0,
    totalPages: 432,
    description: 'A beloved classic about love, class, and first impressions.',
    genres: ['Classic', 'Romance'],
    isbn: '9780141439518',
  },
  {
    id: 5,
    title: '1984',
    author: 'George Orwell',
    rating: 4.18,
    cover: 'https://covers.openlibrary.org/b/isbn/9780451524935-L.jpg',
    currentPage: 0,
    totalPages: 328,
    description: 'A dystopian novel of surveillance, truth, and control.',
    genres: ['Dystopian', 'Classic'],
    isbn: '9780451524935',
  },
  {
    id: 6,
    title: 'The Hobbit',
    author: 'J.R.R. Tolkien',
    rating: 4.27,
    cover: 'https://covers.openlibrary.org/b/isbn/9780547928227-L.jpg',
    currentPage: 0,
    totalPages: 300,
    description: 'A fantasy adventure that starts in a quiet hobbit-hole.',
    genres: ['Fantasy', 'Adventure'],
    isbn: '9780547928227',
  },
  {
    id: 7,
    title: 'The Night Circus',
    author: 'Erin Morgenstern',
    rating: 4.04,
    cover: 'https://covers.openlibrary.org/b/isbn/9780307744432-L.jpg',
    currentPage: 0,
    totalPages: 387,
    description: 'A magical competition unfolds inside a mysterious circus.',
    genres: ['Fantasy', 'Romance'],
    isbn: '9780307744432',
  },
  {
    id: 8,
    title: 'Dune',
    author: 'Frank Herbert',
    rating: 4.26,
    cover: 'https://covers.openlibrary.org/b/isbn/9780441172719-L.jpg',
    currentPage: 0,
    totalPages: 688,
    description: 'An epic science fiction saga of power, prophecy, and survival.',
    genres: ['Science Fiction'],
    isbn: '9780441172719',
  },
  {
    id: 9,
    title: 'Rebecca',
    author: 'Daphne du Maurier',
    rating: 4.24,
    cover: 'https://covers.openlibrary.org/b/isbn/9780380730407-L.jpg',
    currentPage: 0,
    totalPages: 449,
    description: 'A gothic mystery centered around a haunting memory.',
    genres: ['Mystery', 'Classic'],
    isbn: '9780380730407',
  },
  {
    id: 10,
    title: 'Circe',
    author: 'Madeline Miller',
    rating: 4.23,
    cover: 'https://covers.openlibrary.org/b/isbn/9780316556347-L.jpg',
    currentPage: 0,
    totalPages: 393,
    description: 'A mythological retelling about identity, exile, and power.',
    genres: ['Fantasy', 'Mythology'],
    isbn: '9780316556347',
  },
  {
    id: 11,
    title: 'Normal People',
    author: 'Sally Rooney',
    rating: 3.82,
    cover: 'https://covers.openlibrary.org/b/isbn/9781984822178-L.jpg',
    currentPage: 0,
    totalPages: 266,
    description: 'A contemporary story of love and emotional complexity.',
    genres: ['Fiction', 'Romance'],
    isbn: '9781984822178',
  },
  {
    id: 12,
    title: 'Home Body',
    author: 'Rupi Kaur',
    rating: 4.10,
    cover: 'https://covers.openlibrary.org/b/isbn/9781449486808-L.jpg',
    currentPage: 0,
    totalPages: 192,
    description: 'Poetry and reflections on self, healing, and belonging.',
    genres: ['Poetry'],
    isbn: '9781449486808',
  },
];

export default function HomeScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [currentlyReading, setCurrentlyReading] = useState([]);

  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const fallbackUsername =
          user.user_metadata?.username ||
          (user.email ? user.email.split('@')[0] : null) ||
          'Reader';

        // Fetch user's profile for personalized greeting
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('username, display_name')
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

      
      };
      fetchData();
    }, [])
  );

  const handleBookPress = (book) => {
    navigation.navigate('BookDetails', { book });
  };

  const handleBeginReading = (book) => {
    console.log('Begin reading:', book.title);
    alert(`Starting to read: ${book.title}\n(Reading view coming soon!)`);
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
              Welcome, {profile?.username || profile?.display_name || 'Reader'}
            </Text>
            <Text style={styles.subtitle}>
              Discover your next great read
            </Text>
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
                  <Image
                    source={{ uri: book?.cover_url }}
                    style={styles.currentlyReadingCover}
                    resizeMode="cover"
                  />
                  <View style={styles.currentlyReadingInfo}>
                    <Text style={styles.bookTitle} numberOfLines={2}>
                      {book?.title}
                    </Text>
                    <Text style={styles.bookAuthor}>{authors}</Text>

                    {/* Progress Bar */}
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

        {/* Recommended for You Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recommended for You</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.sectionCard}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.horizontalScroll}
            >
              {SAMPLE_BOOKS.map((book) => (
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

        {/* Popular This Week Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Popular This Week</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.sectionCard}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.horizontalScroll}
            >
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

// Book Card Component — unchanged
function BookCard({ book, onPress, onBeginReading }) {
  return (
    <TouchableOpacity
      style={styles.bookCard}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.bookCoverShadow}>
        <Image
          source={{ uri: book.cover }}
          style={styles.bookCover}
          resizeMode="cover"
        />
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>{book.title}</Text>
      <Text style={styles.cardAuthor} numberOfLines={1}>{book.author}</Text>

      {/* Star Rating */}
      <View style={styles.ratingContainer}>
        <Ionicons name="star" size={14} color="#FFD700" />
        <Text style={styles.ratingText}>{book.rating}</Text>
      </View>

      <TouchableOpacity
        style={styles.beginButton}
        onPress={(e) => {
          e.stopPropagation();
          onBeginReading();
        }}
      >
        <Text style={styles.beginButtonText}>
          {book.currentPage > 0 ? 'Continue' : 'Begin Reading'}
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
});