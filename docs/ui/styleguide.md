# UI Style Guide

## Color Palette
| Token | Value |
|-------|-------|
| `--color-base` | `#0a0b10` |
| `--color-accent-cyan` | `#22d3ee` |
| `--color-accent-violet` | `#8b5cf6` |
| `--color-accent-green` | `#22c55e` |
| `--color-surface` | `#111827` |
| `--color-text-primary` | `#f8fafc` |

## Typography
- Font family: `Inter`, system fallback
- Heading scale: clamp for responsive sizing (see `tokens.ts`)
- Body text: 16px / 1.6 line-height

## Spacing
| Token | Value |
|-------|-------|
| `--space-xs` | `0.25rem` |
| `--space-sm` | `0.5rem` |
| `--space-md` | `1rem` |
| `--space-lg` | `1.5rem` |
| `--space-xl` | `2rem` |

## Usage Notes
- Apply gradients using cyan/violet/green accents sparingly for highlights.
- Maintain dark backgrounds with high contrast text for accessibility.
- Respect reduced-motion preferences when animating gradients or backgrounds.
