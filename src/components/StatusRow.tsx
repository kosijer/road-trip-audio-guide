import { Text, View } from 'react-native';
import { sharedStyles } from '../theme';

export function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={sharedStyles.row}>
      <Text style={sharedStyles.rowLabel}>{label}</Text>
      <Text style={sharedStyles.rowValue}>{value}</Text>
    </View>
  );
}
