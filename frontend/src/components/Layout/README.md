# Layout Components

This folder contains the core layout system for the three-container UI redesign:

- **ThreeContainerLayout.tsx**: Main layout wrapper with left, center, and right panel slots
- **LeftPanel.tsx**: Fixed aspect ratio, for image/expression display (hidden if no image)
- **CenterPanel.tsx**: Flexible, scrollable main content area
- **RightPanel.tsx**: Fixed aspect ratio, persistent editing panel (icon-only action bar)
- **IconActionBar.tsx**: Icon-only action bar for right panel (Delete, Import, Export, Expressions, Image)
- **HeaderNavigationBar.tsx**: Reusable navigation header with consistent icon structure

Usage: Import `ThreeContainerLayout` and pass content for each panel as needed. Use `HeaderNavigationBar` for consistent navigation with toggle callbacks.
