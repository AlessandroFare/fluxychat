"use client";

import React from "react";
import { TrendingUp, Users, Truck, Euro } from "lucide-react";

interface PricingData {
  basePrice: number; surgeMultiplier: number; surgePrice: number;
  surgeLabel: string; activeTrips: number; availableDrivers: number;
  demandRatio: number; currency: string;
}

interface DynamicPricingProps {
  data: PricingData | null;
  loading: boolean;
}

function surgeColor(mult: number) {
  if (mult <= 1) return "text-green-600 bg-green-50 dark:bg-green-950/30 dark:text-green-400";
  if (mult <= 1.25) return "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30 dark:text-yellow-400";
  return "text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400";
}

export function DynamicPricing({ data, loading }: DynamicPricingProps) {
  if (loading) return <div className="rounded-lg border p-3 text-xs text-muted-foreground animate-pulse">Calculating pricing...</div>;
  if (!data) return null;

  return (
    <div className="rounded-lg border bg-gradient-to-br from-amber-50 to-orange-50 p-3 text-xs dark:from-amber-950/30 dark:to-orange-950/30">
      <div className="mb-2 flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-300">
        <Euro className="h-4 w-4" /> Dynamic Pricing
      </div>

      <div className="mb-2 flex items-center justify-center gap-4">
        <div className="text-center">
          <div className="text-lg font-bold font-mono">{data.basePrice.toFixed(2)} {data.currency}</div>
          <div className="text-muted-foreground">Base price</div>
        </div>
        {data.surgeMultiplier > 1 && (
          <>
            <span className="text-2xl text-muted-foreground">&times;</span>
            <div className="text-center">
              <div className={surgeColor(data.surgeMultiplier)}>
                <span className="text-lg font-bold font-mono">{data.surgeMultiplier.toFixed(2)}x</span>
                <div className="text-[10px]">{data.surgeLabel}</div>
              </div>
            </div>
            <span className="text-2xl text-muted-foreground">=</span>
            <div className="text-center">
              <div className="text-lg font-bold font-mono text-amber-700 dark:text-amber-300">{data.surgePrice.toFixed(2)} {data.currency}</div>
              <div className="text-muted-foreground">Final price</div>
            </div>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-3 text-muted-foreground">
        <span><Truck className="mr-0.5 inline h-3 w-3" /> {data.activeTrips} active</span>
        <span><Users className="mr-0.5 inline h-3 w-3" /> {data.availableDrivers} available</span>
        <span><TrendingUp className="mr-0.5 inline h-3 w-3" /> Demand ratio: {data.demandRatio.toFixed(1)}</span>
      </div>
    </div>
  );
}
