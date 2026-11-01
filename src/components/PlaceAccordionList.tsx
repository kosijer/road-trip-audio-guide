import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../hooks/useI18n';
import {
  applyTasteForPoi,
  type ExposureOutcome,
  type PreferenceMode,
} from '../preferences';
import { colors, sharedStyles, space, type } from '../theme';
import { Accordion } from './Accordion';
import { MapsLinks, type MapsTravelMode } from './MapsLinks';
import { PreferenceFeedback } from './PreferenceFeedback';

export type PlaceListItem = {
  id: string;
  title: string;
  distanceLabel?: string;
  summary?: string;
  latitude: number;
  longitude: number;
};

type Props = {
  items: PlaceListItem[];
  /** Section eyebrow — defaults to standardized “Nearby”. */
  headingKey?: 'placeNearby';
  mapsMode?: MapsTravelMode;
  tasteMode?: PreferenceMode;
};

/** Compact multi-place list (e.g. Around “more nearby”). */
export function PlaceAccordionList({
  items,
  headingKey = 'placeNearby',
  mapsMode = 'walking',
  tasteMode = 'browse',
}: Props) {
  const { t } = useI18n();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<
    Record<string, ExposureOutcome | undefined>
  >({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const onTaste = useCallback(
    async (poiId: string, next: 'liked' | 'not_interested') => {
      setBusyId(poiId);
      try {
        const saved = await applyTasteForPoi(poiId, next, tasteMode);
        setOutcomes(prev => ({
          ...prev,
          [poiId]: saved ?? undefined,
        }));
      } finally {
        setBusyId(null);
      }
    },
    [tasteMode],
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <Text style={sharedStyles.sectionCardTitle}>{t(headingKey)}</Text>
      {items.map(item => {
        const open = expandedId === item.id;
        return (
          <Accordion
            key={item.id}
            title={item.title}
            subtitle={item.distanceLabel}
            open={open}
            onToggle={() =>
              setExpandedId(prev => (prev === item.id ? null : item.id))
            }>
            {item.summary ? (
              <Text style={styles.summary} numberOfLines={open ? undefined : 4}>
                {item.summary}
              </Text>
            ) : null}
            <PreferenceFeedback
              variant="links"
              outcome={outcomes[item.id]}
              busy={busyId === item.id}
              onLiked={() => {
                void onTaste(item.id, 'liked');
              }}
              onNotInterested={() => {
                void onTaste(item.id, 'not_interested');
              }}
            />
            <MapsLinks
              latitude={item.latitude}
              longitude={item.longitude}
              mode={mapsMode}
            />
          </Accordion>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: space.sm,
  },
  summary: {
    ...type.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.story,
  },
});
