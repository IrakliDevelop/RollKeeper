// Standardized input and form control styling for better readability

export const inputStyles = {
  // Base input styling with good contrast
  base: "w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500 transition-colors duration-200",
  
  // Purple theme for inventory/currency
  purple: "w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white text-gray-900 placeholder-gray-500 transition-colors duration-200",
  
  // Blue theme for equipment/general
  blue: "w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500 transition-colors duration-200",
  
  // Green theme for currency/success
  green: "w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white text-gray-900 placeholder-gray-500 transition-colors duration-200",
  
  // Small input variant
  small: "w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500 transition-colors duration-200 text-sm",
  
  // Textarea styling
  textarea: "w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500 transition-colors duration-200 resize-none",
};

export const selectStyles = {
  // Base select styling
  base: "w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 transition-colors duration-200",
  
  // Purple theme for inventory/currency
  purple: "w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white text-gray-900 transition-colors duration-200",
  
  // Blue theme for equipment/general
  blue: "w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 transition-colors duration-200",
  
  // Small select variant
  small: "w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 transition-colors duration-200 text-sm",
};

export const labelStyles = {
  base: "block text-sm font-medium text-gray-800 mb-2",
  required: "block text-sm font-medium text-gray-800 mb-2 after:content-['*'] after:text-red-500 after:ml-1",
}; 