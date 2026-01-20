import './App.css'

const linkjs = [
  {
    name: 'Game Service',
    url: 'http://localhost:8081/games',
    description: 'Browse and manage game data.'
  },
  {
    name: 'Recommender Service',
    url: 'http://localhost:8082',
    description: 'Get personalized recommendations.'
  },
  {
    name: 'User Service',
    url: 'http://localhost:8083',
    description: 'User profiles and authentication.'
  },
  {
    name: 'Gateway Service',
    url: 'http://localhost:8084',
    description: 'Single entry point to backend APIs.'
  }
]

function App() {
  return (
    <>
      <div className="min-h-screen bg-gray-900 text-white">
        <nav className="w-full p-4 bg-gray-800 shadow-md">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <h2 className="text-2xl font-semibold">NextPlay</h2>
            <span className="text-sm text-gray-400">Service Console</span>
          </div>
        </nav>
        <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-12">
          <header className="space-y-2">
            <h1 className="text-4xl font-bold text-blue-400">Welcome to NextPlay</h1>
            <p className="text-lg text-gray-300">
              Jump straight into each microservice using the links below.
            </p>
          </header>
          <section className="grid gap-6 md:grid-cols-2">
            {linkjs.map(service => (
              <a
                key={service.name}
                href={service.url}
                className="group rounded-xl border border-gray-700 bg-gray-800/60 p-5 transition hover:border-blue-500 hover:bg-gray-800"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-white">{service.name}</h3>
                  <span className="text-sm text-blue-400 group-hover:underline">
                    Open
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-300">{service.description}</p>
                <p className="mt-3 text-xs text-gray-400">{service.url}</p>
              </a>
            ))}
          </section>
        </main>
      </div>
    </>
  )
}

export default App
