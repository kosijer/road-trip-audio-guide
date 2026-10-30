import { Text, View } from 'react-native';
import { t } from '../i18n';
import { sharedStyles } from '../theme';

type Props = {
  title?: string;
  narration?: string;
};

export function LastStoryCard({ title, narration }: Props) {
  if (!narration) {
    return null;
  }
  return (
    <>
      <Text style={sharedStyles.section}>{t('lastStory')}</Text>
      <View style={sharedStyles.card}>
        {title ? <Text style={sharedStyles.storyTitle}>{title}</Text> : null}
        <Text style={sharedStyles.story}>{narration}</Text>
      </View>
    </>
  );
}
