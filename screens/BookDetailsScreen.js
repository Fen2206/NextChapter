import { Ionicons } from '@expo/vector-icons';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, spacing, typography } from '../theme';

export default function BookDetailsScreen({ route, navigation }) {

  // For now, using sample data
  const book = {
    title: 'IT',
    author: 'Stephen King',
    rating: 4.24,
    totalRatings: 1234,
    cover: 'https://covers.openlibrary.org/b/isbn/9780451149510-L.jpg',
    description: 'Welcome to Derry, a small town in Maine where children are afraid to go outside. The story follows a group of kids who face their deepest fears in the form of a terrifying creature known as "It".',
    pageCount: 1184,
    publishYear: 1987,
    genres: ['Fiction', 'Fantasy', 'Horror'],
    isbn: '9780451149510',
  };

  const handleBeginReading = () => {
    console.log('Begin reading:', book.title);
    alert('Reading view coming soon!\n\nThis will open the book reader with:\n- Chapter navigation\n- Annotation tools\n- Progress tracking');
  };

  const handleAddToLibrary = () => {
    alert('Added to your library!');
  };

  const handleJoinBookClub = () => {
    alert('Book club feature coming soon!');
  };

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;

    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <Ionicons key={i} name="star" size={18} color="#FFD700" />
      );
    }
    if (hasHalfStar) {
      stars.push(
        <Ionicons key="half" name="star-half" size={18} color="#FFD700" />
      );
    }
    const emptyStars = 5 - Math.ceil(rating);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(
        <Ionicons key={`empty-${i}`} name="star-outline" size={18} color="#FFD700" />
      );
    }
    return stars;
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Book Cover and Basic Info */}
        <View style={styles.headerSection}>
          <Image 
            source={{ uri: book.cover }} 
            style={styles.coverImage}
            resizeMode="cover"
          />
          
          <View style={styles.headerInfo}>
            <Text style={styles.title}>{book.title}</Text>
            <Text style={styles.author}>by {book.author}</Text>
            
            {/* Rating */}
            <View style={styles.ratingContainer}>
              <View style={styles.stars}>
                {renderStars(book.rating)}
              </View>
              <Text style={styles.ratingText}>
                {book.rating} ({book.totalRatings} ratings)
              </Text>
            </View>

            {/* Book Info */}
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Ionicons name="book-outline" size={16} color={colors.secondary} />
                <Text style={styles.infoText}>{book.pageCount} pages</Text>
              </View>
              <View style={styles.infoItem}>
                <Ionicons name="calendar-outline" size={16} color={colors.secondary} />
                <Text style={styles.infoText}>{book.publishYear}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={handleBeginReading}
          >
            <Text style={styles.primaryButtonText}>Begin Reading</Text>
          </TouchableOpacity>

          <View style={styles.secondaryButtons}>
            <TouchableOpacity 
              style={styles.secondaryButton}
              onPress={handleAddToLibrary}
            >
              <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
              <Text style={styles.secondaryButtonText}>Add to Library</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.secondaryButton}
              onPress={handleJoinBookClub}
            >
              <Ionicons name="people-outline" size={20} color={colors.primary} />
              <Text style={styles.secondaryButtonText}>Join Book Club</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Genres */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Genres</Text>
          <View style={styles.genresContainer}>
            {book.genres.map((genre, index) => (
              <View key={index} style={styles.genreTag}>
                <Text style={styles.genreText}>{genre}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{book.description}</Text>
        </View>

        {/* Additional Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>ISBN:</Text>
            <Text style={styles.detailValue}>{book.isbn}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Pages:</Text>
            <Text style={styles.detailValue}>{book.pageCount}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Published:</Text>
            <Text style={styles.detailValue}>{book.publishYear}</Text>
          </View>
        </View>

        {/* Bottom padding */}
        <View style={{ height: spacing.xl }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
  },
  
  // Header Section
  headerSection: {
    flexDirection: 'row',
    marginBottom: spacing.xl,
  },
  coverImage: {
    width: 120,
    height: 180,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  headerInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  title: {
    fontSize: typography.fontSizes.xxl,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  author: {
    fontSize: typography.fontSizes.base,
    color: colors.secondary,
    marginBottom: spacing.md,
  },
  ratingContainer: {
    marginBottom: spacing.md,
  },
  stars: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  ratingText: {
    fontSize: typography.fontSizes.sm,
    color: colors.secondary,
  },
  infoRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  infoText: {
    fontSize: typography.fontSizes.sm,
    color: colors.secondary,
  },
  
  // Action Buttons
  actionButtons: {
    marginBottom: spacing.xl,
  },
  primaryButton: {
    backgroundColor: colors.buttonPrimary,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  primaryButtonText: {
    color: colors.buttonText,
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
  },
  secondaryButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },
  secondaryButtonText: {
    fontSize: typography.fontSizes.sm,
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
  },
  
  // Sections
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primary,
    marginBottom: spacing.md,
  },
  
  // Genres
  genresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  genreTag: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
  },
  genreText: {
    fontSize: typography.fontSizes.sm,
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
  },
  
  // Description
  description: {
    fontSize: typography.fontSizes.base,
    color: colors.primary,
    lineHeight: typography.lineHeights.relaxed * typography.fontSizes.base,
  },
  
  // Details
  detailRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  detailLabel: {
    fontSize: typography.fontSizes.base,
    color: colors.secondary,
    fontWeight: typography.fontWeights.medium,
    width: 100,
  },
  detailValue: {
    fontSize: typography.fontSizes.base,
    color: colors.primary,
    flex: 1,
  },
});