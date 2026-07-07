<script setup>
import {
  Activity,
  BadgePercent,
  BookOpen,
  Box,
  ChevronDown,
  CreditCard,
  Gauge,
  Gift,
  HardDrive,
  LockKeyhole,
  Monitor,
  Moon,
  Newspaper,
  Puzzle,
  RefreshCw,
  Route,
  Search,
  Server,
  SlidersHorizontal,
  Store,
  Sun,
  Ticket,
  UserRound,
  UsersRound,
} from '@lucide/vue';

const props = defineProps({
  name: {
    type: String,
    required: true,
  },
  size: {
    type: [Number, String],
    default: 18,
  },
  strokeWidth: {
    type: [Number, String],
    default: 2,
  },
});

const icons = {
  Activity,
  BadgePercent,
  BookOpen,
  Box,
  ChevronDown,
  CreditCard,
  Gauge,
  Gift,
  HardDrive,
  LockKeyhole,
  Monitor,
  Moon,
  Newspaper,
  Puzzle,
  RefreshCw,
  Route,
  Search,
  Server,
  SlidersHorizontal,
  Store,
  Sun,
  Ticket,
  UserRound,
  UsersRound,
};
</script>

<template>
  <component
    :is="icons[props.name] || Box"
    :size="props.size"
    :stroke-width="props.strokeWidth"
    aria-hidden="true"
  />
</template>
