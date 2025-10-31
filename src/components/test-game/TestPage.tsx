import React, { useState } from "react";
import { TestGame } from "./TestGame";
import { TestStreak } from "./TestStreak";

export function TestPage() {
  const [isGameInProgress, setIsGameInProgress] = useState(false);

  return (
    <div className="space-y-4">
      {!isGameInProgress && (
        <h2 className="text-lg font-semibold text-white">Test Your Knowledge</h2>
      )}
      {!isGameInProgress && <TestStreak />}
      <TestGame onGameStateChange={setIsGameInProgress} />
    </div>
  );
}
