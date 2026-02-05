import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '../theme';

// Sample Library data organized by peoples books status
const LIBRARY_DATA = {
  currentlyReading: [
    {
      id: 1,
      title: 'The Housemaid',
      author: 'Freida McFadden',
      cover: 'https://covers.openlibrary.org/b/id/14653835-L.jpg',
      progress: 50,
      currentPage: 164,
      totalPages: 329,
      rating: 4.27,
    },
    {
      id: 2,
      title: 'IT',
      author: 'Stephen King',
      cover: 'https://covers.openlibrary.org/b/isbn/9780451149510-L.jpg',
      progress: 61,
      currentPage: 721,
      totalPages: 1184,
      rating: 4.24,
    },
  ],
  wantToRead: [
    {
      id: 3,
      title: 'The Hunger Games',
      author: 'Suzanne Collins',
      cover: 'https://covers.openlibrary.org/b/isbn/9780439023481-L.jpg',
      rating: 4.32,
      totalPages: 374,
    },
    {
      id: 4,
      title: 'The Great Gatsby',
      author: 'F. Scott Fitzgerald',
      cover: 'https://covers.openlibrary.org/b/isbn/9780140007466-L.jpg',
      rating: 3.93,
      totalPages: 180,
    },
  ],
  completed: [
    {
      id: 5,
      title: 'The Silent Patient',
      author: 'Alex Michaelides',
      cover: 'https://covers.openlibrary.org/b/isbn/9781250301697-L.jpg',
      rating: 4.08,
      completedDate: 'Jan 15, 2026',
      totalPages: 336,
    },
    {
      id: 6,
      title: 'Where the Crawdads Sing',
      author: 'Delia Owens',
      cover: 'https://covers.openlibrary.org/b/isbn/9780735219090-L.jpg',
      rating: 4.46,
      completedDate: 'Jan 2, 2026',
      totalPages: 384,
    },
    {
      id: 7,
      title: 'Educated',
      author: 'Tara Westover',
      cover: 'https://covers.openlibrary.org/b/isbn/9780399590504-L.jpg',
      rating: 4.49,
      completedDate: 'Dec 20, 2025',
      totalPages: 334,
    },
  ],
};

