import React, { useState } from 'react';
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
    currentPage: 721,
    readingStatus: 'reading', // 'reading', 'completed', 'want-to-read', or null
    progress: 61, // percentage
  };

  const handleBeginReading = () => {
  navigation.navigate('ReadingView', { 
    book: book,
    startPage: book.currentPage || 1 
  });
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

  const getStatusInfo = () => {
    switch (book.readingStatus) {
      case 'reading':
        return {
          icon: 'book',
          text: 'Currently Reading',
          color: '#4CAF50',
        };
      case 'completed':
        return {
          icon: 'checkmark-circle',
          text: 'Completed',
          color: '#2196F3',
        };
      case 'want-to-read':
        return {
          icon: 'bookmark',
          text: 'Want to Read',
          color: '#FF9800',
        };
      default:
        return null;
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Book Cover and Basic Info */}
        <View style={styles.headerSection}>
          <View style={styles.coverContainer}>
            <Image
              source={{ uri: book.cover }}
              style={styles.coverImage}
              resizeMode="cover"
            />
            {/* Status Badge on Cover */}
            {statusInfo && (
              <View style={[styles.statusBadge, { backgroundColor: statusInfo.color }]}>
                <Ionicons name={statusInfo.icon} size={14} color="#FFFFFF" />
              </View>
            )}
          </View>
          
          <View style={styles.headerInfo}>
            <Text style={styles.title}>{book.title}</Text>
            <Text style={styles.author}>by {book.author}</Text>
            
            {/* Status Text */}
            {statusInfo && (
              <View style={styles.statusContainer}>
                <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
                <Text style={styles.statusText}>{statusInfo.text}</Text>
              </View>
            )}
            
            {/* Rating */}
            <View style={styles.ratingContainer}>
              <View style={styles.stars}>
                {renderStars(book.rating)}
              </View>
              <Text style={styles.ratingText}>
                {book.rating} ({book.totalRatings.toLocaleString()} ratings)
              </Text>
            </View>

            {/* Book Info Pills */}
            <View style={styles.infoRow}>
              <View style={styles.infoPill}>
                <Ionicons name="book-outline" size={14} color={colors.secondary} />
                <Text style={styles.infoPillText}>{book.pageCount} pages</Text>
              </View>
              <View style={styles.infoPill}>
                <Ionicons name="calendar-outline" size={14} color={colors.secondary} />
                <Text style={styles.infoPillText}>{book.publishYear}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Progress Section - Only show if currently reading */}
        {book.readingStatus === 'reading' && book.currentPage && (
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>Your Progress</Text>
              <Text style={styles.progressPercentage}>{book.progress}%</Text>
            </View>
            
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${book.progress}%` }]} />
              </View>
            </View>
            
            <Text style={styles.progressText}>
              Page {book.currentPage} of {book.pageCount}
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleBeginReading}
          >
            <Ionicons 
              name={book.readingStatus === 'reading' ? 'play' : 'book-outline'} 
              size={20} 
              color={colors.buttonText}
              style={styles.buttonIcon}
            />
            <Text style={styles.primaryButtonText}>
              {book.readingStatus === 'reading' ? 'Continue Reading' : 'Begin Reading'}
            </Text>
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
          <Text style={styles.sectionTitle}>About this book</Text>
          <Text style={styles.description}>{book.description}</Text>
        </View>

        {/* Additional Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>ISBN</Text>
              <Text style={styles.detailValue}>{book.isbn}</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Pages</Text>
              <Text style={styles.detailValue}>{book.pageCount}</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Published</Text>
              <Text style={styles.detailValue}>{book.publishYear}</Text>
            </View>
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
  coverContainer: {
    position: 'relative',
  },
  coverImage: {
    width: 120,
    height: 180,
    borderRadius: 8,
    backgroundColor: colors.surface,
    // Add subtle shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    // Shadow for badge
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
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
    lineHeight: typography.fontSizes.xxl * 1.2,
  },
  author: {
    fontSize: typography.fontSizes.base,
    color: colors.secondary,
    marginBottom: spacing.sm,
  },

  // Status
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  statusText: {
    fontSize: typography.fontSizes.sm,
    color: colors.secondary,
    fontWeight: typography.fontWeights.medium,
  },

  // Rating
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

  // Info Pills
  infoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  infoPillText: {
    fontSize: typography.fontSizes.sm,
    color: colors.secondary,
  },

  // Progress Section
  progressSection: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.xl,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  progressTitle: {
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primary,
  },
  progressPercentage: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.buttonPrimary,
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
  progressText: {
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
    justifyContent: 'center',
    marginBottom: spacing.md,
    flexDirection: 'row',
    // Add subtle shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonIcon: {
    marginRight: spacing.xs,
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
    backgroundColor: colors.background,
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
    borderWidth: 1,
    borderColor: colors.border,
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

  // Details Card
  detailsCard: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  detailDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  detailLabel: {
    fontSize: typography.fontSizes.base,
    color: colors.secondary,
    fontWeight: typography.fontWeights.medium,
  },
  detailValue: {
    fontSize: typography.fontSizes.base,
    color: colors.primary,
    fontWeight: typography.fontWeights.semibold,
  },
});