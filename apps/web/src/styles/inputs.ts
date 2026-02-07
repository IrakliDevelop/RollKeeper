// Standardized input and form control styling for better readability
// Uses semantic tokens that auto-switch between light and dark mode.

export const inputStyles = {
  // Base input styling with good contrast
  base: 'w-full px-4 py-3 border-2 border-input-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-input-bg text-input-text placeholder-input-placeholder transition-colors duration-200 dark:focus:ring-blue-400 dark:focus:border-blue-400',

  // Purple theme for inventory/currency
  purple:
    'w-full px-4 py-3 border-2 border-input-border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-input-bg text-input-text placeholder-input-placeholder transition-colors duration-200 dark:focus:ring-purple-400 dark:focus:border-purple-400',

  // Blue theme for equipment/general
  blue: 'w-full px-4 py-3 border-2 border-input-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-input-bg text-input-text placeholder-input-placeholder transition-colors duration-200 dark:focus:ring-blue-400 dark:focus:border-blue-400',

  // Green theme for currency/success
  green:
    'w-full px-4 py-3 border-2 border-input-border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-input-bg text-input-text placeholder-input-placeholder transition-colors duration-200 dark:focus:ring-green-400 dark:focus:border-green-400',

  // Small input variant
  small:
    'w-full px-3 py-2 border-2 border-input-border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-input-bg text-input-text placeholder-input-placeholder transition-colors duration-200 text-sm dark:focus:ring-blue-400 dark:focus:border-blue-400',

  // Textarea styling
  textarea:
    'w-full px-4 py-3 border-2 border-input-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-input-bg text-input-text placeholder-input-placeholder transition-colors duration-200 resize-none dark:focus:ring-blue-400 dark:focus:border-blue-400',
};

export const selectStyles = {
  // Base select styling
  base: 'w-full px-4 py-3 border-2 border-input-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-input-bg text-input-text transition-colors duration-200 dark:focus:ring-blue-400 dark:focus:border-blue-400',

  // Purple theme for inventory/currency
  purple:
    'w-full px-4 py-3 border-2 border-input-border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-input-bg text-input-text transition-colors duration-200 dark:focus:ring-purple-400 dark:focus:border-purple-400',

  // Blue theme for equipment/general
  blue: 'w-full px-4 py-3 border-2 border-input-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-input-bg text-input-text transition-colors duration-200 dark:focus:ring-blue-400 dark:focus:border-blue-400',

  // Small select variant
  small:
    'w-full px-3 py-2 border-2 border-input-border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-input-bg text-input-text transition-colors duration-200 text-sm dark:focus:ring-blue-400 dark:focus:border-blue-400',
};

export const labelStyles = {
  base: 'block text-sm font-medium text-heading mb-2',
  required:
    "block text-sm font-medium text-heading mb-2 after:content-['*'] after:text-red-500 after:ml-1",
};
