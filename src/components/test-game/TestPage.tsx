import React from "react";
import { TestGame } from "./TestGame";
import { TestStreak } from "./TestStreak";

export function TestPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white">Test Your Knowledge</h2>
      <TestStreak />
      <TestGame />
    </div>
  );
}
