# HITL Review Queue - Visual Layout Reference

## Page Layout

```
┌─────────────────────────────────────────────────────────────┐
│ HITL Review Queue                                            │
│ Review AI suggestions and categorize transactions            │
│                                                               │
│ Transaction 1 of 5  [=========>                    ] 20%      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ May 15, 2024                                             │ │
│ │ Acme Translation Services              $1,250.00        │ │
│ │ Scotiabank Chequing                                     │ │
│ │                                                         │ │
│ │ ┌─────────────────────────────────────────────────────┐│ │
│ │ │ ⚡ AI'S SUGGESTION                                  ││ │
│ │ │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ││ │
│ │ │                                                     ││ │
│ │ │ Confidence: 🟢 High Confidence (92%)               ││ │
│ │ │                                                     ││ │
│ │ │ Reasoning:                                          ││ │
│ │ │ Payment to translation service. Likely a contractor││ │
│ │ │ payment based on vendor name and payment pattern.   ││ │
│ │ │                                                     ││ │
│ │ │ [✓ Accept Suggestion]                              ││ │
│ │ │                                                     ││ │
│ │ └─────────────────────────────────────────────────────┘│ │
│ │                                                         │ │
│ │ YOUR DECISION                                           │ │
│ │ ─────────────────────────────────────────────────────  │ │
│ │                                                         │ │
│ │ Category: [Contractor Services ▼]                      │ │
│ │                                                         │ │
│ │ ┌─────────────────────────────────────────────────────┐│ │
│ │ │ Vendor Type:                                        ││ │
│ │ │                                                     ││ │
│ │ │ ◉ Regular Vendor (track for taxes)                ││ │
│ │ │ ○ One-Time Payment (no tracking)                  ││ │
│ │ │ ○ New Vendor (add to database)                    ││ │
│ │ │                                                     ││ │
│ │ │ [IF REGULAR VENDOR SELECTED]                       ││ │
│ │ │ Select Vendor: [Search... ▼]                      ││ │
│ │ │ ├─ Acme Translation                               ││ │
│ │ │ ├─ Big Blue Solutions                             ││ │
│ │ │ └─ Creative Design Studio                         ││ │
│ │ │                                                     ││ │
│ │ └─────────────────────────────────────────────────────┘│ │
│ │                                                         │ │
│ │ Your Notes (optional):                                  │ │
│ │ ┌─────────────────────────────────────────────────────┐│ │
│ │ │ Regular monthly invoice for translation services   ││ │
│ │ └─────────────────────────────────────────────────────┘│ │
│ │                                                         │ │
│ │ ─────────────────────────────────────────────────────  │ │
│ │                                                         │ │
│ │                    [Skip] [✓ Approve & Save]           │ │
│ │                                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Vendor Selection Variations

### Option 1: Regular Vendor Selected

```
┌─────────────────────────────────┐
│ Vendor Type:                    │
│                                 │
│ ◉ Regular Vendor (track)        │
│ ○ One-Time Payment              │
│ ○ New Vendor                    │
│                                 │
│ Select Vendor:                  │
│ ┌─────────────────────────────┐ │
│ │ 🔍 Search... (Search text) │ │
│ └─────────────────────────────┘ │
│ Select from dropdown:            │
│ ├─ ✓ Selected Vendor Name       │
│ ├─ Other Vendor A               │
│ ├─ Other Vendor B               │
│ └─ Other Vendor C               │
│                                 │
└─────────────────────────────────┘
```

### Option 2: One-Time Payment Selected

```
┌─────────────────────────────────┐
│ Vendor Type:                    │
│                                 │
│ ○ Regular Vendor (track)        │
│ ◉ One-Time Payment              │
│ ○ New Vendor                    │
│                                 │
│ (Vendor section hidden)         │
│                                 │
└─────────────────────────────────┘
```

### Option 3: New Vendor Selected

```
┌─────────────────────────────────┐
│ Vendor Type:                    │
│                                 │
│ ○ Regular Vendor (track)        │
│ ○ One-Time Payment              │
│ ◉ New Vendor                    │
│                                 │
│ Vendor Name *:                  │
│ ┌─────────────────────────────┐ │
│ │ Enter vendor name...        │ │
│ └─────────────────────────────┘ │
│                                 │
│ Contractor Type *:              │
│ ┌─────────────────────────────┐ │
│ │ Select type:          ▼ │ │
│ ├─ Language Vendor           │ │
│ ├─ Offshore Employee         │ │
│ ├─ Legal                     │ │
│ └─ ... (8 more options)      │ │
│ └─────────────────────────────┘ │
│                                 │
│ ☐ Is Offshore?                  │
│                                 │
│ Country:                        │
│ ┌─────────────────────────────┐ │
│ │ ▼ CA                        │ │
│ ├─ CA                        │ │
│ ├─ US                        │ │
│ ├─ UK                        │ │
│ └─ ... (5 more options)      │ │
│ └─────────────────────────────┘ │
│                                 │
└─────────────────────────────────┘
```

## Confidence Badge Colors

### High Confidence (85-100%)
```
╔════════════════════════════════╗
║ 🟢 High Confidence (92%)        ║
╚════════════════════════════════╝
   ↓ Green background
   ↓ Green text
   ↓ Shows user confidence in AI
