import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './components/AuthProvider';
import { Toaster } from 'react-hot-toast';
import { AppSettingsProvider } from './context/AppSettingsContext';
import { MotionConfig } from 'motion/react';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AppSettingsProvider>
        <AuthProvider>
          {/* Follow the phone's "reduce motion" setting: movement is dropped, fades stay. */}
          <MotionConfig reducedMotion="user">
            <App />
          </MotionConfig>
          <Toaster position="top-center" />
        </AuthProvider>
      </AppSettingsProvider>
    </ErrorBoundary>
  </StrictMode>,
);
