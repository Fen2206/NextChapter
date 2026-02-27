// AddNoteModal.js
// Modal for adding notes to highlighted text

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../theme';

export default function AddNoteModal({ visible, selectedText, onSave, onCancel }) {
  const [noteText, setNoteText] = useState('');
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));

  useEffect(() => {
    if (visible) {
      // Reset note text when modal opens
      setNoteText('');
      
      // Animate in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate out
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 50,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleSave = () => {
    if (noteText.trim()) {
      onSave(noteText.trim());
      setNoteText('');
    }
  };

  const handleCancel = () => {
    setNoteText('');
    onCancel();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleCancel}
        >
          <Animated.View
            style={[
              styles.modalContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
            onStartShouldSetResponder={() => true}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Add Note</Text>
              <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.secondary} />
              </TouchableOpacity>
            </View>

            {/* Selected Text Preview */}
            {selectedText && (
              <View style={styles.selectedTextContainer}>
                <View style={styles.quoteIcon}>
                  <Ionicons name="quote" size={20} color={colors.secondary} />
                </View>
                <Text style={styles.selectedText} numberOfLines={3}>
                  {selectedText}
                </Text>
              </View>
            )}

            {/* Note Input */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="Add your thoughts..."
                placeholderTextColor={colors.secondary}
                value={noteText}
                onChangeText={setNoteText}
                multiline
                autoFocus
                maxLength={500}
              />
              <Text style={styles.characterCount}>
                {noteText.length} / 500
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancel}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  !noteText.trim() && styles.saveButtonDisabled,
                ]}
                onPress={handleSave}
                disabled={!noteText.trim()}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name="checkmark" 
                  size={20} 
                  color={noteText.trim() ? colors.buttonText : colors.secondary} 
                />
                <Text style={[
                  styles.saveButtonText,
                  !noteText.trim() && styles.saveButtonTextDisabled,
                ]}>
                  Save Note
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    flex: 1,
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary,
  },
  closeButton: {
    padding: spacing.xs,
  },

  // Selected Text Preview
  selectedTextContainer: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.buttonPrimary,
    marginBottom: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quoteIcon: {
    opacity: 0.5,
  },
  selectedText: {
    flex: 1,
    fontSize: typography.fontSizes.sm,
    fontStyle: 'italic',
    color: colors.secondary,
    lineHeight: typography.lineHeights.relaxed * typography.fontSizes.sm,
  },

  // Input
  inputContainer: {
    marginBottom: spacing.lg,
  },
  textInput: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: typography.fontSizes.base,
    color: colors.primary,
    minHeight: 120,
    maxHeight: 200,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.border,
  },
  characterCount: {
    fontSize: typography.fontSizes.xs,
    color: colors.secondary,
    textAlign: 'right',
    marginTop: spacing.xs,
  },

  // Buttons
  buttonContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primary,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.buttonPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  saveButtonDisabled: {
    backgroundColor: colors.border,
  },
  saveButtonText: {
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.semibold,
    color: colors.buttonText,
  },
  saveButtonTextDisabled: {
    color: colors.secondary,
  },
});