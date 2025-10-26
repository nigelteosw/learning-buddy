import { useState } from 'react';
import reactLogo from '@/assets/react.svg';
import wxtLogo from '/wxt.svg';

function App() {
  const [count, setCount] = useState(0);

  return (
    // 2. Center everything on the page
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 p-8 text-center text-white">
      
      {/* 3. Logo container */}
      <div className="flex justify-center p-4">
        <a href="https://wxt.dev" target="_blank">
          <img 
            src={wxtLogo} 
            // 4. Replaced ".logo" class
            className="h-24 p-2 transition-all duration-300 will-change-[filter] hover:drop-shadow-[0_0_2em_#fca311]" 
            alt="WXT logo" 
          />
        </a>
        <a href="https://react.dev" target="_blank">
          <img 
            src={reactLogo} 
            // 5. Replaced ".logo .react" class
            className="h-24 p-2 transition-all duration-300 will-change-[filter] hover:drop-shadow-[0_0_2em_#61dafbaa]" 
            alt="React logo" 
          />
        </a>
      </div>

      {/* 6. Header */}
      <h1 className="text-5xl font-bold">WXT + React</h1>

      {/* 7. Replaced ".card" class */}
      <div className="p-8">
        <button 
          onClick={() => setCount((count) => count + 1)}
          // 8. Basic button styling
          className="rounded-lg border border-transparent bg-gray-800 px-6 py-3 font-medium transition-colors hover:border-blue-500"
        >
          count is {count}
        </button>
        <p className="mt-4">
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>

      {/* 9. Replaced ".read-the-docs" class */}
      <p className="text-gray-400">
        Click on the WXT and React logos to learn more
      </p>
    </main>
  );
}

export default App;