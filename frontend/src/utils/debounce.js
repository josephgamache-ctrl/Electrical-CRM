/**
 * Creates a debounced version of a function that delays execution
 * until after `delay` milliseconds have elapsed since the last call.
 * 
 * @param {Function} func - The function to debounce
 * @param {number} delay - The delay in milliseconds (default: 300ms)
 * @returns {Function} - The debounced function with a cancel method
 */
export function debounce(func, delay = 300) {
  let timeoutId;
  
  const debouncedFn = function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
  
  debouncedFn.cancel = function() {
    clearTimeout(timeoutId);
  };
  
  return debouncedFn;
}

/**
 * React hook for debounced values - useful for search inputs
 * 
 * @param {any} value - The value to debounce
 * @param {number} delay - The delay in milliseconds (default: 300ms)
 * @returns {any} - The debounced value
 */
import { useState, useEffect } from 'react';

export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default debounce;