```

### Medium Confidence (70-84%)
```
╔════════════════════════════════╗
║ 🟡 Medium Confidence (78%)      ║
╚════════════════════════════════╝
   ↓ Yellow background
   ↓ Yellow text
   ↓ User should review carefully
```

### Low Confidence (0-69%)
```
╔════════════════════════════════╗
║ 🔴 Low Confidence (52%)         ║
╚════════════════════════════════╝
   ↓ Red background
   ↓ Red text
   ↓ User should likely override
```

## Form States

### Initial State (No Category Selected)
```
Category: [Select category ▼]

(All form sections hidden except category)

[Skip] [Approve & Save] (DISABLED)
  ↑
  └─ Cannot save without category
```

### After Category Selected (Non-Contractor)
```
Category: [Utilities ▼]

(Vendor section NOT shown)
(Only shows notes textarea)

Your Notes (optional):
[____________________]

[Skip] [✓ Approve & Save] (ENABLED)
```

### After Contractor Category Selected
```
Category: [Contractor Services ▼]

(Vendor section SHOWN with options)

Vendor Type:
○ Regular Vendor
○ One-Time Payment
○ New Vendor

(Form updates based on selection)

Your Notes (optional):
[____________________]

[Skip] [✓ Approve & Save] (ENABLED with validation)
```

### When Category Differs from AI
```
Category: [Selected Category ▼] (different from AI)

...other fields...

Your Notes (optional):
[____________________]

Why different from AI? (SHOWN because category changed)
[____________________]

[Skip] [✓ Approve & Save]
```

## Color Scheme

### Light Mode
```
AI Suggestion Section
├─ Background: #f0f9ff (light blue)
├─ Border: #bfdbfe (blue)
├─ Text: #1e40af (dark blue)
└─ Button: #16a34a → #15803d (green)

Vendor Section
├─ Background: #f5f5f5 (light gray)
├─ Border: #e5e5e5 (gray)
└─ Text: #000000 (black)

