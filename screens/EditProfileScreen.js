import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput, Alert, ActivityIndicator, Platform, } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { colors, typography, spacing } from '../theme';

export default function EditProfileScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // profile fields
  const [userId, setUserId] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);

  // fetch existing profile data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        setLoading(true);
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) { navigation.goBack(); return; }

        setUserId(authUser.id);

        // fetch profile from profiles table
        const { data: profileData } = await supabase
          .from('profiles')
          .select('display_name, username, bio, avatar_url')
          .eq('id', authUser.id)
          .single();

        if (profileData) {
          setDisplayName(profileData.display_name || '');
          setUsername(profileData.username || '');
          setBio(profileData.bio || '');
          setAvatarUrl(
            profileData.avatar_url ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(
              profileData.display_name || profileData.username || 'Reader'
            )}&size=200&background=4A4A4A&color=fff`
          );
        }

        setLoading(false);
      };
      fetchData();
    }, [])
  );

  // open photo library and upload to Supabase Storage
  const handleChangePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo access to change your profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets?.[0]) {
      setUploadingPhoto(true);
      try {
        const asset = result.assets[0];
        const mimeType = asset.mimeType || 'image/jpeg';
        const ext = mimeType.split('/')[1];
        const fileName = `${userId}/avatar.${ext}`;

        // use the right method depending on platform
        let uploadData;
        if (Platform.OS === 'web') {
          // web — fetch/blob works fine
          const response = await fetch(asset.uri);
          uploadData = await response.blob();
        } else {
          // iOS/Android — use base64 to avoid empty file issue
          uploadData = Uint8Array.from(atob(asset.base64), c => c.charCodeAt(0));
        }

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, uploadData, { upsert: true, contentType: mimeType });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);

        // add timestamp to force image refresh
        setAvatarUrl(`${publicUrl}?t=${Date.now()}`);

      } catch (err) {
        Alert.alert('Upload failed', err.message || 'Could not upload photo. Try again.');
      } finally {
        setUploadingPhoto(false);
      }
    }
  };

  // save profile changes to Supabase
  const handleSave = async () => {
    if (!displayName.trim()) {
      Alert.alert('Name required', 'Please enter a display name.');
      return;
    }

    if (!username.trim()) {
      Alert.alert('Username required', 'Please enter a username.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim(),
          username: username.trim().toLowerCase(),
          bio: bio.trim(),
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) throw error;

      Alert.alert('Saved!', 'Your profile has been updated.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not save changes. Try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.buttonPrimary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">

      {/* Avatar — tap to change photo */}
      <View style={styles.avatarSection}>
        <View style={styles.avatarContainer}>
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          {uploadingPhoto && (
            <View style={styles.avatarOverlay}>
              <ActivityIndicator color="#fff" />
            </View>
          )}
          <TouchableOpacity
            style={styles.editAvatarButton}
            onPress={handleChangePhoto}
            disabled={uploadingPhoto}
          >
            <Ionicons name="camera" size={16} color={colors.buttonText} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={handleChangePhoto} disabled={uploadingPhoto}>
          <Text style={styles.changePhotoText}>
            {uploadingPhoto ? 'Uploading...' : 'Edit picture'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Profile fields — Instagram style */}
      <View style={styles.section}>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Name"
            placeholderTextColor={colors.secondary}
            maxLength={50}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={(text) => setUsername(text.toLowerCase().replace(/\s/g, ''))}
            placeholder="Username"
            placeholderTextColor={colors.secondary}
            maxLength={30}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.bioInput]}
            value={bio}
            onChangeText={setBio}
            placeholder="Bio"
            placeholderTextColor={colors.secondary}
            multiline
            maxLength={160}
          />
          <Text style={styles.charCount}>{bio.length}/160</Text>
        </View>

      </View>

      {/* Save changes */}
      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.buttonText} />
          ) : (
            <>
              <Ionicons name="checkmark" size={18} color={colors.buttonText} />
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.buttonPrimary,
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 50,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.buttonPrimary,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.background,
  },
  changePhotoText: {
    color: colors.buttonPrimary,
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.semibold,
    marginTop: spacing.xs,
  },
  section: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  fieldGroup: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.fontSizes.sm,
    color: colors.secondary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSizes.base,
    color: colors.primary,
  },
  bioInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: typography.fontSizes.xs,
    color: colors.secondary,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.buttonPrimary,
    paddingVertical: spacing.md,
    borderRadius: 10,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: colors.buttonText,
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.semibold,
  },
});