export default function MyBooksScreen({ navigation }) {
  const [selectedTab, setSelectedTab] = useState('currentlyReading');

  const handleBookPress = (book) => {
    navigation.navigate('BookDetails', { book });
  };

  const handleContinueReading = (book) => {
    alert(`Continue reading: ${book.title}\n\nReading view coming soon!`);
  };

  // Currently Reading Book Card
  const CurrentlyReadingCard = ({ book }) => (
    <TouchableOpacity 
      style={styles.currentCard}
      onPress={() => handleBookPress(book)}
      activeOpacity={0.8}
    >
      <Image 
        source={{ uri: book.cover }} 
        style={styles.currentCover}
        resizeMode="cover"
      />
      
      <View style={styles.currentInfo}>
        <Text style={styles.currentTitle} numberOfLines={2}>{book.title}</Text>
        <Text style={styles.currentAuthor}>{book.author}</Text>
        
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
          onPress={(e) => {
            e.stopPropagation();
            handleContinueReading(book);
          }}
        >
          <Text style={styles.continueButtonText}>Continue Reading</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.buttonText} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  // Book Card. Want to Read / Completed
  const BookCard = ({ book, showDate }) => (
    <TouchableOpacity 
      style={styles.bookCard}
      onPress={() => handleBookPress(book)}
      activeOpacity={0.8}
    >
      <Image 
        source={{ uri: book.cover }} 
        style={styles.bookCover}
        resizeMode="cover"
      />
      
      <View style={styles.bookInfo}>
        <Text style={styles.bookTitle} numberOfLines={2}>{book.title}</Text>
        <Text style={styles.bookAuthor} numberOfLines={1}>{book.author}</Text>
        
        <View style={styles.ratingContainer}>
          <Ionicons name="star" size={14} color="#FFD700" />
          <Text style={styles.ratingText}>{book.rating}</Text>
        </View>
        
        {showDate && book.completedDate && (
          <Text style={styles.completedDate}>
            Completed {book.completedDate}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderContent = () => {
    if (selectedTab === 'currentlyReading') {
      return (
        <View style={styles.content}>
          {LIBRARY_DATA.currentlyReading.length > 0 ? (
            LIBRARY_DATA.currentlyReading.map((book) => (
              <CurrentlyReadingCard key={book.id} book={book} />
            ))
          ) : (
            <EmptyState
              icon="book-outline"
              title="No books in progress"
              text="Start reading a book to see it here"
            />
          )}
        </View>
      );
    }

    if (selectedTab === 'wantToRead') {
      return (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.gridContent}
        >
          {LIBRARY_DATA.wantToRead.length > 0 ? (
            LIBRARY_DATA.wantToRead.map((book) => (
              <BookCard key={book.id} book={book} />
            ))
          ) : (
            <EmptyState
              icon="bookmark-outline"
              title="No books saved"
              text="Add books you want to read later"
            />
          )}
        </ScrollView>
      );
    }

    if (selectedTab === 'completed') {
      return (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.gridContent}
        >
          {LIBRARY_DATA.completed.length > 0 ? (
            LIBRARY_DATA.completed.map((book) => (
              <BookCard key={book.id} book={book} showDate={true} />
            ))
          ) : (
            <EmptyState
              icon="checkmark-circle-outline"
              title="No completed books"
              text="Finished books will appear here"
            />
          )}
        </ScrollView>
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Header Stats */}
      <View style={styles.header}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{LIBRARY_DATA.currentlyReading.length}</Text>
          <Text style={styles.statLabel}>Reading</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{LIBRARY_DATA.wantToRead.length}</Text>
          <Text style={styles.statLabel}>Want to Read</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{LIBRARY_DATA.completed.length}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabs}>
        <TouchableOpacity 
          style={[styles.tab, selectedTab === 'currentlyReading' && styles.tabActive]}
          onPress={() => setSelectedTab('currentlyReading')}
        >
          <Ionicons 
            name="book" 
            size={20} 
            color={selectedTab === 'currentlyReading' ? colors.buttonPrimary : colors.secondary} 
          />
          <Text style={[
            styles.tabText, 
            selectedTab === 'currentlyReading' && styles.tabTextActive
          ]}>
            Reading
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tab, selectedTab === 'wantToRead' && styles.tabActive]}
          onPress={() => setSelectedTab('wantToRead')}
        >
          <Ionicons 
            name="bookmark" 
            size={20} 
            color={selectedTab === 'wantToRead' ? colors.buttonPrimary : colors.secondary} 
          />
          <Text style={[
            styles.tabText, 
            selectedTab === 'wantToRead' && styles.tabTextActive
          ]}>
            Want to Read
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tab, selectedTab === 'completed' && styles.tabActive]}
          onPress={() => setSelectedTab('completed')}
        >
          <Ionicons 
            name="checkmark-circle" 
            size={20} 
            color={selectedTab === 'completed' ? colors.buttonPrimary : colors.secondary} 
          />
          <Text style={[
            styles.tabText, 
            selectedTab === 'completed' && styles.tabTextActive
          ]}>
            Completed
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollContent}>
        {renderContent()}
      </ScrollView>
    </View>
  );
}

// Empty State Component
const EmptyState = ({ icon, title, text }) => (
  <View style={styles.emptyState}>
    <Ionicons name={icon} size={64} color={colors.border} />
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.emptyText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  
  // Header Stats
  header: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: typography.fontSizes.xxl,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary,
  },
  statLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.secondary,
    marginTop: spacing.xs,
  },
  
  // Tabs
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.buttonPrimary,
  },
  tabText: {
    fontSize: typography.fontSizes.sm,
    color: colors.secondary,
    fontWeight: typography.fontWeights.medium,
  },
  tabTextActive: {
    color: colors.buttonPrimary,
    fontWeight: typography.fontWeights.semibold,
  },
  
  // Content
  scrollContent: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
  },
  gridContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  
  // Currently Reading Card
  currentCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  currentCover: {
    width: 80,
    height: 120,
    borderRadius: 8,
  },
  currentInfo: {
    flex: 1,
    marginLeft: spacing.md,
    justifyContent: 'space-between',
  },
  currentTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primary,
  },
  currentAuthor: {
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
  
  // Book Card
  bookCard: {
    width: 140,
    marginRight: spacing.md,
  },
  bookCover: {
    width: 140,
    height: 210,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  bookInfo: {
    marginTop: spacing.sm,
  },
  bookTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primary,
    height: 36,
  },
  bookAuthor: {
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
  completedDate: {
    fontSize: typography.fontSizes.xs,
    color: colors.secondary,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  
  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    marginTop: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: typography.fontSizes.base,
    color: colors.secondary,
    textAlign: 'center',
  },
});