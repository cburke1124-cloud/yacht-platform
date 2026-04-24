// Web stub for react-native-keyboard-controller
// Native keyboard controller APIs are no-ops on web.
import React from 'react';
import { View } from 'react-native';

export const KeyboardProvider = ({ children }) => React.createElement(View, null, children);
export const KeyboardAwareScrollView = View;
export const KeyboardAvoidingView = View;
export const useKeyboardHandler = () => {};
export const useReanimatedKeyboardAnimation = () => ({ height: { value: 0 }, progress: { value: 0 } });
export const KeyboardStickyView = View;
export const KeyboardGestureArea = View;
export const KeyboardController = { setInputMode: () => {}, setDefaultMode: () => {} };

export default {
  KeyboardProvider,
  KeyboardAwareScrollView,
  KeyboardAvoidingView,
  KeyboardStickyView,
  KeyboardGestureArea,
  KeyboardController,
  useKeyboardHandler,
  useReanimatedKeyboardAnimation,
};
