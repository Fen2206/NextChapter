import React, { useState, useCallback } from 'react'; // CHANGED: added useCallback
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native'; // ADDED
import { supabase } from '../lib/supabase'; // ADDED
import { colors, typography, spacing } from '../theme';

export default function MyBooksScreen({ navigation }) {
  const [selectedTab, setSelectedTab] = useState('currentlyReading');

  // Now LIBRARY_DATA - real state initialized as empty arrays
  const [libraryData, setLibraryData] = useState({
    currentlyReading: [],
    wantToRead: [],
    completed: [],
  });

  // Fetch real books from DB when screen appears
  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch all user_books joined with books table
        const { data: userBooks } = await supabase
          .from('user_books')
          .select(`
            id,
            status,
            current_page,
            finished_at,
            books (
              id,
              title,
              authors,
              cover_url,
              page_count
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (userBooks) {
          // Helper to format each userBook row
          const formatBook = (ub) => {
            const book = ub.books;
            // authors is an array in DB, join into a string
            const authors = Array.isArray(book?.authors)
              ? book.authors.join(', ')
              : book?.authors || '';
            const progress = book?.page_count && ub.current_page
              ? Math.round((ub.current_page / book.page_count) * 100)
              : 0;
            return {
              id: ub.id,
              title: book?.title || '',
              author: authors,
              cover: book?.cover_url || '',   //cover_url is the DB column name
              currentPage: ub.current_page || 0,
              totalPages: book?.page_count || 0,
              progress,
              lastRead: 'Recently', // Add a real timestamp logic later
              completedDate: ub.finished_at
                ? new Date(ub.finished_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : null,
              rating: 4.2, // Placeholder, so we can add real ratings later
            };
          };

          // Split books by status into the three tabs
          setLibraryData({
            currentlyReading: userBooks.filter(b => b.status === 'reading').map(formatBook),
            wantToRead: userBooks.filter(b => b.status === 'want_to_read').map(formatBook),
            completed: userBooks.filter(b => b.status === 'completed').map(formatBook),
          });
        }
      };
      fetchData();
    }, [])
  );

  const handleBookPress = (book) => {
    navigation.navigate('BookDetails', { book });
  };

  const handleContinueReading = (book) => {
    alert(`Continue reading: ${book.title}\n\nReading view coming soon!`);
  };

  // Enhanced the currently reading card with a  better progress UI
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
        <View style={styles.currentHeader}>
          <View style={styles.currentTitleContainer}>
            <Text style={styles.currentTitle} numberOfLines={2}>{book.title}</Text>
            <Text style={styles.currentAuthor}>{book.author}</Text>
          </View>
          
          {/* Progress Circle Badge */}
          <View style={styles.progressCircle}>
            <Text style={styles.progressCircleText}>{book.progress}%</Text>
          </View>
        </View>
        
        {/* Enhanced Progress Bar */}
        <View style={styles.progressSection}>
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${book.progress}%` }]} />
            </View>
          </View>
          
          <View style={styles.progressDetails}>
            <View style={styles.progressDetailItem}>
              <Ionicons name="bookmark-outline" size={14} color={colors.secondary} />
              <Text style={styles.progressDetailText}>
                Page {book.currentPage} of {book.totalPages}
              </Text>
            </View>
            <View style={styles.progressDetailItem}>
              <Ionicons name="time-outline" size={14} color={colors.secondary} />
              <Text style={styles.progressDetailText}>{book.lastRead}</Text>
            </View>
          </View>
        </View>
        
        {/* Action Button */}
        <TouchableOpacity
          style={styles.continueButton}
          onPress={(e) => {
            e.stopPropagation();
            handleContinueReading(book);
          }}
        >
          <Ionicons name="play" size={16} color={colors.buttonText} />
          <Text style={styles.continueButtonText}>Continue Reading</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.buttonText} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  // Enhanced the book card for the want to read or completed
  const BookCard = ({ book, showDate }) => (
    <TouchableOpacity
      style={styles.bookCard}
      onPress={() => handleBookPress(book)}
      activeOpacity={0.8}
    >
      <View style={styles.bookCardContent}>
        <Image
          source={{ uri: book.cover }}
          style={styles.bookCover}
          resizeMode="cover"
        />
        
        {/* Completed Badge */}
        {showDate && (
          <View style={styles.completedBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
          </View>
        )}
      </View>
      
      <View style={styles.bookInfo}>
        <Text style={styles.bookTitle} numberOfLines={2}>{book.title}</Text>
        <Text style={styles.bookAuthor} numberOfLines={1}>{book.author}</Text>
        
        <View style={styles.bookMeta}>
          {book.rating && (
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={12} color="#FFD700" />
              <Text style={styles.ratingText}>{book.rating}</Text>
            </View>
          )}
          
          {showDate && book.completedDate && (
            <>
              {book.rating && <Text style={styles.metaDot}>•</Text>}
              <Text style={styles.completedDate}>{book.completedDate}</Text>
            </>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderContent = () => {
    if (selectedTab === 'currentlyReading') {
      return (
        <View style={styles.content}>
          {/* was LIBRARY_DATA.currentlyReading, now libraryData */}
          {libraryData.currentlyReading.length > 0 ? (
            libraryData.currentlyReading.map((book) => (
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
        <View style={styles.gridContainer}>
          {libraryData.wantToRead.length > 0 ? (
            <View style={styles.gridContent}>
              {libraryData.wantToRead.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </View>
          ) : (
            <EmptyState
              icon="bookmark-outline"
              title="No books saved"
              text="Add books you want to read later"
            />
          )}
        </View>
      );
    }

    if (selectedTab === 'completed') {
      return (
        <View style={styles.gridContainer}>
          {libraryData.completed.length > 0 ? (
            <View style={styles.gridContent}>
              {libraryData.completed.map((book) => (
                <BookCard key={book.id} book={book} showDate={true} />
              ))}
            </View>
          ) : (
            <EmptyState
              icon="checkmark-circle-outline"
              title="No completed books"
              text="Finished books will appear here"
            />
          )}
        </View>
      );
    }
  };

  return (
    <ImageBackground source={require('../assets/background2.png')} style={styles.backgroundContainer} resizeMode="cover">
      <View style={styles.container}>
      {/* Header Stats — use real counts from libraryData state */}
      <View style={styles.header}>
        <View style={styles.statBox}>
          <View style={styles.statIconContainer}>
            <Ionicons name="book" size={24} color={colors.buttonPrimary} />
          </View>
          <Text style={styles.statNumber}>{libraryData.currentlyReading.length}</Text>
          <Text style={styles.statLabel}>Reading</Text>
        </View>
        
        <View style={styles.statDivider} />
        
        <View style={styles.statBox}>
          <View style={styles.statIconContainer}>
            <Ionicons name="bookmark" size={24} color="#FF9800" />
          </View>
          <Text style={styles.statNumber}>{libraryData.wantToRead.length}</Text>
          <Text style={styles.statLabel}>Want to Read</Text>
        </View>
        
        <View style={styles.statDivider} />
        
        <View style={styles.statBox}>
          <View style={styles.statIconContainer}>
            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
          </View>
          <Text style={styles.statNumber}>{libraryData.completed.length}</Text>
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
      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {renderContent()}
      </ScrollView>
      </View>
    </ImageBackground>
  );
}


const EmptyState = ({ icon, title, text }) => (
  <View style={styles.emptyState}>
    <Ionicons name={icon} size={64} color={colors.border} />
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.emptyText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  backgroundContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  header: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.48)',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statIconContainer: {
    marginBottom: spacing.xs,
  },
  statNumber: {
    fontSize: typography.fontSizes.xxl,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  statLabel: {
    fontSize: typography.fontSizes.xs,
    color: colors.secondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },

  tabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.44)',
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
    borderBottomWidth: 3,
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

  scrollContent: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
  },
  gridContainer: {
    flex: 1,
  },
  gridContent: {
    padding: spacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },

  currentCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  currentCover: {
    width: 90,
    height: 135,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  currentInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  currentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  currentTitleContainer: {
    flex: 1,
    marginRight: spacing.sm,
  },
  currentTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary,
    marginBottom: 4,
  },
  currentAuthor: {
    fontSize: typography.fontSizes.sm,
    color: colors.secondary,
  },

  progressCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.buttonPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressCircleText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold,
    color: colors.buttonText,
  },

  progressSection: {
    marginBottom: spacing.sm,
  },
  progressBarContainer: {
    marginBottom: spacing.sm,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.buttonPrimary,
    borderRadius: 4,
  },
  progressDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  progressDetailText: {
    fontSize: typography.fontSizes.xs,
    color: colors.secondary,
  },

  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.buttonPrimary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    gap: spacing.xs,
  },
  continueButtonText: {
    color: colors.buttonText,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    flex: 1,
    textAlign: 'center',
  },

  bookCard: {
    width: '47%',
    marginBottom: spacing.md,
  },
  bookCardContent: {
    position: 'relative',
  },
  bookCover: {
    width: '100%',
    height: 220,
    borderRadius: 8,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  completedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  bookInfo: {
    marginTop: spacing.sm,
  },
  bookTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primary,
    marginBottom: 4,
    height: 34,
  },
  bookAuthor: {
    fontSize: typography.fontSizes.xs,
    color: colors.secondary,
    marginBottom: spacing.xs,
  },
  bookMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: typography.fontSizes.xs,
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
  },
  metaDot: {
    fontSize: typography.fontSizes.xs,
    color: colors.secondary,
  },
  completedDate: {
    fontSize: typography.fontSizes.xs,
    color: colors.secondary,
  },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    marginTop: spacing.xxl,
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