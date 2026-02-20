import React, { useState, useCallback } from 'react'; // CHANGED: added useCallback
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
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

  // fetch real books from DB when screen appears 
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
            // authors  an array in DB, joint into a string
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
              completedDate: ub.finished_at
                ? new Date(ub.finished_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : null,
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
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.gridContent}
        >
          {/* was LIBRARY_DATA.wantToRead, now libraryData */}
          {libraryData.wantToRead.length > 0 ? (
            libraryData.wantToRead.map((book) => (
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
          {/* was LIBRARY_DATA.completed, now libraryData */}
          {libraryData.completed.length > 0 ? (
            libraryData.completed.map((book) => (
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
      {/* Header Stats — use real counts from libraryData state */}
      <View style={styles.header}>
        <View style={styles.statBox}>
          {/* LIBRARY_DATA.currentlyReading.length */}
          <Text style={styles.statNumber}>{libraryData.currentlyReading.length}</Text>
          <Text style={styles.statLabel}>Reading</Text>
        </View>
        <View style={styles.statBox}>
          {/* LIBRARY_DATA.wantToRead.length */}
          <Text style={styles.statNumber}>{libraryData.wantToRead.length}</Text>
          <Text style={styles.statLabel}>Want to Read</Text>
        </View>
        <View style={styles.statBox}>
          {/* LIBRARY_DATA.completed.length */}
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
          <Text style={[styles.tabText, selectedTab === 'currentlyReading' && styles.tabTextActive]}>
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
          <Text style={[styles.tabText, selectedTab === 'wantToRead' && styles.tabTextActive]}>
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
          <Text style={[styles.tabText, selectedTab === 'completed' && styles.tabTextActive]}>
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
  completedDate: {
    fontSize: typography.fontSizes.xs,
    color: colors.secondary,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
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