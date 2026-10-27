# Changelog

All notable changes to Finance. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.3.0] - 2026-10-27

### Added
- Home opens on what matters: net worth, what is left this month and how much you can spend per day, with a spending pace curve against last month. Budget status, upcoming bills, top categories and recent entries appear only when there is something to show.
- Budgets show their pace: calm while on track, amber when the period is heading over, red once over, with upcoming bills drawn ahead of time.
- Rollover budgets: carry what is left (or overspent) into the next period.
- Hide amounts: mask every amount in the app with one tap, charts keep their shape.
- Insights: net worth over time (total or by account), cash flow with savings rate, a money flow chart from income to categories and savings, period comparison by category, top payees, and category trends with sparklines.
- Monthly report and a year in review, both shareable as an image with or without amounts.
- Spending calendar with bills due and no-spend days, plus your current and best no-spend streak.

### Changed
- New look. Pick it in Settings → Appearance: System (clean white and black, like Apple's own apps; the new default), Titanium (graphite and brushed metal, made for dark mode) or Paper (the original warm look). Ink is the new default accent; Blue and Titanium join the others.
- Mono by default: categories, icons and charts in shades of grey, told apart by symbol and lightness, with an ink accent. Colour is reserved for money that means something: income, spending and budgets that are over. Prefer colour? Settings → Appearance → Categories → Colour.
- Icons are SF Symbols by default, in ink on neutral tiles. Soft tints, colour tiles (like iOS Settings) and symbols only are in Settings → Appearance → Icon tiles.
- Amounts use SF Pro Rounded, as in Wallet and Fitness.
- Settings opens with a summary card and groups rows into Money, Preferences, Appearance, Privacy and alerts, and Data.
- The Insights tab icon is a bar chart.
- Category rows show their group and how many transactions they hold.

### Fixed
- Editing a category from Insights opened it over an empty Settings screen.
- The category editor's body could slide under its toolbar on iOS.
- Reordering categories snapped rows back and scrolled the list while dragging.
- Finishing a swipe on a category opened it; tapping another row now closes an open swipe first.
- Deleting a category nothing uses asked where to move its transactions; it now deletes at once with Undo.
- Picking a colour in the category editor lagged.

## [0.2.0] - 2026-10-15

### Added
- Pocket money: mark an account you top up from another (for example Cash from Salary) with a refill amount. Home shows what is left, leftover included, with a Refill button that opens the transfer already filled in. After a refill, the next entry opens as an expense on that account.
- Accent colours in Settings → Appearance: Gold, Silver, Slate, Sage and Copper. Silver is the new default.
- New app icon, and a Rupee alternate icon you can pick in Settings → Appearance → App icon.

### Fixed
- Edit sheets for accounts, budgets, recurring rules and categories opened blank on iOS 26.
- The keyboard covered the memo field and the bottom of the add sheet while typing.
