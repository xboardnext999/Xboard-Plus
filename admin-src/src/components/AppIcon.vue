<script setup>
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgePercent,
  BookOpen,
  Box,
  ChevronDown,
  CreditCard,
  Download,
  Gauge,
  Gift,
  HardDrive,
  Info,
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
  ShieldAlert,
  Store,
  Sun,
  Ticket,
  UserRound,
  UserPlus,
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
  AlertTriangle,
  ArrowRight,
  BadgePercent,
  BookOpen,
  Box,
  ChevronDown,
  CreditCard,
  Download,
  Gauge,
  Gift,
  HardDrive,
  Info,
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
  ShieldAlert,
  Store,
  Sun,
  Ticket,
  UserRound,
  UserPlus,
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
