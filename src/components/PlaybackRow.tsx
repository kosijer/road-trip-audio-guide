import { Pressable, Text, View } from 'react-native';
import { t } from '../i18n';
import { sharedStyles } from '../theme';

type Props = {
  speaking: boolean;
  busy: boolean;
  onStop: () => void;
  onNext: () => void;
};

export function PlaybackRow({ speaking, busy, onStop, onNext }: Props) {
  return (
    <View style={sharedStyles.rowBtns}>
      <Pressable
        style={[sharedStyles.halfBtn, !speaking && sharedStyles.disabled]}
        onPress={onStop}
        disabled={!speaking}>
        <Text style={sharedStyles.secondaryText}>{t('stopSpeech')}</Text>
      </Pressable>
      <Pressable
        style={[sharedStyles.halfBtn, busy && sharedStyles.disabled]}
        onPress={onNext}
        disabled={busy}>
        <Text style={sharedStyles.secondaryText}>{t('nextStory')}</Text>
      </Pressable>
    </View>
  );
}
