"use client";

import { motion, type HTMLMotionProps } from "motion/react";

// Small, reusable entrance animations. Kept subtle: short distances, quick
// springs, and disabled automatically for users who prefer reduced motion.

const ease = [0.22, 1, 0.36, 1] as const;

export function FadeIn({ delay = 0, y = 8, ...props }: HTMLMotionProps<"div"> & { delay?: number; y?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease, delay }}
      {...props}
    />
  );
}

export function Stagger({ stagger = 0.05, ...props }: HTMLMotionProps<"div"> & { stagger?: number }) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger } } }}
      {...props}
    />
  );
}

export function StaggerItem(props: HTMLMotionProps<"div">) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0, transition: { duration: 0.35, ease } },
      }}
      {...props}
    />
  );
}
