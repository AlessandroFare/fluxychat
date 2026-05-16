# Fluxychat Dashboard Style Guide

This document outlines the design system and styling approach for the Fluxychat dashboard, based on the Blockit template aesthetic.

## Color Palette

### Primary Colors
- **Background**: `#FDFBF9` - Warm cream/off-white background
- **Foreground**: `#0E1316` - Dark text color
- **Brand (Coral)**: `#ff725e` - Primary accent color
- **Brand Dark**: `#F28069` - Darker coral variant

### Text Colors
- **Primary Text**: `#0E1316` - Main content text
- **Muted Text**: `#745050` - Secondary/muted text
- **Secondary Text**: `#979797` - Tertiary text
- **Light Text**: `#c9c9cf` - Text for dark backgrounds

### UI Colors
- **Border**: `rgba(14, 19, 22, 0.1)` - Subtle borders
- **Card Background**: `rgba(255, 255, 255, 0.6)` - Semi-transparent white cards

## Typography

### Font Families
- **Sans-serif**: System fonts (system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto)
- **Monospace**: UI monospace fonts for code

### Heading Styles
- **H1**: Large, bold, tight letter-spacing (-0.03em)
- **H2**: Medium-large, bold, tight letter-spacing (-0.02em)
- **H3**: Medium, semibold, tight letter-spacing (-0.01em)
- **H4**: Small, semibold, uppercase, wide letter-spacing (0.1em) - for labels

### Text Sizes
- Use Tailwind's default text scale
- Body text: `text-base` (16px)
- Small text: `text-sm` (14px)
- Extra small: `text-xs` (12px)

## Components

### Buttons

#### Primary Button
```tsx
<button className="btn btn-primary">
  Get Started
</button>
```
- Black background (`bg-foreground`)
- White text (`text-background`)
- Rounded corners (`rounded-lg`)
- Hover: Slight opacity reduction

#### Secondary Button
```tsx
<button className="btn btn-secondary">
  Learn More
</button>
```
- Transparent background
- Coral text (`text-brand`)
- Border (`border border-brand`)
- Hover: Light coral background

### Cards
```tsx
<div className="card">
  {/* Content */}
</div>
```
- White background with transparency
- Rounded corners (`rounded-3xl` - 24px)
- Subtle border and shadow
- Padding: `p-6`

### Header
- Sticky positioning
- Cream background with backdrop blur
- Border bottom
- Logo on left, navigation in center, CTA on right

## Spacing

- Use Tailwind's spacing scale
- Common gaps: `gap-4` (16px), `gap-8` (32px)
- Common padding: `p-4` (16px), `p-6` (24px), `p-8` (32px)
- Container max-width: Use `container mx-auto` with responsive padding

## Border Radius

- **Small**: `rounded-lg` (8px) - buttons, small elements
- **Medium**: `rounded-2xl` (16px) - cards, larger elements
- **Large**: `rounded-3xl` (24px) - main cards, hero sections

## Logo

The logo is located at `/public/logo.jpg` and should be used in:
- Header navigation
- Favicon (future)
- Loading states (future)
- Email templates (future)

## Design Principles

1. **Minimalist**: Clean, uncluttered interfaces with generous whitespace
2. **Warm & Inviting**: Cream background creates a soft, approachable feel
3. **Modern & Technical**: Monospace-inspired typography for a tech-forward aesthetic
4. **Accessible**: High contrast ratios, clear hierarchy, readable fonts
5. **Consistent**: Use design tokens (colors, spacing, typography) consistently

## Responsive Design

- Mobile-first approach
- Breakpoints: `sm:` (640px), `md:` (768px), `lg:` (1024px), `xl:` (1280px)
- Stack elements vertically on mobile, horizontal on desktop
- Navigation collapses to hamburger menu on mobile (future)

## Animation & Transitions

- Smooth transitions: `transition-all duration-200`
- Hover states: Subtle opacity/color changes
- Respect `prefers-reduced-motion` for accessibility
- Use CSS transitions over JavaScript animations when possible

## Examples

### Hero Section
```tsx
<section className="text-center max-w-3xl mx-auto py-16">
  <h1 className="heading-h1 mb-4">
    The <strong>AI-powered</strong> chat platform
  </h1>
  <p className="text-lg text-text-muted mb-6">
    Ultra-low-cost realtime chat
  </p>
</section>
```

### Feature Card
```tsx
<div className="card">
  <div className="heading-h4 mb-2">INSTANTANEOUS</div>
  <h3 className="heading-h3 mb-4">Schedule in the Blink of AI</h3>
  <p className="text-text-muted">
    Blockit responds to any request instantly
  </p>
</div>
```

## Tailwind Classes Reference

### Custom Classes (defined in globals.css)
- `.btn` - Base button styles
- `.btn-primary` - Primary button variant
- `.btn-secondary` - Secondary button variant
- `.btn-transparent` - Transparent button variant
- `.heading-h1` - H1 heading style
- `.heading-h2` - H2 heading style
- `.heading-h3` - H3 heading style
- `.heading-h4` - H4 label style
- `.card` - Card container style

### Color Utilities
- `bg-background` - Cream background
- `bg-foreground` - Dark background/text
- `bg-brand` - Coral accent
- `text-foreground` - Dark text
- `text-text-muted` - Muted text
- `text-brand` - Coral text
- `border-border` - Subtle border
