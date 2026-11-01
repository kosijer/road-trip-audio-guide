import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Accordion } from '../components/Accordion';
import { MapsLinks } from '../components/MapsLinks';
import { PreferenceFeedback } from '../components/PreferenceFeedback';
import { useI18n } from '../hooks/useI18n';
import {
  applyTasteForVisit,
  lastExposureForPoi,
  type ExposureOutcome,
} from '../preferences';
import { humanCategory } from '../services/routePrefetch';
import { clearVisitHistory, getVisitHistory } from '../services/store';
import { colors, sharedStyles, space, type } from '../theme';
import type { VisitRecord } from '../types';

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

function tasteLabel(outcome: ExposureOutcome | undefined): string | null {
  if (outcome === 'liked') {
    return '👍';
  }
  if (outcome === 'not_interested') {
    return '👎';
  }
  return null;
}

export function HistoryScreen() {
  const { t, uiLanguage } = useI18n();
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [outcomes, setOutcomes] = useState<
    Record<string, ExposureOutcome | undefined>
  >({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadOutcomes = useCallback(async (rows: VisitRecord[]) => {
    const next: Record<string, ExposureOutcome | undefined> = {};
    await Promise.all(
      rows.map(async visit => {
        try {
          const exposure = await lastExposureForPoi(visit.poiId);
          if (
            exposure?.outcome === 'liked' ||
            exposure?.outcome === 'not_interested'
          ) {
            next[visit.poiId] = exposure.outcome;
          }
        } catch {
          // ignore
        }
      }),
    );
    setOutcomes(next);
  }, []);

  const reload = useCallback(async () => {
    const rows = await getVisitHistory();
    setVisits(rows);
    await loadOutcomes(rows);
    setLoading(false);
  }, [loadOutcomes]);

  useEffect(() => {
    void reload();
    const poll = setInterval(() => {
      void getVisitHistory().then(async rows => {
        setVisits(rows);
        await loadOutcomes(rows);
      });
    }, 4000);
    return () => clearInterval(poll);
  }, [loadOutcomes, reload]);

  const onTaste = useCallback(
    async (visit: VisitRecord, next: 'liked' | 'not_interested') => {
      setBusyId(visit.id);
      try {
        const saved = await applyTasteForVisit(visit, next);
        setOutcomes(prev => ({
          ...prev,
          [visit.poiId]: saved ?? undefined,
        }));
      } finally {
        setBusyId(null);
      }
    },
    [],
  );

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
            setOutcomes({});
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
            const outcome = outcomes[visit.poiId];
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
                  tasteLabel(outcome) ? (
                    <Text style={styles.tasteMark}>{tasteLabel(outcome)}</Text>
                  ) : null
                }>
                {visit.summary ? (
                  <Text style={styles.summary}>{visit.summary}</Text>
                ) : null}
                {visit.narrationExcerpt ? (
                  <Text style={styles.excerpt}>{visit.narrationExcerpt}</Text>
                ) : null}
                <PreferenceFeedback
                  variant="links"
                  outcome={outcome}
                  busy={busyId === visit.id}
                  onLiked={() => {
                    void onTaste(visit, 'liked');
                  }}
                  onNotInterested={() => {
                    void onTaste(visit, 'not_interested');
                  }}
                />
                <MapsLinks
                  latitude={visit.latitude}
                  longitude={visit.longitude}
                  mode="pin"
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
  tasteMark: {
    fontSize: 16,
  },
});
