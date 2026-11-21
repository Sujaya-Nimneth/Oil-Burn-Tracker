import {
  IconCommand,
  IconFlame,
  IconMap,
  IconChartAreaLine,
  IconInfoCircle,
  IconReceipt,
  IconHeart,
  type IconProps
} from '@tabler/icons-react';

export type Icon = React.ComponentType<IconProps>;

export const Icons = {
  logo: IconCommand,
  fire: IconFlame,
  map: IconMap,
  timeline: IconChartAreaLine,
  about: IconInfoCircle,
  receipt: IconReceipt,
  heart: IconHeart
};
