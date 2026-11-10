"use client";
import { createContext, useContext } from "react";
import type { InstanceBrand } from "@/lib/instance-brand";
const BrandContext = createContext<InstanceBrand>("hadar");
export function BrandProvider({value,children}:{value:InstanceBrand;children:React.ReactNode}) {
  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}
export const useBrand = () => useContext(BrandContext);
