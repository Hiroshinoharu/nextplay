import { Fragment, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 60_000,
    },
  },
})

const AppShell = (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
    {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
  </QueryClientProvider>
)

createRoot(document.getElementById('root')!).render(
  import.meta.env.DEV ? <Fragment>{AppShell}</Fragment> : <StrictMode>{AppShell}</StrictMode>
)