Badges
├─ High: Green (#dcfce7 bg, #15803d text)
├─ Medium: Yellow (#fef3c7 bg, #b45309 text)
└─ Low: Red (#fee2e2 bg, #991b1b text)
```

### Dark Mode
```
AI Suggestion Section
├─ Background: #0c2340 (dark blue)
├─ Border: #1e3a8a (blue)
├─ Text: #93c5fd (light blue)
└─ Button: Same green

Vendor Section
├─ Background: #2a2a2a (dark gray)
├─ Border: #444444 (gray)
└─ Text: #ffffff (white)

Badges
├─ High: Green (dark bg, light text)
├─ Medium: Yellow (dark bg, light text)
└─ Low: Red (dark bg, light text)
```

## Interaction States

### Button States

```
[✓ Accept Suggestion] Button
├─ Normal: Green, clickable
├─ Hover: Darker green
├─ Active: Even darker green
└─ Disabled: Grayed out

[Skip] Button
├─ Normal: Outline style
├─ Hover: Slight background change
└─ Disabled: Grayed out

[✓ Approve & Save] Button
├─ Normal: Blue, clickable (when category selected)
├─ Hover: Darker blue
├─ Active: Even darker
├─ Loading: Shows spinner
└─ Disabled: Grayed (no category selected)
```

### Form Field States

```
Dropdown (Category/Vendor Type)
├─ Normal: Border, white background
├─ Focused: Blue outline
├─ Hover: Light background
└─ Disabled: Grayed

Searchbox (Vendor Search)
├─ Normal: Border, white background
├─ Focused: Blue outline
├─ Has text: Shows results below
└─ No results: Shows "no vendors found"

Textarea (Notes/Reasoning)
├─ Normal: Border, white background
├─ Focused: Blue outline
├─ Empty: Placeholder text showing
└─ Typing: Text appears

Radio Button (Vendor Type)
├─ Unselected: Empty circle
├─ Selected: Filled blue circle
└─ Disabled: Grayed circle

Checkbox (Offshore)
├─ Unchecked: Empty box
├─ Checked: Blue box with checkmark
└─ Disabled: Grayed box
```

## Progress Indicator

```
Top of card:
Transaction 1 of 5  [=========>                    ] 20%
               ↑                 ↑                   ↑
               Current           Progress bar       Percentage
               position          (visual)           complete

Bottom of card shows result:
✅ Transaction approved and saved!
[Next transaction loads automatically]
```

## Error States

### Validation Error
```
┌─────────────────────────────┐
│ ❌ Validation Error         │
│                             │
│ Category must be selected   │
│                             │
│ [OK]                        │
└─────────────────────────────┘

(Form remains visible for correction)
```

### Save Error
```
┌─────────────────────────────┐
│ ❌ Error                    │
│                             │
│ Failed to approve           │
│ transaction.                │
│                             │
│ [OK]                        │
└─────────────────────────────┘

(Approve button remains visible)
```

### Save Success
```
┌─────────────────────────────┐
│ ✅ Success                  │
│                             │
│ Transaction approved and    │
│ saved!                      │
│                             │
│ [OK]                        │
└─────────────────────────────┘

(Card automatically refreshes with next transaction)
```

## Responsive Behavior

### Desktop (1400px+)
```
┌──────────────────────────────────────────┐
│ Full layout as shown above                │
│ All sections side by side                │
│ Wide dropdowns and inputs                │
└──────────────────────────────────────────┘
```

### Tablet (1024px)
```
┌────────────────────────────┐
│ Card layout remains        │
│ Slightly smaller inputs    │
│ Stack elements if needed   │
└────────────────────────────┘
```

### Mobile (< 768px)
```
┌──────────────────┐
│ Single column    │
│ Full width inputs│
│ Scroll to see all│
│ Bottom buttons   │
└──────────────────┘
```

## Keyboard Navigation

```
Tab Order:
1. Category dropdown
2. Vendor Type radio buttons (if contractor)
3. Vendor selection (if regular vendor)
4. Notes textarea
5. Why different? textarea (if visible)
6. Skip button
7. Approve & Save button

Shortcuts:
├─ Enter: Submit form (on last field)
├─ Escape: Close dropdowns
├─ Arrow keys: Navigate dropdowns and radio buttons
└─ Space: Toggle checkboxes
```

## Accessibility Features

```
✓ ARIA labels on all form elements
✓ Color not only indicator (also icons/text)
✓ High contrast text
✓ Keyboard navigation
✓ Focus indicators
✓ Screen reader friendly
✓ Semantic HTML
✓ Error messages linked to fields
```

## Animation & Transitions

```
Smooth animations:
├─ Vendor section: Fade in/out (200ms)
├─ Why different?: Fade in/out (200ms)
├─ Progress bar: Linear (300ms)
├─ Button hover: Color change (100ms)
├─ Dropdown open/close: Fade (150ms)
└─ Toast notification: Slide in/out (300ms)

No animations:
└─ Form field focuses (instant for accessibility)
```

This visual guide should help understand the layout and interactions!
