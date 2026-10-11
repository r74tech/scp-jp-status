import '@mantine/core/styles.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import { pageConfig } from '@/page.config'
import App from './App'

document.title = pageConfig.title ?? ''
if (pageConfig.favicon) {
  document.querySelector<HTMLLinkElement>('link[rel="icon"]')!.href = pageConfig.favicon
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider defaultColorScheme="auto">
      <App />
    </MantineProvider>
  </StrictMode>
)
