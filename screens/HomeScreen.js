import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
];

const CURRENTLY_READING = [
  {
    id: 4,
    title: 'The Housemaid',
    author: 'Freida McFadden',
    rating: 4.27,
    cover: 'https://covers.openlibrary.org/b/id/14653835-L.jpg',
    currentPage: 164,
    totalPages: 329,
    progress: 50,
    description: 'Every day I clean the Winchesters\' beautiful house top to bottom. I try to ignore how Nina Winchester looks at me down her nose. But as I look at this picture-perfect family, I can\'t help but wonder: what secrets are they hiding?',
    genres: ['Thriller', 'Mystery', 'Psychological'],
    isbn: '9781538742570',
  },
];

export default function HomeScreen({ navigation }) {
  const handleBookPress = (book) => {
    // Navigate to book details
    navigation.navigate('BookDetails', { book });
  };

  const handleBeginReading = (book) => {
    console.log('Begin reading:', book.title);
    alert(`Starting to read: ${book.title}\n(Reading view coming soon!)`);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Welcome Section */}
        <Text style={styles.title}>Welcome to NextChapter</Text>
        <Text style={styles.subtitle}>
          Discover your next great read
        </Text>

        {/* Continue Reading Section */}
        {CURRENTLY_READING.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Continue Reading</Text>
            {CURRENTLY_READING.map((book) => (
              <TouchableOpacity
                key={book.id}
                style={styles.currentlyReadingCard}
                onPress={() => handleBookPress(book)}
                activeOpacity={0.7}
              >
                <Image 
                  source={{ uri: book.cover }} 
                  style={styles.currentlyReadingCover}
                  resizeMode="cover"
                />
                <View style={styles.currentlyReadingInfo}>
                  <Text style={styles.bookTitle} numberOfLines={2}>
                    {book.title}
                  </Text>
                  <Text style={styles.bookAuthor}>{book.author}</Text>
                  
                  {/* Progress Bar */}
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${book.progress}%` }]} />
                    </View>
                    <Text style={styles.progressText}>{book.progress}%</Text>
                  </View>
                  
                  <Text style={styles.pageCount}>
                    Page {book.currentPage} of {book.totalPages}
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
            ))}
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

        {/* Popular This Week Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Popular This Week</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          
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
    </ScrollView>
  );
}

// Book Card Component
function BookCard({ book, onPress, onBeginReading }) {
  return (
    <TouchableOpacity 
      style={styles.bookCard}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Image 
        source={{ uri: book.cover }} 
        style={styles.bookCover}
        resizeMode="cover"
      />
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
  
  // Book Card Styles
  horizontalScroll: {
    paddingLeft: spacing.lg,
  },
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
});