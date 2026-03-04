import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { colors, typography, spacing } from '../theme';

export default function SettingsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // account info
  const [userId, setUserId] = useState(null);
  const [email, setEmail] = useState('');
  const [joinDate, setJoinDate] = useState('');

  // preference toggles
  const [publicProfile, setPublicProfile] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // fetch existing settings when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        setLoading(true);
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) { navigation.goBack(); return; }

        setUserId(authUser.id);
        setEmail(authUser.email);
        setJoinDate(new Date(authUser.created_at).toLocaleDateString('en-US', {
          month: 'long', year: 'numeric',
        }));

        // fetch preferences from profiles table
        const { data: profileData } = await supabase
          .from('profiles')
          .select('preferences')
          .eq('id', authUser.id)
          .single();

        if (profileData) {
          const prefs = profileData.preferences || {};
          setPublicProfile(prefs.publicProfile !== false);
          setNotificationsEnabled(prefs.notifications !== false);
        }

        setLoading(false);
      };
      fetchData();
    }, [])
  );

  // save settings — merges into existing preferences so genre/format/goal are preserved
  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', userId)
        .single();

      const existingPrefs = profileData?.preferences || {};

      const { error } = await supabase
        .from('profiles')
        .update({
          preferences: {
            ...existingPrefs,
            publicProfile,
            notifications: notificationsEnabled,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) throw error;

      Alert.alert('Saved!', 'Your settings have been updated.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not save settings. Try again.');
    } finally {
      setSaving(false);
    }
  };

  // log out with confirmation
  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.buttonPrimary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>

      {/* Privacy & Notifications */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy & Notifications</Text>

        <View style={styles.toggleRow}>
          <View style={styles.toggleInfo}>
            <Ionicons name="globe-outline" size={20} color={colors.secondary} />
            <View style={styles.toggleText}>
              <Text style={styles.toggleLabel}>Public Profile</Text>
              <Text style={styles.toggleSub}>Let others find and follow you</Text>
            </View>
          </View>
          <Switch
            value={publicProfile}
            onValueChange={setPublicProfile}
            trackColor={{ false: colors.border, true: colors.buttonPrimary }}
            thumbColor={colors.buttonText}
          />
        </View>

        <View style={styles.toggleRow}>
          <View style={styles.toggleInfo}>
            <Ionicons name="notifications-outline" size={20} color={colors.secondary} />
            <View style={styles.toggleText}>
              <Text style={styles.toggleLabel}>Notifications</Text>
              <Text style={styles.toggleSub}>Reading reminders & activity</Text>
            </View>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: colors.border, true: colors.buttonPrimary }}
            thumbColor={colors.buttonText}
          />
        </View>
      </View>

      {/* Account Information — real user?.email and user?.joinDate */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Information</Text>

        <View style={styles.infoRow}>
          <Ionicons name="mail-outline" size={20} color={colors.secondary} />
          <View style={styles.infoText}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{email}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={20} color={colors.secondary} />
          <View style={styles.infoText}>
            <Text style={styles.infoLabel}>Member Since</Text>
            <Text style={styles.infoValue}>{joinDate}</Text>
          </View>
        </View>
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>

        <View style={styles.infoRow}>
          <Ionicons name="book-outline" size={20} color={colors.secondary} />
          <View style={styles.infoText}>
            <Text style={styles.infoLabel}>App</Text>
            <Text style={styles.infoValue}>Next Chapter</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="code-slash-outline" size={20} color={colors.secondary} />
          <View style={styles.infoText}>
            <Text style={styles.infoLabel}>Version</Text>
            <Text style={styles.infoValue}>1.0.0</Text>
          </View>
        </View>
      </View>

      {/* Save settings */}
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
              <Text style={styles.saveButtonText}>Save Settings</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Log out */}
      <View style={[styles.section, { marginBottom: spacing.xxl }]}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color="#E53935" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>

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
  section: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primary,
    marginBottom: spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  toggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  toggleText: {
    marginLeft: spacing.md,
  },
  toggleLabel: {
    fontSize: typography.fontSizes.base,
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
  },
  toggleSub: {
    fontSize: typography.fontSizes.xs,
    color: colors.secondary,
    marginTop: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  infoText: {
    marginLeft: spacing.md,
    flex: 1,
  },
  infoLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.secondary,
    marginBottom: spacing.xs,
  },
  infoValue: {
    fontSize: typography.fontSizes.base,
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
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
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E53935',
  },
  logoutText: {
    color: '#E53935',
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.semibold,
  },
});