// ReadingViewScreen.js
// Main reading screen where users read books and create highlights

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../theme';
import HighlightColorPicker from '../components/HighlightColorPicker';
import AddNoteModal from '../components/AddNoteModal';
import HighlightsSidebar from '../components/HighlightsSidebar';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Sample book content - this would come from your API/book source
const SAMPLE_CONTENT = {
  title: 'IT',
  author: 'Stephen King',
  chapter: 'Chapter 1: After the Flood',
  content: [
    {
      id: 'p1',
      text: 'The terror, which would not end for another twenty-eight years—if it ever did end—began, so far as I know or can tell, with a boat made from a sheet of newspaper floating down a gutter swollen with rain.',
    },
    {
      id: 'p2',
      text: 'The boat bobbed, listed, righted itself again, dived bravely through treacherous whirlpools, and continued on its way down Witcham Street toward the traffic light which marked the intersection of Witcham and Jackson.',
    },
    {
      id: 'p3',
      text: 'The three vertical lenses on all sides of the traffic light were dark this afternoon in the fall of 1957, and the houses were all dark, too. There had been steady rain for a week now, and two days ago the winds had come as well.',
    },
    {
      id: 'p4',
      text: 'Most sections of Derry had lost their power then, and it was not back on yet. A small boy in a yellow slicker and red galoshes ran cheerfully along beside the newspaper boat.',
    },
    {
      id: 'p5',
      text: 'The rain had not stopped, but it was finally slackening. It tapped on the yellow hood of the boy\'s slicker, sounding to his ears like rain on a shed roof... a comfortable, almost cozy sound.',
    },
  ],
  currentPage: 1,
  totalPages: 1184,
};

