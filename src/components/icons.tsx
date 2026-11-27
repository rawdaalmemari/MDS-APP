import type { ColorValue } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '../lib/theme';

type P = { size?: number; color?: ColorValue };
const base = (size: number, color: ColorValue) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
});

export const ClockIcon = ({ size = 24, color = colors.plum }: P) => (
  <Svg {...base(size, color)}><Circle cx="12" cy="12" r="9" /><Path d="M12 7v5l3 2" /></Svg>
);
export const CalendarIcon = ({ size = 24, color = colors.plum }: P) => (
  <Svg {...base(size, color)}><Rect x="3" y="5" width="18" height="16" rx="2" /><Path d="M3 10h18M8 3v4M16 3v4" /></Svg>
);
export const CarIcon = ({ size = 24, color = colors.plum }: P) => (
  <Svg {...base(size, color)}><Path d="M5 17h14M3 17v-4l2-5h14l2 5v4M3 13h18" /><Circle cx="7.5" cy="17.5" r="1.8" /><Circle cx="16.5" cy="17.5" r="1.8" /></Svg>
);
export const InboxIcon = ({ size = 24, color = colors.plum }: P) => (
  <Svg {...base(size, color)}><Path d="M4 13h4l2 3h4l2-3h4" /><Path d="M4 13l2-8h12l2 8v6H4z" /></Svg>
);
export const PeopleIcon = ({ size = 24, color = colors.plum }: P) => (
  <Svg {...base(size, color)}><Circle cx="9" cy="8" r="3.5" /><Path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6" /></Svg>
);
export const BellIcon = ({ size = 22, color = colors.plum }: P) => (
  <Svg {...base(size, color)}><Path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z" /><Path d="M10 20a2.2 2.2 0 0 0 4 0" /></Svg>
);
export const PinIcon = ({ size = 16, color = colors.onDark }: P) => (
  <Svg {...base(size, color)}><Path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><Circle cx="12" cy="9.5" r="2.5" /></Svg>
);
export const ShieldIcon = ({ size = 16, color = colors.onDark }: P) => (
  <Svg {...base(size, color)}><Path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z" /></Svg>
);
export const CameraIcon = ({ size = 20, color = '#FFFFFF' }: P) => (
  <Svg {...base(size, color)}><Path d="M4 8h3l2-3h6l2 3h3v11H4z" /><Circle cx="12" cy="13" r="3.5" /></Svg>
);
export const PlusIcon = ({ size = 20, color = '#FFFFFF' }: P) => (
  <Svg {...base(size, color)}><Path d="M12 5v14M5 12h14" /></Svg>
);
export const BackIcon = ({ size = 20, color = colors.maroon }: P) => (
  <Svg {...base(size, color)}><Path d="M15 18l-6-6 6-6" /></Svg>
);
export const ChevronIcon = ({ size = 18, color = colors.muted }: P) => (
  <Svg {...base(size, color)}><Path d="M9 6l6 6-6 6" /></Svg>
);

/** The three-tile Munazuri mark. */
export function LogoMark({ height = 18 }: { height?: number }) {
  return (
    <Svg width={(height * 58) / 18} height={height} viewBox="0 0 58 18" accessibilityElementsHidden>
      <Rect x="0" y="0" width="18" height="18" rx="5" fill={colors.orange} />
      <Path d="M4.5 13.5v-3.2a4.5 4.5 0 0 1 9 0v3.2M7.2 13.5v-2.6a1.8 1.8 0 0 1 3.6 0v2.6" fill="none" stroke={colors.cream} strokeWidth={1.6} strokeLinecap="round" />
      <Rect x="20" y="0" width="18" height="18" rx="5" fill={colors.plum} />
      <Rect x="23.5" y="6.5" width="11" height="1.8" rx="0.9" fill={colors.lavender} />
      <Circle cx="29" cy="11.5" r="1.6" fill={colors.lavender} />
      <Rect x="40" y="0" width="18" height="18" rx="5" fill={colors.maroon} />
      <Path d="M42.5 13.5l4-8 4 8z" fill={colors.sand} />
      <Path d="M47.5 13.5l3.5-7 3.5 7z" fill={colors.rose} />
    </Svg>
  );
}
