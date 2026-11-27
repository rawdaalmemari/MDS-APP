import { Tabs } from 'expo-router';
import { CarIcon, InboxIcon, PeopleIcon } from '../../components/icons';
import { tabOptions } from '../../lib/tabOptions';

export default function CeoTabs() {
  return (
    <Tabs screenOptions={tabOptions}>
      <Tabs.Screen name="index" options={{ title: 'Overview', tabBarIcon: ({ color }) => <InboxIcon color={color} /> }} />
      <Tabs.Screen name="attendance" options={{ title: 'Attendance', tabBarIcon: ({ color }) => <PeopleIcon color={color} /> }} />
      <Tabs.Screen name="cars" options={{ title: 'Car log', tabBarIcon: ({ color }) => <CarIcon color={color} /> }} />
    </Tabs>
  );
}
