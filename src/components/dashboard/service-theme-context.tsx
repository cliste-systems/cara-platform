"use client";

import { createContext, useContext } from "react";

export const ServiceThemeContext = createContext(false);
export function useServiceTheme() { return useContext(ServiceThemeContext); }
