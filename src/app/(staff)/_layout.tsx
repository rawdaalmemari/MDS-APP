import { Tabs } from 'expo-router';
import { CalendarIcon, CarIcon, ClockIcon } from '../../components/icons';
import { tabOptions } from '../../lib/tabOptions';

export default function StaffTabs() {
  return (
    <Tabs screenOptions={tabOptions}>
      <Tabs.Screen name="index" options={{ title: 'Clock', tabBarIcon: ({ color }) => <ClockIcon color={color} /> }} />
      <Tabs.Screen name="leave" options={{ title: 'Leave', tabBarIcon: ({ color }) => <CalendarIcon color={color} /> }} />
      <Tabs.Screen name="car" options={{ title: 'Car', tabBarIcon: ({ color }) => <CarIcon color={color} /> }} />
    </Tabs>
  );
}
