import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState<number>(0)

  return (
    <>
      <nav className="w-full p-4 bg-gray-800 shadow-md">
          <h2 className="text-2xl font-semibold">NextPlay</h2>
            <a href="http://localhost:8081/games" className="mt-6 text-blue-400 hover:underline">Go to Game Service</a>
            <a href="http://localhost:8082" className="mt-6 text-blue-400 hover:underline">Go to Recommender Service</a>
            <a href="http://localhost:8083" className="mt-6 text-blue-400 hover:underline">Go to User Service</a>
        </nav>
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
        <h1 className="text-4xl font-bold text-blue-500">Tailwind is Working 🎨</h1>
        <p className="mt-4 text-lg text-gray-300">
          Welcome to NextPlay frontend!
        </p>
        <button
          onClick={() => setCount(prev => prev + 1)}
          className="mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium"
        >
          Test Button ({count})
        </button>
      </div>
    </>
  )
}

export default App
