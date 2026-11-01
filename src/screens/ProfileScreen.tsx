import Slider from '@react-native-community/slider';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LearningIcon, MuteIcon, PersonIcon } from '../components/Icons';
import { SectionHelp } from '../components/SectionHelp';
import { useI18n } from '../hooks/useI18n';
import type { StringKey } from '../i18n/types';
import {
  CATEGORY_IDS,
  confidence,
  decayed,
  getPreferenceProfile,
  getUserProfile,
  resetPreferenceProfile,
  setCategoryInterest,
  setCategoryMuted,
  statsToInterest,
  type CategoryId,
  type PreferenceProfile,
  type UserProfile,
} from '../preferences';
import { colors, radius, sharedStyles, space, type } from '../theme';

export function ProfileScreen() {
  const { t } = useI18n();
  const [user, setUser] = useState<UserProfile>({
    firstName: 'Nebojsa',
    lastName: 'Kosijer',
    email: 'kosijer@test.com',
  });
  const [profile, setProfile] = useState<PreferenceProfile | null>(null);
  const [interests, setInterests] = useState<Record<string, number>>({});

  const reload = useCallback(async () => {
    const [nextUser, nextProfile] = await Promise.all([
      getUserProfile(),
      getPreferenceProfile(),
    ]);
    setUser(nextUser);
    setProfile(nextProfile);
    const now = Date.now();
    const nextInterests: Record<string, number> = {};
    for (const id of CATEGORY_IDS) {
      if (id === 'other') {
        continue;
      }
      const stats = nextProfile.stats[id];
      const d = stats ? decayed(stats, now) : { alpha: 2, beta: 2 };
      nextInterests[id] = statsToInterest(d.alpha, d.beta);
    }
    setInterests(nextInterests);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const displayName = `${user.firstName} ${user.lastName}`.trim();

  return (
    <ScrollView
      contentContainerStyle={sharedStyles.content}
      keyboardShouldPersistTaps="handled">
      <View style={[sharedStyles.sectionCard, styles.identityCard]}>
        <View style={styles.identityRow}>
          <View style={styles.avatar}>
            <PersonIcon color={colors.muted} size={28} />
          </View>
          <View style={styles.identityText}>
            <Text style={styles.name} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.email} numberOfLines={1}>
              {user.email}
            </Text>
          </View>
        </View>
      </View>

      <View style={sharedStyles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={[sharedStyles.sectionCardTitle, styles.sectionTitle]}>
            {t('interestsTitle')}
          </Text>
          <SectionHelp
            title={t('interestsTitle')}
            body={`${t('interestsHint')}\n\n${t('profileStillLearning')}`}
          />
        </View>

        {profile?.summaryText ? (
          <Text style={styles.summary} numberOfLines={3}>
            {profile.summaryText}
          </Text>
        ) : null}

        {CATEGORY_IDS.filter(id => id !== 'other').map(category => {
          const stats = profile?.stats[category];
          const now = Date.now();
          const d = stats ? decayed(stats, now) : { alpha: 2, beta: 2 };
          const learning = confidence(d.alpha, d.beta, category) < 1;
          const muted = profile?.muted.includes(category) ?? false;
          const value = interests[category] ?? 50;
          const labelKey = `cat_${category}` as StringKey;
          return (
            <View key={category} style={styles.interestRow}>
              <View style={styles.interestTop}>
                <Text style={styles.interestLabel} numberOfLines={1}>
                  {t(labelKey)}
                </Text>
                {learning ? (
                  <LearningIcon color={colors.dim} size={12} />
                ) : null}
                <Text style={styles.interestValue}>{Math.round(value)}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    muted ? t('profileUnmute') : t('profileMute')
                  }
                  android_ripple={{ color: colors.ripple, borderless: true }}
                  style={styles.muteBtn}
                  hitSlop={6}
                  onPress={() => {
                    void (async () => {
                      await setCategoryMuted(category as CategoryId, !muted);
                      await reload();
                    })();
                  }}>
                  <MuteIcon
                    color={muted ? colors.accent : colors.dim}
                    size={16}
                    muted={muted}
                  />
                </Pressable>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={100}
                step={1}
                value={value}
                disabled={muted}
                minimumTrackTintColor={
                  muted ? colors.border : colors.accent
                }
                maximumTrackTintColor={colors.border}
                thumbTintColor={muted ? colors.dim : colors.text}
                onValueChange={next => {
                  setInterests(prev => ({ ...prev, [category]: next }));
                }}
                onSlidingComplete={next => {
                  void (async () => {
                    await setCategoryInterest(category as CategoryId, next);
                    await reload();
                  })();
                }}
              />
            </View>
          );
        })}

        <Pressable
          accessibilityRole="button"
          android_ripple={{ color: colors.ripple }}
          style={styles.resetLink}
          onPress={() => {
            Alert.alert(t('profileReset'), t('profileResetConfirm'), [
              { text: t('cancel'), style: 'cancel' },
              {
                text: t('profileReset'),
                style: 'destructive',
                onPress: () => {
                  void (async () => {
                    await resetPreferenceProfile();
                    await reload();
                  })();
                },
              },
            ]);
          }}>
          <Text style={styles.resetText}>{t('profileReset')}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  identityCard: {
    paddingVertical: space.md,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityText: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...type.label,
    fontSize: 16,
    color: colors.text,
    fontWeight: '700',
  },
  email: {
    ...type.caption,
    color: colors.muted,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    marginBottom: space.sm,
  },
  sectionTitle: {
    flex: 1,
    marginBottom: 0,
  },
  summary: {
    ...type.caption,
    color: colors.story,
    marginBottom: space.sm,
  },
  interestRow: {
    paddingVertical: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSoft,
  },
  interestTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: 2,
    overflow: 'visible',
  },
  interestLabel: {
    ...type.caption,
    color: colors.text,
    fontWeight: '600',
    flex: 1,
  },
  interestValue: {
    ...type.caption,
    color: colors.accent,
    fontWeight: '700',
    minWidth: 24,
    textAlign: 'right',
  },
  muteBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  slider: {
    width: '100%',
    height: 28,
  },
  resetLink: {
    marginTop: space.md,
    alignSelf: 'flex-start',
    paddingVertical: space.sm,
  },
  resetText: {
    ...type.caption,
    color: colors.accent,
    fontWeight: '700',
  },
});