export default function ReadingViewScreen({ route, navigation }) {
  const [highlights, setHighlights] = useState([]);
  const [selectedText, setSelectedText] = useState(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [showHighlightsSidebar, setShowHighlightsSidebar] = useState(false);
  const [pickerPosition, setPickerPosition] = useState({ x: 0, y: 0 });
  const [fontSize, setFontSize] = useState(typography.fontSizes.base);
  const [showSettings, setShowSettings] = useState(false);

  const scrollViewRef = useRef(null);

  // Handle text selection
  const handleTextPress = (paragraphId, text) => {
    setSelectedText({ paragraphId, text });
    setShowColorPicker(true);
    setPickerPosition({ x: 20, y: 300 });
  };

  const handleSelectColor = (colorOption) => {
    if (selectedText) {
      const newHighlight = {
        id: Date.now().toString(),
        paragraphId: selectedText.paragraphId,
        text: selectedText.text,
        color: colorOption.color,
        colorName: colorOption.name,
        timestamp: new Date().toISOString(),
        note: null,
      };

      setHighlights([...highlights, newHighlight]);
      setShowColorPicker(false);
      setSelectedText(null);
    }
  };

  const handleAddNote = () => {
    setShowColorPicker(false);
    setShowAddNote(true);
  };

  const handleSaveNote = (noteText) => {
    if (selectedText) {
      const newHighlight = {
        id: Date.now().toString(),
        paragraphId: selectedText.paragraphId,
        text: selectedText.text,
        color: '#FFF59D', // Default to yellow
        colorName: 'Yellow',
        timestamp: new Date().toISOString(),
        note: noteText,
      };

      setHighlights([...highlights, newHighlight]);
      setShowAddNote(false);
      setSelectedText(null);
    }
  };

  const handleDeleteHighlight = (highlightId) => {
    setHighlights(highlights.filter(h => h.id !== highlightId));
  };

  const isHighlighted = (paragraphId) => {
    return highlights.find(h => h.paragraphId === paragraphId);
  };

  const toggleSettings = () => {
    setShowSettings(!showSettings);
  };

  const adjustFontSize = (direction) => {
    if (direction === 'increase' && fontSize < 24) {
      setFontSize(fontSize + 2);
    } else if (direction === 'decrease' && fontSize > 14) {
      setFontSize(fontSize - 2);
    }
  };

  const handleJumpToHighlight = (highlight) => {
    console.log('Jump to highlight:', highlight.paragraphId);
    // scrollViewRef.current?.scrollTo({ y: position, animated: true });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {SAMPLE_CONTENT.title}
          </Text>
          <Text style={styles.headerSubtitle}>
            Page {SAMPLE_CONTENT.currentPage} of {SAMPLE_CONTENT.totalPages}
          </Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity 
            onPress={() => setShowHighlightsSidebar(true)} 
            style={styles.headerButton}
          >
            <Ionicons name="bookmark" size={24} color={colors.primary} />
            {highlights.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{highlights.length}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={toggleSettings} style={styles.headerButton}>
            <Ionicons name="settings-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Reading Settings Panel */}
      {showSettings && (
        <View style={styles.settingsPanel}>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Font Size</Text>
            <View style={styles.fontControls}>
              <TouchableOpacity 
                onPress={() => adjustFontSize('decrease')}
                style={styles.fontButton}
              >
                <Ionicons name="remove" size={20} color={colors.primary} />
              </TouchableOpacity>
              <Text style={styles.fontSizeText}>{fontSize}pt</Text>
              <TouchableOpacity 
                onPress={() => adjustFontSize('increase')}
                style={styles.fontButton}
              >
                <Ionicons name="add" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Reading Content */}
      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.chapterTitle}>{SAMPLE_CONTENT.chapter}</Text>

        {SAMPLE_CONTENT.content.map((paragraph) => {
          const highlight = isHighlighted(paragraph.id);
          
          return (
            <Pressable
              key={paragraph.id}
              onLongPress={() => handleTextPress(paragraph.id, paragraph.text)}
              style={styles.paragraphContainer}
            >
              <Text
                style={[
                  styles.paragraph,
                  { fontSize },
                  highlight && { 
                    backgroundColor: highlight.color,
                    paddingHorizontal: spacing.xs,
                    borderRadius: 4,
                  }
                ]}
              >
                {paragraph.text}
              </Text>

              {/* Show note indicator if highlight has a note */}
              {highlight && highlight.note && (
                <TouchableOpacity style={styles.noteIndicator}>
                  <Ionicons name="chatbox" size={16} color={colors.secondary} />
                </TouchableOpacity>
              )}
            </Pressable>
          );
        })}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      {/* Color Picker Overlay */}
      <HighlightColorPicker
        visible={showColorPicker}
        position={pickerPosition}
        onSelectColor={handleSelectColor}
        onAddNote={handleAddNote}
        onCancel={() => {
          setShowColorPicker(false);
          setSelectedText(null);
        }}
      />

      {/* Add Note Modal */}
      <AddNoteModal
        visible={showAddNote}
        selectedText={selectedText?.text}
        onSave={handleSaveNote}
        onCancel={() => {
          setShowAddNote(false);
          setSelectedText(null);
        }}
      />

      {/* Highlights Sidebar */}
      <HighlightsSidebar
        visible={showHighlightsSidebar}
        highlights={highlights}
        onClose={() => setShowHighlightsSidebar(false)}
        onJumpToHighlight={handleJumpToHighlight}
      />

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.bottomButton}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
          <Text style={styles.bottomButtonText}>Previous</Text>
        </TouchableOpacity>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '1%' }]} />
          </View>
        </View>

        <TouchableOpacity style={styles.bottomButton}>
          <Text style={styles.bottomButtonText}>Next</Text>
          <Ionicons name="arrow-forward" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerButton: {
    padding: spacing.sm,
    position: 'relative',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.buttonPrimary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: typography.fontWeights.bold,
    color: colors.buttonText,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  headerTitle: {
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primary,
  },
  headerSubtitle: {
    fontSize: typography.fontSizes.xs,
    color: colors.secondary,
    marginTop: 2,
  },

  // Settings Panel
  settingsPanel: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    padding: spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: typography.fontSizes.base,
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
  },
  fontControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  fontButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  fontSizeText: {
    fontSize: typography.fontSizes.sm,
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
    minWidth: 40,
    textAlign: 'center',
  },

  // Content
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  chapterTitle: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  paragraphContainer: {
    position: 'relative',
    marginBottom: spacing.lg,
  },
  paragraph: {
    fontSize: typography.fontSizes.base,
    lineHeight: typography.lineHeights.relaxed * typography.fontSizes.base,
    color: colors.primary,
  },
  noteIndicator: {
    position: 'absolute',
    right: -spacing.md,
    top: 0,
    padding: spacing.xs,
  },

  // Bottom Bar
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  bottomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  bottomButtonText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
    color: colors.primary,
  },
  progressContainer: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.buttonPrimary,
    borderRadius: 2,
  },
});