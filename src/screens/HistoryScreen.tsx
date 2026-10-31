import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Accordion } from '../components/Accordion';
import { StarRating } from '../components/StarRating';
import { useI18n } from '../hooks/useI18n';
import { humanCategory } from '../services/routePrefetch';
import {
  clearVisitHistory,
  getVisitHistory,
  setVisitRating,
} from '../services/store';
import { colors, sharedStyles, space, type } from '../theme';
import type { VisitRating, VisitRecord } from '../types';

function formatWhen(ts: number, locale: string): string {
  try {
    return new Date(ts).toLocaleString(locale === 'sr' ? 'sr-RS' : 'en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return new Date(ts).toISOString();
  }
}

export function HistoryScreen() {
  const { t, uiLanguage } = useI18n();
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setVisits(await getVisitHistory());
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
    const poll = setInterval(() => {
      void getVisitHistory().then(setVisits);
    }, 4000);
    return () => clearInterval(poll);
  }, [reload]);

  const onRate = useCallback(async (visitId: string, rating: VisitRating) => {
    const current = await getVisitHistory();
    const visit = current.find(v => v.id === visitId);
    const nextRating = visit?.rating === rating ? null : rating;
    setVisits(await setVisitRating(visitId, nextRating));
  }, []);

  const onClear = useCallback(() => {
    Alert.alert(t('historyClear'), t('historyClearConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('historyClear'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await clearVisitHistory();
            setVisits([]);
            setExpandedId(null);
          })();
        },
      },
    ]);
  }, [t]);

  return (
    <ScrollView contentContainerStyle={sharedStyles.content}>
      {loading ? null : visits.length === 0 ? (
        <View style={sharedStyles.sectionCard}>
          <Text style={styles.empty}>{t('historyEmpty')}</Text>
        </View>
      ) : (
        <>
          <Pressable
            accessibilityRole="button"
            android_ripple={{ color: colors.ripple }}
            style={styles.clearRow}
            onPress={onClear}>
            <Text style={styles.clearText}>{t('historyClear')}</Text>
          </Pressable>
          {visits.map(visit => {
          const open = expandedId === visit.id;
          const category = humanCategory(visit.category);
          const subtitle = [
            formatWhen(visit.narratedAt, uiLanguage),
            category,
            visit.mode === 'driving'
              ? t('historyModeDrive')
              : t('historyModeWalk'),
          ]
            .filter(Boolean)
            .join(' · ');
          return (
            <Accordion
              key={visit.id}
              title={visit.title}
              subtitle={subtitle}
              open={open}
              onToggle={() =>
                setExpandedId(prev => (prev === visit.id ? null : visit.id))
              }
              trailing={
                <StarRating
                  value={visit.rating}
                  compact
                  editable={false}
                />
              }>
              {visit.summary ? (
                <Text style={styles.summary}>{visit.summary}</Text>
              ) : null}
              {visit.narrationExcerpt ? (
                <Text style={styles.excerpt}>{visit.narrationExcerpt}</Text>
              ) : null}
              <Text style={styles.rateLabel}>{t('historyRate')}</Text>
              <StarRating
                value={visit.rating}
                editable
                onChange={rating => {
                  void onRate(visit.id, rating);
                }}
              />
            </Accordion>
          );
        })}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  empty: {
    ...type.body,
    color: colors.muted,
  },
  clearRow: {
    alignSelf: 'flex-end',
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
  },
  clearText: {
    ...type.caption,
    color: colors.accent,
    fontWeight: '700',
  },
  summary: {
    ...type.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.story,
  },
  excerpt: {
    ...type.caption,
    color: colors.muted,
    fontStyle: 'italic',
  },
  rateLabel: {
    ...type.section,
    color: colors.dim,
    marginTop: space.xs,
  },
});
