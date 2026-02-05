import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors, spacing, typography } from '../theme';

// Sample search results
const SAMPLE_SEARCH_RESULTS = [
  {
    id: 1,
    title: 'The Silent Patient',
    author: 'Alex Michaelides',
    rating: 4.08,
    cover: 'https://covers.openlibrary.org/b/isbn/9781250301697-L.jpg',
    year: 2019,
    pages: 336,
  },
  {
    id: 2,
    title: 'Where the Crawdads Sing',
    author: 'Delia Owens',
    rating: 4.46,
    cover: 'https://covers.openlibrary.org/b/isbn/9780735219090-L.jpg',
    year: 2018,
    pages: 384,
  },
  {
    id: 3,
    title: 'Educated',
    author: 'Tara Westover',
    rating: 4.49,
    cover: 'https://covers.openlibrary.org/b/isbn/9780399590504-L.jpg',
    year: 2018,
    pages: 334,
  },
  {
    id: 4,
    title: 'The Night Circus',
    author: 'Erin Morgenstern',
    rating: 4.03,
    cover: 'https://covers.openlibrary.org/b/isbn/9780307744432-L.jpg',
    year: 2011,
    pages: 387,
  },
  {
    id: 5,
    title: 'Circe',
    author: 'Madeline Miller',
    rating: 4.29,
    cover: 'https://covers.openlibrary.org/b/isbn/9780316556347-L.jpg',
    year: 2018,
    pages: 393,
  },
];

export default function BookSearchScreen({ navigation }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = (text) => {
    setSearchQuery(text);
    
    if (text.length > 2) {
      // Where we are going to do the Google Books API calls
      setIsSearching(true);
      setTimeout(() => {
        setSearchResults(SAMPLE_SEARCH_RESULTS);
        setIsSearching(false);
      }, 500);
    } else {
      setSearchResults([]);
    }
  };

  const handleBookPress = (book) => {
    navigation.navigate('BookDetails', { book });
  };

  const BookSearchCard = ({ book }) => (
    <TouchableOpacity 
      style={styles.searchCard}
      onPress={() => handleBookPress(book)}
      activeOpacity={0.7}
    >
      <Image 
        source={{ uri: book.cover }} 
        style={styles.searchCover}
        resizeMode="cover"
      />
      
      <View style={styles.searchInfo}>
        <Text style={styles.searchTitle} numberOfLines={2}>{book.title}</Text>
        <Text style={styles.searchAuthor}>{book.author}</Text>
        
        <View style={styles.searchMeta}>
          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={14} color="#FFD700" />
            <Text style={styles.ratingText}>{book.rating}</Text>
          </View>
          
          <Text style={styles.metaText}>•</Text>
          <Text style={styles.metaText}>{book.year}</Text>
          <Text style={styles.metaText}>•</Text>
          <Text style={styles.metaText}>{book.pages} pages</Text>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.addButton}
            onPress={(e) => {
              e.stopPropagation();
              alert(`Added "${book.title}" to Want to Read!`);
            }}
          >
            <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
            <Text style={styles.addButtonText}>Add to Library</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={colors.secondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search books, authors, ISBN..."
            value={searchQuery}
            onChangeText={handleSearch}
            placeholderTextColor={colors.secondary}
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Ionicons name="close-circle" size={20} color={colors.secondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Buttons */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContainer}
        >
          <TouchableOpacity style={[styles.filterChip, styles.filterChipActive]}>
            <Text style={[styles.filterChipText, styles.filterChipTextActive]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterChip}>
            <Text style={styles.filterChipText}>Fiction</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterChip}>
            <Text style={styles.filterChipText}>Non-Fiction</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterChip}>
            <Text style={styles.filterChipText}>Mystery</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterChip}>
            <Text style={styles.filterChipText}>Romance</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterChip}>
            <Text style={styles.filterChipText}>Sci-Fi</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Search Results */}
      <ScrollView style={styles.resultsContainer}>
        {searchQuery.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="search" size={64} color={colors.border} />
            <Text style={styles.emptyTitle}>Search for Books</Text>
            <Text style={styles.emptyText}>
              Find your next great read by searching for titles, authors, or ISBN
            </Text>
          </View>
        )}

        {isSearching && (
          <View style={styles.loadingState}>
            <Text style={styles.loadingText}>Searching...</Text>
          </View>
        )}

        {searchResults.length > 0 && (
          <View style={styles.results}>
            <Text style={styles.resultsCount}>
              Found {searchResults.length} results for "{searchQuery}"
            </Text>
            {searchResults.map((book) => (
              <BookSearchCard key={book.id} book={book} />
            ))}
          </View>
        )}

        {searchQuery.length > 2 && searchResults.length === 0 && !isSearching && (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color={colors.border} />
            <Text style={styles.emptyTitle}>No Results Found</Text>
            <Text style={styles.emptyText}>
              Try searching with different keywords
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  
  // Search Section
  searchSection: {
    backgroundColor: colors.surface,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: typography.fontSizes.base,
    color: colors.primary,
  },
  
  // Filter Section
  filterScroll: {
    marginHorizontal: -spacing.lg,
  },
  filterContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.buttonPrimary,
    borderColor: colors.buttonPrimary,
  },
  filterChipText: {
    fontSize: typography.fontSizes.sm,
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
  },
  filterChipTextActive: {
    color: colors.buttonText,
  },
  
  // Results Section
  resultsContainer: {
    flex: 1,
  },
  results: {
    padding: spacing.lg,
  },
  resultsCount: {
    fontSize: typography.fontSizes.sm,
    color: colors.secondary,
    marginBottom: spacing.md,
  },
  
  // Search Card
  searchCard: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 8,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  searchCover: {
    width: 80,
    height: 120,
    borderRadius: 4,
    backgroundColor: colors.surface,
  },
  searchInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  searchTitle: {
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  searchAuthor: {
    fontSize: typography.fontSizes.sm,
    color: colors.secondary,
    marginBottom: spacing.sm,
  },
  searchMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: typography.fontSizes.sm,
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
  },
  metaText: {
    fontSize: typography.fontSizes.sm,
    color: colors.secondary,
  },
  
  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addButtonText: {
    fontSize: typography.fontSizes.sm,
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
  },
  
  // Empty State
  emptyState: {
    flex: 1,
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
  
  // Loading State
  loadingState: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: typography.fontSizes.base,
    color: colors.secondary,
  },
});